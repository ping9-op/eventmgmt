import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { exhColor, costColor, formatEventDate, isPastEvent } from '../../lib/utils'
import { useToast } from '../../contexts/ToastContext'
import type { Exhibition, Proposal, BudgetItem } from '../../types/database'
import ProposalEditModal from '../ProposalEditModal'
import { useLang } from '../../contexts/LangContext'

const CUR_SYM: Record<string, string> = { KRW: '₩', JPY: '¥', USD: '$', EUR: '€', SGD: 'S$' }
const CURRENCIES = ['KRW', 'JPY', 'USD', 'EUR', 'SGD']
const COST_ITEMS = ['Booth Fee', 'Design', 'Gift', 'Part Timer', 'Flight', 'Accommodation', 'Meal', 'Item Delivery']

function fmtCur(amt: number, cur: string) {
  return (CUR_SYM[cur] || cur) + Math.round(amt).toLocaleString()
}

function budgetStr(budget: BudgetItem[]): string {
  const bc: Record<string, number> = {}
  for (const b of budget) { const c = (b as any).currency || 'KRW'; bc[c] = (bc[c] || 0) + b.curr }
  return Object.entries(bc).sort(([a], [b]) => a === 'KRW' ? -1 : 1).map(([c, v]) => fmtCur(v, c)).join(' + ') || '-'
}

interface ExhEntry { exh: Exhibition; proposals: (Proposal & { budget: BudgetItem[] })[] }
interface BudgetRow { item: string; curr: number; currency: string; note: string }

interface EpModalState {
  propId: string; exhName: string; year: number
  initialDate: string; initialVenue: string; initialObjective: string
  initialBudget: Array<{ item: string; curr: number; prev: number; currency: string; note: string }>
}

const defaultBudgetRows = (): BudgetRow[] => [
  { item: 'Booth Fee', curr: 0, currency: 'KRW', note: '' },
  { item: 'Design', curr: 0, currency: 'KRW', note: '' },
  { item: 'Gift', curr: 0, currency: 'KRW', note: '' },
]

