import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { STAGE_ORDER, STAGE_COLORS, priorityColor } from '../../lib/utils'
import type { SalesLead, SalesProposal } from '../../types/database'
import { loadSalesSettings } from '../../lib/settings'

type TabType = 'board' | 'table' | 'proposal'

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

export default function SalesFunnel() {
  const { owners: OWNERS } = loadSalesSettings()
  const [leads, setLeads] = useState<SalesLead[]>([])
  const [proposals, setProposals] = useState<SalesProposal[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabType>('board')
  const [filterOwner, setFilterOwner] = useState('')
  const [filterStage, setFilterStage] = useState<string | null>(null)

  async function load() {
    const [{ data: leadData }, { data: propData }] = await Promise.all([
      supabase.from('sales_leads').select('*'),
      supabase.from('sales_proposals').select('*'),
    ])
    setLeads((leadData || []) as SalesLead[])
    setProposals((propData || []) as SalesProposal[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function moveStage(leadId: string, stage: string) {
    await supabase.from('sales_leads').update({ current_stage: stage }).eq('id', leadId)
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, current_stage: stage } : l))
  }

  if (loading) return <div className="view wide"><div style={{ color: 'var(--muted)', padding: 40 }}>로딩 중...</div></div>

  const byS = (s: string) => leads.filter(l => l.current_stage === s).length
  const total = leads.length
  const won = byS('Onboarded / Won')
  const conv = total ? Math.round(won / total * 100) : 0

  function kpiVal(k: typeof KPI_CARDS[0]): string | number {
    if (k.stage === null) return total
    if (k.stage === '__conv__') return conv + '%'
    return byS(k.stage)
  }

  const baseFiltered = filterOwner ? leads.filter(l => l.owner === filterOwner) : leads
  const filtered = filterStage
    ? (filterStage === '__active__' ? baseFiltered.filter(l => l.current_stage !== 'Lost' && l.current_stage !== 'Onboarded / Won') : baseFiltered.filter(l => l.current_stage === filterStage))
    : baseFiltered

  const tabs: { id: TabType; label: string }[] = [
    { id: 'board', label: '📋 보드 뷰' },
    { id: 'table', label: '📊 테이블 뷰' },
    { id: 'proposal', label: '📄 Proposal & Contract' },
  ]

  return (
    <div className="view wide">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="sec-hdr" style={{ margin: 0 }}>
          <div className="bar" />
          <div className="txt">Sales Funnel</div>
          <div className="sub">{filtered.length}건</div>
        </div>
        <select value={filterOwner} onChange={e => setFilterOwner(e.target.value)} style={{ width: 130 }}>
          <option value="">전체 담당자</option>
          {OWNERS.map(o => <option key={o}>{o}</option>)}
        </select>
      </div>

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
              }}>
              <div style={{ fontSize: 10, color: active ? 'rgba(255,255,255,.8)' : 'var(--muted)', marginBottom: 3 }}>{k.lbl}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: active ? 'white' : k.col }}>{kpiVal(k)}</div>
            </div>
          )
        })}
      </div>

      {/* 필터 표시 */}
      {filterStage && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, background: '#FFF8F0', border: '1px solid #FDE68A', borderRadius: 8, padding: '7px 14px' }}>
          <span style={{ fontSize: 13 }}>🔍 <strong>{filterStage}</strong> 필터 중 ({filtered.length}개)</span>
          <button onClick={() => setFilterStage(null)} style={{ padding: '3px 10px', borderRadius: 5, background: 'white', border: '1px solid var(--border2)', fontSize: 12, cursor: 'pointer', marginLeft: 'auto' }}>✕ 전체 보기</button>
        </div>
      )}

      {/* 탭 */}
      <div style={{ display: 'flex', background: 'var(--light)', borderRadius: 10, padding: 4, gap: 3, marginBottom: 16, width: 'fit-content' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '7px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700,
            border: 'none', cursor: 'pointer',
            background: tab === t.id ? 'var(--accent)' : 'transparent',
            color: tab === t.id ? 'white' : 'var(--muted)',
          }}>{t.label}</button>
        ))}
      </div>

      {/* 보드 뷰 */}
      {tab === 'board' && (
        <div className="funnel-board">
          {STAGE_ORDER.map(stage => {
            const col = STAGE_COLORS[stage]
            const stageLeads = filtered.filter(l => l.current_stage === stage)
            return (
              <div key={stage} className="funnel-col">
                <div className="funnel-col-hdr" style={{ background: col?.bg || '#999' }}>
                  <span>{stage}</span>
                  <span style={{ background: 'rgba(255,255,255,.25)', borderRadius: 99, padding: '2px 8px', fontSize: 12 }}>{stageLeads.length}</span>
                </div>
                <div className="funnel-col-body">
                  {stageLeads.map(l => (
                    <div key={l.id} className="funnel-card">
                      <div className="fc-name">{l.company_name}</div>
                      <div className="fc-meta">{l.contact_person}</div>
                      <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: priorityColor(l.priority), fontWeight: 700 }}>{l.priority}</span>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>· {l.owner}</span>
                      </div>
                      <select
                        value={stage}
                        onChange={e => moveStage(l.id, e.target.value)}
                        onClick={e => e.stopPropagation()}
                        style={{ marginTop: 8, fontSize: 11, padding: '3px 6px', width: '100%' }}>
                        {STAGE_ORDER.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  ))}
                  {stageLeads.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>없음</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 테이블 뷰 */}
      {tab === 'table' && (
        <div style={{ overflowX: 'auto' }}>
          <table className="sales-table">
            <thead>
              <tr><th>회사명</th><th>담당자</th><th>Stage</th><th>우선순위</th><th>Owner</th><th>코리도</th><th>다음 액션</th><th>변경</th></tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id}>
                  <td style={{ fontWeight: 700 }}>{l.company_name}</td>
                  <td>{l.contact_person}</td>
                  <td>
                    <span style={{ background: STAGE_COLORS[l.current_stage]?.bg || '#999', color: 'white', fontSize: 11, padding: '3px 9px', borderRadius: 99, fontWeight: 600 }}>
                      {l.current_stage}
                    </span>
                  </td>
                  <td style={{ color: priorityColor(l.priority), fontWeight: 700 }}>{l.priority}</td>
                  <td>{l.owner}</td>
                  <td style={{ fontSize: 12 }}>{l.country_corridor}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{l.next_action || '-'}</td>
                  <td>
                    <select value={l.current_stage} onChange={e => moveStage(l.id, e.target.value)} style={{ fontSize: 12, padding: '3px 6px' }}>
                      {STAGE_ORDER.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>해당하는 Lead 없음</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Proposal & Contract 탭 */}
      {tab === 'proposal' && (
        <ProposalContractView leads={leads} proposals={proposals} onRefresh={load} />
      )}
    </div>
  )
}

const CONTRACT_STATUSES = ['Draft', 'Sent', 'Under Review', 'Signed', 'Rejected']
const ONBOARD_STATUSES = ['Not Started', 'In Progress', 'Completed', 'On Hold']

const PROPOSAL_STAGES = ['Proposal Sent', 'Negotiation', 'Onboarding', 'Onboarded / Won']

function ProposalContractView({ leads, proposals, onRefresh }: {
  leads: SalesLead[]
  proposals: SalesProposal[]
  onRefresh: () => void
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<Partial<SalesProposal>>({
    contract_status: 'Draft', onboarding_status: 'Not Started', volume_currency: 'USD',
  })

  const propLeads = leads.filter(l => PROPOSAL_STAGES.includes(l.current_stage))
  const propMap: Record<string, SalesProposal> = {}
  for (const p of proposals) propMap[p.lead_id] = p

  const kpiCards = [
    { lbl: 'Proposal Sent', val: leads.filter(l => l.current_stage === 'Proposal Sent').length, col: '#4F46E5' },
    { lbl: 'Negotiation', val: leads.filter(l => l.current_stage === 'Negotiation').length, col: '#D97706' },
    { lbl: 'Signed', val: proposals.filter(p => p.contract_status === 'Signed').length, col: '#059669' },
    { lbl: 'Onboarding', val: leads.filter(l => l.current_stage === 'Onboarding').length, col: '#0EA5E9' },
    { lbl: 'Completed', val: proposals.filter(p => p.onboarding_status === 'Completed').length, col: '#065F46' },
    { lbl: 'Won', val: leads.filter(l => l.current_stage === 'Onboarded / Won').length, col: '#2E7D51' },
  ]

  async function saveProposal() {
    if (!form.lead_id) return
    await supabase.from('sales_proposals').upsert({
      lead_id: form.lead_id,
      proposal_sent_date: form.proposal_sent_date || null,
      proposed_fee_rate: form.proposed_fee_rate || null,
      expected_monthly_volume: form.expected_monthly_volume || null,
      volume_currency: form.volume_currency || 'USD',
      contract_status: form.contract_status || 'Draft',
      onboarding_status: form.onboarding_status || 'Not Started',
      remarks: form.remarks || null,
    })
    setShowAdd(false)
    setForm({ contract_status: 'Draft', onboarding_status: 'Not Started', volume_currency: 'USD' })
    onRefresh()
  }

  async function updateProp(propId: string, field: string, value: string) {
    await supabase.from('sales_proposals').update({ [field]: value } as unknown as never).eq('id', propId)
    onRefresh()
  }

  return (
    <div>
      {/* KPI 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 16 }}>
        {kpiCards.map(k => (
          <div key={k.lbl} style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 10, padding: '12px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3 }}>{k.lbl}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.col }}>{k.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Proposal 등록</button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="sales-table">
          <thead>
            <tr>
              <th>회사명</th><th>Stage</th><th>Proposal 발송일</th>
              <th>수수료율</th><th>예상 거래량</th>
              <th>계약 상태</th><th>온보딩 상태</th><th>비고</th>
            </tr>
          </thead>
          <tbody>
            {propLeads.map(l => {
              const p = propMap[l.id]
              return (
                <tr key={l.id}>
                  <td style={{ fontWeight: 700 }}>{l.company_name}<div style={{ fontSize: 11, color: 'var(--muted)' }}>{l.contact_person}</div></td>
                  <td>
                    <span style={{ background: STAGE_COLORS[l.current_stage]?.bg || '#999', color: 'white', fontSize: 10, padding: '2px 7px', borderRadius: 99, fontWeight: 600 }}>
                      {l.current_stage}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>{p?.proposal_sent_date || '-'}</td>
                  <td style={{ fontSize: 12 }}>{p?.proposed_fee_rate ? p.proposed_fee_rate + '%' : '-'}</td>
                  <td style={{ fontSize: 12 }}>
                    {p?.expected_monthly_volume ? `${p.volume_currency} ${p.expected_monthly_volume.toLocaleString()}` : '-'}
                  </td>
                  <td>
                    {p ? (
                      <select value={p.contract_status} onChange={e => updateProp(p.id, 'contract_status', e.target.value)}
                        style={{ fontSize: 12, padding: '3px 6px', width: '100%' }}>
                        {CONTRACT_STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    ) : <span style={{ fontSize: 12, color: 'var(--muted)' }}>-</span>}
                  </td>
                  <td>
                    {p ? (
                      <select value={p.onboarding_status} onChange={e => updateProp(p.id, 'onboarding_status', e.target.value)}
                        style={{ fontSize: 12, padding: '3px 6px', width: '100%' }}>
                        {ONBOARD_STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    ) : <span style={{ fontSize: 12, color: 'var(--muted)' }}>-</span>}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{p?.remarks || '-'}</td>
                </tr>
              )
            })}
            {propLeads.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>Proposal 단계 이상의 Lead 없음</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="modal-bg open">
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-hdr">
              <h3>Proposal 등록</h3>
              <button className="modal-close" onClick={() => setShowAdd(false)}>✕</button>
            </div>
            <label style={{ marginTop: 0 }}>Lead 선택</label>
            <select value={form.lead_id || ''} onChange={e => setForm(f => ({ ...f, lead_id: e.target.value }))}>
              <option value="">-- Lead 선택 --</option>
              {propLeads.filter(l => !propMap[l.id]).map(l => (
                <option key={l.id} value={l.id}>{l.company_name} ({l.contact_person})</option>
              ))}
            </select>
            <div className="form-row cols2">
              <div>
                <label>Proposal 발송일</label>
                <input type="date" value={form.proposal_sent_date || ''} onChange={e => setForm(f => ({ ...f, proposal_sent_date: e.target.value }))} />
              </div>
              <div>
                <label>수수료율 (%)</label>
                <input type="number" step="0.01" value={form.proposed_fee_rate || ''} onChange={e => setForm(f => ({ ...f, proposed_fee_rate: parseFloat(e.target.value) || undefined }))} />
              </div>
            </div>
            <div className="form-row cols2">
              <div>
                <label>예상 월 거래량</label>
                <input type="number" value={form.expected_monthly_volume || ''} onChange={e => setForm(f => ({ ...f, expected_monthly_volume: parseFloat(e.target.value) || undefined }))} />
              </div>
              <div>
                <label>통화</label>
                <select value={form.volume_currency || 'USD'} onChange={e => setForm(f => ({ ...f, volume_currency: e.target.value }))}>
                  {['USD', 'KRW', 'JPY', 'AUD'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row cols2">
              <div>
                <label>계약 상태</label>
                <select value={form.contract_status || 'Draft'} onChange={e => setForm(f => ({ ...f, contract_status: e.target.value }))}>
                  {CONTRACT_STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label>온보딩 상태</label>
                <select value={form.onboarding_status || 'Not Started'} onChange={e => setForm(f => ({ ...f, onboarding_status: e.target.value }))}>
                  {ONBOARD_STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <label>비고</label>
            <input value={form.remarks || ''} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} />
            <div className="modal-footer">
              <button className="btn btn-muted" onClick={() => setShowAdd(false)}>취소</button>
              <button className="btn btn-primary" onClick={saveProposal} disabled={!form.lead_id}>등록</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
