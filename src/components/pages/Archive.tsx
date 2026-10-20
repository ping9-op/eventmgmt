import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../contexts/ToastContext'
import { useLang } from '../../contexts/LangContext'
import { exhColor } from '../../lib/utils'
import { eventLabel, eventPath } from '../../lib/events'
import type { Exhibition, Proposal, SalesLead } from '../../types/database'
import LoadingSpinner from '../LoadingSpinner'
import EmptyState from '../EmptyState'

// 보관함 — 보관(archived_at) 처리된 박람회·행사·세일즈 리드 조회 및 복원
// 박람회/제안서/리드는 DB에서 실제 삭제가 차단되어 있으므로 여기서도 삭제 기능은 두지 않는다.
// 표시 범위는 각자의 권한 그대로 (박람회: 부여받은 박람회·행사, 리드: 본인 리드 / 관리자는 전체)

interface ArchivedExh { exh: Exhibition; proposals: Proposal[] } // proposals = 박람회와 함께 보관된 행사
type RestoreTarget =
  | { kind: 'exh'; item: ArchivedExh }
  | { kind: 'prop'; prop: Proposal; exh: Exhibition | undefined }
  | { kind: 'lead'; lead: SalesLead }

function fmtArchivedAt(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 박람회 보관 시 같은 시각으로 함께 보관된 행사인지 (Exhibitions.deleteExhibition 기준)
function sameArchive(a?: string | null, b?: string | null): boolean {
  return !!a && !!b && new Date(a).getTime() === new Date(b).getTime()
}

export default function Archive() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { t } = useLang()
  const [loading, setLoading] = useState(true)
  const [archivedExhs, setArchivedExhs] = useState<ArchivedExh[]>([])
  const [archivedProps, setArchivedProps] = useState<Proposal[]>([]) // 개별 보관된 행사
  const [exhMap, setExhMap] = useState<Record<string, Exhibition>>({})
  const [archivedLeads, setArchivedLeads] = useState<SalesLead[]>([])
  const [confirm, setConfirm] = useState<RestoreTarget | null>(null)
  const [restoring, setRestoring] = useState(false)

  async function load(cancelled?: { current: boolean }) {
    try {
      const [{ data: exhData, error: exhErr }, { data: propData, error: propErr }, { data: leadData, error: leadErr }] = await Promise.all([
        supabase.from('exhibitions').select('*'),
        supabase.from('proposals').select('*').not('archived_at', 'is', null),
        supabase.from('sales_leads').select('*').not('archived_at', 'is', null).order('archived_at', { ascending: false }),
      ])
      if (cancelled?.current) return
      if (exhErr || propErr || leadErr) { showToast('보관함 데이터 로드 중 오류가 발생했습니다.', 'error'); return }
      setArchivedLeads((leadData || []) as SalesLead[])

      const exhs = (exhData || []) as Exhibition[]
      const props = ((propData || []) as unknown as Proposal[])
        .sort((a, b) => b.year - a.year || (a.session || '').localeCompare(b.session || ''))
      const map: Record<string, Exhibition> = {}
      for (const e of exhs) map[e.id] = e

      const groups: ArchivedExh[] = exhs
        .filter(e => e.archived_at)
        .sort((a, b) => (b.archived_at || '').localeCompare(a.archived_at || ''))
        .map(exh => ({ exh, proposals: props.filter(p => p.exhibition_id === exh.id && sameArchive(p.archived_at, exh.archived_at)) }))
      const grouped = new Set(groups.flatMap(g => g.proposals.map(p => p.id)))

      setExhMap(map)
      setArchivedExhs(groups)
      setArchivedProps(props.filter(p => !grouped.has(p.id)))
    } finally {
      if (!cancelled?.current) setLoading(false)
    }
  }

  useEffect(() => {
    const cancelled = { current: false }
    load(cancelled)
    return () => { cancelled.current = true }
  }, [])

  async function restore(target: RestoreTarget) {
    setRestoring(true)
    try {
      // 박람회를 먼저 복원 — 중간에 실패해도 '박람회 없는 행사'가 목록에 생기지 않도록
      if (target.kind === 'exh') {
        const { exh, proposals } = target.item
        const { error: exhErr } = await supabase.from('exhibitions').update({ archived_at: null }).eq('id', exh.id)
        if (exhErr) { showToast('⚠️ 박람회 복원 실패: ' + exhErr.message); return }
        if (proposals.length > 0) {
          const { error: propErr } = await supabase.from('proposals').update({ archived_at: null }).in('id', proposals.map(p => p.id))
          if (propErr) { showToast('⚠️ 행사 복원 실패: ' + propErr.message); load(); return }
        }
        showToast(`${exh.name} 박람회가 복원되었습니다.`)
      } else if (target.kind === 'lead') {
        const { error } = await supabase.from('sales_leads').update({ archived_at: null }).eq('id', target.lead.id)
        if (error) { showToast('⚠️ 리드 복원 실패: ' + error.message); return }
        showToast(`${target.lead.company_name} 리드가 복원되었습니다.`)
      } else {
        const { prop, exh } = target
        if (exh?.archived_at) {
          const { error: exhErr } = await supabase.from('exhibitions').update({ archived_at: null }).eq('id', exh.id)
          if (exhErr) { showToast('⚠️ 박람회 복원 실패: ' + exhErr.message); return }
        }
        const { error: propErr } = await supabase.from('proposals').update({ archived_at: null }).eq('id', prop.id)
        if (propErr) { showToast('⚠️ 행사 복원 실패: ' + propErr.message); load(); return }
        showToast(`${eventLabel({ name: exh?.name || '', year: prop.year, session: prop.session ?? null })} 행사가 복원되었습니다.`)
      }
      setConfirm(null)
      load()
    } finally {
      setRestoring(false)
    }
  }

  if (loading) return <div className="view"><LoadingSpinner /></div>

  const isEmpty = archivedExhs.length === 0 && archivedProps.length === 0 && archivedLeads.length === 0

  const propRow = (p: Proposal, exhName: string, action?: React.ReactNode) => (
    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 0', borderTop: '0.5px solid var(--border2)' }}>
      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{eventLabel({ name: exhName, year: p.year, session: p.session ?? null })}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
          {[p.date_of_event, p.venue].filter(Boolean).join(' · ') || '일정 정보 없음'}
        </div>
      </div>
      <button className="btn btn-muted btn-sm" onClick={() => navigate(eventPath(p.id))}>상세 보기</button>
      {action}
    </div>
  )

  return (
    <div className="view">
      <div className="page-hdr-row">
        <div className="sec-hdr" style={{ margin: 0 }}>
          <div className="bar" />
          <div className="txt">{t('archive_box')}</div>
          <div className="sub">보관한 박람회·행사·세일즈 리드를 조회하고 복원합니다. 결제·보고서·Activity·단계 이력은 그대로 보존됩니다.</div>
        </div>
      </div>

      {isEmpty && <EmptyState icon="🗄️" title="보관된 항목이 없습니다" sub="참가 박람회 목록·일정 관리·Lead 관리에서 보관한 항목이 여기에 표시됩니다." />}

      {archivedExhs.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', marginBottom: 10 }}>보관된 박람회 ({archivedExhs.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {archivedExhs.map(item => (
              <div key={item.exh.id} className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span className="badge" style={{ background: exhColor(item.exh.name) }}>{item.exh.key}</span>
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{item.exh.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      보관일 {fmtArchivedAt(item.exh.archived_at)} · 함께 보관된 행사 {item.proposals.length}건
                    </div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => setConfirm({ kind: 'exh', item })}>박람회 복원</button>
                </div>
                {item.proposals.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    {item.proposals.map(p => propRow(p, item.exh.name))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {archivedProps.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', marginBottom: 10 }}>개별 보관된 행사 ({archivedProps.length})</div>
          <div className="card" style={{ paddingTop: 10, paddingBottom: 10 }}>
            {archivedProps.map(p => {
              const exh = exhMap[p.exhibition_id]
              return propRow(p, exh?.name || '(미연결 박람회)', (
                <>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>보관일 {fmtArchivedAt(p.archived_at)}</span>
                  <button className="btn btn-primary btn-sm" onClick={() => setConfirm({ kind: 'prop', prop: p, exh })}>복원</button>
                </>
              ))
            })}
          </div>
        </div>
      )}

      {archivedLeads.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', marginBottom: 10 }}>보관된 세일즈 리드 ({archivedLeads.length})</div>
          <div className="card" style={{ paddingTop: 10, paddingBottom: 10 }}>
            {archivedLeads.map(l => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 0', borderTop: '0.5px solid var(--border2)' }}>
                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{l.serial_no} · {l.company_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    {[l.contact_person, l.owner, l.current_stage, l.event_name].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>보관일 {fmtArchivedAt(l.archived_at)}</span>
                <button className="btn btn-primary btn-sm" onClick={() => setConfirm({ kind: 'lead', lead: l })}>복원</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {confirm && (
        <div className="modal-bg open">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-hdr">
              <h3>복원 확인</h3>
              <button className="modal-close" onClick={() => setConfirm(null)}>✕</button>
            </div>
            <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.6 }}>
              {confirm.kind === 'exh' ? (
                <>
                  <b style={{ color: 'var(--text)' }}>{confirm.item.exh.name}</b> 박람회
                  {confirm.item.proposals.length > 0 && <>와 함께 보관된 행사 {confirm.item.proposals.length}건</>}을 복원합니다.
                  복원하면 참가 박람회 목록·일정 관리 등에 다시 표시됩니다.
                </>
              ) : confirm.kind === 'lead' ? (
                <>
                  <b style={{ color: 'var(--text)' }}>{confirm.lead.company_name}</b> 리드를 복원합니다.
                  복원하면 Lead 관리·퍼널·대시보드에 다시 표시됩니다.
                </>
              ) : (
                <>
                  <b style={{ color: 'var(--text)' }}>{eventLabel({ name: confirm.exh?.name || '', year: confirm.prop.year, session: confirm.prop.session ?? null })}</b> 행사를 복원합니다.
                  {confirm.exh?.archived_at && <> 이 행사의 박람회({confirm.exh.name})도 보관 상태여서 박람회도 함께 복원됩니다. 박람회의 다른 보관 행사는 그대로 보관됩니다.</>}
                </>
              )}
            </p>
            <div className="modal-footer">
              <button className="btn btn-muted" onClick={() => setConfirm(null)} disabled={restoring}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={() => restore(confirm)} disabled={restoring}>
                {restoring ? '복원 중...' : '복원'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