export default function Exhibitions() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { t } = useLang()
  const [data, setData] = useState<ExhEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [epModal, setEpModal] = useState<EpModalState | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [parseState, setParseState] = useState<'idle' | 'parsing' | 'done'>('idle')
  const [uploadedFileName, setUploadedFileName] = useState('')

  // 과거 Proposal 등록 폼
  const [apExhSel, setApExhSel] = useState('')   // 기존 박람회 ID or ''
  const [apName, setApName] = useState('')
  const [apYear, setApYear] = useState(String(new Date().getFullYear()))
  const [apAuthor, setApAuthor] = useState('Andrew')
  const [apPdate, setApPdate] = useState(new Date().toISOString().split('T')[0])
  const [apRecurring, setApRecurring] = useState<'1' | '0'>('1')
  const [apDate, setApDate] = useState('')
  const [apVenue, setApVenue] = useState('')
  const [apObj, setApObj] = useState('')
  const [apBudget, setApBudget] = useState<BudgetRow[]>(defaultBudgetRows())

  async function load() {
    const [{ data: exhData }, { data: propData }] = await Promise.all([
      supabase.from('exhibitions').select('*').order('name'),
      supabase.from('proposals').select('*').order('year', { ascending: true }),
    ])
    const entries: ExhEntry[] = (exhData || []).map(exh => ({
      exh,
      proposals: ((propData || []) as unknown as Proposal[])
        .filter(p => p.exhibition_id === exh.id)
        .map(p => ({ ...p, budget: (p.budget as unknown as BudgetItem[]) || [] }))
    }))
    setData(entries)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function onApExhSel(id: string) {
    setApExhSel(id)
    if (!id) { setApName(''); return }
    const found = data.find(d => d.exh.id === id)
    if (found) {
      setApName(found.exh.name)
      setApRecurring(found.exh.recurring ? '1' : '0')
      const latest = found.proposals[found.proposals.length - 1]
      if (latest) {
        setApDate(latest.date_of_event)
        setApVenue(latest.venue)
        setApObj(latest.objective || '')
        const prevBudget: BudgetRow[] = latest.budget.map(b => ({
          item: b.item, curr: b.curr,
          currency: (b as any).currency || 'KRW', note: b.note || ''
        }))
        setApBudget(prevBudget.length ? prevBudget : defaultBudgetRows())
      }
    }
  }

  async function saveApProposal() {
    if (!apName || !apYear) { alert('박람회 이름과 연도를 입력하세요'); return }
    setSaving(true)

    let exhId = apExhSel
    if (!exhId) {
      const key = apName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 12) || 'EXH' + Date.now()
      const { data: newExh } = await supabase.from('exhibitions').insert({
        key, name: apName, recurring: apRecurring === '1'
      }).select().single()
      exhId = newExh!.id
    } else {
      await supabase.from('exhibitions').update({ recurring: apRecurring === '1' }).eq('id', exhId)
    }

    const budgetItems = apBudget.filter(b => b.item && b.curr > 0).map(b => ({
      item: b.item, curr: b.curr, prev: 0, note: b.note, currency: b.currency
    }))

    await supabase.from('proposals').insert({
      exhibition_id: exhId,
      year: parseInt(apYear),
      proposal_date: apPdate,
      author: apAuthor,
      date_of_event: apDate,
      venue: apVenue,
      objective: apObj,
      products: [],
      expected_results: [],
      budget: budgetItems as unknown as never,
      explanations: {}
    })

    // 결제 항목도 자동 생성
    const dbKey = data.find(d => d.exh.id === exhId)?.exh.key || apName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 12)
    for (const b of budgetItems) {
      await supabase.from('payments').insert({
        exhibition_key: `${dbKey}_${apYear}`,
        item: b.item, total: b.curr, currency: b.currency,
        deposit_amount: Math.round(b.curr / 2), deposit_due: null, deposit_paid: false,
        final_amount: Math.round(b.curr / 2), final_due: null, final_paid: false,
      })
    }

    setSaving(false)
    setShowAddModal(false)
    resetForm()
    showToast('Proposal이 등록되었습니다.')
    load()
  }

  function resetForm() {
    setApExhSel(''); setApName(''); setApYear(String(new Date().getFullYear()))
    setApAuthor('Andrew'); setApPdate(new Date().toISOString().split('T')[0])
    setApRecurring('1'); setApDate(''); setApVenue(''); setApObj('')
    setApBudget(defaultBudgetRows())
    setParseState('idle'); setUploadedFileName('')
  }

  function handleFileUpload(file: File) {
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    const allowed = ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'xlsx', 'xls']
    if (!allowed.includes(ext || '')) {
      alert('PDF, Word, 이미지, Excel 파일을 업로드할 수 있습니다.')
      return
    }
    setUploadedFileName(file.name)
    setParseState('done')
  }

  function updateBudgetRow(i: number, field: keyof BudgetRow, val: string | number) {
    setApBudget(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  }

  async function deleteExhibition(exhId: string) {
    await supabase.from('proposals').delete().eq('exhibition_id', exhId)
    await supabase.from('exhibitions').delete().eq('id', exhId)
    setDeleteConfirm(null)
    showToast('박람회가 삭제되었습니다.')
    load()
  }

  if (loading) return <div className="view"><div style={{ color: 'var(--muted)', padding: 40 }}>{t('loading')}</div></div>

  return (
    <div className="view">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="sec-hdr" style={{ margin: 0 }}>
          <div className="bar" />
          <div className="txt">{t('exh_list')}</div>
          <div className="sub">{t('exh_sub')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>+ 과거 Proposal 등록</button>
          <button className="btn btn-outline btn-sm" onClick={() => { setLoading(true); load() }}>🔄 새로고침</button>
        </div>
      </div>

      {data.length === 0 && !loading && (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 60, fontSize: 14 }}>
          등록된 박람회가 없습니다.<br />
          <button className="btn btn-primary btn-sm" style={{ marginTop: 16 }} onClick={() => setShowAddModal(true)}>+ 과거 Proposal 등록</button>
        </div>
      )}

      <div className="exh-grid" style={{ marginTop: 20 }}>
        {data.map(({ exh, proposals }) => {
          const latest = proposals[proposals.length - 1]
          const color = exhColor(exh.name)
          const isPast = latest ? isPastEvent(latest.date_of_event, latest.year) : false
          const cumByCur: Record<string, number> = {}
          for (const p of proposals) for (const b of p.budget) {
            const c = (b as any).currency || 'KRW'; cumByCur[c] = (cumByCur[c] || 0) + b.curr
          }
          const cumBudgetStr = Object.entries(cumByCur).sort(([a], [b]) => a === 'KRW' ? -1 : 1).map(([c, v]) => fmtCur(v, c)).join(' + ') || '-'

          return (
            <div key={exh.id} className="exh-card" style={{ display: 'flex', flexDirection: 'column', cursor: latest ? 'default' : undefined }}>
              <div className="top-bar" style={{ background: color }} />
              <div className="ec-body" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div className="ec-hdr">
                  <div className="ec-name" style={{ color, cursor: latest ? 'pointer' : 'default', textDecoration: latest ? 'underline' : 'none', textUnderlineOffset: 3 }}
                    onClick={() => latest && navigate(`/expo/event/${exh.key}/${latest.year}`)}>
                    {exh.name} {latest?.year || ''}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                    <span className="badge" style={{ background: exh.recurring ? '#2E7D51' : 'var(--amber)' }}>
                      {exh.recurring ? t('badge_existing') : t('badge_new')}
                    </span>
                    <button onClick={() => setDeleteConfirm(exh.id)}
                      style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 5, color: 'var(--muted)', cursor: 'pointer', fontSize: 11, padding: '2px 8px' }}>
                      🗑 삭제
                    </button>
                  </div>
                </div>
                <div className="ec-meta">
                  {latest ? `📅 ${formatEventDate(latest.date_of_event, latest.year)} · 📍 ${latest.venue}` : t('no_history')}
                </div>

                {/* 참가 이력 */}
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>{t('hist_count')} {proposals.length}{t('times')}</div>
                <div style={{ height: 110, overflowY: 'auto', border: '0.5px solid var(--border)', borderRadius: 8, padding: '4px 10px', background: '#FDFBFB', marginBottom: 12 }}>
                  {[...proposals].reverse().map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '0.5px solid var(--border)' }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', marginRight: 8 }}>
                        {p.year} · {formatEventDate(p.date_of_event, p.year)}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color, whiteSpace: 'nowrap' }}>{budgetStr(p.budget)}</span>
                        <button className="btn btn-outline btn-sm" style={{ padding: '2px 8px', fontSize: 10 }}
                          onClick={() => setEpModal({
                            propId: p.id, exhName: exh.name, year: p.year,
                            initialDate: p.date_of_event, initialVenue: p.venue,
                            initialObjective: p.objective || '',
                            initialBudget: p.budget.map((b: any) => ({ item: b.item, curr: b.curr, prev: b.prev || 0, currency: b.currency || 'KRW', note: b.note || '' }))
                          })}>{t('edit')}</button>
                      </div>
                    </div>
                  ))}
                  {proposals.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', padding: '10px 0' }}>{t('no_history')}</div>}
                </div>

                <div style={{ fontSize: 16, fontWeight: 800, color, marginBottom: 12 }}>{t('total_budget')}: {cumBudgetStr}</div>

                {latest && latest.budget.slice(0, 3).map((b, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: costColor(b.item), display: 'inline-block' }} />
                      {b.item}
                    </span>
                    <span>{fmtCur(b.curr, (b as any).currency || 'KRW')}</span>
                  </div>
                ))}

                <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 12 }}>
                  <button className="btn btn-primary btn-sm" style={{ flex: 1 }}
                    onClick={() => navigate('/expo/create', { state: { exhId: exh.id } })}>✏️ {t('btn_proposal')}</button>
                  <button className="btn btn-muted btn-sm" style={{ flex: 1 }}
                    onClick={() => navigate('/expo/report', { state: { key: `${exh.key}_${latest?.year}` } })}>📋 {t('btn_report')}</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 과거 Proposal 등록 모달 */}
      {showAddModal && (
        <div className="modal-bg open">
          <div className="modal" style={{ width: 680 }}>
            <div className="modal-hdr">
              <h3>{t('reg_past_proposal')}</h3>
              <button className="modal-close" onClick={() => { setShowAddModal(false); resetForm() }}>✕</button>
            </div>

            {/* 파일 업로드 */}
            <div
              className="invoice-drop"
              style={{ marginBottom: 16 }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f) }}
              onClick={() => document.getElementById('proposal-file-input')?.click()}
            >
              <input id="proposal-file-input" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = '' }} />
              {parseState === 'idle' && (
                <>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>📄</div>
                  <div style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 500 }}>{t('prop_file_upload')}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{t('prop_file_desc')}</div>
                </>
              )}
              {parseState === 'done' && (
                <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 600, padding: 8 }}>
                  📎 "{uploadedFileName}" 첨부됨
                  <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400, marginTop: 4 }}>{t('prop_file_desc2')}</div>
                </div>
              )}
            </div>

            <label style={{ marginTop: 0 }}>{t('exh_select_existing')}</label>
            <select value={apExhSel} onChange={e => onApExhSel(e.target.value)}>
              <option value="">{t('new_input')}</option>
              {data.map(d => <option key={d.exh.id} value={d.exh.id}>{d.exh.name}</option>)}
            </select>

            <div className="form-row cols2">
              <div><label>{t('exh_name_lbl')}</label><input value={apName} onChange={e => setApName(e.target.value)} placeholder={t('exh_name_placeholder')} /></div>
              <div><label>{t('year_label')}</label><input type="number" value={apYear} onChange={e => setApYear(e.target.value)} /></div>
            </div>
            <div className="form-row cols3">
              <div><label>{t('author_label')}</label><input value={apAuthor} onChange={e => setApAuthor(e.target.value)} /></div>
              <div><label>{t('write_date')}</label><input type="date" value={apPdate} onChange={e => setApPdate(e.target.value)} /></div>
              <div>
                <label>{t('is_recurring')}</label>
                <select value={apRecurring} onChange={e => setApRecurring(e.target.value as '1' | '0')}>
                  <option value="1">{t('existing_exh')}</option>
                  <option value="0">{t('new_exh')}</option>
                </select>
              </div>
            </div>
            <div className="form-row cols2">
              <div><label>{t('event_period')}</label><input value={apDate} onChange={e => setApDate(e.target.value)} placeholder="2025 Jun 24-26" /></div>
              <div><label>{t('venue')}</label><input value={apVenue} onChange={e => setApVenue(e.target.value)} placeholder={t('venue_placeholder')} /></div>
            </div>
            <label>{t('objective')}</label>
            <input value={apObj} onChange={e => setApObj(e.target.value)} placeholder={t('objective_placeholder')} />

            <label style={{ marginTop: 16 }}>{t('budget_items')}</label>
            <table className="budget-table" style={{ marginBottom: 8 }}>
              <thead>
                <tr><th>{t('item_col')}</th><th>{t('amount_col')}</th><th>{t('currency_col')}</th><th>{t('note_col')}</th><th></th></tr>
              </thead>
              <tbody>
                {apBudget.map((row, i) => (
                  <tr key={i}>
                    <td>
                      <input list="cost-items" value={row.item} onChange={e => updateBudgetRow(i, 'item', e.target.value)} style={{ width: 130 }} />
                      <datalist id="cost-items">{COST_ITEMS.map(c => <option key={c} value={c} />)}</datalist>
                    </td>
                    <td>
                      <input type="number" value={row.curr || ''} onChange={e => updateBudgetRow(i, 'curr', parseInt(e.target.value) || 0)} style={{ textAlign: 'right' }} />
                    </td>
                    <td>
                      <select value={row.currency} onChange={e => updateBudgetRow(i, 'currency', e.target.value)} style={{ width: 72 }}>
                        {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </td>
                    <td><input value={row.note} onChange={e => updateBudgetRow(i, 'note', e.target.value)} /></td>
                    <td>
                      <button onClick={() => setApBudget(prev => prev.filter((_, idx) => idx !== i))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16 }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn btn-muted btn-sm" onClick={() => setApBudget(prev => [...prev, { item: '', curr: 0, currency: 'KRW', note: '' }])}>
              {t('add_item')}
            </button>

            <div className="modal-footer">
              <button className="btn btn-muted" onClick={() => { setShowAddModal(false); resetForm() }}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={saveApProposal} disabled={saving || !apName}>
                {saving ? t('saving') : t('register_done')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proposal 편집 모달 */}
      {epModal && (
        <ProposalEditModal
          {...epModal}
          onClose={() => setEpModal(null)}
          onSaved={() => { setEpModal(null); load() }}
          onDeleted={() => { setEpModal(null); load() }}
        />
      )}

      {/* 삭제 확인 모달 */}
      {deleteConfirm && (
        <div className="modal-bg open">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-hdr">
              <h3>{t('delete_exh_title')}</h3>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 20 }}>
              {t('delete_exh_desc')}
            </p>
            <div className="modal-footer">
              <button className="btn btn-muted" onClick={() => setDeleteConfirm(null)}>{t('cancel')}</button>
              <button className="btn btn-red" onClick={() => deleteExhibition(deleteConfirm)}>{t('delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
