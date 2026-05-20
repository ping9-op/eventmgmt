import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { STAGE_ORDER, STAGE_COLORS } from '../../lib/utils'
import type { SalesLead } from '../../types/database'
import { useLang } from '../../contexts/LangContext'

export default function SalesReports() {
  const { t } = useLang()
  const navigate = useNavigate()
  const [leads, setLeads] = useState<SalesLead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('sales_leads').select('*').then(({ data }) => {
      setLeads((data || []) as SalesLead[])
      setLoading(false)
    })
  }, [])

  function goToLeads(filter: Record<string, string>) {
    navigate('/sales/leads', { state: { filter } })
  }

  if (loading) return <div className="view wide"><div style={{ color: 'var(--muted)', padding: 40 }}>{t('loading')}</div></div>

  const total = leads.length
  const won = leads.filter(l => l.current_stage === 'Onboarded / Won').length
  const conv = total ? Math.round(won / total * 100) : 0

  const funnelRows = STAGE_ORDER.map((s, i) => {
    const exact = leads.filter(l => l.current_stage === s).length
    const rate = total ? Math.round(exact / total * 100) : 0
    const c = STAGE_COLORS[s] || { bg: '#6B7280' }
    return { stage: s, count: exact, rate, col: c.bg }
  })

  const events = [...new Set(leads.map(l => l.event_name))]
  const owners = [...new Set(leads.map(l => l.owner))]
  const lostLeads = leads.filter(l => l.current_stage === 'Lost' && l.lost_reason)
  const lostCounts: Record<string, number> = {}
  lostLeads.forEach(l => { if (l.lost_reason) lostCounts[l.lost_reason] = (lostCounts[l.lost_reason] || 0) + 1 })

  const kpiCards = [
    { lbl: t('total_leads_lbl'), val: total, col: 'var(--text)', f: {} as Record<string, string> | null },
    { lbl: 'Contacted', val: leads.filter(l => l.first_contact_done).length, col: '#D97706', f: { stage: 'Contacted' } },
    { lbl: 'Proposal Sent', val: leads.filter(l => STAGE_ORDER.indexOf(l.current_stage) >= 3).length, col: '#4F46E5', f: { stage: 'Proposal Sent' } },
    { lbl: t('won_leads_lbl'), val: won, col: '#065F46', f: { stage: 'Onboarded / Won' } },
    { lbl: t('conversion_rate'), val: conv + '%', col: '#7C3AED', f: null },
  ]

  return (
    <div className="view wide">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="sec-hdr" style={{ margin: 0 }}>
          <div className="bar" />
          <div className="txt">{t('s_reports_title')}</div>
          <div className="sub">{t('s_reports_sub')}</div>
        </div>
        <button className="btn btn-outline btn-sm">⬇️ {t('export_excel')}</button>
      </div>

      {/* KPI 카드 5개 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 24, marginTop: 16 }}>
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

      {/* 4섹션 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Funnel 전환율 */}
        <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>{t('s_funnel_report')}</div>
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
                      <div style={{ width: 60, background: '#EEE', borderRadius: 3, height: 6, overflow: 'hidden' }}>
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

        {/* 행사별 성과 */}
        <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>{t('s_event_report')}</div>
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

        {/* Lost Reason 분석 */}
        <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>{t('s_lost_report')}</div>
          {Object.keys(lostCounts).length === 0
            ? <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>{t('no_report_data')}</div>
            : Object.entries(lostCounts).map(([r, c]) => (
              <div key={r}
                onClick={() => goToLeads({ stage: 'Lost', lostReason: r })}
                style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, cursor: 'pointer', padding: '6px 8px', borderRadius: 7, transition: 'background .1s' }}
                onMouseOver={e => (e.currentTarget as HTMLDivElement).style.background = '#FEF2F2'}
                onMouseOut={e => (e.currentTarget as HTMLDivElement).style.background = ''}>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{r}</div>
                <div style={{ width: 80, background: '#EEE', borderRadius: 3, height: 8, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: '#DC2626', width: `${Math.round(c / lostLeads.length * 100)}%` }} />
                </div>
                <span style={{ fontWeight: 700, color: '#DC2626', width: 20 }}>{c}</span>
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
                    <td style={{ padding: '9px 8px' }}>
                      <button onClick={() => goToLeads({ owner: o })}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--accent)', textDecoration: 'underline', padding: 0 }}>
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
  )
}
