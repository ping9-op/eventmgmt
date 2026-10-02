import { useEffect, useState } from 'react'
import { useLang } from '../contexts/LangContext'
import { loadAllSettings, DEFAULTS } from '../lib/settings'
import { relativeDays } from '../lib/utils'

export interface LostReasonInput { lost_reason: string; lost_reason_note: string | null }

/** 단계를 Lost로 바꿀 때 사유(필수)·메모(선택)를 받는 모달 */
export default function LostReasonModal({ count = 1, onConfirm, onCancel }: {
  count?: number
  onConfirm: (v: LostReasonInput) => void | Promise<void>
  onCancel: () => void
}) {
  const { t } = useLang()
  const [reasons, setReasons] = useState<string[]>(DEFAULTS.lost_reasons)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadAllSettings().then(s => setReasons(s.lost_reasons)) }, [])

  async function submit() {
    if (!reason) return
    setSaving(true)
    try { await onConfirm({ lost_reason: reason, lost_reason_note: note.trim() || null }) }
    finally { setSaving(false) }
  }

  return (
    // 리드 상세 패널(z-index 9999) 위에서도 열리도록 z-index를 올린다
    <div className="modal-bg open" style={{ zIndex: 10000 }} onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-hdr">
          <h3>{t('lost_modal_title')}</h3>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
          {count > 1 ? t('lost_modal_desc_bulk').replace('{n}', String(count)) : t('lost_modal_desc')}
        </div>
        <label>{t('lost_reason_lbl')} <span style={{ color: '#DC2626' }}>*</span></label>
        <select autoFocus value={reason} onChange={e => setReason(e.target.value)}>
          <option value="">{t('select_placeholder')}</option>
          {reasons.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <label style={{ marginTop: 12 }}>{t('lost_reason_note_lbl')}</label>
        <textarea rows={2} value={note} onChange={e => setNote(e.target.value)} />
        <div className="modal-footer">
          <button className="btn btn-muted" onClick={onCancel}>{t('cancel')}</button>
          <button className="btn btn-primary" onClick={submit} disabled={!reason || saving}>
            {saving ? t('saving') : t('lost_modal_confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

/** 카드용: 연락 채널 뱃지 + 마지막 연락 상대일 */
export function LeadContactMeta({ channel, lastContact }: { channel?: string | null; lastContact?: string | null }) {
  const { lang } = useLang()
  if (!channel && !lastContact) return null
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--muted)' }}>
      {channel && (
        <span style={{ padding: '1px 7px', borderRadius: 99, background: '#EEF1F5', color: '#4B5563', fontWeight: 600, whiteSpace: 'nowrap' }}>{channel}</span>
      )}
      {lastContact && <span title={lastContact} style={{ whiteSpace: 'nowrap' }}>🕒 {relativeDays(lastContact, lang)}</span>}
    </span>
  )
}
