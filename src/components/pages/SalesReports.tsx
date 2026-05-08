import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { STAGE_ORDER, STAGE_COLORS, priorityColor } from '../../lib/utils'
import type { SalesLead, SalesActivity } from '../../types/database'

const OWNERS = ['Andrew', 'Jacey', 'Violet', 'John']

function HBar({ value, max, color, width = 60 }: { value: number; max: number; color: string; width?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
      <div style={{ width, background: '#EEE', borderRadius: 3, height: 6, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: color, width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
      </div>
      <span style={{ fontWeight: 700, color, width: 35, textAlign: 'right' }}>
        {max > 0 ? Math.round(value / max * 100) : 0}%
      </span>
    </div>
  )
}

export default function SalesReports() {
  const navigate = useNavigate()
  const [leads, setLeads] = useState<SalesLead[]>([])
  const [activities, setActivities] = useState<SalesActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'30' | '90' | 'all'>('all')

  useEffect(() => {
    async function load() {
      const [{ data: leadData }, { data: actData }] = await Promise.all([
        supabase.from('sales_leads').select('*'),
        supabase.from('sales_activities').select('*'),
      ])
      setLeads((leadData || []) as SalesLead[])
      setActivities((actData || []) as SalesActivity[])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="view wide"><div style={{ color: 'var(--muted)', padding: 40 }}>로딩 중...</div></div>

  const today = new Date()
  const cutoff = period === '30'
    ? new Date(today.getTime() - 30 * 86400000).toISOString().split('T')[0]
    : period === '90'
    ? new Date(today.getTime() - 90 * 86400000).toISOString().split('T')[0]
    : '2000-01-01'

  const fl = leads.filter(l => l.registered_date >= cutoff)
  const total = fl.length
  const won = fl.filter(l => l.current_stage === 'Onboarded / Won').length
  const lost = fl.filter(l => l.current_stage === 'Lost').length
  const active = total - won - lost
  const contacted = fl.filter(l => l.first_contact_done).length
  const proposalReached = fl.filter(l => ['Proposal Sent', 'Negotiation', 'Onboarding', 'Onboarded / Won'].includes(l.current_stage)).length
  const convRate = total ? Math.round(won / total * 100) : 0
  const totalPipeline = fl.reduce((s, l) => s + (l.expected_monthly_volume || 0), 0)

  // Funnel 전환율
  const funnelRows = STAGE_ORDER.map(s => ({
    stage: s, count: fl.filter(l => l.current_stage === s).length,
    col: STAGE_COLORS[s]?.bg || '#6B7280'
  }))

  // 행사별 성과
  const events = [...new Set(fl.map(l => l.event_name).filter(Boolean))].sort()

  // Lost Reason
  const lostLeads = fl.filter(l => l.current_stage === 'Lost' && l.lost_reason)
  const lostCounts: Record<string, number> = {}
  for (const l of lostLeads) lostCounts[l.lost_reason!] = (lostCounts[l.lost_reason!] || 0) + 1
  const maxLost = Math.max(...Object.values(lostCounts), 1)

  // 담당자별 성과
  const ownerRows = OWNERS.map(o => {
    const ol = fl.filter(l => l.owner === o)
    return {
      owner: o, total: ol.length,
      contacted: ol.filter(l => l.first_contact_done).length,
      proposal: ol.filter(l => ['Proposal Sent', 'Negotiation', 'Onboarding', 'Onboarded / Won'].includes(l.current_stage)).length,
      won: ol.filter(l => l.current_stage === 'Onboarded / Won').length,
    }
  }).filter(o => o.total > 0)

  // Source breakdown
  const sourceCount: Record<string, number> = {}
  for (const l of fl) sourceCount[l.lead_source] = (sourceCount[l.lead_source] || 0) + 1
  const maxSrc = Math.max(...Object.values(sourceCount), 1)

  return (
    <div className="view wide">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="sec-hdr" style={{ margin: 0 }}>
          <div className="bar" />
          <div className="txt">Sales 리포트</div>
          <div className="sub">영업 성과 분석</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'var(--light)', borderRadius: 8, padding: 3, gap: 2 }}>
            {([['30', '30일'], ['90', '90일'], ['all', '전체']] as const).map(([v, lbl]) => (
              <button key={v} onClick={() => setPeriod(v)} style={{
                padding: '6px 16px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                border: 'none', cursor: 'pointer',
                background: period === v ? 'var(--accent)' : 'transparent',
                color: period === v ? 'white' : 'var(--muted)',
              }}>{lbl}</button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI 5칸 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { lbl: 'Total', val: total, col: 'var(--text)', click: '/sales/leads' },
          { lbl: 'Contacted', val: contacted, col: '#D97706', click: '/sales/leads' },
          { lbl: 'Proposal Sent', val: proposalReached, col: '#4F46E5', click: '/sales/funnel' },
          { lbl: 'Onboarded/Won', val: won, col: '#065F46', click: '/sales/leads' },
          { lbl: '전환율', val: convRate + '%', col: '#7C3AED', click: null as string | null },
        ].map((k, i) => (
          <div key={i} onClick={k.click ? () => navigate(k.click!) : undefined}
            style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, padding: '18px 20px', textAlign: 'center', cursor: k.click ? 'pointer' : 'default', transition: 'all .15s' }}
            onMouseOver={k.click ? ev => { (ev.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (ev.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,.1)' } : undefined}
            onMouseOut={k.click ? ev => { (ev.currentTarget as HTMLDivElement).style.transform = ''; (ev.currentTarget as HTMLDivElement).style.boxShadow = '' } : undefined}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>{k.lbl}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: k.col }}>{k.val}</div>
            {k.click && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>클릭하여 리드 보기 →</div>}
          </div>
        ))}
      </div>

      {/* 2×2 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Funnel 전환율 */}
        <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Funnel 전환율</div>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <tbody>
              {funnelRows.map(r => (
                <tr key={r.stage} style={{ borderBottom: '0.5px solid var(--border)', cursor: 'pointer' }}
                  onClick={() => navigate('/sales/leads')}
                  onMouseOver={ev => (ev.currentTarget as HTMLTableRowElement).style.background = '#FDF5F5'}
                  onMouseOut={ev => (ev.currentTarget as HTMLTableRowElement).style.background = ''}>
                  <td style={{ padding: 8 }}>
                    <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700, color: 'white', background: r.col }}>{r.stage}</span>
                  </td>
                  <td style={{ padding: 8, textAlign: 'center', fontWeight: 700 }}>{r.count}</td>
                  <td style={{ padding: 8 }}>
                    <HBar value={r.count} max={total} color={r.col} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 행사별 성과 */}
        <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>행사별 성과</div>
          {events.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>이벤트 데이터 없음</div>
          ) : (
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '7px', textAlign: 'left', color: 'var(--muted)', fontWeight: 500 }}>Event</th>
                  <th style={{ padding: '7px', textAlign: 'center', color: 'var(--muted)', fontWeight: 500 }}>Total</th>
                  <th style={{ padding: '7px', textAlign: 'center', color: '#D97706', fontWeight: 500 }}>Contacted</th>
                  <th style={{ padding: '7px', textAlign: 'center', color: '#4F46E5', fontWeight: 500 }}>Proposal</th>
                  <th style={{ padding: '7px', textAlign: 'center', color: '#065F46', fontWeight: 500 }}>Won</th>
                  <th style={{ padding: '7px', textAlign: 'center', color: '#DC2626', fontWeight: 500 }}>Lost</th>
                </tr>
              </thead>
              <tbody>
                {events.map(ev => {
                  const el = fl.filter(l => l.event_name === ev)
                  return (
                    <tr key={ev} style={{ borderBottom: '0.5px solid var(--border)', cursor: 'pointer', transition: 'background .1s' }}
                      onMouseOver={e => (e.currentTarget as HTMLTableRowElement).style.background = '#FDF5F5'}
                      onMouseOut={e => (e.currentTarget as HTMLTableRowElement).style.background = ''}>
                      <td style={{ padding: 7, fontWeight: 600 }}>{ev}</td>
                      <td style={{ padding: 7, textAlign: 'center', fontWeight: 700 }}>{el.length}</td>
                      <td style={{ padding: 7, textAlign: 'center', color: '#D97706', fontWeight: 600 }}>{el.filter(l => l.first_contact_done).length}</td>
                      <td style={{ padding: 7, textAlign: 'center', color: '#4F46E5', fontWeight: 600 }}>{el.filter(l => ['Proposal Sent', 'Negotiation', 'Onboarding', 'Onboarded / Won'].includes(l.current_stage)).length}</td>
                      <td style={{ padding: 7, textAlign: 'center', color: '#065F46', fontWeight: 700 }}>{el.filter(l => l.current_stage === 'Onboarded / Won').length}</td>
                      <td style={{ padding: 7, textAlign: 'center', color: '#DC2626', fontWeight: 600 }}>{el.filter(l => l.current_stage === 'Lost').length}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Lost Reason 분석 */}
        <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Lost Reason 분석</div>
          {Object.keys(lostCounts).length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>Lost 리드 없음</div>
          ) : (
            Object.entries(lostCounts).sort((a, b) => b[1] - a[1]).map(([reason, cnt]) => (
              <div key={reason} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, cursor: 'pointer', padding: '6px 8px', borderRadius: 7, transition: 'background .1s' }}
                onMouseOver={ev => (ev.currentTarget as HTMLDivElement).style.background = '#FEF2F2'}
                onMouseOut={ev => (ev.currentTarget as HTMLDivElement).style.background = ''}>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{reason}</div>
                <div style={{ width: 80, background: '#EEE', borderRadius: 3, height: 8, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: '#DC2626', width: `${Math.round(cnt / lostLeads.length * 100)}%` }} />
                </div>
                <span style={{ fontWeight: 700, color: '#DC2626', width: 20, textAlign: 'right' }}>{cnt}</span>
              </div>
            ))
          )}
          {/* Lead Source */}
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '0.5px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Lead 소스 분포</div>
            {Object.entries(sourceCount).sort((a, b) => b[1] - a[1]).map(([src, cnt]) => (
              <div key={src} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                <span style={{ width: 100, fontSize: 12 }}>{src}</span>
                <div style={{ flex: 1, height: 8, background: '#EEE', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${cnt / maxSrc * 100}%`, height: '100%', background: 'var(--accent)' }} />
                </div>
                <span style={{ width: 24, textAlign: 'right', fontSize: 12, fontWeight: 700 }}>{cnt}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 담당자별 성과 */}
        <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>
            담당자별 성과
            <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted)', marginLeft: 8 }}>기간: {period === 'all' ? '전체' : `최근 ${period}일`}</span>
          </div>
          {ownerRows.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>데이터 없음</div>
          ) : (
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '8px', textAlign: 'left', color: 'var(--muted)', fontWeight: 500 }}>Owner</th>
                  <th style={{ padding: '8px', textAlign: 'center', color: 'var(--muted)', fontWeight: 500 }}>Total</th>
                  <th style={{ padding: '8px', textAlign: 'center', color: '#D97706', fontWeight: 500 }}>Contacted</th>
                  <th style={{ padding: '8px', textAlign: 'center', color: '#4F46E5', fontWeight: 500 }}>Proposal</th>
                  <th style={{ padding: '8px', textAlign: 'center', color: '#065F46', fontWeight: 500 }}>Won</th>
                  <th style={{ padding: '8px', textAlign: 'right', color: 'var(--muted)', fontWeight: 500 }}>전환율</th>
                </tr>
              </thead>
              <tbody>
                {ownerRows.map(o => (
                  <tr key={o.owner} style={{ borderBottom: '0.5px solid var(--border)' }}>
                    <td style={{ padding: '9px 8px', fontWeight: 700 }}>{o.owner}</td>
                    <td style={{ padding: '9px 8px', textAlign: 'center' }}>{o.total}</td>
                    <td style={{ padding: '9px 8px', textAlign: 'center', color: '#D97706', fontWeight: 600 }}>{o.contacted}</td>
                    <td style={{ padding: '9px 8px', textAlign: 'center', color: '#4F46E5', fontWeight: 600 }}>{o.proposal}</td>
                    <td style={{ padding: '9px 8px', textAlign: 'center', color: '#065F46', fontWeight: 700 }}>{o.won}</td>
                    <td style={{ padding: '9px 8px', textAlign: 'right', fontWeight: 700, color: '#7C3AED' }}>
                      {o.total ? Math.round(o.won / o.total * 100) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* 전환율 요약 바 */}
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '0.5px solid var(--border)' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>전체 전환율 현황</div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              {[
                { lbl: 'Won', cnt: won, color: '#065F46' },
                { lbl: '진행 중', cnt: active, color: 'var(--accent)' },
                { lbl: 'Lost', cnt: lost, color: '#636363' },
              ].map(item => (
                <div key={item.lbl} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: item.color }}>{item.cnt}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{item.lbl}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: item.color }}>
                    {total > 0 ? Math.round(item.cnt / total * 100) : 0}%
                  </div>
                </div>
              ))}
              <div style={{ flex: 1, height: 16, background: 'var(--light)', borderRadius: 8, overflow: 'hidden', display: 'flex' }}>
                {total > 0 && (
                  <>
                    <div style={{ width: `${won / total * 100}%`, background: '#065F46', height: '100%' }} />
                    <div style={{ width: `${active / total * 100}%`, background: 'var(--accent)', height: '100%' }} />
                    <div style={{ width: `${lost / total * 100}%`, background: '#636363', height: '100%' }} />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
