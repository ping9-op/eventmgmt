import { useEffect, useState } from 'react'
import { TASK_PLAYBOOK, TASK_TYPES, loadPlaybook, savePlaybook, type PlaybookItem } from '../lib/tasks'
import { STAGE_COLORS } from '../lib/utils'
import { useToast } from '../contexts/ToastContext'

const DUE_OPTIONS = [0, 1, 2, 3, 5, 7, 14]
const dueLabel = (d: number) => d === 0 ? '오늘' : d === 1 ? '다음날' : `${d}일 뒤`

/**
 * 자동 배정 할 일(플레이북) 편집 — 리드 등록·단계 변경 시 DB 트리거가 이 값으로 할 일을 만든다
 * 관리자만 수정 (sales_settings RLS), 저장은 다음 단계 변경부터 적용 (이미 만들어진 할 일은 그대로)
 */
export default function PlaybookCard({ isAdmin }: { isAdmin: boolean }) {
  const { showToast } = useToast()
  const [saved, setSaved] = useState<PlaybookItem[]>(TASK_PLAYBOOK)
  const [items, setItems] = useState<PlaybookItem[]>(TASK_PLAYBOOK)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadPlaybook().then(b => { setSaved(b); setItems(b) }).catch(() => {}) }, [])

  const dirty = JSON.stringify(items) !== JSON.stringify(saved)
  const isDefault = JSON.stringify(items) === JSON.stringify(TASK_PLAYBOOK)
  const set = (i: number, patch: Partial<PlaybookItem>) => setItems(p => p.map((x, j) => j === i ? { ...x, ...patch } : x))

  async function save() {
    if (items.some(x => x.on && !x.title.trim())) { showToast('⚠️ 켜 둔 단계의 할 일 문구를 입력해주세요.'); return }
    setSaving(true)
    try {
      await savePlaybook(items)
      setSaved(items)
      showToast('✅ 저장되었습니다. 다음 단계 변경부터 적용됩니다.')
    } catch (e: any) {
      showToast('⚠️ 저장 실패: ' + (e?.message || '권한을 확인하세요.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, overflow: 'hidden', marginTop: 16 }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: '#FDFBFB', display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 16 }}>🤖</span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>자동 배정 할 일</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
            리드를 등록하거나 단계를 바꾸면 담당자에게 아래 할 일이 자동으로 생깁니다. 끄면 그 단계에서는 만들지 않습니다.
            Won/Lost가 되면 남은 할 일은 자동 종료됩니다. 바꾼 내용은 <b>다음 단계 변경부터</b> 적용됩니다.
          </div>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {!isDefault && (
              <button className="btn btn-outline btn-sm" onClick={() => setItems(TASK_PLAYBOOK)} disabled={saving}>기본값으로</button>
            )}
            <button className="btn btn-primary btn-sm" onClick={save} disabled={!dirty || saving}>
              {saving ? '저장 중…' : dirty ? '💾 저장' : '저장됨'}
            </button>
          </div>
        )}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 640 }}>
          <thead>
            <tr style={{ background: 'var(--light)', color: 'var(--muted)', fontSize: 11 }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', width: 150 }}>단계</th>
              <th style={{ padding: '8px 6px', width: 56 }}>사용</th>
              <th style={{ padding: '8px 6px', textAlign: 'left' }}>할 일</th>
              <th style={{ padding: '8px 6px', textAlign: 'left', width: 140 }}>유형</th>
              <th style={{ padding: '8px 12px 8px 6px', textAlign: 'left', width: 110 }}>기한</th>
            </tr>
          </thead>
          <tbody>
            {items.map((x, i) => {
              const col = STAGE_COLORS[x.stage]?.bg || '#6B7280'
              const off = !x.on
              return (
                <tr key={x.stage} style={{ borderTop: '1px solid var(--border)', opacity: off ? 0.55 : 1 }}>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700, color: 'white', background: col, whiteSpace: 'nowrap' }}>{x.stage}</span>
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                    <input type="checkbox" checked={x.on} disabled={!isAdmin} onChange={e => set(i, { on: e.target.checked })}
                      title={x.on ? '자동 배정 켜짐' : '자동 배정 꺼짐'} style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: isAdmin ? 'pointer' : 'default' }} />
                  </td>
                  <td style={{ padding: '8px 6px' }}>
                    <input value={x.title} disabled={!isAdmin || off} onChange={e => set(i, { title: e.target.value })} style={{ margin: 0 }} />
                  </td>
                  <td style={{ padding: '8px 6px' }}>
                    <select value={x.type} disabled={!isAdmin || off} onChange={e => set(i, { type: e.target.value })} style={{ margin: 0 }}>
                      {[...new Set([...TASK_TYPES, x.type])].map(tp => <option key={tp}>{tp}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '8px 12px 8px 6px' }}>
                    <select value={x.days} disabled={!isAdmin || off} onChange={e => set(i, { days: Number(e.target.value) })} style={{ margin: 0 }}>
                      {[...new Set([...DUE_OPTIONS, x.days])].sort((a, b) => a - b).map(d => <option key={d} value={d}>{dueLabel(d)}</option>)}
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {!isAdmin && <div style={{ padding: '8px 18px', fontSize: 11, color: 'var(--muted)', borderTop: '1px solid var(--border)' }}>관리자만 수정할 수 있습니다.</div>}
    </div>
  )
}
