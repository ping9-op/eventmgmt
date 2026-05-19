import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { exhColor, formatEventDate, costColor } from '../../lib/utils'
import { useToast } from '../../contexts/ToastContext'
import type { Payment } from '../../types/database'

type TabId = 'overview' | 'budget' | 'checklist' | 'design' | 'gifts' | 'equipment' | 'itinerary'

interface SubItem { text: string; status: string }
interface ChecklistItem {
  sn: number; item: string; pic: string; deadline: string
  status: string; remarks: string; subitems: SubItem[]
  detail?: string
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

  const dbKey = `${key}_${year}`
  const yearNum = parseInt(year || '0')

  useEffect(() => {
    async function load() {
      const [{ data: exhData }, { data: allProps }, { data: evData }, { data: payData }] = await Promise.all([
        supabase.from('exhibitions').select('*').eq('key', key || '').single(),
        supabase.from('proposals').select('*').order('year'),
        supabase.from('event_data').select('*').eq('exhibition_key', dbKey).single(),
        supabase.from('payments').select('*').eq('exhibition_key', dbKey),
      ])
      if (exhData) {
        setExhName(exhData.name)
        setColor(exhColor(exhData.name))
        const props = (allProps as any[])?.filter((p: any) => p.exhibition_id === exhData.id) || []
        const cur = props.find((p: any) => p.year === yearNum)
        const prev = [...props].filter((p: any) => p.year < yearNum).sort((a: any, b: any) => b.year - a.year)[0]
        if (cur) setOverview({ ...cur, budget: (cur.budget as any) || [] })
        if (prev) setPrevOverview({ ...prev, budget: (prev.budget as any) || [] })
      }
      setPayments((payData || []) as unknown as Payment[])
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
    load()
  }, [key, year])

  async function save() {
    setSaving(true)
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
      await supabase.from('event_data').update(payload).eq('id', dataId)
    } else {
      const { data } = await supabase.from('event_data').insert(payload).select().single()
      if (data) setDataId((data as any).id)
    }
    setSaving(false)
    showToast('저장되었습니다.')
  }

  async function togglePaid(payId: string, type: 'deposit' | 'final') {
    const pay = payments.find(p => p.id === payId)
    if (!pay) return
    if (type === 'deposit') {
      const newVal = !pay.deposit_paid
      await supabase.from('payments').update({ deposit_paid: newVal }).eq('id', payId)
      setPayments(prev => prev.map(p => p.id === payId ? { ...p, deposit_paid: newVal } : p))
    } else {
      const newVal = !pay.final_paid
      await supabase.from('payments').update({ final_paid: newVal }).eq('id', payId)
      setPayments(prev => prev.map(p => p.id === payId ? { ...p, final_paid: newVal } : p))
    }
  }

  async function savePayRow(payId: string, updates: { deposit_amount?: number; deposit_due?: string | null; final_amount?: number; final_due?: string | null; total?: number }) {
    await supabase.from('payments').update(updates).eq('id', payId)
    setPayments(prev => prev.map(p => p.id === payId ? { ...p, ...updates } : p))
    showToast('저장되었습니다.')
  }

  async function addPayRow() {
    const newPay = {
      exhibition_key: dbKey, item: '새 항목', total: 0, currency: 'KRW',
      deposit_amount: 0, deposit_due: null, deposit_paid: false,
      final_amount: 0, final_due: null, final_paid: false,
    }
    const { data } = await supabase.from('payments').insert(newPay).select().single()
    if (data) setPayments(prev => [...prev, data as unknown as Payment])
  }

  async function deletePayRow(payId: string) {
    await supabase.from('payments').delete().eq('id', payId)
    setPayments(prev => prev.filter(p => p.id !== payId))
  }

  const TABS: { id: TabId; label: string }[] = [
    { id: 'overview', label: '📋 개요' },
    { id: 'budget', label: '💰 예산' },
    { id: 'checklist', label: '✅ 준비 체크리스트' },
    { id: 'design', label: '🎨 디자인' },
    { id: 'gifts', label: '🎁 선물 목록' },
    { id: 'equipment', label: '📦 부스 장비' },
    { id: 'itinerary', label: '✈️ 현지 일정' },
  ]

  const doneCount = checklist.filter(c => c.status === 'Done').length
  const totalCount = checklist.length
  const pct = totalCount ? Math.round(doneCount / totalCount * 100) : 0

