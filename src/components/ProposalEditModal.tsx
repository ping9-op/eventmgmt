import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'

const CURRENCIES = ['KRW', 'JPY', 'USD', 'EUR', 'SGD']
const COST_ITEMS = ['Booth Fee', 'Design', 'Gift', 'Part Timer', 'Flight', 'Accommodation', 'Meal', 'Item Delivery']

interface BudgetRow { item: string; curr: number; prev: number; currency: string; note: string }

interface Props {
  propId: string
  exhName: string
  year: number
  initialDate: string
  initialVenue: string
  initialObjective: string
  initialBudget: BudgetRow[]
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}

export default function ProposalEditModal({ propId, exhName, year, initialDate, initialVenue, initialObjective, initialBudget, onClose, onSaved, onDeleted }: Props) {
  const { showToast } = useToast()
  const [date, setDate] = useState(initialDate)
  const [venue, setVenue] = useState(initialVenue)
  const [obj, setObj] = useState(initialObjective)
  const [budget, setBudget] = useState<BudgetRow[]>(initialBudget.map(b => ({ ...b })))
  const [saving, setSaving] = useState(false)

  function updateRow(i: number, field: keyof BudgetRow, val: string | number) {
    setBudget(p => p.map((r, j) => j === i ? { ...r, [field]: val } : r))
  }

  async function save() {
    setSaving(true)
    await supabase.from('proposals').update({
      date_of_event: date,
      venue,
      objective: obj,
      budget: budget as unknown as never,
    }).eq('id', propId)
    setSaving(false)
    showToast('저장되었습니다.')
    onSaved()
  }

  async function deleteProp() {
    if (!confirm(`${exhName} ${year} Proposal을 삭제하시겠습니까?`)) return
    await supabase.from('proposals').delete().eq('id', propId)
    showToast('삭제되었습니다.')
    onDeleted()
  }

  return (
    <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ width: 660 }}>
        <div className="modal-hdr">
          <h3>{exhName} {year} Proposal 편집</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="form-row cols2">
          <div><label>행사 기간</label><input value={date} onChange={e => setDate(e.target.value)} placeholder="2026 Jun 23-25" /></div>
          <div><label>장소</label><input value={venue} onChange={e => setVenue(e.target.value)} placeholder="COEX Hall B" /></div>
        </div>
        <label>참가 목적</label>
        <textarea value={obj} onChange={e => setObj(e.target.value)} rows={2} placeholder="To promote GME BIZ..." />

        <label style={{ marginTop: 16 }}>예산 항목</label>
        <table className="budget-table" style={{ marginBottom: 8 }}>
          <thead>
            <tr><th>항목</th><th>금액</th><th>통화</th><th>비고</th><th></th></tr>
          </thead>
          <tbody>
            {budget.map((b, i) => (
              <tr key={i}>
                <td>
                  <input list="ep-cost-items" value={b.item} onChange={e => updateRow(i, 'item', e.target.value)} style={{ width: 130 }} />
                  <datalist id="ep-cost-items">{COST_ITEMS.map(c => <option key={c} value={c} />)}</datalist>
                </td>
                <td>
                  <input type="number" value={b.curr || ''} onChange={e => updateRow(i, 'curr', parseInt(e.target.value) || 0)} style={{ textAlign: 'right' }} />
                </td>
                <td>
                  <select value={b.currency || 'KRW'} onChange={e => updateRow(i, 'currency', e.target.value)} style={{ width: 72 }}>
                    {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </td>
                <td><input value={b.note || ''} onChange={e => updateRow(i, 'note', e.target.value)} /></td>
                <td>
                  <button onClick={() => setBudget(p => p.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16 }}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="btn btn-muted btn-sm" onClick={() => setBudget(p => [...p, { item: '', curr: 0, prev: 0, currency: 'KRW', note: '' }])}>
          + 항목 추가
        </button>

        <div style={{ marginTop: 16, padding: '12px 14px', background: '#FFF0F0', borderRadius: 8, border: '1px solid #F5C6C6' }}>
          <div style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 8 }}>⚠ 이 Proposal 이력을 삭제합니다.</div>
          <button className="btn btn-sm" style={{ background: '#D63031', color: 'white', border: 'none' }} onClick={deleteProp}>
            🗑 이 Proposal 삭제
          </button>
        </div>

        <div className="modal-footer">
          <button className="btn btn-muted" onClick={onClose}>취소</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
