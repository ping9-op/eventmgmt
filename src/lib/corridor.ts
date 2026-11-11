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

/** 외부 입력값을 저장 형식으로 정리 ('Korea -> Japan' → 'Korea → Japan') */
export function normalizeCorridor(corridor: string | null | undefined): string {
  const { txType, country } = parseCorridor(corridor)
  return composeCorridor(txType, country)
}

export function composeCorridor(txType: TxType, country: string): string {
  const c = country.trim()
  if (!c) return ''
  if (txType === 'Outbound') return `Korea → ${c}`
  if (txType === 'Inbound') return `${c} → Korea`
  return c
}
