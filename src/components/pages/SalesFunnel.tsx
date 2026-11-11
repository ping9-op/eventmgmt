import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { STAGE_ORDER, STAGE_COLORS, isInProgressStage, localDateStr } from '../../lib/utils'
import { logStageChange } from '../../lib/stageHistory'
import type { SalesLead } from '../../types/database'
import { loadAllSettings } from '../../lib/settings'
import LeadDetailPanel from './LeadDetailPanel'
import OwnerBadge from '../OwnerBadge'
import LostReasonModal, { LeadContactMeta, type LostReasonInput } from '../LostReasonModal'
import { useLang } from '../../contexts/LangContext'
import { useToast } from '../../contexts/ToastContext'
import { useIsMobile } from '../../hooks/useBreakpoint'
import LoadingSpinner from '../LoadingSpinner'
import { loadAllEventRefs, type EventRef } from '../../lib/events'
import { decryptRows, PII_FIELDS } from '../../lib/pii'
import { toEventRefMap, leadEventLabel } from '../../lib/leadEvents'

type TabType = 'board' | 'table'

const CONTRACT_STATUSES = ['Not Sent', 'Sent', 'Under Review', 'Revision Requested', 'Signed', 'Rejected']
const ONBOARD_STATUSES = ['Not Started', 'Waiting Docs', 'Under Review', 'Approved', 'Rejected', 'Completed']

