import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { exhColor, costColor, formatEventDate, isPastEvent, exhDisplayName } from '../../lib/utils'
import { useToast } from '../../contexts/ToastContext'
import type { Exhibition, Proposal, BudgetItem } from '../../types/database'
import ProposalEditModal from '../ProposalEditModal'
import { useLang } from '../../contexts/LangContext'

const CUR_SYM: Record<string, string> = { KRW: '₩', JPY: '¥', USD: '$', EUR: '€', SGD: 'S$' }
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

function parseDateRange(str: string): { start: string; end: string } {
  if (!str) return { start: '', end: '' }
  const s = str.toLowerCase()
  const MON_MAP: Record<string,number> = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12}
  let month = -1
  for (const [k, v] of Object.entries(MON_MAP)) { if (s.includes(k)) { month = v; break } }
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
  propId: string; exhName: string; exhKey: string; year: number
  initialDate: string; initialVenue: string; initialObjective: string; initialResults: string[]
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
  const [apStartDate, setApStartDate] = useState('')
  const [apEndDate, setApEndDate] = useState('')
  const [apVenue, setApVenue] = useState('')
  const [apObj, setApObj] = useState('')
  const [apResults, setApResults] = useState<string[]>([''])
  const [apBudget, setApBudget] = useState<BudgetRow[]>(defaultBudgetRows())

  async function load() {
    const [{ data: exhData, error: exhErr }, { data: propData, error: propErr }] = await Promise.all([
      supabase.from('exhibitions').select('*').order('name'),
      supabase.from('proposals').select('*').order('year', { ascending: true }),
    ])
    if (exhErr) { console.error('exhibitions fetch error:', exhErr); setLoading(false); return }
    if (propErr) { console.error('proposals fetch error:', propErr); setLoading(false); return }
    const exhList = exhData || []
    const propList = (propData || []) as unknown as Proposal[]
    const knownExhIds = new Set(exhList.map(e => e.id))

    const entries: ExhEntry[] = exhList.map(exh => ({
      exh,
      proposals: propList
        .filter(p => p.exhibition_id === exh.id)
        .map(p => ({ ...p, budget: (p.budget as unknown as BudgetItem[]) || [] }))
    }))

    // exhibition이 없는 orphaned proposals → 가상 exhibition 카드로 표시
    const orphaned = propList.filter(p => !knownExhIds.has(p.exhibition_id))
    const orphanedByExhId: Record<string, Proposal[]> = {}
    for (const p of orphaned) {
      if (!orphanedByExhId[p.exhibition_id]) orphanedByExhId[p.exhibition_id] = []
      orphanedByExhId[p.exhibition_id].push(p)
    }
    for (const [exhId, props] of Object.entries(orphanedByExhId)) {
      entries.push({
        exh: { id: exhId, key: '?', name: '(미연결 박람회)', recurring: false } as any,
        proposals: props.map(p => ({ ...p, budget: (p.budget as unknown as BudgetItem[]) || [] }))
      })
    }

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
        const { start, end } = parseDateRange(latest.date_of_event)
        setApStartDate(start); setApEndDate(end)
        setApVenue(latest.venue)
        setApObj(latest.objective || '')
        const prevResults = (latest.expected_results as string[]) || []
        setApResults(prevResults.length ? prevResults : [''])
        const prevBudget: BudgetRow[] = latest.budget.map(b => ({
          item: b.item, curr: b.curr,
          currency: (b as any).currency || 'KRW', note: b.note || ''
        }))
        setApBudget(prevBudget.length ? prevBudget : defaultBudgetRows())
      }
    }
  }

  async function saveApProposal() {
    if (!apName || !apYear) { showToast('⚠️ 박람회 이름과 연도를 입력하세요'); return }
    setSaving(true)
    try {
      let exhId = apExhSel
      let exhKey = ''

      if (!exhId) {
        const key = apName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 12) || 'EXH' + Date.now()
        const { data: newExh, error: exhErr } = await supabase.from('exhibitions').insert({
          key, name: apName, recurring: apRecurring === '1'
        }).select().single()
        if (exhErr || !newExh) {
          showToast('⚠️ 박람회 생성 실패: ' + (exhErr?.message || '알 수 없는 오류'))
          return
        }
        exhId = newExh.id
        exhKey = newExh.key  // DB에 저장된 실제 key 사용
      } else {
        await supabase.from('exhibitions').update({ recurring: apRecurring === '1' }).eq('id', exhId)
        exhKey = data.find(d => d.exh.id === exhId)?.exh.key || ''
      }

      // 같은 연도 Proposal이 이미 있는지 확인
      const { data: existing } = await supabase.from('proposals')
        .select('id').eq('exhibition_id', exhId).eq('year', parseInt(apYear)).single()
      if (existing) {
        showToast(`⚠️ ${apName} ${apYear}년 Proposal이 이미 존재합니다.`)
        return
      }

      const budgetItems = apBudget.filter(b => b.item && b.curr > 0).map(b => ({
        item: b.item, curr: b.curr, prev: 0, note: b.note, currency: b.currency
      }))

      const { error: propErr } = await supabase.from('proposals').insert({
        exhibition_id: exhId,
        year: parseInt(apYear),
        proposal_date: apPdate,
        author: apAuthor,
        date_of_event: apDate,
        venue: apVenue,
        objective: apObj,
        products: [],
        expected_results: apResults.filter(r => r.trim()) as unknown as never,
        budget: budgetItems as unknown as never,
        explanations: {}
      })
      if (propErr) {
        showToast('⚠️ 저장 실패: ' + propErr.message)
        return
      }

      // 결제 항목 자동 생성 (실제 exhKey 사용)
      for (const b of budgetItems) {
        await supabase.from('payments').insert({
          exhibition_key: `${exhKey}_${apYear}`,
          item: b.item, total: b.curr, currency: b.currency,
          deposit_amount: Math.round(b.curr / 2), deposit_due: null, deposit_paid: false,
          final_amount: Math.round(b.curr / 2), final_due: null, final_paid: false,
        })
      }

      await load()
      setShowAddModal(false)
      resetForm()
      showToast('✅ Proposal이 등록되었습니다.')
    } catch (e: any) {
      showToast('⚠️ 오류 발생: ' + (e?.message || String(e)))
    } finally {
      setSaving(false)
    }
  }

  function resetForm() {
    setApExhSel(''); setApName(''); setApYear(String(new Date().getFullYear()))
    setApAuthor('Andrew'); setApPdate(new Date().toISOString().split('T')[0])
    setApRecurring('1'); setApDate(''); setApStartDate(''); setApEndDate(''); setApVenue(''); setApObj('')
    setApResults([''])
    setApBudget(defaultBudgetRows())
    setParseState('idle'); setUploadedFileName('')
  }

  function handleFileUpload(file: File) {
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    const allowed = ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'xlsx', 'xls']
    if (!allowed.includes(ext || '')) {
      showToast('⚠️ PDF, Word, 이미지, Excel 파일만 업로드 가능합니다.')
      return
    }
    setUploadedFileName(file.name)
    setParseState('done')
  }

  function updateBudgetRow(i: number, field: keyof BudgetRow, val: string | number) {
    setApBudget(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  }

  async function deleteExhibition(exhId: string) {
    const exh = data.find(d => d.exh.id === exhId)?.exh
    if (exh?.key) {
      await supabase.from('payments').delete().like('exhibition_key', `${exh.key}_%`)
    }
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
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>{t('add_past')}</button>
          <button className="btn btn-outline btn-sm" onClick={() => { setLoading(true); load() }}>{t('refresh')}</button>
        </div>
      </div>

      {data.length === 0 && !loading && (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 60, fontSize: 14 }}>
          {t('no_items')}<br />
          <button className="btn btn-primary btn-sm" style={{ marginTop: 16 }} onClick={() => setShowAddModal(true)}>{t('add_past')}</button>
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
                    {exhDisplayName(exh.name, exh.key)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                    <span className="badge" style={{ background: proposals.length >= 2 ? '#2E7D51' : 'var(--amber)' }}>
                      {proposals.length >= 2 ? t('badge_existing') : t('badge_new')}
                    </span>
                    <button onClick={() => setDeleteConfirm(exh.id)}
                      style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 5, color: 'var(--muted)', cursor: 'pointer', fontSize: 11, padding: '2px 8px' }}>
                      {t('btn_delete')}
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
                            propId: p.id, exhName: exh.name, exhKey: exh.key, year: p.year,
                            initialDate: p.date_of_event, initialVenue: p.venue,
                            initialObjective: p.objective || '',
                            initialResults: (p.expected_results as string[]) || [],
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
              <div>
                <label>{t('event_period')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="date" value={apStartDate}
                    onChange={e => {
                      const s = e.target.value
                      setApStartDate(s)
                      if (apEndDate && s > apEndDate) { setApEndDate(s); setApDate(formatDateRange(s, s)) }
                      else setApDate(formatDateRange(s, apEndDate))
                    }}
                    style={{ flex: 1 }} />
                  <span style={{ color: 'var(--muted)', fontWeight: 600, flexShrink: 0 }}>~</span>
                  <input type="date" value={apEndDate} min={apStartDate || undefined}
                    onChange={e => {
                      const end = e.target.value
                      setApEndDate(end)
                      setApDate(formatDateRange(apStartDate, end))
                    }}
                    style={{ flex: 1 }} />
                </div>
                {apDate && <div style={{ marginTop: 4, fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>📅 {apDate}</div>}
              </div>
              <div><label>{t('venue')}</label><input value={apVenue} onChange={e => setApVenue(e.target.value)} placeholder={t('venue_placeholder')} /></div>
            </div>
            <label>{t('objective')}</label>
            <input value={apObj} onChange={e => setApObj(e.target.value)} placeholder={t('objective_placeholder')} />

            <label style={{ marginTop: 14 }}>{t('result_lbl')}</label>
            {apResults.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <input style={{ flex: 1 }} value={r}
                  onChange={e => setApResults(arr => arr.map((x, j) => j === i ? e.target.value : x))}
                  placeholder="예: Promote GME BIZ to potential merchants" />
                <button onClick={() => setApResults(arr => arr.filter((_, j) => j !== i))}
                  style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px', flexShrink: 0 }}>✕</button>
              </div>
            ))}
            <button className="btn btn-muted btn-sm" style={{ marginBottom: 8 }}
              onClick={() => setApResults(r => [...r, ''])}>{t('add_result')}</button>

            <label style={{ marginTop: 8 }}>{t('budget_items')}</label>
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
