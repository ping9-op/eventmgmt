import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { STAGE_ORDER, STAGE_COLORS } from '../../lib/utils'
import type { SalesLead, SalesTask } from '../../types/database'
import LeadDetailPanel from './LeadDetailPanel'
import { useLang } from '../../contexts/LangContext'
import { useIsMobile } from '../../hooks/useBreakpoint'

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
  const isMobile = useIsMobile()
  const [leads, setLeads] = useState<SalesLead[]>([])
  const [tasks, setTasks] = useState<SalesTask[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [{ data: leadData, error: le }, { data: taskData, error: te }] = await Promise.all([
          supabase.from('sales_leads').select('*'),
          supabase.from('sales_tasks').select('*'),
        ])
        if (le) throw le
        if (te) throw te
        if (!cancelled) {
          setLeads((leadData || []) as SalesLead[])
          setTasks((taskData || []) as SalesTask[])
        }
      } catch (err: any) {
        console.error('SalesDashboard load error:', err?.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (loading) return <div className="view wide"><div style={{ color: 'var(--muted)', padding: 40 }}>{t('loading')}</div></div>

  const total = leads.length
  const byStage = (s: string) => leads.filter(l => l.current_stage === s).length
  const won = byStage('Onboarded / Won')
  const active = leads.filter(l => l.current_stage !== 'Lost' && l.current_stage !== 'Onboarded / Won').length
  const convRate = total ? Math.round(won / total * 100) : 0
  const overdueCount = tasks.filter(t => t.due_date < today && t.status !== 'Done').length
  const todayTaskCount = tasks.filter(t => t.due_date === today && t.status !== 'Done').length
  const onboardingCount = byStage('Onboarding')

  const toUSD = (l: SalesLead) => l.volume_currency === 'KRW'
    ? (l.expected_monthly_volume || 0) / 1350
    : (l.expected_monthly_volume || 0)
  const topLeads = [...leads].filter(l => l.current_stage !== 'Lost')
    .sort((a, b) => toUSD(b) - toUSD(a)).slice(0, 5)

  const owners = [...new Set(leads.map(l => l.owner))]
  const ownerStats = owners.map(o => ({
    owner: o,
    total: leads.filter(l => l.owner === o).length,
    won: leads.filter(l => l.owner === o && l.current_stage === 'Onboarded / Won').length,
    active: leads.filter(l => l.owner === o && l.current_stage !== 'Lost' && l.current_stage !== 'Onboarded / Won').length,
  }))

  const kpiCards = [
    { lbl: t('s_total'), val: total, col: 'var(--accent)', fn: () => navigate('/sales/funnel', { state: { filter: null, view: 'table' } }) },
    { lbl: t('s_active'), val: active, col: '#4F46E5', fn: () => navigate('/sales/funnel', { state: { filter: '__active__', view: 'table' } }) },
    { lbl: t('s_won'), val: won, col: '#065F46', fn: () => navigate('/sales/funnel', { state: { filter: 'Onboarded / Won', view: 'board' } }) },
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
                    onClick={() => navigate('/sales/leads', { state: { filter: { owner: o.owner, stage: 'Onboarded / Won' } } })}>
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
        const events = [...new Set(leads.map(l => l.event_name))].filter(Boolean)
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
                    const el = leads.filter(l => l.event_name === ev)
                    const eWon = el.filter(l => l.current_stage === 'Onboarded / Won').length
                    const eLost = el.filter(l => l.current_stage === 'Lost').length
                    const eActive = el.filter(l => l.current_stage !== 'Lost' && l.current_stage !== 'Onboarded / Won').length
                    const eTotal = el.length
                    const wonPct = eTotal ? Math.round(eWon / eTotal * 100) : 0
                    const activePct = eTotal ? Math.round(eActive / eTotal * 100) : 0
                    const lostPct = eTotal ? Math.round(eLost / eTotal * 100) : 0
                    return (
                      <tr key={ev} style={{ borderBottom: '0.5px solid var(--border)', cursor: 'pointer', transition: 'background .1s' }}
                        onClick={() => navigate('/sales/leads', { state: { filter: { event: ev } } })}
                        onMouseOver={e => Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(td => (td.style.background = '#FDF5F5'))}
                        onMouseOut={e => Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(td => (td.style.background = ''))}>
                        <td style={{ padding: '9px 14px', fontWeight: 600, fontSize: 12 }}>{ev.replace(/ 20\d\d$/, '')}</td>
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
              const { data, error } = await supabase.from('sales_leads').select('*')
              if (error) throw error
              setLeads((data || []) as SalesLead[])
            } catch (err: any) {
              console.error('SalesDashboard onRefresh error:', err?.message)
            }
          }}
        />
      )}
    </div>
  )
}
