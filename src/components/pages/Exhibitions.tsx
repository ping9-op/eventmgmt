import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { exhColor, costColor, formatEventDate, isPastEvent } from '../../lib/utils'
import { useToast } from '../../contexts/ToastContext'
import type { Exhibition, Proposal, BudgetItem } from '../../types/database'

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

const defaultBudgetRows = (): BudgetRow[] => [
  { item: 'Booth Fee', curr: 0, currency: 'KRW', note: '' },
  { item: 'Design', curr: 0, currency: 'KRW', note: '' },
  { item: 'Gift', curr: 0, currency: 'KRW', note: '' },
]

export default function Exhibitions() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [data, setData] = useState<ExhEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
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

  async function handleFileUpload(file: File) {
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    const allowed = ['pdf', 'png', 'jpg', 'jpeg']
    if (!allowed.includes(ext || '')) {
      alert('PDF 또는 이미지(PNG/JPG) 파일만 지원합니다.\nWord 파일은 PDF로 저장 후 업로드해주세요.')
      return
    }
    setUploadedFileName(file.name)
    setParseState('parsing')

    try {
      // 파일을 base64로 변환
      const arrayBuffer = await file.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      let binary = ''
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
      const base64 = btoa(binary)

      const mediaType = ext === 'pdf' ? 'application/pdf'
        : ext === 'png' ? 'image/png'
        : 'image/jpeg'

      const res = await fetch('/api/parse-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileData: base64, mediaType }),
      })

      const json = await res.json()
      if (!json.success) throw new Error(json.error)

      const d = json.data
      if (d.name) setApName(d.name)
      if (d.year) setApYear(String(d.year))
      if (d.author) setApAuthor(d.author)
      if (d.date_of_event) setApDate(d.date_of_event)
      if (d.venue) setApVenue(d.venue)
      if (d.objective) setApObj(d.objective)
      if (d.recurring !== undefined) setApRecurring(d.recurring ? '1' : '0')
      if (d.budget && d.budget.length > 0) {
        setApBudget(d.budget.map((b: any) => ({
          item: b.item || '',
          curr: b.curr || 0,
          currency: b.currency || 'KRW',
          note: b.note || ''
        })))
      }
      setParseState('done')
    } catch (err: any) {
      alert('AI 분석 실패: ' + (err.message || '다시 시도해주세요.'))
      setParseState('idle')
      setUploadedFileName('')
    }
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

  if (loading) return <div className="view"><div style={{ color: 'var(--muted)', padding: 40 }}>로딩 중...</div></div>

  return (
    <div className="view">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="sec-hdr" style={{ margin: 0 }}>
          <div className="bar" />
          <div className="txt">기존 박람회 목록</div>
          <div className="sub">저장된 승인 Proposal 이력</div>
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
            <div key={exh.id} className="exh-card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="top-bar" style={{ background: color }} />
              <div className="ec-body" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div className="ec-hdr">
                  <div className="ec-name" style={{ color }}>{exh.name} {latest?.year || ''}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                    <span className="badge" style={{ background: exh.recurring ? '#2E7D51' : 'var(--amber)' }}>
                      {exh.recurring ? '기존' : '신규'}
                    </span>
                    <button onClick={() => setDeleteConfirm(exh.id)}
                      style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 5, color: 'var(--muted)', cursor: 'pointer', fontSize: 11, padding: '2px 8px' }}>
                      🗑 삭제
                    </button>
                  </div>
                </div>
                <div className="ec-meta">
                  {latest ? `📅 ${formatEventDate(latest.date_of_event, latest.year)} · 📍 ${latest.venue}` : '등록된 Proposal 없음'}
                </div>

                {/* 참가 이력 */}
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>참가 이력 {proposals.length}회</div>
                <div style={{ height: 100, overflowY: 'auto', border: '0.5px solid var(--border)', borderRadius: 8, padding: '4px 10px', background: '#FDFBFB', marginBottom: 12 }}>
                  {[...proposals].reverse().map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '0.5px solid var(--border)' }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', marginRight: 8 }}>
                        {p.year} · {formatEventDate(p.date_of_event, p.year)}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color, whiteSpace: 'nowrap' }}>{budgetStr(p.budget)}</span>
                        <button className="btn btn-outline btn-sm" style={{ padding: '2px 8px', fontSize: 10 }}
                          onClick={() => navigate('/expo/create', { state: { exhId: exh.id } })}>편집</button>
                      </div>
                    </div>
                  ))}
                  {proposals.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', padding: '10px 0' }}>이력 없음</div>}
                </div>

                <div style={{ fontSize: 16, fontWeight: 800, color, marginBottom: 12 }}>총 예산: {cumBudgetStr}</div>

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
                    onClick={() => navigate('/expo/create', { state: { exhId: exh.id } })}>✏️ Proposal 작성</button>
                  <button className="btn btn-muted btn-sm" style={{ flex: 1 }}
                    onClick={() => navigate('/expo/report', { state: { key: `${exh.key}_${latest?.year}` } })}>📋 결과 보고서</button>
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
              <h3>과거 Proposal 등록</h3>
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
                  <div style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 500 }}>기존 승인된 Proposal 파일 업로드</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>PDF, Word, 이미지 · 클릭 또는 드래그</div>
                </>
              )}
              {parseState === 'parsing' && (
                <div style={{ textAlign: 'center', padding: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#7B2D8B', marginBottom: 8 }}>📄 "{uploadedFileName}" 분석 중...</div>
                  <div style={{ background: '#E8D8F8', borderRadius: 4, height: 6, overflow: 'hidden', maxWidth: 300, margin: '0 auto' }}>
                    <div style={{ height: '100%', background: '#7B2D8B', borderRadius: 4, width: '80%', transition: 'width 2s ease' }} />
                  </div>
                </div>
              )}
              {parseState === 'done' && (
                <div style={{ textAlign: 'center', color: 'var(--green)', fontSize: 14, fontWeight: 600, padding: 8 }}>
                  ✅ "{uploadedFileName}" 분석 완료 — 아래 내용을 확인하고 수정하세요
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400, marginTop: 4 }}>다시 업로드하려면 클릭</div>
                </div>
              )}
            </div>

            <label style={{ marginTop: 0 }}>박람회 선택 (기존 선택 또는 직접 입력)</label>
            <select value={apExhSel} onChange={e => onApExhSel(e.target.value)}>
              <option value="">-- 새 박람회 직접 입력 --</option>
              {data.map(d => <option key={d.exh.id} value={d.exh.id}>{d.exh.name}</option>)}
            </select>

            <div className="form-row cols2">
              <div><label>박람회 이름</label><input value={apName} onChange={e => setApName(e.target.value)} placeholder="Korea Import Fair (KIF)" /></div>
              <div><label>연도</label><input type="number" value={apYear} onChange={e => setApYear(e.target.value)} /></div>
            </div>
            <div className="form-row cols3">
              <div><label>작성자</label><input value={apAuthor} onChange={e => setApAuthor(e.target.value)} /></div>
              <div><label>작성일</label><input type="date" value={apPdate} onChange={e => setApPdate(e.target.value)} /></div>
              <div>
                <label>기존 박람회?</label>
                <select value={apRecurring} onChange={e => setApRecurring(e.target.value as '1' | '0')}>
                  <option value="1">기존 박람회</option>
                  <option value="0">신규 박람회</option>
                </select>
              </div>
            </div>
            <div className="form-row cols2">
              <div><label>행사 기간</label><input value={apDate} onChange={e => setApDate(e.target.value)} placeholder="2025 Jun 24-26" /></div>
              <div><label>장소</label><input value={apVenue} onChange={e => setApVenue(e.target.value)} placeholder="COEX Hall B" /></div>
            </div>
            <label>참가 목적</label>
            <input value={apObj} onChange={e => setApObj(e.target.value)} placeholder="To promote GME BIZ to potential Korean Merchants." />

            <label style={{ marginTop: 16 }}>예산 항목</label>
            <table className="budget-table" style={{ marginBottom: 8 }}>
              <thead>
                <tr><th>항목</th><th>금액</th><th>통화</th><th>비고</th><th></th></tr>
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
              + 항목 추가
            </button>

            <div className="modal-footer">
              <button className="btn btn-muted" onClick={() => { setShowAddModal(false); resetForm() }}>취소</button>
              <button className="btn btn-primary" onClick={saveApProposal} disabled={saving || !apName}>
                {saving ? '저장 중...' : '💾 등록 완료'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deleteConfirm && (
        <div className="modal-bg open">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-hdr">
              <h3>박람회 삭제</h3>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 20 }}>
              이 박람회와 모든 관련 Proposal을 삭제합니다. 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="modal-footer">
              <button className="btn btn-muted" onClick={() => setDeleteConfirm(null)}>취소</button>
              <button className="btn btn-red" onClick={() => deleteExhibition(deleteConfirm)}>삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
