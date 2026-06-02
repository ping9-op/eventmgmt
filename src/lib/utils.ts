export const TODAY = new Date()

export const MONTHS: Record<string, number> = {
  jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12
}
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

export const EXH_COLORS: Record<string, string> = {
  'Korea Import Fair (KIF)':'#B5363A','KIF':'#B5363A',
  'Travel Show':'#2E7D51','SITF':'#7B2D8B','Korea Expo in Tokyo':'#C47D1A'
}
export const COST_COLORS: Record<string, string> = {
  'Booth Fee':'#B5363A','Design':'#7B2D8B','Gift':'#2E7D51',
  'Part Timer':'#C47D1A','Flight':'#E67E22','Accommodation':'#16A085',
  'Meal':'#E74C3C','Item Delivery':'#1ABC9C'
}

export function exhDisplayName(name: string, key: string): string {
  if (!key) return name
  return name.includes(`(${key})`) ? name : `${name} (${key})`
}

export function exhColor(name: string): string {
  for (const [k, v] of Object.entries(EXH_COLORS))
    if (name && (name.includes(k) || k.includes(name))) return v
  return '#8A8A9A'
}

export function costColor(item: string): string {
  return COST_COLORS[item] || '#8A8A9A'
}

export function krw(n: number | null | undefined): string {
  return n ? '₩' + Number(n).toLocaleString() : '-'
}

export function parseEventDate(str: string, year?: number): Date | null {
  if (!str) return null
  const s = str.toLowerCase()
  let month = -1
  for (const [k, v] of Object.entries(MONTHS)) {
    if (s.includes(k)) { month = v; break }
  }
  if (month < 0) return null
  const nums = [...s.matchAll(/\d+/g)].map(m => parseInt(m[0]))
  const yr = nums.find(n => n > 1000) || year || TODAY.getFullYear()
  const days = nums.filter(n => n >= 1 && n <= 31)
  if (!days.length) return null
  return new Date(yr, month - 1, days[0])
}

export function formatEventDate(str: string, fallbackYear?: number): string {
  if (!str) return ''
  const s = str.toLowerCase()
  let month = -1
  for (const [k, v] of Object.entries(MONTHS)) {
    if (s.includes(k)) { month = v; break }
  }
  if (month < 0) return str
  const nums = [...s.matchAll(/\d+/g)].map(m => parseInt(m[0]))
  const yr = nums.find(n => n > 1000) || fallbackYear || TODAY.getFullYear()
  const days = nums.filter(n => n >= 1 && n <= 31)
  if (!days.length) return str
  const mStr = String(month).padStart(2, '0')
  const d1 = days[0], d2 = days.length >= 2 ? days[days.length - 1] : days[0]
  const date1 = new Date(yr, month - 1, d1)
  const date2 = new Date(yr, month - 1, d2)
  const ds1 = DAYS[date1.getDay()], ds2 = DAYS[date2.getDay()]
  if (d1 === d2) return `${yr}.${mStr}.${String(d1).padStart(2,'0')}(${ds1})`
  return `${yr}.${mStr}.${String(d1).padStart(2,'0')}(${ds1})~${String(d2).padStart(2,'0')}(${ds2})`
}

export function isPastEvent(dateStr: string, year: number): boolean {
  const s = dateStr.toLowerCase()
  let m = -1
  for (const [k, v] of Object.entries(MONTHS)) { if (s.includes(k)) { m = v; break } }
  if (m < 0) return year < TODAY.getFullYear()
  const nums = [...s.matchAll(/\d+/g)].map(x => parseInt(x[0]))
  const yr = nums.find(n => n > 1000) || year
  const dds = nums.filter(n => n >= 1 && n <= 31)
  const endD = dds.length >= 2 ? dds[dds.length - 1] : (dds[0] || 1)
  return new Date(yr, m - 1, endD) < TODAY
}

export function daysUntil(dateStr: string): number | null {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  const diff = d.getTime() - TODAY.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function formatTodayStr(): string {
  return TODAY.toISOString().split('T')[0]
}

export const STAGE_ORDER = [
  'New Lead','Contacted','Meeting Scheduled','Proposal Sent',
  'Negotiation','Onboarding','Onboarded / Won','Lost'
]

export const STAGE_COLORS: Record<string, {bg: string, light: string}> = {
  'New Lead':          { bg:'#7B8AA0', light:'#EEF1F5' },
  'Contacted':         { bg:'#C47D1A', light:'#FFF4E0' },
  'Meeting Scheduled': { bg:'#7B2D8B', light:'#F5EAFA' },
  'Proposal Sent':     { bg:'#B5363A', light:'#FCEAEA' },
  'Negotiation':       { bg:'#E67E22', light:'#FEF0E0' },
  'Onboarding':        { bg:'#16A085', light:'#E0F5F1' },
  'Onboarded / Won':   { bg:'#2E7D51', light:'#E5F5EC' },
  'Lost':              { bg:'#636363', light:'#F0F0F0' },
}

export function stageBadge(stage: string): string {
  const c = STAGE_COLORS[stage]
  if (!c) return stage
  return `<span style="background:${c.bg};color:white;font-size:11px;padding:3px 10px;border-radius:99px;font-weight:600;white-space:nowrap">${stage}</span>`
}

export function priorityColor(p: string): string {
  return p === 'High' ? '#C0392B' : p === 'Medium' ? '#C47D1A' : '#7B8AA0'
}
