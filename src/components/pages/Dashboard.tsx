import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { exhColor, formatEventDate, isPastEvent, STAGE_ORDER, STAGE_COLORS } from '../../lib/utils'
import type { Exhibition, Payment, SalesLead, SalesTask, BudgetItem } from '../../types/database'
import LeadDetailPanel from './LeadDetailPanel'
import { useLang } from '../../contexts/LangContext'

const CUR_SYM: Record<string, string> = { KRW: '₩', JPY: '¥', USD: '$', EUR: '€', SGD: 'S$' }

function fmtCur(amt: number, cur: string, lang: string): string {
  const sym = CUR_SYM[cur] || cur
  if (cur === 'KRW' && lang === 'ko') return sym + Math.round(amt / 10000).toLocaleString() + '만'
  return sym + Math.round(amt).toLocaleString()
}

interface ExhEntry {
  key: string; name: string; year: number; date: string; venue: string
  budget: BudgetItem[]; total: number; recurring: boolean
}

interface UpcomingItem {
  days: number; kind: string; name: string; date: string
  color: string; detail: string; icon: string; path: string
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { t, lang } = useLang()
  const [entries, setEntries] = useState<ExhEntry[]>([])
  const [payments, setPayments] = useState<Record<string, Payment[]>>({})
  const [leads, setLeads] = useState<SalesLead[]>([])
  const [tasks, setTasks] = useState<SalesTask[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const [{ data: exhData }, { data: propData }, { data: payData }, { data: leadData }, { data: taskData }] = await Promise.all([
        supabase.from('exhibitions').select('*'),
        supabase.from('proposals').select('*').order('year', { ascending: true }),
        supabase.from('payments').select('*'),
        supabase.from('sales_leads').select('*'),
        supabase.from('sales_tasks').select('id,due_date,status,owner').neq('status', 'Done'),
      ])
      const exhMap: Record<string, Exhibition> = {}
      for (const e of (exhData || [])) exhMap[e.id] = e
      const allEntries: ExhEntry[] = []
      for (const p of (propData || [])) {
        const exh = exhMap[p.exhibition_id]
        if (!exh) continue
        const budget = (p.budget as unknown as BudgetItem[]) || []
        allEntries.push({ key: exh.key, name: exh.name, year: p.year, date: p.date_of_event, venue: p.venue, budget, total: budget.reduce((s, b) => s + (b.curr || 0), 0), recurring: exh.recurring })
      }
      setEntries(allEntries)
      const payMap: Record<string, Payment[]> = {}
      for (const p of (payData || []) as Payment[]) {
        if (!payMap[p.exhibition_key]) payMap[p.exhibition_key] = []
        payMap[p.exhibition_key].push(p)
      }
      setPayments(payMap)
      setLeads((leadData || []) as SalesLead[])
      setTasks((taskData || []) as SalesTask[])
      setLoading(false)
    }
    load()
  }, [])

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  function getLatestSorted(): ExhEntry[] {
    const latest: Record<string, ExhEntry> = {}
    for (const e of entries) if (!latest[e.key] || e.year > latest[e.key].year) latest[e.key] = e
    return Object.values(latest).sort((a, b) => {
      const parseD = (e: ExhEntry) => {
        const m = e.date.toLowerCase().match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/)
        const months: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }
        if (!m) return null
        const yr = parseInt(e.date.match(/\d{4}/)?.[0] || String(e.year))
        const day = parseInt(e.date.match(/(?<!\d)\d{1,2}(?!\d{3})/g)?.find(n => parseInt(n) <= 31) || '1')
        return new Date(yr, months[m[1]], day)
      }
      const da = parseD(a), db = parseD(b)
      return da && db ? da.getTime() - db.getTime() : a.name.localeCompare(b.name)
    })
  }

  function getUpcoming(): UpcomingItem[] {
    const items: UpcomingItem[] = []
    for (const e of getLatestSorted()) {
      const m = e.date.toLowerCase().match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/)
      if (!m) continue
      const months: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }
      const yr = parseInt(e.date.match(/\d{4}/)?.[0] || String(e.year))
      const day = parseInt(e.date.match(/(?<!\d)\d{1,2}(?!\d{3})/g)?.find(n => parseInt(n) <= 31) || '1')
      const eventDate = new Date(yr, months[m[1]], day)
      const diff = Math.round((eventDate.getTime() - today.getTime()) / 86400000)
      if (diff >= -7 && diff <= 60) {
        items.push({ days: diff, kind: 'expo', name: e.name + ' ' + e.year, date: formatEventDate(e.date, e.year), color: exhColor(e.name), detail: e.venue, icon: '📅', path: '/expo/schedule' })
      }
    }
    for (const [dbKey, pays] of Object.entries(payments)) {
      const parts = dbKey.split('_'); const yr = parts[parts.length - 1]; const k = parts.slice(0, -1).join('_')
      const exhEntry = entries.find(e => e.key === k)
      const name = (exhEntry?.name || k) + ' ' + yr
      for (const p of pays) {
        for (const [type, due, amount, paid] of [
          ['deposit', p.deposit_due, p.deposit_amount, p.deposit_paid] as [string, string | null, number, boolean],
          ['final', p.final_due, p.final_amount, p.final_paid] as [string, string | null, number, boolean],
        ]) {
          if (paid || !due) continue
          const dueDate = new Date(due)
          const diff = Math.round((dueDate.getTime() - today.getTime()) / 86400000)
          if (diff >= -7 && diff <= 60) {
            items.push({ days: diff, kind: type, name, date: due, color: diff < 0 ? '#D63031' : '#C47D1A', detail: `${p.item}  ₩${(amount || 0).toLocaleString()}`, icon: '💰', path: '/expo/payments' })
          }
        }
      }
    }
    return items.sort((a, b) => a.days - b.days).slice(0, 5)
  }

  if (loading) return <div className="view"><div style={{ color: 'var(--muted)', padding: 40 }}>{t('loading')}</div></div>

  const upcoming = getUpcoming()
  const latest = getLatestSorted()

  // Expo stats
  const exhCount = entries.length
  const budgetByCur: Record<string, number> = {}
  for (const e of entries) for (const b of e.budget) {
    const c = (b as any).currency || 'KRW'
    budgetByCur[c] = (budgetByCur[c] || 0) + b.curr
  }
  const budgetEntries = Object.entries(budgetByCur).sort(([a], [b]) => a === 'KRW' ? -1 : b === 'KRW' ? 1 : a.localeCompare(b))
  const recentExh = [...entries].sort((a, b) => b.year - a.year).slice(0, 4)
  const nextExpo = upcoming.find(u => u.kind === 'expo')
  const uniqueExhCount = new Set(entries.map(e => e.key)).size

  // Sales stats
  const total = leads.length
  const won = leads.filter(l => l.current_stage === 'Onboarded / Won').length
  const active = leads.filter(l => l.current_stage !== 'Lost' && l.current_stage !== 'Onboarded / Won').length
  const convRate = total ? Math.round(won / total * 100) : 0
  const overdue = tasks.filter(t => t.due_date < todayStr).length
  const todayTasks = tasks.filter(t => t.due_date === todayStr).length

  const toUSD = (l: SalesLead) => l.volume_currency === 'KRW' ? (l.expected_monthly_volume || 0) / 1350 : (l.expected_monthly_volume || 0)
  const topLeads = [...leads].filter(l => l.current_stage !== 'Lost').sort((a, b) => toUSD(b) - toUSD(a)).slice(0, 5)

  const byStage = (s: string) => leads.filter(l => l.current_stage === s).length

  const recentExhBudgetStr = (e: ExhEntry) => {
    const bc: Record<string, number> = {}
    for (const b of e.budget) { const c = (b as any).currency || 'KRW'; bc[c] = (bc[c] || 0) + b.curr }
    return Object.entries(bc).sort(([a], [b]) => a === 'KRW' ? -1 : 1).map(([c, v]) => fmtCur(v, c, lang)).join(' + ')
  }

  return (
    <div className="view wide">
      <div className="sec-hdr">
        <div className="bar" />
        <div className="txt">{t('dashboard')}</div>
        <div className="sub">{t('dashboard_sub')}</div>
      </div>

      {/* TOP ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

        {/* 박람회 현황 */}
        <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ background: 'var(--accent)', padding: '13px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>{t('exh_status_card')}</span>
            <button onClick={() => navigate('/expo/overview')} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,.2)', border: 'none', color: 'white', padding: '4px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>{t('view_detail')}</button>
          </div>
          <div style={{ padding: '14px 20px' }}>
            {/* 요약 3칸 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
              <div style={{ textAlign: 'center', padding: '10px 8px', background: '#F9F5F5', borderRadius: 10 }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3 }}>{t('total_hist_label')}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{exhCount}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>건</div>
              </div>
              <div style={{ textAlign: 'center', padding: '10px 8px', background: '#F9F5F5', borderRadius: 10 }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>{t('budget_lbl')}</div>
                {budgetEntries.map(([cur, amt]) => (
                  <div key={cur} style={{ whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 9, color: 'var(--muted)' }}>{cur} </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{fmtCur(amt, cur, lang)}</span>
                  </div>
                ))}
                {budgetEntries.length === 0 && <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>-</div>}
              </div>
              <div
                style={{ textAlign: 'center', padding: '10px 8px', background: nextExpo ? '#FFF8F0' : '#F9F5F5', borderRadius: 10, cursor: nextExpo ? 'pointer' : 'default', border: nextExpo ? '1px solid #FDE68A' : 'none' }}
                onClick={nextExpo ? () => navigate('/expo/schedule') : undefined}>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3 }}>{t('next_expo_label')}</div>
                {nextExpo ? (
                  <>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#D97706' }}>
                      {nextExpo.days === 0 ? 'D-Day' : nextExpo.days > 0 ? `D-${nextExpo.days}` : `D+${Math.abs(nextExpo.days)}`}
                    </div>
                    <div style={{ fontSize: 9, color: '#D97706', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nextExpo.name}</div>
                  </>
                ) : (
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--muted)' }}>없음</div>
                )}
              </div>
            </div>
            {/* 최근 박람회 */}
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>
              {t('recent_exh')}
              <span style={{ marginLeft: 6, fontWeight: 400 }}>({uniqueExhCount}종)</span>
            </div>
            {recentExh.map((e, i) => (
              <div key={i} onClick={() => navigate('/expo/overview')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '0.5px solid var(--border)', cursor: 'pointer' }}
                onMouseOver={ev => (ev.currentTarget as HTMLDivElement).style.opacity = '.7'}
                onMouseOut={ev => (ev.currentTarget as HTMLDivElement).style.opacity = '1'}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{e.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 5 }}>{e.year}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>{recentExhBudgetStr(e)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sales 현황 */}
        <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ background: '#1E3A5F', padding: '13px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>{t('sales_status_card')}</span>
            <button onClick={() => navigate('/sales/dashboard')} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,.2)', border: 'none', color: 'white', padding: '4px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>{t('view_detail')}</button>
          </div>
          <div style={{ padding: '14px 20px' }}>
            {/* KPI 2×2 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 14 }}>
              {[
                { lbl: t('all_leads_lbl'), val: total, col: '#1E3A5F', bg: '#F5F8FF', fn: (() => navigate('/sales/funnel', { state: { filter: null, view: 'table' } })) as (() => void) | null },
                { lbl: t('in_progress_lbl'), val: active, col: '#4F46E5', bg: '#F5F8FF', fn: (() => navigate('/sales/funnel', { state: { filter: '__active__', view: 'table' } })) as (() => void) | null },
                { lbl: t('s_conv'), val: convRate + '%', col: '#059669', bg: '#F0FDF4', fn: null as (() => void) | null },
                { lbl: t('overdue_short'), val: overdue, col: overdue > 0 ? '#DC2626' : '#6B7280', bg: overdue > 0 ? '#FEF2F2' : '#F9F5F5', fn: (() => navigate('/sales/followup', { state: { filter: 'overdue' } })) as (() => void) | null },
              ].map((k, i) => (
                <div key={i} onClick={k.fn || undefined}
                  style={{ textAlign: 'center', padding: '10px 8px', background: k.bg, borderRadius: 10, cursor: k.fn ? 'pointer' : 'default' }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3 }}>{k.lbl}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: k.col }}>{k.val}</div>
                </div>
              ))}
            </div>
            {/* Top Leads */}
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>🏆 Top Leads</div>
            {topLeads.length === 0 && <div style={{ fontSize: 13, color: 'var(--muted)' }}>{t('no_leads_short')}</div>}
            {topLeads.map((l, i) => (
              <div key={l.id} onClick={() => setSelectedLeadId(l.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '0.5px solid var(--border)', cursor: 'pointer' }}
                onMouseOver={ev => (ev.currentTarget as HTMLDivElement).style.opacity = '.7'}
                onMouseOut={ev => (ev.currentTarget as HTMLDivElement).style.opacity = '1'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ background: '#1E3A5F', color: 'white', borderRadius: '50%', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{l.company_name}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>{l.owner}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1E3A5F' }}>
                    {l.expected_monthly_volume ? `${l.volume_currency} ${l.expected_monthly_volume.toLocaleString()}` : '-'}
                  </div>
                  <span style={{ background: STAGE_COLORS[l.current_stage]?.bg || '#999', color: 'white', fontSize: 10, padding: '2px 7px', borderRadius: 99, fontWeight: 600 }}>{l.current_stage}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BOTTOM ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* 다가오는 일정 */}
        <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 14, padding: '18px 22px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>📅 {t('upcoming')}</span>
            <button onClick={() => navigate('/expo/schedule')} style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer', color: 'var(--muted)' }}>{t('view_all')}</button>
          </div>
          {upcoming.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 30, fontSize: 13 }}>{t('no_upcoming')}</div>
          ) : upcoming.map((ev, idx) => {
            const d = ev.days
            const urgent = d >= 0 && d <= 7
            const passed = d < 0
            const bgCol = urgent ? '#FEF2F2' : passed ? '#F3F4F6' : '#EEF2FF'
            const txtCol = urgent ? '#DC2626' : passed ? '#9CA3AF' : '#4F46E5'
            const dayLabel = passed ? `D+${Math.abs(d)}` : d === 0 ? 'D-Day' : `D-${d}`
            return (
              <div key={idx} onClick={() => navigate(ev.path)} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '0.5px solid var(--border)', cursor: 'pointer' }}
                onMouseOver={ev2 => (ev2.currentTarget as HTMLDivElement).style.opacity = '.7'}
                onMouseOut={ev2 => (ev2.currentTarget as HTMLDivElement).style.opacity = '1'}>
                <div style={{ background: bgCol, borderRadius: 8, padding: '5px 8px', textAlign: 'center', minWidth: 46, flexShrink: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: txtCol }}>{dayLabel}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{ev.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{ev.date}</div>
                  {ev.detail && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{ev.detail}</div>}
                  {ev.kind !== 'expo' && (
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>
                      {ev.kind === 'deposit' ? t('deposit_pay') : ev.kind === 'final' ? t('final_pay_short') : ev.kind}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Sales Funnel 현황 */}
        <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 14, padding: '18px 22px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{t('sales_funnel_card')}</span>
            <button onClick={() => navigate('/sales/funnel')} style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer', color: 'var(--muted)' }}>{t('view_all')}</button>
          </div>
          {STAGE_ORDER.map(s => {
            const c = STAGE_COLORS[s] || { bg: '#6B7280' }
            const cnt = byStage(s)
            const pct = total ? Math.round(cnt / total * 100) : 0
            return (
              <div key={s} onClick={() => navigate('/sales/funnel')} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9, cursor: 'pointer', padding: '3px 6px', borderRadius: 6 }}
                onMouseOver={ev => (ev.currentTarget as HTMLDivElement).style.background = '#F5F0F0'}
                onMouseOut={ev => (ev.currentTarget as HTMLDivElement).style.background = ''}>
                <div style={{ width: 130, fontSize: 12, color: 'var(--text)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s}</div>
                <div style={{ flex: 1, background: '#EEE', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: c.bg, width: pct + '%', borderRadius: 4, transition: 'width .3s' }} />
                </div>
                <div style={{ width: 22, textAlign: 'right', fontSize: 12, fontWeight: 700, color: c.bg }}>{cnt}</div>
              </div>
            )
          })}
        </div>
      </div>

      {selectedLeadId && (
        <LeadDetailPanel
          leadId={selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
          onRefresh={() => {
            supabase.from('sales_leads').select('*').then(({ data }) => { if (data) setLeads(data as SalesLead[]) })
          }}
        />
      )}
    </div>
  )
}
