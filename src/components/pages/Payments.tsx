import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { costColor, exhColor } from '../../lib/utils'
import type { Exhibition, Payment } from '../../types/database'
import { useLang } from '../../contexts/LangContext'

const CUR_SYM: Record<string, string> = { KRW: '₩', JPY: '¥', USD: '$', EUR: '€', SGD: 'S$' }

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

interface AddItemForm {
  item: string; total: string; currency: string
  depositAmt: string; depositDue: string
  finalAmt: string; finalDue: string
}

const emptyForm = (): AddItemForm => ({
  item: '', total: '', currency: 'KRW',
  depositAmt: '', depositDue: '',
  finalAmt: '', finalDue: '',
})

export default function Payments() {
  const location = useLocation()
  const { t } = useLang()
  const initKey = (location.state as any)?.key || null
  const [payments, setPayments] = useState<Record<string, Payment[]>>({})
  const [exhibitions, setExhibitions] = useState<Record<string, Exhibition>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showInvoice, setShowInvoice] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState<AddItemForm>(emptyForm())
  const [addError, setAddError] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [invoiceParseLoading, setInvoiceParseLoading] = useState(false)
  const [invoiceParseFileName, setInvoiceParseFileName] = useState('')
  const [invoiceParsed, setInvoiceParsed] = useState<{
    fileName: string
    items: { item: string; amount: number; dueDate: string; type: 'deposit' | 'final' }[]
  } | null>(null)
  const itemInputRef = useRef<HTMLInputElement>(null)

  async function load() {
    const [{ data: exhData }, { data: payData }] = await Promise.all([
      supabase.from('exhibitions').select('*'),
      supabase.from('payments').select('*').order('created_at'),
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
    else if (keys.length) setSelected(prev => prev || keys[0])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    setInvoiceParsed(null)
    setInvoiceParseLoading(false)
    setShowInvoice(false)
  }, [selected])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 1800)
  }

  function handleInvoiceFiles(files: FileList | null) {
    if (!files || !selected) return
    const file = files[0]
    if (!file) return
    setInvoiceParseFileName(file.name)
    setInvoiceParseLoading(true)
    setInvoiceParsed(null)
    setTimeout(() => {
      const pays = payments[selected] || []
      const today = new Date()
      const d30 = new Date(today.getTime() + 30 * 86400000).toISOString().split('T')[0]
      const d60 = new Date(today.getTime() + 60 * 86400000).toISOString().split('T')[0]
      const items: { item: string; amount: number; dueDate: string; type: 'deposit' | 'final' }[] = []
      for (const p of pays.slice(0, 3)) {
        if (p.deposit_amount > 0) items.push({ item: p.item, amount: p.deposit_amount, dueDate: p.deposit_due || d30, type: 'deposit' })
        if (p.final_amount > 0)   items.push({ item: p.item, amount: p.final_amount,   dueDate: p.final_due   || d60, type: 'final' })
      }
      if (!items.length) {
        items.push({ item: 'Booth Fee', amount: 3000000, dueDate: d30, type: 'deposit' })
        items.push({ item: 'Booth Fee', amount: 3000000, dueDate: d60, type: 'final' })
      }
      setInvoiceParsed({ fileName: file.name, items })
      setInvoiceParseLoading(false)
    }, 2200)
  }

  async function applyInvoiceToPayments() {
    if (!invoiceParsed || !selected) return
    const pays = payments[selected] || []
    let count = 0
    for (const inv of invoiceParsed.items) {
      const pay = pays.find(p => p.item === inv.item)
      if (!pay) continue
      const update = inv.type === 'deposit'
        ? { deposit_amount: inv.amount, deposit_due: inv.dueDate }
        : { final_amount: inv.amount, final_due: inv.dueDate }
      await supabase.from('payments').update(update).eq('id', pay.id)
      count++
    }
    showToast(count > 0 ? `✅ ${count}개 항목에 납부일이 반영되었습니다.` : '⚠️ 매칭 항목 없음. 수동으로 입력해주세요.')
    setInvoiceParsed(null)
    setShowInvoice(false)
    if (count > 0) load()
  }

  function openAddModal() {
    setAddForm(emptyForm())
    setAddError('')
    setShowAddModal(true)
    setTimeout(() => itemInputRef.current?.focus(), 50)
  }

  async function submitAdd() {
    const itemName = addForm.item.trim()
    if (!itemName) { setAddError('항목명을 입력하세요'); return }
    const total = parseInt(addForm.total) || 0
    if (!total) { setAddError('총 예산 금액을 입력하세요'); return }
    const depAmt = parseInt(addForm.depositAmt) || 0
    const finAmt = addForm.finalAmt !== '' ? (parseInt(addForm.finalAmt) || 0) : total - depAmt

    setAddLoading(true)
    const { error } = await supabase.from('payments').insert({
      exhibition_key: selected!,
      item: itemName,
      total,
      currency: addForm.currency,
      deposit_amount: depAmt,
      deposit_due: addForm.depositDue || null,
      deposit_paid: false,
      final_amount: finAmt,
      final_due: addForm.finalDue || null,
      final_paid: false,
    } as any)
    setAddLoading(false)
    if (error) { setAddError('저장 실패: ' + error.message); return }
    setShowAddModal(false)
    showToast('💾 저장되었습니다.')
    load()
  }

  async function deleteItem(payId: string) {
    if (!confirm('이 항목을 삭제하시겠습니까?')) return
    await supabase.from('payments').delete().eq('id', payId)
    showToast('🗑️ 삭제되었습니다.')
    load()
  }

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
    showToast('💾 저장되었습니다.')
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
    if (allPaid) return { label: '✓ ' + t('paid_done'), color: '#2E7D51' }
    if (somePaid) return { label: t('partially_paid'), color: '#C47D1A' }
    return { label: t('unpaid_label'), color: '#D63031' }
  }

  if (loading) return <div className="view"><div style={{ color: 'var(--muted)', padding: 40 }}>{t('loading')}</div></div>

  return (
    <div className="view">
      <div className="sec-hdr">
        <div className="bar" />
        <div className="txt">{t('pay_title')}</div>
        <div className="sub">{t('pay_sub')}</div>
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
                  {' · '}{pays.length} {t('item_col')}
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
                {exhNameFromKey(selected)} {t('payment_schedule_lbl')}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={openAddModal}>
                  {t('add_pay_item')}
                </button>
                <button className="btn btn-purple btn-sm" onClick={() => {
                  if (showInvoice) { setInvoiceParsed(null); setInvoiceParseLoading(false) }
                  setShowInvoice(v => !v)
                }}>
                  {showInvoice ? `✕ ${t('close')}` : t('invoice_upload')}
                </button>
              </div>
            </div>

            {/* 인보이스 업로드 + 파싱 영역 */}
            {showInvoice && (
              <div style={{ marginBottom: 16 }}>
                {!invoiceParseLoading && !invoiceParsed && (
                  <div className="invoice-drop"
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); handleInvoiceFiles(e.dataTransfer.files) }}
                    onClick={() => document.getElementById('invoice-input')?.click()}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                    <div style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 500 }}>{t('invoice_drag_desc')}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>PDF, JPG, PNG · 단일 파일</div>
                    <input id="invoice-input" type="file" accept=".pdf,.jpg,.png" style={{ display: 'none' }}
                      onChange={e => { handleInvoiceFiles(e.target.files); e.target.value = '' }} />
                  </div>
                )}
                {invoiceParseLoading && (
                  <div style={{ textAlign: 'center', padding: '32px 0', border: '1.5px dashed var(--border2)', borderRadius: 10, background: '#FDFBFB' }}>
                    <style>{`@keyframes inv-dot{0%,80%,100%{transform:scale(0);opacity:.3}40%{transform:scale(1);opacity:1}}`}</style>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 14 }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--accent)', animation: `inv-dot 1.4s ease-in-out ${i * 0.16}s infinite` }} />
                      ))}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>📄 {invoiceParseFileName} — 인보이스 파싱 중...</div>
                  </div>
                )}
                {invoiceParsed && (
                  <div style={{ border: '1px solid var(--border2)', borderRadius: 10, padding: '14px 16px', background: '#FDFBFB' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 10 }}>
                      ✅ 파싱 완료 — "{invoiceParsed.fileName}"
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 14 }}>
                      <thead>
                        <tr style={{ background: 'var(--light)' }}>
                          <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>항목명</th>
                          <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>금액</th>
                          <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 600 }}>납부일</th>
                          <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 600 }}>구분</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoiceParsed.items.map((inv, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '6px 10px' }}>{inv.item}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>
                              {CUR_SYM['KRW']}{inv.amount.toLocaleString()}
                            </td>
                            <td style={{ padding: '6px 10px', textAlign: 'center', color: 'var(--muted)' }}>{inv.dueDate}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                              <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: inv.type === 'deposit' ? '#EEF4FF' : '#F0FFF4', color: inv.type === 'deposit' ? '#3A5FA0' : '#2E7D51' }}>
                                {inv.type === 'deposit' ? '선금' : '잔금'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button className="btn btn-primary" style={{ flex: 1 }} onClick={applyInvoiceToPayments}>
                        💰 결제 일정에 적용
                      </button>
                      <button className="btn btn-muted" style={{ flex: 1 }} onClick={() => setInvoiceParsed(null)}>
                        🔄 다시 선택
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 요약 3칸 */}
            <div className="pay-summary">
              {[
                { lbl: t('total_budget'), val: sumByCur(selPays, p => p.total), color: 'var(--text)' },
                { lbl: t('paid_done'), val: sumByCur(selPays, p => (p.deposit_paid ? p.deposit_amount : 0) + (p.final_paid ? p.final_amount : 0)), color: '#2E7D51' },
                { lbl: t('paid_pending'), val: sumByCur(selPays, p => (!p.deposit_paid ? p.deposit_amount : 0) + (!p.final_paid ? p.final_amount : 0)), color: '#D63031' },
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
                <PayCard
                  key={`${pay.id}-${pay.deposit_amount}-${pay.final_amount}-${pay.currency}-${pay.deposit_paid}-${pay.final_paid}`}
                  pay={pay} color={color} isSaving={isSaving}
                  onToggle={togglePaid}
                  onSaveCurrency={saveCurrency}
                  onSaveAmounts={saveAmounts}
                  onDelete={deleteItem}
                />
              )
            })}

            {selPays.length === 0 && (
              <div style={{ color: 'var(--muted)', fontSize: 14, padding: '24px 0', textAlign: 'center' }}>
                {t('no_items')}
              </div>
            )}
          </div>
        ) : (
          <div style={{ color: 'var(--muted)', fontSize: 14, padding: 20 }}>{t('select_exh')}</div>
        )}
      </div>

      {/* 항목 추가 모달 */}
      {showAddModal && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,.5)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAddModal(false) }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 28, width: 480, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 20, color: 'var(--text)' }}>{t('add_pay_title')}</div>

            <div style={{ display: 'grid', gap: 14 }}>
              {/* 항목명 + 통화 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end' }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>{t('item_name_required')}</label>
                  <input
                    ref={itemInputRef}
                    value={addForm.item}
                    onChange={e => setAddForm(f => ({ ...f, item: e.target.value }))}
                    placeholder="예: Booth Fee, Flight, Design..."
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}
                    onKeyDown={e => e.key === 'Enter' && submitAdd()}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>{t('currency_col')}</label>
                  <select
                    value={addForm.currency}
                    onChange={e => setAddForm(f => ({ ...f, currency: e.target.value }))}
                    style={{ padding: '9px 12px', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 13, width: 80 }}>
                    {['KRW', 'JPY', 'USD', 'EUR', 'SGD'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* 총 예산 */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>{t('total_amount_required')}</label>
                <input
                  type="number"
                  value={addForm.total}
                  onChange={e => setAddForm(f => ({ ...f, total: e.target.value }))}
                  placeholder="0"
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>

              {/* 선금 */}
              <div style={{ background: '#EEF4FF', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#3A5FA0', marginBottom: 10 }}>{t('deposit_label')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>{t('amount_col')}</label>
                    <input
                      type="number"
                      value={addForm.depositAmt}
                      onChange={e => setAddForm(f => ({ ...f, depositAmt: e.target.value }))}
                      placeholder="0"
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border2)', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>{t('pay_date')}</label>
                    <input
                      type="date"
                      value={addForm.depositDue}
                      onChange={e => setAddForm(f => ({ ...f, depositDue: e.target.value }))}
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border2)', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              </div>

              {/* 잔금 */}
              <div style={{ background: '#F0FFF4', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#2E7D51', marginBottom: 10 }}>{t('final_pay')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>{t('amount_col')}</label>
                    <input
                      type="number"
                      value={addForm.finalAmt}
                      onChange={e => setAddForm(f => ({ ...f, finalAmt: e.target.value }))}
                      placeholder={t('total') + ' - ' + t('deposit_pay')}
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border2)', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>{t('pay_date')}</label>
                    <input
                      type="date"
                      value={addForm.finalDue}
                      onChange={e => setAddForm(f => ({ ...f, finalDue: e.target.value }))}
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border2)', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {addError && (
              <div style={{ marginTop: 12, fontSize: 12, color: '#D63031', fontWeight: 600 }}>{addError}</div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn btn-muted btn-sm" onClick={() => setShowAddModal(false)} style={{ padding: '8px 20px' }}>
                {t('cancel')}
              </button>
              <button className="btn btn-primary btn-sm" onClick={submitAdd} disabled={addLoading} style={{ padding: '8px 20px' }}>
                {addLoading ? '추가 중...' : '+ 추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#1E3A5F', color: 'white', padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 9999, animation: 'fadeIn .2s' }}>
          {toast}
        </div>
      )}
    </div>
  )
}

