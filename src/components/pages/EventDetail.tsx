import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { exhColor, formatEventDate, costColor } from '../../lib/utils'
import { useToast } from '../../contexts/ToastContext'
import type { Payment } from '../../types/database'
import ProposalEditModal from '../ProposalEditModal'
import { useLang } from '../../contexts/LangContext'

type TabId = 'overview' | 'budget' | 'checklist' | 'design' | 'gifts' | 'equipment' | 'itinerary'

interface SubItem { text: string; status: string }
interface ChecklistItem {
  sn: number; item: string; pic: string; deadline: string
  status: string; remarks: string; subitems: SubItem[]
  detail?: string
}

const PAYMENT_METHODS = ['계좌이체', '카드']

function parseFinalDue(val: string | null): { date: string; method: string } {
  if (!val) return { date: '', method: '' }
  if (val.startsWith('METHOD:')) return { date: '', method: val.slice(7) }
  const idx = val.indexOf('|METHOD:')
  if (idx >= 0) return { date: val.slice(0, idx), method: val.slice(idx + 8) }
  return { date: val, method: '' }
}

function encodeFinalDue(date: string, method: string): string | null {
  if (!date && !method) return null
  if (!date) return `METHOD:${method}`
  if (!method) return date
  return `${date}|METHOD:${method}`
}

const STATUS_OPTS = ['Plan', 'Progress', 'Done', 'Urgent', 'Cancel']
const STATUS_COLORS: Record<string, string> = {
  Done: '#2E7D51', Progress: '#C47D1A', Plan: '#7B8AA0', Urgent: '#C0392B', Cancel: '#9CA3AF'
}
const SUB_CYCLE = ['Plan', 'Progress', 'Done']
const OWNERS = ['Andrew', 'Jacey', 'Violet', 'John', 'All']
const CUR_SYM: Record<string, string> = { KRW: '₩', JPY: '¥', USD: '$', EUR: '€', SGD: 'S$' }
const CURRENCIES = ['KRW', 'JPY', 'USD', 'EUR', 'SGD']

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { sn: 1, item: '항공권 & 숙박 예약', pic: 'Andrew', deadline: '', status: 'Plan', remarks: '', subitems: [] },
  { sn: 2, item: '부스 이벤트 기획', pic: 'Andrew', deadline: '', status: 'Plan', remarks: '', subitems: [] },
  { sn: 3, item: '부스 디자인 (백드롭, 스탠드)', pic: 'Andrew', deadline: '', status: 'Plan', remarks: '', subitems: [] },
  { sn: 4, item: '인쇄물 주문 (X배너, 플라이어)', pic: 'All', deadline: '', status: 'Plan', remarks: '', subitems: [] },
  { sn: 5, item: '자체 제작 디자인 (QR가이드, 폼보드)', pic: 'Jacey', deadline: '', status: 'Plan', remarks: '', subitems: [] },
  { sn: 6, item: '이벤트 경품 준비', pic: 'Andrew', deadline: '', status: 'Plan', remarks: '', subitems: [] },
  { sn: 7, item: '신규 가입 선물 준비', pic: 'Andrew', deadline: '', status: 'Plan', remarks: '', subitems: [] },
  { sn: 8, item: '부스 잔금 & 시설 이용료 납부', pic: 'Andrew', deadline: '', status: 'Plan', remarks: '', subitems: [] },
  { sn: 9, item: 'SNS 홍보', pic: 'Jacey', deadline: '', status: 'Plan', remarks: '', subitems: [] },
  { sn: 10, item: '부스 사전 점검', pic: 'All', deadline: '', status: 'Plan', remarks: '', subitems: [] },
  { sn: 11, item: '입장 패스 관리', pic: 'Jacey', deadline: '', status: 'Plan', remarks: '', subitems: [] },
  { sn: 12, item: '박람회 운영', pic: 'All', deadline: '', status: 'Plan', remarks: '', subitems: [] },
]

const DEFAULT_DESIGN = [
  { sn: 1, category: '백드롭', item: '부스 백드롭', size: '970×2290mm', qty: '6(3ea each)', spec: '포스터 행거, PET 시트', deadline: '', status: 'Plan', note: '' },
  { sn: 2, category: '인쇄물', item: '브로셔', size: 'A4 or A5', qty: '1200', spec: '랑데부 페이퍼 130g', deadline: '', status: 'Plan', note: '' },
  { sn: 3, category: '배너', item: 'X배너 (스탠드)', size: '600×1800mm', qty: '2', spec: '주목도 제고용', deadline: '', status: 'Plan', note: '' },
  { sn: 4, category: '배너', item: '테이블 배너', size: 'A5', qty: 'Free', spec: '서비스 QR 등', deadline: '', status: 'Plan', note: '' },
]

const DEFAULT_GIFTS_ONBOARD = [
  { sn: 1, prize: '온보딩', item: '허니 스틱', qty: 0, price: 29000, currency: 'KRW', note: '' },
  { sn: 2, prize: '온보딩', item: '더치 커피', qty: 0, price: 49800, currency: 'KRW', note: '' },
  { sn: 3, prize: '온보딩', item: '플라워 티', qty: 0, price: 44500, currency: 'KRW', note: '' },
]

const DEFAULT_GIFTS_EVENT = [
  { sn: 1, prize: '1등', item: '마스크팩', qty: 9, price: 10000, currency: 'KRW', note: '국내 구매 후 핸드캐리' },
  { sn: 2, prize: '2등', item: '베이글칩', qty: 18, price: 10000, currency: 'KRW', note: '국내 구매 후 핸드캐리' },
  { sn: 3, prize: '3등', item: '한국 전통 키링', qty: 90, price: 2200, currency: 'KRW', note: '' },
  { sn: 4, prize: '참가상', item: '달고나 캔디', qty: 500, price: 100, currency: 'KRW', note: '국내 구매 후 핸드캐리' },
]

const DEFAULT_EQUIPMENT = [
  { sn: 1, item: '멀티탭', qty: 1, note: '', done: false },
  { sn: 2, item: '변압기', qty: 1, note: '', done: false },
  { sn: 3, item: '테이블', qty: 2, note: '', done: false },
  { sn: 4, item: '의자', qty: 5, note: '', done: false },
  { sn: 5, item: '인포데스크', qty: 2, note: '', done: false },
  { sn: 6, item: '랩탑', qty: 2, note: '', done: false },
  { sn: 7, item: '브로셔', qty: 0, note: '현장 확인', done: false },
  { sn: 8, item: '선물 (경품)', qty: 0, note: '', done: false },
  { sn: 9, item: '가위', qty: 1, note: '', done: false },
  { sn: 10, item: '테이프 (양면 포함)', qty: 2, note: '', done: false },
  { sn: 11, item: 'Instagram QR 가이드', qty: 2, note: '', done: false },
  { sn: 12, item: '폼보드', qty: 0, note: '', done: false },
  { sn: 13, item: '명함', qty: 0, note: '', done: false },
  { sn: 14, item: '핸드벨', qty: 1, note: '이벤트용', done: false },
]

const DEFAULT_ITINERARY = [
  { sn: 1, date: '', day: '', time: '', activity: '', location: '', assignee: 'All', note: '' },
]

function migrateChecklist(items: any[]): ChecklistItem[] {
  return items.map(r => {
    if (!r.subitems) {
      return {
        ...r,
        subitems: r.detail
          ? String(r.detail).split('\n').filter((s: string) => s.trim())
              .map((s: string) => ({ text: s.trim(), status: 'Plan' }))
          : [],
      }
    }
    return r
  })
}

