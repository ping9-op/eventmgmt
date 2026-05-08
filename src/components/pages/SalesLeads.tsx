import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { STAGE_COLORS, STAGE_ORDER, priorityColor } from '../../lib/utils'
import type { SalesLead, SalesActivity, SalesTask } from '../../types/database'
import { loadSalesSettings } from '../../lib/settings'
import { useToast } from '../../contexts/ToastContext'

type ViewMode = 'list' | 'group'

const PRIORITIES = ['High','Medium','Low']

export default function SalesLeads() {
  const { showToast } = useToast()
  const settings = loadSalesSettings()
  const OWNERS = settings.owners
  const LEAD_SOURCES = settings.sources
  const BUSINESS_TYPES = settings.businessTypes
  const CORRIDORS = settings.corridors
  const [leads, setLeads] = useState<SalesLead[]>([])
  const [search, setSearch] = useState('')
  const [filterStage, setFilterStage] = useState('')
  const [filterOwner, setFilterOwner] = useState('')
  const [loading, setLoading] = useState(true)
  const [showRegister, setShowRegister] = useState(false)
  const [selectedLead, setSelectedLead] = useState<SalesLead | null>(null)
  const [activities, setActivities] = useState<SalesActivity[]>([])
  const [tasks, setTasks] = useState<SalesTask[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  // Register form
  const [form, setForm] = useState<Partial<SalesLead>>({
    registered_date: new Date().toISOString().split('T')[0],
    lead_source: 'Expo', business_type: 'Korean Restaurant',
    country_corridor: 'Korea → Japan', priority: 'Medium',
    owner: 'Andrew', current_stage: 'New Lead',
    volume_currency: 'USD', first_contact_done: false
  })

  async function load() {
    const { data } = await supabase.from('sales_leads').select('*').order('registered_date', { ascending: false })
    setLeads((data || []) as SalesLead[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function openDetail(lead: SalesLead) {
    setSelectedLead(lead)
    const [{ data: actData }, { data: taskData }] = await Promise.all([
      supabase.from('sales_activities').select('*').eq('lead_id', lead.id).order('activity_date', { ascending: false }),
      supabase.from('sales_tasks').select('*').eq('lead_id', lead.id).order('due_date'),
    ])
    setActivities((actData || []) as SalesActivity[])
    setTasks((taskData || []) as SalesTask[])
  }

  async function register() {
    const maxSerial = leads.reduce((max, l) => {
      const n = parseInt(l.serial_no.replace(/\D/g, '')) || 0
      return n > max ? n : max
    }, 0)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ...formWithoutId } = form as SalesLead
    await supabase.from('sales_leads').insert({
      ...formWithoutId,
      serial_no: `L${String(maxSerial + 1).padStart(3, '0')}`,
      company_name: form.company_name || '',
      contact_person: form.contact_person || '',
      lead_source: form.lead_source || 'Expo',
      business_type: form.business_type || '',
      country_corridor: form.country_corridor || '',
      priority: form.priority || 'Medium',
      owner: form.owner || 'Andrew',
      current_stage: 'New Lead',
      volume_currency: form.volume_currency || 'USD',
      first_contact_done: false,
      event_name: form.event_name || '',
      registered_date: form.registered_date || new Date().toISOString().split('T')[0],
    })
    setShowRegister(false)
    setForm({ registered_date: new Date().toISOString().split('T')[0], lead_source: 'Expo', business_type: 'Korean Restaurant', country_corridor: 'Korea → Japan', priority: 'Medium', owner: 'Andrew', current_stage: 'New Lead', volume_currency: 'USD', first_contact_done: false })
    showToast('Lead가 등록되었습니다.')
    load()
  }

  async function updateStage(leadId: string, stage: string) {
    await supabase.from('sales_leads').update({ current_stage: stage }).eq('id', leadId)
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, current_stage: stage } : l))
    if (selectedLead?.id === leadId) setSelectedLead(prev => prev ? { ...prev, current_stage: stage } : prev)
  }

  async function addActivity(leadId: string, type: string, note: string) {
    await supabase.from('sales_activities').insert({
      lead_id: leadId, activity_type: type, activity_date: new Date().toISOString().split('T')[0],
      note, created_by: 'Andrew', activity_result: 'Contacted'
    })
    const { data } = await supabase.from('sales_activities').select('*').eq('lead_id', leadId).order('activity_date', { ascending: false })
    setActivities((data || []) as SalesActivity[])
  }

  const filtered = leads.filter(l => {
    const q = search.toLowerCase()
    const matchSearch = !q || l.company_name.toLowerCase().includes(q) || l.contact_person.toLowerCase().includes(q) || l.serial_no.toLowerCase().includes(q)
    const matchStage = !filterStage || l.current_stage === filterStage
    const matchOwner = !filterOwner || l.owner === filterOwner
    return matchSearch && matchStage && matchOwner
  })

  function exportCSV() {
    const headers = ['ID', '등록일', '이벤트명', '회사명', '담당자', '전화', '이메일', '업종', '소스', '코리도', '예상거래량', '통화', 'Stage', '우선순위', 'Owner', '다음액션', '비고']
    const rows = leads.map(l => [
      l.serial_no, l.registered_date, l.event_name, l.company_name, l.contact_person,
      l.phone || '', l.email || '', l.business_type, l.lead_source, l.country_corridor,
      l.expected_monthly_volume || '', l.volume_currency, l.current_stage, l.priority,
      l.owner, l.next_action || '', l.remarks || ''
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `leads_${new Date().toISOString().split('T')[0]}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="view wide"><div style={{ color: 'var(--muted)', padding: 40 }}>로딩 중...</div></div>

  return (
    <div className="view wide">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="sec-hdr" style={{ margin: 0 }}>
          <div className="bar" />
          <div className="txt">Lead 관리</div>
          <div className="sub">{filtered.length}/{leads.length}건</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={exportCSV}>⬇️ Excel</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowRegister(true)}>+ Lead 등록</button>
        </div>
      </div>

      {/* 필터 + 뷰 전환 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="검색 (회사명, 담당자, ID)" style={{ width: 220 }} />
        <select value={filterStage} onChange={e => setFilterStage(e.target.value)} style={{ width: 160 }}>
          <option value="">전체 Stage</option>
          {STAGE_ORDER.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={filterOwner} onChange={e => setFilterOwner(e.target.value)} style={{ width: 120 }}>
          <option value="">전체 담당자</option>
          {OWNERS.map(o => <option key={o}>{o}</option>)}
        </select>
        {(search || filterStage || filterOwner) && (
          <button className="btn btn-muted btn-sm" onClick={() => { setSearch(''); setFilterStage(''); setFilterOwner('') }}>초기화</button>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', background: 'var(--light)', borderRadius: 8, padding: 3, gap: 2 }}>
          {([['list', '목록'], ['group', '그룹']] as const).map(([v, lbl]) => (
            <button key={v} onClick={() => setViewMode(v)} style={{
              padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700,
              border: 'none', cursor: 'pointer',
              background: viewMode === v ? 'var(--accent)' : 'transparent',
              color: viewMode === v ? 'white' : 'var(--muted)'
            }}>{lbl}</button>
          ))}
        </div>
      </div>

      {/* 그룹 뷰 */}
      {viewMode === 'group' && <GroupView leads={filtered} onOpenDetail={openDetail} />}

      {/* 목록 테이블 */}
      {viewMode === 'list' && <div style={{ overflowX: 'auto' }}>
        <table className="sales-table">
          <thead>
            <tr>
              <th>ID</th><th>회사명</th><th>담당자</th><th>업종</th><th>소스</th><th>코리도</th>
              <th>예상 거래량</th><th>Stage</th><th>우선순위</th><th>담당자</th><th>다음 액션</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(l => (
              <tr key={l.id} onClick={() => openDetail(l)}>
                <td style={{ color: 'var(--muted)', fontSize: 12 }}>{l.serial_no}</td>
                <td style={{ fontWeight: 700 }}>{l.company_name}</td>
                <td>{l.contact_person}</td>
                <td style={{ fontSize: 12 }}>{l.business_type}</td>
                <td style={{ fontSize: 12 }}>{l.lead_source}</td>
                <td style={{ fontSize: 12 }}>{l.country_corridor}</td>
                <td style={{ fontSize: 12 }}>
                  {l.expected_monthly_volume ? `${l.volume_currency} ${l.expected_monthly_volume.toLocaleString()}` : '-'}
                </td>
                <td>
                  <span style={{ background: STAGE_COLORS[l.current_stage]?.bg || '#999', color: 'white', fontSize: 11, padding: '3px 9px', borderRadius: 99, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {l.current_stage}
                  </span>
                </td>
                <td>
                  <span style={{ color: priorityColor(l.priority), fontWeight: 700, fontSize: 13 }}>{l.priority}</span>
                </td>
                <td>{l.owner}</td>
                <td style={{ fontSize: 12, color: 'var(--muted)' }}>{l.next_action || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}

      {/* Register Modal */}
      {showRegister && (
        <div className="modal-bg open">
          <div className="modal" style={{ width: 680 }}>
            <div className="modal-hdr">
              <h3>Lead 등록</h3>
              <button className="modal-close" onClick={() => setShowRegister(false)}>✕</button>
            </div>
            <div className="form-row cols2">
              <div><label style={{ marginTop: 0 }}>등록일</label><input type="date" value={form.registered_date || ''} onChange={e => setForm(f => ({ ...f, registered_date: e.target.value }))} /></div>
              <div><label style={{ marginTop: 0 }}>이벤트명</label><input value={form.event_name || ''} onChange={e => setForm(f => ({ ...f, event_name: e.target.value }))} /></div>
            </div>
            <div className="form-row cols2">
              <div><label>회사명</label><input value={form.company_name || ''} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} /></div>
              <div><label>담당자명</label><input value={form.contact_person || ''} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} /></div>
            </div>
            <div className="form-row cols2">
              <div><label>전화번호</label><input value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div><label>이메일</label><input type="email" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            </div>
            <div className="form-row cols3">
              <div>
                <label>Lead 소스</label>
                <select value={form.lead_source || 'Expo'} onChange={e => setForm(f => ({ ...f, lead_source: e.target.value }))}>
                  {LEAD_SOURCES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label>업종</label>
                <select value={form.business_type || ''} onChange={e => setForm(f => ({ ...f, business_type: e.target.value }))}>
                  {BUSINESS_TYPES.map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label>코리도</label>
                <select value={form.country_corridor || ''} onChange={e => setForm(f => ({ ...f, country_corridor: e.target.value }))}>
                  {CORRIDORS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row cols3">
              <div>
                <label>예상 월거래량</label>
                <input type="number" value={form.expected_monthly_volume || ''} onChange={e => setForm(f => ({ ...f, expected_monthly_volume: parseFloat(e.target.value) || undefined }))} />
              </div>
              <div>
                <label>통화</label>
                <select value={form.volume_currency || 'USD'} onChange={e => setForm(f => ({ ...f, volume_currency: e.target.value }))}>
                  {['USD','KRW','JPY','AUD'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label>우선순위</label>
                <select value={form.priority || 'Medium'} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row cols2">
              <div>
                <label>담당자</label>
                <select value={form.owner || 'Andrew'} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))}>
                  {OWNERS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div><label>주소</label><input value={form.address || ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
            </div>
            <div><label>비고</label><textarea value={form.remarks || ''} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} rows={2} /></div>
            <div className="modal-footer">
              <button className="btn btn-muted" onClick={() => setShowRegister(false)}>취소</button>
              <button className="btn btn-primary" onClick={register} disabled={!form.company_name}>등록</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedLead && (
        <div className="modal-bg open">
          <div className="modal" style={{ width: 700 }}>
            <div className="modal-hdr">
              <h3>{selectedLead.company_name} <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 400 }}>({selectedLead.serial_no})</span></h3>
              <button className="modal-close" onClick={() => setSelectedLead(null)}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px', fontSize: 14, marginBottom: 16 }}>
              {[
                ['담당자', selectedLead.contact_person],
                ['전화', selectedLead.phone || '-'],
                ['이메일', selectedLead.email || '-'],
                ['업종', selectedLead.business_type],
                ['코리도', selectedLead.country_corridor],
                ['소스', selectedLead.lead_source],
                ['우선순위', selectedLead.priority],
                ['담당자', selectedLead.owner],
              ].map(([k, v]) => (
                <div key={k}><span style={{ color: 'var(--muted)' }}>{k}: </span><strong>{v}</strong></div>
              ))}
            </div>

            <label style={{ marginTop: 0 }}>Stage 변경</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {STAGE_ORDER.map(s => (
                <button key={s}
                  onClick={() => updateStage(selectedLead.id, s)}
                  style={{
                    padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: 'none', fontWeight: 600,
                    background: selectedLead.current_stage === s ? STAGE_COLORS[s]?.bg : 'var(--light)',
                    color: selectedLead.current_stage === s ? 'white' : 'var(--muted)'
                  }}
                >{s}</button>
              ))}
            </div>

            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>활동 이력</div>
            {activities.map(a => (
              <div key={a.id} style={{ fontSize: 13, padding: '6px 10px', background: 'var(--light)', borderRadius: 6, marginBottom: 6 }}>
                <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{a.activity_type}</span>
                {' · '}{a.activity_date}{' · '}{a.note || '-'}
              </div>
            ))}
            {activities.length === 0 && <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>활동 기록 없음</div>}

            <AddActivityInline onAdd={(type, note) => addActivity(selectedLead.id, type, note)} />

            <div className="modal-footer">
              <button className="btn btn-muted" onClick={() => setSelectedLead(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function GroupView({ leads, onOpenDetail }: { leads: SalesLead[]; onOpenDetail: (l: SalesLead) => void }) {
  const events = [...new Set(leads.map(l => l.event_name || '(미입력)'))].sort()

  return (
    <div>
      {events.map(ev => {
        const evLeads = leads.filter(l => (l.event_name || '(미입력)') === ev)
        const stageCount: Record<string, number> = {}
        for (const l of evLeads) stageCount[l.current_stage] = (stageCount[l.current_stage] || 0) + 1
        return (
          <div key={ev} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, padding: '10px 14px', background: 'var(--light)', borderRadius: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>📅 {ev}</span>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>{evLeads.length}건</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {STAGE_ORDER.filter(s => stageCount[s]).map(s => (
                  <span key={s} style={{ background: STAGE_COLORS[s]?.bg || '#999', color: 'white', fontSize: 10, padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>
                    {s} {stageCount[s]}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="sales-table" id="leads-group-tbl">
                <thead>
                  <tr><th>ID</th><th>회사명</th><th>담당자</th><th>업종</th><th>소스</th><th>코리도</th><th>예상 거래량</th><th>Stage</th><th>우선순위</th><th>Owner</th></tr>
                </thead>
                <tbody>
                  {evLeads.map(l => (
                    <tr key={l.id} onClick={() => onOpenDetail(l)}>
                      <td style={{ color: 'var(--muted)', fontSize: 12 }}>{l.serial_no}</td>
                      <td style={{ fontWeight: 700 }}>{l.company_name}</td>
                      <td>{l.contact_person}</td>
                      <td style={{ fontSize: 12 }}>{l.business_type}</td>
                      <td style={{ fontSize: 12 }}>{l.lead_source}</td>
                      <td style={{ fontSize: 12 }}>{l.country_corridor}</td>
                      <td style={{ fontSize: 12 }}>
                        {l.expected_monthly_volume ? `${l.volume_currency} ${l.expected_monthly_volume.toLocaleString()}` : '-'}
                      </td>
                      <td>
                        <span style={{ background: STAGE_COLORS[l.current_stage]?.bg || '#999', color: 'white', fontSize: 11, padding: '3px 9px', borderRadius: 99, fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {l.current_stage}
                        </span>
                      </td>
                      <td><span style={{ color: priorityColor(l.priority), fontWeight: 700, fontSize: 13 }}>{l.priority}</span></td>
                      <td>{l.owner}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
      {events.length === 0 && <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 40 }}>리드 없음</div>}
    </div>
  )
}

function AddActivityInline({ onAdd }: { onAdd: (type: string, note: string) => void }) {
  const [type, setType] = useState('Call')
  const [note, setNote] = useState('')
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 8 }}>
      <select value={type} onChange={e => setType(e.target.value)} style={{ width: 100 }}>
        {['Call','Email','SMS','Kakao','Visit','Meeting'].map(t => <option key={t}>{t}</option>)}
      </select>
      <input value={note} onChange={e => setNote(e.target.value)} placeholder="활동 내용" style={{ flex: 1 }} />
      <button className="btn btn-primary btn-sm" onClick={() => { onAdd(type, note); setNote('') }}>추가</button>
    </div>
  )
}
