// 개인정보(PII) 필드 암호화/복호화 공용 헬퍼
// - DB에는 암호문('enc:v1:...')만 저장되고, 키는 Edge Function(pii)에만 있음
// - 쓰기: encryptRows()로 PII 필드를 암호문으로 바꾼 뒤 insert/update (행 id가 암호문에 묶이므로 insert 전에 id를 미리 생성)
// - 읽기: DB에서 읽은 행은 반드시 decryptRows()를 거쳐 화면에 사용 (서버가 RLS로 다시 조회한 행만 복호화)
// 암호화 대상 필드는 supabase/functions/pii/index.ts 의 PII_FIELDS 와 동일하게 유지할 것
import { supabase } from './supabase'

export const PII_FIELDS = {
  sales_leads: ['contact_person', 'phone', 'email', 'address', 'remarks'],
  sales_activities: ['note'],
  sales_tasks: ['note'],
} as const
export type PiiTable = keyof typeof PII_FIELDS

const PREFIX = 'enc:v1:'
export const isEncrypted = (v: unknown): boolean => typeof v === 'string' && v.startsWith(PREFIX)

async function callPii<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('pii', { body })
  if (error) {
    // 함수가 돌려준 한국어 오류 메시지 우선
    let msg = error.message
    try { msg = (await (error as any).context?.json())?.error || msg } catch { /* 본문 없음 */ }
    throw new Error(msg)
  }
  return data as T
}

/** PII 필드를 암호문으로 교체한 행을 반환. id가 없으면 새로 생성해 채움 (insert 시 이 id를 그대로 저장해야 함) */
export async function encryptRows<T extends Record<string, any>>(table: PiiTable, rows: T[]): Promise<(T & { id: string })[]> {
  const withIds = rows.map(r => ({ ...r, id: (r.id as string) || crypto.randomUUID() }))
  const fields = PII_FIELDS[table] as readonly string[]
  const targets = withIds
    .map(r => ({ id: r.id, values: Object.fromEntries(fields.filter(f => f in r).map(f => [f, r[f]])) }))
    .filter(r => Object.values(r.values).some(v => typeof v === 'string' && v !== ''))
  if (targets.length === 0) return withIds
  const { rows: enc } = await callPii<{ rows: { id: string; values: Record<string, unknown> }[] }>({ action: 'encrypt', table, rows: targets })
  const byId = new Map(enc.map(r => [r.id, r.values]))
  return withIds.map(r => ({ ...r, ...(byId.get(r.id) || {}) }))
}

/** DB에서 읽은 행의 PII 필드를 복호화. 암호문이 없는 행은 그대로 반환 */
export async function decryptRows<T extends { id?: string }>(table: PiiTable, rows: T[]): Promise<T[]> {
  const fields = PII_FIELDS[table] as readonly string[]
  const ids = rows.filter(r => r.id && fields.some(f => isEncrypted((r as any)[f]))).map(r => r.id as string)
  if (ids.length === 0) return rows
  const { rows: plain } = await callPii<{ rows: Record<string, Record<string, unknown>> }>({ action: 'decrypt', table, ids })
  return rows.map(r => (r.id && plain[r.id] ? { ...r, ...plain[r.id] } : r))
}

/** 관리자: 아직 암호화되지 않은 기존 데이터 현황 / 일괄 암호화 */
export type PiiStatus = Record<string, { remaining: number; encrypted?: number }>
export async function piiAdmin(action: 'status' | 'migrate'): Promise<PiiStatus> {
  const { result } = await callPii<{ result: PiiStatus }>({ action })
  return result
}