function fmtAmt(amt: number, cur: string) {
  return (CUR_SYM[cur] || cur) + Math.round(amt || 0).toLocaleString()
}

export default function EventDetail() {
  const { key, year } = useParams<{ key: string; year: string }>()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { t } = useLang()
  const [tab, setTab] = useState<TabId>('checklist')
  const [saving, setSaving] = useState(false)
  const [exhName, setExhName] = useState('')
  const [color, setColor] = useState('#B5363A')
  const [overview, setOverview] = useState<any>(null)
  const [prevOverview, setPrevOverview] = useState<any>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [design, setDesign] = useState<any[]>([])
  const [giftsOnboard, setGiftsOnboard] = useState<any[]>([])
  const [giftsEvent, setGiftsEvent] = useState<any[]>([])
  const [equipment, setEquipment] = useState<any[]>([])
  const [itinerary, setItinerary] = useState<any[]>([])
  const [dataId, setDataId] = useState<string | null>(null)
  const [showEpModal, setShowEpModal] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isDirty, setIsDirty] = useState(false)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [pendingNav, setPendingNav] = useState<(() => void) | null>(null)
  const justLoaded = useRef(true)

  const dbKey = `${key}_${year}`
  const yearNum = parseInt(year || '0')

  useEffect(() => {
    justLoaded.current = true
    setIsDirty(false)
    async function load() {
      const [{ data: exhData }, { data: allProps }, { data: evData }, { data: payData }] = await Promise.all([
        supabase.from('exhibitions').select('*').eq('key', key || '').single(),
        supabase.from('proposals').select('*').order('year'),
        supabase.from('event_data').select('*').eq('exhibition_key', dbKey).single(),
        supabase.from('payments').select('*').eq('exhibition_key', dbKey),
      ])
      let paymentsToSet = (payData || []) as unknown as Payment[]
      if (exhData) {
        setExhName(exhData.name)
        setColor(exhColor(exhData.name))
        const props = (allProps as any[])?.filter((p: any) => p.exhibition_id === exhData.id) || []
        const cur = props.find((p: any) => p.year === yearNum)
        const prev = [...props].filter((p: any) => p.year < yearNum).sort((a: any, b: any) => b.year - a.year)[0]
        if (cur) setOverview({ ...cur, budget: (cur.budget as any) || [] })
        if (prev) setPrevOverview({ ...prev, budget: (prev.budget as any) || [] })

        // 결제 일정이 없고 Proposal 예산 항목이 있으면 자동 생성
        if (paymentsToSet.length === 0 && cur) {
          const budgetItems = ((cur.budget as any[]) || []).filter((b: any) => b.item && b.curr > 0)
          if (budgetItems.length > 0) {
            const created: Payment[] = []
            for (const b of budgetItems) {
              const { data: newPay } = await supabase.from('payments').insert({
                exhibition_key: dbKey, item: b.item, total: b.curr,
                currency: b.currency || 'KRW',
                deposit_amount: 0, deposit_due: null, deposit_paid: false,
                final_amount: 0, final_due: null, final_paid: false,
              }).select().single()
              if (newPay) created.push(newPay as unknown as Payment)
            }
            if (created.length > 0) paymentsToSet = created
          }
        }
      }
      setPayments(paymentsToSet)
      if (evData) {
        setDataId(evData.id)
        setChecklist(migrateChecklist((evData.checklist as any) || DEFAULT_CHECKLIST))
        setDesign((evData.design as any) || DEFAULT_DESIGN)
        setGiftsOnboard((evData.gifts_onboard as any) || DEFAULT_GIFTS_ONBOARD)
        setGiftsEvent((evData.gifts_event as any) || DEFAULT_GIFTS_EVENT)
        setEquipment((evData.equipment as any) || DEFAULT_EQUIPMENT)
        setItinerary((evData.itinerary as any) || DEFAULT_ITINERARY)
      } else {
        setChecklist(JSON.parse(JSON.stringify(DEFAULT_CHECKLIST)))
        setDesign(JSON.parse(JSON.stringify(DEFAULT_DESIGN)))
        setGiftsOnboard(JSON.parse(JSON.stringify(DEFAULT_GIFTS_ONBOARD)))
        setGiftsEvent(JSON.parse(JSON.stringify(DEFAULT_GIFTS_EVENT)))
        setEquipment(JSON.parse(JSON.stringify(DEFAULT_EQUIPMENT)))
        setItinerary(JSON.parse(JSON.stringify(DEFAULT_ITINERARY)))
      }
    }
    load().then(() => {
      setTimeout(() => { justLoaded.current = false }, 100)
    })
  }, [key, year, refreshKey])

  // 변경사항 감지 — 로드 직후는 무시, 그 이후 변경만 추적
  useEffect(() => {
    if (justLoaded.current) return
    setIsDirty(true)
  }, [checklist, design, giftsOnboard, giftsEvent, equipment, itinerary])

  // 브라우저 새로고침/탭 닫기 방지
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // 미저장 상태에서 이탈 시 확인
  function safeNavigate(fn: () => void) {
    if (isDirty) { setPendingNav(() => fn); setShowLeaveModal(true) }
    else fn()
  }

  async function save() {
    setSaving(true)
    try {
      const payload = {
        exhibition_key: dbKey, tab,
        checklist: checklist as unknown as never,
        design: design as unknown as never,
        gifts_onboard: giftsOnboard as unknown as never,
        gifts_event: giftsEvent as unknown as never,
        equipment: equipment as unknown as never,
        itinerary: itinerary as unknown as never,
      }
      if (dataId) {
        const { error } = await supabase.from('event_data').update(payload).eq('id', dataId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('event_data').insert(payload).select().single()
        if (error) throw error
        if (data) setDataId((data as any).id)
      }
      setIsDirty(false)
      showToast('저장되었습니다.')
    } catch (err: any) {
      showToast('⚠️ 저장 실패: ' + (err?.message || '알 수 없는 오류'))
    } finally {
      setSaving(false)
    }
  }

  async function togglePaid(payId: string, type: 'deposit' | 'final') {
    const pay = payments.find(p => p.id === payId)
    if (!pay) return
    if (type === 'deposit') {
      const newVal = !pay.deposit_paid
      const { error } = await supabase.from('payments').update({ deposit_paid: newVal }).eq('id', payId)
      if (!error) setPayments(prev => prev.map(p => p.id === payId ? { ...p, deposit_paid: newVal } : p))
    } else {
      const newVal = !pay.final_paid
      const { error } = await supabase.from('payments').update({ final_paid: newVal }).eq('id', payId)
      if (!error) setPayments(prev => prev.map(p => p.id === payId ? { ...p, final_paid: newVal } : p))
    }
  }

  async function savePayRow(payId: string, updates: Partial<Payment>) {
    const { error } = await supabase.from('payments').update(updates as never).eq('id', payId)
    if (error) { showToast('⚠️ 저장 실패: ' + error.message); return }
    setPayments(prev => prev.map(p => p.id === payId ? { ...p, ...updates } : p))
    showToast('저장되었습니다.')
  }

  async function addPayRow() {
    const newPay = {
      exhibition_key: dbKey, item: '새 항목', total: 0, currency: 'KRW',
      deposit_amount: 0, deposit_due: null, deposit_paid: false,
      final_amount: 0, final_due: null, final_paid: false,
    }
    const { data, error } = await supabase.from('payments').insert(newPay).select().single()
    if (error) { showToast('⚠️ 항목 추가 실패: ' + error.message); return }
    if (data) setPayments(prev => [...prev, data as unknown as Payment])
  }

  async function deletePayRow(payId: string) {
    const { error } = await supabase.from('payments').delete().eq('id', payId)
    if (error) { showToast('⚠️ 삭제 실패: ' + error.message); return }
    setPayments(prev => prev.filter(p => p.id !== payId))
  }

  const TABS: { id: TabId; label: string }[] = [
    { id: 'overview', label: t('tab_overview') },
    { id: 'budget', label: t('tab_budget') },
    { id: 'checklist', label: t('tab_checklist') },
    { id: 'design', label: t('tab_design') },
    { id: 'gifts', label: t('tab_gifts') },
    { id: 'equipment', label: t('tab_equipment') },
    { id: 'itinerary', label: t('tab_itinerary') },
  ]

  const doneCount = checklist.filter(c => c.status === 'Done').length
  const totalCount = checklist.length
  const pct = totalCount ? Math.round(doneCount / totalCount * 100) : 0

  return (
    <div className="ev-wrap">
      <div className="ev-topbar">
        <button className="back" onClick={() => safeNavigate(() => navigate(-1))}>{t('ev_back')}</button>
        <div style={{ width: 5, height: 22, background: color, borderRadius: 3 }} />
        <div>
          <div className="ev-name">{exhName} {year}</div>
          <div className="ev-sub">
            {overview ? `${formatEventDate(overview.date_of_event, yearNum)} · ${overview.venue}` : ''}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          {isDirty && (
            <span style={{ fontSize: 11, color: '#FCD34D', fontWeight: 700, background: 'rgba(0,0,0,.25)', padding: '3px 10px', borderRadius: 99 }}>
              ● 미저장
            </span>
          )}
          <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={save} disabled={saving}>
            {saving ? t('saving') : t('ev_save')}
          </button>
          <button style={{ fontSize: 13, padding: '9px 18px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', background: 'rgba(255,255,255,.15)', color: 'white', border: '1.5px solid rgba(255,255,255,.4)' }}
            onClick={() => safeNavigate(() => navigate('/expo/create', { state: { exhId: overview?.exhibition_id } }))}>
            ✏️ Proposal 작성
          </button>
        </div>
      </div>

      <div className="ev-tabs">
        {TABS.map(t => (
          <div key={t.id} className={`ev-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </div>
        ))}
      </div>

      <div className="ev-body" style={{ flex: 1, overflowY: 'auto' }}>

        {/* ── 개요 탭 ── */}
        {tab === 'overview' && (
          <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {overview ? (
              <>
                {/* 기본 정보 */}
                <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ background: 'var(--accent)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>📋 박람회 기본 정보</span>
                    <button onClick={() => setShowEpModal(true)}
                      style={{ marginLeft: 'auto', background: 'rgba(255,255,255,.2)', border: 'none', color: 'white', padding: '4px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                      {t('proposal_edit')}
                    </button>
                  </div>
                  <div style={{ padding: '18px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                    {[
                      [t('col_exh'), exhName],
                      [t('year_label'), year],
                      [t('col_date'), formatEventDate(overview.date_of_event, yearNum)],
                      [t('venue'), overview.venue || '-'],
                      [t('author_label'), overview.author || '-'],
                      ['Proposal 날짜', overview.proposal_date || '-'],
                    ].map(([k, v]) => (
                      <div key={k} style={{ padding: '10px 14px', background: '#F9F5F5', borderRadius: 8 }}>
                        <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginBottom: 4 }}>{k}</div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{v || '-'}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 목표 & 기대 효과 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, padding: '18px 22px' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--accent)' }}>{t('overview_goal')}</div>
                    <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text)' }}>{overview.objective || '목표 미입력'}</div>
                    {(overview.products || []).length > 0 && (
                      <div style={{ marginTop: 14, padding: '10px 14px', background: '#FFF8F0', borderRadius: 8, border: '1px solid #FDE68A' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#D97706', marginBottom: 6 }}>{t('overview_products')}</div>
                        {overview.products.map((p: any, i: number) => (
                          <div key={i} style={{ fontSize: 12, marginBottom: 4 }}>
                            <strong>{p.product}</strong>{p.target ? ` — ${p.target}` : ''}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, padding: '18px 22px' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#059669' }}>{t('overview_results')}</div>
                    {(overview.expected_results || []).length > 0
                      ? <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {overview.expected_results.map((r: string, i: number) => (
                            <li key={i} style={{ fontSize: 13, marginBottom: 6, lineHeight: 1.5 }}>{r}</li>
                          ))}
                        </ul>
                      : <div style={{ fontSize: 13, color: 'var(--muted)' }}>{t('no_expected_results')}</div>
                    }
                  </div>
                </div>

                {/* 예산 요약 */}
                <OverviewBudgetTable budget={overview.budget} prevBudget={prevOverview?.budget} prevYear={prevOverview?.year} />

                {/* 전년도 비교 */}
                {prevOverview && (
                  <div style={{ background: '#F0FFF4', border: '1px solid #A7F3D0', borderRadius: 10, padding: '14px 20px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#059669', marginBottom: 6 }}>
                      📊 {prevOverview.year}년 대비 비교
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text)' }}>
                      {prevOverview.year}년 총 예산: {budgetTotalStr(prevOverview.budget)}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ color: 'var(--muted)', padding: 40, textAlign: 'center' }}>
                {t('no_proposal')}
              </div>
            )}
          </div>
        )}

        {/* ── 예산 탭 ── */}
        {tab === 'budget' && (
          <BudgetTab
            overview={overview}
            payments={payments}
            dbKey={dbKey}
            onTogglePaid={togglePaid}
            onSavePayRow={savePayRow}
            onAddPayRow={addPayRow}
            onDeletePayRow={deletePayRow}
            onEditProposal={() => setShowEpModal(true)}
          />
        )}

        {/* ── 체크리스트 탭 ── */}
        {tab === 'checklist' && (
          <div style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{t('checklist_title')}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                  완료 <strong style={{ color: 'var(--green)' }}>{doneCount}</strong> / 전체 {totalCount}
                  &nbsp;·&nbsp; 진행 <strong style={{ color: 'var(--amber)' }}>{checklist.filter(c => c.status === 'Progress').length}</strong>
                  &nbsp;·&nbsp; 긴급 <strong style={{ color: 'var(--danger)' }}>{checklist.filter(c => c.status === 'Urgent').length}</strong>
                </div>
              </div>
              <button className="btn btn-primary btn-sm"
                onClick={() => setChecklist(p => [...p, { sn: p.length + 1, item: '새 항목', pic: 'Andrew', deadline: '', status: 'Plan', remarks: '', subitems: [] }])}>
                + 항목 추가
              </button>
            </div>
            <div style={{ background: '#EEE', borderRadius: 6, height: 10, marginBottom: 22, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'var(--green)', borderRadius: 6, width: `${pct}%`, transition: 'width .4s' }} />
            </div>
            {checklist.map((row, i) => (
              <ChecklistCard key={i} row={row} idx={i} onUpdate={(updated) => setChecklist(p => p.map((r, j) => j === i ? updated : r))} onDelete={() => setChecklist(p => p.filter((_, j) => j !== i))} />
            ))}
            <button className="add-row-btn"
              onClick={() => setChecklist(p => [...p, { sn: p.length + 1, item: '새 항목', pic: 'Andrew', deadline: '', status: 'Plan', remarks: '', subitems: [] }])}>
              + 항목 추가
            </button>
          </div>
        )}

        {/* ── 디자인 탭 ── */}
        {tab === 'design' && (
          <div style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{t('design_title')}</div>
              <button className="btn btn-primary btn-sm"
                onClick={() => setDesign(p => [...p, { sn: p.length + 1, category: '', item: '', size: '', qty: '', spec: '', deadline: '', status: 'Plan', note: '' }])}>
                + 항목 추가
              </button>
            </div>
            <table className="cl-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>{t('col_no')}</th><th style={{ width: 80 }}>{t('col_category')}</th><th>{t('col_item')}</th>
                  <th style={{ width: 110 }}>{t('col_size')}</th><th style={{ width: 80 }}>{t('col_qty')}</th>
                  <th>{t('col_spec')}</th><th style={{ width: 120 }}>{t('col_deadline')}</th>
                  <th style={{ width: 100 }}>{t('col_status')}</th><th>{t('col_remarks')}</th><th style={{ width: 36 }}></th>
                </tr>
              </thead>
              <tbody>
                {design.map((row, i) => (
                  <tr key={i} style={{ background: row.status === 'Done' ? '#F0FFF4' : '' }}>
                    <td style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>{i + 1}</td>
                    <td><input value={row.category || ''} onChange={e => setDesign(p => p.map((r, j) => j === i ? { ...r, category: e.target.value } : r))} /></td>
                    <td><input value={row.item || ''} style={{ fontWeight: 600 }} onChange={e => setDesign(p => p.map((r, j) => j === i ? { ...r, item: e.target.value } : r))} /></td>
                    <td><input value={row.size || ''} onChange={e => setDesign(p => p.map((r, j) => j === i ? { ...r, size: e.target.value } : r))} /></td>
                    <td><input value={row.qty || ''} onChange={e => setDesign(p => p.map((r, j) => j === i ? { ...r, qty: e.target.value } : r))} /></td>
                    <td><textarea rows={2} value={row.spec || ''} onChange={e => setDesign(p => p.map((r, j) => j === i ? { ...r, spec: e.target.value } : r))} /></td>
                    <td><input type="date" value={row.deadline || ''} onChange={e => setDesign(p => p.map((r, j) => j === i ? { ...r, deadline: e.target.value } : r))} /></td>
                    <td>
                      <select value={row.status || 'Plan'} onChange={e => setDesign(p => p.map((r, j) => j === i ? { ...r, status: e.target.value } : r))}
                        style={{ background: STATUS_COLORS[row.status] || '#ccc', color: 'white', fontWeight: 700 }}>
                        {STATUS_OPTS.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td><textarea rows={2} value={row.note || ''} onChange={e => setDesign(p => p.map((r, j) => j === i ? { ...r, note: e.target.value } : r))} /></td>
                    <td><button onClick={() => setDesign(p => p.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16 }}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="add-row-btn" onClick={() => setDesign(p => [...p, { sn: p.length + 1, category: '', item: '', size: '', qty: '', spec: '', deadline: '', status: 'Plan', note: '' }])}>
              + 항목 추가
            </button>
          </div>
        )}

        {/* ── 선물 탭 (통합) ── */}
        {tab === 'gifts' && (
          <div style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>{t('gifts_title')}</div>
            <GiftSection title={t('onboard_gifts')} data={giftsOnboard} setData={setGiftsOnboard} />
            <GiftSection title={t('event_prizes')} data={giftsEvent} setData={setGiftsEvent} />
          </div>
        )}

        {/* ── 장비 탭 ── */}
        {tab === 'equipment' && (
          <div style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{t('equipment_title')}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                  확인 완료 <strong style={{ color: 'var(--green)' }}>{equipment.filter(e => e.done).length}</strong> / 전체 {equipment.length}
                </div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => setEquipment(p => [...p, { sn: p.length + 1, item: '', qty: 1, note: '', done: false }])}>
                + 항목 추가
              </button>
            </div>
            <div style={{ background: '#EEE', borderRadius: 6, height: 10, marginBottom: 20, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'var(--green)', borderRadius: 6, width: equipment.length ? `${Math.round(equipment.filter(e => e.done).length / equipment.length * 100)}%` : '0%', transition: 'width .3s' }} />
            </div>
            <table className="cl-table">
              <thead>
                <tr><th style={{ width: 36 }}>{t('col_no')}</th><th>{t('col_item')}</th><th style={{ width: 80 }}>{t('col_qty')}</th><th>{t('col_note')}</th><th style={{ width: 90 }}>{t('col_confirm')}</th><th style={{ width: 36 }}></th></tr>
              </thead>
              <tbody>
                {equipment.map((row, i) => (
                  <tr key={i} style={{ opacity: row.done ? 0.6 : 1 }}>
                    <td style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>{i + 1}</td>
                    <td><input value={row.item} style={{ fontWeight: 600, textDecoration: row.done ? 'line-through' : 'none' }} onChange={e => setEquipment(p => p.map((r, j) => j === i ? { ...r, item: e.target.value } : r))} /></td>
                    <td><input type="number" value={row.qty || 0} onChange={e => setEquipment(p => p.map((r, j) => j === i ? { ...r, qty: parseInt(e.target.value) || 0 } : r))} /></td>
                    <td><input value={row.note} onChange={e => setEquipment(p => p.map((r, j) => j === i ? { ...r, note: e.target.value } : r))} /></td>
                    <td style={{ textAlign: 'center' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', justifyContent: 'center', margin: 0 }}>
                        <input type="checkbox" checked={row.done} onChange={e => setEquipment(p => p.map((r, j) => j === i ? { ...r, done: e.target.checked } : r))}
                          style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--green)' }} />
                        <span style={{ fontSize: 12, color: row.done ? 'var(--green)' : 'var(--muted)', fontWeight: row.done ? 700 : 400 }}>
                          {row.done ? t('confirmed') : t('unconfirmed')}
                        </span>
                      </label>
                    </td>
                    <td><button onClick={() => setEquipment(p => p.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16 }}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="add-row-btn" onClick={() => setEquipment(p => [...p, { sn: p.length + 1, item: '', qty: 1, note: '', done: false }])}>
              + 항목 추가
            </button>
          </div>
        )}

        {/* ── 현지 일정 탭 ── */}
        {tab === 'itinerary' && (
          <div style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{t('itinerary_title')}</div>
              <button className="btn btn-primary btn-sm" onClick={() => setItinerary(p => [...p, { sn: p.length + 1, date: '', day: '', time: '', activity: '', location: '', assignee: 'All', note: '' }])}>
                + 일정 추가
              </button>
            </div>
            <table className="cl-table">
              <thead>
                <tr>
                  <th style={{ width: 110 }}>{t('col_date')}</th><th style={{ width: 50 }}>{t('col_day')}</th>
                  <th style={{ width: 120 }}>{t('col_time')}</th><th>{t('col_activity')}</th>
                  <th>{t('col_location')}</th><th style={{ width: 90 }}>{t('col_assignee')}</th>
                  <th>{t('col_note')}</th><th style={{ width: 36 }}></th>
                </tr>
              </thead>
              <tbody>
                {itinerary.map((row, i) => (
                  <tr key={i} style={{ borderTop: i > 0 && row.date !== itinerary[i - 1]?.date ? '2px solid var(--border2)' : undefined }}>
                    <td>
                      <input type="date" value={row.date || ''} onChange={e => {
                        const d = new Date(e.target.value)
                        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                        setItinerary(p => p.map((r, j) => j === i ? { ...r, date: e.target.value, day: isNaN(d.getTime()) ? '' : days[d.getDay()] } : r))
                      }} />
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--accent)' }}>{row.day}</td>
                    <td>
                      <input type="time" value={row.time || ''} onChange={e => setItinerary(p => p.map((r, j) => j === i ? { ...r, time: e.target.value } : r))}
                        style={{ width: '100%', padding: '5px 8px', fontSize: 13, border: '1px solid var(--border2)', borderRadius: 6, cursor: 'pointer' }} />
                    </td>
                    <td><input value={row.activity || ''} style={{ fontWeight: 600 }} onChange={e => setItinerary(p => p.map((r, j) => j === i ? { ...r, activity: e.target.value } : r))} /></td>
                    <td><input value={row.location || ''} onChange={e => setItinerary(p => p.map((r, j) => j === i ? { ...r, location: e.target.value } : r))} /></td>
                    <td>
                      <input value={row.assignee || ''} placeholder="All" onChange={e => setItinerary(p => p.map((r, j) => j === i ? { ...r, assignee: e.target.value } : r))} />
                    </td>
                    <td><input value={row.note || ''} onChange={e => setItinerary(p => p.map((r, j) => j === i ? { ...r, note: e.target.value } : r))} /></td>
                    <td><button onClick={() => setItinerary(p => p.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16 }}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="add-row-btn" onClick={() => setItinerary(p => [...p, { sn: p.length + 1, date: '', day: '', time: '', activity: '', location: '', assignee: 'All', note: '' }])}>
              + 일정 추가
            </button>
          </div>
        )}
      </div>

      {/* 미저장 이탈 확인 모달 */}
      {showLeaveModal && (
        <div className="modal-bg open">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-hdr">
              <h3>⚠️ 저장하지 않은 변경사항</h3>
            </div>
            <p style={{ fontSize: 14, color: 'var(--muted)', margin: '12px 0 20px', lineHeight: 1.6 }}>
              체크리스트, 디자인, 선물, 장비, 일정 등 수정한 내용이 저장되지 않았습니다.<br />
              이동하면 변경사항이 <strong style={{ color: '#DC2626' }}>사라집니다</strong>.
            </p>
            <div className="modal-footer">
              <button className="btn btn-muted" onClick={() => { setShowLeaveModal(false); setPendingNav(null) }}>계속 편집</button>
              <button className="btn btn-outline" style={{ color: '#DC2626', borderColor: '#DC2626' }}
                onClick={() => { setIsDirty(false); setShowLeaveModal(false); pendingNav?.() }}>저장 안 함</button>
              <button className="btn btn-primary" onClick={async () => { await save(); setShowLeaveModal(false); pendingNav?.() }}>
                💾 저장 후 이동
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proposal 편집 모달 */}
      {showEpModal && overview && (
        <ProposalEditModal
          propId={overview.id}
          exhName={exhName}
          exhKey={key || ''}
          year={yearNum}
          initialDate={overview.date_of_event || ''}
          initialVenue={overview.venue || ''}
          initialObjective={overview.objective || ''}
          initialResults={(overview.expected_results as string[]) || []}
          initialBudget={(overview.budget || []).map((b: any) => ({ item: b.item, curr: b.curr, prev: b.prev || 0, currency: b.currency || 'KRW', note: b.note || '' }))}
          onClose={() => setShowEpModal(false)}
          onSaved={() => { setShowEpModal(false); setRefreshKey(k => k + 1) }}
          onDeleted={() => { setShowEpModal(false); navigate(-1) }}
        />
      )}
    </div>
  )
}

// ── 개요 탭 예산 테이블 ──────────────────────────────
function OverviewBudgetTable({ budget, prevBudget, prevYear }: { budget: any[]; prevBudget?: any[]; prevYear?: number }) {
  const { t } = useLang()
  const byCur: Record<string, number> = {}
  for (const b of (budget || [])) {
    const c = b.currency || 'KRW'
    byCur[c] = (byCur[c] || 0) + (b.curr || 0)
  }
  const budgetSummary = Object.entries(byCur).sort(([a], [b]) => a === 'KRW' ? -1 : 1)
    .map(([c, v]) => `${c} ${fmtAmt(v, c)}`).join('  +  ')

  return (
    <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ background: '#1E3A5F', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>💰 예산 현황</span>
        <span style={{ background: 'rgba(255,255,255,.2)', padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600, color: 'white' }}>
          {budgetSummary || '-'}
        </span>
      </div>
      <div style={{ padding: '0 20px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={{ padding: '11px 12px', textAlign: 'left', color: 'var(--muted)', fontSize: 12 }}>{t('item_col')}</th>
              <th style={{ padding: '11px 12px', textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>{t('currency_col')}</th>
              <th style={{ padding: '11px 12px', textAlign: 'right', color: 'var(--muted)', fontSize: 12 }}>{t('amount_col')}</th>
              {prevBudget && <th style={{ padding: '11px 12px', textAlign: 'right', color: 'var(--muted)', fontSize: 12 }}>{t('prev_yr')}({prevYear})</th>}
              {prevBudget && <th style={{ padding: '11px 12px', textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>{t('diff_lbl')}</th>}
              <th style={{ padding: '11px 12px', textAlign: 'left', color: 'var(--muted)', fontSize: 12 }}>{t('note_col')}</th>
            </tr>
          </thead>
          <tbody>
            {(budget || []).map((b: any, i: number) => {
              const c = b.currency || 'KRW'
              const prev = prevBudget?.find((pb: any) => pb.item === b.item)
              const prevAmt = prev ? (prev.curr || 0) : null
              const diff = prevAmt != null ? b.curr - prevAmt : null
              return (
                <tr key={i} style={{ borderBottom: '0.5px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{b.item}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <CurrencyBadge cur={c} />
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>
                    {fmtAmt(b.curr || 0, c)}
                  </td>
                  {prevBudget && <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--muted)' }}>
                    {prevAmt != null ? fmtAmt(prevAmt, c) : '—'}
                  </td>}
                  {prevBudget && <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    {diff == null ? '' : diff === 0
                      ? <span style={{ color: 'var(--muted)' }}>—</span>
                      : diff > 0
                        ? <span style={{ color: '#DC2626', fontWeight: 600 }}>▲ {fmtAmt(Math.abs(diff), c)}</span>
                        : <span style={{ color: '#059669', fontWeight: 600 }}>▼ {fmtAmt(Math.abs(diff), c)}</span>
                    }
                  </td>}
                  <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--muted)' }}>{b.note || '—'}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            {Object.entries(byCur).sort(([a], [b]) => a === 'KRW' ? -1 : 1).map(([c, total]) => (
              <tr key={c} style={{ borderTop: '2px solid var(--border)', background: '#F9F5F5' }}>
                <td style={{ padding: '10px 12px', fontWeight: 700 }} colSpan={2}>{t('budget_total')} ({c})</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--accent)' }}>
                  {fmtAmt(total, c)}
                </td>
                {prevBudget && <td colSpan={2} />}
                <td />
              </tr>
            ))}
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ── 예산 탭 ──────────────────────────────────────────
function BudgetTab({ overview, payments, dbKey, onTogglePaid, onSavePayRow, onAddPayRow, onDeletePayRow, onEditProposal }: {
  overview: any
  payments: Payment[]
  dbKey: string
  onTogglePaid: (id: string, type: 'deposit' | 'final') => void
  onSavePayRow: (id: string, updates: Partial<Payment>) => void
  onAddPayRow: () => void
  onDeletePayRow: (id: string) => void
  onEditProposal?: () => void
}) {
  const { t } = useLang()
  const [deletePayConfirm, setDeletePayConfirm] = useState<string | null>(null)

  const budget = overview?.budget || []
  const byCur: Record<string, number> = {}
  for (const b of budget) { const c = b.currency || 'KRW'; byCur[c] = (byCur[c] || 0) + (b.curr || 0) }

  const paidByCur: Record<string, number> = {}
  const pendByCur: Record<string, number> = {}
  for (const p of payments) {
    const c = p.currency || 'KRW'
    const isLump = p.final_amount === 0 && p.final_paid === true
    const paid = isLump ? (p.deposit_paid ? p.total : 0) : (p.deposit_paid ? p.deposit_amount : 0) + (p.final_paid ? p.final_amount : 0)
    const pend = isLump ? (p.deposit_paid ? 0 : p.total) : (!p.deposit_paid ? p.deposit_amount : 0) + (!p.final_paid ? p.final_amount : 0)
    paidByCur[c] = (paidByCur[c] || 0) + paid
    pendByCur[c] = (pendByCur[c] || 0) + pend
  }

  const sumStr = (obj: Record<string, number>) =>
    Object.entries(obj).filter(([, v]) => v > 0).sort(([a], [b]) => a === 'KRW' ? -1 : 1)
      .map(([c, v]) => fmtAmt(v, c)).join(' + ') || '0'

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
        {[
          { lbl: t('approved_budget'), val: sumStr(byCur), col: '#1E3A5F', bg: '#EFF6FF' },
          { lbl: t('paid_done'), val: sumStr(paidByCur) || '0', col: '#059669', bg: '#ECFDF5' },
          { lbl: t('not_paid'), val: sumStr(pendByCur) || '0', col: '#DC2626', bg: '#FEF2F2' },
        ].map(k => (
          <div key={k.lbl} style={{ background: k.bg, borderRadius: 12, padding: '16px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 600 }}>{k.lbl}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: k.col, lineHeight: 1.4 }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* 예산 내역 */}
      {budget.length > 0 && (
        <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ background: '#1E3A5F', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>💰 예산 내역</span>
            {onEditProposal && (
              <button onClick={onEditProposal}
                style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: 'white', padding: '4px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                {t('budget_edit')}
              </button>
            )}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--muted)', fontSize: 12 }}>{t('item_col')}</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>{t('currency_col')}</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--muted)', fontSize: 12 }}>{t('approved_budget')}</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--muted)', fontSize: 12 }}>{t('payment_registered')}</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--muted)', fontSize: 12 }}>{t('note_col')}</th>
              </tr>
            </thead>
            <tbody>
              {budget.map((b: any, i: number) => {
                const c = b.currency || 'KRW'
                const pay = payments.find(p => p.item === b.item)
                return (
                  <tr key={i} style={{ borderBottom: '0.5px solid var(--border)' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600 }}>{b.item}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}><CurrencyBadge cur={c} /></td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>{fmtAmt(b.curr || 0, c)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: pay ? 'var(--text)' : 'var(--muted)' }}>
                      {pay ? fmtAmt(pay.total, c) : '—'}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--muted)' }}>{b.note || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 결제 일정 */}
      <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ background: 'var(--accent)', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>{t('payment_schedule')}</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,.8)' }}>
            {t('paid_done')}: {sumStr(paidByCur) || '0'} · {t('not_paid')}: {sumStr(pendByCur) || '0'}
          </span>
        </div>
        {payments.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            결제 일정이 없습니다.
            <button onClick={onAddPayRow} style={{ marginLeft: 10, padding: '4px 12px', borderRadius: 6, background: 'var(--accent)', color: 'white', border: 'none', fontSize: 12, cursor: 'pointer' }}>
              {t('add_item')}
            </button>
          </div>
        ) : (
          <>
            {payments.map((p) => (
              <PayCard key={p.id} p={p}
                onTogglePaid={onTogglePaid}
                onSave={onSavePayRow}
                onDelete={onDeletePayRow}
                deleteConfirm={deletePayConfirm}
                onSetDeleteConfirm={setDeletePayConfirm}
              />
            ))}
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)' }}>
              <button onClick={onAddPayRow} className="add-row-btn" style={{ marginTop: 0 }}>+ 항목 추가</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── 결제 행 (compact inline) ──────────────────────────────────────────────────
function PayCard({ p, onTogglePaid, onSave, onDelete, deleteConfirm, onSetDeleteConfirm }: {
  p: Payment
  onTogglePaid: (id: string, type: 'deposit' | 'final') => void
  onSave: (id: string, updates: Partial<Payment>) => void
  onDelete: (id: string) => void
  deleteConfirm: string | null
  onSetDeleteConfirm: (id: string | null) => void
}) {
  const c = p.currency || 'KRW'
  const { date: finDateInit, method: methodInit } = parseFinalDue(p.final_due)
  const isLumpInit = p.final_amount === 0 && p.final_paid === true

  const [itemName, setItemName] = useState(p.item)
  const [mode, setMode] = useState<'lump' | 'split'>(isLumpInit ? 'lump' : 'split')
  const [method, setMethod] = useState(methodInit || '계좌이체')
  const [depAmt, setDepAmt] = useState(String(isLumpInit ? p.total : (p.deposit_amount || 0)))
  const [depDue, setDepDue] = useState(p.deposit_due || '')
  const [finAmt, setFinAmt] = useState(String(isLumpInit ? 0 : (p.final_amount || 0)))
  const [finDue, setFinDue] = useState(finDateInit)
  const initDepPct = p.total > 0 && !isLumpInit ? Math.round(p.deposit_amount / p.total * 100) : 50
  const [depPct, setDepPct] = useState(initDepPct)

  const paidAmt = mode === 'lump'
    ? (p.deposit_paid ? p.total : 0)
    : (p.deposit_paid ? p.deposit_amount : 0) + (p.final_paid ? p.final_amount : 0)
  const pct = p.total ? Math.round(paidAmt / p.total * 100) : 0
  const pctColor = pct === 100 ? '#059669' : pct > 0 ? '#F59E0B' : '#DC2626'

  function handleSave() {
    if (mode === 'lump') {
      const amt = parseInt(depAmt) || p.total
      onSave(p.id, { deposit_amount: amt, deposit_due: depDue || null, final_amount: 0, final_paid: true, final_due: encodeFinalDue('', method), total: amt })
    } else {
      const dep = parseInt(depAmt) || 0
      const fin = parseInt(finAmt) || 0
      onSave(p.id, { deposit_amount: dep, deposit_due: depDue || null, final_amount: fin, final_due: encodeFinalDue(finDue, method), total: dep + fin })
    }
  }

  function PaidToggle({ paid, onToggle }: { paid: boolean; onToggle: () => void }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }} onClick={onToggle}>
        <div style={{ width: 36, height: 20, borderRadius: 99, background: paid ? '#059669' : '#ccc', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
          <div style={{ position: 'absolute', top: 2.5, left: paid ? 17 : 2.5, width: 15, height: 15, background: 'white', borderRadius: '50%', transition: 'left .2s' }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: paid ? '#059669' : 'var(--muted)', whiteSpace: 'nowrap', minWidth: 56 }}>
          {paid ? '납부완료 ✓' : '미납'}
        </span>
      </div>
    )
  }

  const rowBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '7px 10px', borderRadius: 8, border: '1px solid',
  }

  return (
    <div style={{ borderBottom: '0.5px solid var(--border)', padding: '10px 18px' }}>
      {/* 헤더 행 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <input
          value={itemName}
          onChange={e => setItemName(e.target.value)}
          onBlur={() => { if (itemName !== p.item) onSave(p.id, { item: itemName }) }}
          style={{ fontSize: 13, fontWeight: 700, flex: 1, minWidth: 80, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text)', fontFamily: 'inherit', padding: 0, cursor: 'text' }}
        />
        <CurrencyBadge cur={c} />
        <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
          합계 <strong style={{ color: 'var(--accent)' }}>{fmtAmt(p.total, c)}</strong>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 56, background: '#EEE', borderRadius: 3, height: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: pctColor, width: `${pct}%`, borderRadius: 3, transition: 'width .3s' }} />
          </div>
          <span style={{ fontSize: 11, color: pctColor, fontWeight: 700, minWidth: 28 }}>{pct}%</span>
        </div>
        {(['lump', 'split'] as const).map(m => (
          <button key={m} onClick={() => { setMode(m); if (m === 'lump') setDepAmt(String(p.total)) }}
            style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
              background: mode === m ? 'var(--accent)' : 'white', color: mode === m ? 'white' : 'var(--muted)',
              border: `1.5px solid ${mode === m ? 'var(--accent)' : 'var(--border2)'}` }}>
            {m === 'lump' ? '일시불' : '선금/잔금'}
          </button>
        ))}
        <select value={method} onChange={e => setMethod(e.target.value)}
          style={{ padding: '4px 8px', border: '1.5px solid var(--border2)', borderRadius: 6, fontSize: 12, background: 'white', cursor: 'pointer' }}>
          {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
        </select>
        <button onClick={handleSave}
          style={{ padding: '4px 12px', borderRadius: 6, background: 'var(--accent)', color: 'white', border: 'none', fontSize: 12, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
          저장
        </button>
        {deleteConfirm === p.id ? (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#DC2626', fontWeight: 600 }}>삭제?</span>
            <button onClick={() => { onDelete(p.id); onSetDeleteConfirm(null) }}
              style={{ padding: '3px 8px', borderRadius: 5, background: '#DC2626', color: 'white', border: 'none', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Yes</button>
            <button onClick={() => onSetDeleteConfirm(null)}
              style={{ padding: '3px 8px', borderRadius: 5, background: 'white', color: 'var(--muted)', border: '1px solid var(--border2)', fontSize: 11, cursor: 'pointer' }}>No</button>
          </div>
        ) : (
          <button onClick={() => onSetDeleteConfirm(p.id)}
            style={{ padding: '4px 8px', borderRadius: 6, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', fontSize: 11, cursor: 'pointer' }}>✕</button>
        )}
      </div>

      {/* 납부 행 */}
      {mode === 'lump' ? (
        <div style={{ ...rowBase, background: p.deposit_paid ? '#ECFDF5' : '#FFFBEB', borderColor: p.deposit_paid ? '#6EE7B7' : '#FDE68A' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', width: 36 }}>납부</span>
          <input type="number" value={depAmt} onChange={e => setDepAmt(e.target.value)}
            style={{ width: 130, padding: '5px 8px', border: '1px solid var(--border2)', borderRadius: 6, fontSize: 13, textAlign: 'right', boxSizing: 'border-box' }} />
          <input type="date" value={depDue} onChange={e => setDepDue(e.target.value)}
            style={{ padding: '5px 8px', border: '1px solid var(--border2)', borderRadius: 6, fontSize: 13 }} />
          <PaidToggle paid={p.deposit_paid} onToggle={() => onTogglePaid(p.id, 'deposit')} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {/* 비율 조정 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', background: '#F1F5FD', borderRadius: 6, fontSize: 12, color: 'var(--muted)' }}>
            <span>비율 — 선금</span>
            <input type="number" value={depPct} min={0} max={100}
              onChange={e => {
                const v = Math.min(100, Math.max(0, parseInt(e.target.value) || 0))
                setDepPct(v)
                if (p.total > 0) { const d = Math.round(p.total * v / 100); setDepAmt(String(d)); setFinAmt(String(p.total - d)) }
              }}
              style={{ width: 50, padding: '3px 6px', border: '1.5px solid var(--border2)', borderRadius: 6, fontSize: 12, textAlign: 'center' }} />
            <span>% / 잔금 <strong>{100 - depPct}%</strong></span>
            {p.total > 0 && (
              <span style={{ marginLeft: 6, color: 'var(--accent)', fontSize: 11 }}>
                선금 {fmtAmt(Math.round(p.total * depPct / 100), c)} · 잔금 {fmtAmt(p.total - Math.round(p.total * depPct / 100), c)}
              </span>
            )}
          </div>
          {([
            { type: 'deposit' as const, label: '선금', paid: p.deposit_paid, amt: depAmt, due: depDue, setAmt: setDepAmt, setDue: setDepDue },
            { type: 'final' as const, label: '잔금', paid: p.final_paid, amt: finAmt, due: finDue, setAmt: setFinAmt, setDue: setFinDue },
          ]).map(box => (
            <div key={box.type} style={{ ...rowBase,
              background: box.paid ? '#ECFDF5' : box.type === 'deposit' ? '#EEF4FF' : '#F0FFF4',
              borderColor: box.paid ? '#6EE7B7' : box.type === 'deposit' ? '#C7D7F8' : '#A7F3D0',
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', width: 36 }}>{box.label}</span>
              <input type="number" value={box.amt} onChange={e => box.setAmt(e.target.value)}
                style={{ width: 130, padding: '5px 8px', border: '1px solid var(--border2)', borderRadius: 6, fontSize: 13, textAlign: 'right', boxSizing: 'border-box' }} />
              <input type="date" value={box.due} onChange={e => box.setDue(e.target.value)}
                style={{ padding: '5px 8px', border: '1px solid var(--border2)', borderRadius: 6, fontSize: 13 }} />
              <PaidToggle paid={box.paid} onToggle={() => onTogglePaid(p.id, box.type)} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 체크리스트 카드 ──────────────────────────────────
function ChecklistCard({ row, idx, onUpdate, onDelete }: {
  row: ChecklistItem; idx: number
  onUpdate: (r: ChecklistItem) => void
  onDelete: () => void
}) {
  const { t } = useLang()
  const subs = row.subitems || []
  const sc = STATUS_COLORS[row.status] || '#ccc'

  function cycleSubStatus(j: number) {
    const cur = subs[j].status
    const next = SUB_CYCLE[(SUB_CYCLE.indexOf(cur) + 1) % SUB_CYCLE.length]
    const newSubs = subs.map((s, k) => k === j ? { ...s, status: next } : s)
    let newStatus = row.status
    if (newSubs.every(s => s.status === 'Done')) newStatus = 'Done'
    else if (newSubs.some(s => s.status === 'Progress' || s.status === 'Done')) newStatus = 'Progress'
    else newStatus = 'Plan'
    onUpdate({ ...row, subitems: newSubs, status: newStatus })
  }

  return (
    <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
      {/* 카드 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '0.5px solid var(--border)', background: '#FDFBFB' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
          {idx + 1}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>{t('col_item')}</div>
          <input value={row.item} style={{ fontSize: 14, fontWeight: 700, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text)', fontFamily: 'inherit', flex: 1, width: '100%' }}
            onChange={e => onUpdate({ ...row, item: e.target.value })} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>{t('col_pic')}</div>
            <input value={row.pic || ''} onChange={e => onUpdate({ ...row, pic: e.target.value })}
              style={{ width: 90, fontSize: 13, border: '1px solid var(--border2)', borderRadius: 6, padding: '6px 9px' }} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>{t('col_deadline')}</div>
            <input type="date" value={row.deadline || ''} onChange={e => onUpdate({ ...row, deadline: e.target.value })}
              style={{ fontSize: 13, border: '1px solid var(--border2)', borderRadius: 6, padding: '6px 9px' }} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>{t('col_status')}</div>
            <select value={row.status} onChange={e => onUpdate({ ...row, status: e.target.value })}
              style={{ background: sc, color: 'white', fontWeight: 700, border: 'none', borderRadius: 7, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}>
              {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>{t('col_remarks')}</div>
            <input value={row.remarks || ''} onChange={e => onUpdate({ ...row, remarks: e.target.value })}
              style={{ width: 140, fontSize: 13, border: '1px solid var(--border2)', borderRadius: 6, padding: '6px 9px' }} />
          </div>
          <button onClick={onDelete} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20, padding: '0 4px', lineHeight: 1, marginTop: 18 }} title={t('delete_item')}>✕</button>
        </div>
      </div>
      {/* 서브 아이템 */}
      <div style={{ padding: '14px 18px 10px' }}>
        {subs.map((s, j) => (
          <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: j < subs.length - 1 ? '0.5px solid #F0ECEC' : 'none' }}>
            <span onClick={() => cycleSubStatus(j)}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, color: 'white', background: STATUS_COLORS[s.status] || '#ccc', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, minWidth: 52 }}
              title="클릭하여 상태 변경">
              {s.status}
            </span>
            <textarea value={s.text || ''} rows={1}
              onChange={e => onUpdate({ ...row, subitems: subs.map((si, k) => k === j ? { ...si, text: e.target.value } : si) })}
              onInput={(e) => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }}
              ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}
              style={{ flex: 1, fontSize: 13, color: 'var(--text)', lineHeight: 1.6, border: 'none', outline: 'none', background: 'transparent', resize: 'none', fontFamily: 'inherit', width: '100%', minHeight: 36, padding: '2px 0', overflow: 'hidden' }} />
            <button onClick={() => onUpdate({ ...row, subitems: subs.filter((_, k) => k !== j) })}
              style={{ background: 'none', border: 'none', color: '#CCC', cursor: 'pointer', fontSize: 15, padding: '0 4px', flexShrink: 0 }}>✕</button>
          </div>
        ))}
        <button onClick={() => onUpdate({ ...row, subitems: [...subs, { text: '', status: 'Plan' }] })}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, padding: '6px 14px', border: '1.5px dashed var(--border2)', borderRadius: 7, fontSize: 12, color: 'var(--muted)', cursor: 'pointer', background: 'none', transition: 'all .15s' }}>
          {t('add_sub')}
        </button>
      </div>
    </div>
  )
}

// ── 선물 섹션 ──────────────────────────────────────
function GiftSection({ title, data, setData }: { title: string; data: any[]; setData: React.Dispatch<React.SetStateAction<any[]>> }) {
  const { t } = useLang()
  const total = data.reduce((s: number, r: any) => s + (r.qty || 0) * (r.price || 0), 0)
  return (
    <>
      <div className="section-badge">{title}</div>
      <table className="cl-table" style={{ marginBottom: 20 }}>
        <thead>
          <tr><th>{t('col_no')}</th><th>{t('col_prize')}</th><th style={{ minWidth: 160 }}>{t('col_item')}</th><th>{t('col_qty')}</th><th>{t('col_unit_price')}</th><th>{t('col_subtotal')}</th><th style={{ minWidth: 120 }}>{t('col_note')}</th><th /></tr>
        </thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={i}>
              <td style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>{r.sn || i + 1}</td>
              <td><input value={r.prize || ''} onChange={e => setData(p => p.map((x, j) => j === i ? { ...x, prize: e.target.value } : x))} style={{ width: 80 }} /></td>
              <td><input value={r.item} style={{ fontWeight: 600 }} onChange={e => setData(p => p.map((x, j) => j === i ? { ...x, item: e.target.value } : x))} /></td>
              <td><input type="number" value={r.qty || 0} onChange={e => setData(p => p.map((x, j) => j === i ? { ...x, qty: parseInt(e.target.value) || 0 } : x))} style={{ width: 70, textAlign: 'right' }} /></td>
              <td><input type="number" value={r.price || 0} onChange={e => setData(p => p.map((x, j) => j === i ? { ...x, price: parseInt(e.target.value) || 0 } : x))} style={{ width: 100, textAlign: 'right' }} /></td>
              <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--accent)' }}>
                {r.qty && r.price ? '₩' + (r.qty * r.price).toLocaleString() : '-'}
              </td>
              <td><input value={r.note || ''} onChange={e => setData(p => p.map((x, j) => j === i ? { ...x, note: e.target.value } : x))} /></td>
              <td><button onClick={() => setData(p => p.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16 }}>✕</button></td>
            </tr>
          ))}
          <tr style={{ background: '#FDF9F9' }}>
            <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700, padding: '10px 14px' }}>{t('budget_total')}</td>
            <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--accent)', padding: '10px 14px' }}>₩{total.toLocaleString()}</td>
            <td colSpan={2} />
          </tr>
        </tbody>
      </table>
      <button className="add-row-btn" onClick={() => setData(p => [...p, { sn: p.length + 1, prize: '', item: '', qty: 0, price: 0, currency: 'KRW', note: '' }])}>
        {t('add_item')}
      </button>
    </>
  )
}

// ── 통화 뱃지 ──────────────────────────────────────
function CurrencyBadge({ cur }: { cur: string }) {
  const styles: Record<string, { bg: string; col: string }> = {
    KRW: { bg: '#EEF2FF', col: '#4F46E5' },
    JPY: { bg: '#FEF3C7', col: '#D97706' },
    USD: { bg: '#DCFCE7', col: '#059669' },
    EUR: { bg: '#F3E8FF', col: '#7C3AED' },
    SGD: { bg: '#FFF7ED', col: '#EA580C' },
  }
  const s = styles[cur] || { bg: '#F3F4F6', col: '#6B7280' }
  return (
    <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: s.bg, color: s.col }}>{cur}</span>
  )
}

function budgetTotalStr(budget: any[]): string {
  if (!budget?.length) return '-'
  const bc: Record<string, number> = {}
  for (const b of budget) { const c = b.currency || 'KRW'; bc[c] = (bc[c] || 0) + (b.curr || 0) }
  return Object.entries(bc).sort(([a], [b]) => a === 'KRW' ? -1 : 1).map(([c, v]) => fmtAmt(v, c)).join(' + ')
}
