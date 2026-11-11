// 거래유형(Outbound/Inbound) + 송금 국가 ↔ country_corridor 문자열
// 리포트·필터가 country_corridor로 묶으므로 저장 형식은 기존 그대로 유지한다
//   Outbound(한국 → 해외): 'Korea → <국가>' / Inbound(해외 → 한국): '<국가> → Korea'
//   거래유형 없이 국가만: '<국가>'
export type TxType = 'Outbound' | 'Inbound' | ''
export const TX_TYPES: Exclude<TxType, ''>[] = ['Outbound', 'Inbound']

// 엑셀 등에서 들어오는 '->', '=>' 화살표도 같은 뜻으로 인식
const ARROW = '(?:→|->|=>)'

export function parseCorridor(corridor: string | null | undefined): { txType: TxType; country: string } {
  const s = (corridor || '').trim()
  const out = s.match(new RegExp(`^Korea\\s*${ARROW}\\s*(.+)$`, 'i'))
  if (out) return { txType: 'Outbound', country: out[1].trim() }
  const inb = s.match(new RegExp(`^(.+?)\\s*${ARROW}\\s*Korea$`, 'i'))
  if (inb) return { txType: 'Inbound', country: inb[1].trim() }
  return { txType: '', country: s }
}

// 송금 국가 표기 통일 — 리포트가 문자열로 묶으므로 'japan' / '일본' / 'Japan'이 따로 집계되지 않도록 영문 표준 이름으로 저장
export const COUNTRIES = [
  'Japan', 'USA', 'China', 'Vietnam', 'Philippines', 'Australia', 'Singapore', 'Thailand', 'Indonesia', 'Nepal',
  'Cambodia', 'Mongolia', 'Uzbekistan', 'Sri Lanka', 'Bangladesh', 'Myanmar', 'India', 'Pakistan', 'Malaysia',
  'Hong Kong', 'Taiwan', 'Kazakhstan', 'Russia', 'Canada', 'UK', 'Germany', 'France', 'New Zealand',
]
const COUNTRY_ALIASES: Record<string, string> = {
  '일본': 'Japan', '미국': 'USA', '중국': 'China', '베트남': 'Vietnam', '필리핀': 'Philippines', '호주': 'Australia',
  '싱가포르': 'Singapore', '태국': 'Thailand', '인도네시아': 'Indonesia', '네팔': 'Nepal', '캄보디아': 'Cambodia',
  '몽골': 'Mongolia', '우즈베키스탄': 'Uzbekistan', '스리랑카': 'Sri Lanka', '방글라데시': 'Bangladesh', '미얀마': 'Myanmar',
  '인도': 'India', '파키스탄': 'Pakistan', '말레이시아': 'Malaysia', '홍콩': 'Hong Kong', '대만': 'Taiwan',
  '카자흐스탄': 'Kazakhstan', '러시아': 'Russia', '캐나다': 'Canada', '영국': 'UK', '독일': 'Germany', '프랑스': 'France',
  '뉴질랜드': 'New Zealand',
  'us': 'USA', 'u.s.': 'USA', 'u.s.a.': 'USA', 'united states': 'USA', 'america': 'USA',
  'united kingdom': 'UK', 'england': 'UK', 'viet nam': 'Vietnam',
}

/**
 * 입력한 국가명을 표준 이름으로 — 별칭(일본·US 등) → 표준 목록·기존 값과 대소문자 무시 일치 → 그 밖은 단어 첫 글자만 대문자
 * @param known 이미 저장된 국가명 (목록에 없는 나라도 먼저 쓴 표기로 맞춤)
 */
export function canonicalCountry(input: string, known: string[] = []): string {
  const s = input.trim().replace(/\s+/g, ' ')
  if (!s) return ''
  const alias = COUNTRY_ALIASES[s] ?? COUNTRY_ALIASES[s.toLowerCase()]
  if (alias) return alias
  const hit = [...COUNTRIES, ...known].find(c => c.toLowerCase() === s.toLowerCase())
  if (hit) return hit
  return s.replace(/(^|\s)(\p{Ll})/gu, (_m, sp: string, ch: string) => sp + ch.toUpperCase())
}

/** 외부 입력값을 저장 형식으로 정리 ('Korea -> japan' → 'Korea → Japan') */
export function normalizeCorridor(corridor: string | null | undefined, known: string[] = []): string {
  const { txType, country } = parseCorridor(corridor)
  return composeCorridor(txType, canonicalCountry(country, known))
}

export function composeCorridor(txType: TxType, country: string): string {
  const c = country.trim()
  if (!c) return ''
  if (txType === 'Outbound') return `Korea → ${c}`
  if (txType === 'Inbound') return `${c} → Korea`
  return c
}
