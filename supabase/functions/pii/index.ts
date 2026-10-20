// pii: 개인정보 필드 암호화/복호화 (AES-256-GCM)
// - 키는 Edge Function 비밀값 PII_KEY(base64, 32바이트)에만 존재 → DB·백업이 유출돼도 암호문만 노출
// - 암호문 형식: 'enc:v1:<iv base64>:<암호문+태그 base64>', AAD = '<테이블>|<필드>|<행 id>'
//   (행 id에 묶여 있어 다른 행으로 옮긴 암호문은 복호화되지 않음)
// - 복호화는 요청자 JWT로 DB를 다시 조회(RLS 적용)한 행만 수행 → 권한 없는 데이터는 복호화 불가
// - 2단계 인증(aal2) 세션만 허용
// 배포: Supabase MCP deploy_edge_function (verify_jwt = true)

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// 암호화 대상 필드 — src/lib/pii.ts 의 PII_FIELDS 와 동일하게 유지
const PII_FIELDS: Record<string, string[]> = {
  sales_leads: ['contact_person', 'phone', 'email', 'address', 'remarks'],
  sales_activities: ['note'],
  sales_tasks: ['note'],
}
const PREFIX = 'enc:v1:'
const CHUNK = 100

const te = new TextEncoder()
const td = new TextDecoder()

function b64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}
function unb64(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

let keyPromise: Promise<CryptoKey> | null = null
function getKey(): Promise<CryptoKey> {
  if (!keyPromise) {
    const raw = Deno.env.get('PII_KEY')
    if (!raw) throw new Error('암호화 키(PII_KEY)가 설정되지 않았습니다.')
    const bytes = unb64(raw.trim())
    if (bytes.length !== 32) throw new Error('암호화 키(PII_KEY)는 32바이트 base64 값이어야 합니다.')
    keyPromise = crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt'])
  }
  return keyPromise
}

const aadOf = (table: string, field: string, id: string) => te.encode(`${table}|${field}|${id}`)
const isCipher = (v: unknown): v is string => typeof v === 'string' && v.startsWith(PREFIX)

async function encryptValue(plain: string, aad: Uint8Array): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, await getKey(), te.encode(plain))
  return `${PREFIX}${b64(iv)}:${b64(new Uint8Array(ct))}`
}

async function decryptValue(value: unknown, aad: Uint8Array): Promise<unknown> {
  if (!isCipher(value)) return value // 아직 암호화되지 않은 기존 값(이행 기간) 또는 빈 값
  const [ivS, ctS] = value.slice(PREFIX.length).split(':')
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(ivS), additionalData: aad }, await getKey(), unb64(ctS))
  return td.decode(pt)
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

function jwtClaims(token: string): Record<string, any> {
  const p = token.split('.')[1] || ''
  const pad = p.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (p.length % 4)) % 4)
  return JSON.parse(td.decode(unb64(pad)))
}

// 평문이 남아 있는 행 조회 (관리자 이행용, 서비스 키로 전체 조회)
async function plaintextRows(admin: SupabaseClient, table: string) {
  const fields = PII_FIELDS[table]
  const rows: Record<string, any>[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select(['id', ...fields].join(',')).order('id').range(from, from + 999)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return rows.filter(r => fields.some(f => typeof r[f] === 'string' && r[f] !== '' && !isCipher(r[f])))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST만 허용됩니다.' }, 405)

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const url = Deno.env.get('SUPABASE_URL')!
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: { user }, error: userErr } = await userClient.auth.getUser(token)
    if (userErr || !user) return json({ error: '로그인이 필요합니다.' }, 401)
    if (jwtClaims(token).aal !== 'aal2') return json({ error: '2단계 인증 후 이용할 수 있습니다.' }, 403)

    const body = await req.json() as { action: string; table?: string; rows?: { id: string; values: Record<string, unknown> }[]; ids?: string[] }
    const { action } = body

    // ── 관리자: 이행 현황 / 기존 데이터 암호화 ──────────────────────────────
    if (action === 'status' || action === 'migrate') {
      const { data: isAdmin } = await userClient.rpc('is_admin')
      if (!isAdmin) return json({ error: '관리자만 실행할 수 있습니다.' }, 403)
      const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
      const result: Record<string, { remaining: number; encrypted?: number }> = {}
      for (const table of Object.keys(PII_FIELDS)) {
        const rows = await plaintextRows(admin, table)
        if (action === 'status') { result[table] = { remaining: rows.length }; continue }
        let done = 0
        for (const r of rows) {
          const patch: Record<string, string> = {}
          for (const f of PII_FIELDS[table]) {
            const v = r[f]
            if (typeof v !== 'string' || v === '' || isCipher(v)) continue
            const c = await encryptValue(v, aadOf(table, f, r.id))
            // 저장 전 왕복 검증 — 복호화 결과가 원문과 다르면 중단 (데이터 손상 방지)
            if (await decryptValue(c, aadOf(table, f, r.id)) !== v) throw new Error(`암호화 검증 실패: ${table} ${r.id}`)
            patch[f] = c
          }
          const { error } = await admin.from(table).update(patch).eq('id', r.id)
          if (error) throw error
          done++
        }
        result[table] = { remaining: rows.length - done, encrypted: done }
      }
      return json({ result })
    }

    const table = body.table || ''
    const fields = PII_FIELDS[table]
    if (!fields) return json({ error: '지원하지 않는 테이블입니다.' }, 400)

    // ── 암호화: 저장할 값 → 암호문 (행 id에 묶음) ─────────────────────────
    if (action === 'encrypt') {
      const rows = body.rows || []
      const out = []
      for (const r of rows) {
        if (!r.id) return json({ error: '행 id가 필요합니다.' }, 400)
        const values: Record<string, unknown> = {}
        for (const f of fields) {
          if (!(f in r.values)) continue
          const v = r.values[f]
          values[f] = typeof v === 'string' && v !== '' && !isCipher(v) ? await encryptValue(v, aadOf(table, f, r.id)) : v
        }
        out.push({ id: r.id, values })
      }
      return json({ rows: out })
    }

    // ── 복호화: 요청자 권한(RLS)으로 다시 조회한 행만 ──────────────────────
    if (action === 'decrypt') {
      const ids = [...new Set(body.ids || [])]
      const out: Record<string, Record<string, unknown>> = {}
      for (let i = 0; i < ids.length; i += CHUNK) {
        const { data, error } = await userClient.from(table).select(['id', ...fields].join(',')).in('id', ids.slice(i, i + CHUNK))
        if (error) throw error
        for (const r of (data || []) as Record<string, any>[]) {
          const values: Record<string, unknown> = {}
          for (const f of fields) values[f] = await decryptValue(r[f], aadOf(table, f, r.id))
          out[r.id] = values
        }
      }
      return json({ rows: out })
    }

    return json({ error: '알 수 없는 요청입니다.' }, 400)
  } catch (e) {
    console.error(e)
    return json({ error: (e as Error)?.message || '처리 중 오류가 발생했습니다.' }, 500)
  }
})
