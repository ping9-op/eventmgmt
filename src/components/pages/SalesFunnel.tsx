import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { STAGE_ORDER, STAGE_COLORS, priorityColor } from '../../lib/utils'
import type { SalesLead, SalesProposal } from '../../types/database'
import { loadSalesSettings } from '../../lib/settings'
import LeadDetailPanel from './LeadDetailPanel'

type TabType = 'board' | 'table' | 'proposal'

const CONTRACT_STATUSES = ['Not Sent', 'Sent', 'Under Review', 'Revision Requested', 'Signed', 'Rejected']
const ONBOARD_STATUSES = ['Not Started', 'Waiting Docs', 'Under Review', 'Approved', 'Rejected', 'Completed']

const KPI_CARDS = [
  { lbl: 'Total', stage: null as string | null, col: 'var(--text)' },
  { lbl: 'New Lead', stage: 'New Lead', col: '#6B7280' },
  { lbl: 'Contacted', stage: 'Contacted', col: '#D97706' },
  { lbl: 'Proposal', stage: 'Proposal Sent', col: '#4F46E5' },
  { lbl: 'Onboarding', stage: 'Onboarding', col: '#059669' },
  { lbl: 'Won ✅', stage: 'Onboarded / Won', col: '#065F46' },
  { lbl: 'Lost', stage: 'Lost', col: '#DC2626' },
  { lbl: '전환율', stage: '__conv__', col: '#7C3AED' },
]

function PriorityBadge({ p }: { p: string }) {
  const col = p === 'High' ? '#DC2626' : p === 'Medium' ? '#D97706' : '#6B7280'
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, color: 'white', background: col }}>{p}</span>
}

