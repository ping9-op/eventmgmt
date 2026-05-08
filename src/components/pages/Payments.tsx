import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { costColor, exhColor } from '../../lib/utils'
import type { Exhibition, Payment } from '../../types/database'

const CUR_SYM: Record<string, string> = { KRW: '₩', JPY: '¥', USD: '$', EUR: '€', SGD: 'S$' }
const CURRENCIES = ['KRW', 'JPY', 'USD', 'EUR', 'SGD']

function fmtPay(amt: number, cur: string): string {
  return (CUR_SYM[cur] || cur) + Math.round(amt).toLocaleString()
}

function sumByCur(pays: Payment[], fn: (p: Payment) => number): string {
  const acc: Record<string, number> = {}
  for (const p of pays) {
    const c = p.currency || 'KRW'
    acc[c] = (acc[c] || 0) + fn(p)
  }
  return Object.entries(acc).filter(([, v]) => v > 0)
    .sort(([a], [b]) => a === 'KRW' ? -1 : b === 'KRW' ? 1 : 0)
    .map(([c, v]) => fmtPay(v, c)).join(' + ') || '0'
}

export default function Payments() {
  const location = useLocation()
  const initKey = (location.state as any)?.key || null
  const [payments, setPayments] = useState<Record<string, Payment[]>>({})
  const [exhibitions, setExhibitions] = useState<Record<string, Exhibition>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showInvoice, setShowInvoice] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)

  async function load() {
    const [{ data: exhData }, { data: payData }] = await Promise.all([
      supabase.from('exhibitions').select('*'),
      supabase.from('payments').select('*').order('item'),
    ])
    const exhMap: Record<string, Exhibition> = {}
    for (const e of (exhData || [])) exhMap[e.key] = e
    setExhibitions(exhMap)
    const payMap: Record<string, Payment[]> = {}
    for (const p of (payData || []) as Payment[]) {
      if (!payMap[p.exhibition_key]) payMap[p.exhibition_key] = []
      payMap[p.exhibition_key].push(p)
    }
    setPayments(payMap)
    const keys = Object.keys(payMap)
    if (initKey && keys.includes(initKey)) setSelected(initKey)
    else if (keys.length) setSelected(keys[0])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function togglePaid(payId: string, type: 'deposit' | 'final', current: boolean) {
    if (type === 'deposit') await supabase.from('payments').update({ deposit_paid: !current }).eq('id', payId)
    else await supabase.from('payments').update({ final_paid: !current }).eq('id', payId)
    load()
  }

  async function saveCurrency(payId: string, currency: string) {
    setSaving(payId)
    await supabase.from('payments').update({ currency }).eq('id', payId)
    setSaving(null)
    load()
  }

  async function saveAmounts(pay: Payment, depositAmt: number, depositDue: string, finalAmt: number, finalDue: string) {
    setSaving(pay.id)
    await supabase.from('payments').update({
      deposit_amount: depositAmt, deposit_due: depositDue || null,
      final_amount: finalAmt, final_due: finalDue || null,
    }).eq('id', pay.id)
    setSaving(null)
    load()
  }

  const keys = Object.keys(payments).sort((a, b) => {
    const ya = parseInt(a.split('_').pop() || '0'), yb = parseInt(b.split('_').pop() || '0')
    return yb - ya || a.localeCompare(b)
  })
  const selPays = selected ? (payments[selected] || []) : []

  function exhNameFromKey(dbKey: string): string {
    const parts = dbKey.split('_')
    const yr = parts[parts.length - 1]
    const k = parts.slice(0, -1).join('_')
    return (exhibitions[k]?.name || k) + ' ' + yr
  }

  function exhColorFromKey(dbKey: string): string {
    const k = dbKey.split('_').slice(0, -1).join('_')
    return exhColor(exhibitions[k]?.name || k)
  }

  function payStatus(pays: Payment[]): { label: string; color: string } {
    const allPaid = pays.every(p => p.deposit_paid && p.final_paid)
    const somePaid = pays.some(p => p.deposit_paid || p.final_paid)
    if (allPaid) return { label: '✓ 완납', color: '#2E7D51' }
    if (somePaid) return { label: '일부 완료', color: '#C47D1A' }
    return { label: '미결제', color: '#D63031' }
  }

  if (loading) return <div className="view"><div style={{ color: 'var(--muted)', padding: 40 }}>로딩 중...</div></div>

  return (
    <div className="view">
      <div className="sec-hdr">
        <div className="bar" />
        <div className="txt">비용 결제 일정</div>
        <div className="sub">계약금 / 잔금 관리</div>
      </div>

      <div className="pay-layout">
        {/* 왼쪽 목록 */}
        <div className="pay-list">
          {keys.map(k => {
            const pays = payments[k]
            const st = payStatus(pays)
            return (
              <div key={k} className={`pay-list-item${selected === k ? ' active' : ''}`} onClick={() => setSelected(k)}>
                <div style={{ fontWeight: 700 }}>{exhNameFromKey(k)}</div>
                <div className="sub" style={{ marginTop: 4 }}>
                  <span style={{ color: selected === k ? '#FFCCCC' : st.color, fontSize: 11, fontWeight: 600 }}>{st.label}</span>
                  {' · '}{pays.length}개 항목
                </div>
              </div>
            )
          })}
        </div>

        {/* 오른쪽 상세 */}
        {selected ? (
          <div style={{ overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {exhNameFromKey(selected)} 결제 일정
              </div>
              <button className="btn btn-purple btn-sm" onClick={() => setShowInvoice(v => !v)}>
                📄 인보이스 업로드
              </button>
            </div>

            {/* 인보이스 업로드 영역 */}
            {showInvoice && (
              <div style={{ marginBottom: 16 }}>
                <div className="invoice-drop"
                  onDragOver={e => e.preventDefault()}
                  onClick={() => document.getElementById('invoice-input')?.click()}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                  <div style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 500 }}>인보이스 파일을 드래그하거나 클릭하여 업로드</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>PDF, JPG, PNG 지원</div>
                  <input id="invoice-input" type="file" accept=".pdf,.jpg,.png" style={{ display: 'none' }} onChange={() => {}} />
                </div>
              </div>
            )}

            {/* 요약 3칸 */}
            <div className="pay-summary">
              {[
                { lbl: '총 예산', val: sumByCur(selPays, p => p.total), color: 'var(--text)' },
                { lbl: '결제 완료', val: sumByCur(selPays, p => (p.deposit_paid ? p.deposit_amount : 0) + (p.final_paid ? p.final_amount : 0)), color: '#2E7D51' },
                { lbl: '결제 대기', val: sumByCur(selPays, p => (!p.deposit_paid ? p.deposit_amount : 0) + (!p.final_paid ? p.final_amount : 0)), color: '#D63031' },
              ].map((m, i) => (
                <div key={i} className="card-sm" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>{m.lbl}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: m.color }}>{m.val}</div>
                </div>
              ))}
            </div>

            {/* 항목별 카드 */}
            {selPays.map(pay => {
              const color = exhColorFromKey(selected)
              const isSaving = saving === pay.id
              return (
                <PayCard key={`${pay.id}-${pay.deposit_amount}-${pay.final_amount}-${pay.currency}-${pay.deposit_paid}-${pay.final_paid}`} pay={pay} color={color} isSaving={isSaving}
                  onToggle={togglePaid}
                  onSaveCurrency={saveCurrency}
                  onSaveAmounts={saveAmounts} />
              )
            })}
          </div>
        ) : (
          <div style={{ color: 'var(--muted)', fontSize: 14, padding: 20 }}>왼쪽에서 박람회를 선택하세요</div>
        )}
      </div>
    </div>
  )
}

