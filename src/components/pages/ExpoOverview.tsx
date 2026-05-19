import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Chart, ArcElement, Tooltip, DoughnutController } from 'chart.js'
Chart.register(ArcElement, Tooltip, DoughnutController)
import { supabase } from '../../lib/supabase'
import { krw, exhColor, costColor, formatEventDate, isPastEvent, daysUntil } from '../../lib/utils'
import type { Exhibition, BudgetItem, ActualCost } from '../../types/database'

const CUR_SYM: Record<string, string> = { KRW: '₩', JPY: '¥', USD: '$', EUR: '€', SGD: 'S$' }

function fmtCur(amt: number, cur: string): string {
  const sym = CUR_SYM[cur] || cur
  return sym + Math.round(amt).toLocaleString()
}

function budgetByCurStr(budget: BudgetItem[]): string {
  const bc: Record<string, number> = {}
  for (const b of budget) { const c = (b as any).currency || 'KRW'; bc[c] = (bc[c] || 0) + b.curr }
  return Object.entries(bc).sort(([a], [b]) => a === 'KRW' ? -1 : 1).map(([c, v]) => fmtCur(v, c)).join(' + ')
}

interface ExhEntry {
  key: string; exhId: string; name: string; year: number; date: string; venue: string
  budget: BudgetItem[]; total: number; recurring: boolean
  proposal_date: string; author: string
}

interface UpcomingItem {
  days: number; kind: string; name: string; date: string; color: string; detail: string; icon: string
}

