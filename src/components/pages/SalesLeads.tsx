import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { STAGE_ORDER, STAGE_COLORS, priorityColor } from '../../lib/utils'
import type { SalesLead } from '../../types/database'
import { loadAllSettings, type SalesSettingsData } from '../../lib/settings'
import { useToast } from '../../contexts/ToastContext'
import LeadDetailPanel from './LeadDetailPanel'
import { useLang } from '../../contexts/LangContext'

type GroupBy = 'event' | 'date' | 'source'
type ViewMode = 'group' | 'detail'

interface ExcelPreview { rows: Partial<SalesLead>[]; fileName: string }

function StageBadge({ stage }: { stage: string }) {
  const c = STAGE_COLORS[stage] || { bg: '#6B7280' }
  return <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700, color: 'white', background: c.bg, whiteSpace: 'nowrap' }}>{stage}</span>
}

function InlineStageSelect({ lead, onUpdate }: { lead: SalesLead; onUpdate: (id: string, stage: string) => void }) {
  return (
    <select value={lead.current_stage}
      onChange={e => { e.stopPropagation(); onUpdate(lead.id, e.target.value) }}
      onClick={e => e.stopPropagation()}
      style={{ fontSize: 12, padding: '4px 7px', border: '1.5px solid var(--border2)', borderRadius: 6, background: 'white', cursor: 'pointer', maxWidth: 170, minWidth: 120 }}>
      {STAGE_ORDER.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  )
}

export default function SalesLeads() {
  const { t } = useLang()
  const location = useLocation()
  const { showToast } = useToast()
  const [settings, setSettings] = useState<SalesSettingsData | null>(null)
  const PRIORITIES = ['High', 'Medium', 'Low']

  const [leads, setLeads] = useState<SalesLead[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('group')
  const [groupBy, setGroupBy] = useState<GroupBy>('event')
  const [groupKey, setGroupKey] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<string | null>(null)
  const [filterOwner, setFilterOwner] = useState<string | null>(null)
  const [filterStage, setFilterStage] = useState<string | null>(null)
  const [filterCorridor, setFilterCorridor] = useState<string | null>(null)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [showRegister, setShowRegister] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [excelPreview, setExcelPreview] = useState<ExcelPreview | null>(null)
  const [importing, setImporting] = useState(false)
  const [pdfFileName, setPdfFileName] = useState('')

  // Register form
  const [form, setForm] = useState<Partial<SalesLead>>({
    registered_date: new Date().toISOString().split('T')[0],
    lead_source: 'Expo', business_type: 'Korean Restaurant',
    country_corridor: 'Korea → Japan', priority: 'Medium',
    owner: 'Andrew', current_stage: 'New Lead',
    volume_currency: 'USD', first_contact_done: false,
  })

  useEffect(() => {
    // Handle navigation state (from dashboard/reports)
    const state = (location.state as any)
    if (state?.filter) {
      if (state.filter.owner) setFilterOwner(state.filter.owner)
      if (state.filter.stage) {
        setFilterStage(state.filter.stage)
        setViewMode('detail')
        setGroupKey(null)
      }
      if (state.filter.event) {
        setGroupBy('event')
        setGroupKey(state.filter.event)
        setViewMode('detail')
      }
      if (state.filter.lostReason) {
        setFilterStage('Lost')
        setViewMode('detail')
      }
      if (state.filter.corridor) {
        setFilterCorridor(state.filter.corridor)
        setViewMode('detail')
      }
    }
    load()
    loadAllSettings().then(setSettings)
  }, [])

  async function load() {
    const { data } = await supabase.from('sales_leads').select('*').order('registered_date', { ascending: false })
    setLeads((data || []) as SalesLead[])
    setLoading(false)
  }

  async function updateStage(leadId: string, stage: string) {
    await supabase.from('sales_leads').update({ current_stage: stage }).eq('id', leadId)
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, current_stage: stage } : l))
  }

  async function register() {
    if (!form.company_name) { showToast('⚠️ Company Name은 필수입니다.'); return }
    const maxSerial = leads.reduce((max, l) => {
      const n = parseInt(l.serial_no.replace(/\D/g, '')) || 0
      return n > max ? n : max
    }, 0)
    await supabase.from('sales_leads').insert({
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
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      expected_monthly_volume: form.expected_monthly_volume || null,
      remarks: form.remarks || null,
    })
    setShowRegister(false)
    resetForm()
    showToast('✅ Lead가 등록되었습니다.')
    load()
  }

  function resetForm() {
    setForm({
      registered_date: new Date().toISOString().split('T')[0],
      lead_source: 'Expo', business_type: 'Korean Restaurant',
      country_corridor: 'Korea → Japan', priority: 'Medium',
      owner: 'Andrew', current_stage: 'New Lead',
      volume_currency: 'USD', first_contact_done: false,
    })
  }

  async function downloadTemplate() {
    const XLSX = await import('xlsx')
    const headers = ['회사명', '담당자', '연락처', '이메일', '행사명', 'Owner', 'Stage', 'Priority', 'Corridor', 'Business Type', 'Volume', 'Currency', 'Address', 'Remarks']
    const sample  = ['Sample Co.', '김철수', '+81-90-1234-5678', 'john@sample.com', 'KIF 2026', 'Andrew', 'New Lead', 'Medium', 'Korea → Japan', 'Korean Restaurant', '10000', 'USD', 'Tokyo, Japan', 'Booth에서 만남']
    const stageNote = ['※ Stage 유효값 →', ...STAGE_ORDER, ...Array(headers.length - 1 - STAGE_ORDER.length).fill('')]
    const ws = XLSX.utils.aoa_to_sheet([headers, sample, stageNote])
    ws['!cols'] = [22, 16, 18, 24, 16, 12, 22, 10, 18, 18, 10, 10, 18, 20].map(wch => ({ wch }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Leads')
    XLSX.writeFile(wb, 'GME_Leads_Template.xlsx')
    showToast('📋 템플릿이 다운로드되었습니다.')
  }

  async function handleExcelFile(file: File) {
    const XLSX = await import('xlsx')
    const reader = new FileReader()
    reader.onload = e => {
      const data = new Uint8Array(e.target!.result as ArrayBuffer)
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' })
      const parsed: Partial<SalesLead>[] = rows.map(r => {
        const rawStage = String(r.current_stage || r['Stage'] || r['스테이지'] || '')
        return {
          company_name: String(r.company_name || r['Company'] || r['회사명'] || ''),
          contact_person: String(r.contact_person || r['Contact'] || r['담당자'] || ''),
          phone: String(r.phone || r['Phone'] || r['연락처'] || r['전화'] || '') || null,
          email: String(r.email || r['Email'] || r['이메일'] || '') || null,
          lead_source: String(r.lead_source || r['Source'] || 'Expo'),
          event_name: String(r.event_name || r['Event'] || r['행사명'] || ''),
          owner: String(r.owner || r['Owner'] || 'Andrew'),
          priority: String(r.priority || r['Priority'] || 'Medium'),
          current_stage: STAGE_ORDER.includes(rawStage) ? rawStage : 'New Lead',
          country_corridor: String(r.country_corridor || r['Corridor'] || 'Korea → Japan'),
          business_type: String(r.business_type || r['Business Type'] || r['business_type'] || 'Korean Restaurant'),
          expected_monthly_volume: parseInt(String(r.expected_monthly_volume || r['Volume'] || '').replace(/[^0-9]/g, '')) || null,
          volume_currency: String(r.volume_currency || r['Currency'] || 'USD'),
          address: String(r.address || r['Address'] || '') || null,
          remarks: String(r.remarks || r['Remarks'] || '') || null,
        }
      }).filter(r => r.company_name)
      if (!parsed.length) { showToast('⚠️ 유효한 데이터가 없습니다. 템플릿을 확인해주세요.'); return }
      setExcelPreview({ rows: parsed, fileName: file.name })
    }
    reader.readAsArrayBuffer(file)
  }

  async function bulkRegisterLeads(rows: Partial<SalesLead>[]) {
    setImporting(true)
    const maxSerial = leads.reduce((max, l) => {
      const n = parseInt(l.serial_no.replace(/\D/g, '')) || 0
      return n > max ? n : max
    }, 0)
    const inserts = rows.map((r, i) => ({
      serial_no: `L${String(maxSerial + i + 1).padStart(3, '0')}`,
      company_name: r.company_name || '',
      contact_person: r.contact_person || '',
      phone: r.phone || null,
      email: r.email || null,
      lead_source: r.lead_source || 'Expo',
      event_name: r.event_name || '',
      owner: r.owner || 'Andrew',
      priority: r.priority || 'Medium',
      current_stage: (r.current_stage && STAGE_ORDER.includes(r.current_stage)) ? r.current_stage : 'New Lead',
      country_corridor: r.country_corridor || 'Korea → Japan',
      business_type: r.business_type || 'Korean Restaurant',
      expected_monthly_volume: r.expected_monthly_volume || null,
      volume_currency: r.volume_currency || 'USD',
      address: r.address || null,
      remarks: r.remarks || null,
      first_contact_done: false,
      registered_date: new Date().toISOString().split('T')[0],
    }))
    await supabase.from('sales_leads').insert(inserts)
    setImporting(false)
    setExcelPreview(null)
    showToast(`✅ ${rows.length}개 리드가 등록되었습니다.`)
    load()
  }

  function exportCSV(ids?: string[]) {
    const toExport = ids && ids.length > 0 ? leads.filter(l => ids.includes(l.id)) : (checked.size > 0 ? leads.filter(l => checked.has(l.id)) : leads)
    if (!toExport.length) { showToast('⚠️ 내보낼 리드가 없습니다.'); return }
    const H = ['SN', '등록일', '행사명', 'Company', '담당자', 'Phone', 'Email', 'Source', '주소', 'Owner', 'Stage', '첫연락', '마지막연락', '다음팔로업', '예상Volume', '통화', 'Priority', 'LostReason', 'Remarks']
    const rows = toExport.map(l => [l.serial_no, l.registered_date, l.event_name, l.company_name, l.contact_person, l.phone || '', l.email || '', l.lead_source, l.address || '', l.owner, l.current_stage, l.first_contact_done ? 'Y' : 'N', l.last_contact_date || '', l.next_follow_up_date || '', l.expected_monthly_volume || '', l.volume_currency, l.priority, l.lost_reason || '', l.remarks || ''])
    const csv = [H, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = Object.assign(document.createElement('a'), { href: 'data:text/csv;charset=utf-8,﻿' + encodeURIComponent(csv), download: `GME_Leads_${new Date().toISOString().split('T')[0]}.csv` })
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setChecked(new Set())
    showToast(`✅ ${toExport.length}개 다운로드 완료`)
  }

  function toggleCheck(id: string, all?: string[]) {
    if (all) {
      const allSet = new Set(all)
      if (checked.size > 0 && [...allSet].every(i => checked.has(i))) {
        setChecked(prev => { const n = new Set(prev); all.forEach(i => n.delete(i)); return n })
      } else {
        setChecked(prev => { const n = new Set(prev); all.forEach(i => n.add(i)); return n })
      }
    } else {
      setChecked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    }
  }

  // Apply filters
  let filteredLeads = leads
  if (filterOwner) filteredLeads = filteredLeads.filter(l => l.owner === filterOwner)
  if (filterStage) filteredLeads = filteredLeads.filter(l => l.current_stage === filterStage)
  if (filterCorridor) filteredLeads = filteredLeads.filter(l => l.country_corridor === filterCorridor)

  // Build groups
  const groups: Record<string, SalesLead[]> = {}
  filteredLeads.forEach(l => {
    const key = groupBy === 'event' ? l.event_name : groupBy === 'date' ? l.registered_date : l.lead_source
    if (!groups[key]) groups[key] = []
    groups[key].push(l)
  })

  // Detail list data
  let detailLeads = filteredLeads
  if (groupKey) {
    if (groupBy === 'event') detailLeads = detailLeads.filter(l => l.event_name === groupKey)
    else if (groupBy === 'date') detailLeads = detailLeads.filter(l => l.registered_date === groupKey)
    else detailLeads = detailLeads.filter(l => l.lead_source === groupKey)
  }
  if (stageFilter) detailLeads = detailLeads.filter(l => l.current_stage === stageFilter)
  if (search) {
    const q = search.toLowerCase()
    detailLeads = detailLeads.filter(l => [l.company_name, l.contact_person, l.owner, l.email, l.phone].some(v => (v || '').toLowerCase().includes(q)))
  }

  // Group view search
  const groupSearchFiltered = search
    ? Object.fromEntries(
      Object.entries(groups).map(([k, ls]) => [k, ls.filter(l => [l.company_name, l.contact_person, l.owner, l.event_name].some(v => (v || '').toLowerCase().includes(search.toLowerCase())))])
    )
    : groups

  const allDetailIds = detailLeads.map(l => l.id)

  if (loading) return <div className="view wide"><div style={{ color: 'var(--muted)', padding: 40 }}>{t('loading')}</div></div>

  return (
    <div className="view wide">
      {viewMode === 'group' ? (
        <>
          <div className="sec-hdr">
            <div className="bar" />
            <div className="txt">{t('s_leads_title')}</div>
            <div className="sub">{t('s_leads_sub')}</div>
          </div>

          {/* 숨겨진 file inputs */}
          <input id="pdf-input" type="file" accept=".pdf" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) { setPdfFileName(f.name); showToast(`📎 "${f.name}" 첨부됨`) }; e.target.value = '' }} />
          <input id="excel-input" type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleExcelFile(f); e.target.value = '' }} />

          {/* 액션 버튼 */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => setShowRegister(true)}>{t('s_register')}</button>
            <button className="btn btn-outline btn-sm" onClick={() => document.getElementById('pdf-input')?.click()}
              style={pdfFileName ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}>
              📎 {pdfFileName ? pdfFileName.replace(/(.{14}).+(\.[^.]+)$/, '$1…$2') : 'PDF'}
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => document.getElementById('excel-input')?.click()}>📤 Excel Upload</button>
            <button className="btn btn-outline btn-sm" onClick={downloadTemplate}>📋 Template</button>
            <button className="btn btn-outline btn-sm" onClick={() => exportCSV([])}>{t('export_excel')}</button>
          </div>

          {/* 그룹 + 검색 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>{t('s_group_by')}</span>
            {([['event', t('s_event')], ['date', t('s_date')], ['source', 'Source']] as const).map(([k, lbl]) => (
              <button key={k} onClick={() => setGroupBy(k)}
                style={{ padding: '5px 12px', borderRadius: 7, fontSize: 13, cursor: 'pointer', fontWeight: 600, background: groupBy === k ? 'var(--accent)' : 'white', color: groupBy === k ? 'white' : 'var(--muted)', border: `1.5px solid ${groupBy === k ? 'var(--accent)' : 'var(--border2)'}` }}>
                {lbl}
              </button>
            ))}
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search_placeholder')}
              style={{ flex: 1, minWidth: 200, padding: '7px 12px', border: '1px solid var(--border2)', borderRadius: 7, fontSize: 13 }} />
            {filterOwner && (
              <span style={{ background: '#EEF2FF', color: '#4F46E5', padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                👤 {filterOwner}
                <button onClick={() => setFilterOwner(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4F46E5', fontSize: 13, marginLeft: 2 }}>✕</button>
              </span>
            )}
            {filterStage && (
              <span style={{ background: '#FEF2F2', color: '#DC2626', padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                📊 {filterStage}
                <button onClick={() => setFilterStage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontSize: 13, marginLeft: 2 }}>✕</button>
              </span>
            )}
            {filterCorridor && (
              <span style={{ background: '#F0FFF4', color: '#059669', padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                🌏 {filterCorridor}
                <button onClick={() => setFilterCorridor(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#059669', fontSize: 13, marginLeft: 2 }}>✕</button>
              </span>
            )}
            <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{t('total')} {filteredLeads.length}</span>
          </div>

          {/* 그룹 테이블 */}
          <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 900 }}>
                <thead>
                  <tr style={{ background: 'var(--accent)', color: 'white' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>{t('group_lbl')}</th>
                    <th style={{ padding: '10px 10px', textAlign: 'center' }}>Total</th>
                    {STAGE_ORDER.map(s => (
                      <th key={s} style={{ padding: '10px 6px', textAlign: 'center', fontSize: 10, whiteSpace: 'nowrap' }}>{s}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(groupSearchFiltered).filter(([, ls]) => ls.length > 0).map(([k, ls]) => (
                    <tr key={k} style={{ cursor: 'pointer', transition: 'background .1s' }}
                      onClick={() => { setGroupKey(k); setViewMode('detail') }}
                      onMouseOver={e => Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(td => (td.style.background = '#FDF5F5'))}
                      onMouseOut={e => Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(td => (td.style.background = ''))}>
                      <td style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--accent)' }}>{k}</td>
                      <td style={{ padding: '11px 10px', textAlign: 'center', fontWeight: 700 }}>{ls.length}</td>
                      {STAGE_ORDER.map(s => {
                        const cnt = ls.filter(l => l.current_stage === s).length
                        const col = STAGE_COLORS[s]?.bg || '#888'
                        return <td key={s} style={{ padding: '11px 6px', textAlign: 'center', color: col, fontWeight: 600 }}>{cnt || '—'}</td>
                      })}
                    </tr>
                  ))}
                  {Object.keys(groupSearchFiltered).length === 0 && (
                    <tr><td colSpan={2 + STAGE_ORDER.length} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>{t('no_leads')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Detail View */
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <button className="btn btn-outline btn-sm" onClick={() => { setViewMode('group'); setGroupKey(null); setStageFilter(null); setSearch('') }}>{t('back_to_list')}</button>
            <div className="sec-hdr" style={{ margin: 0, flex: 1 }}>
              <div className="bar" />
              <span className="txt">👥 {groupKey || '전체'}</span>
              <span className="sub">{detailLeads.length}개</span>
            </div>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search_short')}
              style={{ padding: '7px 12px', border: '1px solid var(--border2)', borderRadius: 7, fontSize: 13, width: 200 }} />
            <button className="btn btn-primary btn-sm" onClick={() => setShowRegister(true)}>+ 등록</button>
          </div>

          {/* Stage 필터 바 */}
          <div style={{ marginBottom: 12, padding: '8px 12px', background: 'white', border: '0.5px solid var(--border2)', borderRadius: 9, display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginRight: 8 }}>Stage:</span>
            {STAGE_ORDER.map(s => {
              const cnt = detailLeads.filter(l => l.current_stage === s).length
              if (!cnt) return null
              const c = STAGE_COLORS[s] || { bg: '#6B7280' }
              const active = stageFilter === s
              return (
                <span key={s} onClick={() => setStageFilter(active ? null : s)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 99, cursor: 'pointer', margin: 3, border: `1.5px solid ${c.bg}`, background: active ? c.bg : 'white', color: active ? 'white' : c.bg, fontSize: 11, fontWeight: 700, transition: 'all .15s' }}>
                  {s} <b>{cnt}</b>
                </span>
              )
            })}
            {stageFilter && (
              <button onClick={() => setStageFilter(null)} style={{ padding: '3px 8px', borderRadius: 99, background: 'var(--light)', border: '1px solid var(--border2)', fontSize: 11, cursor: 'pointer', margin: 3 }}>{t('clear_filter')}</button>
            )}
          </div>

          {/* 액션 바 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--border)', background: '#FAFAFA', marginBottom: 0 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={allDetailIds.length > 0 && allDetailIds.every(i => checked.has(i))} onChange={() => toggleCheck('', allDetailIds)} style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }} />
              {t('select_all')}
            </label>
            <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, minWidth: 70 }}>{checked.size > 0 ? `${checked.size}개 선택됨` : ''}</span>
            <div style={{ marginLeft: 'auto' }}>
              <button onClick={() => exportCSV()} style={{ padding: '6px 14px', borderRadius: 7, background: 'white', border: '1.5px solid #059669', color: '#059669', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {t('export_excel')}
              </button>
            </div>
          </div>

          <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 1180 }}>
                <thead>
                  <tr style={{ background: 'var(--accent)', color: 'white' }}>
                    <th style={{ padding: '9px 10px', width: 38 }}><input type="checkbox" style={{ width: 15, height: 15, cursor: 'pointer' }} /></th>
                    <th style={{ padding: '9px 12px' }}>SN</th>
                    <th style={{ padding: '9px 12px' }}>{t('registered_date_lbl')}</th>
                    <th style={{ padding: '9px 12px' }}>{t('s_event')}</th>
                    <th style={{ padding: '9px 12px', textAlign: 'left' }}>Company</th>
                    <th style={{ padding: '9px 12px' }}>{t('owner_lbl')}</th>
                    <th style={{ padding: '9px 12px' }}>Phone/Email</th>
                    <th style={{ padding: '9px 12px' }}>Source</th>
                    <th style={{ padding: '9px 12px' }}>Owner</th>
                    <th style={{ padding: '9px 12px' }}>Stage</th>
                    <th style={{ padding: '9px 12px' }}>Last Contact</th>
                    <th style={{ padding: '9px 12px' }}>Next Action</th>
                    <th style={{ padding: '9px 12px' }}>Follow-up</th>
                  </tr>
                </thead>
                <tbody>
                  {detailLeads.map(l => (
                    <tr key={l.id} style={{ borderBottom: '0.5px solid var(--border)', cursor: 'pointer', transition: 'background .1s' }}
                      onClick={() => setSelectedLeadId(l.id)}
                      onMouseOver={e => Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(td => (td.style.background = '#FDF5F5'))}
                      onMouseOut={e => Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(td => (td.style.background = ''))}>
                      <td style={{ padding: '9px 10px', textAlign: 'center' }} onClick={e => { e.stopPropagation(); toggleCheck(l.id) }}>
                        <input type="checkbox" checked={checked.has(l.id)} onChange={() => toggleCheck(l.id)} style={{ width: 15, height: 15, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                      </td>
                      <td style={{ padding: '9px 12px', color: 'var(--muted)', fontWeight: 600 }}>{l.serial_no}</td>
                      <td style={{ padding: '9px 12px' }}>{l.registered_date}</td>
                      <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--muted)' }}>{l.event_name.replace(/ 20\d\d$/, '')}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 700 }}>{l.company_name}</td>
                      <td style={{ padding: '9px 12px' }}>{l.contact_person}</td>
                      <td style={{ padding: '9px 12px', fontSize: 11 }}>{l.phone || '—'}<br /><span style={{ color: 'var(--muted)' }}>{l.email || '—'}</span></td>
                      <td style={{ padding: '9px 12px', fontSize: 12 }}>{l.lead_source}</td>
                      <td style={{ padding: '9px 12px' }}>{l.owner}</td>
                      <td style={{ padding: '9px 12px' }} onClick={e => e.stopPropagation()}>
                        <InlineStageSelect lead={l} onUpdate={updateStage} />
                      </td>
                      <td style={{ padding: '9px 12px', fontSize: 12 }}>{l.last_contact_date || '—'}</td>
                      <td style={{ padding: '9px 12px', fontSize: 11, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.next_action || '—'}</td>
                      <td style={{ padding: '9px 12px', fontSize: 12 }}>{l.next_follow_up_date || '—'}</td>
                    </tr>
                  ))}
                  {detailLeads.length === 0 && (
                    <tr><td colSpan={13} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>{t('no_leads')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Excel 미리보기 모달 */}
      {excelPreview && (
        <div className="modal-bg open">
          <div className="modal" style={{ width: 760 }}>
            <div className="modal-hdr">
              <h3>📤 Excel 업로드 미리보기</h3>
              <button className="modal-close" onClick={() => setExcelPreview(null)}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
              📎 "{excelPreview.fileName}" — 총 <strong>{excelPreview.rows.length}</strong>개 리드가 감지되었습니다.
            </div>
            <div style={{ overflowX: 'auto', maxHeight: 320, overflowY: 'auto', border: '0.5px solid var(--border2)', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--accent)', color: 'white', position: 'sticky', top: 0 }}>
                    <th style={{ padding: '7px 10px' }}>#</th>
                    <th style={{ padding: '7px 10px', textAlign: 'left' }}>Company</th>
                    <th style={{ padding: '7px 10px', textAlign: 'left' }}>Contact</th>
                    <th style={{ padding: '7px 10px', textAlign: 'left' }}>Phone / Email</th>
                    <th style={{ padding: '7px 10px', textAlign: 'left' }}>Event</th>
                    <th style={{ padding: '7px 10px' }}>Owner</th>
                    <th style={{ padding: '7px 10px' }}>Priority</th>
                    <th style={{ padding: '7px 10px' }}>Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {excelPreview.rows.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '0.5px solid var(--border)', background: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                      <td style={{ padding: '6px 10px', color: 'var(--muted)', textAlign: 'center' }}>{i + 1}</td>
                      <td style={{ padding: '6px 10px', fontWeight: 700 }}>{r.company_name}</td>
                      <td style={{ padding: '6px 10px' }}>{r.contact_person || '—'}</td>
                      <td style={{ padding: '6px 10px', fontSize: 11 }}>{r.phone || '—'}<br /><span style={{ color: 'var(--muted)' }}>{r.email || '—'}</span></td>
                      <td style={{ padding: '6px 10px', fontSize: 11 }}>{r.event_name || '—'}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center' }}>{r.owner}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center' }}>{r.priority}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                        <StageBadge stage={r.current_stage || 'New Lead'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10, padding: '8px 12px', background: 'var(--light)', borderRadius: 7 }}>
              ⚠️ 회사명이 비어 있는 행은 자동 제외됩니다. &nbsp;·&nbsp; Stage 컬럼이 비어 있으면 "New Lead"로 등록됩니다. &nbsp;·&nbsp; 유효하지 않은 Stage 값도 "New Lead"로 처리됩니다.
            </div>
            <div className="modal-footer">
              <button className="btn btn-muted" onClick={() => setExcelPreview(null)}>취소</button>
              <button className="btn btn-primary" onClick={() => bulkRegisterLeads(excelPreview.rows)} disabled={importing}>
                {importing ? '등록 중...' : `✅ ${excelPreview.rows.length}개 모두 등록`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lead 등록 모달 */}
      {showRegister && (
        <div className="modal-bg open">
          <div className="modal" style={{ width: 640 }}>
            <div className="modal-hdr">
              <h3>{t('register_lead_title')}</h3>
              <button className="modal-close" onClick={() => { setShowRegister(false); resetForm() }}>✕</button>
            </div>
            <div className="form-row cols2">
              <div><label style={{ marginTop: 0 }}>{t('company_name_lbl')}</label><input value={form.company_name || ''} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} placeholder="회사명" /></div>
              <div><label style={{ marginTop: 0 }}>{t('contact_person_lbl')}</label><input value={form.contact_person || ''} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} placeholder="담당자명" /></div>
              <div><label style={{ marginTop: 0 }}>{t('phone_lbl')}</label><input value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="전화번호" /></div>
              <div><label style={{ marginTop: 0 }}>{t('email_lbl')}</label><input type="email" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="이메일" /></div>
              <div>
                <label style={{ marginTop: 0 }}>{t('lead_source_lbl')}</label>
                <select value={form.lead_source || 'Expo'} onChange={e => setForm(f => ({ ...f, lead_source: e.target.value }))}>
                  {(settings?.sources || []).map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ marginTop: 0 }}>{t('event_name_lbl')}</label>
                <select value={form.event_name || ''} onChange={e => setForm(f => ({ ...f, event_name: e.target.value }))}>
                  <option value="">{t('select_event')}</option>
                  {(settings?.event_names || []).map(ev => <option key={ev}>{ev}</option>)}
                </select>
              </div>
              <div>
                <label style={{ marginTop: 0 }}>{t('owner_lbl')}</label>
                <select value={form.owner || 'Andrew'} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))}>
                  {(settings?.owners || []).map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label style={{ marginTop: 0 }}>{t('priority_lbl')}</label>
                <select value={form.priority || 'Medium'} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  {['High', 'Medium', 'Low'].map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={{ marginTop: 0 }}>{t('corridor_lbl')}</label>
                <select value={form.country_corridor || ''} onChange={e => setForm(f => ({ ...f, country_corridor: e.target.value }))}>
                  {(settings?.corridors || []).map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ marginTop: 0 }}>{t('biz_type_lbl')}</label>
                <select value={form.business_type || ''} onChange={e => setForm(f => ({ ...f, business_type: e.target.value }))}>
                  {(settings?.business_types || []).map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label style={{ marginTop: 0 }}>{t('expected_vol_lbl')}</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input type="number" value={form.expected_monthly_volume || ''} onChange={e => setForm(f => ({ ...f, expected_monthly_volume: parseInt(e.target.value) || null }))} placeholder="월 예상 금액" style={{ flex: 1 }} />
                  <select value={form.volume_currency || 'USD'} onChange={e => setForm(f => ({ ...f, volume_currency: e.target.value }))} style={{ minWidth: 70 }}>
                    <option>USD</option><option>KRW</option>
                  </select>
                </div>
              </div>
              <div><label style={{ marginTop: 0 }}>{t('address_lbl')}</label><input value={form.address || ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="주소" /></div>
            </div>
            <label>{t('remarks_lbl')}</label>
            <textarea value={form.remarks || ''} rows={2} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} style={{ resize: 'vertical', fontFamily: 'inherit' }} />
            <div className="modal-footer">
              <button className="btn btn-muted" onClick={() => { setShowRegister(false); resetForm() }}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={register}>{t('register_btn')}</button>
            </div>
          </div>
        </div>
      )}

      {selectedLeadId && (
        <LeadDetailPanel leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} onRefresh={load} />
      )}
    </div>
  )
}