function PayCard({ pay, color, isSaving, onToggle, onSaveCurrency, onSaveAmounts }: {
  pay: Payment; color: string; isSaving: boolean
  onToggle: (id: string, type: 'deposit' | 'final', cur: boolean) => void
  onSaveCurrency: (id: string, cur: string) => void
  onSaveAmounts: (pay: Payment, da: number, dd: string, fa: number, fd: string) => void
}) {
  const [depositAmt, setDepositAmt] = useState(String(pay.deposit_amount))
  const [depositDue, setDepositDue] = useState(pay.deposit_due || '')
  const [finalAmt, setFinalAmt] = useState(String(pay.final_amount))
  const [finalDue, setFinalDue] = useState(pay.final_due || '')

  return (
    <div className="pay-item-card">
      <div className="pic-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
          <div style={{ width: 5, height: 22, background: costColor(pay.item), borderRadius: 3, flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap' }}>{pay.item}</span>
          <span style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
            총액: <strong style={{ color: 'var(--accent)' }}>
              {(CUR_SYM[pay.currency] || pay.currency)}{pay.total.toLocaleString()}
            </strong>
          </span>
          <select
            value={pay.currency || 'KRW'}
            onChange={e => onSaveCurrency(pay.id, e.target.value)}
            style={{ padding: '4px 6px', border: '1px solid var(--border2)', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0, background: 'white', width: 72 }}>
            {['KRW', 'JPY', 'USD', 'EUR', 'SGD'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button
          className="btn btn-muted btn-sm"
          style={{ flexShrink: 0 }}
          disabled={isSaving}
          onClick={() => onSaveAmounts(pay, parseFloat(depositAmt) || 0, depositDue, parseFloat(finalAmt) || 0, finalDue)}>
          {isSaving ? '저장 중...' : '💾 저장'}
        </button>
      </div>
      <div className="pic-body">
        <div className="pic-col" style={{ background: '#EEF4FF' }}>
          <div className="pc-title">계약금 (Deposit)</div>
          <label>금액</label>
          <input type="number" value={depositAmt} onChange={e => setDepositAmt(e.target.value)} />
          <label>납부일</label>
          <input type="date" value={depositDue} onChange={e => setDepositDue(e.target.value)} />
          <div className="status-toggle" onClick={() => onToggle(pay.id, 'deposit', pay.deposit_paid)} style={{ cursor: 'pointer' }}>
            <div className={`toggle${pay.deposit_paid ? ' on' : ''}`} />
            <span style={{ fontSize: 13, fontWeight: 600, color: pay.deposit_paid ? 'var(--green)' : 'var(--muted)' }}>
              {pay.deposit_paid ? '결제 완료 ✓' : '미결제'}
            </span>
          </div>
        </div>
        <div className="pic-col" style={{ background: '#F0FFF4' }}>
          <div className="pc-title">잔금 (Final)</div>
          <label>금액</label>
          <input type="number" value={finalAmt} onChange={e => setFinalAmt(e.target.value)} />
          <label>납부일</label>
          <input type="date" value={finalDue} onChange={e => setFinalDue(e.target.value)} />
          <div className="status-toggle" onClick={() => onToggle(pay.id, 'final', pay.final_paid)} style={{ cursor: 'pointer' }}>
            <div className={`toggle${pay.final_paid ? ' on' : ''}`} />
            <span style={{ fontSize: 13, fontWeight: 600, color: pay.final_paid ? 'var(--green)' : 'var(--muted)' }}>
              {pay.final_paid ? '결제 완료 ✓' : '미결제'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
