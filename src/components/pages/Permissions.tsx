import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { loadAllEventRefs, eventLabel, type EventRef } from '../../lib/events'
import { piiAdmin, type PiiStatus } from '../../lib/pii'
import LoadingSpinner from '../LoadingSpinner'
import EmptyState from '../EmptyState'

// 박람회/행사별 권한 관리 (관리자 전용)
// - 모든 박람회: 전체 박람회·행사 (이후 새로 등록되는 박람회 포함)
// - 특정 박람회: 그 박람회의 모든 행사(이후 추가되는 회차 포함)
// - 특정 행사: 해당 연도·회차 행사만
// - 보기: 조회만 / 편집: 행사 정보·결제·체크리스트·보고서 수정 (박람회 전체 편집이면 회차 추가·박람회 보관도 가능)
// 관리자는 권한 부여 없이 전체 접근. 새 박람회 등록은 관리자만.

interface UserRow { id: string; email: string; sales_owner: string | null; is_admin: boolean; last_sign_in_at: string | null; has_mfa: boolean }
interface PermRow { id: string; user_id: string; all_exhibitions: boolean; exhibition_id: string | null; proposal_id: string | null; level: 'view' | 'edit'; granted_by: string | null; created_at: string }
type Scope = 'all' | 'exh' | 'prop'

const LEVEL_LABEL: Record<string, string> = { view: '보기', edit: '편집' }

