// 세일즈 리드 ↔ 행사 연결 공용 헬퍼
// - 박람회 행사 리드: proposal_id로 식별, 표시명은 현재 박람회명/연도/회차로 계산 (event_name은 스냅샷)
// - 박람회 외 행사(설정의 event_names 자유 입력): proposal_id = null, event_name만 사용
// - 행사 없는 리드: event_name = '' → 출처(lead_source)로 묶는다
// 그룹 키는 서로 겹치지 않도록 접두사를 붙인다: 'p:<proposalId>' / 't:<행사명>' / 's:<출처>'
import { eventLabel, type EventRef } from './events'

export type EventRefMap = Map<string, EventRef>

export interface LeadEventFields {
  proposal_id?: string | null
  event_name?: string | null
  lead_source?: string | null
}

export function toEventRefMap(refs: EventRef[]): EventRefMap {
  return new Map(refs.map(r => [r.proposalId, r]))
}

/** 리드의 행사 표시명. 박람회 행사면 현재 박람회명 기준, 보관/미확인 행사면 저장된 event_name, 행사 없으면 '' */
export function leadEventLabel(l: LeadEventFields, map: EventRefMap): string {
  const ref = l.proposal_id ? map.get(l.proposal_id) : undefined
  return ref ? eventLabel(ref) : (l.event_name || '')
}

/** 행사 키: 박람회 'p:<id>', 박람회 외 행사 't:<이름>', 행사 없음 null */
export function leadEventKey(l: LeadEventFields): string | null {
  if (l.proposal_id) return `p:${l.proposal_id}`
  if (l.event_name) return `t:${l.event_name}`
  return null
}

/** 행사 기준 그룹 키 — 행사 없는 리드는 출처로 묶음 ('s:<출처>') */
export function leadEventGroupKey(l: LeadEventFields): string {
  return leadEventKey(l) ?? `s:${l.lead_source || ''}`
}

export const isExpoKey = (k: string | null | undefined): k is string => !!k && k.startsWith('p:')
export const isEventKey = (k: string | null | undefined): k is string => !!k && (k.startsWith('p:') || k.startsWith('t:'))

export function sourceGroupLabel(source: string): string {
  return `박람회 외 (출처: ${source || '미지정'})`
}

/** 그룹 키 → 표시명. 보관/미확인 박람회 행사는 그룹 내 리드의 event_name 스냅샷으로 대체 */
export function eventGroupLabel(key: string, map: EventRefMap, groupLeads: LeadEventFields[] = []): string {
  const rest = key.slice(2)
  if (key.startsWith('p:')) {
    const ref = map.get(rest)
    if (ref) return eventLabel(ref)
    return groupLeads.find(l => l.event_name)?.event_name || '(보관된 행사)'
  }
  if (key.startsWith('t:')) return rest
  return sourceGroupLabel(rest)
}

/** 그룹 키 → 리드 목록 화면(/sales/leads) 네비게이션 필터 */
export function eventGroupFilter(key: string): { proposalId: string } | { event: string } | { source: string } {
  const rest = key.slice(2)
  if (key.startsWith('p:')) return { proposalId: rest }
  if (key.startsWith('t:')) return { event: rest }
  return { source: rest }
}

export interface EventGroup<L> { key: string; label: string; isExpo: boolean; leads: L[] }

/** 리드를 행사별로 묶는다 (박람회 행사: 최신 연도순 → 박람회 외 행사: 이름순 → 행사 없음(출처별)) */
export function groupLeadsByEvent<L extends LeadEventFields>(leads: L[], map: EventRefMap): EventGroup<L>[] {
  const byKey = new Map<string, L[]>()
  for (const l of leads) {
    const k = leadEventGroupKey(l)
    const arr = byKey.get(k)
    if (arr) arr.push(l)
    else byKey.set(k, [l])
  }
  const rank = (k: string) => (k.startsWith('p:') ? 0 : k.startsWith('t:') ? 1 : 2)
  const groups = [...byKey.entries()].map(([key, ls]) => ({ key, label: eventGroupLabel(key, map, ls), isExpo: isExpoKey(key), leads: ls }))
  return groups.sort((a, b) =>
    rank(a.key) - rank(b.key)
    || (a.isExpo ? (map.get(b.key.slice(2))?.year ?? 0) - (map.get(a.key.slice(2))?.year ?? 0) : 0)
    || a.label.localeCompare(b.label))
}

/** 행사명 문자열을 박람회 행사와 매칭 (대소문자/앞뒤 공백 무시) */
export function matchEventRef(text: string | null | undefined, refs: Iterable<EventRef>): EventRef | undefined {
  const q = (text || '').trim().toLowerCase()
  if (!q) return undefined
  for (const r of refs) if (eventLabel(r).toLowerCase() === q) return r
  return undefined
}

// ── 행사 선택 <select> 공용 ─────────────────────────────────────────────────
export interface EventOption { value: string; label: string; isExpo: boolean }

/** 옵션: 박람회 행사('p:<id>') 먼저, 설정의 자유 입력 행사 중 박람회 행사명과 겹치지 않는 것('t:<이름>') */
export function eventSelectOptions(refs: EventRef[], textNames: string[] = []): EventOption[] {
  const expoLabels = new Set(refs.map(r => eventLabel(r).toLowerCase()))
  return [
    ...refs.map(r => ({ value: `p:${r.proposalId}`, label: eventLabel(r), isExpo: true })),
    ...[...new Set(textNames)].filter(n => n && !expoLabels.has(n.trim().toLowerCase())).map(n => ({ value: `t:${n}`, label: n, isExpo: false })),
  ]
}

/** 리드의 현재 행사 → select 값 */
export function leadEventSelectValue(l: LeadEventFields): string {
  return leadEventKey(l) ?? ''
}

/** select 값 → 저장할 { proposal_id, event_name } (DB 트리거에 의존하지 않도록 항상 둘 다 지정) */
export function eventSelectToFields(value: string, map: EventRefMap, fallbackName = ''): { proposal_id: string | null; event_name: string } {
  if (value.startsWith('p:')) {
    const ref = map.get(value.slice(2))
    return { proposal_id: value.slice(2), event_name: ref ? eventLabel(ref) : fallbackName }
  }
  if (value.startsWith('t:')) return { proposal_id: null, event_name: value.slice(2) }
  return { proposal_id: null, event_name: '' }
}
