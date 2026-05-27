import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'
import { useLang } from '../contexts/LangContext'

const CURRENCIES = ['KRW', 'JPY', 'USD', 'EUR', 'SGD']
const COST_ITEMS = ['Booth Fee', 'Design', 'Gift', 'Part Timer', 'Flight', 'Accommodation', 'Meal', 'Item Delivery']
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatDateRange(start: string, end: string): string {
  if (!start) return ''
  const s = new Date(start + 'T00:00:00')
  if (isNaN(s.getTime())) return ''
  const yr = s.getFullYear(), m = MON[s.getMonth()], d1 = s.getDate()
  if (!end || end === start) return `${yr} ${m} ${d1}`
  const e = new Date(end + 'T00:00:00')
  if (isNaN(e.getTime())) return `${yr} ${m} ${d1}`
  const d2 = e.getDate()
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear())
    return `${yr} ${m} ${d1}-${d2}`
  return `${yr} ${m} ${d1} - ${e.getFullYear()} ${MON[e.getMonth()]} ${d2}`
}

function parseDateToInputs(str: string): { start: string; end: string } {
  if (!str) return { start: '', end: '' }
  const s = str.toLowerCase()
  const MAP: Record<string,number> = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12}
  let month = -1
  for (const [k, v] of Object.entries(MAP)) { if (s.includes(k)) { month = v; break } }
  if (month < 0) return { start: '', end: '' }
  const nums = [...s.matchAll(/\d+/g)].map(m => parseInt(m[0]))
  const yr = nums.find(n => n > 1000) || new Date().getFullYear()
  const days = nums.filter(n => n >= 1 && n <= 31)
  if (!days.length) return { start: '', end: '' }
  const mm = String(month).padStart(2, '0')
  return {
    start: `${yr}-${mm}-${String(days[0]).padStart(2,'0')}`,
    end:   `${yr}-${mm}-${String(days[days.length-1]).padStart(2,'0')}`,
  }
}

interface BudgetRow { item: string; curr: number; prev: number; currency: string; note: string }

interface Props {
  propId: string
  exhName: string
  exhKey: string
  year: number
  initialDate: string
  initialVenue: string
  initialObjective: string
  initialResults: string[]
  initialBudget: BudgetRow[]
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}