export default function SalesFunnel() {
  const location = useLocation()
  const { owners: OWNERS } = loadSalesSettings()
  const [leads, setLeads] = useState<SalesLead[]>([])
  const [proposals, setProposals] = useState<SalesProposal[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabType>('board')
  const [filterOwner, setFilterOwner] = useState('')
  const [filterStage, setFilterStage] = useState<string | null>(null)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())

  useEffect(() => {
    const state = (location.state as any)
    if (state?.filter) {
      if (state.filter !== null) setFilterStage(state.filter)
    }
    if (state?.view) setTab(state.view as TabType)
    load()
  }, [])

  async function load() {
    const [{ data: leadData }, { data: propData }] = await Promise.all([
      supabase.from('sales_leads').select('*'),
      supabase.from('sales_proposals').select('*'),
    ])
    setLeads((leadData || []) as SalesLead[])
    setProposals((propData || []) as SalesProposal[])
    setLoading(false)
  }

  async function moveStage(leadId: string, stage: string) {
    await supabase.from('sales_leads').update({ current_stage: stage }).eq('id', leadId)
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, current_stage: stage } : l))
  }

  async function updatePropField(propId: string, field: string, value: string) {
    await supabase.from('sales_proposals').update({ [field]: value } as never).eq('id', propId)
    setProposals(prev => prev.map(p => p.id === propId ? { ...p, [field]: value } : p))
  }

  function toggleCheck(id: string, all?: string[]) {
    if (all) {
      const allChecked = all.every(i => checked.has(i))
      setChecked(prev => { const n = new Set(prev); all.forEach(i => allChecked ? n.delete(i) : n.add(i)); return n })
    } else {
      setChecked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    }
  }

  function exportCSV() {
    const toExport = checked.size > 0 ? leads.filter(l => checked.has(l.id)) : leads
    const H = ['Company', 'Contact', 'Stage', 'Owner', 'Volume', 'Priority', 'Last Contact', 'Next Follow-up']
    const rows = toExport.map(l => [l.company_name, l.contact_person, l.current_stage, l.owner, `${l.volume_currency} ${l.expected_monthly_volume || 0}`, l.priority, l.last_contact_date || '', l.next_follow_up_date || ''])
    const csv = [H, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = Object.assign(document.createElement('a'), { href: 'data:text/csv;charset=utf-8,﻿' + encodeURIComponent(csv), download: `GME_Funnel_${new Date().toISOString().split('T')[0]}.csv` })
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setChecked(new Set())
  }

  if (loading) return <div className="view wide"><div style={{ color: 'var(--muted)', padding: 40 }}>로딩 중...</div></div>

  const total = leads.length
  const byS = (s: string) => leads.filter(l => l.current_stage === s).length
  const won = byS('Onboarded / Won')
  const conv = total ? Math.round(won / total * 100) : 0

  function kpiVal(k: typeof KPI_CARDS[0]): string | number {
    if (k.stage === null) return total
    if (k.stage === '__conv__') return conv + '%'
    return byS(k.stage)
  }

  const baseFiltered = filterOwner ? leads.filter(l => l.owner === filterOwner) : leads
  const filtered = filterStage
    ? filterStage === '__active__'
      ? baseFiltered.filter(l => l.current_stage !== 'Lost' && l.current_stage !== 'Onboarded / Won')
      : baseFiltered.filter(l => l.current_stage === filterStage)
    : baseFiltered

  const allIds = filtered.map(l => l.id)

  const tabs: { id: TabType; label: string }[] = [
    { id: 'board', label: '📋 Board View' },
    { id: 'table', label: '📊 Table View' },
    { id: 'proposal', label: '📄 Proposal & Contract' },
  ]

  return (
    <div className="view wide">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="sec-hdr" style={{ margin: 0 }}>
          <div className="bar" />
          <div className="txt">Sales Funnel</div>
          <div className="sub">Lead 영업 단계 관리</div>
        </div>
        <select value={filterOwner} onChange={e => setFilterOwner(e.target.value)} style={{ width: 130 }}>
          <option value="">전체 담당자</option>
          {OWNERS.map(o => <option key={o}>{o}</option>)}
        </select>
      </div>

      {/* 탭 바 (프로토타입 스타일 - 언더라인) */}
      <div style={{ display: 'flex', background: '#F5F0F0', borderBottom: '1px solid var(--border2)', padding: '0 0', gap: 0, marginTop: 12 }}>
        {tabs.map(t => (
          <div key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '13px 22px', fontSize: 13,
              fontWeight: tab === t.id ? 700 : 500,
              cursor: 'pointer',
              color: tab === t.id ? 'var(--accent)' : 'var(--muted)',
              borderBottom: tab === t.id ? '3px solid var(--accent)' : '3px solid transparent',
              marginBottom: -1, transition: 'all .15s', whiteSpace: 'nowrap',
            }}>
            {t.label}
          </div>
        ))}
      </div>

      <div style={{ paddingTop: 16 }}>
        {/* KPI 카드 8개 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gap: 10, marginBottom: 14 }}>
          {KPI_CARDS.map(k => {
            const active = k.stage !== null && k.stage !== '__conv__' && filterStage === k.stage
            const clickable = k.stage !== null && k.stage !== '__conv__'
            return (
              <div key={k.lbl}
                onClick={clickable ? () => setFilterStage(filterStage === k.stage ? null : k.stage) : undefined}
                style={{
                  background: active ? k.col : 'white',
                  border: `2px solid ${active ? k.col : 'var(--border2)'}`,
                  borderRadius: 10, padding: '11px 8px', textAlign: 'center',
                  cursor: clickable ? 'pointer' : 'default', transition: 'all .15s', userSelect: 'none',
                }}
                onMouseOver={e => { if (clickable) { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,.1)' } }}
                onMouseOut={e => { if (clickable) { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = '' } }}
              >
                <div style={{ fontSize: 10, color: active ? 'rgba(255,255,255,.8)' : 'var(--muted)', marginBottom: 3 }}>{k.lbl}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: active ? 'white' : k.col }}>{kpiVal(k)}</div>
              </div>
            )
          })}
        </div>

        {/* 필터 표시 */}
        {filterStage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, background: '#FFF8F0', border: '1px solid #FDE68A', borderRadius: 8, padding: '7px 14px' }}>
            <span style={{ fontSize: 13 }}>🔍 <strong>{filterStage === '__active__' ? '진행 중인 영업 건' : filterStage}</strong> 필터 중 ({filtered.length}개)</span>
            <button onClick={() => setFilterStage(null)} style={{ padding: '3px 10px', borderRadius: 5, background: 'white', border: '1px solid var(--border2)', fontSize: 12, cursor: 'pointer', marginLeft: 'auto' }}>✕ 전체 보기</button>
          </div>
        )}

        {/* 보드 뷰 */}
        {tab === 'board' && (
          <div style={{ overflowX: 'auto', paddingBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12, minWidth: 'max-content' }}>
              {STAGE_ORDER.map(stage => {
                const c = STAGE_COLORS[stage] || { bg: '#6B7280', light: '#F3F4F6' }
                const stageLeads = filtered.filter(l => l.current_stage === stage)
                return (
                  <div key={stage} style={{ width: 210, flexShrink: 0 }}>
                    <div style={{ background: c.bg, color: 'white', padding: '9px 12px', borderRadius: '10px 10px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700 }}>{stage}</span>
                      <span style={{ background: 'rgba(255,255,255,.25)', borderRadius: 99, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{stageLeads.length}</span>
                    </div>
                    <div style={{ background: '#F8F4F4', border: `1px solid ${c.bg}40`, borderTop: 'none', borderRadius: '0 0 10px 10px', minHeight: 160, padding: 8, display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {stageLeads.map(l => (
                        <div key={l.id}
                          style={{ background: 'white', borderRadius: 8, padding: 10, border: '0.5px solid var(--border2)', cursor: 'pointer', transition: 'box-shadow .15s,transform .15s' }}
                          onClick={() => setSelectedLeadId(l.id)}
                          onMouseOver={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 14px rgba(0,0,0,.12)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)' }}
                          onMouseOut={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = ''; (e.currentTarget as HTMLDivElement).style.transform = '' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{l.company_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{l.contact_person} · {l.owner}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>{l.event_name.replace(/ 20\d\d$/, '')}</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>
                            {l.volume_currency === 'KRW' ? `₩${(l.expected_monthly_volume || 0).toLocaleString()}` : `$${(l.expected_monthly_volume || 0).toLocaleString()}`}
                          </div>
                          {l.next_action && <div style={{ fontSize: 10, color: '#4F46E5', marginBottom: 6 }}>→ {l.next_action}</div>}
                          <div onClick={e => e.stopPropagation()}>
                            <select value={stage} onChange={e => { e.stopPropagation(); moveStage(l.id, e.target.value) }} onClick={e => e.stopPropagation()}
                              style={{ width: '100%', fontSize: 11, padding: '3px 5px', border: '1px solid var(--border2)', borderRadius: 5, background: c.light, cursor: 'pointer' }}>
                              {STAGE_ORDER.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                        </div>
                      ))}
                      {stageLeads.length === 0 && <div style={{ textAlign: 'center', color: `${c.bg}50`, fontSize: 11, padding: 16 }}>—</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 테이블 뷰 */}
        {tab === 'table' && (
          <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="text" placeholder="🔍 Company, Contact 검색..." style={{ flex: 1, padding: '7px 12px', border: '1px solid var(--border2)', borderRadius: 7, fontSize: 13 }}
                onChange={e => {
                  const q = e.target.value.toLowerCase()
                  document.querySelectorAll('#funnel-tbl tbody tr').forEach((tr) => {
                    (tr as HTMLElement).style.display = (tr.textContent || '').toLowerCase().includes(q) ? '' : 'none'
                  })
                }} />
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{filtered.length}개</span>
            </div>
            {/* 액션 바 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--border)', background: '#FAFAFA' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer', userSelect: 'none' }}>
                <input type="checkbox" checked={allIds.length > 0 && allIds.every(i => checked.has(i))} onChange={() => toggleCheck('', allIds)} style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                전체 선택
              </label>
              <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, minWidth: 70 }}>{checked.size > 0 ? `${checked.size}개 선택됨` : ''}</span>
              <div style={{ marginLeft: 'auto' }}>
                <button onClick={exportCSV} style={{ padding: '6px 14px', borderRadius: 7, background: 'white', border: '1.5px solid #059669', color: '#059669', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>⬇️ Excel 내보내기</button>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table id="funnel-tbl" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 1050 }}>
                <thead>
                  <tr style={{ background: 'var(--accent)', color: 'white' }}>
                    <th style={{ padding: '9px 10px', width: 38 }}><input type="checkbox" style={{ width: 15, height: 15, cursor: 'pointer' }} /></th>
                    <th style={{ padding: '9px 12px', textAlign: 'left' }}>Company</th>
                    <th style={{ padding: '9px 12px' }}>Event</th>
                    <th style={{ padding: '9px 12px' }}>Owner</th>
                    <th style={{ padding: '9px 12px' }}>1st</th>
                    <th style={{ padding: '9px 12px' }}>Stage</th>
                    <th style={{ padding: '9px 12px' }}>Last Contact</th>
                    <th style={{ padding: '9px 12px' }}>Follow-up</th>
                    <th style={{ padding: '9px 12px', textAlign: 'right' }}>Volume</th>
                    <th style={{ padding: '9px 12px' }}>Priority</th>
                    <th style={{ padding: '9px 12px' }}>Lost Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(l => (
                    <tr key={l.id} style={{ borderBottom: '0.5px solid var(--border)', cursor: 'pointer', transition: 'background .1s' }}
                      onClick={() => setSelectedLeadId(l.id)}
                      onMouseOver={e => Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(td => (td.style.background = '#FDF5F5'))}
                      onMouseOut={e => Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(td => (td.style.background = ''))}>
                      <td style={{ padding: '9px 10px', textAlign: 'center' }} onClick={e => { e.stopPropagation(); toggleCheck(l.id) }}>
                        <input type="checkbox" checked={checked.has(l.id)} onChange={() => toggleCheck(l.id)} style={{ width: 15, height: 15, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                      </td>
                      <td style={{ padding: '9px 12px', fontWeight: 700 }}>{l.company_name}<br /><span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>{l.contact_person}</span></td>
                      <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--muted)' }}>{l.event_name.replace(/ 20\d\d$/, '')}</td>
                      <td style={{ padding: '9px 12px' }}>{l.owner}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'center' }}>{l.first_contact_done ? '✅' : '—'}</td>
                      <td style={{ padding: '9px 12px' }} onClick={e => e.stopPropagation()}>
                        <select value={l.current_stage} onChange={e => { e.stopPropagation(); moveStage(l.id, e.target.value) }} onClick={e => e.stopPropagation()}
                          style={{ fontSize: 12, padding: '4px 7px', border: '1.5px solid var(--border2)', borderRadius: 6, background: 'white', cursor: 'pointer', maxWidth: 170 }}>
                          {STAGE_ORDER.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '9px 12px', fontSize: 12 }}>{l.last_contact_date || '—'}</td>
                      <td style={{ padding: '9px 12px', fontSize: 12 }}>{l.next_follow_up_date || '—'}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>
                        {l.volume_currency === 'KRW' ? `₩${(l.expected_monthly_volume || 0).toLocaleString()}` : `$${(l.expected_monthly_volume || 0).toLocaleString()}`}
                      </td>
                      <td style={{ padding: '9px 12px' }}><PriorityBadge p={l.priority} /></td>
                      <td style={{ padding: '9px 12px', fontSize: 11, color: '#DC2626' }}>{l.lost_reason || '—'}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && <tr><td colSpan={11} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>해당하는 Lead 없음</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Proposal & Contract */}
        {tab === 'proposal' && (
          <ProposalContractView leads={leads} proposals={proposals} onUpdate={updatePropField} onOpenLead={setSelectedLeadId} />
        )}
      </div>

      {selectedLeadId && (
        <LeadDetailPanel leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} onRefresh={load} />
      )}
    </div>
  )
}

function ProposalContractView({ leads, proposals, onUpdate, onOpenLead }: {
  leads: SalesLead[]; proposals: SalesProposal[]
  onUpdate: (id: string, field: string, value: string) => void
  onOpenLead: (id: string) => void
}) {
  const propLeads = leads.filter(l => ['Proposal Sent', 'Negotiation', 'Onboarding', 'Onboarded / Won', 'Lost'].includes(l.current_stage))
  const propMap: Record<string, SalesProposal> = {}
  for (const p of proposals) propMap[p.lead_id] = p

  const byCS = (s: string) => proposals.filter(p => p.contract_status === s).length
  const byOS = (s: string) => proposals.filter(p => p.onboarding_status === s).length

  const kpiCards = [
    { lbl: 'Proposal Sent', val: leads.filter(l => l.current_stage === 'Proposal Sent').length, col: '#4F46E5' },
    { lbl: 'Negotiation', val: leads.filter(l => l.current_stage === 'Negotiation').length, col: '#EA580C' },
    { lbl: 'Under Review', val: byCS('Under Review'), col: '#D97706' },
    { lbl: 'Signed', val: byCS('Signed'), col: '#059669' },
    { lbl: 'Onboarding', val: leads.filter(l => l.current_stage === 'Onboarding').length, col: '#7C3AED' },
    { lbl: 'Completed', val: byOS('Completed'), col: '#065F46' },
  ]

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 16 }}>
        {kpiCards.map(k => (
          <div key={k.lbl} style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>{k.lbl}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.col }}>{k.val}</div>
          </div>
        ))}
      </div>
      <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>Proposal ~ Won 단계 리드 ({propLeads.length}개)</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 950 }}>
            <thead>
              <tr style={{ background: 'var(--accent)', color: 'white' }}>
                <th style={{ padding: '9px 14px', textAlign: 'left' }}>Company</th>
                <th style={{ padding: '9px 14px' }}>Stage</th>
                <th style={{ padding: '9px 14px' }}>날짜</th>
                <th style={{ padding: '9px 14px', textAlign: 'right' }}>Fee</th>
                <th style={{ padding: '9px 14px', textAlign: 'right' }}>Volume</th>
                <th style={{ padding: '9px 14px' }}>Contract Status</th>
                <th style={{ padding: '9px 14px' }}>Onboarding</th>
                <th style={{ padding: '9px 14px' }}>Owner</th>
                <th style={{ padding: '9px 14px' }}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {propLeads.map(l => {
                const p = propMap[l.id]
                const stageBg = STAGE_COLORS[l.current_stage]?.bg || '#6B7280'
                return (
                  <tr key={l.id} style={{ borderBottom: '0.5px solid var(--border)', cursor: 'pointer', transition: 'background .1s' }}
                    onClick={() => onOpenLead(l.id)}
                    onMouseOver={e => Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(td => (td.style.background = '#FDF5F5'))}
                    onMouseOut={e => Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(td => (td.style.background = ''))}>
                    <td style={{ padding: '9px 14px', fontWeight: 700 }}>{l.company_name}<br /><span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>{l.contact_person}</span></td>
                    <td style={{ padding: '9px 14px' }} onClick={e => e.stopPropagation()}>
                      <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700, color: 'white', background: stageBg }}>{l.current_stage}</span>
                    </td>
                    <td style={{ padding: '9px 14px', fontSize: 12 }}>{p?.proposal_sent_date || '—'}</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>{p?.proposed_fee_rate ? `${p.proposed_fee_rate}%` : '—'}</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                      {p?.expected_monthly_volume ? `${p.volume_currency} ${p.expected_monthly_volume.toLocaleString()}` : '—'}
                    </td>
                    <td style={{ padding: '9px 14px' }} onClick={e => e.stopPropagation()}>
                      {p ? (
                        <select value={p.contract_status} onChange={e => onUpdate(p.id, 'contract_status', e.target.value)}
                          style={{ fontSize: 12, padding: '4px 7px', border: '1.5px solid var(--border2)', borderRadius: 6, background: 'white', cursor: 'pointer', width: '100%' }}>
                          {CONTRACT_STATUSES.map(s => <option key={s}>{s}</option>)}
                        </select>
                      ) : <span style={{ fontSize: 12, color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '9px 14px' }} onClick={e => e.stopPropagation()}>
                      {p ? (
                        <select value={p.onboarding_status} onChange={e => onUpdate(p.id, 'onboarding_status', e.target.value)}
                          style={{ fontSize: 12, padding: '4px 7px', border: '1.5px solid var(--border2)', borderRadius: 6, background: 'white', cursor: 'pointer', width: '100%' }}>
                          {ONBOARD_STATUSES.map(s => <option key={s}>{s}</option>)}
                        </select>
                      ) : <span style={{ fontSize: 12, color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '9px 14px' }}>{l.owner}</td>
                    <td style={{ padding: '9px 14px', fontSize: 11, color: 'var(--muted)' }}>{p?.remarks || '—'}</td>
                  </tr>
                )
              })}
              {propLeads.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>해당 단계 리드 없음</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
