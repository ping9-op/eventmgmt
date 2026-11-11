import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { STAGE_ORDER, STAGE_COLORS, OUTREACH_CHANNELS, localDateStr } from '../../lib/utils'
import LostReasonModal, { type LostReasonInput } from '../LostReasonModal'
import DecimalInput from '../DecimalInput'
import { useIsMobile } from '../../hooks/useBreakpoint'
import { logStageChange } from '../../lib/stageHistory'
import { loadAllEventRefs, type EventRef } from '../../lib/events'
import { encryptRows, decryptRows } from '../../lib/pii'
import { toEventRefMap, leadEventLabel, eventSelectOptions, leadEventSelectValue, eventSelectToFields } from '../../lib/leadEvents'
import EventSelect from '../EventSelect'
import CompleteTaskModal from '../CompleteTaskModal'
import AutoBadge from '../AutoBadge'
import { ACTIVITY_RESULTS, TASK_TYPES, addLeadTask, daysFromToday } from '../../lib/tasks'
import RadioGroup from '../RadioGroup'
import { parseCorridor, composeCorridor, normalizeCorridor, COUNTRIES, TX_TYPES, type TxType } from '../../lib/corridor'
import { loadAllSettings, BUSINESS_TYPES, type SalesSettingsData } from '../../lib/settings'
import { useToast } from '../../contexts/ToastContext'
import type { SalesLead, SalesActivity, SalesTask } from '../../types/database'
import { useLang } from '../../contexts/LangContext'
import { useAuth } from '../../contexts/AuthContext'

const TASK_TYPE_MAP: Record<string, string> = {
  '이메일': 'Email', '전화': 'Call', '문자': 'SMS', '카카오': 'KakaoTalk',
  '미팅': 'Meeting', '미팅 준비': 'Meeting Prep', '서류': 'Request Docs',
  '제안서': 'Send Proposal', '기타': 'Other',
}
function taskTypeEn(type: string): string { return TASK_TYPE_MAP[type] || type }
// 저장된 값이 설정 목록에 없으면(Excel 업로드 값, 설정에서 삭제된 값) 옵션에 추가 — 없으면 첫 옵션처럼 잘못 보임
function withCurrent(list: string[] | undefined, current: string | null | undefined): string[] {
  const l = list || []
  return current && !l.includes(current) ? [current, ...l] : l
}

const ACTIVITY_ICONS: Record<string, { icon: string; color: string }> = {
  Email: { icon: '📧', color: '#4F46E5' },
  Call:  { icon: '📞', color: '#059669' },
  SMS:   { icon: '💬', color: '#0EA5E9' },
  Kakao: { icon: '💛', color: '#F59E0B' },
  KakaoTalk: { icon: '💛', color: '#F59E0B' },
  Visit: { icon: '🤝', color: '#7C3AED' },
  Meeting: { icon: '🗓', color: '#DC2626' },
  'Send Proposal': { icon: '📄', color: '#B5363A' },
  'Request Docs': { icon: '📋', color: '#6B7280' },
}

const RESULT_COLORS: Record<string, string> = {
  Interested: '#059669',
  'No Response': '#9CA3AF',
  'Not Interested': '#DC2626',
  'Requested Info': '#D97706',
  'Scheduled Meeting': '#7C3AED',
}

type TabId = 'basic' | 'funnel' | 'activity'

