import { useState } from 'react'
import { costColor, CUR_SYM } from '../lib/utils'
import type { Payment } from '../types/database'
import { useLang } from '../contexts/LangContext'

// 결제 항목 카드 — "예산 탭 > 결제 일정"과 "비용 결제 일정 관리" 메뉴가 공유하는 UI.
// 두 화면 모두 같은 payments 테이블을 다루므로, 동작이 갈라지지 않도록 컴포넌트를 통일한다.
export default function PaymentCard({ pay, color, isSaving, onToggle, onSaveCurrency, onSaveAmounts, onDelete }: {
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
          <span style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '40%' }}>{pay.item}</span>
          <span style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
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
