import { supabase } from './supabase'

// ── 시스템 고정값 (수정 불가) ───────────────────────────────────────────────
export const STAGE_ORDER = [
  'New Lead', 'Contacted', 'Meeting Scheduled', 'Proposal Sent',
  'Negotiation', 'Onboarding', 'Onboarded/Won', 'Lost',
]
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
  lost_reasons:    ['No Demand', 'Price Issue', 'Competitor Already Used', 'No Response', 'Compliance Issue', 'Service Not Available', 'Internal Priority Low', 'Other'],
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
  await supabase.from('sales_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
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
