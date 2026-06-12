import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { STAGE_ORDER, STAGE_COLORS } from '../../lib/utils'
import type { SalesLead } from '../../types/database'
import { useLang } from '../../contexts/LangContext'
import { useToast } from '../../contexts/ToastContext'
import LoadingSpinner from '../LoadingSpinner'
import { computeAvgDaysPerStage, type StageHistoryRow } from '../../lib/stageHistory'

type PeriodFilter = 'all' | 'month' | '3months' | 'year'

function periodLabel(p: PeriodFilter, t: (k: string) => string): string {
  return { all: t('period_all'), month: t('period_this_month'), '3months': t('period_3months'), year: t('period_this_year') }[p] || p
}

function filterByPeriod(leads: SalesLead[], period: PeriodFilter): SalesLead[] {
  if (period === 'all') return leads
  const now = new Date()
  const cutoff = new Date()
  if (period === 'month') cutoff.setDate(1)
  else if (period === '3months') cutoff.setMonth(now.getMonth() - 3)
  else if (period === 'year') cutoff.setMonth(0, 1)
  const cutoffStr = cutoff.toISOString().split('T')[0]
  return leads.filter(l => (l.registered_date || '') >= cutoffStr)
}

// 현재 스테이지별 리드 평균 체류 기간(일) — registered_date 기준 근사값
function computeCurrentStageDays(leads: SalesLead[]): Record<string, { avgDays: number; count: number }> {
  const today = new Date()
  const byStage: Record<string, number[]> = {}
  for (const l of leads) {
    if (!l.registered_date) continue
    const days = Math.round((today.getTime() - new Date(l.registered_date).getTime()) / 86400000)
    if (!byStage[l.current_stage]) byStage[l.current_stage] = []
    byStage[l.current_stage].push(days)
  }
  const result: Record<string, { avgDays: number; count: number }> = {}
  for (const [stage, days] of Object.entries(byStage)) {
    result[stage] = {
      avgDays: Math.round(days.reduce((s, d) => s + d, 0) / days.length),
      count: days.length,
    }
  }
  return result
}