export default function LeadDetailPanel({
  leadId, onClose, onRefresh
}: {
  leadId: string
  onClose: () => void
  onRefresh: () => void
}) {
  const { t, lang } = useLang()
  const { showToast } = useToast()
  const isMobile = useIsMobile()
  const { isAdmin } = useAuth()
  const [settings, setSettings] = useState<SalesSettingsData | null>(null)
  const [tab, setTab] = useState<TabId>('basic')
  const [lead, setLead] = useState<SalesLead | null>(null)
  const [activities, setActivities] = useState<SalesActivity[]>([])
  const [tasks, setTasks] = useState<SalesTask[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showLostModal, setShowLostModal] = useState(false)

  // Activity form
  const [showActForm, setShowActForm] = useState(false)
  const [actType, setActType] = useState('Email')
  const [actResult, setActResult] = useState('Interested')
  const [actDate, setActDate] = useState(localDateStr())
  const [actNote, setActNote] = useState('')

  // 다음 할 일 (Task)
  const [completing, setCompleting] = useState<SalesTask | null>(null)
  const [showAddTask, setShowAddTask] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', type: 'Email', due: daysFromToday(3) })

  // Lead edit state
  const [form, setForm] = useState<Partial<SalesLead>>({})

  const [eventRefs, setEventRefs] = useState<EventRef[]>([])
  // 행사 선택값: 'p:<proposalId>' (박람회 행사) / 't:<행사명>' (박람회 외) / '' (없음)
  const [eventSel, setEventSel] = useState('')
  // 거래유형 + 송금 국가 (저장은 country_corridor 한 칸)
  const [corrTx, setCorrTx] = useState<TxType>('')
  const [corrCountry, setCorrCountry] = useState('')
  const refMap = toEventRefMap(eventRefs)

  useEffect(() => {
    loadAllSettings().then(setSettings)
    loadAllEventRefs().then(setEventRefs)
  }, [])

  function applyLoadedLead(l: SalesLead) {
    setLead(l)
    setForm(l)
    setEventSel(leadEventSelectValue(l))
    const c = parseCorridor(l.country_corridor)
    setCorrTx(c.txType)
    setCorrCountry(c.country)
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [{ data: lData }, { data: aData }, { data: tData }] = await Promise.all([
          supabase.from('sales_leads').select('*').eq('id', leadId).single(),
          supabase.from('sales_activities').select('*').eq('lead_id', leadId).order('activity_date', { ascending: false }),
          supabase.from('sales_tasks').select('*').eq('lead_id', leadId).order('due_date'),
        ])
        const [leadRows, acts, tsks] = await Promise.all([
          decryptRows('sales_leads', lData ? [lData as SalesLead] : []),
          decryptRows('sales_activities', (aData || []) as SalesActivity[]),
          decryptRows('sales_tasks', (tData || []) as SalesTask[]),
        ])
        if (cancelled) return
        if (leadRows[0]) applyLoadedLead(leadRows[0])
        setActivities(acts)
        setTasks(tsks)
      } catch (err: any) {
        if (!cancelled) showToast('⚠️ 데이터 로딩 실패: ' + (err?.message || '알 수 없는 오류'))
      }
    }
    load()
    return () => { cancelled = true }
  }, [leadId])

  async function save() {
    if (!lead || !form) return
    if ((form.current_stage || lead.current_stage) === 'Lost' && !form.lost_reason) {
      showToast('⚠️ Lost 사유를 선택해주세요.'); setTab('funnel'); return
    }
    setSaving(true)
    try {
      const newStage = form.current_stage || lead.current_stage
      const stageChanged = newStage !== lead.current_stage

      // 행사는 선택이 바뀐 경우에만 proposal_id + event_name을 함께 저장한다.
      // (proposal_id 그대로 event_name만 바뀌면 DB 트리거가 proposal_id를 초기화하므로, 변경 없을 때는 보내지 않음)
      const eventChanged = eventSel !== leadEventSelectValue(lead)
      const eventFields = eventChanged ? eventSelectToFields(eventSel, refMap, lead.event_name) : {}
      const updates: Partial<SalesLead> = {
        company_name: form.company_name || lead.company_name,
        // contact_person은 NOT NULL 컬럼 → 지운 경우 빈 문자열로 저장 (이전 값으로 되돌리지 않음)
        contact_person: form.contact_person ?? lead.contact_person,
        phone: form.phone,
        email: form.email,
        lead_source: form.lead_source || lead.lead_source,
        // 비울 수 있는 필드는 빈 값도 그대로 저장 (|| 로 이전 값으로 되돌리면 지울 방법이 없음)
        ...eventFields,
        owner: form.owner || lead.owner,
        // 발굴자는 관리자만 변경 (DB 트리거도 매니저의 변경은 무시)
        ...(isAdmin ? { sourced_by: form.sourced_by || lead.sourced_by } : {}),
        // 송금 국가는 표준 이름으로 통일해서 저장 ('japan'·'일본' → 'Japan')
        country_corridor: normalizeCorridor(form.country_corridor ?? lead.country_corridor),
        business_type: form.business_type ?? lead.business_type,
        industry: form.industry ?? lead.industry,
        expected_monthly_volume: form.expected_monthly_volume ?? null,
        volume_currency: form.volume_currency || lead.volume_currency,
        address: form.address,
        remarks: form.remarks,
        // next_action / next_follow_up_date는 DB가 할 일(Task)에서 채우므로 보내지 않음
        lost_reason: form.lost_reason,
        lost_reason_note: form.lost_reason_note || null,
        outreach_channel: form.outreach_channel || null,
      }
      // 단계·첫 연락·마지막 연락일은 다른 화면에서 할 일 완료·활동 기록으로 DB가 바꿀 수 있으므로, 이 창에서 직접 바꾼 경우에만 보냄
      // (그대로 보내면 열어둔 예전 값으로 되돌림)
      if (newStage !== lead.current_stage) updates.current_stage = newStage
      if ((form.first_contact_done ?? lead.first_contact_done) !== lead.first_contact_done) updates.first_contact_done = form.first_contact_done
      if ((form.last_contact_date || null) !== (lead.last_contact_date || null)) updates.last_contact_date = form.last_contact_date || null
      // 개인정보 필드는 암호화해서 저장 (암호화 실패 시 저장하지 않음)
      const [encUpdates] = await encryptRows('sales_leads', [{ ...updates, id: leadId }])
      const { id: _id, ...encFields } = encUpdates
      const { error: leadErr } = await supabase.from('sales_leads').update(encFields as never).eq('id', leadId)
      if (leadErr) throw leadErr

      // 스테이지 변경 시 이력 기록
      if (stageChanged) {
        logStageChange(leadId, lead.current_stage, newStage)
      }

      showToast(t('saved_ok'))
      onRefresh()
      const { data } = await supabase.from('sales_leads').select('*').eq('id', leadId).single()
      if (data) applyLoadedLead((await decryptRows('sales_leads', [data as SalesLead]))[0])
    } catch (err: any) {
      showToast('⚠️ 저장 실패: ' + (err?.message || '알 수 없는 오류'))
    } finally {
      setSaving(false)
    }
  }

  // 리드는 삭제하지 않고 보관 — Activity/Task/단계 이력 모두 보존, 보관함에서 복원 가능 (DB에서 실제 삭제 차단)
  async function archiveLead() {
    if (!lead) return
    if (!window.confirm(`"${lead.company_name}" 리드를 보관하시겠습니까?\n목록에서 사라지며, 기록은 모두 보존되고 보관함에서 복원할 수 있습니다.`)) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('sales_leads').update({ archived_at: new Date().toISOString() }).eq('id', leadId)
      if (error) throw error
      showToast('🗄️ 리드가 보관되었습니다.')
      onRefresh()
      onClose()
    } catch (err: any) {
      showToast('⚠️ 보관 실패: ' + (err?.message || '알 수 없는 오류'))
    } finally {
      setDeleting(false)
    }
  }

  async function addActivity() {
    try {
      // 메모는 암호화해서 저장 (암호화 실패 시 저장하지 않음)
      const [act] = await encryptRows('sales_activities', [{
        lead_id: leadId,
        activity_type: actType,
        activity_result: actResult,
        activity_date: actDate,
        note: actNote,
        created_by: '', // DB 트리거(set_actor)가 실제 작업자로 채움
      }])
      const { error } = await supabase.from('sales_activities').insert(act)
      if (error) { showToast('⚠️ Activity 저장 실패: ' + error.message); return }
      setActNote(''); setShowActForm(false); setActDate(localDateStr())
      await refreshActivityAndTasks()
    } catch (err: any) {
      showToast('⚠️ Activity 저장 실패: ' + (err?.message || '알 수 없는 오류'))
    }
  }

  // Activity·할 일이 바뀌면 DB 트리거가 리드의 마지막 연락일·다음 할 일·단계를 바꾼다
  // → 그 값만 다시 읽어 반영 (작성 중인 다른 입력값은 유지)
  async function refreshActivityAndTasks() {
    const [{ data: lData }, { data: aData }, { data: tData }] = await Promise.all([
      supabase.from('sales_leads').select('*').eq('id', leadId).single(),
      supabase.from('sales_activities').select('*').eq('lead_id', leadId).order('activity_date', { ascending: false }),
      supabase.from('sales_tasks').select('*').eq('lead_id', leadId).order('due_date'),
    ])
    setActivities(await decryptRows('sales_activities', (aData || []) as SalesActivity[]))
    setTasks(await decryptRows('sales_tasks', (tData || []) as SalesTask[]))
    if (lData) {
      const [l] = await decryptRows('sales_leads', [lData as SalesLead])
      setLead(l)
      setForm(f => ({
        ...f,
        current_stage: l.current_stage, last_contact_date: l.last_contact_date, first_contact_done: l.first_contact_done,
        next_action: l.next_action, next_follow_up_date: l.next_follow_up_date,
        lost_reason: l.lost_reason, lost_reason_note: l.lost_reason_note, lost_at_stage: l.lost_at_stage,
      }))
    }
    onRefresh()
  }

  async function submitNewTask() {
    if (!newTask.title.trim()) { showToast('⚠️ 할 일을 입력해주세요.'); return }
    if (!newTask.due) { showToast('⚠️ 기한 날짜를 입력해주세요.'); return }
    try {
      await addLeadTask(leadId, newTask)
      setShowAddTask(false)
      setNewTask({ title: '', type: 'Email', due: daysFromToday(3) })
      showToast('📅 할 일이 추가되었습니다.')
      await refreshActivityAndTasks()
    } catch (err: any) {
      showToast('⚠️ 할 일 추가 실패: ' + (err?.message || '알 수 없는 오류'))
    }
  }

  async function updateStageInline(stage: string, lost?: LostReasonInput) {
    if (stage === 'Lost' && !lost) { setShowLostModal(true); return }
    const prev = lead?.current_stage || null
    setForm(f => ({ ...f, current_stage: stage }))
    try {
      const { error } = await supabase.from('sales_leads').update({ current_stage: stage, ...lost }).eq('id', leadId)
      if (error) throw error
      logStageChange(leadId, prev, stage)
      const { data } = await supabase.from('sales_leads').select('*').eq('id', leadId).single()
      if (data) applyLoadedLead((await decryptRows('sales_leads', [data as SalesLead]))[0])
      onRefresh()
    } catch (err: any) {
      setForm(f => ({ ...f, current_stage: prev || undefined }))
      showToast('⚠️ 스테이지 변경 실패: ' + (err?.message || '알 수 없는 오류'))
    }
  }

  if (!lead) return null

  const leadLabel = leadEventLabel(lead, refMap)
  const eventOptions = eventSelectOptions(eventRefs, settings?.event_names || [])
  // 현재 값이 목록에 없으면(보관된 박람회 행사, 설정에서 삭제된 행사명) 옵션에 추가 — 없으면 첫 옵션처럼 잘못 보임
  if (eventSel && !eventOptions.some(o => o.value === eventSel)) {
    const isExpo = eventSel.startsWith('p:')
    eventOptions.unshift({ value: eventSel, label: isExpo ? (lead.event_name || '(보관된 행사)') : eventSel.slice(2), isExpo })
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'basic', label: '📋 기본 정보' },
    { id: 'funnel', label: '🔀 Funnel / Stage' },
    { id: 'activity', label: `📝 활동 · 할 일 ${activities.length > 0 ? `(${activities.length})` : ''}` },
  ]

  const stageBg = STAGE_COLORS[form.current_stage || lead.current_stage]?.bg || '#6B7280'
  // 미완료 할 일 (due_date 순으로 불러옴) — 첫 번째가 리드의 '다음 할 일'
  const openTasks = tasks.filter(tk => tk.status !== 'Done')
  const nextTask = openTasks[0] || null
  const nextOverdue = !!nextTask && nextTask.due_date < localDateStr()
  const isClosed = lead.current_stage === 'Won' || lead.current_stage === 'Lost'

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999, display: 'flex', justifyContent: 'flex-end' }}
        onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div style={{ width: '100%', maxWidth: isMobile ? undefined : 700, background: 'white', height: '100%', display: 'flex', flexDirection: 'column', boxShadow: '-6px 0 30px rgba(0,0,0,.2)', overflow: 'hidden' }}
          onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div style={{ background: 'var(--sb)', padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.company_name}</div>
              <div style={{ fontSize: 12, color: '#B0A0A0' }}>{[lead.contact_person, leadLabel].filter(Boolean).join(' · ')}</div>
              <div style={{ fontSize: 11, color: '#D8CCCC', marginTop: 2 }}>
                👤 담당 <b style={{ color: 'white' }}>{lead.owner || '—'}</b>
                {lead.sourced_by && lead.sourced_by !== lead.owner && <> · 🔎 발굴 <b style={{ color: 'white' }}>{lead.sourced_by}</b></>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
              <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 700, color: 'white', background: stageBg, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {form.current_stage || lead.current_stage}
              </span>
              <button onClick={save} disabled={saving}
                style={{ background: 'var(--accent)', border: 'none', color: 'white', padding: isMobile ? '10px 10px' : '6px 14px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700, minHeight: 44 }}>
                {saving ? t('saving') : isMobile ? '💾' : `💾 ${t('save')}`}
              </button>
              <button onClick={archiveLead} disabled={deleting} title="리드 보관"
                style={{ background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.35)', color: 'white', padding: isMobile ? '10px 10px' : '6px 14px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700, minHeight: 44 }}>
                {deleting ? '보관 중...' : isMobile ? '🗄️' : '🗄️ 보관'}
              </button>
              <button onClick={onClose}
                style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: 'white', width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>
                ✕
              </button>
            </div>
          </div>

          {/* 다음 할 일 — 어느 탭에서든 보이도록 헤더 바로 아래 (팔로우업 메뉴의 Task와 같은 데이터) */}
          <div style={{ padding: '10px 22px', background: nextTask ? (nextOverdue ? '#FEF2F2' : '#EEF2FF') : '#FFFBEB', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13 }}>
              <span style={{ fontWeight: 700, color: 'var(--muted)', whiteSpace: 'nowrap' }}>📅 다음 할 일</span>
              {nextTask ? (
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <b style={{ color: nextOverdue ? '#DC2626' : '#4F46E5' }}>{nextTask.due_date}{nextOverdue ? ' (기한 지남)' : ''}</b> · {nextTask.task_title}
                  {openTasks.length > 1 && <span style={{ color: 'var(--muted)' }}> 외 {openTasks.length - 1}건</span>}
                </span>
              ) : (
                <span style={{ flex: 1, color: isClosed ? 'var(--muted)' : '#B45309' }}>{isClosed ? `없음 (${lead.current_stage} — 종료된 리드)` : '없음 — 다음에 언제 무엇을 할지 정해두세요'}</span>
              )}
              {nextTask && (
                <button onClick={() => setCompleting(nextTask)}
                  style={{ padding: '5px 12px', borderRadius: 6, background: '#059669', color: 'white', border: 'none', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>✅ 완료</button>
              )}
              <button onClick={() => setShowAddTask(v => !v)}
                style={{ padding: '5px 12px', borderRadius: 6, background: 'white', color: 'var(--accent)', border: '1.5px solid var(--accent)', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
                {showAddTask ? '접기' : '+ 할 일 추가'}
              </button>
            </div>
            {showAddTask && (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 120px 140px auto', gap: 8, marginTop: 10, alignItems: 'center' }}>
                <input autoFocus value={newTask.title} onChange={e => setNewTask(n => ({ ...n, title: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') submitNewTask() }} placeholder="무엇을? 예: 견적서 보내기" />
                <select value={newTask.type} onChange={e => setNewTask(n => ({ ...n, type: e.target.value }))}>
                  {TASK_TYPES.map(tp => <option key={tp}>{tp}</option>)}
                </select>
                <input type="date" value={newTask.due} onChange={e => setNewTask(n => ({ ...n, due: e.target.value }))} />
                <button onClick={submitNewTask}
                  style={{ padding: '7px 14px', borderRadius: 7, background: 'var(--accent)', color: 'white', border: 'none', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>추가</button>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', background: '#F5F0F0', borderBottom: '1px solid var(--border2)', flexShrink: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
            {tabs.map(tb => (
              <div key={tb.id} onClick={() => setTab(tb.id)}
                style={{ padding: '11px 16px', fontSize: 12, fontWeight: tab === tb.id ? 700 : 500, cursor: 'pointer',
                  color: tab === tb.id ? 'var(--accent)' : 'var(--muted)',
                  borderBottom: tab === tb.id ? '3px solid var(--accent)' : '3px solid transparent',
                  whiteSpace: 'nowrap', transition: 'all .15s' }}>
                {tb.label}
              </div>
            ))}
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto' }}>

            {/* 기본 정보 */}
            {tab === 'basic' && (
              <div className="g2" style={{ padding: isMobile ? 14 : 20 }}>
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
                    {withCurrent(settings?.sources, form.lead_source).map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Outreach Channel">
                  <select value={form.outreach_channel || ''} onChange={e => setForm(f => ({ ...f, outreach_channel: e.target.value || null }))}>
                    <option value="">—</option>
                    {OUTREACH_CHANNELS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Event Name">
                  {/* 등록 화면과 동일: 박람회 행사 우선, 설정의 박람회 외 행사 추가, 목록에 없으면 직접 입력 */}
                  <EventSelect value={eventSel} onChange={setEventSel} options={eventOptions} placeholder={t('select_placeholder')} />
                </Field>
                <Field label="Owner">
                  {isAdmin ? (
                    <select value={form.owner || ''} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))}>
                      {withCurrent(settings?.owners, form.owner).map(o => <option key={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input value={form.owner || ''} disabled style={{ background: 'var(--light)', color: 'var(--muted)' }} />
                  )}
                </Field>
                <Field label="발굴자">
                  {isAdmin ? (
                    <select value={form.sourced_by || ''} onChange={e => setForm(f => ({ ...f, sourced_by: e.target.value }))}>
                      {withCurrent(settings?.owners, form.sourced_by).map(o => <option key={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input value={form.sourced_by || ''} disabled style={{ background: 'var(--light)', color: 'var(--muted)' }} />
                  )}
                </Field>
                <Field label="Transaction Type">
                  <RadioGroup value={corrTx} onChange={v => { setCorrTx(v as TxType); setForm(f => ({ ...f, country_corridor: composeCorridor(v as TxType, corrCountry) })) }}
                    options={TX_TYPES.map(x => ({ value: x, label: x }))} />
                </Field>
                <Field label="Remittance Country">
                  <input value={corrCountry} placeholder="예: Japan, Vietnam" list="panel-countries"
                    onChange={e => { setCorrCountry(e.target.value); setForm(f => ({ ...f, country_corridor: composeCorridor(corrTx, e.target.value) })) }} />
                  <datalist id="panel-countries">
                    {COUNTRIES.map(c => <option key={c} value={c} />)}
                  </datalist>
                </Field>
                <Field label="Business Type">
                  <RadioGroup value={form.business_type || ''} onChange={v => setForm(f => ({ ...f, business_type: v }))}
                    options={BUSINESS_TYPES.map(b => ({ value: b, label: b === '법인' ? '법인사업자' : b }))} />
                </Field>
                <Field label="Industry">
                  <select value={form.industry || ''} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}>
                    <option value="">—</option>
                    {withCurrent(settings?.industries, form.industry).map(b => <option key={b}>{b}</option>)}
                  </select>
                </Field>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 5 }}>Expected Volume (Monthly)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 8 }}>
                    <DecimalInput value={form.expected_monthly_volume} onChange={v => setForm(f => ({ ...f, expected_monthly_volume: v }))} placeholder="월 예상 금액" />
                    <select value={form.volume_currency || 'USD'} onChange={e => setForm(f => ({ ...f, volume_currency: e.target.value }))}>
                      <option>USD</option><option>KRW</option>
                    </select>
                  </div>
                </div>
                <Field label="Address">
                  <input value={form.address || ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                </Field>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 5 }}>Remarks</div>
                  <textarea value={form.remarks || ''} rows={2} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>
              </div>
            )}

            {/* Funnel / Stage */}
            {tab === 'funnel' && (
              <div style={{ padding: 20 }}>
                {/* 스테이지 빠른 변경 버튼 */}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>빠른 스테이지 변경 (즉시 저장됨)</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {STAGE_ORDER.map(s => {
                      const c = STAGE_COLORS[s] || { bg: '#6B7280' }
                      const isActive = (form.current_stage || lead.current_stage) === s
                      return (
                        <button key={s} onClick={() => !isActive && updateStageInline(s)}
                          style={{ padding: '6px 14px', borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: isActive ? 'default' : 'pointer', transition: 'all .15s',
                            background: isActive ? c.bg : 'white', color: isActive ? 'white' : c.bg,
                            border: `2px solid ${c.bg}`, opacity: isActive ? 1 : 0.7 }}>
                          {isActive && '✓ '}{s}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="g2">
                  <Field label="First Contact Done">
                    <select value={String(form.first_contact_done ?? lead.first_contact_done)} onChange={e => setForm(f => ({ ...f, first_contact_done: e.target.value === 'true' }))}>
                      <option value="true">✅ Yes</option>
                      <option value="false">❌ No</option>
                    </select>
                  </Field>
                  <Field label="Last Contact Date">
                    <input type="date" value={form.last_contact_date || ''} onChange={e => setForm(f => ({ ...f, last_contact_date: e.target.value || null }))} />
                  </Field>
                  {(form.current_stage || lead.current_stage) === 'Lost' && <>
                    <Field label="Lost Reason *">
                      <select value={form.lost_reason || ''} onChange={e => setForm(f => ({ ...f, lost_reason: e.target.value }))}>
                        <option value="">-- 선택 --</option>
                        {(settings?.lost_reasons || []).map(r => <option key={r}>{r}</option>)}
                        {/* 설정에서 삭제된 기존 사유도 표시 */}
                        {form.lost_reason && settings && !settings.lost_reasons.includes(form.lost_reason) && <option>{form.lost_reason}</option>}
                      </select>
                    </Field>
                    <Field label="Lost At Stage">
                      <input value={form.lost_at_stage || '—'} disabled style={{ background: 'var(--light)', color: 'var(--muted)' }} />
                    </Field>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <Field label="Lost Note">
                        <textarea value={form.lost_reason_note || ''} rows={2} onChange={e => setForm(f => ({ ...f, lost_reason_note: e.target.value }))} style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                      </Field>
                    </div>
                  </>}
                </div>
              </div>
            )}

            {/* Activity */}
            {tab === 'activity' && (
              <div style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>
                    Activity Timeline
                    <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted)', marginLeft: 8 }}>({activities.length}건)</span>
                  </div>
                  <button onClick={() => setShowActForm(v => !v)}
                    style={{ padding: '6px 14px', borderRadius: 7, background: 'var(--accent)', color: 'white', border: 'none', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
                    {showActForm ? '접기 ▲' : '+ Activity 추가'}
                  </button>
                </div>

                {showActForm && (
                  <div style={{ background: '#F9F5F5', border: '1.5px solid var(--border2)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                    <div className="g3" style={{ gap: 10, marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>{t('type_lbl')}</div>
                        <select value={actType} onChange={e => setActType(e.target.value)}>
                          {(settings?.contact_methods || ['Email', 'Call', 'SMS', 'Kakao', 'Visit']).map(m => <option key={m}>{m}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>{t('result_col')}</div>
                        <select value={actResult} onChange={e => setActResult(e.target.value)}>
                          {ACTIVITY_RESULTS.map(r => <option key={r}>{r}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>날짜</div>
                        <input type="date" value={actDate} onChange={e => setActDate(e.target.value)} />
                      </div>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>{t('task_note_lbl')}</div>
                      <textarea value={actNote} rows={2} onChange={e => setActNote(e.target.value)}
                        placeholder="통화 내용, 미팅 결과, 이메일 내용 등 기록..."
                        style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={addActivity} style={{ padding: '7px 16px', borderRadius: 7, background: 'var(--accent)', color: 'white', border: 'none', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>{t('save')}</button>
                      <button onClick={() => setShowActForm(false)} style={{ padding: '7px 14px', borderRadius: 7, background: 'white', color: 'var(--muted)', border: '1px solid var(--border2)', fontSize: 12, cursor: 'pointer' }}>{t('cancel')}</button>
                    </div>
                  </div>
                )}

                {activities.length === 0 && !showActForm && (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
                    <div style={{ fontSize: 13 }}>{t('no_activities')}</div>
                    <button onClick={() => setShowActForm(true)} style={{ marginTop: 14, padding: '7px 18px', borderRadius: 7, background: 'var(--accent)', color: 'white', border: 'none', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
                      첫 번째 Activity 기록하기
                    </button>
                  </div>
                )}

                {/* Activity Timeline */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {activities.map((a, i) => {
                    const typeInfo = ACTIVITY_ICONS[a.activity_type] || { icon: '📌', color: '#6B7280' }
                    const resultColor = RESULT_COLORS[a.activity_result || ''] || '#6B7280'
                    return (
                      <div key={a.id} style={{ display: 'flex', gap: 14 }}>
                        {/* Timeline 라인 */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: typeInfo.color + '18',
                            border: `2px solid ${typeInfo.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 16, marginTop: 2, flexShrink: 0 }}>
                            {typeInfo.icon}
                          </div>
                          {i < activities.length - 1 && (
                            <div style={{ width: 2, flex: 1, background: 'var(--border2)', margin: '6px 0', minHeight: 12 }} />
                          )}
                        </div>

                        {/* 내용 */}
                        <div style={{ flex: 1, paddingBottom: 16 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: typeInfo.color }}>{a.activity_type}</span>
                            {a.activity_result && (
                              <span style={{ fontSize: 11, fontWeight: 700, color: 'white', background: resultColor, padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                                {a.activity_result}
                              </span>
                            )}
                            {/* Activity는 추가만 가능 — 수정·삭제 없음 (DB 정책으로도 차단) */}
                            <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>{a.activity_date} · {a.created_by}</span>
                          </div>
                          {a.note && (
                            <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6, background: '#FAFAFA', borderRadius: 7, padding: '8px 10px', whiteSpace: 'pre-wrap' }}>
                              {a.note}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Tasks */}
                {tasks.length > 0 && (
                  <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--text)' }}>
                      Follow-up Tasks
                      <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted)', marginLeft: 6 }}>({tasks.filter(t => t.status !== 'Done').length}건 미완료)</span>
                    </div>
                    {tasks.map(tk => {
                      const today = localDateStr()
                      const isOverdue = tk.status !== 'Done' && tk.due_date < today
                      const isDone = tk.status === 'Done'
                      return (
                        <div key={tk.id} style={{ background: isDone ? '#F0FFF4' : isOverdue ? '#FEF2F2' : 'var(--light)',
                          borderRadius: 8, padding: '10px 14px', marginBottom: 8,
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          border: `1px solid ${isDone ? '#A7F3D0' : isOverdue ? '#FECACA' : 'var(--border)'}`,
                          flexWrap: 'wrap', gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: isOverdue ? '#DC2626' : 'var(--text)', textDecoration: isDone ? 'line-through' : 'none' }}>
                              {tk.auto_stage && <AutoBadge />}{tk.task_title}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                              {lang === 'en' ? taskTypeEn(tk.task_type) : tk.task_type} · {tk.due_date}
                              {isOverdue && <span style={{ color: '#DC2626', fontWeight: 700, marginLeft: 6 }}>🔴 기한 초과</span>}
                            </div>
                          </div>
                          {isDone
                            ? <span style={{ color: '#059669', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>✅ Done</span>
                            : <button onClick={() => setCompleting(tk)} style={{ padding: '4px 12px', borderRadius: 6, background: '#059669', color: 'white', border: 'none', fontSize: 11, cursor: 'pointer', fontWeight: 700, flexShrink: 0 }}>완료</button>
                          }
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {completing && (
        <CompleteTaskModal task={completing} leadStage={lead.current_stage} companyName={lead.company_name}
          onClose={() => setCompleting(null)}
          onDone={async () => { setCompleting(null); await refreshActivityAndTasks() }} />
      )}

      {showLostModal && (
        <LostReasonModal
          onCancel={() => setShowLostModal(false)}
          onConfirm={async v => { await updateStageInline('Lost', v); setShowLostModal(false) }} />
      )}
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