export default function Permissions() {
  const { isAdmin, salesOwner, user } = useAuth()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<UserRow[]>([])
  const [perms, setPerms] = useState<PermRow[]>([])
  const [refs, setRefs] = useState<EventRef[]>([])
  const [saving, setSaving] = useState(false)
  const [piiStatus, setPiiStatus] = useState<PiiStatus | null>(null)
  const [piiBusy, setPiiBusy] = useState(false)
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null)

  // 부여 폼
  const [fUser, setFUser] = useState('')
  const [fScope, setFScope] = useState<Scope>('all')
  const [fTarget, setFTarget] = useState('')
  const [fLevel, setFLevel] = useState<'view' | 'edit'>('view')

  async function load() {
    try {
      const [{ data: u, error: ue }, { data: p, error: pe }, r] = await Promise.all([
        supabase.rpc('admin_list_users'),
        supabase.from('expo_permissions').select('*').order('created_at'),
        loadAllEventRefs({ includeArchived: true }),
      ])
      if (ue || pe) { showToast('권한 데이터 로드 중 오류가 발생했습니다.', 'error'); return }
      setUsers((u || []) as UserRow[])
      setPerms((p || []) as PermRow[])
      setRefs(r)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (isAdmin) { load(); runPii('status') } else setLoading(false) }, [isAdmin])

  // 개인정보 암호화 현황 확인 / 아직 평문인 기존 데이터 일괄 암호화
  async function runPii(action: 'status' | 'migrate') {
    setPiiBusy(true)
    try {
      setPiiStatus(await piiAdmin(action))
      if (action === 'migrate') showToast('기존 데이터 암호화가 완료되었습니다.')
    } catch (e: any) {
      showToast('⚠️ 암호화 ' + (action === 'migrate' ? '실행' : '현황 확인') + ' 실패: ' + (e?.message || '알 수 없는 오류'))
    } finally {
      setPiiBusy(false)
    }
  }

  async function resetMfa(u: UserRow) {
    const { error } = await supabase.rpc('admin_reset_mfa', { p_user: u.id })
    if (error) { showToast('⚠️ OTP 초기화 실패: ' + error.message); return }
    setResetTarget(null)
    showToast(`${u.sales_owner || u.email}의 OTP가 초기화되었습니다. 다음 로그인 때 다시 등록합니다.`)
    load()
  }

  if (!isAdmin) return <div className="view"><EmptyState icon="🔒" title="관리자만 접근할 수 있습니다" /></div>
  if (loading) return <div className="view"><LoadingSpinner /></div>

  // 박람회 목록 (행사 목록에서 중복 제거)
  const exhibitions = [...new Map(refs.map(r => [r.exhId, { id: r.exhId, key: r.key, name: r.name }])).values()]
    .sort((a, b) => a.name.localeCompare(b.name))
  const refById = new Map(refs.map(r => [r.proposalId, r]))
  const exhById = new Map(exhibitions.map(e => [e.id, e]))
  const members = users.filter(u => !u.is_admin)
  const admins = users.filter(u => u.is_admin)

  function targetLabel(p: PermRow): string {
    if (p.all_exhibitions) return '모든 박람회 (이후 추가되는 박람회 포함)'
    if (p.exhibition_id) return `${exhById.get(p.exhibition_id)?.name || '(알 수 없는 박람회)'} — 박람회 전체`
    const r = p.proposal_id ? refById.get(p.proposal_id) : undefined
    return r ? eventLabel(r) : '(알 수 없는 행사)'
  }

  async function grant() {
    if (!fUser) { showToast('⚠️ 직원을 선택하세요.'); return }
    if (fScope !== 'all' && !fTarget) { showToast(fScope === 'exh' ? '⚠️ 박람회를 선택하세요.' : '⚠️ 행사를 선택하세요.'); return }
    // 같은 대상에 이미 권한이 있으면 수준만 변경
    const existing = perms.find(p => p.user_id === fUser && (
      fScope === 'all' ? p.all_exhibitions : fScope === 'exh' ? p.exhibition_id === fTarget : p.proposal_id === fTarget))
    setSaving(true)
    try {
      const { error } = existing
        ? await supabase.from('expo_permissions').update({ level: fLevel }).eq('id', existing.id)
        : await supabase.from('expo_permissions').insert({
            user_id: fUser,
            all_exhibitions: fScope === 'all',
            exhibition_id: fScope === 'exh' ? fTarget : null,
            proposal_id: fScope === 'prop' ? fTarget : null,
            level: fLevel,
            granted_by: salesOwner || user?.email || null,
          })
      if (error) { showToast('⚠️ 권한 저장 실패: ' + error.message); return }
      showToast(existing ? '권한 수준이 변경되었습니다.' : '권한이 부여되었습니다.')
      setFTarget('')
      load()
    } finally {
      setSaving(false)
    }
  }

  async function changeLevel(p: PermRow, level: 'view' | 'edit') {
    const { error } = await supabase.from('expo_permissions').update({ level }).eq('id', p.id)
    if (error) { showToast('⚠️ 변경 실패: ' + error.message); return }
    setPerms(prev => prev.map(x => x.id === p.id ? { ...x, level } : x))
  }

  async function revoke(p: PermRow) {
    const { error } = await supabase.from('expo_permissions').delete().eq('id', p.id)
    if (error) { showToast('⚠️ 회수 실패: ' + error.message); return }
    setPerms(prev => prev.filter(x => x.id !== p.id))
    showToast('권한이 회수되었습니다.')
  }

  const userLabel = (u: UserRow) => u.sales_owner ? `${u.sales_owner} (${u.email})` : u.email

  return (
    <div className="view">
      <div className="page-hdr-row">
        <div className="sec-hdr" style={{ margin: 0 }}>
          <div className="bar" />
          <div className="txt">🔐  권한 관리</div>
          <div className="sub">박람회·행사별로 직원에게 보기/편집 권한을 부여합니다. 권한이 없는 박람회는 해당 직원 화면에 표시되지 않습니다.</div>
        </div>
      </div>

      {/* 부여 폼 */}
      <div className="card" style={{ marginTop: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>권한 부여</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'end' }}>
          <div>
            <label style={{ marginTop: 0 }}>직원</label>
            <select value={fUser} onChange={e => setFUser(e.target.value)}>
              <option value="">-- 선택 --</option>
              {members.map(u => <option key={u.id} value={u.id}>{userLabel(u)}</option>)}
            </select>
          </div>
          <div>
            <label style={{ marginTop: 0 }}>범위</label>
            <select value={fScope} onChange={e => { setFScope(e.target.value as Scope); setFTarget('') }}>
              <option value="all">모든 박람회 (이후 추가분 포함)</option>
              <option value="exh">특정 박람회 (모든 회차)</option>
              <option value="prop">특정 행사 (연도·회차)</option>
            </select>
          </div>
          {fScope !== 'all' && (
            <div>
              <label style={{ marginTop: 0 }}>{fScope === 'exh' ? '박람회' : '행사'}</label>
              <select value={fTarget} onChange={e => setFTarget(e.target.value)}>
                <option value="">-- 선택 --</option>
                {fScope === 'exh'
                  ? exhibitions.map(e => <option key={e.id} value={e.id}>{e.name}</option>)
                  : refs.map(r => <option key={r.proposalId} value={r.proposalId}>{eventLabel(r)}</option>)}
              </select>
            </div>
          )}
          <div>
            <label style={{ marginTop: 0 }}>수준</label>
            <select value={fLevel} onChange={e => setFLevel(e.target.value as 'view' | 'edit')}>
              <option value="view">보기 (조회만)</option>
              <option value="edit">편집</option>
            </select>
          </div>
          {/* 비활성화 대신 누르면 빠진 항목을 안내 */}
          <button className="btn btn-primary" onClick={grant} disabled={saving}>
            {saving ? '저장 중...' : '부여'}
          </button>
        </div>
      </div>

      {/* 직원별 현황 */}
      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {members.length === 0 && <EmptyState icon="👤" title="권한을 부여할 직원 계정이 없습니다" />}
        {members.map(u => {
          const mine = perms.filter(p => p.user_id === u.id)
          return (
            <div key={u.id} className="card">
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{u.sales_owner || u.email}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{u.email}</div>
              </div>
              {mine.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>부여된 박람회 권한 없음 — 박람회 화면에 아무것도 표시되지 않습니다.</div>
              ) : (
                <div style={{ marginTop: 8 }}>
                  {mine.map(p => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 0', borderTop: '0.5px solid var(--border2)' }}>
                      <div style={{ flex: '1 1 220px', minWidth: 0, fontSize: 13 }}>{targetLabel(p)}</div>
                      <select value={p.level} onChange={e => changeLevel(p, e.target.value as 'view' | 'edit')} style={{ width: 'auto' }}>
                        <option value="view">{LEVEL_LABEL.view}</option>
                        <option value="edit">{LEVEL_LABEL.edit}</option>
                      </select>
                      <button className="btn btn-muted btn-sm" onClick={() => revoke(p)}>회수</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 계정 보안: 2단계 인증 현황 / OTP 초기화 */}
      <div className="card" style={{ marginTop: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>2단계 인증 (OTP)</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>모든 계정 필수. 휴대폰 변경·분실 시 초기화하면 다음 로그인 때 다시 등록합니다.</div>
        {users.map(u => (
          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 0', borderTop: '0.5px solid var(--border2)' }}>
            <div style={{ flex: '1 1 220px', minWidth: 0, fontSize: 13 }}>{userLabel(u)}</div>
            <span style={{ fontSize: 12, fontWeight: 600, color: u.has_mfa ? '#2E7D51' : '#D97706' }}>{u.has_mfa ? '등록됨' : '미등록 (다음 로그인 때 등록)'}</span>
            {u.has_mfa && <button className="btn btn-muted btn-sm" onClick={() => setResetTarget(u)}>OTP 초기화</button>}
          </div>
        ))}
      </div>

      {/* 개인정보 암호화 현황 */}
      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>개인정보 암호화</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.6 }}>
          리드 담당자명·전화·이메일·주소·비고, Activity·Task 메모는 DB에 암호문으로만 저장됩니다. 아래 수치는 아직 암호화되지 않은 기존 데이터 건수입니다.
        </div>
        {piiStatus ? (
          <div style={{ fontSize: 13, lineHeight: 1.8 }}>
            {Object.entries(piiStatus).map(([table, s]) => (
              <div key={table}>
                {{ sales_leads: '세일즈 리드', sales_activities: 'Activity', sales_tasks: 'Task' }[table] || table}: 미암호화 <b>{s.remaining}</b>건
                {s.encrypted !== undefined && <span style={{ color: 'var(--muted)' }}> (이번에 {s.encrypted}건 암호화)</span>}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>{piiBusy ? '확인 중...' : '현황을 불러오지 못했습니다.'}</div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-muted btn-sm" onClick={() => runPii('status')} disabled={piiBusy}>현황 새로고침</button>
          {piiStatus && Object.values(piiStatus).some(s => s.remaining > 0) && (
            <button className="btn btn-primary btn-sm" onClick={() => runPii('migrate')} disabled={piiBusy}>
              {piiBusy ? '처리 중...' : '기존 데이터 암호화 실행'}
            </button>
          )}
        </div>
      </div>

      {resetTarget && (
        <div className="modal-bg open">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-hdr">
              <h3>OTP 초기화</h3>
              <button className="modal-close" onClick={() => setResetTarget(null)}>✕</button>
            </div>
            <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.6 }}>
              <b style={{ color: 'var(--text)' }}>{userLabel(resetTarget)}</b>의 등록된 OTP를 삭제합니다.
              본인 확인 후 진행하세요. 해당 직원은 다음 로그인 때 새 휴대폰으로 다시 등록합니다.
            </p>
            <div className="modal-footer">
              <button className="btn btn-muted" onClick={() => setResetTarget(null)}>취소</button>
              <button className="btn btn-red" onClick={() => resetMfa(resetTarget)}>초기화</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 20, lineHeight: 1.7 }}>
        관리자({admins.map(a => a.sales_owner || a.email).join(', ')})는 권한 부여 없이 모든 박람회·행사에 접근합니다.<br />
        권한 변경은 해당 직원 화면을 새로고침하면 바로 반영됩니다. 세일즈 리드 권한(본인 리드만)은 이 화면과 별개입니다.
      </div>
    </div>
  )
}
