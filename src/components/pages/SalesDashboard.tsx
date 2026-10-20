import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { STAGE_ORDER, STAGE_COLORS, isActiveStage, localDateStr, dayDiffFromToday, priorityColor } from '../../lib/utils'
import type { SalesLead, SalesTask } from '../../types/database'
import LeadDetailPanel from './LeadDetailPanel'
import { useLang } from '../../contexts/LangContext'
import { useToast } from '../../contexts/ToastContext'
import { useIsMobile } from '../../hooks/useBreakpoint'
import LoadingSpinner from '../LoadingSpinner'
import { loadAllEventRefs, type EventRef } from '../../lib/events'
import { decryptRows } from '../../lib/pii'
import { toEventRefMap, groupLeadsByEvent, eventGroupFilter } from '../../lib/leadEvents'

const UPCOMING_DAYS = 14   // 다가오는 일정: 오늘부터 며칠 뒤까지 (지연된 Task는 기간과 무관하게 모두 표시)
const UPCOMING_MAX = 8     // 대시보드에 표시할 최대 개수 (나머지는 팔로우업 관리에서)
const PRIORITY_RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 }
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** '2026-10-21' → '10/21 (수)' */
function fmtDue(d: string): string {
  const dt = new Date(`${d}T00:00:00`)
  if (isNaN(dt.getTime())) return d
  return `${dt.getMonth() + 1}/${dt.getDate()} (${WEEKDAYS[dt.getDay()]})`
}

function krwusd(vol: number | null, cur: string): string {
  if (!vol) return '-'
  return cur === 'KRW' ? `₩${Number(vol).toLocaleString()}` : `$${Number(vol).toLocaleString()}`
}

function StageBadge({ stage }: { stage: string }) {
  const c = STAGE_COLORS[stage] || { bg: '#6B7280' }
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, color: 'white', background: c.bg, whiteSpace: 'nowrap' }}>
      {stage}
    </span>
  )
}

