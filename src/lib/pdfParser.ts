// 클라이언트 사이드 PDF/Word 텍스트 추출 + 패턴 매칭 파서
// pdfjs-dist (PDF), mammoth (Word .docx) 사용, API 키 불필요

interface ParsedProposal {
  exhName: string
  year: number
  venue: string
  dateOfEvent: string
  eventStart: string
  eventEnd: string
  objective: string
  budget: { item: string; amount: number; currency: string }[]
}

const MONTHS_EN: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
}
const MONTHS_KO: Record<string, number> = {
  '1월': 1, '2월': 2, '3월': 3, '4월': 4, '5월': 5, '6월': 6,
  '7월': 7, '8월': 8, '9월': 9, '10월': 10, '11월': 11, '12월': 12,
}

// Word(.docx)에서 전체 텍스트 추출
export async function extractTextFromDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth')
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value
}

// PDF에서 전체 텍스트 추출
export async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs', import.meta.url
  ).toString()

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const texts: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items.map((item: any) => item.str).join(' ')
    texts.push(pageText)
  }
  return texts.join('\n')
}

// 텍스트에서 제안서 정보 파싱
export function parseProposalText(text: string): ParsedProposal {
  const lines = text.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean)
  const fullText = text

  // ── 연도 추출 ─────────────────────────────────────────────────
  const yearMatch = fullText.match(/20(2[4-9]|3\d)/)
  const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear() + 1

  // ── 박람회명 추출 ──────────────────────────────────────────────
  // 레이블 뒤에 오는 값 우선
  let exhName = ''
  const exhLabels = ['Exhibition Name', 'Event Name', 'Exhibition', '박람회명', '행사명', '행사']
  for (const label of exhLabels) {
    const re = new RegExp(`${label}[:\\s：]+([^\\n\\r]+)`, 'i')
    const m = fullText.match(re)
    if (m && m[1].trim().length > 3) { exhName = m[1].trim(); break }
  }
  // fallback: 대문자로 시작하는 긴 단어 (전시회 이름 패턴)
  if (!exhName) {
    const exhPattern = fullText.match(/([A-Z][A-Za-z\s&]+(?:Fair|Expo|Show|Exhibition|Forum|Summit|Week|Fest|Conference|Trade)[\s\d]*)/i)
    if (exhPattern) exhName = exhPattern[1].trim()
  }
  // 괄호 안 약어 제거
  exhName = exhName.replace(/\s*\([A-Z]{2,6}\)\s*$/, '').trim()

  // ── 장소 추출 ──────────────────────────────────────────────────
  let venue = ''
  const venueLabels = ['Venue', 'Location', 'Place', '장소', '개최지', '행사장']
  for (const label of venueLabels) {
    const re = new RegExp(`${label}[:\\s：]+([^\\n\\r]+)`, 'i')
    const m = fullText.match(re)
    if (m && m[1].trim().length > 2) { venue = m[1].trim(); break }
  }
  if (!venue) {
    // 유명 전시장 이름 직접 검색
    const venuePatterns = ['COEX', 'KINTEX', 'BEXCO', 'EXCO', 'SETEC', 'DDP', 'CECO', 'Sunshine City', 'ICC']
    for (const vp of venuePatterns) {
      if (fullText.includes(vp)) {
        // 해당 장소 주변 텍스트 추출
        const idx = fullText.indexOf(vp)
        const snippet = fullText.slice(Math.max(0, idx - 20), idx + 60)
        const cleaned = snippet.replace(/[^\w\s,.()\-]/g, '').trim()
        venue = cleaned.slice(0, 50)
        break
      }
    }
  }

  // ── 날짜 추출 ──────────────────────────────────────────────────
  let dateOfEvent = ''
  let eventStart = ''
  let eventEnd = ''

  // "2026년 8월 12일~15일", "Aug 12-15, 2026", "2026.08.12~08.15" 등
  const datePatterns = [
    // English: Aug 12-15, 2026 or August 12 to 15, 2026
    /(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:\s*[-~to]+\s*\d{1,2})?,?\s*20\d{2})/i,
    // Korean: 2026년 8월 12일 ~ 15일
    /(20\d{2}년\s*\d{1,2}월\s*\d{1,2}일\s*[~\-~]\s*\d{1,2}일)/,
    // YYYY-MM-DD ~ YYYY-MM-DD or YYYY.MM.DD
    /(20\d{2}[-./]\d{1,2}[-./]\d{1,2}\s*[~\-~]\s*20\d{2}[-./]\d{1,2}[-./]\d{1,2})/,
    // Short: 2026.08.12-15
    /(20\d{2}\.\d{2}\.\d{2}[-~]\d{2})/,
  ]

  for (const re of datePatterns) {
    const m = fullText.match(re)
    if (m) {
      dateOfEvent = m[1].trim()
      break
    }
  }

  // dateOfEvent로부터 eventStart/eventEnd 파싱
  if (dateOfEvent) {
    const parsed = parseDateRange(dateOfEvent)
    eventStart = parsed.start
    eventEnd = parsed.end
  }

  // ── 목적 추출 ──────────────────────────────────────────────────
  let objective = ''
  const objLabels = ['Purpose', 'Objective', 'Goal', '목적', '참가 목적', '행사 목적', '참가목적']
  for (const label of objLabels) {
    const re = new RegExp(`${label}[:\\s：]+([^\\n\\r]{10,200})`, 'i')
    const m = fullText.match(re)
    if (m) { objective = m[1].trim(); break }
  }

  // ── 예산 항목 추출 ─────────────────────────────────────────────
  const budget = extractBudgetItems(fullText)

  return {
    exhName: exhName || '',
    year,
    venue: venue || '',
    dateOfEvent: dateOfEvent || '',
    eventStart: eventStart || '',
    eventEnd: eventEnd || '',
    objective: objective || '',
    budget,
  }
}

