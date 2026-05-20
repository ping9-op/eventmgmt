import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { STAGE_ORDER, STAGE_COLORS } from '../../lib/utils'
import { loadAllSettings, CONTRACT_STATUSES as SYSTEM_CONTRACT_STATUSES, ONBOARD_STATUSES as SYSTEM_ONBOARD_STATUSES, type SalesSettingsData } from '../../lib/settings'
import { useToast } from '../../contexts/ToastContext'
import type { SalesLead, SalesActivity, SalesTask, SalesProposal } from '../../types/database'
import { useLang } from '../../contexts/LangContext'

const CONTRACT_STATUSES = SYSTEM_CONTRACT_STATUSES
const ONBOARD_STATUSES = SYSTEM_ONBOARD_STATUSES
const ACTIVITY_RESULTS = ['Interested', 'No Response', 'Not Interested', 'Requested Info', 'Scheduled Meeting']

type TabId = 'basic' | 'funnel' | 'activity' | 'proposal'

export default function LeadDetailPanel({
  leadId, onClose, onRefresh
}: {
  leadId: string
  onClose: () => void
  onRefresh: () => void
}) {
  const { t } = useLang()
  const { showToast } = useToast()
  const [settings, setSettings] = useState<SalesSettingsData | null>(null)
  const [tab, setTab] = useState<TabId>('basic')
  const [lead, setLead] = useState<SalesLead | null>(null)
  const [activities, setActivities] = useState<SalesActivity[]>([])
  const [tasks, setTasks] = useState<SalesTask[]>([])
  const [proposal, setProposal] = useState<SalesProposal | null>(null)
  const [saving, setSaving] = useState(false)

  // Activity form
  const [showActForm, setShowActForm] = useState(false)
  const [actType, setActType] = useState('Email')
  const [actResult, setActResult] = useState('Interested')
  const [actNote, setActNote] = useState('')

  // Lead edit state
  const [form, setForm] = useState<Partial<SalesLead>>({})
  const [propForm, setPropForm] = useState<Partial<SalesProposal>>({})

  useEffect(() => {
    loadAllSettings().then(setSettings)
  }, [])

  useEffect(() => {
    async function load() {
      const [{ data: lData }, { data: aData }, { data: tData }, { data: pData }] = await Promise.all([
        supabase.from('sales_leads').select('*').eq('id', leadId).single(),
        supabase.from('sales_activities').select('*').eq('lead_id', leadId).order('activity_date', { ascending: false }),
        supabase.from('sales_tasks').select('*').eq('lead_id', leadId).order('due_date'),
        supabase.from('sales_proposals').select('*').eq('lead_id', leadId).single(),
      ])
      if (lData) {
        setLead(lData as SalesLead)
        setForm(lData as SalesLead)
      }
      setActivities((aData || []) as SalesActivity[])
      setTasks((tData || []) as SalesTask[])
      if (pData) {
        setProposal(pData as SalesProposal)
        setPropForm(pData as SalesProposal)
      }
    }
    load()
  }, [leadId])

  async function save() {
    if (!lead || !form) return
    setSaving(true)
    const updates: Partial<SalesLead> = {
      company_name: form.company_name || lead.company_name,
      contact_person: form.contact_person || lead.contact_person,
      phone: form.phone,
      email: form.email,
      lead_source: form.lead_source || lead.lead_source,
      event_name: form.event_name || lead.event_name,
      owner: form.owner || lead.owner,
      priority: form.priority || lead.priority,
      country_corridor: form.country_corridor || lead.country_corridor,
      business_type: form.business_type || lead.business_type,
      expected_monthly_volume: form.expected_monthly_volume,
      volume_currency: form.volume_currency || lead.volume_currency,
      address: form.address,
      remarks: form.remarks,
      current_stage: form.current_stage || lead.current_stage,
      first_contact_done: form.first_contact_done,
      last_contact_date: form.last_contact_date,
      next_follow_up_date: form.next_follow_up_date,
      next_action: form.next_action,
      lost_reason: form.lost_reason,
    }
    await supabase.from('sales_leads').update(updates as never).eq('id', leadId)

    // Save proposal
    if (propForm.proposal_sent_date !== undefined || propForm.contract_status !== undefined) {
      const propData = {
        lead_id: leadId,
        proposal_sent_date: propForm.proposal_sent_date || null,
        proposed_fee_rate: propForm.proposed_fee_rate || null,
        expected_monthly_volume: propForm.expected_monthly_volume || null,
        volume_currency: propForm.volume_currency || 'USD',
        contract_status: propForm.contract_status || 'Not Sent',
        onboarding_status: propForm.onboarding_status || 'Not Started',
        remarks: propForm.remarks || null,
      }
      if (proposal) {
        await supabase.from('sales_proposals').update(propData).eq('id', proposal.id)
      } else {
        await supabase.from('sales_proposals').insert(propData)
      }
    }

    setSaving(false)
    showToast(t('saved_ok'))
    onRefresh()
    // Refresh lead data
    const { data } = await supabase.from('sales_leads').select('*').eq('id', leadId).single()
    if (data) { setLead(data as SalesLead); setForm(data as SalesLead) }
  }

  async function addActivity() {
    await supabase.from('sales_activities').insert({
      lead_id: leadId,
      activity_type: actType,
      activity_result: actResult,
      activity_date: new Date().toISOString().split('T')[0],
      note: actNote,
      created_by: 'Andrew',
    })
    setActNote(''); setShowActForm(false)
    const { data } = await supabase.from('sales_activities').select('*').eq('lead_id', leadId).order('activity_date', { ascending: false })
    setActivities((data || []) as SalesActivity[])
    onRefresh()
  }

  async function markTaskDone(taskId: string) {
    await supabase.from('sales_tasks').update({ status: 'Done', completed_at: new Date().toISOString().split('T')[0] }).eq('id', taskId)
    const { data } = await supabase.from('sales_tasks').select('*').eq('lead_id', leadId).order('due_date')
    setTasks((data || []) as SalesTask[])
    onRefresh()
  }

  async function updateStageInline(stage: string) {
    setForm(f => ({ ...f, current_stage: stage }))
    await supabase.from('sales_leads').update({ current_stage: stage }).eq('id', leadId)
    onRefresh()
  }

  if (!lead) return null

  const tabs: { id: TabId; label: string }[] = [
    { id: 'basic', label: '📋 기본 정보' },
    { id: 'funnel', label: '🔀 Funnel / Stage' },
    { id: 'activity', label: '📝 Activity' },
    { id: 'proposal', label: '📄 Proposal/Contract' },
  ]

  const stageBg = STAGE_COLORS[form.current_stage || lead.current_stage]?.bg || '#6B7280'

  return (
    <>
      {/* Overlay backdrop */}
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999, display: 'flex', justifyContent: 'flex-end' }}
        onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        {/* Panel */}
        <div style={{ width: 700, background: 'white', height: '100%', display: 'flex', flexDirection: 'column', boxShadow: '-6px 0 30px rgba(0,0,0,.2)', overflow: 'hidden' }}
          onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div style={{ background: 'var(--sb)', padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>{lead.company_name}</div>
              <div style={{ fontSize: 12, color: '#B0A0A0' }}>{lead.contact_person} · {lead.event_name}</div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, color: 'white', background: stageBg }}>
                {form.current_stage || lead.current_stage}
              </span>
              <button onClick={save} disabled={saving}
                style={{ background: 'var(--accent)', border: 'none', color: 'white', padding: '6px 14px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                {saving ? t('saving') : `💾 ${t('save')}`}
              </button>
              <button onClick={onClose}
                style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: 'white', width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>
                ✕
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', background: '#F5F0F0', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
            {tabs.map(tb => (
              <div key={tb.id}
                onClick={() => setTab(tb.id)}
                style={{
                  padding: '11px 18px', fontSize: 13,
                  fontWeight: tab === tb.id ? 700 : 500,
                  cursor: 'pointer',
                  color: tab === tb.id ? 'var(--accent)' : 'var(--muted)',
                  borderBottom: tab === tb.id ? '3px solid var(--accent)' : '3px solid transparent',
                  whiteSpace: 'nowrap', transition: 'all .15s',
                }}>
                {tb.label}
              </div>
            ))}
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto' }}>

            {/* 기본 정보 */}
            {tab === 'basic' && (
              <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Company Name *">
                  <input value={form.company_name || ''} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} placeholder="회사명" />
                </Field>
                <Field label="Contact Person">
                  <input value={form.contact_person || ''} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} placeholder="담당자" />
                </Field>
                <Field label="Phone">
                  <input value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="전화번호" />
                </Field>
                <Field label="Email">
                  <input type="email" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="이메일" />
                </Field>
                <Field label="Lead Source">
                  <select value={form.lead_source || ''} onChange={e => setForm(f => ({ ...f, lead_source: e.target.value }))}>
                    {(settings?.sources || []).map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Event Name">
                  <select value={form.event_name || ''} onChange={e => setForm(f => ({ ...f, event_name: e.target.value }))}>
                    <option value="">— 선택 —</option>
                    {(settings?.event_names || []).map(n => <option key={n}>{n}</option>)}
                  </select>
                </Field>
                <Field label="Owner">
                  <select value={form.owner || ''} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))}>
                    {(settings?.owners || []).map(o => <option key={o}>{o}</option>)}
                  </select>
                </Field>
                <Field label="Priority">
                  <select value={form.priority || ''} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                    {['High', 'Medium', 'Low'].map(p => <option key={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label="Corridor">
                  <select value={form.country_corridor || ''} onChange={e => setForm(f => ({ ...f, country_corridor: e.target.value }))}>
                    {(settings?.corridors || []).map(c => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Business Type">
                  <select value={form.business_type || ''} onChange={e => setForm(f => ({ ...f, business_type: e.target.value }))}>
                    {(settings?.business_types || []).map(b => <option key={b}>{b}</option>)}
                  </select>
                </Field>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 5 }}>Expected Volume (Monthly)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
                    <input type="number" value={form.expected_monthly_volume || 0} onChange={e => setForm(f => ({ ...f, expected_monthly_volume: parseInt(e.target.value) || 0 }))} placeholder="예상 월 거래금액" />
                    <select value={form.volume_currency || 'USD'} onChange={e => setForm(f => ({ ...f, volume_currency: e.target.value }))} style={{ minWidth: 80 }}>
                      <option>USD</option><option>KRW</option>
                    </select>
                  </div>
                </div>
                <Field label="Address">
                  <input value={form.address || ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="주소" />
                </Field>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 5 }}>Remarks</div>
                  <textarea value={form.remarks || ''} rows={2} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>
              </div>
            )}

            {/* Funnel / Stage */}
            {tab === 'funnel' && (
              <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Current Stage">
                  <select value={form.current_stage || lead.current_stage} onChange={e => setForm(f => ({ ...f, current_stage: e.target.value }))}>
                    {STAGE_ORDER.map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="First Contact Done">
                  <select value={String(form.first_contact_done ?? lead.first_contact_done)} onChange={e => setForm(f => ({ ...f, first_contact_done: e.target.value === 'true' }))}>
                    <option value="true">✅ Yes</option>
                    <option value="false">❌ No</option>
                  </select>
                </Field>
                <Field label="Last Contact Date">
                  <input type="date" value={form.last_contact_date || ''} onChange={e => setForm(f => ({ ...f, last_contact_date: e.target.value }))} />
                </Field>
                <Field label="Next Follow-up Date">
                  <input type="date" value={form.next_follow_up_date || ''} onChange={e => setForm(f => ({ ...f, next_follow_up_date: e.target.value }))} />
                </Field>
                <div style={{ gridColumn: '1 / -1' }}>
                  <Field label="Next Action">
                    <input value={form.next_action || ''} onChange={e => setForm(f => ({ ...f, next_action: e.target.value }))} placeholder="다음 액션" />
                  </Field>
                </div>
                {(form.current_stage || lead.current_stage) === 'Lost' && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <Field label="Lost Reason">
                      <select value={form.lost_reason || ''} onChange={e => setForm(f => ({ ...f, lost_reason: e.target.value }))}>
                        {(settings?.lost_reasons || ['No Demand', 'Price Issue', 'Competitor Already Used', 'No Response', 'Other']).map(r => <option key={r}>{r}</option>)}
                      </select>
                    </Field>
                  </div>
                )}
                {proposal && <>
                  <Field label="Contract Status">
                    <select value={propForm.contract_status || proposal.contract_status} onChange={e => setPropForm(f => ({ ...f, contract_status: e.target.value }))}>
                      {CONTRACT_STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="Onboarding Status">
                    <select value={propForm.onboarding_status || proposal.onboarding_status} onChange={e => setPropForm(f => ({ ...f, onboarding_status: e.target.value }))}>
                      {ONBOARD_STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="Proposed Fee Rate">
                    <input value={propForm.proposed_fee_rate ?? (proposal.proposed_fee_rate || '')} onChange={e => setPropForm(f => ({ ...f, proposed_fee_rate: parseFloat(e.target.value) || null }))} placeholder="e.g. 0.8" />
                  </Field>
                  <Field label="Proposal Sent Date">
                    <input type="date" value={propForm.proposal_sent_date || proposal.proposal_sent_date || ''} onChange={e => setPropForm(f => ({ ...f, proposal_sent_date: e.target.value }))} />
                  </Field>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 5 }}>Contract Remarks</div>
                    <textarea value={propForm.remarks || proposal.remarks || ''} rows={2} onChange={e => setPropForm(f => ({ ...f, remarks: e.target.value }))} style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                </>}
                {!proposal && (
                  <div style={{ gridColumn: '1 / -1', color: 'var(--muted)', fontSize: 13, padding: 10 }}>
                    아직 Proposal이 없습니다. Proposal Sent 단계로 변경 후 정보를 입력하세요.
                  </div>
                )}
              </div>
            )}

            {/* Activity */}
            {tab === 'activity' && (
              <div style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Activity Timeline</div>
                  <button onClick={() => setShowActForm(v => !v)}
                    style={{ padding: '5px 12px', borderRadius: 6, background: 'var(--accent)', color: 'white', border: 'none', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                    + Activity
                  </button>
                </div>

                {showActForm && (
                  <div style={{ background: '#F9F5F5', border: '1px solid var(--border2)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>유형</div>
                        <select value={actType} onChange={e => setActType(e.target.value)}>
                          {(settings?.contact_methods || ['Email', 'Call', 'SMS', 'Kakao', 'Visit']).map(m => <option key={m}>{m}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>결과</div>
                        <select value={actResult} onChange={e => setActResult(e.target.value)}>
                          {ACTIVITY_RESULTS.map(r => <option key={r}>{r}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>메모</div>
                      <textarea value={actNote} rows={2} onChange={e => setActNote(e.target.value)} style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={addActivity} style={{ padding: '6px 14px', borderRadius: 6, background: 'var(--accent)', color: 'white', border: 'none', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>{t('save')}</button>
                      <button onClick={() => setShowActForm(false)} style={{ padding: '6px 14px', borderRadius: 6, background: 'white', color: 'var(--muted)', border: '1px solid var(--border2)', fontSize: 12, cursor: 'pointer' }}>{t('cancel')}</button>
                    </div>
                  </div>
                )}

                {activities.length === 0 && !showActForm && <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: 30 }}>기록된 Activity 없음</div>}

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {activities.map((a, i) => (
                    <div key={a.id} style={{ display: 'flex', gap: 14 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--accent)', marginTop: 4, flexShrink: 0 }} />
                        {i < activities.length - 1 && <div style={{ width: 2, flex: 1, background: 'var(--border2)', margin: '4px 0' }} />}
                      </div>
                      <div style={{ flex: 1, paddingBottom: 14 }}>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{a.activity_date} · by {a.created_by}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, margin: '2px 0' }}>{a.activity_type} — {a.activity_result}</div>
                        <div style={{ fontSize: 12, color: 'var(--text)' }}>{a.note}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tasks */}
                <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Follow-up Tasks</div>
                  {tasks.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13 }}>등록된 Task 없음</div>}
                  {tasks.map(tk => (
                    <div key={tk.id} style={{ background: 'var(--light)', borderRadius: 8, padding: '10px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{tk.task_title}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{tk.task_type} · {tk.due_date} · {tk.owner}</div>
                      </div>
                      {tk.status !== 'Done'
                        ? <button onClick={() => markTaskDone(tk.id)} style={{ padding: '4px 10px', borderRadius: 6, background: '#059669', color: 'white', border: 'none', fontSize: 11, cursor: 'pointer' }}>{t('mark_done')}</button>
                        : <span style={{ color: '#059669', fontWeight: 600, fontSize: 12 }}>✅ Done</span>
                      }
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Proposal/Contract */}
            {tab === 'proposal' && (
              <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Proposal Sent Date">
                  <input type="date" value={propForm.proposal_sent_date || proposal?.proposal_sent_date || ''} onChange={e => setPropForm(f => ({ ...f, proposal_sent_date: e.target.value }))} />
                </Field>
                <Field label="Proposed Fee Rate">
                  <input value={String(propForm.proposed_fee_rate ?? (proposal?.proposed_fee_rate || ''))} onChange={e => setPropForm(f => ({ ...f, proposed_fee_rate: parseFloat(e.target.value) || null }))} placeholder="e.g. 0.8" />
                </Field>
                <Field label="Contract Status">
                  <select value={propForm.contract_status || proposal?.contract_status || 'Not Sent'} onChange={e => setPropForm(f => ({ ...f, contract_status: e.target.value }))}>
                    {CONTRACT_STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Onboarding Status">
                  <select value={propForm.onboarding_status || proposal?.onboarding_status || 'Not Started'} onChange={e => setPropForm(f => ({ ...f, onboarding_status: e.target.value }))}>
                    {ONBOARD_STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 5 }}>Expected Volume</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input type="number" value={propForm.expected_monthly_volume ?? (proposal?.expected_monthly_volume || 0)} onChange={e => setPropForm(f => ({ ...f, expected_monthly_volume: parseInt(e.target.value) || null }))} style={{ flex: 1 }} />
                    <select value={propForm.volume_currency || proposal?.volume_currency || 'USD'} onChange={e => setPropForm(f => ({ ...f, volume_currency: e.target.value }))} style={{ minWidth: 80 }}>
                      <option>USD</option><option>KRW</option>
                    </select>
                  </div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 5 }}>Remarks</div>
                  <textarea value={propForm.remarks || proposal?.remarks || ''} rows={3} onChange={e => setPropForm(f => ({ ...f, remarks: e.target.value }))} style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  )
}

export { CONTRACT_STATUSES, ONBOARD_STATUSES }