export default function SalesDashboard() {
  const { t } = useLang()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const isMobile = useIsMobile()
  const [leads, setLeads] = useState<SalesLead[]>([])
  const [tasks, setTasks] = useState<SalesTask[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [eventRefs, setEventRefs] = useState<EventRef[]>([])

  const today = localDateStr()

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [{ data: leadData, error: le }, { data: taskData, error: te }, refs] = await Promise.all([
          supabase.from('sales_leads').select('*').is('archived_at', null),
          supabase.from('sales_tasks').select('*'),
          loadAllEventRefs(),
        ])
        if (le) throw le
        if (te) throw te
        if (!cancelled) {
          const activeLeads = await decryptRows('sales_leads', (leadData || []) as SalesLead[])
          const activeIds = new Set(activeLeads.map(l => l.id))
          // 보관된 리드의 Task는 제외
          const activeTasks = await decryptRows('sales_tasks', ((taskData || []) as SalesTask[]).filter(t => activeIds.has(t.lead_id)))
          if (cancelled) return
          setLeads(activeLeads)
          setTasks(activeTasks)
          setEventRefs(refs)
        }
      } catch (err: any) {
        showToast('데이터를 불러오는 중 오류가 발생했습니다.', 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // 리드 상세에서 Task를 완료/추가할 수 있으므로 리드와 Task를 함께 다시 읽는다
  async function reload() {
    const [{ data: leadData, error: le }, { data: taskData, error: te }] = await Promise.all([
      supabase.from('sales_leads').select('*').is('archived_at', null),
      supabase.from('sales_tasks').select('*'),
    ])
    if (le) throw le
    if (te) throw te
    const activeLeads = await decryptRows('sales_leads', (leadData || []) as SalesLead[])
    const activeIds = new Set(activeLeads.map(l => l.id))
    setLeads(activeLeads)
    setTasks(await decryptRows('sales_tasks', ((taskData || []) as SalesTask[]).filter(t => activeIds.has(t.lead_id))))
  }

  async function completeTask(taskId: string) {
    const { error } = await supabase.from('sales_tasks').update({ status: 'Done', completed_at: today }).eq('id', taskId)
    if (error) { showToast('⚠️ 완료 처리 실패: ' + error.message); return }
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'Done', completed_at: today } : t))
    showToast('Task 완료!')
  }

  if (loading) return <div className="view wide"><LoadingSpinner /></div>

  const total = leads.length
  const byStage = (s: string) => leads.filter(l => l.current_stage === s).length
  const won = byStage('Won')
  const active = leads.filter(l => isActiveStage(l.current_stage)).length
  const convRate = total ? Math.round(won / total * 100) : 0
  const overdueCount = tasks.filter(t => t.due_date < today && t.status !== 'Done').length
  const todayTaskCount = tasks.filter(t => t.due_date === today && t.status !== 'Done').length
  const onboardingCount = byStage('Onboarding')

  // 다가오는 팔로우업 일정: 미완료 Task 중 기한 지난 것 전부 + 향후 14일, 기한 빠른 순
  const leadById = new Map(leads.map(l => [l.id, l]))
  const upcomingTasks = tasks
    .filter(tk => tk.status !== 'Done')
    .map(tk => ({ task: tk, days: dayDiffFromToday(tk.due_date) ?? 0 }))
    .filter(u => u.days <= UPCOMING_DAYS)
    .sort((a, b) => a.days - b.days || (PRIORITY_RANK[a.task.priority] ?? 9) - (PRIORITY_RANK[b.task.priority] ?? 9))
  const shownTasks = upcomingTasks.slice(0, UPCOMING_MAX)

  const toUSD = (l: SalesLead) => l.volume_currency === 'KRW'
    ? (l.expected_monthly_volume || 0) / 1350
    : (l.expected_monthly_volume || 0)
  const topLeads = [...leads].filter(l => l.current_stage !== 'Lost')
    .sort((a, b) => toUSD(b) - toUSD(a)).slice(0, 5)

  const owners = [...new Set(leads.map(l => l.owner))]
  const ownerStats = owners.map(o => ({
    owner: o,
    total: leads.filter(l => l.owner === o).length,
    won: leads.filter(l => l.owner === o && l.current_stage === 'Won').length,
    active: leads.filter(l => l.owner === o && isActiveStage(l.current_stage)).length,
  }))

  const kpiCards = [
    { lbl: t('s_total'), val: total, col: 'var(--accent)', fn: () => navigate('/sales/funnel', { state: { filter: null, view: 'table' } }) },
    { lbl: t('s_active'), val: active, col: '#4F46E5', fn: () => navigate('/sales/funnel', { state: { filter: '__active__', view: 'table' } }) },
    { lbl: t('s_won'), val: won, col: '#065F46', fn: () => navigate('/sales/funnel', { state: { filter: 'Won', view: 'board' } }) },
    { lbl: t('s_lost'), val: byStage('Lost'), col: '#DC2626', fn: () => navigate('/sales/funnel', { state: { filter: 'Lost', view: 'board' } }) },
    { lbl: t('s_conv'), val: convRate + '%', col: '#059669', fn: null },
  ]

  return (
    <div className="view wide">
      <div className="sec-hdr">
        <div className="bar" />
        <div className="txt">{t('s_dashboard_title')}</div>
        <div className="sub">{t('s_dashboard_sub')}</div>
      </div>

      {/* KPI 카드 5개 */}
      <div className="g5" style={{ marginBottom: 28 }}>
        {kpiCards.map((k, i) => (
          <div key={i}
            onClick={k.fn || undefined}
            style={{
              background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12,
              padding: '18px 20px', cursor: k.fn ? 'pointer' : 'default', transition: 'all .15s',
            }}
            onMouseOver={e => { if (k.fn) { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,.1)' } }}
            onMouseOut={e => { if (k.fn) { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = '' } }}
          >
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>{k.lbl}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: k.col }}>{k.val}</div>
            {k.fn && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>{t('click_to_view')}</div>}
          </div>
        ))}
      </div>

      {/* 다가오는 일정 — 팔로우업 Task 기한 (지연 포함 · 향후 14일) */}
      <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <div>
            <span style={{ fontSize: 14, fontWeight: 700 }}>📅 다가오는 일정</span>
            <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 8 }}>팔로우업 기한 · 지연 포함, 향후 {UPCOMING_DAYS}일</span>
          </div>
          <button onClick={() => navigate('/sales/followup')}
            style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer', color: 'var(--muted)' }}>
            {upcomingTasks.length > shownTasks.length ? `+${upcomingTasks.length - shownTasks.length}건 더 · ` : ''}팔로우업 관리 →
          </button>
        </div>
        {shownTasks.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 20, fontSize: 13 }}>
            예정된 팔로우업이 없습니다. 팔로우업 관리에서 Task를 추가하면 여기에 기한순으로 표시됩니다.
          </div>
        ) : (
          <div className="upcoming-row">
            {shownTasks.map(({ task: tk, days: d }) => {
              const lead = leadById.get(tk.lead_id)
              const dc = d <= 0 ? 'var(--danger)' : d <= 3 ? 'var(--amber)' : 'var(--accent)'
              const bg = d < 0 ? '#FFF1F0' : d <= 3 ? '#FFF8E6' : 'white'
              const dt = d < 0 ? `${Math.abs(d)}일 지연` : d === 0 ? '오늘' : d === 1 ? '내일' : `D-${d}`
              return (
                <div key={tk.id} className="ucard" style={{ borderColor: priorityColor(tk.priority), background: bg }}
                  onClick={() => setSelectedLeadId(tk.lead_id)} title="클릭하면 리드 상세가 열립니다">
                  <div className="uc-top">
                    <span className="uc-kind">{tk.task_type} · <span style={{ color: priorityColor(tk.priority), fontWeight: 700 }}>{tk.priority}</span></span>
                    <span className="uc-d" style={{ color: dc }}>{dt}</span>
                  </div>
                  <div className="uc-name">{tk.task_title}</div>
                  <div className="uc-date">{fmtDue(tk.due_date)} · {lead?.company_name || '-'}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>👤 {tk.owner}</span>
                    <button onClick={e => { e.stopPropagation(); completeTask(tk.id) }}
                      style={{ background: 'white', border: '1px solid #A7F3D0', color: '#059669', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      ✓ 완료
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Funnel 단계별 현황 — 풀폭 */}
      <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>{t('funnel_stage_status')}</div>
        {STAGE_ORDER.map(s => {
          const c = STAGE_COLORS[s] || { bg: '#6B7280' }
          const cnt = byStage(s)
          const pct = total ? Math.round(cnt / total * 100) : 0
          return (
            <div key={s}
              onClick={() => navigate('/sales/funnel', { state: { filter: s, view: 'board' } })}
              style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, cursor: 'pointer', padding: '4px 6px', borderRadius: 6, transition: 'background .12s' }}
              onMouseOver={e => (e.currentTarget as HTMLDivElement).style.background = '#F5F0F0'}
              onMouseOut={e => (e.currentTarget as HTMLDivElement).style.background = ''}
            >
              <div style={{ width: 150, minWidth: 80, fontSize: 12, color: 'var(--text)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s}</div>
              <div style={{ flex: 1, background: '#EEE', borderRadius: 4, height: 10, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: c.bg, width: `${pct}%`, borderRadius: 4, transition: 'width .3s' }} />
              </div>
              <div style={{ width: 28, textAlign: 'right', fontSize: 13, fontWeight: 700, color: c.bg }}>{cnt}</div>
            </div>
          )
        })}
      </div>

      {/* 알림 카드 3개 — 가로 3열 */}
      <div className="g3" style={{ marginBottom: 28 }}>
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '18px 20px', cursor: 'pointer' }}
          onClick={() => navigate('/sales/followup', { state: { filter: 'overdue' } })}>
          <div style={{ fontSize: 12, color: '#DC2626', fontWeight: 600, marginBottom: 4 }}>{t('overdue_tasks_lbl')}</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#DC2626' }}>{overdueCount}</div>
          <div style={{ fontSize: 12, color: '#DC2626', marginTop: 4 }}>{t('action_required')}</div>
        </div>
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: '18px 20px', cursor: 'pointer' }}
          onClick={() => navigate('/sales/followup', { state: { filter: 'today' } })}>
          <div style={{ fontSize: 12, color: '#D97706', fontWeight: 600, marginBottom: 4 }}>{t('today_tasks_lbl')}</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#D97706' }}>{todayTaskCount}</div>
          <div style={{ fontSize: 12, color: '#D97706', marginTop: 4 }}>{t('due_today_desc')}</div>
        </div>
        <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12, padding: '18px 20px', cursor: 'pointer' }}
          onClick={() => navigate('/sales/funnel', { state: { filter: 'Onboarding', view: 'board' } })}>
          <div style={{ fontSize: 12, color: '#059669', fontWeight: 600, marginBottom: 4 }}>{t('onboarding_lbl')}</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#059669' }}>{onboardingCount}</div>
          <div style={{ fontSize: 12, color: '#059669', marginTop: 4 }}>{t('onboarding_in_progress_desc')}</div>
        </div>
      </div>

      {/* Top Leads + Owner 성과 */}
      <div className="g2">
        {/* Top Leads */}
        <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>🏆 {t('s_top_leads')}</div>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <tbody>
              {topLeads.map((l, i) => (
                <tr key={l.id}
                  style={{ borderBottom: '0.5px solid var(--border)', cursor: 'pointer' }}
                  onClick={() => setSelectedLeadId(l.id)}
                  onMouseOver={e => Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(td => (td.style.background = '#FDF5F5'))}
                  onMouseOut={e => Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(td => (td.style.background = ''))}
                >
                  <td style={{ padding: '9px 8px', width: 28 }}>
                    <span style={{ background: 'var(--accent)', color: 'white', borderRadius: '50%', width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{i + 1}</span>
                  </td>
                  <td style={{ padding: '9px 0' }}>
                    <div style={{ fontWeight: 600, color: 'var(--accent)' }}>{l.company_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{l.owner}</div>
                  </td>
                  <td style={{ padding: '9px 0', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{krwusd(l.expected_monthly_volume, l.volume_currency)}</div>
                    <StageBadge stage={l.current_stage} />
                  </td>
                </tr>
              ))}
              {topLeads.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--muted)', padding: 20 }}>{t('no_leads_short')}</td></tr>}
            </tbody>
          </table>
          </div>
        </div>

        {/* 담당자별 현황 */}
        <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>👤 {t('s_owner_perf')}</div>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--accent)' }}>
                <th style={{ padding: '8px', textAlign: 'left', fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{t('s_owner_col')}</th>
                <th style={{ padding: '8px', textAlign: 'center', fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{t('s_total_col')}</th>
                <th style={{ padding: '8px', textAlign: 'center', fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{t('s_active_col')}</th>
                <th style={{ padding: '8px', textAlign: 'center', fontSize: 12, color: '#065F46', fontWeight: 600 }}>{t('s_won_col')}</th>
              </tr>
            </thead>
            <tbody>
              {ownerStats.map(o => (
                <tr key={o.owner} style={{ borderBottom: '0.5px solid var(--border)' }}>
                  <td style={{ padding: '9px 8px' }}>
                    <button onClick={() => navigate('/sales/leads', { state: { filter: { owner: o.owner } } })}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--accent)', textDecoration: 'underline', padding: isMobile ? '11px 0' : 0, minHeight: 44 }}>
                      {o.owner}
                    </button>
                  </td>
                  <td style={{ padding: '9px 8px', textAlign: 'center', cursor: 'pointer' }}
                    onClick={() => navigate('/sales/leads', { state: { filter: { owner: o.owner } } })}>
                    {o.total}
                  </td>
                  <td style={{ padding: '9px 8px', textAlign: 'center', color: '#4F46E5', fontWeight: 600, cursor: 'pointer' }}
                    onClick={() => navigate('/sales/leads', { state: { filter: { owner: o.owner } } })}>
                    {o.active}
                  </td>
                  <td style={{ padding: '9px 8px', textAlign: 'center', color: '#065F46', fontWeight: 700, cursor: 'pointer' }}
                    onClick={() => navigate('/sales/leads', { state: { filter: { owner: o.owner, stage: 'Won' } } })}>
                    {o.won}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* 행사별 리드 현황 */}
      {(() => {
        // 박람회 행사는 proposal_id로, 박람회 외 행사는 행사명으로, 행사 없는 리드는 출처별로 묶는다 (누락 없이)
        const events = groupLeadsByEvent(leads, toEventRefMap(eventRefs))
        if (!events.length) return null
        return (
          <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, padding: '20px 24px', marginTop: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <span>🏛 {t('s_event_leads')}</span>
              <button onClick={() => navigate('/sales/reports')}
                style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer', color: 'var(--muted)' }}>
                {t('view_detail')} →
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', minWidth: 600 }}>
                <thead>
                  <tr style={{ background: 'var(--accent)', color: 'white' }}>
                    <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600 }}>행사</th>
                    <th style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 600 }}>Total</th>
                    <th style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 600, color: '#FDE68A' }}>Active</th>
                    <th style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 600, color: '#A7F3D0' }}>Won ✅</th>
                    <th style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 600, color: '#FCA5A5' }}>Lost</th>
                    <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600 }}>파이프라인</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map(ev => {
                    const el = ev.leads
                    const eWon = el.filter(l => l.current_stage === 'Won').length
                    const eLost = el.filter(l => l.current_stage === 'Lost').length
                    const eActive = el.filter(l => isActiveStage(l.current_stage)).length
                    const eTotal = el.length
                    const wonPct = eTotal ? Math.round(eWon / eTotal * 100) : 0
                    const activePct = eTotal ? Math.round(eActive / eTotal * 100) : 0
                    const lostPct = eTotal ? Math.round(eLost / eTotal * 100) : 0
                    return (
                      <tr key={ev.key} style={{ borderBottom: '0.5px solid var(--border)', cursor: 'pointer', transition: 'background .1s' }}
                        onClick={() => navigate('/sales/leads', { state: { filter: eventGroupFilter(ev.key) } })}
                        onMouseOver={e => Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(td => (td.style.background = '#FDF5F5'))}
                        onMouseOut={e => Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(td => (td.style.background = ''))}>
                        <td style={{ padding: '9px 14px', fontWeight: 600, fontSize: 12, color: ev.key.startsWith('s:') ? 'var(--muted)' : undefined }}>{ev.label}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 700 }}>{eTotal}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'center', color: '#4F46E5', fontWeight: 600 }}>{eActive}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'center', color: '#065F46', fontWeight: 700 }}>{eWon}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'center', color: '#DC2626', fontWeight: 600 }}>{eLost}</td>
                        <td style={{ padding: '9px 14px' }}>
                          <div style={{ height: 8, background: '#EEE', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                            <div style={{ width: `${activePct}%`, background: '#4F46E5' }} />
                            <div style={{ width: `${wonPct}%`, background: '#065F46' }} />
                            <div style={{ width: `${lostPct}%`, background: '#DC2626' }} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}

      {selectedLeadId && (
        <LeadDetailPanel
          leadId={selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
          onRefresh={async () => {
            try {
              await reload()
            } catch (err: any) {
              showToast('새로고침 중 오류가 발생했습니다.', 'error')
            }
          }}
        />
      )}
    </div>
  )
}