export default function ProposalEditModal({ propId, exhName, exhKey, year, initialDate, initialVenue, initialObjective, initialResults, initialBudget, onClose, onSaved, onDeleted }: Props) {
  const { showToast } = useToast()
  const { t } = useLang()
  const [date, setDate] = useState(initialDate)
  const [venue, setVenue] = useState(initialVenue)
  const [obj, setObj] = useState(initialObjective)
  const [results, setResults] = useState<string[]>(initialResults.length ? initialResults : [''])
  const [budget, setBudget] = useState<BudgetRow[]>(initialBudget.map(b => ({ ...b })))
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const initDates = parseDateToInputs(initialDate)
  const [startDate, setStartDate] = useState(initDates.start)
  const [endDate, setEndDate] = useState(initDates.end)

  function updateRow(i: number, field: keyof BudgetRow, val: string | number) {
    setBudget(p => p.map((r, j) => j === i ? { ...r, [field]: val } : r))
  }

  async function save() {
    setSaving(true)
    await supabase.from('proposals').update({
      date_of_event: date,
      venue,
      objective: obj,
      expected_results: results.filter(r => r.trim()) as unknown as never,
      budget: budget as unknown as never,
    }).eq('id', propId)

    // 예산 변경 시 결제 일정 동기화
    const payKey = `${exhKey}_${year}`
    const { data: existingPays } = await supabase.from('payments').select('*').eq('exhibition_key', payKey)
    const pays = (existingPays || []) as any[]
    const activeBudget = budget.filter(b => b.item && b.curr > 0)

    for (const b of activeBudget) {
      const pay = pays.find(p => p.item === b.item)
      if (pay) {
        if (pay.total !== b.curr) {
          // total 변경 시 비율 유지하여 선금/잔금 재계산
          const depRatio = pay.total > 0 ? pay.deposit_amount / pay.total : 0.5
          const newDep = Math.round(b.curr * depRatio)
          await supabase.from('payments').update({
            total: b.curr, currency: b.currency || 'KRW',
            deposit_amount: newDep, final_amount: b.curr - newDep,
          }).eq('id', pay.id)
        }
      } else {
        await supabase.from('payments').insert({
          exhibition_key: payKey, item: b.item, total: b.curr,
          currency: b.currency || 'KRW',
          deposit_amount: 0, deposit_due: null, deposit_paid: false,
          final_amount: 0, final_due: null, final_paid: false,
        })
      }
    }
    // 예산에서 삭제된 항목의 결제도 삭제
    const activeItems = new Set(activeBudget.map(b => b.item))
    for (const pay of pays) {
      if (!activeItems.has(pay.item)) {
        await supabase.from('payments').delete().eq('id', pay.id)
      }
    }

    setSaving(false)
    showToast(t('saved_ok'))
    onSaved()
  }

  async function deleteProp() {
    await supabase.from('payments').delete().eq('exhibition_key', `${exhKey}_${year}`)
    await supabase.from('proposals').delete().eq('id', propId)
    showToast(t('saved_ok'))
    onDeleted()
  }

  return (
    <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ width: 660 }}>
        <div className="modal-hdr">
          <h3>{exhName} {year} {t('edit_proposal_title')}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="form-row cols2">
          <div>
            <label>{t('event_period')}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="date" value={startDate}
                onChange={e => {
                  const s = e.target.value
                  setStartDate(s)
                  if (endDate && s > endDate) { setEndDate(s); setDate(formatDateRange(s, s)) }
                  else setDate(formatDateRange(s, endDate))
                }}
                style={{ flex: 1 }} />
              <span style={{ color: 'var(--muted)', fontWeight: 600, flexShrink: 0 }}>~</span>
              <input type="date" value={endDate} min={startDate || undefined}
                onChange={e => { setEndDate(e.target.value); setDate(formatDateRange(startDate, e.target.value)) }}
                style={{ flex: 1 }} />
            </div>
            {date && <div style={{ marginTop: 4, fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>📅 {date}</div>}
          </div>
          <div><label>{t('venue')}</label><input value={venue} onChange={e => setVenue(e.target.value)} placeholder="COEX Hall B" /></div>
        </div>
        <label>{t('objective')}</label>
        <textarea value={obj} onChange={e => setObj(e.target.value)} rows={2} placeholder="To promote GME BIZ..." />

        <label style={{ marginTop: 14 }}>{t('result_lbl')}</label>
        {results.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <input style={{ flex: 1 }} value={r}
              onChange={e => setResults(arr => arr.map((x, j) => j === i ? e.target.value : x))}
              placeholder="예: Promote GME BIZ to potential merchants" />
            <button onClick={() => setResults(arr => arr.filter((_, j) => j !== i))}
              style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px', flexShrink: 0 }}>✕</button>
          </div>
        ))}
        <button className="btn btn-muted btn-sm" style={{ marginBottom: 8 }}
          onClick={() => setResults(r => [...r, ''])}>{t('add_result')}</button>

        <label style={{ marginTop: 8 }}>{t('budget_items')}</label>
        <table className="budget-table" style={{ marginBottom: 8 }}>
          <thead>
            <tr><th>{t('item_col')}</th><th>{t('amount_col')}</th><th>{t('currency_col')}</th><th>{t('note_col')}</th><th></th></tr>
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
          {t('add_item')}
        </button>

        <div style={{ marginTop: 16, padding: '12px 14px', background: '#FFF0F0', borderRadius: 8, border: '1px solid #F5C6C6' }}>
          <div style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 8 }}>{t('delete_proposal_warn')}</div>
          {confirmDelete ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--danger)' }}>{exhName} {year} — {t('confirm_delete')}</span>
              <button className="btn btn-sm" style={{ background: '#D63031', color: 'white', border: 'none' }} onClick={deleteProp}>{t('delete')}</button>
              <button className="btn btn-muted btn-sm" onClick={() => setConfirmDelete(false)}>{t('cancel')}</button>
            </div>
          ) : (
            <button className="btn btn-sm" style={{ background: '#D63031', color: 'white', border: 'none' }} onClick={() => setConfirmDelete(true)}>
              {t('delete_proposal_btn')}
            </button>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-muted" onClick={onClose}>{t('cancel')}</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </div>
    </div>
  )
}