export default function SalesFunnel() {
  const { t } = useLang()
  const { showToast } = useToast()
  const location = useLocation()
  const isMobile = useIsMobile()
  const [owners, setOwners] = useState<string[]>([])
  useEffect(() => { loadAllSettings().then(s => setOwners(s.owners)) }, [])
  // 리드 행사 표시명 (박람회 행사는 proposal_id 기준 현재 이름)
  const [eventRefs, setEventRefs] = useState<EventRef[]>([])
  useEffect(() => { loadAllEventRefs().then(setEventRefs).catch(() => {}) }, [])
  const refMap = toEventRefMap(eventRefs)
  const evLabel = (l: SalesLead) => leadEventLabel(l, refMap)

  const KPI_CARDS = [
    { lbl: t('total'), stage: null as string | null, col: 'var(--text)' },
    { lbl: 'New Lead', stage: 'New Lead', col: '#6B7280' },
    { lbl: 'Outreach Sent', stage: 'Outreach Sent', col: '#D97706' },
    { lbl: 'Proposal', stage: 'Proposal Sent', col: '#4F46E5' },
    { lbl: 'Onboarding', stage: 'Onboarding', col: '#059669' },
    { lbl: 'Won ✅', stage: 'Won', col: '#065F46' },
    { lbl: 'Lost', stage: 'Lost', col: '#DC2626' },
    { lbl: t('conversion_rate'), stage: '__conv__', col: '#7C3AED' },
  ]
  const [leads, setLeads] = useState<SalesLead[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabType>('board')
  const [filterOwner, setFilterOwner] = useState('')
  const [filterStage, setFilterStage] = useState<string | null>(null)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [tableSearch, setTableSearch] = useState('')
  const [pendingLostId, setPendingLostId] = useState<string | null>(null)

  // 보드 가로 스크롤: 상단 슬라이드 바 ↔ 보드 본문 ↔ 단계 헤더 동기화
  const boardRef = useRef<HTMLDivElement>(null)
  const topBarRef = useRef<HTMLDivElement>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const [boardScrollW, setBoardScrollW] = useState(0)

  useEffect(() => {
    const el = boardRef.current
    if (!el) return
    const update = () => setBoardScrollW(el.scrollWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    return () => ro.disconnect()
  }, [tab, loading])

  function syncBoardScroll(from: 'board' | 'bar') {
    const board = boardRef.current, bar = topBarRef.current
    if (!board || !bar) return
    const x = from === 'board' ? board.scrollLeft : bar.scrollLeft
    if (from === 'board' && bar.scrollLeft !== x) bar.scrollLeft = x
    if (from === 'bar' && board.scrollLeft !== x) board.scrollLeft = x
    if (headRef.current) headRef.current.scrollLeft = x
  }

  useEffect(() => {
    let cancelled = false
    const state = (location.state as any)
    if (state?.filter) {
      if (state.filter !== null) setFilterStage(state.filter)
    }
    if (state?.view) setTab(state.view as TabType)

    async function loadOnMount() {
      try {
        const { data: leadData, error: le } = await supabase.from('sales_leads').select('*').is('archived_at', null)
        if (le) throw le
        const plainLeads = await decryptRows('sales_leads', (leadData || []) as SalesLead[])
        if (cancelled) return
        setLeads(plainLeads)
      } catch (err: any) {
        showToast('데이터를 불러오는 중 오류가 발생했습니다.', 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadOnMount()
    return () => { cancelled = true }
  }, [])

  // '__active__' 필터는 여러 스테이지에 걸쳐 있어 Board View와 맞지 않으므로 자동으로 Table View로 전환
  useEffect(() => {
    if (filterStage === '__active__' && tab === 'board') setTab('table')
  }, [filterStage, tab])

  async function load() {
    try {
      const { data: leadData, error: le } = await supabase.from('sales_leads').select('*').is('archived_at', null)
      if (le) throw le
      setLeads(await decryptRows('sales_leads', (leadData || []) as SalesLead[]))
    } catch (err: any) {
      console.error('SalesFunnel load error:', err?.message)
    } finally {
      setLoading(false)
    }
  }

  async function moveStage(leadId: string, stage: string, lost?: LostReasonInput) {
    if (stage === 'Lost' && !lost) { setPendingLostId(leadId); return }
    const prev = leads.find(l => l.id === leadId)?.current_stage || null
    // last_contact_date / lost_at_stage / 다음 할 일(자동 배정 후 next_action)은 DB 트리거가 채우므로 변경 후 다시 읽어온다
    // (UPDATE 응답에는 그 뒤에 실행되는 할 일 트리거의 변경이 빠져 있음)
    const { error } = await supabase.from('sales_leads').update({ current_stage: stage, ...lost }).eq('id', leadId)
    const { data } = error ? { data: null } : await supabase.from('sales_leads').select('*').eq('id', leadId).single()
    if (!error && data) {
      // DB가 돌려준 행의 개인정보 필드는 암호문이므로 화면의 복호화된 값을 유지
      setLeads(p => p.map(l => l.id === leadId
        ? { ...(data as SalesLead), ...Object.fromEntries(PII_FIELDS.sales_leads.map(f => [f, l[f]])) }
        : l))
      logStageChange(leadId, prev, stage)
    } else if (error) showToast('단계 변경에 실패했습니다.', 'error')
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
    const H = ['Company', 'Contact', 'Stage', 'Owner', 'Volume', 'Last Contact', 'Next Follow-up']
    const rows = toExport.map(l => [l.company_name, l.contact_person, l.current_stage, l.owner, `${l.volume_currency} ${l.expected_monthly_volume || 0}`, l.last_contact_date || '', l.next_follow_up_date || ''])
    const csv = [H, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = Object.assign(document.createElement('a'), { href: 'data:text/csv;charset=utf-8,﻿' + encodeURIComponent(csv), download: `GME_Funnel_${localDateStr()}.csv` })
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setChecked(new Set())
  }

  if (loading) return <div className="view wide"><LoadingSpinner /></div>

  const total = leads.length
  const byS = (s: string) => leads.filter(l => l.current_stage === s).length
  const won = byS('Won')
  const conv = total ? Math.round(won / total * 100) : 0

  function kpiVal(k: typeof KPI_CARDS[0]): string | number {
    if (k.stage === null) return total
    if (k.stage === '__conv__') return conv + '%'
    return byS(k.stage)
  }

  const baseFiltered = filterOwner ? leads.filter(l => l.owner === filterOwner) : leads
  const filtered = filterStage
    ? filterStage === '__active__'
      ? baseFiltered.filter(l => isInProgressStage(l.current_stage)) // 대시보드 '진행중' 카드와 같은 기준 (온보딩 제외)
      : baseFiltered.filter(l => l.current_stage === filterStage)
    : baseFiltered

  const tableFiltered = tableSearch
    ? filtered.filter(l => `${l.company_name} ${l.contact_person} ${evLabel(l)}`.toLowerCase().includes(tableSearch.toLowerCase()))
    : filtered
  const allIds = tableFiltered.map(l => l.id)

  const tabs: { id: TabType; label: string }[] = [
    { id: 'board', label: t('s_board_view') },
    { id: 'table', label: t('s_table_view') },
  ]

  return (
    <div className="view wide">
      <div className="page-hdr-row">
        <div className="sec-hdr">
          <div className="bar" />
          <div className="txt">{t('s_funnel_title')}</div>
          <div className="sub">{t('s_funnel_sub')}</div>
        </div>
        <div className="page-hdr-actions">
          <select value={filterOwner} onChange={e => setFilterOwner(e.target.value)} style={{ minWidth: 130, width: '100%' }}>
            <option value="">{t('all_owners')}</option>
            {owners.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
      </div>

      {/* 탭 바 (프로토타입 스타일 - 언더라인) */}
      <div style={{ display: 'flex', overflowX: 'auto', background: '#F5F0F0', borderBottom: '1px solid var(--border2)', padding: '0 0', gap: 0, marginTop: 12 }}>
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
        <div className="g4" style={{ gap: 10, marginBottom: 14 }}>
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
            <button onClick={() => setFilterStage(null)} style={{ padding: '3px 10px', borderRadius: 5, background: 'white', border: '1px solid var(--border2)', fontSize: 12, cursor: 'pointer', marginLeft: 'auto' }}>{t('clear_view_all')}</button>
          </div>
        )}

        {/* 보드 뷰 */}
        {tab === 'board' && (
          <div style={{ paddingBottom: 16 }}>
            {/* 상단 고정 영역: 가로 슬라이드 바 + 단계 헤더 (리드가 많아도 스크롤 없이 바로 좌우 이동) */}
            <div style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--bg)', paddingTop: 4 }}>
              <div ref={topBarRef} onScroll={() => syncBoardScroll('bar')}
                style={{ overflowX: 'auto', overflowY: 'hidden', height: 16, marginBottom: 4 }}>
                <div style={{ width: boardScrollW, height: 1 }} />
              </div>
              <div ref={headRef} style={{ overflow: 'hidden' }}>
                <div style={{ display: 'flex', gap: 12, minWidth: 'max-content' }}>
                  {STAGE_ORDER.map(stage => {
                    const c = STAGE_COLORS[stage] || { bg: '#6B7280', light: '#F3F4F6' }
                    return (
                      <div key={stage} style={{ width: 210, flexShrink: 0, background: c.bg, color: 'white', padding: '9px 12px', borderRadius: '10px 10px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box' }}>
                        <span style={{ fontSize: 11, fontWeight: 700 }}>{stage}</span>
                        <span style={{ background: 'rgba(255,255,255,.25)', borderRadius: 99, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{filtered.filter(l => l.current_stage === stage).length}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            <div ref={boardRef} className="no-scrollbar" onScroll={() => syncBoardScroll('board')} style={{ overflowX: 'auto' }}>
            <div style={{ display: 'flex', gap: 12, minWidth: 'max-content' }}>
              {STAGE_ORDER.map(stage => {
                const c = STAGE_COLORS[stage] || { bg: '#6B7280', light: '#F3F4F6' }
                const stageLeads = filtered.filter(l => l.current_stage === stage)
                return (
                  <div key={stage} style={{ width: 210, flexShrink: 0 }}>
                    <div style={{ background: '#F8F4F4', border: `1px solid ${c.bg}40`, borderTop: 'none', borderRadius: '0 0 10px 10px', minHeight: 160, padding: 8, display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {stageLeads.map(l => (
                        <div key={l.id}
                          style={{ background: 'white', borderRadius: 8, padding: 10, border: '0.5px solid var(--border2)', cursor: 'pointer', transition: 'box-shadow .15s,transform .15s' }}
                          onClick={() => setSelectedLeadId(l.id)}
                          onMouseOver={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 14px rgba(0,0,0,.12)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)' }}
                          onMouseOut={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = ''; (e.currentTarget as HTMLDivElement).style.transform = '' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{l.company_name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}><OwnerBadge owner={l.owner} /><span style={{ fontSize: 11, color: 'var(--muted)' }}>{l.contact_person}</span></div>
                          {evLabel(l) && <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>{evLabel(l)}</div>}
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>
                            {l.volume_currency === 'KRW' ? `₩${(l.expected_monthly_volume || 0).toLocaleString()}` : `$${(l.expected_monthly_volume || 0).toLocaleString()}`}
                          </div>
                          {l.next_action && <div style={{ fontSize: 10, color: '#4F46E5', marginBottom: 6 }}>→ {l.next_action}</div>}
                          {(l.outreach_channel || l.last_contact_date) && (
                            <div style={{ marginBottom: 6 }}><LeadContactMeta channel={l.outreach_channel} lastContact={l.last_contact_date} /></div>
                          )}
                          <div onClick={e => e.stopPropagation()}>
                            <select value={stage} onChange={e => { e.stopPropagation(); moveStage(l.id, e.target.value) }} onClick={e => e.stopPropagation()}
                              style={{ width: '100%', fontSize: 11, padding: '3px 5px', border: '1px solid var(--border2)', borderRadius: 5, background: c.light, cursor: 'pointer', minHeight: 44 }}>
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
          </div>
        )}

        {/* 테이블 뷰 */}
        {tab === 'table' && (
          <div style={{ background: isMobile ? 'transparent' : 'white', border: isMobile ? 'none' : '0.5px solid var(--border2)', borderRadius: 12, overflow: isMobile ? 'visible' : 'hidden' }}>
            <div style={{ padding: '10px 16px', borderBottom: isMobile ? 'none' : '1px solid var(--border)', marginBottom: isMobile ? 10 : 0, display: 'flex', alignItems: 'center', gap: 10, background: isMobile ? 'white' : 'transparent', borderRadius: isMobile ? 10 : 0, border: isMobile ? '0.5px solid var(--border2)' : 'none' }}>
              <input type="text" placeholder="🔍 Company, Contact 검색..." style={{ flex: 1, padding: '7px 12px', border: '1px solid var(--border2)', borderRadius: 7, fontSize: 13 }}
                value={tableSearch}
                onChange={e => setTableSearch(e.target.value)} />
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{tableFiltered.length}개</span>
            </div>
            {isMobile ? (
              /* 모바일 카드 뷰 */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {tableFiltered.map(l => {
                  const stageColor = STAGE_COLORS[l.current_stage]?.bg || '#6B7280'
                  return (
                    <div key={l.id}
                      style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, padding: '14px 16px', cursor: 'pointer' }}
                      onClick={() => setSelectedLeadId(l.id)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>{l.company_name}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}><OwnerBadge owner={l.owner} />{l.contact_person}</div>
                        </div>
                        <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, color: 'white', background: stageColor, flexShrink: 0, marginLeft: 8 }}>
                          {l.current_stage}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
                        {evLabel(l) && `${evLabel(l)} · `}{l.volume_currency === 'KRW' ? `₩${(l.expected_monthly_volume || 0).toLocaleString()}` : `$${(l.expected_monthly_volume || 0).toLocaleString()}`}
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--muted)', flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                        <LeadContactMeta channel={l.outreach_channel} lastContact={l.last_contact_date} />
                        {l.next_follow_up_date && <span style={{ color: '#4F46E5', fontWeight: 600 }}>팔업: {l.next_follow_up_date}</span>}
                      </div>
                      <div onClick={e => e.stopPropagation()}>
                        <select value={l.current_stage} onChange={e => { e.stopPropagation(); moveStage(l.id, e.target.value) }} onClick={e => e.stopPropagation()}
                          style={{ width: '100%', fontSize: 12, padding: '8px 10px', border: '1.5px solid var(--border2)', borderRadius: 7, background: 'white', cursor: 'pointer', minHeight: 44 }}>
                          {STAGE_ORDER.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                  )
                })}
                {tableFiltered.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 32, background: 'white', borderRadius: 12, border: '0.5px solid var(--border2)' }}>{t('no_matching_leads')}</div>
                )}
              </div>
            ) : (
              /* 데스크탑 테이블 뷰 */
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border)', background: '#FAFAFA' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer', userSelect: 'none' }}>
                    <input type="checkbox" checked={allIds.length > 0 && allIds.every(i => checked.has(i))} onChange={() => toggleCheck('', allIds)} style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                    {t('select_all')}
                  </label>
                  <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, minWidth: 70 }}>{checked.size > 0 ? `${checked.size}개 선택됨` : ''}</span>
                  <div style={{ marginLeft: 'auto' }}>
                    <button onClick={exportCSV} style={{ padding: '6px 14px', borderRadius: 7, background: 'white', border: '1.5px solid #059669', color: '#059669', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>⬇️ {t('export_excel')}</button>
                  </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 1050 }}>
                    <thead>
                      <tr style={{ background: 'var(--accent)', color: 'white' }}>
                        <th style={{ padding: '9px 10px', width: 38 }}><input type="checkbox" checked={allIds.length > 0 && allIds.every(i => checked.has(i))} onChange={() => toggleCheck('', allIds)} style={{ width: 15, height: 15, cursor: 'pointer' }} /></th>
                        <th style={{ padding: '9px 12px', textAlign: 'left' }}>{t('col_company')}</th>
                        <th style={{ padding: '9px 12px' }}>Event</th>
                        <th style={{ padding: '9px 12px' }}>{t('col_owner')}</th>
                        <th style={{ padding: '9px 12px' }}>1st</th>
                        <th style={{ padding: '9px 12px' }}>{t('col_stage')}</th>
                        <th style={{ padding: '9px 12px' }}>{t('col_last_contact')}</th>
                        <th style={{ padding: '9px 12px' }}>Follow-up</th>
                        <th style={{ padding: '9px 12px', textAlign: 'right' }}>{t('col_vol')}</th>
                        <th style={{ padding: '9px 12px' }}>Lost Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableFiltered.map(l => (
                        <tr key={l.id} style={{ borderBottom: '0.5px solid var(--border)', cursor: 'pointer', transition: 'background .1s' }}
                          onClick={() => setSelectedLeadId(l.id)}
                          onMouseOver={e => Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(td => (td.style.background = '#FDF5F5'))}
                          onMouseOut={e => Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(td => (td.style.background = ''))}>
                          <td style={{ padding: '9px 10px', textAlign: 'center' }} onClick={e => { e.stopPropagation(); toggleCheck(l.id) }}>
                            <input type="checkbox" checked={checked.has(l.id)} onChange={() => toggleCheck(l.id)} style={{ width: 15, height: 15, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                          </td>
                          <td style={{ padding: '9px 12px', fontWeight: 700 }}>{l.company_name}<br /><span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>{l.contact_person}</span></td>
                          <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--muted)' }}>{evLabel(l) || '—'}</td>
                          <td style={{ padding: '9px 12px' }}><OwnerBadge owner={l.owner} /></td>
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
                          <td style={{ padding: '9px 12px', fontSize: 11, color: '#DC2626' }}>{l.lost_reason || '—'}</td>
                        </tr>
                      ))}
                      {tableFiltered.length === 0 && <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>{t('no_matching_leads')}</td></tr>}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {selectedLeadId && (
        <LeadDetailPanel leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} onRefresh={load} />
      )}

      {pendingLostId && (
        <LostReasonModal
          onCancel={() => setPendingLostId(null)}
          onConfirm={async v => { await moveStage(pendingLostId, 'Lost', v); setPendingLostId(null) }} />
      )}
    </div>
  )
}