export default function SalesReports() {
  const { t } = useLang()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [allLeads, setAllLeads] = useState<SalesLead[]>([])
  const [stageHistory, setStageHistory] = useState<StageHistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<PeriodFilter>('all')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [{ data: leadData, error: le }, { data: histData }] = await Promise.all([
          supabase.from('sales_leads').select('*'),
          supabase.from('sales_stage_history').select('*').order('changed_at'),
        ])
        if (le) { showToast('데이터를 불러오는 중 오류가 발생했습니다.', 'error') }
        if (!cancelled) {
          setAllLeads((leadData || []) as SalesLead[])
          setStageHistory((histData || []) as StageHistoryRow[])
        }
      } catch (e) {
        showToast('데이터를 불러오는 중 오류가 발생했습니다.', 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  function goToLeads(filter: Record<string, string>) {
    navigate('/sales/leads', { state: { filter } })
  }

  function exportCSV() {
    const tot = leads.length
    const wonCount = leads.filter(l => l.current_stage === 'Onboarded / Won').length
    const evts = [...new Set(leads.map(l => l.event_name))]
    const ownrs = [...new Set(leads.map(l => l.owner))]
    const corridors = [...new Set(leads.map(l => l.country_corridor).filter(Boolean))]
    const rows: (string | number)[][] = [
      ['GME Sales Report', new Date().toISOString().split('T')[0]],
      ['기간', periodLabel(period, t)],
      [],
      ['[KPI 요약]'],
      ['전체 리드', tot],
      ['Contacted', leads.filter(l => l.first_contact_done).length],
      ['Proposal Sent', leads.filter(l => STAGE_ORDER.indexOf(l.current_stage) >= 3).length],
      ['Won', wonCount],
      ['전환율', tot ? `${Math.round(wonCount / tot * 100)}%` : '0%'],
      [],
      ['[Funnel 전환율]', 'Count', '%'],
      ...STAGE_ORDER.map(s => {
        const cnt = leads.filter(l => l.current_stage === s).length
        return [s, cnt, tot ? `${Math.round(cnt / tot * 100)}%` : '0%']
      }),
      [],
      ['[행사별 성과]', 'Total', 'Contacted', 'Proposal', 'Won', 'Lost'],
      ...evts.map(ev => {
        const el = leads.filter(l => l.event_name === ev)
        return [ev, el.length,
          el.filter(l => l.first_contact_done).length,
          el.filter(l => STAGE_ORDER.indexOf(l.current_stage) >= 3).length,
          el.filter(l => l.current_stage === 'Onboarded / Won').length,
          el.filter(l => l.current_stage === 'Lost').length]
      }),
      [],
      ['[국가 코리도별]', 'Total', 'Won', 'Lost'],
      ...corridors.map(c => {
        const cl = leads.filter(l => l.country_corridor === c)
        return [c, cl.length,
          cl.filter(l => l.current_stage === 'Onboarded / Won').length,
          cl.filter(l => l.current_stage === 'Lost').length]
      }),
      [],
      ['[담당자별 성과]', 'Total', 'Contacted', 'Proposal', 'Won'],
      ...ownrs.map(o => {
        const ol = leads.filter(l => l.owner === o)
        return [o, ol.length,
          ol.filter(l => l.first_contact_done).length,
          ol.filter(l => STAGE_ORDER.indexOf(l.current_stage) >= 3).length,
          ol.filter(l => l.current_stage === 'Onboarded / Won').length]
      }),
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = Object.assign(document.createElement('a'), {
      href: 'data:text/csv;charset=utf-8,﻿' + encodeURIComponent(csv),
      download: `GME_Sales_Report_${new Date().toISOString().split('T')[0]}.csv`,
    })
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  if (loading) return <div className="view wide"><LoadingSpinner /></div>

  const leads = filterByPeriod(allLeads, period)
  const total = leads.length
  const won = leads.filter(l => l.current_stage === 'Onboarded / Won').length
  const conv = total ? Math.round(won / total * 100) : 0

  const funnelRows = STAGE_ORDER.map(s => {
    const exact = leads.filter(l => l.current_stage === s).length
    const rate = total ? Math.round(exact / total * 100) : 0
    const c = STAGE_COLORS[s] || { bg: '#6B7280' }
    return { stage: s, count: exact, rate, col: c.bg }
  })

  const events = [...new Set(leads.map(l => l.event_name))]
  const owners = [...new Set(leads.map(l => l.owner))]
  const corridors = [...new Set(leads.map(l => l.country_corridor).filter(Boolean))]
  const lostLeads = leads.filter(l => l.current_stage === 'Lost' && l.lost_reason)
  const lostCounts: Record<string, number> = {}
  lostLeads.forEach(l => { if (l.lost_reason) lostCounts[l.lost_reason] = (lostCounts[l.lost_reason] || 0) + 1 })

  // 단계 전환 소요일 계산
  const avgDaysFromHistory = computeAvgDaysPerStage(stageHistory)
  const currentStageDays = computeCurrentStageDays(leads)
  const hasHistoryData = stageHistory.length > 0

  const corridorStats = corridors.map(c => {
    const cl = leads.filter(l => l.country_corridor === c)
    const cWon = cl.filter(l => l.current_stage === 'Onboarded / Won').length
    const cLost = cl.filter(l => l.current_stage === 'Lost').length
    const cActive = cl.filter(l => l.current_stage !== 'Lost' && l.current_stage !== 'Onboarded / Won').length
    return { corridor: c, total: cl.length, won: cWon, lost: cLost, active: cActive }
  }).sort((a, b) => b.total - a.total)

  const kpiCards = [
    { lbl: t('total_leads_lbl'), val: total, col: 'var(--text)', f: {} as Record<string, string> | null },
    { lbl: 'Contacted', val: leads.filter(l => l.first_contact_done).length, col: '#D97706', f: { stage: 'Contacted' } },
    { lbl: 'Proposal Sent', val: leads.filter(l => STAGE_ORDER.indexOf(l.current_stage) >= 3).length, col: '#4F46E5', f: { stage: 'Proposal Sent' } },
    { lbl: t('won_leads_lbl'), val: won, col: '#065F46', f: { stage: 'Onboarded / Won' } },
    { lbl: t('conversion_rate'), val: conv + '%', col: '#7C3AED', f: null },
  ]

  const PERIODS: PeriodFilter[] = ['all', 'month', '3months', 'year']

  return (
    <div className="view wide">
      <div className="page-hdr-row">
        <div className="sec-hdr">
          <div className="bar" />
          <div className="txt">{t('s_reports_title')}</div>
          <div className="sub">{t('s_reports_sub')}</div>
        </div>
        <div className="page-hdr-actions">
          <div className="period-filter-group" style={{ display: 'flex', flexWrap: 'wrap', background: 'white', border: '1.5px solid var(--border2)', borderRadius: 8, overflow: 'hidden', maxWidth: '100%', width: '100%' }}>
            {PERIODS.map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                style={{ padding: '6px 12px', minHeight: 44, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all .15s',
                  background: period === p ? 'var(--accent)' : 'white', color: period === p ? 'white' : 'var(--muted)' }}>
                {periodLabel(p, t)}
              </button>
            ))}
          </div>
          <button className="btn btn-outline btn-sm" onClick={exportCSV}>⬇️ {t('export_excel')}</button>
        </div>
      </div>

      {/* 기간 표시 뱃지 */}
      {period !== 'all' && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
          📅 기간 필터: {periodLabel(period, t)} — {leads.length}개 리드
        </div>
      )}

      {/* KPI 카드 5개 */}
      <div className="g5" style={{ marginBottom: 24, marginTop: 16 }}>
        {kpiCards.map((k, i) => (
          <div key={i}
            onClick={k.f ? () => goToLeads(k.f!) : undefined}
            style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, padding: '18px 20px', textAlign: 'center', cursor: k.f ? 'pointer' : 'default', transition: 'all .15s' }}
            onMouseOver={e => { if (k.f) { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,.1)' } }}
            onMouseOut={e => { if (k.f) { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = '' } }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>{k.lbl}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: k.col }}>{k.val}</div>
            {k.f && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>{t('click_to_view_leads')}</div>}
          </div>
        ))}
      </div>

      {/* 상단 2개 섹션 */}
      <div className="g2">
        {/* Funnel 전환율 */}
        <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>{t('s_funnel_report')}</div>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <tbody>
              {funnelRows.map(r => (
                <tr key={r.stage} style={{ borderBottom: '0.5px solid var(--border)', cursor: 'pointer', transition: 'background .1s' }}
                  onClick={() => goToLeads({ stage: r.stage })}
                  onMouseOver={e => (e.currentTarget as HTMLTableRowElement).style.background = '#FDF5F5'}
                  onMouseOut={e => (e.currentTarget as HTMLTableRowElement).style.background = ''}>
                  <td style={{ padding: 8 }}>
                    <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700, color: 'white', background: r.col }}>{r.stage}</span>
                  </td>
                  <td style={{ padding: 8, textAlign: 'center', fontWeight: 700 }}>{r.count}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                      <div style={{ flex: 1, minWidth: 40, background: '#EEE', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: r.col, width: `${r.rate}%` }} />
                      </div>
                      <span style={{ fontWeight: 700, color: r.col, width: 35, textAlign: 'right' }}>{r.rate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        {/* 행사별 성과 */}
        <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>{t('s_event_report')}</div>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: 7, textAlign: 'left', color: 'var(--muted)', fontWeight: 600 }}>Event</th>
                <th style={{ padding: 7, textAlign: 'center', color: 'var(--muted)', fontWeight: 600 }}>Total</th>
                <th style={{ padding: 7, textAlign: 'center', color: '#D97706', fontWeight: 600 }}>Contacted</th>
                <th style={{ padding: 7, textAlign: 'center', color: '#4F46E5', fontWeight: 600 }}>Proposal</th>
                <th style={{ padding: 7, textAlign: 'center', color: '#065F46', fontWeight: 600 }}>Won</th>
                <th style={{ padding: 7, textAlign: 'center', color: '#DC2626', fontWeight: 600 }}>Lost</th>
              </tr>
            </thead>
            <tbody>
              {events.map(ev => {
                const el = leads.filter(l => l.event_name === ev)
                return (
                  <tr key={ev} style={{ borderBottom: '0.5px solid var(--border)', cursor: 'pointer', transition: 'background .1s' }}
                    onClick={() => goToLeads({ event: ev })}
                    onMouseOver={e => (e.currentTarget as HTMLTableRowElement).style.background = '#FDF5F5'}
                    onMouseOut={e => (e.currentTarget as HTMLTableRowElement).style.background = ''}>
                    <td style={{ padding: 7, fontSize: 11, fontWeight: 600 }}>{ev.replace(/ 20\d\d$/, '')}</td>
                    <td style={{ padding: 7, textAlign: 'center', fontWeight: 700 }}>{el.length}</td>
                    <td style={{ padding: 7, textAlign: 'center', color: '#D97706', fontWeight: 600 }}>{el.filter(l => l.first_contact_done).length}</td>
                    <td style={{ padding: 7, textAlign: 'center', color: '#4F46E5', fontWeight: 600 }}>{el.filter(l => STAGE_ORDER.indexOf(l.current_stage) >= 3).length}</td>
                    <td style={{ padding: 7, textAlign: 'center', color: '#065F46', fontWeight: 700 }}>{el.filter(l => l.current_stage === 'Onboarded / Won').length}</td>
                    <td style={{ padding: 7, textAlign: 'center', color: '#DC2626', fontWeight: 600 }}>{el.filter(l => l.current_stage === 'Lost').length}</td>
                  </tr>
                )
              })}
              {events.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 20 }}>{t('no_report_data')}</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* 단계 전환 소요일 분석 */}
      <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>⏱ {t('s_stage_duration')}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
            {hasHistoryData ? t('s_stage_duration_real') : t('s_stage_duration_approx')}
          </div>
          {!hasHistoryData && (
            <span style={{ display: 'inline-block', marginTop: 8, fontSize: 11, background: '#FFF8F0', color: '#D97706', border: '1px solid #FDE68A', borderRadius: 99, padding: '3px 10px', fontWeight: 600 }}>
              📌 {t('s_stage_duration_notice')}
            </span>
          )}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--accent)', color: 'white' }}>
                <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600 }}>Stage</th>
                <th style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 600 }}>{t('s_stage_leads_cnt')}</th>
                <th style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 600 }}>
                  {hasHistoryData ? t('s_avg_days_real') : t('s_avg_days_approx')}
                </th>
                <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600 }}>{t('s_stage_bar')}</th>
              </tr>
            </thead>
            <tbody>
              {STAGE_ORDER.map(stage => {
                const c = STAGE_COLORS[stage] || { bg: '#6B7280' }
                const hist = avgDaysFromHistory[stage]
                const cur = currentStageDays[stage]
                const days = hasHistoryData ? hist?.avgDays : cur?.avgDays
                const count = cur?.count || 0
                const maxDays = hasHistoryData
                  ? Math.max(...Object.values(avgDaysFromHistory).map(v => v.avgDays), 1)
                  : Math.max(...Object.values(currentStageDays).map(v => v.avgDays), 1)
                const pct = days != null ? Math.min(Math.round(days / maxDays * 100), 100) : 0
                return (
                  <tr key={stage} style={{ borderBottom: '0.5px solid var(--border)' }}>
                    <td style={{ padding: '9px 14px', width: 180 }}>
                      <span style={{ display: 'block', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, color: 'white', background: c.bg, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stage}</span>
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 700, color: c.bg }}>{count || '—'}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 700, color: days != null && days > 30 ? '#DC2626' : days != null && days > 14 ? '#D97706' : 'var(--text)' }}>
                      {days != null ? `${days}일` : '—'}
                      {hasHistoryData && hist && <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 400 }}>n={hist.sampleCount}</div>}
                    </td>
                    <td style={{ padding: '9px 14px' }}>
                      <div style={{ height: 8, background: '#EEE', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: c.bg, width: `${pct}%`, borderRadius: 4, transition: 'width .3s' }} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 하단 3개 섹션 */}
      <div className="g3">
        {/* 국가 코리도별 분석 */}
        <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>🌏 {t('s_corridor_report')}</div>
          {corridorStats.length === 0
            ? <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>{t('no_report_data')}</div>
            : <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}><table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '6px 7px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600 }}>Corridor</th>
                    <th style={{ padding: '6px 7px', textAlign: 'center', color: 'var(--muted)', fontWeight: 600 }}>Total</th>
                    <th style={{ padding: '6px 7px', textAlign: 'center', color: '#4F46E5', fontWeight: 600 }}>Active</th>
                    <th style={{ padding: '6px 7px', textAlign: 'center', color: '#065F46', fontWeight: 600 }}>Won</th>
                    <th style={{ padding: '6px 7px', textAlign: 'center', color: '#DC2626', fontWeight: 600 }}>Lost</th>
                  </tr>
                </thead>
                <tbody>
                  {corridorStats.map(c => (
                    <tr key={c.corridor}
                      style={{ borderBottom: '0.5px solid var(--border)', cursor: 'pointer', transition: 'background .1s' }}
                      onClick={() => goToLeads({ corridor: c.corridor })}
                      onMouseOver={e => (e.currentTarget as HTMLTableRowElement).style.background = '#FDF5F5'}
                      onMouseOut={e => (e.currentTarget as HTMLTableRowElement).style.background = ''}>
                      <td style={{ padding: '7px', fontSize: 11, fontWeight: 600, maxWidth: '30vw', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.corridor}>{c.corridor}</td>
                      <td style={{ padding: '7px', textAlign: 'center', fontWeight: 700 }}>{c.total}</td>
                      <td style={{ padding: '7px', textAlign: 'center', color: '#4F46E5', fontWeight: 600 }}>{c.active}</td>
                      <td style={{ padding: '7px', textAlign: 'center', color: '#065F46', fontWeight: 700 }}>{c.won}</td>
                      <td style={{ padding: '7px', textAlign: 'center', color: '#DC2626', fontWeight: 600 }}>{c.lost}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
          }
        </div>

        {/* Lost Reason 분석 */}
        <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>{t('s_lost_report')}</div>
          {Object.keys(lostCounts).length === 0
            ? <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>{t('no_report_data')}</div>
            : Object.entries(lostCounts).sort(([, a], [, b]) => b - a).map(([r, c]) => (
              <div key={r}
                onClick={() => goToLeads({ stage: 'Lost', lostReason: r })}
                style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, cursor: 'pointer', padding: '6px 8px', borderRadius: 7, transition: 'background .1s' }}
                onMouseOver={e => (e.currentTarget as HTMLDivElement).style.background = '#FEF2F2'}
                onMouseOut={e => (e.currentTarget as HTMLDivElement).style.background = ''}>
                <div style={{ flex: 1, fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r}</div>
                <div style={{ width: 80, background: '#EEE', borderRadius: 3, height: 8, overflow: 'hidden', flexShrink: 0 }}>
                  <div style={{ height: '100%', background: '#DC2626', width: `${Math.round(c / lostLeads.length * 100)}%` }} />
                </div>
                <span style={{ fontWeight: 700, color: '#DC2626', width: 20, textAlign: 'right', flexShrink: 0 }}>{c}</span>
              </div>
            ))
          }
        </div>

        {/* 담당자별 성과 */}
        <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>
            {t('s_owner_report')}
            <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted)', marginLeft: 8 }}>{t('name_click_hint')}</span>
          </div>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '8px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600 }}>Owner</th>
                <th style={{ padding: '8px', textAlign: 'center', color: 'var(--muted)', fontWeight: 600 }}>Total</th>
                <th style={{ padding: '8px', textAlign: 'center', color: '#D97706', fontWeight: 600 }}>Contacted</th>
                <th style={{ padding: '8px', textAlign: 'center', color: '#4F46E5', fontWeight: 600 }}>Proposal</th>
                <th style={{ padding: '8px', textAlign: 'center', color: '#065F46', fontWeight: 600 }}>Won</th>
              </tr>
            </thead>
            <tbody>
              {owners.map(o => {
                const ol = leads.filter(l => l.owner === o)
                return (
                  <tr key={o} style={{ borderBottom: '0.5px solid var(--border)' }}>
                    <td style={{ padding: '9px 8px', maxWidth: '30vw', overflow: 'hidden' }}>
                      <button onClick={() => goToLeads({ owner: o })}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--accent)', textDecoration: 'underline', padding: 0, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                        {o}
                      </button>
                    </td>
                    <td style={{ padding: '9px 8px', textAlign: 'center' }}>{ol.length}</td>
                    <td style={{ padding: '9px 8px', textAlign: 'center', color: '#D97706', fontWeight: 600 }}>{ol.filter(l => l.first_contact_done).length}</td>
                    <td style={{ padding: '9px 8px', textAlign: 'center', color: '#4F46E5', fontWeight: 600 }}>{ol.filter(l => STAGE_ORDER.indexOf(l.current_stage) >= 3).length}</td>
                    <td style={{ padding: '9px 8px', textAlign: 'center', color: '#065F46', fontWeight: 700 }}>{ol.filter(l => l.current_stage === 'Onboarded / Won').length}</td>
                  </tr>
                )
              })}
              {owners.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 20 }}>{t('no_report_data')}</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </div>
  )
}