// 날짜 범위 파싱 → YYYY-MM-DD
function parseDateRange(str: string): { start: string; end: string } {
  let month = -1, year = new Date().getFullYear()

  // 영문 월 이름
  const monthMatch = str.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*/i)
  if (monthMatch) {
    month = MONTHS_EN[monthMatch[0].toLowerCase().slice(0, 3)] || -1
  }
  // 한글 월
  if (month < 0) {
    for (const [k, v] of Object.entries(MONTHS_KO)) {
      if (str.includes(k)) { month = v; break }
    }
  }
  // 숫자 월 (YYYY.MM.DD 형식)
  if (month < 0) {
    const numMatch = str.match(/20\d{2}[-./](\d{1,2})[-./](\d{1,2})/)
    if (numMatch) month = parseInt(numMatch[1])
  }

  const yearMatch = str.match(/20\d{2}/)
  if (yearMatch) year = parseInt(yearMatch[0])

  const days = [...str.matchAll(/\b(\d{1,2})\b/g)].map(m => parseInt(m[1])).filter(d => d >= 1 && d <= 31)

  if (month < 0 || days.length === 0) return { start: '', end: '' }

  const mm = String(month).padStart(2, '0')
  const d1 = String(days[0]).padStart(2, '0')
  const d2 = days.length >= 2 ? String(days[days.length - 1]).padStart(2, '0') : d1

  return { start: `${year}-${mm}-${d1}`, end: `${year}-${mm}-${d2}` }
}

// 예산 항목 추출
function extractBudgetItems(text: string): { item: string; amount: number; currency: string }[] {
  const items: { item: string; amount: number; currency: string }[] = []
  const seen = new Set<string>()

  // 통화 패턴: ₩1,500,000 / 1,500,000원 / KRW 1,500,000 / ¥500,000
  const currencyPatterns = [
    /([A-Za-z\s&()\-\/]+?)\s*[:\s]\s*(?:KRW|₩|원)\s*([\d,]+)/gi,
    /([A-Za-z\s&()\-\/]+?)\s*[:\s]\s*([\d,]+)\s*(?:KRW|₩|원)/gi,
    /([A-Za-z\s&()\-\/]+?)\s*[:\s]\s*(?:JPY|¥)\s*([\d,]+)/gi,
    /([가-힣\s]+)\s*[:\s]\s*(?:KRW|₩|원)?\s*([\d,]+)\s*(?:KRW|₩|원)?/g,
  ]

  // 알려진 박람회 비용 항목 키워드
  const knownItems = [
    'Booth Fee', 'Booth Rental', 'Stand Fee', 'Exhibition Fee',
    'Design', 'Graphic Design', 'Backdrop', 'Banner',
    'Gift', 'Gifts', 'Premium Gift', 'VIP Gift',
    'Part Timer', 'Part-timer', 'Staff', 'Personnel',
    'Flight', 'Airfare', 'Air Ticket',
    'Accommodation', 'Hotel', 'Lodging',
    'Meal', 'Catering', 'Food',
    'Freight', 'Shipping', 'Delivery', 'Logistics',
    'Brochure', 'Print', 'Printing',
    'Registration', 'Entry Fee',
  ]

  for (const pattern of currencyPatterns) {
    let m: RegExpExecArray | null
    while ((m = pattern.exec(text)) !== null) {
      const rawItem = m[1].trim().replace(/\s+/g, ' ')
      const rawAmt = m[2].replace(/,/g, '')
      const amount = parseInt(rawAmt)

      if (rawItem.length < 2 || rawItem.length > 60) continue
      if (amount < 1000 || amount > 1_000_000_000) continue
      if (seen.has(rawItem.toLowerCase())) continue

      // 정리된 항목명
      const item = rawItem.replace(/^[-•·*\s]+/, '').trim()
      if (item.length < 2) continue

      // 통화 판단
      const currency = /JPY|¥/.test(m[0]) ? 'JPY' : 'KRW'

      seen.add(item.toLowerCase())
      items.push({ item, amount, currency })
    }
  }

  // 알려진 항목명 직접 검색 (금액이 근처에 있는 경우)
  if (items.length === 0) {
    for (const known of knownItems) {
      const re = new RegExp(`${known}[^\\n\\r]{0,50}?(\\d[\\d,]{3,})`, 'i')
      const m = text.match(re)
      if (m) {
        const amount = parseInt(m[1].replace(/,/g, ''))
        if (amount > 1000 && !seen.has(known.toLowerCase())) {
          seen.add(known.toLowerCase())
          items.push({ item: known, amount, currency: 'KRW' })
        }
      }
    }
  }

  return items.slice(0, 20)
}