  return (
    <div className="ev-wrap">
      <div className="ev-topbar">
        <button className="back" onClick={() => navigate(-1)}>← 돌아가기</button>
        <div style={{ width: 5, height: 22, background: color, borderRadius: 3 }} />
        <div>
          <div className="ev-name">{exhName} {year}</div>
          <div className="ev-sub">
            {overview ? `${formatEventDate(overview.date_of_event, yearNum)} · ${overview.venue}` : ''}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={save} disabled={saving}>
            {saving ? '저장 중...' : '💾 저장'}
          </button>
          <button style={{ fontSize: 13, padding: '9px 18px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', background: 'rgba(255,255,255,.15)', color: 'white', border: '1.5px solid rgba(255,255,255,.4)' }}
            onClick={() => navigate('/expo/create', { state: { exhId: overview?.exhibition_id } })}>
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
                    <button onClick={() => navigate('/expo/create', { state: { exhId: overview.exhibition_id } })}
                      style={{ marginLeft: 'auto', background: 'rgba(255,255,255,.2)', border: 'none', color: 'white', padding: '4px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                      ✏️ Proposal 수정
                    </button>
                  </div>
                  <div style={{ padding: '18px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                    {[
                      ['박람회명', exhName],
                      ['연도', year],
                      ['날짜', formatEventDate(overview.date_of_event, yearNum)],
                      ['장소', overview.venue || '-'],
                      ['작성자', overview.author || '-'],
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
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--accent)' }}>🎯 박람회 목표</div>
                    <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text)' }}>{overview.objective || '목표 미입력'}</div>
                    {(overview.products || []).length > 0 && (
                      <div style={{ marginTop: 14, padding: '10px 14px', background: '#FFF8F0', borderRadius: 8, border: '1px solid #FDE68A' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#D97706', marginBottom: 6 }}>📦 홍보 제품</div>
                        {overview.products.map((p: any, i: number) => (
                          <div key={i} style={{ fontSize: 12, marginBottom: 4 }}>
                            <strong>{p.product}</strong>{p.target ? ` — ${p.target}` : ''}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, padding: '18px 22px' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#059669' }}>✨ 기대 효과</div>
                    {(overview.expected_results || []).length > 0
                      ? <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {overview.expected_results.map((r: string, i: number) => (
                            <li key={i} style={{ fontSize: 13, marginBottom: 6, lineHeight: 1.5 }}>{r}</li>
                          ))}
                        </ul>
                      : <div style={{ fontSize: 13, color: 'var(--muted)' }}>기대 효과 미입력</div>
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
                Proposal 데이터가 없습니다. 먼저 Proposal을 작성해주세요.
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
          />
        )}

        {/* ── 체크리스트 탭 ── */}
        {tab === 'checklist' && (
          <div style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>준비 체크리스트</div>
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
              <div style={{ fontSize: 15, fontWeight: 700 }}>디자인 항목 관리</div>
              <button className="btn btn-primary btn-sm"
                onClick={() => setDesign(p => [...p, { sn: p.length + 1, category: '', item: '', size: '', qty: '', spec: '', deadline: '', status: 'Plan', note: '' }])}>
                + 항목 추가
              </button>
            </div>
            <table className="cl-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>No</th><th style={{ width: 80 }}>카테고리</th><th>항목</th>
                  <th style={{ width: 110 }}>사이즈</th><th style={{ width: 80 }}>수량</th>
                  <th>사양/내용</th><th style={{ width: 120 }}>마감일</th>
                  <th style={{ width: 100 }}>현황</th><th>비고</th><th style={{ width: 36 }}></th>
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
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>선물 목록</div>
            <GiftSection title="🎁 온보딩 고객 선물" data={giftsOnboard} setData={setGiftsOnboard} />
            <GiftSection title="🎊 이벤트 경품" data={giftsEvent} setData={setGiftsEvent} />
          </div>
        )}

        {/* ── 장비 탭 ── */}
        {tab === 'equipment' && (
          <div style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>부스 장비 체크리스트</div>
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
                <tr><th style={{ width: 36 }}>No</th><th>품목</th><th style={{ width: 80 }}>수량</th><th>비고</th><th style={{ width: 90 }}>확인</th><th style={{ width: 36 }}></th></tr>
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
                          {row.done ? '완료' : '미확인'}
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
              <div style={{ fontSize: 15, fontWeight: 700 }}>현지 일정</div>
              <button className="btn btn-primary btn-sm" onClick={() => setItinerary(p => [...p, { sn: p.length + 1, date: '', day: '', time: '', activity: '', location: '', assignee: 'All', note: '' }])}>
                + 일정 추가
              </button>
            </div>
            <table className="cl-table">
              <thead>
                <tr>
                  <th style={{ width: 110 }}>날짜</th><th style={{ width: 50 }}>요일</th>
                  <th style={{ width: 70 }}>시간</th><th>활동 내용</th>
                  <th>장소</th><th style={{ width: 90 }}>담당자</th>
                  <th>비고</th><th style={{ width: 36 }}></th>
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
                    <td><input value={row.time || ''} placeholder="09:00" onChange={e => setItinerary(p => p.map((r, j) => j === i ? { ...r, time: e.target.value } : r))} /></td>
                    <td><input value={row.activity || ''} style={{ fontWeight: 600 }} onChange={e => setItinerary(p => p.map((r, j) => j === i ? { ...r, activity: e.target.value } : r))} /></td>
                    <td><input value={row.location || ''} onChange={e => setItinerary(p => p.map((r, j) => j === i ? { ...r, location: e.target.value } : r))} /></td>
                    <td>
                      <select value={row.assignee || 'All'} onChange={e => setItinerary(p => p.map((r, j) => j === i ? { ...r, assignee: e.target.value } : r))}>
                        {OWNERS.map(o => <option key={o}>{o}</option>)}
                      </select>
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
    </div>
  )
}

// ── 개요 탭 예산 테이블 ──────────────────────────────
function OverviewBudgetTable({ budget, prevBudget, prevYear }: { budget: any[]; prevBudget?: any[]; prevYear?: number }) {
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
              <th style={{ padding: '11px 12px', textAlign: 'left', color: 'var(--muted)', fontSize: 12 }}>항목</th>
              <th style={{ padding: '11px 12px', textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>통화</th>
              <th style={{ padding: '11px 12px', textAlign: 'right', color: 'var(--muted)', fontSize: 12 }}>금액</th>
              {prevBudget && <th style={{ padding: '11px 12px', textAlign: 'right', color: 'var(--muted)', fontSize: 12 }}>전년({prevYear})</th>}
              {prevBudget && <th style={{ padding: '11px 12px', textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>증감</th>}
              <th style={{ padding: '11px 12px', textAlign: 'left', color: 'var(--muted)', fontSize: 12 }}>비고</th>
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
                <td style={{ padding: '10px 12px', fontWeight: 700 }} colSpan={2}>합계 ({c})</td>
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
function BudgetTab({ overview, payments, dbKey, onTogglePaid, onSavePayRow, onAddPayRow, onDeletePayRow }: {
  overview: any
  payments: Payment[]
  dbKey: string
  onTogglePaid: (id: string, type: 'deposit' | 'final') => void
  onSavePayRow: (id: string, updates: Partial<Payment>) => void
  onAddPayRow: () => void
  onDeletePayRow: (id: string) => void
}) {
  const [editAmts, setEditAmts] = useState<Record<string, { dep?: number; fin?: number; depDue?: string; finDue?: string }>>({})

  const budget = overview?.budget || []
  const byCur: Record<string, number> = {}
  for (const b of budget) { const c = b.currency || 'KRW'; byCur[c] = (byCur[c] || 0) + (b.curr || 0) }

  const paidByCur: Record<string, number> = {}
  const pendByCur: Record<string, number> = {}
  for (const p of payments) {
    const c = p.currency || 'KRW'
    const paid = (p.deposit_paid ? p.deposit_amount : 0) + (p.final_paid ? p.final_amount : 0)
    const pend = (!p.deposit_paid ? p.deposit_amount : 0) + (!p.final_paid ? p.final_amount : 0)
    paidByCur[c] = (paidByCur[c] || 0) + paid
    pendByCur[c] = (pendByCur[c] || 0) + pend
  }

  const sumStr = (obj: Record<string, number>) =>
    Object.entries(obj).filter(([, v]) => v > 0).sort(([a], [b]) => a === 'KRW' ? -1 : 1)
      .map(([c, v]) => fmtAmt(v, c)).join(' + ') || '0'

  function getEdit(id: string) { return editAmts[id] || {} }
  function setEdit(id: string, val: object) { setEditAmts(p => ({ ...p, [id]: { ...getEdit(id), ...val } })) }

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
        {[
          { lbl: '총 승인 예산', val: sumStr(byCur), col: '#1E3A5F', bg: '#EFF6FF' },
          { lbl: '납부 완료', val: sumStr(paidByCur) || '0', col: '#059669', bg: '#ECFDF5' },
          { lbl: '미납 잔액', val: sumStr(pendByCur) || '0', col: '#DC2626', bg: '#FEF2F2' },
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
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--muted)', fontSize: 12 }}>항목</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>통화</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--muted)', fontSize: 12 }}>승인 예산</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--muted)', fontSize: 12 }}>결제 등록</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--muted)', fontSize: 12 }}>비고</th>
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
          <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>📅 결제 일정</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,.8)' }}>
            납부 완료: {sumStr(paidByCur) || '0'} · 미납: {sumStr(pendByCur) || '0'}
          </span>
        </div>
        {payments.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            결제 일정이 없습니다.
            <button onClick={onAddPayRow} style={{ marginLeft: 10, padding: '4px 12px', borderRadius: 6, background: 'var(--accent)', color: 'white', border: 'none', fontSize: 12, cursor: 'pointer' }}>
              + 항목 추가
            </button>
          </div>
        ) : (
          <>
            {payments.map((p) => {
              const c = p.currency || 'KRW'
              const totalPaidAmt = (p.deposit_paid ? p.deposit_amount : 0) + (p.final_paid ? p.final_amount : 0)
              const pct2 = p.total ? Math.round(totalPaidAmt / p.total * 100) : 0
              const ed = getEdit(p.id)
              return (
                <div key={p.id} style={{ borderBottom: '0.5px solid var(--border)', padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{p.item}</span>
                    <CurrencyBadge cur={c} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
                      합계: <strong style={{ color: 'var(--accent)' }}>{fmtAmt(p.total, c)}</strong>
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 80, background: '#EEE', borderRadius: 3, height: 7, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: '#059669', width: `${pct2}%`, borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>{pct2}%</span>
                    </div>
                    <button onClick={() => onSavePayRow(p.id, {
                      deposit_amount: ed.dep ?? p.deposit_amount,
                      deposit_due: (ed.depDue ?? p.deposit_due) as string | null,
                      final_amount: ed.fin ?? p.final_amount,
                      final_due: (ed.finDue ?? p.final_due) as string | null,
                      total: (ed.dep ?? p.deposit_amount) + (ed.fin ?? p.final_amount),
                    })} style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--accent)', color: 'white', border: 'none', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                      💾 저장
                    </button>
                    <button onClick={() => { if (confirm('이 결제 항목을 삭제하시겠습니까?')) onDeletePayRow(p.id) }}
                      style={{ padding: '4px 8px', borderRadius: 6, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', fontSize: 11, cursor: 'pointer' }}>
                      ✕
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {(['deposit', 'final'] as const).map((type) => {
                      const isPaid = type === 'deposit' ? p.deposit_paid : p.final_paid
                      const amt = type === 'deposit' ? p.deposit_amount : p.final_amount
                      const due = type === 'deposit' ? p.deposit_due : p.final_due
                      const label = type === 'deposit' ? '선금' : '잔금'
                      const bg = type === 'deposit' ? '#EEF4FF' : '#F0FFF4'
                      const borderCol = isPaid ? '#A7F3D0' : 'var(--border2)'
                      return (
                        <div key={type} style={{ background: bg, border: `1px solid ${borderCol}`, borderRadius: 8, padding: '12px 14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 700 }}>{label}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }} onClick={() => onTogglePaid(p.id, type)}>
                              <div style={{ width: 36, height: 20, borderRadius: 99, background: isPaid ? '#059669' : '#ccc', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                                <div style={{ position: 'absolute', top: 3, left: isPaid ? 18 : 3, width: 14, height: 14, background: 'white', borderRadius: '50%', transition: 'left .2s' }} />
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 600, color: isPaid ? '#059669' : 'var(--muted)' }}>
                                {isPaid ? '납부완료' : '미납'}
                              </span>
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <div>
                              <label style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3, display: 'block' }}>금액</label>
                              <input type="number" defaultValue={amt || 0}
                                onChange={e => setEdit(p.id, type === 'deposit' ? { dep: parseInt(e.target.value) || 0 } : { fin: parseInt(e.target.value) || 0 })}
                                style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border2)', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3, display: 'block' }}>납부일</label>
                              <input type="date" defaultValue={due || ''}
                                onChange={e => setEdit(p.id, type === 'deposit' ? { depDue: e.target.value } : { finDue: e.target.value })}
                                style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border2)', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)' }}>
              <button onClick={onAddPayRow} className="add-row-btn" style={{ marginTop: 0 }}>
                + 항목 추가
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── 체크리스트 카드 ──────────────────────────────────
function ChecklistCard({ row, idx, onUpdate, onDelete }: {
  row: ChecklistItem; idx: number
  onUpdate: (r: ChecklistItem) => void
  onDelete: () => void
}) {
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
          <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>항목</div>
          <input value={row.item} style={{ fontSize: 14, fontWeight: 700, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text)', fontFamily: 'inherit', flex: 1, width: '100%' }}
            onChange={e => onUpdate({ ...row, item: e.target.value })} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>담당자</div>
            <input value={row.pic || ''} onChange={e => onUpdate({ ...row, pic: e.target.value })}
              style={{ width: 90, fontSize: 13, border: '1px solid var(--border2)', borderRadius: 6, padding: '6px 9px' }} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>마감일</div>
            <input type="date" value={row.deadline || ''} onChange={e => onUpdate({ ...row, deadline: e.target.value })}
              style={{ fontSize: 13, border: '1px solid var(--border2)', borderRadius: 6, padding: '6px 9px' }} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>현황</div>
            <select value={row.status} onChange={e => onUpdate({ ...row, status: e.target.value })}
              style={{ background: sc, color: 'white', fontWeight: 700, border: 'none', borderRadius: 7, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}>
              {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>비고</div>
            <input value={row.remarks || ''} onChange={e => onUpdate({ ...row, remarks: e.target.value })}
              style={{ width: 140, fontSize: 13, border: '1px solid var(--border2)', borderRadius: 6, padding: '6px 9px' }} />
          </div>
          <button onClick={onDelete} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20, padding: '0 4px', lineHeight: 1, marginTop: 18 }} title="항목 삭제">✕</button>
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
              style={{ flex: 1, fontSize: 13, color: 'var(--text)', lineHeight: 1.6, border: 'none', outline: 'none', background: 'transparent', resize: 'none', fontFamily: 'inherit', width: '100%', minHeight: 36, padding: '2px 0' }} />
            <button onClick={() => onUpdate({ ...row, subitems: subs.filter((_, k) => k !== j) })}
              style={{ background: 'none', border: 'none', color: '#CCC', cursor: 'pointer', fontSize: 15, padding: '0 4px', flexShrink: 0 }}>✕</button>
          </div>
        ))}
        <button onClick={() => onUpdate({ ...row, subitems: [...subs, { text: '', status: 'Plan' }] })}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, padding: '6px 14px', border: '1.5px dashed var(--border2)', borderRadius: 7, fontSize: 12, color: 'var(--muted)', cursor: 'pointer', background: 'none', transition: 'all .15s' }}>
          + 세부 항목 추가
        </button>
      </div>
    </div>
  )
}

// ── 선물 섹션 ──────────────────────────────────────
function GiftSection({ title, data, setData }: { title: string; data: any[]; setData: React.Dispatch<React.SetStateAction<any[]>> }) {
  const total = data.reduce((s: number, r: any) => s + (r.qty || 0) * (r.price || 0), 0)
  return (
    <>
      <div className="section-badge">{title}</div>
      <table className="cl-table" style={{ marginBottom: 20 }}>
        <thead>
          <tr><th>No</th><th>종류</th><th style={{ minWidth: 160 }}>품목</th><th>수량</th><th>단가 (₩)</th><th>소계</th><th style={{ minWidth: 120 }}>비고</th><th /></tr>
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
            <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700, padding: '10px 14px' }}>합계</td>
            <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--accent)', padding: '10px 14px' }}>₩{total.toLocaleString()}</td>
            <td colSpan={2} />
          </tr>
        </tbody>
      </table>
      <button className="add-row-btn" onClick={() => setData(p => [...p, { sn: p.length + 1, prize: '', item: '', qty: 0, price: 0, currency: 'KRW', note: '' }])}>
        + 항목 추가
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
