// 행사(= 박람회 × 연도 × 회차) 식별 공용 모듈
// 행사의 정식 식별자는 proposals.id(proposal_id). 결제·보고서·체크리스트·리드는 proposal_id로 연결한다.
// exhibition_key 문자열('{key}_{year}')은 이행 기간 동안 기존 컬럼(NOT NULL)을 채우기 위해서만 쓴다 — 조회 조건으로 쓰지 말 것.
import { supabase } from './supabase'

export const SESSIONS = ['상반기', '하반기'] as const // 연 2회 개최 시 회차. null = 연 1회

export interface EventRef {
  proposalId: string
  exhId: string
  key: string
  name: string
  year: number
  session: string | null
}

type ProposalLike = { id: string; exhibition_id: string; year: number; session?: string | null }
type ExhibitionLike = { id: string; key: string; name: string }

export function toEventRef(p: ProposalLike, exh: ExhibitionLike | undefined): EventRef {
  return { proposalId: p.id, exhId: p.exhibition_id, key: exh?.key || '', name: exh?.name || '', year: p.year, session: p.session ?? null }
}

/** 표시용 행사명: "Korea Import Fair 2026" / "Korea Import Fair 2026 상반기" */
export function eventLabel(e: Pick<EventRef, 'name' | 'year' | 'session'>): string {
  return `${e.name} ${e.year}${e.session ? ` ${e.session}` : ''}`
}

/** 이행 기간용 문자열 키 (기존 exhibition_key 컬럼 채우기 전용). 회차가 있으면 접미사로 구분 */
export function legacyKey(e: Pick<EventRef, 'key' | 'year' | 'session'>): string {
  return `${e.key}_${e.year}${e.session === '상반기' ? '_H1' : e.session === '하반기' ? '_H2' : e.session ? `_${e.session}` : ''}`
}

/** 행사 상세 경로 */
export function eventPath(proposalId: string): string {
  return `/expo/event/${proposalId}`
}

/**
 * 세일즈 화면용 전체 행사 이름 목록 (연도 → 이름 → 회차 순)
 * 박람회/행사 조회 권한(expo_permissions)과 무관하게 리드의 행사명을 표시·선택할 수 있도록 list_event_refs RPC 사용
 * (이름/연도/회차/색상만 노출 — 결제·보고서 등 행사 상세는 권한이 있어야 조회 가능)
 */
export async function loadAllEventRefs(opts: { includeArchived?: boolean } = {}): Promise<EventRef[]> {
  const { data } = await supabase.rpc('list_event_refs')
  return (data || [])
    .filter(r => opts.includeArchived || !r.archived)
    .map(r => ({ proposalId: r.proposal_id, exhId: r.exhibition_id, key: r.key, name: r.name, year: r.year, session: r.session }))
    .sort((a, b) => b.year - a.year || a.name.localeCompare(b.name) || (a.session || '').localeCompare(b.session || ''))
}

/** 보관되지 않은 전체 행사 목록 (연도 → 이름 → 회차 순) — 박람회 화면용, 조회 권한이 있는 행사만 */
export async function loadEventRefs(opts: { includeArchived?: boolean } = {}): Promise<EventRef[]> {
  let pq = supabase.from('proposals').select('id, exhibition_id, year, session, archived_at')
  let eq = supabase.from('exhibitions').select('id, key, name, archived_at')
  if (!opts.includeArchived) { pq = pq.is('archived_at', null); eq = eq.is('archived_at', null) }
  const [{ data: props }, { data: exhs }] = await Promise.all([pq, eq])
  const exhMap: Record<string, ExhibitionLike> = {}
  for (const e of exhs || []) exhMap[e.id] = e
  return (props || [])
    .filter(p => exhMap[p.exhibition_id])
    .map(p => toEventRef(p, exhMap[p.exhibition_id]))
    .sort((a, b) => b.year - a.year || a.name.localeCompare(b.name) || (a.session || '').localeCompare(b.session || ''))
}
