import { supabase } from './supabase'

// ── 시스템 고정값 (수정 불가) ───────────────────────────────────────────────
export { STAGE_ORDER, OUTREACH_CHANNELS } from './utils'
export const PRIORITY_OPTS = ['High', 'Medium', 'Low']
export const CONTRACT_STATUSES = ['Not Sent', 'Sent', 'Under Review', 'Revision Requested', 'Signed', 'Rejected']
export const ONBOARD_STATUSES = ['Not Started', 'Waiting Docs', 'Under Review', 'Approved', 'Rejected', 'Completed']

// ── 기본값 ──────────────────────────────────────────────────────────────────
export const DEFAULTS: Record<string, string[]> = {
  owners:          ['Andrew', 'Jacey', 'Violet', 'John'],
  sources:         ['Expo', 'Referral', 'Website', 'Cold Call', 'Partner', 'Offline Visit'],
  event_names:     ['Korea Import Fair (KIF) 2026', 'Travel Show 2026', 'SITF 2026', 'Korea Expo in Tokyo 2026'],
  corridors:       ['Korea → Japan', 'Korea → Australia', 'Korea → USA', 'Korea → Vietnam', 'Korea → Singapore', 'Korea → Philippines', 'Japan → Korea', 'Other'],
  business_types:  ['Korean Restaurant', 'Travel Agency', 'Korean Grocery', 'Education/Academy', 'Import/Export', 'Other Korean Business'],
  contact_methods: ['Email', 'Call', 'SMS', 'Kakao', 'Visit'],
  lost_reasons:    ['Pricing', 'No Response', 'Not a Fit', 'Chose Competitor', 'KYB Issue', 'Timing', 'Other'],
}

export interface SalesSettingsData {
  owners: string[]
  sources: string[]
  event_names: string[]
  corridors: string[]
  business_types: string[]
  contact_methods: string[]
  lost_reasons: string[]
}

// ── Supabase CRUD ────────────────────────────────────────────────────────────
export async function loadAllSettings(): Promise<SalesSettingsData> {
  const { data, error } = await supabase.from('sales_settings').select('key, value')
  if (error || !data?.length) return DEFAULTS as unknown as SalesSettingsData
  const map: Record<string, string[]> = {}
  for (const row of data) map[row.key] = row.value as string[]
  return {
    owners:          map.owners          ?? DEFAULTS.owners,
    sources:         map.sources         ?? DEFAULTS.sources,
    event_names:     map.event_names     ?? DEFAULTS.event_names,
    corridors:       map.corridors       ?? DEFAULTS.corridors,
    business_types:  map.business_types  ?? DEFAULTS.business_types,
    contact_methods: map.contact_methods ?? DEFAULTS.contact_methods,
    lost_reasons:    map.lost_reasons    ?? DEFAULTS.lost_reasons,
  }
}

export async function saveSetting(key: string, value: string[]): Promise<void> {
  const { error } = await supabase.from('sales_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw error // 관리자가 아니면 RLS로 거부됨
}

// ── 하위 호환 (localStorage 기반 코드가 아직 있을 경우 대비) ────────────────
/** @deprecated Use loadAllSettings() instead */
export function loadSalesSettings() {
  return {
    owners:       DEFAULTS.owners,
    sources:      DEFAULTS.sources,
    businessTypes: DEFAULTS.business_types,
    corridors:    DEFAULTS.corridors,
  }
}

/** 박람회 × 연도로 만든 리드 행사명 목록 ("{박람회명} {연도}", 최신순). 리드 등록/수정 화면이 같은 목록을 쓰도록 공용화 */
export async function loadExpoEventNames(): Promise<string[]> {
  const [{ data: propData }, { data: exhData }] = await Promise.all([
    supabase.from('proposals').select('year, exhibition_id'),
    supabase.from('exhibitions').select('id, name'),
  ])
  const exhName: Record<string, string> = {}
  for (const e of (exhData || [])) exhName[e.id] = e.name
  const names = new Set<string>()
  for (const p of (propData || [])) {
    if (exhName[p.exhibition_id]) names.add(`${exhName[p.exhibition_id]} ${p.year}`)
  }
  return [...names].sort().reverse()
}
