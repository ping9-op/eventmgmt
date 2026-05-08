import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { krw, exhColor, costColor } from '../../lib/utils'
import type { Exhibition, Proposal as ProposalType, BudgetItem, ProductTarget } from '../../types/database'

const CURRENCIES = ['KRW', 'JPY', 'USD', 'AUD', 'SGD']
const COST_ITEMS = ['Booth Fee','Design','Gift','Part Timer','Flight','Accommodation','Meal','Item Delivery']

export default function Proposal() {
  const navigate = useNavigate()
  const location = useLocation()
  const initExhId = (location.state as any)?.exhId || null

  const [step, setStep] = useState(0)
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([])
  const [proposals, setProposals] = useState<ProposalType[]>([])

  // Form state
  const [exhId, setExhId] = useState<string>(initExhId || '')
  const [isNewExh, setIsNewExh] = useState(false)
  const [newExhName, setNewExhName] = useState('')
  const [year, setYear] = useState(new Date().getFullYear() + 1)
  const [propDate, setPropDate] = useState(new Date().toISOString().split('T')[0])
  const [author, setAuthor] = useState('')
  const [dateOfEvent, setDateOfEvent] = useState('')
  const [venue, setVenue] = useState('')
  const [objective, setObjective] = useState('')
  const [products, setProducts] = useState<ProductTarget[]>([{ product: '', target: '' }])
  const [expectedResults, setExpectedResults] = useState<string[]>([''])
  const [budget, setBudget] = useState<BudgetItem[]>([{ item: 'Booth Fee', curr: 0, prev: 0, note: '', currency: 'KRW' }])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: exhData }, { data: propData }] = await Promise.all([
        supabase.from('exhibitions').select('*').order('name'),
        supabase.from('proposals').select('*').order('year'),
      ])
      setExhibitions((exhData || []) as Exhibition[])
      setProposals((propData || []) as unknown as ProposalType[])

      // Pre-fill if editing
      if (initExhId) {
        const exhProposals = ((propData || []) as unknown as ProposalType[]).filter(p => p.exhibition_id === initExhId)
        const latest = exhProposals[exhProposals.length - 1]
        if (latest) {
          setYear(latest.year + 1)
          setAuthor(latest.author)
          setDateOfEvent(latest.date_of_event)
          setVenue(latest.venue)
          setObjective(latest.objective)
          setProducts((latest.products as ProductTarget[]) || [{ product: '', target: '' }])
          setExpectedResults((latest.expected_results as string[]) || [''])
          // Set prev budget
          const newBudget = ((latest.budget as BudgetItem[]) || []).map(b => ({ ...b, prev: b.curr, curr: b.curr }))
          setBudget(newBudget)
        }
      }
    }
    load()
  }, [initExhId])

  async function save() {
    if (!year) return
    setSaving(true)

    let finalExhId = exhId
    if (isNewExh && newExhName) {
      const key = newExhName.replace(/[^a-zA-Z]/g, '').substring(0, 10) + Date.now().toString().slice(-4)
      const { data } = await supabase.from('exhibitions').insert({
        key, name: newExhName, recurring: false
      }).select().single()
      finalExhId = data!.id
    }

    await supabase.from('proposals').insert({
      exhibition_id: finalExhId,
      year, proposal_date: propDate, author, date_of_event: dateOfEvent,
      venue, objective,
      products: products.filter(p => p.product) as unknown as never,
      expected_results: expectedResults.filter(r => r) as unknown as never,
      budget: budget.filter(b => b.curr > 0) as unknown as never,
      explanations: {}
    })

    // Sync to payments
    const dbKey = exhibitions.find(e => e.id === finalExhId)?.key + '_' + year
    const filteredBudget = budget.filter(b => b.curr > 0)
    for (const b of filteredBudget) {
      await supabase.from('payments').insert({
        exhibition_key: dbKey,
        item: b.item, total: b.curr, currency: b.currency || 'KRW',
        deposit_amount: Math.round(b.curr / 2), deposit_due: '', deposit_paid: false,
        final_amount: Math.round(b.curr / 2), final_due: '', final_paid: false,
      })
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => navigate('/expo/exhibitions'), 1500)
  }

  const prevBudgetMap: Record<string, number> = {}
  if (exhId) {
    const exhProposals = proposals.filter(p => p.exhibition_id === exhId).sort((a, b) => a.year - b.year)
    const prev = exhProposals[exhProposals.length - 1]
    if (prev) for (const b of (prev.budget as BudgetItem[]) || []) prevBudgetMap[b.item] = b.curr
  }

  const totalBudget = budget.reduce((s, b) => s + b.curr, 0)

  const steps = ['기본 정보', '목적 & 제품', '예산', '확인']

  return (
    <div className="view">
      <div className="sec-hdr">
        <div className="bar" />
        <div className="txt">새 Proposal 작성</div>
      </div>

      <div className="steps">
        {steps.map((s, i) => (
          <div key={i} className={`step${i === step ? ' active' : i < step ? ' done' : ''}`} onClick={() => i < step && setStep(i)}>
            {i < step ? '✓ ' : ''}{s}
          </div>
        ))}
      </div>

      {/* Step 0 */}
      {step === 0 && (
        <div className="card">
          <div style={{ marginBottom: 16 }}>
            <label style={{ marginTop: 0 }}>박람회 선택</label>
            <select value={isNewExh ? '__new__' : exhId} onChange={e => {
              if (e.target.value === '__new__') { setIsNewExh(true); setExhId('') }
              else { setIsNewExh(false); setExhId(e.target.value) }
            }}>
              <option value="">-- 선택 --</option>
              {exhibitions.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              <option value="__new__">+ 새 박람회 직접 입력</option>
            </select>
          </div>
          {isNewExh && (
            <div style={{ marginBottom: 16 }}>
              <label>새 박람회 이름</label>
              <input value={newExhName} onChange={e => setNewExhName(e.target.value)} placeholder="Korea Import Fair (KIF)" />
            </div>
          )}
          <div className="form-row cols3">
            <div>
              <label>연도</label>
              <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} />
            </div>
            <div>
              <label>작성자</label>
              <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Andrew" />
            </div>
            <div>
              <label>작성일</label>
              <input type="date" value={propDate} onChange={e => setPropDate(e.target.value)} />
            </div>
          </div>
          <div className="form-row cols2" style={{ marginTop: 14 }}>
            <div>
              <label>행사 기간</label>
              <input value={dateOfEvent} onChange={e => setDateOfEvent(e.target.value)} placeholder="2027 Jun 23-25" />
            </div>
            <div>
              <label>장소</label>
              <input value={venue} onChange={e => setVenue(e.target.value)} placeholder="COEX Hall B" />
            </div>
          </div>
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={() => setStep(1)} disabled={!year || (!exhId && !isNewExh && !newExhName)}>다음 →</button>
          </div>
        </div>
      )}

      {/* Step 1 */}
      {step === 1 && (
        <div className="card">
          <label style={{ marginTop: 0 }}>참가 목적</label>
          <textarea value={objective} onChange={e => setObjective(e.target.value)} rows={3} placeholder="To promote GME BIZ to potential Korean Merchants..." />

          <label style={{ marginTop: 20 }}>홍보 제품 / 서비스</label>
          {products.map((p, i) => (
            <div key={i} className="form-row cols2" style={{ marginBottom: 8 }}>
              <input value={p.product} onChange={e => setProducts(arr => arr.map((x, j) => j === i ? { ...x, product: e.target.value } : x))} placeholder="GMEBIZ" />
              <input value={p.target} onChange={e => setProducts(arr => arr.map((x, j) => j === i ? { ...x, target: e.target.value } : x))} placeholder="Target (e.g. Korean Merchants)" />
            </div>
          ))}
          <button className="btn btn-muted btn-sm" onClick={() => setProducts(p => [...p, { product: '', target: '' }])}>+ 항목 추가</button>

          <label style={{ marginTop: 20 }}>기대 효과</label>
          {expectedResults.map((r, i) => (
            <input key={i} value={r} onChange={e => setExpectedResults(arr => arr.map((x, j) => j === i ? e.target.value : x))} placeholder="Promote GME BIZ to potential merchants" style={{ marginBottom: 8 }} />
          ))}
          <button className="btn btn-muted btn-sm" onClick={() => setExpectedResults(r => [...r, ''])}>+ 항목 추가</button>

          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn btn-muted" onClick={() => setStep(0)}>← 이전</button>
            <button className="btn btn-primary" onClick={() => setStep(2)}>다음 →</button>
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="card">
          <table className="budget-table">
            <thead>
              <tr><th>항목</th><th>금액</th><th>통화</th><th>전년도</th><th>증감</th><th>비고</th><th></th></tr>
            </thead>
            <tbody>
              {budget.map((b, i) => {
                const prev = prevBudgetMap[b.item] || b.prev || 0
                const diff = b.curr - prev
                return (
                  <tr key={i}>
                    <td>
                      <select value={b.item} onChange={e => setBudget(arr => arr.map((x, j) => j === i ? { ...x, item: e.target.value } : x))}>
                        {COST_ITEMS.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </td>
                    <td><input type="number" value={b.curr || ''} onChange={e => setBudget(arr => arr.map((x, j) => j === i ? { ...x, curr: parseInt(e.target.value) || 0 } : x))} /></td>
                    <td>
                      <select value={b.currency || 'KRW'} onChange={e => setBudget(arr => arr.map((x, j) => j === i ? { ...x, currency: e.target.value } : x))}>
                        {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </td>
                    <td style={{ color: 'var(--muted)' }}>{prev ? (b.currency !== 'KRW' ? b.currency + ' ' : '₩') + prev.toLocaleString() : '-'}</td>
                    <td>{prev ? <span className={diff > 0 ? 'diff-up' : diff < 0 ? 'diff-down' : ''}>{diff > 0 ? '+' : ''}{diff.toLocaleString()}</span> : '-'}</td>
                    <td><input value={b.note} onChange={e => setBudget(arr => arr.map((x, j) => j === i ? { ...x, note: e.target.value } : x))} placeholder="비고" /></td>
                    <td><button className="btn btn-sm btn-muted" onClick={() => setBudget(arr => arr.filter((_, j) => j !== i))}>✕</button></td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr><td colSpan={2}><strong>합계: {krw(totalBudget)}</strong></td><td colSpan={5}></td></tr>
            </tfoot>
          </table>
          <button className="btn btn-muted btn-sm" style={{ marginTop: 12 }} onClick={() => setBudget(b => [...b, { item: 'Gift', curr: 0, prev: 0, note: '', currency: 'KRW' }])}>+ 항목 추가</button>
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn btn-muted" onClick={() => setStep(1)}>← 이전</button>
            <button className="btn btn-primary" onClick={() => setStep(3)}>다음 →</button>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div className="card">
          <div style={{ background: 'var(--light)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
            <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>확인</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px', fontSize: 14 }}>
              <div><span style={{ color: 'var(--muted)' }}>박람회: </span><strong>{exhibitions.find(e => e.id === exhId)?.name || newExhName}</strong></div>
              <div><span style={{ color: 'var(--muted)' }}>연도: </span><strong>{year}</strong></div>
              <div><span style={{ color: 'var(--muted)' }}>행사기간: </span><strong>{dateOfEvent}</strong></div>
              <div><span style={{ color: 'var(--muted)' }}>장소: </span><strong>{venue}</strong></div>
              <div><span style={{ color: 'var(--muted)' }}>총 예산: </span><strong>{krw(totalBudget)}</strong></div>
              <div><span style={{ color: 'var(--muted)' }}>작성자: </span><strong>{author}</strong></div>
            </div>
          </div>
          <table className="budget-table">
            <thead><tr><th>항목</th><th>금액</th><th>통화</th><th>비고</th></tr></thead>
            <tbody>
              {budget.filter(b => b.curr > 0).map((b, i) => (
                <tr key={i}>
                  <td>{b.item}</td>
                  <td style={{ fontWeight: 700 }}>{(b.currency !== 'KRW' ? b.currency + ' ' : '₩') + b.curr.toLocaleString()}</td>
                  <td>{b.currency}</td>
                  <td>{b.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {saved && <div style={{ background: '#E5F5EC', border: '1px solid #A0D8B0', borderRadius: 8, padding: 14, marginTop: 16, color: '#2E7D51', fontWeight: 700 }}>✓ 저장 완료! 박람회 목록으로 이동합니다...</div>}
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn btn-muted" onClick={() => setStep(2)}>← 이전</button>
            <button className="btn btn-green" onClick={save} disabled={saving || saved}>{saving ? '저장 중...' : '💾 Proposal 저장'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