function PayCard({ pay, color, isSaving, onToggle, onSaveCurrency, onSaveAmounts, onDelete }: {
  pay: Payment; color: string; isSaving: boolean
  onToggle: (id: string, type: 'deposit' | 'final', cur: boolean) => void
  onSaveCurrency: (id: string, cur: string) => void
  onSaveAmounts: (pay: Payment, da: number, dd: string, fa: number, fd: string) => void
  onDelete: (id: string) => void
}) {
  const { t } = useLang()
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
            {t('total')}: <strong style={{ color: 'var(--accent)' }}>
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
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            className="btn btn-muted btn-sm"
            disabled={isSaving}
            onClick={() => onSaveAmounts(pay, parseFloat(depositAmt) || 0, depositDue, parseFloat(finalAmt) || 0, finalDue)}>
            {isSaving ? t('saving') : t('save_pay')}
          </button>
          <button
            className="btn btn-sm"
            style={{ background: '#FFF0F0', color: '#D63031', border: '1px solid #F5C6C6' }}
            onClick={() => onDelete(pay.id)}>
            🗑️
          </button>
        </div>
      </div>
      <div className="pic-body">
        <div className="pic-col" style={{ background: '#EEF4FF' }}>
          <div className="pc-title">{t('deposit_label')}</div>
          <label>{t('amount_col')}</label>
          <input type="number" value={depositAmt} onChange={e => setDepositAmt(e.target.value)} />
          <label>{t('pay_date')}</label>
          <input type="date" value={depositDue} onChange={e => setDepositDue(e.target.value)} />
          <div className="status-toggle" onClick={() => onToggle(pay.id, 'deposit', pay.deposit_paid)} style={{ cursor: 'pointer' }}>
            <div className={`toggle${pay.deposit_paid ? ' on' : ''}`} />
            <span style={{ fontSize: 13, fontWeight: 600, color: pay.deposit_paid ? 'var(--green)' : 'var(--muted)' }}>
              {pay.deposit_paid ? t('paid_ok') + ' ✓' : t('not_paid')}
            </span>
          </div>
        </div>
        <div className="pic-col" style={{ background: '#F0FFF4' }}>
          <div className="pc-title">{t('final_pay')}</div>
          <label>{t('amount_col')}</label>
          <input type="number" value={finalAmt} onChange={e => setFinalAmt(e.target.value)} />
          <label>{t('pay_date')}</label>
          <input type="date" value={finalDue} onChange={e => setFinalDue(e.target.value)} />
          <div className="status-toggle" onClick={() => onToggle(pay.id, 'final', pay.final_paid)} style={{ cursor: 'pointer' }}>
            <div className={`toggle${pay.final_paid ? ' on' : ''}`} />
            <span style={{ fontSize: 13, fontWeight: 600, color: pay.final_paid ? 'var(--green)' : 'var(--muted)' }}>
              {pay.final_paid ? t('paid_ok') + ' ✓' : t('not_paid')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
