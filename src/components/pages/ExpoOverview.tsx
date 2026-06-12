import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../contexts/LangContext'
import { useToast } from '../../contexts/ToastContext'
import LoadingSpinner from '../LoadingSpinner'
import { Chart, ArcElement, Tooltip, DoughnutController } from 'chart.js'
Chart.register(ArcElement, Tooltip, DoughnutController)
import { supabase } from '../../lib/supabase'
import { krw, exhColor, costColor, formatEventDate, isPastEvent, daysUntil, exhDisplayName, CUR_SYM, fmtCur } from '../../lib/utils'
import type { Exhibition, BudgetItem, ActualCost } from '../../types/database'


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
  const { t } = useLang()
  const { showToast } = useToast()
  const [entries, setEntries] = useState<ExhEntry[]>([])
  const [results, setResults] = useState<Record<string, { actual_costs: ActualCost[] }>>({})
  const [payments, setPayments] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState(true)

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const reloadResults = useCallback(async () => {
    try {
      const { data } = await supabase.from('results').select('exhibition_key,actual_costs')
      if (!mountedRef.current) return
      const map: Record<string, { actual_costs: ActualCost[] }> = {}
      for (const r of (data || []) as any[]) map[r.exhibition_key] = r
      setResults(map)
    } catch (e) {
      showToast('결과 데이터 로드 중 오류가 발생했습니다.', 'error')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [{ data: exhData }, { data: propData }, { data: resultData }, { data: payData }] = await Promise.all([
          supabase.from('exhibitions').select('*'),
          supabase.from('proposals').select('*').order('year'),
          supabase.from('results').select('exhibition_key,actual_costs'),
          supabase.from('payments').select('*'),
        ])
        if (cancelled) return
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
      } catch (e) {
        showToast('데이터를 불러오는 중 오류가 발생했습니다.', 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // results 실시간 동기화 — Supabase Realtime + visibilitychange 폴백
  useEffect(() => {
    const ch = supabase.channel('expo_results_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'results' }, reloadResults)
      .subscribe()

    const handleVisibility = () => { if (!document.hidden) reloadResults() }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      supabase.removeChannel(ch)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [reloadResults])

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
        items.push({ days: diff, kind: 'expo', name: exhDisplayName(e.name, e.key) + ' ' + e.year, date: formatEventDate(e.date, e.year), color: exhColor(e.name), detail: e.venue, icon: '📅' })
      }
    }
    for (const [dbKey, pays] of Object.entries(payments)) {
      const parts = dbKey.split('_'); const yr = parts[parts.length - 1]; const k = parts.slice(0, -1).join('_')
      const exhEntry = entries.find(x => x.key === k)
      const name = (exhEntry?.name || k) + ' ' + yr
      for (const p of pays) {
        for (const [type, due, amount, paid] of [
          ['deposit', p.deposit_due, p.deposit_amount, p.deposit_paid],
          ['final', p.final_due, p.final_amount, p.final_paid],
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

  if (loading) return <div className="view"><LoadingSpinner /></div>

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
        <div className="txt">{t('upcoming')}</div>
        <div className="sub">{t('upcoming_sub')} {new Date().toISOString().split('T')[0].replace(/-/g, '.')} · {t('upcoming_range')}</div>
      </div>
      {upcoming.length === 0 ? (
        <div className="card-sm" style={{ color: 'var(--muted)', textAlign: 'center', padding: 28 }}>{t('no_upcoming')}</div>
      ) : (
        <div className="upcoming-row">
          {upcoming.map((u, i) => {
            const d = u.days
            const dc = d < 0 ? 'var(--danger)' : d <= 7 ? 'var(--danger)' : d <= 14 ? 'var(--amber)' : 'var(--accent)'
            const bg = d < 0 ? '#FFF1F0' : d <= 7 ? '#FFF8E6' : 'white'
            const dt = d < 0 ? `D+${Math.abs(d)}` : d === 0 ? 'D-Day' : `D-${d}`
            const isExh = u.kind === 'expo'
            return (
              <div key={i} className="ucard" style={{ borderColor: u.color, background: bg }} onClick={() => navigate(isExh ? '/expo/schedule' : '/expo/payments')}>
                <div className="uc-top">
                  <span className="uc-kind">{u.icon} {u.kind === 'expo' ? t('kind_expo') : u.kind === 'deposit' ? t('deposit_pay') : u.kind === 'final' ? t('final_pay_short') : u.kind}</span>
                  <span className="uc-d" style={{ color: dc }}>{dt}</span>
                </div>
                <div className="uc-name">{u.name}</div>
                <div className="uc-date">{u.date}</div>
                {u.detail && <div className="uc-detail" style={{ color: u.color }}>{u.detail}</div>}
                <div style={{ marginTop: 8, fontSize: 10, color: u.color, opacity: .7 }}>{t('click_to_view')}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* 요약 */}
      <div className="sec-hdr"><div className="bar" /><div className="txt">{t('summary')}</div></div>
      <div className="metrics-grid">
        <div className="metric" onClick={() => navigate('/expo/exhibitions')}>
          <div className="lbl">{t('exh_count_lbl')}</div>
          <div className="val" style={{ color: 'var(--accent)' }}>{uniqueExhs}</div>
          <div className="sub">{t('total')} {allE.length}{t('total_hist')}</div>
        </div>
        <div className="metric" onClick={() => navigate('/expo/payments')}>
          <div className="lbl">{maxYear} {t('budget_lbl')}</div>
          <div className="val" style={{ color: 'var(--green)', fontSize: 18 }}>{krw(total2026)}</div>
          <div className="sub">{yr2026.length}{t('exh_sum')}</div>
        </div>
        <div className="metric" onClick={() => navigate('/expo/schedule')}>
          <div className="lbl">{t('avg_lbl')}</div>
          <div className="val" style={{ color: 'var(--amber)', fontSize: 18 }}>{krw(avg)}</div>
          <div className="sub">{t('all_hist')}</div>
        </div>
        <div className="metric" onClick={() => biggest && navigate(`/expo/event/${biggest.key}/${biggest.year || maxYear}`)} style={{ cursor: 'pointer' }}>
          <div className="lbl">{t('top_lbl')}</div>
          <div className="val" style={{ color: 'var(--danger)', fontSize: 15 }}>{biggest ? exhDisplayName(biggest.name, biggest.key) : ''} {biggest?.year}</div>
          <div className="sub">{krw(biggest?.total || 0)}</div>
        </div>
      </div>

      {/* 연도별 도넛 차트 */}
      <YearDonutSection entries={allE} latestSorted={latestSorted} />

      {/* 박람회 참가 현황 카드 */}
      <div className="sec-hdr"><div className="bar" /><div className="txt">{t('exh_status')}</div><div className="sub">{t('date_order')} · {new Date().toISOString().split('T')[0].replace(/-/g, '.')}</div></div>
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
          const diffStr = diff > 0 ? `▲ ${krw(diff)} ${t('over_lbl')}` : diff < 0 ? `▼ ${krw(Math.abs(diff))} ${t('under_lbl')}` : ''
          const hist = histByKey[e.key] || []

          return (
            <div key={`${e.key}_${e.year}`} className="exh-card" style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
              onClick={() => navigate(`/expo/event/${e.key}/${e.year}`)}>
              <div className="top-bar" style={{ background: topColor }} />
              <div className="ec-body" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div className="ec-hdr">
                  <span className="ec-name" style={{ color: past ? '#5A6878' : 'var(--text)' }}>{exhDisplayName(e.name, e.key)} {e.year}</span>
                  <div className="ec-badges" style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                    <span className="badge" style={{ background: past ? 'var(--muted)' : 'var(--green)' }}>{past ? t('badge_done') : t('badge_scheduled')}</span>
                    <span className="badge" style={{ background: hist.length >= 2 ? '#2E7D51' : 'var(--amber)' }}>{hist.length >= 2 ? t('badge_existing') : t('badge_new')}</span>
                  </div>
                </div>
                <div className="ec-meta">📅 {formatEventDate(e.date, e.year)} &nbsp;📍 {e.venue}</div>

                {/* 참가 이력 */}
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>{t('hist_count')} {hist.length}{t('times')}</div>
                <div style={{ height: 110, overflowY: 'auto', border: '0.5px solid var(--border)', borderRadius: 8, padding: '4px 10px', background: '#FDFBFB', marginBottom: 12 }}>
                  {hist.slice().reverse().map((h, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '0.5px solid var(--border)' }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', marginRight: 8 }}>{h.year} · {formatEventDate(h.date, h.year)}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color, whiteSpace: 'nowrap' }}>{budgetByCurStr(h.budget)}</span>
                    </div>
                  ))}
                </div>

                <hr className="divider" />
                <div className="bar-lbl"><span>{t('budgeted')}</span><span style={{ fontWeight: 700, color: topColor }}>{budgetByCurStr(e.budget)}</span></div>
                <div className="bar-track"><div className="bar-fill" style={{ width: '100%', background: topColor }} /></div>
                <div className="bar-lbl">
                  <span>{t('actual')}</span>
                  <span style={hasActual ? { fontWeight: 700, color: actC } : {}}>
                    {hasActual ? (
                      <>{krw(actualTotal)}{diffStr && <small style={{ color: actC }}> {diffStr}</small>}</>
                    ) : t('no_items')}
                  </span>
                </div>
                <div className="bar-track"><div className="bar-fill" style={{ width: actW, background: hasActual ? actC : '#ddd' }} /></div>
                {past && !hasActual && (
                  <div className="warn-box">⚠ {t('result_needed')}</div>
                )}
                <div className="exh-items" style={{ marginTop: 10 }}>
                  {e.budget.slice(0, 3).map((b, i) => (
                    <div key={i} className="exh-item-row">
                      <span>● {b.item}</span>
                      <span>{fmtCur(b.curr, (b as any).currency || 'KRW')}</span>
                    </div>
                  ))}
                  {e.budget.length > 3 && <div className="exh-item-row"><span style={{ color: 'var(--muted)' }}>+{e.budget.length - 3}{t('others_count')}</span></div>}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 12, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary btn-sm" style={{ flex: 1 }}
                    onClick={ev => { ev.stopPropagation(); navigate('/expo/create', { state: { exhId: e.exhId } }) }}>
                    ✏️ {t('btn_proposal')}
                  </button>
                  <button className="btn btn-muted btn-sm" style={{ flex: 1 }}
                    onClick={ev => { ev.stopPropagation(); navigate('/expo/report', { state: { key: `${e.key}_${e.year}` } }) }}>
                    📋 {t('btn_report')}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 비용 구조 차트 */}
      <div className="sec-hdr"><div className="bar" /><div className="txt">{t('cost_chart')}</div></div>
      <div className="chart-card">
        {latestSorted.map(e => (
          <div key={`${e.key}_${e.year}`} className="hbar-row" style={{ cursor: 'pointer' }}
            onClick={() => navigate(`/expo/event/${e.key}/${e.year}`)}>
            <span className="hbar-label" style={{ textAlign: 'right' }}>
              {(exhDisplayName(e.name, e.key) + ' ' + e.year).length > 18 ? (exhDisplayName(e.name, e.key) + ' ' + e.year).slice(0, 17) + '…' : exhDisplayName(e.name, e.key) + ' ' + e.year}
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
      <div className="sec-hdr"><div className="bar" /><div className="txt">{t('rank')}</div></div>
      <div className="table-scroll-wrapper">
      <table className="rank-table">
        <thead>
          <tr><th>{t('col_rank')}</th><th>{t('col_name')}</th><th>{t('col_year')}</th><th>{t('col_date')}</th><th>{t('col_venue')}</th><th>{t('col_budget')}</th><th>{t('col_booth')}</th></tr>
        </thead>
        <tbody>
          {ranked.map((e, i) => (
            <tr key={`${e.key}_${e.year}`} style={{ cursor: 'pointer', ...(i === 0 ? { color: 'var(--accent)', fontWeight: 700 } : {}) }}
              onClick={() => navigate(`/expo/event/${e.key}/${e.year}`)}>
              <td>{i + 1}</td>
              <td>{exhDisplayName(e.name, e.key)} {e.year}</td>
              <td>{e.year}</td>
              <td>{formatEventDate(e.date, e.year)}</td>
              <td style={{ color: 'var(--muted)' }}>{e.venue}</td>
              <td><strong>{krw(e.total)}</strong></td>
              <td>{krw(e.budget.find(b => b.item === 'Booth Fee')?.curr || 0)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td></td><td><strong>{t('total')}</strong></td><td></td><td></td><td></td><td><strong>{krw(totalAll)}</strong></td><td></td></tr>
        </tfoot>
      </table>
      </div>
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
  const { t } = useLang()
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
      <div className="sec-hdr"><div className="bar" /><div className="txt">{t('yearly')}</div></div>
      <div className="donuts-wrapper">
        {/* Left nav */}
        <div className={`donuts-nav left${canLeft ? '' : ' disabled'}`}
          onClick={canLeft ? () => setOffset(o => o - 1) : undefined}>
          ‹
        </div>
        <div className="donuts-row">
          {visibleYears.map(yr => {
            const yEntries = yearGroups[yr]
            return (
              <div key={yr} className="donut-card">
                <div className="dy">{yr}</div>
                <div className="dc">{yEntries.length}{t('unit_exh')}</div>
                <DonutChart
                  data={yEntries.map(() => 1)}
                  colors={yEntries.map(e => exhColor(e.name))}
                  centerText={String(yEntries.length)}
                />
                <div className="donut-legend">
                  {yEntries.map((e, i) => {
                    const past = isPastEvent(e.date, e.year)
                    const label = (exhDisplayName(e.name, e.key) + ' ' + e.year)
                    const displayLabel = label.length > 22 ? label.slice(0, 21) + '…' : label
                    return (
                      <div key={i} className="dl"
                        onClick={() => navigate(`/expo/event/${e.key}/${e.year}`)}
                        style={{ cursor: 'pointer', borderRadius: 6, padding: '3px 5px 3px 2px', transition: 'background .15s' }}
                        onMouseOver={ev => { (ev.currentTarget as HTMLDivElement).style.background = '#FDF0F0' }}
                        onMouseOut={ev => { (ev.currentTarget as HTMLDivElement).style.background = '' }}>
                        <div className="dot" style={{ background: exhColor(e.name) }} />
                        <span className="dn">{displayLabel}</span>
                        <span className="ds" style={{ background: past ? 'var(--muted)' : 'var(--accent)' }}>{past ? t('badge_done') : t('badge_scheduled')}</span>
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