export default function ExpoOverview() {
  const navigate = useNavigate()
  const [entries, setEntries] = useState<ExhEntry[]>([])
  const [results, setResults] = useState<Record<string, { actual_costs: ActualCost[] }>>({})
  const [payments, setPayments] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: exhData }, { data: propData }, { data: resultData }, { data: payData }] = await Promise.all([
        supabase.from('exhibitions').select('*'),
        supabase.from('proposals').select('*').order('year'),
        supabase.from('results').select('exhibition_key,actual_costs'),
        supabase.from('payments').select('*'),
      ])
      const exhMap: Record<string, Exhibition> = {}
      for (const e of (exhData || [])) exhMap[e.id] = e

      const list: ExhEntry[] = ((propData || []) as unknown as any[]).map(p => {
        const exh = exhMap[p.exhibition_id]
        const budget = (p.budget as BudgetItem[]) || []
        return {
          key: exh?.key || '', exhId: exh?.id || '', name: exh?.name || '', year: p.year,
          date: p.date_of_event, venue: p.venue,
          budget, total: budget.reduce((s, b) => s + (b.curr || 0), 0),
          recurring: exh?.recurring || false,
          proposal_date: p.proposal_date || '', author: p.author || ''
        }
      })
      setEntries(list)

      const resMap: Record<string, { actual_costs: ActualCost[] }> = {}
      for (const r of (resultData || []) as any[]) resMap[r.exhibition_key] = r
      setResults(resMap)

      const payMap: Record<string, any[]> = {}
      for (const p of (payData || []) as any[]) {
        if (!payMap[p.exhibition_key]) payMap[p.exhibition_key] = []
        payMap[p.exhibition_key].push(p)
      }
      setPayments(payMap)
      setLoading(false)
    }
    load()
  }, [])

  const today = new Date()

  function parseEventDate(e: ExhEntry): Date | null {
    const m = e.date.toLowerCase().match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/)
    if (!m) return null
    const months: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }
    const yr = parseInt(e.date.match(/\d{4}/)?.[0] || String(e.year))
    const day = parseInt(e.date.match(/(?<!\d)\d{1,2}(?!\d{3})/g)?.find(n => parseInt(n) <= 31) || '1')
    return new Date(yr, months[m[1]], day)
  }

  function getLatestSorted(): ExhEntry[] {
    const latest: Record<string, ExhEntry> = {}
    for (const e of entries) if (!latest[e.key] || e.year > latest[e.key].year) latest[e.key] = e
    return Object.values(latest).sort((a, b) => {
      const da = parseEventDate(a), db = parseEventDate(b)
      return da && db ? da.getTime() - db.getTime() : a.name.localeCompare(b.name)
    })
  }

  function getUpcoming(): UpcomingItem[] {
    const items: UpcomingItem[] = []
    for (const e of getLatestSorted()) {
      const d = parseEventDate(e)
      if (!d) continue
      const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
      if (diff >= -7 && diff <= 60) {
        items.push({ days: diff, kind: '박람회', name: e.name + ' ' + e.year, date: formatEventDate(e.date, e.year), color: exhColor(e.name), detail: e.venue, icon: '📅' })
      }
    }
    for (const [dbKey, pays] of Object.entries(payments)) {
      const parts = dbKey.split('_'); const yr = parts[parts.length - 1]; const k = parts.slice(0, -1).join('_')
      const exhEntry = entries.find(x => x.key === k)
      const name = (exhEntry?.name || k) + ' ' + yr
      for (const p of pays) {
        for (const [type, due, amount, paid] of [
          ['선금', p.deposit_due, p.deposit_amount, p.deposit_paid],
          ['잔금', p.final_due, p.final_amount, p.final_paid],
        ] as [string, string | null, number, boolean][]) {
          if (paid || !due) continue
          const dueDate = new Date(due)
          const diff = Math.round((dueDate.getTime() - today.getTime()) / 86400000)
          if (diff >= -7 && diff <= 60) {
            items.push({ days: diff, kind: type, name, date: due, color: diff < 0 ? '#D63031' : '#C47D1A', detail: `${p.item}  ₩${(amount || 0).toLocaleString()}`, icon: '💰' })
          }
        }
      }
    }
    return items.sort((a, b) => a.days - b.days).slice(0, 5)
  }

  if (loading) return <div className="view"><div style={{ color: 'var(--muted)', padding: 40 }}>로딩 중...</div></div>

  const upcoming = getUpcoming()
  const allE = entries
  const latestSorted = getLatestSorted()
  const maxYear = allE.length ? Math.max(...allE.map(e => e.year)) : new Date().getFullYear()
  const yr2026 = allE.filter(e => e.year === maxYear)
  const total2026 = yr2026.reduce((s, e) => s + e.total, 0)
  const avg = allE.length ? Math.round(allE.reduce((s, e) => s + e.total, 0) / allE.length) : 0
  const biggest = [...allE].sort((a, b) => b.total - a.total)[0]
  const uniqueExhs = new Set(allE.map(e => e.key)).size

  // Cost chart
  const maxTotal = Math.max(...latestSorted.map(e => e.total), 1)
  const allCostItems = [...new Set(latestSorted.flatMap(e => e.budget.map(b => b.item)))]

  // Rank table
  const ranked = [...allE].sort((a, b) => b.total - a.total)
  const totalAll = ranked.reduce((s, e) => s + e.total, 0)

  // Year groups for history per exhibition
  const histByKey: Record<string, ExhEntry[]> = {}
  for (const e of allE) {
    if (!histByKey[e.key]) histByKey[e.key] = []
    histByKey[e.key].push(e)
  }

  return (
    <div className="view wide">
      {/* 다가오는 일정 */}
      <div className="sec-hdr">
        <div className="bar" />
        <div className="txt">다가오는 일정</div>
        <div className="sub">오늘 기준 {new Date().toISOString().split('T')[0].replace(/-/g, '.')} · 향후 60일 / 최근 지연 포함</div>
      </div>
      {upcoming.length === 0 ? (
        <div className="card-sm" style={{ color: 'var(--muted)', textAlign: 'center', padding: 28 }}>향후 60일 내 일정 없음</div>
      ) : (
        <div className="upcoming-row">
          {upcoming.map((u, i) => {
            const d = u.days
            const dc = d < 0 ? 'var(--danger)' : d <= 7 ? 'var(--danger)' : d <= 14 ? 'var(--amber)' : 'var(--accent)'
            const bg = d < 0 ? '#FFF1F0' : d <= 7 ? '#FFF8E6' : 'white'
            const dt = d < 0 ? `D+${Math.abs(d)}` : d === 0 ? 'D-Day' : `D-${d}`
            const isExh = u.kind === '박람회'
            return (
              <div key={i} className="ucard" style={{ borderColor: u.color, background: bg }} onClick={() => navigate(isExh ? '/expo/schedule' : '/expo/payments')}>
                <div className="uc-top">
                  <span className="uc-kind">{u.icon} {u.kind}</span>
                  <span className="uc-d" style={{ color: dc }}>{dt}</span>
                </div>
                <div className="uc-name">{u.name}</div>
                <div className="uc-date">{u.date}</div>
                {u.detail && <div className="uc-detail" style={{ color: u.color }}>{u.detail}</div>}
                <div style={{ marginTop: 8, fontSize: 10, color: u.color, opacity: .7 }}>클릭하여 이동 →</div>
              </div>
            )
          })}
        </div>
      )}

      {/* 요약 */}
      <div className="sec-hdr"><div className="bar" /><div className="txt">요약</div></div>
      <div className="metrics-grid">
        <div className="metric" onClick={() => navigate('/expo/exhibitions')} title="기존 박람회로 이동">
          <div className="lbl">참가 박람회 수</div>
          <div className="val" style={{ color: 'var(--accent)' }}>{uniqueExhs}개</div>
          <div className="sub">전체 {allE.length}건 이력</div>
        </div>
        <div className="metric" onClick={() => navigate('/expo/payments')} title="결제 일정으로 이동">
          <div className="lbl">{maxYear} 총 승인 예산</div>
          <div className="val" style={{ color: 'var(--green)', fontSize: 18 }}>{krw(total2026)}</div>
          <div className="sub">{yr2026.length}개 박람회 합산</div>
        </div>
        <div className="metric" onClick={() => navigate('/expo/schedule')} title="일정 관리로 이동">
          <div className="lbl">박람회 평균 비용</div>
          <div className="val" style={{ color: 'var(--amber)', fontSize: 18 }}>{krw(avg)}</div>
          <div className="sub">전체 이력 기준</div>
        </div>
        <div className="metric" onClick={() => biggest && navigate(`/expo/event/${biggest.key}/${biggest.year || maxYear}`)} title="이벤트 상세로 이동" style={{ cursor: 'pointer' }}>
          <div className="lbl">최고 비용 박람회</div>
          <div className="val" style={{ color: 'var(--danger)', fontSize: 15 }}>{biggest?.name} {biggest?.year}</div>
          <div className="sub">{krw(biggest?.total || 0)}</div>
        </div>
      </div>

      {/* 연도별 도넛 차트 */}
      <YearDonutSection entries={allE} latestSorted={latestSorted} />

      {/* 박람회 참가 현황 카드 */}
      <div className="sec-hdr"><div className="bar" /><div className="txt">박람회 참가 현황</div><div className="sub">일정 순 · {new Date().toISOString().split('T')[0].replace(/-/g, '.')}</div></div>
      <div className="exh-grid">
        {latestSorted.map(e => {
          const past = isPastEvent(e.date, e.year)
          const color = exhColor(e.name)
          const topColor = past ? '#9AAFC8' : color
          const result = results[`${e.key}_${e.year}`]
          const actualTotal = result ? result.actual_costs.reduce((s, a) => s + (a.actual || 0), 0) : 0
          const hasActual = actualTotal > 0
          const diff = hasActual ? actualTotal - e.total : 0
          const actW = hasActual ? Math.min(Math.round(actualTotal / e.total * 100), 150) + '%' : '0%'
          const actC = diff > 0 ? 'var(--danger)' : 'var(--green)'
          const diffStr = diff > 0 ? `▲ ${krw(diff)} 초과` : diff < 0 ? `▼ ${krw(Math.abs(diff))} 절감` : ''
          const hist = histByKey[e.key] || []

          return (
            <div key={`${e.key}_${e.year}`} className="exh-card" style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
              onClick={() => navigate(`/expo/event/${e.key}/${e.year}`)}>
              <div className="top-bar" style={{ background: topColor }} />
              <div className="ec-body" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div className="ec-hdr">
                  <span className="ec-name" style={{ color: past ? '#5A6878' : 'var(--text)' }}>{e.name} {e.year}</span>
                  <div className="ec-badges" style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                    <span className="badge" style={{ background: past ? 'var(--muted)' : 'var(--green)' }}>{past ? '완료' : '예정'}</span>
                    <span className="badge" style={{ background: e.recurring ? '#2E7D51' : 'var(--amber)' }}>{e.recurring ? '기존' : '신규'}</span>
                  </div>
                </div>
                <div className="ec-meta">📅 {formatEventDate(e.date, e.year)} &nbsp;📍 {e.venue}</div>

                {/* 참가 이력 */}
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>참가 이력 {hist.length}회</div>
                <div style={{ height: 110, overflowY: 'auto', border: '0.5px solid var(--border)', borderRadius: 8, padding: '4px 10px', background: '#FDFBFB', marginBottom: 12 }}>
                  {hist.slice().reverse().map((h, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '0.5px solid var(--border)' }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', marginRight: 8 }}>{h.year} · {formatEventDate(h.date, h.year)}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color, whiteSpace: 'nowrap' }}>{budgetByCurStr(h.budget)}</span>
                    </div>
                  ))}
                </div>

                <hr className="divider" />
                <div className="bar-lbl"><span>승인 예산</span><span style={{ fontWeight: 700, color: topColor }}>{budgetByCurStr(e.budget)}</span></div>
                <div className="bar-track"><div className="bar-fill" style={{ width: '100%', background: topColor }} /></div>
                <div className="bar-lbl">
                  <span>실제 지출</span>
                  <span style={hasActual ? { fontWeight: 700, color: actC } : {}}>
                    {hasActual ? (
                      <>{krw(actualTotal)}{diffStr && <small style={{ color: actC }}> {diffStr}</small>}</>
                    ) : '미입력'}
                  </span>
                </div>
                <div className="bar-track"><div className="bar-fill" style={{ width: actW, background: hasActual ? actC : '#ddd' }} /></div>
                {past && !hasActual && (
                  <div className="warn-box">⚠ 실제 지출 미입력 — 결과 보고서 작성 필요</div>
                )}
                <div className="exh-items" style={{ marginTop: 10 }}>
                  {e.budget.slice(0, 3).map((b, i) => (
                    <div key={i} className="exh-item-row">
                      <span>● {b.item}</span>
                      <span>{fmtCur(b.curr, (b as any).currency || 'KRW')}</span>
                    </div>
                  ))}
                  {e.budget.length > 3 && <div className="exh-item-row"><span style={{ color: 'var(--muted)' }}>외 {e.budget.length - 3}개...</span></div>}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 12 }}>
                  <button className="btn btn-primary btn-sm" style={{ flex: 1 }}
                    onClick={ev => { ev.stopPropagation(); navigate('/expo/create', { state: { exhId: e.exhId } }) }}>
                    ✏️ Proposal 작성
                  </button>
                  <button className="btn btn-muted btn-sm" style={{ flex: 1 }}
                    onClick={ev => { ev.stopPropagation(); navigate('/expo/report', { state: { key: `${e.key}_${e.year}` } }) }}>
                    📋 결과 보고서
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 비용 구조 차트 */}
      <div className="sec-hdr"><div className="bar" /><div className="txt">박람회별 예산 구조 비교</div></div>
      <div className="chart-card">
        {latestSorted.map(e => (
          <div key={`${e.key}_${e.year}`} className="hbar-row" style={{ cursor: 'pointer' }}
            onClick={() => navigate(`/expo/event/${e.key}/${e.year}`)}>
            <span className="hbar-label" style={{ textAlign: 'right' }}>
              {(e.name + ' ' + e.year).length > 18 ? (e.name + ' ' + e.year).slice(0, 17) + '…' : e.name + ' ' + e.year}
            </span>
            <div className="hbar-track">
              {e.budget.map((b, i) => (
                <div key={i} style={{ flex: b.curr / maxTotal * 100, background: costColor(b.item), minWidth: 0 }} />
              ))}
            </div>
            <span className="hbar-total">{budgetByCurStr(e.budget)}</span>
          </div>
        ))}
        <div className="legend-row">
          {allCostItems.map(item => (
            <div key={item} className="leg-item">
              <div className="leg-dot" style={{ background: costColor(item) }} />
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* 순위 테이블 */}
      <div className="sec-hdr"><div className="bar" /><div className="txt">전체 이력 비용 순위</div></div>
      <table className="rank-table">
        <thead>
          <tr><th>순위</th><th>박람회명</th><th>연도</th><th>행사 기간</th><th>장소</th><th>총 예산</th><th>부스 비용</th></tr>
        </thead>
        <tbody>
          {ranked.map((e, i) => (
            <tr key={`${e.key}_${e.year}`} style={{ cursor: 'pointer', ...(i === 0 ? { color: 'var(--accent)', fontWeight: 700 } : {}) }}
              onClick={() => navigate(`/expo/event/${e.key}/${e.year}`)}>
              <td>{i + 1}</td>
              <td>{e.name} {e.year}</td>
              <td>{e.year}</td>
              <td>{formatEventDate(e.date, e.year)}</td>
              <td style={{ color: 'var(--muted)' }}>{e.venue}</td>
              <td><strong>{krw(e.total)}</strong></td>
              <td>{krw(e.budget.find(b => b.item === 'Booth Fee')?.curr || 0)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td></td><td><strong>합계</strong></td><td></td><td></td><td></td><td><strong>{krw(totalAll)}</strong></td><td></td></tr>
        </tfoot>
      </table>
    </div>
  )
}

function DonutChart({ data, colors, centerText }: { data: number[]; colors: string[]; centerText: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    chartRef.current?.destroy()
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return
    chartRef.current = new Chart(ctx, {
      type: 'doughnut',
      data: {
        datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }],
      },
      options: {
        responsive: false, cutout: '60%',
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
      },
      plugins: [{
        id: 'center',
        afterDraw(chart) {
          const { ctx: c, chartArea: { width: w, height: h, left: l, top: t } } = chart
          c.save()
          c.font = '700 15px Segoe UI'
          c.fillStyle = '#1A1A2E'
          c.textAlign = 'center'
          c.textBaseline = 'middle'
          c.fillText(centerText, l + w / 2, t + h / 2 - 6)
          c.font = '11px Segoe UI'
          c.fillStyle = '#7A7A8C'
          c.fillText('참가', l + w / 2, t + h / 2 + 11)
          c.restore()
        }
      }],
    })
    return () => { chartRef.current?.destroy() }
  }, [JSON.stringify(data), JSON.stringify(colors), centerText])

  return <canvas ref={canvasRef} width={150} height={150} style={{ display: 'block', margin: '0 auto' }} />
}

function YearDonutSection({ entries, latestSorted }: { entries: ExhEntry[]; latestSorted: ExhEntry[] }) {
  const navigate = useNavigate()
  const [offset, setOffset] = useState(0)
  const MAX = 4

  const yearGroups: Record<number, ExhEntry[]> = {}
  for (const e of entries) {
    if (!yearGroups[e.year]) yearGroups[e.year] = []
    yearGroups[e.year].push(e)
  }
  const sortedYears = Object.keys(yearGroups).map(Number).sort((a, b) => b - a)
  if (!sortedYears.length) return null

  const totalPages = Math.max(0, sortedYears.length - MAX)
  const visibleYears = sortedYears.slice(offset, offset + MAX)
  const cols = Math.min(visibleYears.length, MAX)
  const canLeft = offset > 0
  const canRight = offset < totalPages
  const today = new Date()

  return (
    <>
      <div className="sec-hdr"><div className="bar" /><div className="txt">연도별 박람회 참가 현황</div></div>
      <div className="donuts-wrapper" style={{ padding: '0 24px' }}>
        {/* Left nav */}
        <div className={`donuts-nav left${canLeft ? '' : ' disabled'}`}
          onClick={canLeft ? () => setOffset(o => o - 1) : undefined}>
          ‹
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 }}>
          {visibleYears.map(yr => {
            const yEntries = yearGroups[yr]
            return (
              <div key={yr} className="donut-card">
                <div className="dy">{yr}</div>
                <div className="dc">{yEntries.length}개 박람회 참가</div>
                <DonutChart
                  data={yEntries.map(() => 1)}
                  colors={yEntries.map(e => exhColor(e.name))}
                  centerText={yEntries.length + '개'}
                />
                <div className="donut-legend">
                  {yEntries.map((e, i) => {
                    const past = isPastEvent(e.date, e.year)
                    const label = (e.name + ' ' + e.year)
                    const displayLabel = label.length > 22 ? label.slice(0, 21) + '…' : label
                    return (
                      <div key={i} className="dl"
                        onClick={() => navigate(`/expo/event/${e.key}/${e.year}`)}
                        style={{ cursor: 'pointer', borderRadius: 6, padding: '3px 5px 3px 2px', transition: 'background .15s' }}
                        onMouseOver={ev => { (ev.currentTarget as HTMLDivElement).style.background = '#FDF0F0' }}
                        onMouseOut={ev => { (ev.currentTarget as HTMLDivElement).style.background = '' }}>
                        <div className="dot" style={{ background: exhColor(e.name) }} />
                        <span className="dn">{displayLabel}</span>
                        <span className="ds" style={{ background: past ? 'var(--muted)' : 'var(--accent)' }}>{past ? '완료' : '예정'}</span>
                        <span className="dv" style={{ color: exhColor(e.name) }}>1</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
        {/* Right nav */}
        <div className={`donuts-nav right${canRight ? '' : ' disabled'}`}
          onClick={canRight ? () => setOffset(o => o + 1) : undefined}>
          ›
        </div>
      </div>
    </>
  )
}
