import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../contexts/ToastContext'

type TabId = 'overview' | 'checklist' | 'design' | 'gifts_onboard' | 'gifts_event' | 'equipment' | 'itinerary'

const STATUS_OPTS = ['Plan', 'Progress', 'Done', 'Urgent', 'Cancel']
const STATUS_COLORS: Record<string, string> = {
  Done: '#2E7D51', Progress: '#C47D1A', Plan: '#7B8AA0', Urgent: '#C0392B', Cancel: '#9CA3AF'
}
const OWNERS = ['Andrew', 'Jacey', 'Violet', 'John', 'All']
const CURRENCIES = ['KRW', 'JPY', 'USD']

const DEFAULT_CHECKLIST = [
  { sn: 1, item: '항공권 & 숙박 예약', detail: '항공편 및 숙소 예약 완료', pic: 'Andrew', deadline: '', status: 'Plan', remarks: '' },
  { sn: 2, item: '부스 이벤트 기획', detail: '현장 이벤트 계획 및 승인', pic: 'Andrew', deadline: '', status: 'Plan', remarks: '' },
  { sn: 3, item: '부스 디자인 (백드롭, 스탠드)', detail: '디자인 의뢰 → 검토 → 발주 → 수령', pic: 'Andrew', deadline: '', status: 'Plan', remarks: '' },
  { sn: 4, item: '인쇄물 주문 (X배너, 플라이어)', detail: '디자인 제출 → 인쇄 발주', pic: 'All', deadline: '', status: 'Plan', remarks: '' },
  { sn: 5, item: '자체 제작 디자인 (QR가이드, 폼보드)', detail: 'QR 가이드, 증정 폼보드 제작', pic: 'Jacey', deadline: '', status: 'Plan', remarks: '' },
  { sn: 6, item: '이벤트 경품 준비', detail: '경품 선정 및 구매', pic: 'Andrew', deadline: '', status: 'Plan', remarks: '' },
  { sn: 7, item: '신규 가입 선물 준비', detail: '선물 선정, 발주, 배송', pic: 'Andrew', deadline: '', status: 'Plan', remarks: '' },
  { sn: 8, item: '부스 잔금 & 시설 이용료 납부', detail: '납부 완료 확인', pic: 'Andrew', deadline: '', status: 'Plan', remarks: '' },
  { sn: 9, item: 'SNS 홍보', detail: '사전 홍보 게시물 작성 및 게재', pic: 'Jacey', deadline: '', status: 'Plan', remarks: '' },
  { sn: 10, item: '부스 사전 점검', detail: '설치 확인 체크리스트', pic: 'All', deadline: '', status: 'Plan', remarks: '' },
  { sn: 11, item: '입장 패스 관리', detail: '전시자 배지 수령', pic: 'Jacey', deadline: '', status: 'Plan', remarks: '' },
  { sn: 12, item: '박람회 운영', detail: '부스 이벤트 운영, 신규 머천트 유치', pic: 'All', deadline: '', status: 'Plan', remarks: '' },
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

export default function EventDetail() {
  const { key, year } = useParams<{ key: string; year: string }>()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [tab, setTab] = useState<TabId>('checklist')
  const [saving, setSaving] = useState(false)
  const [exhName, setExhName] = useState('')

  const [checklist, setChecklist] = useState<any[]>([])
  const [design, setDesign] = useState<any[]>([])
  const [giftsOnboard, setGiftsOnboard] = useState<any[]>([])
  const [giftsEvent, setGiftsEvent] = useState<any[]>([])
  const [equipment, setEquipment] = useState<any[]>([])
  const [itinerary, setItinerary] = useState<any[]>([])
  const [overview, setOverview] = useState<any>(null)
  const [dataId, setDataId] = useState<string | null>(null)

  const dbKey = `${key}_${year}`

  useEffect(() => {
    async function load() {
      const [{ data: exhData }, { data: propData }, { data: evData }] = await Promise.all([
        supabase.from('exhibitions').select('*').eq('key', key || '').single(),
        supabase.from('proposals').select('*').order('year'),
        supabase.from('event_data').select('*').eq('exhibition_key', dbKey).single(),
      ])

      if (exhData) {
        setExhName(exhData.name)
        const prop = (propData as any[])?.find((p: any) => p.exhibition_id === exhData.id)
        if (prop) setOverview({ ...prop, budget: (prop.budget as any) || [] })
      }

      if (evData) {
        setDataId(evData.id)
        setChecklist((evData.checklist as any) || DEFAULT_CHECKLIST)
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
      if (data) setDataId(data.id)
    }
    setSaving(false)
    showToast('저장되었습니다.')
  }

  const TABS: { id: TabId; label: string }[] = [
    { id: 'overview', label: '📋 개요' },
    { id: 'checklist', label: '✅ 준비 체크리스트' },
    { id: 'design', label: '🎨 디자인' },
    { id: 'gifts_onboard', label: '🎁 온보딩 선물' },
    { id: 'gifts_event', label: '🎉 이벤트 경품' },
    { id: 'equipment', label: '📦 부스 장비' },
    { id: 'itinerary', label: '✈️ 현지 일정' },
  ]

  const doneCount = checklist.filter(c => c.status === 'Done').length
  const totalCount = checklist.length

  return (
    <div className="ev-wrap">
      {/* 상단 바 */}
      <div className="ev-topbar">
        <button className="back" onClick={() => navigate(-1)}>← 돌아가기</button>
        <div className="ev-name">{exhName} {year}</div>
        <div className="ev-sub">준비 현황 {doneCount}/{totalCount} 완료</div>
      </div>

      {/* 탭 */}
      <div className="ev-tabs">
        {TABS.map(t => (
          <div key={t.id} className={`ev-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </div>
        ))}
      </div>

      {/* 본문 */}
      <div className="ev-body" style={{ flex: 1, overflowY: 'auto' }}>

        {/* 개요 */}
        {tab === 'overview' && (
          <div>
            {overview ? (
              <>
                <div className="section-badge">📅 행사 정보</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                  <div><label style={{ marginTop: 0 }}>행사 기간</label><input defaultValue={overview.date_of_event} readOnly style={{ background: '#f8f8f8' }} /></div>
                  <div><label style={{ marginTop: 0 }}>장소</label><input defaultValue={overview.venue} readOnly style={{ background: '#f8f8f8' }} /></div>
                </div>
                <div className="section-badge">🎯 참가 목적</div>
                <textarea rows={3} defaultValue={overview.objective} readOnly style={{ marginBottom: 16, background: '#f8f8f8' }} />
                <div className="section-badge">💰 승인 예산</div>
                <table className="cl-table">
                  <thead><tr><th>항목</th><th>금액</th><th>통화</th><th>비고</th></tr></thead>
                  <tbody>
                    {(overview.budget || []).map((b: any, i: number) => (
                      <tr key={i}>
                        <td>{b.item}</td>
                        <td style={{ textAlign: 'right' }}>{(b.curr || 0).toLocaleString()}</td>
                        <td>{b.currency || 'KRW'}</td>
                        <td>{b.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <div style={{ color: 'var(--muted)', padding: 40, textAlign: 'center' }}>
                Proposal 데이터가 없습니다. 먼저 Proposal을 작성해주세요.
              </div>
            )}
          </div>
        )}

        {/* 체크리스트 */}
        {tab === 'checklist' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                Done <strong style={{ color: 'var(--green)' }}>{doneCount}</strong> / 전체 {totalCount}
                <span style={{ background: 'var(--light)', borderRadius: 4, padding: '2px 8px', marginLeft: 8 }}>
                  {totalCount > 0 ? Math.round(doneCount / totalCount * 100) : 0}%
                </span>
              </div>
              <button className="add-row-btn" style={{ width: 'auto', padding: '6px 16px' }}
                onClick={() => setChecklist(p => [...p, { sn: p.length + 1, item: '', detail: '', pic: 'Andrew', deadline: '', status: 'Plan', remarks: '' }])}>
                + 항목 추가
              </button>
            </div>
            <table className="cl-table">
              <thead>
                <tr><th style={{ width: 36 }}>No</th><th>항목명</th><th>세부내용</th><th style={{ width: 90 }}>담당자</th><th style={{ width: 110 }}>마감일</th><th style={{ width: 100 }}>현황</th><th>비고</th><th style={{ width: 32 }}></th></tr>
              </thead>
              <tbody>
                {checklist.map((row, i) => (
                  <tr key={i} style={{ background: row.status === 'Done' ? '#F0FFF4' : row.status === 'Urgent' ? '#FFF1F0' : '' }}>
                    <td style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>{i + 1}</td>
                    <td><input value={row.item} onChange={e => setChecklist(p => p.map((r, j) => j === i ? { ...r, item: e.target.value } : r))} /></td>
                    <td><textarea value={row.detail} rows={2} onChange={e => setChecklist(p => p.map((r, j) => j === i ? { ...r, detail: e.target.value } : r))} /></td>
                    <td>
                      <select value={row.pic} onChange={e => setChecklist(p => p.map((r, j) => j === i ? { ...r, pic: e.target.value } : r))}>
                        {OWNERS.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </td>
                    <td><input type="date" value={row.deadline} onChange={e => setChecklist(p => p.map((r, j) => j === i ? { ...r, deadline: e.target.value } : r))} /></td>
                    <td>
                      <select value={row.status} onChange={e => setChecklist(p => p.map((r, j) => j === i ? { ...r, status: e.target.value } : r))}
                        style={{ background: STATUS_COLORS[row.status] || '#ccc', color: 'white', fontWeight: 700 }}>
                        {STATUS_OPTS.map(s => <option key={s} style={{ background: STATUS_COLORS[s] }}>{s}</option>)}
                      </select>
                    </td>
                    <td><input value={row.remarks} onChange={e => setChecklist(p => p.map((r, j) => j === i ? { ...r, remarks: e.target.value } : r))} /></td>
                    <td><button onClick={() => setChecklist(p => p.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 15 }}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 디자인 */}
        {tab === 'design' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button className="add-row-btn" style={{ width: 'auto', padding: '6px 16px' }}
                onClick={() => setDesign(p => [...p, { sn: p.length + 1, category: '', item: '', size: '', qty: '', spec: '', deadline: '', status: 'Plan', note: '' }])}>
                + 항목 추가
              </button>
            </div>
            <table className="cl-table">
              <thead>
                <tr><th style={{ width: 36 }}>No</th><th style={{ width: 80 }}>카테고리</th><th>항목</th><th style={{ width: 100 }}>규격</th><th style={{ width: 70 }}>수량</th><th>스펙</th><th style={{ width: 110 }}>마감일</th><th style={{ width: 100 }}>현황</th><th>비고</th><th style={{ width: 32 }}></th></tr>
              </thead>
              <tbody>
                {design.map((row, i) => (
                  <tr key={i} style={{ background: row.status === 'Done' ? '#F0FFF4' : '' }}>
                    <td style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>{i + 1}</td>
                    <td><input value={row.category} onChange={e => setDesign(p => p.map((r, j) => j === i ? { ...r, category: e.target.value } : r))} /></td>
                    <td><input value={row.item} onChange={e => setDesign(p => p.map((r, j) => j === i ? { ...r, item: e.target.value } : r))} /></td>
                    <td><input value={row.size} onChange={e => setDesign(p => p.map((r, j) => j === i ? { ...r, size: e.target.value } : r))} /></td>
                    <td><input value={row.qty} onChange={e => setDesign(p => p.map((r, j) => j === i ? { ...r, qty: e.target.value } : r))} /></td>
                    <td><input value={row.spec} onChange={e => setDesign(p => p.map((r, j) => j === i ? { ...r, spec: e.target.value } : r))} /></td>
                    <td><input type="date" value={row.deadline} onChange={e => setDesign(p => p.map((r, j) => j === i ? { ...r, deadline: e.target.value } : r))} /></td>
                    <td>
                      <select value={row.status} onChange={e => setDesign(p => p.map((r, j) => j === i ? { ...r, status: e.target.value } : r))}
                        style={{ background: STATUS_COLORS[row.status] || '#ccc', color: 'white', fontWeight: 700 }}>
                        {STATUS_OPTS.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td><input value={row.note} onChange={e => setDesign(p => p.map((r, j) => j === i ? { ...r, note: e.target.value } : r))} /></td>
                    <td><button onClick={() => setDesign(p => p.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 15 }}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 온보딩 선물 */}
        {tab === 'gifts_onboard' && (
          <GiftsTab data={giftsOnboard} setData={setGiftsOnboard} title="온보딩 선물 목록" prizeLabel="구분" />
        )}

        {/* 이벤트 경품 */}
        {tab === 'gifts_event' && (
          <GiftsTab data={giftsEvent} setData={setGiftsEvent} title="이벤트 경품 목록" prizeLabel="등수" />
        )}

        {/* 장비 */}
        {tab === 'equipment' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button className="add-row-btn" style={{ width: 'auto', padding: '6px 16px' }}
                onClick={() => setEquipment(p => [...p, { sn: p.length + 1, item: '', qty: 1, note: '', done: false }])}>
                + 항목 추가
              </button>
            </div>
            <table className="cl-table">
              <thead>
                <tr><th style={{ width: 36 }}>No</th><th>항목</th><th style={{ width: 70 }}>수량</th><th>비고</th><th style={{ width: 90, textAlign: 'center' }}>준비 완료</th><th style={{ width: 32 }}></th></tr>
              </thead>
              <tbody>
                {equipment.map((row, i) => (
                  <tr key={i} style={{ background: row.done ? '#F0FFF4' : '' }}>
                    <td style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>{i + 1}</td>
                    <td><input value={row.item} onChange={e => setEquipment(p => p.map((r, j) => j === i ? { ...r, item: e.target.value } : r))} /></td>
                    <td><input type="number" value={row.qty} onChange={e => setEquipment(p => p.map((r, j) => j === i ? { ...r, qty: parseInt(e.target.value) || 0 } : r))} /></td>
                    <td><input value={row.note} onChange={e => setEquipment(p => p.map((r, j) => j === i ? { ...r, note: e.target.value } : r))} /></td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={row.done} onChange={e => setEquipment(p => p.map((r, j) => j === i ? { ...r, done: e.target.checked } : r))}
                        style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--green)' }} />
                    </td>
                    <td><button onClick={() => setEquipment(p => p.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 15 }}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 12, fontSize: 13, color: 'var(--muted)' }}>
              준비 완료: <strong style={{ color: 'var(--green)' }}>{equipment.filter(e => e.done).length}</strong> / {equipment.length}
            </div>
          </div>
        )}

        {/* 현지 일정 */}
        {tab === 'itinerary' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button className="add-row-btn" style={{ width: 'auto', padding: '6px 16px' }}
                onClick={() => setItinerary(p => [...p, { sn: p.length + 1, date: '', day: '', time: '', activity: '', location: '', assignee: 'All', note: '' }])}>
                + 일정 추가
              </button>
            </div>
            <table className="cl-table">
              <thead>
                <tr><th style={{ width: 110 }}>날짜</th><th style={{ width: 50 }}>요일</th><th style={{ width: 70 }}>시간</th><th>활동 내용</th><th>장소</th><th style={{ width: 90 }}>담당자</th><th>비고</th><th style={{ width: 32 }}></th></tr>
              </thead>
              <tbody>
                {itinerary.map((row, i) => (
                  <tr key={i}>
                    <td><input type="date" value={row.date} onChange={e => {
                      const d = new Date(e.target.value)
                      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                      setItinerary(p => p.map((r, j) => j === i ? { ...r, date: e.target.value, day: isNaN(d.getTime()) ? '' : days[d.getDay()] } : r))
                    }} /></td>
                    <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--muted)' }}>{row.day}</td>
                    <td><input value={row.time} placeholder="09:00" onChange={e => setItinerary(p => p.map((r, j) => j === i ? { ...r, time: e.target.value } : r))} /></td>
                    <td><input value={row.activity} onChange={e => setItinerary(p => p.map((r, j) => j === i ? { ...r, activity: e.target.value } : r))} /></td>
                    <td><input value={row.location} onChange={e => setItinerary(p => p.map((r, j) => j === i ? { ...r, location: e.target.value } : r))} /></td>
                    <td>
                      <select value={row.assignee} onChange={e => setItinerary(p => p.map((r, j) => j === i ? { ...r, assignee: e.target.value } : r))}>
                        {OWNERS.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </td>
                    <td><input value={row.note} onChange={e => setItinerary(p => p.map((r, j) => j === i ? { ...r, note: e.target.value } : r))} /></td>
                    <td><button onClick={() => setItinerary(p => p.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 15 }}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 저장 바 */}
      <div className="ev-save-bar">
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{dbKey}</span>
        <button className="btn btn-green" onClick={save} disabled={saving} style={{ marginLeft: 'auto' }}>
          {saving ? '저장 중...' : '💾 저장'}
        </button>
      </div>
    </div>
  )
}

function GiftsTab({ data, setData, title, prizeLabel }: {
  data: any[]
  setData: React.Dispatch<React.SetStateAction<any[]>>
  title: string
  prizeLabel: string
}) {
  const total = data.reduce((s: number, r: any) => s + (r.qty || 0) * (r.price || 0), 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          총 예상 비용: <strong style={{ color: 'var(--accent)' }}>₩{total.toLocaleString()}</strong>
        </div>
        <button className="add-row-btn" style={{ width: 'auto', padding: '6px 16px' }}
          onClick={() => setData(p => [...p, { sn: p.length + 1, prize: '', item: '', qty: 0, price: 0, currency: 'KRW', note: '' }])}>
          + 항목 추가
        </button>
      </div>
      <table className="cl-table">
        <thead>
          <tr>
            <th style={{ width: 36 }}>No</th>
            <th style={{ width: 80 }}>{prizeLabel}</th>
            <th>품목</th>
            <th style={{ width: 70 }}>수량</th>
            <th style={{ width: 100 }}>단가</th>
            <th style={{ width: 72 }}>통화</th>
            <th style={{ width: 100, textAlign: 'right' }}>소계</th>
            <th>비고</th>
            <th style={{ width: 32 }}></th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              <td style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>{i + 1}</td>
              <td><input value={row.prize} onChange={e => setData(p => p.map((r, j) => j === i ? { ...r, prize: e.target.value } : r))} /></td>
              <td><input value={row.item} onChange={e => setData(p => p.map((r, j) => j === i ? { ...r, item: e.target.value } : r))} /></td>
              <td><input type="number" value={row.qty} onChange={e => setData(p => p.map((r, j) => j === i ? { ...r, qty: parseInt(e.target.value) || 0 } : r))} /></td>
              <td><input type="number" value={row.price} onChange={e => setData(p => p.map((r, j) => j === i ? { ...r, price: parseInt(e.target.value) || 0 } : r))} /></td>
              <td>
                <select value={row.currency || 'KRW'} onChange={e => setData(p => p.map((r, j) => j === i ? { ...r, currency: e.target.value } : r))} style={{ width: 64 }}>
                  {['KRW', 'JPY', 'USD'].map(c => <option key={c}>{c}</option>)}
                </select>
              </td>
              <td style={{ textAlign: 'right', fontWeight: 600 }}>
                {((row.qty || 0) * (row.price || 0)).toLocaleString()}
              </td>
              <td><input value={row.note} onChange={e => setData(p => p.map((r, j) => j === i ? { ...r, note: e.target.value } : r))} /></td>
              <td><button onClick={() => setData(p => p.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 15 }}>✕</button></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={6} style={{ textAlign: 'right', fontWeight: 700, padding: '10px 14px' }}>합계</td>
            <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--accent)', padding: '10px 14px' }}>₩{total.toLocaleString()}</td>
            <td colSpan={2}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
