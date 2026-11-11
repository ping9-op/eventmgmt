import { supabase } from './supabase'

// ── 시스템 고정값 (수정 불가) ───────────────────────────────────────────────
export { STAGE_ORDER, OUTREACH_CHANNELS } from './utils'
export const PRIORITY_OPTS = ['High', 'Medium', 'Low']
// 사업자 구분 (DB CHECK 제약과 동일)
export const BUSINESS_TYPES = ['법인', '개인사업자']
export const CONTRACT_STATUSES = ['Not Sent', 'Sent', 'Under Review', 'Revision Requested', 'Signed', 'Rejected']
export const ONBOARD_STATUSES = ['Not Started', 'Waiting Docs', 'Under Review', 'Approved', 'Rejected', 'Completed']

// ── 기본값 ──────────────────────────────────────────────────────────────────
export const DEFAULTS: Record<string, string[]> = {
  owners:          ['Andrew', 'Jacey', 'Violet', 'John'],
  sources:         ['Expo', 'Referral', 'Website', 'Cold Call', 'Partner', 'Offline Visit'],
  event_names:     ['Korea Import Fair (KIF) 2026', 'Travel Show 2026', 'SITF 2026', 'Korea Expo in Tokyo 2026'],
  corridors:       ['Korea → Japan', 'Korea → Australia', 'Korea → USA', 'Korea → Vietnam', 'Korea → Singapore', 'Korea → Philippines', 'Japan → Korea', 'Other'],
  industries:      ['수입', '수출', '제조', '여행', '교육', '요식업', '도소매', '물류', 'IT/서비스', '기타'],
  contact_methods: ['Email', 'Call', 'SMS', 'Kakao', 'Visit'],
  lost_reasons:    ['Pricing', 'No Response', 'Not a Fit', 'Chose Competitor', 'KYB Issue', 'Timing', 'Other'],
}

export interface SalesSettingsData {
  owners: string[]
  sources: string[]
  event_names: string[]
  corridors: string[]
  industries: string[]
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
    industries:      map.industries      ?? DEFAULTS.industries,
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
    businessTypes: DEFAULTS.industries,
    corridors:    DEFAULTS.corridors,
  }
}
