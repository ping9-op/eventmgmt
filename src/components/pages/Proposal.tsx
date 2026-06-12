import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { krw, exhColor, formatEventDate, exhDisplayName, CURRENCIES, COST_ITEMS, MON, formatDateRange, parseDateRange } from '../../lib/utils'
import { extractTextFromPdf, extractTextFromDocx, parseProposalText } from '../../lib/pdfParser'
import type { Exhibition, Proposal as ProposalType, BudgetItem, ProductTarget } from '../../types/database'
import { useLang } from '../../contexts/LangContext'
import { useToast } from '../../contexts/ToastContext'


interface ParsedProposal {
  exhName: string; year: number
  venue: string; eventStart: string; eventEnd: string; dateOfEvent: string
  objective: string
  budget: { item: string; amount: number; currency: string }[]
  _error?: string
}

interface SavedProposal {
  key: string; exhId: string; name: string; year: number; date: string; total: number; color: string
}

export default function Proposal() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useLang()
  const { showToast } = useToast()
  const initExhId = (location.state as any)?.exhId || null

  const [step, setStep] = useState(1)
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([])
  const [proposals, setProposals] = useState<ProposalType[]>([])
  const [savedList, setSavedList] = useState<SavedProposal[]>([])
  const [proposalPage, setProposalPage] = useState(0)

  // Upload area
  const [showUpload, setShowUpload] = useState(false)
  const [uploadFileName, setUploadFileName] = useState('')

  // Form state
  const [exhId, setExhId] = useState<string>(initExhId || '')
  const [isNewExh, setIsNewExh] = useState(false)
  const [newExhName, setNewExhName] = useState('')
  const [newExhKey, setNewExhKey] = useState('')
  const [newExhRecurring, setNewExhRecurring] = useState(false)
  const [year, setYear] = useState(new Date().getFullYear() + 1)
  const [propDate, setPropDate] = useState(new Date().toISOString().split('T')[0])
  const [author, setAuthor] = useState('Andrew')
  const [dateOfEvent, setDateOfEvent] = useState('')
  const [eventStartDate, setEventStartDate] = useState('')
  const [eventEndDate, setEventEndDate] = useState('')
  const [venue, setVenue] = useState('')
  const [objective, setObjective] = useState('')
  const [products, setProducts] = useState<ProductTarget[]>([{ product: 'GMEBIZ', target: '' }])
  const [expectedResults, setExpectedResults] = useState<string[]>(['Promote GME BIZ to potential merchants'])
  const [budget, setBudget] = useState<BudgetItem[]>([
    { item: 'Booth Fee', curr: 0, prev: 0, note: '', currency: 'KRW' },
    { item: 'Design', curr: 0, prev: 0, note: '', currency: 'KRW' },
    { item: 'Gift', curr: 0, prev: 0, note: '', currency: 'KRW' },
  ])
  const [aiMemos, setAiMemos] = useState<Record<string, string>>({})
  const [aiOutput, setAiOutput] = useState('AI 생성 결과가 여기에 표시됩니다.\n\n"AI 변동 사유 생성" 버튼을 눌러주세요.')
  const [aiLoading, setAiLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [editingProposalId, setEditingProposalId] = useState<string | null>(null)
  const [parseLoading, setParseLoading] = useState(false)
  const [parseResult, setParseResult] = useState<ParsedProposal | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadOnMount() {
      try {
        const [{ data: exhData }, { data: propData }] = await Promise.all([
          supabase.from('exhibitions').select('*').order('name'),
          supabase.from('proposals').select('*').order('year'),
        ])
        if (cancelled) return
        const exhList = (exhData || []) as Exhibition[]
        const propList = ((propData || []) as unknown as ProposalType[])
        setExhibitions(exhList)
        setProposals(propList)

        // Build saved proposals list
        const list: SavedProposal[] = propList.map(p => {
          const exh = exhList.find(e => e.id === p.exhibition_id)
          const budgetItems = (p.budget as BudgetItem[]) || []
          return {
            key: exh?.key || '', exhId: p.exhibition_id,
            name: exh?.name || '', year: p.year,
            date: p.date_of_event,
            total: budgetItems.reduce((s, b) => s + (b.curr || 0), 0),
            color: exhColor(exh?.name || ''),
          }
        }).sort((a, b) => b.year - a.year || a.name.localeCompare(b.name))
        setSavedList(list)

        // Pre-fill if editing
        if (initExhId) {
          const exhProposals = propList.filter(p => p.exhibition_id === initExhId)
          const latest = exhProposals[exhProposals.length - 1]
          if (latest) {
            setExhId(initExhId)
            setYear(latest.year + 1)
            setAuthor(latest.author || 'Andrew')
            setDateOfEvent(latest.date_of_event)
            const { start, end } = parseDateRange(latest.date_of_event)
            setEventStartDate(start); setEventEndDate(end)
            setVenue(latest.venue)
            setObjective(latest.objective)
            setProducts((latest.products as ProductTarget[]) || [{ product: 'GMEBIZ', target: '' }])
            setExpectedResults((latest.expected_results as string[]) || [''])
            const newBudget = ((latest.budget as BudgetItem[]) || []).map(b => ({ ...b, prev: b.curr, curr: b.curr }))
            setBudget(newBudget.length ? newBudget : [{ item: 'Booth Fee', curr: 0, prev: 0, note: '', currency: 'KRW' }])
          }
        }
      } catch (err) {
        if (!cancelled) showToast('데이터 로드 실패: ' + (err instanceof Error ? err.message : String(err)))
      }
    }
    loadOnMount()
    return () => { cancelled = true }
  }, [initExhId])

  async function load() {
    const [{ data: exhData }, { data: propData }] = await Promise.all([
      supabase.from('exhibitions').select('*').order('name'),
      supabase.from('proposals').select('*').order('year'),
    ])
    const exhList = (exhData || []) as Exhibition[]
    const propList = ((propData || []) as unknown as ProposalType[])
    setExhibitions(exhList)
    setProposals(propList)

    // Build saved proposals list
    const list: SavedProposal[] = propList.map(p => {
      const exh = exhList.find(e => e.id === p.exhibition_id)
      const budgetItems = (p.budget as BudgetItem[]) || []
      return {
        key: exh?.key || '', exhId: p.exhibition_id,
        name: exh?.name || '', year: p.year,
        date: p.date_of_event,
        total: budgetItems.reduce((s, b) => s + (b.curr || 0), 0),
        color: exhColor(exh?.name || ''),
      }
    }).sort((a, b) => b.year - a.year || a.name.localeCompare(b.name))
    setSavedList(list)
  }

  function loadFromSaved(p: SavedProposal, isCopy = false) {
    const propEntry = proposals.find(pr => pr.exhibition_id === p.exhId && pr.year === p.year)
    if (!propEntry) return
    setExhId(p.exhId)
    setIsNewExh(false)
    setYear(isCopy ? p.year + 1 : p.year)
    setPropDate(isCopy ? new Date().toISOString().split('T')[0] : (propEntry.proposal_date || new Date().toISOString().split('T')[0]))
    setEditingProposalId(isCopy ? null : propEntry.id)
    setAuthor(propEntry.author || 'Andrew')
    setDateOfEvent(propEntry.date_of_event)
    const { start, end } = parseDateRange(propEntry.date_of_event)
    setEventStartDate(start); setEventEndDate(end)
    setVenue(propEntry.venue)
    setObjective(propEntry.objective)
    setProducts((propEntry.products as ProductTarget[]) || [{ product: 'GMEBIZ', target: '' }])
    setExpectedResults((propEntry.expected_results as string[]) || [''])
    const newBudget = ((propEntry.budget as BudgetItem[]) || []).map(b => ({ ...b, prev: b.curr, curr: b.curr }))
    setBudget(newBudget.length ? newBudget : [{ item: 'Booth Fee', curr: 0, prev: 0, note: '', currency: 'KRW' }])
    setSaved(false)
    setAiOutput('AI 생성 결과가 여기에 표시됩니다.\n\n"AI 변동 사유 생성" 버튼을 눌러주세요.')
    setStep(1)
    window.scrollTo(0, 0)
    const displayName = exhDisplayName(p.name, p.key)
    showToast(isCopy
      ? `✅ ${displayName} ${p.year} 기준 복사 완료 — ${p.year + 1}년도 내용을 수정 후 저장하세요.`
      : `✏️ ${displayName} ${p.year} 불러왔습니다.`)
  }

  async function save() {
    if (!year) return
    setSaving(true)
    try {
      let finalExhId = exhId
      if (isNewExh && newExhName) {
        const key = newExhKey.trim().replace(/\s/g, '_') || newExhName.replace(/[^a-zA-Z]/g, '').substring(0, 10)
        const { data, error } = await supabase.from('exhibitions').insert({ key, name: newExhName, recurring: newExhRecurring }).select().single()
        if (error || !data) throw new Error(error?.message || '박람회 등록 실패')
        finalExhId = data.id
      }
      const proposalData = {
        exhibition_id: finalExhId, year, proposal_date: propDate, author,
        date_of_event: dateOfEvent, venue, objective,
        products: products.filter(p => p.product) as unknown as never,
        expected_results: expectedResults.filter(r => r) as unknown as never,
        budget: budget.filter(b => b.curr > 0) as unknown as never,
        explanations: {}
      }
      if (editingProposalId) {
        // 기존 제안서 수정 — payments는 그대로 유지
        const { error } = await supabase.from('proposals').update(proposalData).eq('id', editingProposalId)
        if (error) throw new Error(error.message)
      } else {
        // 신규 또는 복사 — 제안서 + 결제 항목 모두 새로 생성
        const { error } = await supabase.from('proposals').insert(proposalData)
        if (error) throw new Error(error.message)
        const exh = exhibitions.find(e => e.id === finalExhId)
        const dbKey = (exh?.key || newExhName.replace(/[^a-zA-Z]/g, '').substring(0, 10)) + '_' + year
        for (const b of budget.filter(b => b.curr > 0)) {
          await supabase.from('payments').insert({
            exhibition_key: dbKey, item: b.item, total: b.curr, currency: (b as any).currency || 'KRW',
            deposit_amount: 0, deposit_due: null, deposit_paid: false,
            final_amount: 0, final_due: null, final_paid: false,
          })
        }
      }
      setSaved(true)
      setEditingProposalId(null)
      await load()
      setTimeout(() => { setSaved(false); setStep(1) }, 1500)
    } catch (err) {
      showToast('저장 실패: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSaving(false)
    }
  }

  async function handleBudgetExcel(file: File) {
    const XLSX = await import('xlsx')
    const reader = new FileReader()
    reader.onload = e => {
      const data = new Uint8Array(e.target!.result as ArrayBuffer)
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' })
      const items: BudgetItem[] = rows.map(r => {
        const keys = Object.keys(r)
        const item = String(r['항목'] || r['Item'] || r['item'] || r[keys[0]] || '')
        const currRaw = String(r['금액'] || r['Amount'] || r['amount'] || r['curr'] || r[keys[1]] || '')
        const curr = parseInt(currRaw.replace(/[^0-9]/g, '')) || 0
        const currency = String(r['통화'] || r['Currency'] || r['currency'] || 'KRW')
        const note = String(r['비고'] || r['Note'] || r['note'] || '')
        return { item, curr, prev: 0, note, currency }
      }).filter(b => b.item && b.curr > 0)
      if (!items.length) {
        showToast('⚠️ 유효한 예산 항목이 없습니다. (항목/금액 컬럼 필요)')
        return
      }
      setBudget(prev => {
        const merged = [...prev]
        for (const n of items) {
          const idx = merged.findIndex(b => b.item === n.item)
          if (idx >= 0) merged[idx] = { ...merged[idx], curr: n.curr, note: n.note }
          else merged.push(n)
        }
        return merged
      })
      showToast(`✅ ${items.length}개 항목을 가져왔습니다.`)
    }
    reader.readAsArrayBuffer(file)
  }

  async function simulateParse(file: File) {
    setUploadFileName(file.name)
    setParseLoading(true)
    setParseResult(null)

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    const isDocx = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      || file.name.toLowerCase().endsWith('.docx')
      || file.name.toLowerCase().endsWith('.doc')
    const isImage = file.type.startsWith('image/')

    try {
      // ── 1차: AI Edge Function (API 키 있을 때) ────────────────────
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

      if (isPdf || isImage || isDocx) {
        const fileBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve((reader.result as string).split(',')[1])
          reader.onerror = reject
          reader.readAsDataURL(file)
        })

        const res = await fetch(`${supabaseUrl}/functions/v1/parse-proposal`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${supabaseAnonKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileBase64, mimeType: file.type || 'application/pdf', fileName: file.name }),
        })
        const json = await res.json()

        // AI 파싱 성공
        if (res.ok && !json.error) {
          setParseResult(json.result as ParsedProposal)
          setParseLoading(false)
          return
        }

        // API 키 미설정 → PDF 텍스트 추출 폴백
        const isNoKey = json.error?.includes('ANTHROPIC_API_KEY')
        if (!isNoKey) {
          // 다른 오류는 그대로 표시
          setParseResult({
            exhName: '', year: new Date().getFullYear() + 1,
            venue: '', eventStart: '', eventEnd: '', dateOfEvent: '', objective: '', budget: [],
            _error: `AI 파싱 실패: ${json.error || '알 수 없는 오류'}`,
          })
          setParseLoading(false)
          return
        }
      }

      // ── 2차: 클라이언트 사이드 텍스트 추출 (API 키 없을 때 폴백) ──
      const extractAndParse = async (text: string) => {
        if (text.trim().length < 20) throw new Error('텍스트를 추출할 수 없습니다')
        return parseProposalText(text)
      }

      if (isPdf) {
        try {
          const text = await extractTextFromPdf(file)
          const parsed = await extractAndParse(text)
          setParseResult({ ...parsed, _error: undefined })
        } catch (err) {
          setParseResult({
            exhName: '', year: new Date().getFullYear() + 1,
            venue: '', eventStart: '', eventEnd: '', dateOfEvent: '', objective: '', budget: [],
            _error: `PDF 텍스트 추출 실패: ${err instanceof Error ? err.message : String(err)}\n스캔된 PDF의 경우 이미지(JPG/PNG)로 변환 후 업로드하거나 직접 입력하세요.`,
          })
        }
      } else if (isDocx) {
        try {
          const text = await extractTextFromDocx(file)
          const parsed = await extractAndParse(text)
          setParseResult({ ...parsed, _error: undefined })
        } catch (err) {
          setParseResult({
            exhName: '', year: new Date().getFullYear() + 1,
            venue: '', eventStart: '', eventEnd: '', dateOfEvent: '', objective: '', budget: [],
            _error: `Word 파일 파싱 실패: ${err instanceof Error ? err.message : String(err)}\n직접 입력을 사용해주세요.`,
          })
        }
      } else if (isImage) {
        setParseResult({
          exhName: '', year: new Date().getFullYear() + 1,
          venue: '', eventStart: '', eventEnd: '', dateOfEvent: '', objective: '', budget: [],
          _error: 'AI API 키가 없어 이미지를 분석할 수 없습니다. PDF 또는 Word 파일로 업로드하거나 직접 입력하세요.',
        })
      } else {
        setParseResult({
          exhName: '', year: new Date().getFullYear() + 1,
          venue: '', eventStart: '', eventEnd: '', dateOfEvent: '', objective: '', budget: [],
          _error: '지원하지 않는 파일 형식입니다. PDF, Word(.docx), 이미지를 업로드해주세요.',
        })
      }
    } catch (err) {
      setParseResult({
        exhName: '', year: new Date().getFullYear() + 1,
        venue: '', eventStart: '', eventEnd: '', dateOfEvent: '', objective: '', budget: [],
        _error: `오류: ${err instanceof Error ? err.message : String(err)}`,
      })
    } finally {
      setParseLoading(false)
    }
  }

  function applyParsedToForm(r: ParsedProposal, targetStep = 1) {
    // 폼 전체 초기화 후 파싱 결과 적용
    // 이전 proposal 편집 상태 완전히 해제
    setEditingProposalId(null)
    setAiOutput('AI 생성 결과가 여기에 표시됩니다.\n\n"AI 변동 사유 생성" 버튼을 눌러주세요.')
    setAiMemos({})
    setPropDate(new Date().toISOString().split('T')[0])

    // 박람회명으로 기존 박람회 자동 매칭
    if (r.exhName) {
      const q = r.exhName.toLowerCase()
      const matched = exhibitions.find(e =>
        e.name.toLowerCase().includes(q) || q.includes(e.name.toLowerCase()) ||
        e.name.toLowerCase().split(' ').some(w => w.length > 3 && q.includes(w))
      )
      if (matched) {
        setExhId(matched.id)
        setIsNewExh(false)
        setNewExhName('')
        setNewExhKey('')
      } else {
        setExhId('')
        setIsNewExh(true)
        setNewExhName(r.exhName)
        setNewExhKey(r.exhName.replace(/[^a-zA-Z]/g, '').substring(0, 10))
      }
    } else {
      setExhId('')
      setIsNewExh(false)
    }

    setYear(r.year)
    setVenue(r.venue)
    setEventStartDate(r.eventStart)
    setEventEndDate(r.eventEnd)
    setDateOfEvent(r.dateOfEvent)
    setObjective(r.objective)
    // 제품/기대효과는 파싱 결과에 없으므로 기본값으로 초기화
    setProducts([{ product: 'GMEBIZ', target: '' }])
    setExpectedResults(['Promote GME BIZ to potential merchants'])
    setBudget(
      r.budget.length > 0
        ? r.budget.map(b => ({ item: b.item, curr: b.amount, prev: 0, note: '', currency: b.currency }))
        : [{ item: 'Booth Fee', curr: 0, prev: 0, note: '', currency: 'KRW' }]
    )
    setParseResult(null)
    setShowUpload(false)
    setStep(targetStep)
    window.scrollTo(0, 0)
  }

  async function runAI() {
    if (changedItems.length === 0) {
      setAiOutput('변동 항목이 없습니다. Step 3에서 예산을 입력해주세요.')
      return
    }

    setAiLoading(true)
    setAiOutput('🤖 AI 생성 중...\n')

    const exhName = isNewExh ? newExhName : (exhibitions.find(e => e.id === exhId)?.name || '박람회')

    const itemLines = changedItems.map(r => {
      const dir = r.curr > (r.prev || 0) ? '증가' : !r.prev ? '신규' : '감소'
      const memo = aiMemos[r.item] ? ` / 참고: ${aiMemos[r.item]}` : ''
      return `- ${r.item}: ${r.prev ? krw(r.prev) + ' → ' : '(신규) '}${krw(r.curr)} (${dir})${memo}`
    }).join('\n')

    const userMsg =
      `아래 박람회 예산 변동 내역을 바탕으로 각 항목별 변동 사유를 작성해주세요.\n\n` +
      `박람회: ${exhName} ${year}\n\n` +
      `예산 변동 항목:\n${itemLines}\n\n` +
      `반드시 아래 형식으로만 응답하세요 (추가 설명 없이):\n` +
      `── [항목명] ──\n` +
      `[KO] 한국어 변동 사유 (1–2문장, 비즈니스 문서 문체)\n` +
      `[EN] Reason for change (1–2 sentences, business writing style)`

    // Supabase Edge Function을 통해 호출 — API 키가 서버에서만 관리됨
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
    const edgeFnUrl = `${supabaseUrl}/functions/v1/ai-proposal`

    try {
      const res = await fetch(edgeFnUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: userMsg }),
      })
      if (!res.ok) {
        let errMsg = ''
        try { const j = await res.json(); errMsg = j.error || '' } catch { errMsg = await res.text() }
        if (res.status === 500 && errMsg.includes('ANTHROPIC_API_KEY not configured')) {
          setAiOutput(
            '🔑 AI 기능을 사용하려면 Anthropic API 키 설정이 필요합니다.\n\n' +
            '설정 방법:\n' +
            '1. https://console.anthropic.com 에서 API 키 발급\n' +
            '2. Supabase Dashboard → Project Settings → Edge Functions → Secrets\n' +
            '   Name: ANTHROPIC_API_KEY  /  Value: sk-ant-...\n\n' +
            '⚡ API 키 없이도 나머지 모든 기능은 정상 사용 가능합니다.\n' +
            '   변동 사유는 아래 메모 칸에 직접 입력하거나, 키 등록 후 이용하세요.'
          )
          setAiLoading(false)
          return
        }
        throw new Error(`API ${res.status}: ${errMsg}`)
      }
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
              accumulated += parsed.delta.text
              setAiOutput('🤖 AI 생성 중...\n\n' + accumulated)
            }
          } catch { /* skip malformed SSE chunk */ }
        }
      }
      setAiOutput('✅ AI 변동 사유 생성 완료\n\n' + accumulated)
    } catch (err) {
      setAiOutput('⚠️ AI 생성 오류: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setAiLoading(false)
    }
  }

  const prevBudgetMap: Record<string, number> = {}
  if (exhId) {
    const exhProposals = proposals.filter(p => p.exhibition_id === exhId).sort((a, b) => a.year - b.year)
    const prev = exhProposals[exhProposals.length - 1]
    if (prev) for (const b of (prev.budget as BudgetItem[]) || []) prevBudgetMap[b.item] = b.curr
  }

  const totalBudget = budget.reduce((s, b) => s + (b.curr || 0), 0)
  const changedItems = budget.filter(r => (r.prev && r.curr !== r.prev) || (!r.prev && r.curr > 0))

  const STEPS = [t('step1'), t('step2'), t('step3'), t('step4')]

  const PER_PAGE = 10
  const totalPages = Math.ceil(savedList.length / PER_PAGE)
  const pageItems = savedList.slice(proposalPage * PER_PAGE, (proposalPage + 1) * PER_PAGE)

  return (
    <div className="view">
      <div className="sec-hdr">
        <div className="bar" />
        <div className="txt">{t('create_title')}</div>
      </div>

      {/* 파일 업로드 섹션 */}
      <div className="card" style={{ marginBottom: 20, border: '1.5px dashed var(--border2)', background: '#FDFBFB' }}>
        <div style={{ marginBottom: showUpload ? 12 : 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{t('prop_upload_title')}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
            {t('prop_upload_desc')}
          </div>
          <button className="btn btn-purple btn-sm" style={{ marginTop: 12 }} onClick={() => {
            if (showUpload) { setParseResult(null); setParseLoading(false); setUploadFileName('') }
            setShowUpload(v => !v)
          }}>
            {showUpload ? `✕ ${t('close')}` : t('prop_upload_btn')}
          </button>
        </div>
        {showUpload && (
          <>
            {!parseLoading && !parseResult && (
              <div className="invoice-drop"
                onClick={() => document.getElementById('proposal-file-input')?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) simulateParse(f) }}>
                <div className="icon">📄</div>
                <div className="txt">Proposal 파일을 여기에 드래그하거나 클릭하여 선택</div>
                <div className="sub">PDF · Word (.docx) · 이미지 (JPG, PNG) · 최대 20MB</div>
                <input id="proposal-file-input" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) simulateParse(f); e.target.value = '' }} />
              </div>
            )}
            {parseLoading && (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <style>{`@keyframes prop-dot{0%,80%,100%{transform:scale(0);opacity:.3}40%{transform:scale(1);opacity:1}}`}</style>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 14 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 12, height: 12, borderRadius: '50%', background: 'var(--accent)',
                      animation: `prop-dot 1.4s ease-in-out ${i * 0.16}s infinite`,
                    }} />
                  ))}
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>
                  📄 {uploadFileName} — AI 파싱 중...
                </div>
              </div>
            )}
            {parseResult && parseResult._error && (
              <div style={{ marginTop: 4, padding: '14px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#DC2626', marginBottom: 6 }}>⚠️ 파싱 실패 — "{uploadFileName}"</div>
                <div style={{ fontSize: 12, color: '#DC2626' }}>{parseResult._error}</div>
              </div>
            )}
            {parseResult && !parseResult._error && (
              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 10 }}>
                  ✅ 파싱 완료 — "{uploadFileName}"
                </div>
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
                    <tbody>
                      {([
                        ['박람회명', parseResult.exhName],
                        ['연도', String(parseResult.year)],
                        ['장소', parseResult.venue],
                        ['행사 기간', parseResult.dateOfEvent],
                        ['목적', parseResult.objective],
                      ] as [string, string][]).map(([label, value]) => (
                        <tr key={label} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '6px 10px', color: 'var(--muted)', fontWeight: 600, minWidth: 72 }}>{label}</td>
                          <td style={{ padding: '6px 10px' }}>{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>예산 항목</div>
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 16 }}>
                    <thead>
                      <tr style={{ background: 'var(--light)' }}>
                        <th style={{ padding: '5px 10px', textAlign: 'left', fontWeight: 600 }}>항목</th>
                        <th style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 600 }}>금액</th>
                        <th style={{ padding: '5px 10px', textAlign: 'center', fontWeight: 600 }}>통화</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parseResult.budget.map((b, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '5px 10px' }}>{b.item}</td>
                          <td style={{ padding: '5px 10px', textAlign: 'right' }}>{b.amount.toLocaleString()}</td>
                          <td style={{ padding: '5px 10px', textAlign: 'center', color: 'var(--muted)' }}>{b.currency}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button className="btn btn-outline" style={{ flex: 1, minWidth: 0 }} onClick={() => {
                    applyParsedToForm(parseResult, 1)
                    showToast('✅ 폼에 내용을 채웠습니다. 각 단계를 검토 후 저장하세요.')
                  }}>
                    ✏️ 폼에서 검토 후 저장
                  </button>
                  <button className="btn btn-green" style={{ flex: 1, minWidth: 0 }} onClick={() => {
                    applyParsedToForm(parseResult, 4)
                    showToast('✅ 내용을 불러왔습니다. 아래에서 최종 확인 후 저장하세요.')
                  }}>
                    🚀 바로 저장 단계로
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1, borderTop: '1px solid var(--border)' }} />
        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{t('or_direct')}</div>
        <div style={{ flex: 1, borderTop: '1px solid var(--border)' }} />
      </div>

      {/* 스텝 탭 */}
      <div className="steps">
        {STEPS.map((s, i) => (
          <div key={i} className={`step${i + 1 === step ? ' active' : i + 1 < step ? ' done' : ''}`}
            onClick={() => { if (i + 1 < step) setStep(i + 1) }}>
            {i + 1 < step ? '✓ ' : ''}Step {i + 1}. {s}
          </div>
        ))}
      </div>

      {/* Step 1: 기본 정보 */}
      {step === 1 && (
        <div className="card">
          <label style={{ marginTop: 0 }}>{t('exh_select')}</label>
          <select value={isNewExh ? '__new__' : exhId} onChange={e => {
            if (e.target.value === '__new__') { setIsNewExh(true); setExhId('') }
            else { setIsNewExh(false); setExhId(e.target.value) }
          }}>
            <option value="">{t('exh_select_placeholder')}</option>
            {exhibitions.map(e => <option key={e.id} value={e.id}>{exhDisplayName(e.name, e.key)}</option>)}
            <option value="__new__">{t('add_new_exh')}</option>
          </select>
          {/* 새 박람회 입력 영역 */}
          {isNewExh && (
            <div style={{ background: '#EEF4FF', border: '1.5px solid #A8C4EE', borderRadius: 10, padding: '14px 16px', marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#3A5FA0', marginBottom: 12 }}>🆕 {t('exh_name_lbl')}</div>
              <div className="form-row cols2">
                <div>
                  <label style={{ marginTop: 0 }}>{t('exh_full_name')}</label>
                  <input
                    value={newExhName}
                    onChange={e => setNewExhName(e.target.value)}
                    placeholder="예: Korea Import Fair (KIF)"
                    autoFocus
                  />
                </div>
                <div>
                  <label style={{ marginTop: 0 }}>{t('exh_key_lbl')}</label>
                  <input
                    value={newExhKey}
                    onChange={e => setNewExhKey(e.target.value)}
                    placeholder="예: KIF, TS, SITF"
                    maxLength={20}
                  />
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <label style={{ marginTop: 0 }}>{t('is_recurring')}</label>
                <select value={newExhRecurring ? '1' : '0'} onChange={e => setNewExhRecurring(e.target.value === '1')}>
                  <option value="0">{t('new_first_time')}</option>
                  <option value="1">{t('recurring_expo')}</option>
                </select>
              </div>
            </div>
          )}

          <div className="form-row cols2" style={{ marginTop: 14 }}>
            <div>
              <label style={{ marginTop: 0 }}>{t('exh_name_lbl')}</label>
              <input
                value={isNewExh ? newExhName : (exhibitions.find(e => e.id === exhId)?.name || '')}
                readOnly
                style={{ background: '#f8f8f8', color: isNewExh && !newExhName ? 'var(--muted)' : 'var(--text)' }}
                placeholder={t('exh_select')}
              />
            </div>
            <div>
              <label style={{ marginTop: 0 }}>{t('year_label')}</label>
              <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value) || year)} />
            </div>
          </div>
          <div className="form-row cols2" style={{ marginTop: 14 }}>
            <div>
              <label style={{ marginTop: 0 }}>{t('author_label')}</label>
              <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Andrew" />
            </div>
            <div>
              <label style={{ marginTop: 0 }}>{t('write_date')}</label>
              <input type="date" value={propDate} onChange={e => setPropDate(e.target.value)} />
            </div>
          </div>
          <div className="form-row cols2" style={{ marginTop: 14 }}>
            <div>
              <label style={{ marginTop: 0 }}>{t('event_period')}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <input
                  type="date"
                  value={eventStartDate}
                  onChange={e => {
                    const s = e.target.value
                    setEventStartDate(s)
                    setDateOfEvent(formatDateRange(s, eventEndDate))
                    if (eventEndDate && s > eventEndDate) {
                      setEventEndDate(s)
                      setDateOfEvent(formatDateRange(s, s))
                    }
                  }}
                  style={{ flex: 1 }}
                />
                <span style={{ color: 'var(--muted)', fontWeight: 600, flexShrink: 0 }}>~</span>
                <input
                  type="date"
                  value={eventEndDate}
                  min={eventStartDate || undefined}
                  onChange={e => {
                    const e2 = e.target.value
                    setEventEndDate(e2)
                    setDateOfEvent(formatDateRange(eventStartDate, e2))
                  }}
                  style={{ flex: 1 }}
                />
              </div>
              {dateOfEvent && (
                <div style={{ marginTop: 5, fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                  📅 {dateOfEvent}
                </div>
              )}
            </div>
            <div>
              <label style={{ marginTop: 0 }}>{t('venue')}</label>
              <input value={venue} onChange={e => setVenue(e.target.value)} placeholder={t('venue_placeholder')} />
            </div>
          </div>
          <label>{t('objective')}</label>
          <textarea value={objective} onChange={e => setObjective(e.target.value)} rows={2}
            placeholder={t('objective_placeholder')} />
          <div style={{ marginTop: 18, textAlign: 'right' }}>
            <button className="btn btn-primary" onClick={() => { setStep(2); window.scrollTo(0,0) }}>{t('next')}</button>
          </div>
        </div>
      )}

      {/* Step 2: 제품 & 효과 */}
      {step === 2 && (
        <div className="card">
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>{t('product_lbl')}</div>
          <div id="products-area">
            {products.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <input style={{ flex: 1 }} value={p.product} onChange={e => setProducts(arr => arr.map((x, j) => j === i ? { ...x, product: e.target.value } : x))} placeholder={t('product_name')} />
                <input style={{ flex: 1 }} value={p.target} onChange={e => setProducts(arr => arr.map((x, j) => j === i ? { ...x, target: e.target.value } : x))} placeholder={t('target_lbl')} />
                <button onClick={() => setProducts(arr => arr.filter((_, j) => j !== i))}
                  style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 12px', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
              </div>
            ))}
          </div>
          <button className="btn btn-muted btn-sm" style={{ marginBottom: 20 }}
            onClick={() => setProducts(p => [...p, { product: '', target: '' }])}>
            {t('add_product')}
          </button>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>{t('result_lbl')}</div>
          <div id="results-area">
            {expectedResults.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <input style={{ flex: 1 }} value={r} onChange={e => setExpectedResults(arr => arr.map((x, j) => j === i ? e.target.value : x))}
                  placeholder="Promote GME BIZ to potential merchants" />
                <button onClick={() => setExpectedResults(arr => arr.filter((_, j) => j !== i))}
                  style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 12px', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
              </div>
            ))}
          </div>
          <button className="btn btn-muted btn-sm" style={{ marginBottom: 20 }}
            onClick={() => setExpectedResults(r => [...r, ''])}>
            {t('add_result')}
          </button>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
            <button className="btn btn-muted" onClick={() => setStep(1)}>{t('prev')}</button>
            <button className="btn btn-primary" onClick={() => { setStep(3); window.scrollTo(0,0) }}>{t('next')}</button>
          </div>
        </div>
      )}

      {/* Step 3: 예산 */}
      {step === 3 && (
        <div className="card">
          <div className="page-hdr-row" style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{t('budget_title')}</div>
            <div className="page-hdr-actions">
              <input id="budget-excel-input" type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleBudgetExcel(f); e.target.value = '' }} />
              <button className="btn btn-purple btn-sm" onClick={() => document.getElementById('budget-excel-input')?.click()}>
                📂 엑셀 가져오기
              </button>
            </div>
          </div>
          {Object.keys(prevBudgetMap).length > 0 && (
            <div style={{ fontSize: 13, color: 'var(--muted)', background: 'var(--light)', padding: '10px 14px', borderRadius: 8, marginBottom: 14 }}>
              {t('prev_loaded')}
            </div>
          )}
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="budget-table">
            <thead>
              <tr><th>{t('item_col')}</th><th>{t('prev_yr')}</th><th>{t('this_yr')}</th><th>{t('currency_col')}</th><th>{t('diff_lbl')}</th><th>{t('note_col')}</th><th></th></tr>
            </thead>
            <tbody>
              {budget.map((b, i) => {
                const prev = prevBudgetMap[b.item] || b.prev || 0
                const diff = (b.curr || 0) - prev
                const diffEl = prev
                  ? diff > 0 ? <span className="diff-up">▲ {krw(diff)}</span>
                    : diff < 0 ? <span className="diff-down">▼ {krw(Math.abs(diff))}</span>
                    : <span>{t('no_change')}</span>
                  : <span style={{ color: 'var(--amber)', fontWeight: 600 }}>{t('new_item')}</span>
                return (
                  <tr key={i}>
                    <td>
                      <input value={b.item} onChange={e => setBudget(arr => arr.map((x, j) => j === i ? { ...x, item: e.target.value } : x))}
                        style={{ width: 150 }} list="cost-items-list" />
                      <datalist id="cost-items-list">{COST_ITEMS.map(c => <option key={c} value={c} />)}</datalist>
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--muted)' }}>{prev ? krw(prev) : '-'}</td>
                    <td>
                      <input type="number" value={b.curr || ''} style={{ width: 120, textAlign: 'right' }}
                        onChange={e => setBudget(arr => arr.map((x, j) => j === i ? { ...x, curr: parseInt(e.target.value) || 0 } : x))} />
                    </td>
                    <td>
                      <select value={(b as any).currency || 'KRW'} style={{ width: 72 }}
                        onChange={e => setBudget(arr => arr.map((x, j) => j === i ? { ...x, currency: e.target.value } as any : x))}>
                        {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </td>
                    <td>{diffEl}</td>
                    <td>
                      <input value={b.note} style={{ width: 130 }}
                        onChange={e => setBudget(arr => arr.map((x, j) => j === i ? { ...x, note: e.target.value } : x))} />
                    </td>
                    <td>
                      <button style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16 }}
                        onClick={() => setBudget(arr => arr.filter((_, j) => j !== i))}>✕</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
            <button className="btn btn-muted btn-sm"
              onClick={() => setBudget(b => [...b, { item: 'Booth Fee', curr: 0, prev: 0, note: '', currency: 'KRW' }])}>
              {t('add_item')}
            </button>
            <strong style={{ fontSize: 15, color: 'var(--accent)' }}>{t('budget_total')}: {krw(totalBudget)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18 }}>
            <button className="btn btn-muted" onClick={() => { setStep(2); window.scrollTo(0,0) }}>{t('prev')}</button>
            <button className="btn btn-primary" onClick={() => { setStep(4); window.scrollTo(0,0) }}>{t('next')}</button>
          </div>
        </div>
      )}

      {/* Step 4: AI 생성 & 저장 */}
      {step === 4 && (
        <div className="card">
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>{t('memo_title')}</div>
          <div id="memo-area">
            {changedItems.map(r => {
              const dir = r.curr > (r.prev || 0) ? '▲ 증가' : !r.prev ? '신규' : '▼ 감소'
              const col = dir.includes('▲') || dir === '신규' ? 'var(--danger)' : 'var(--green)'
              return (
                <div key={r.item} style={{ marginBottom: 10 }}>
                  <label style={{ color: col }}>
                    {r.item} &nbsp; {dir} &nbsp; {r.prev ? krw(r.prev) + ' → ' : ''}{krw(r.curr)}
                  </label>
                  <input placeholder={t('memo_title')}
                    value={aiMemos[r.item] || ''}
                    onChange={e => setAiMemos(m => ({ ...m, [r.item]: e.target.value }))} />
                </div>
              )
            })}
            {changedItems.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--muted)', padding: '10px 0' }}>{t('no_budget_changes')}</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <button className="btn btn-purple" onClick={runAI} disabled={aiLoading}>
              {t('ai_btn')}
            </button>
            <button className="btn btn-muted" onClick={() => { setStep(3); window.scrollTo(0,0) }}>{t('prev')}</button>
          </div>
          <div className="ai-box" id="ai-output" style={{ whiteSpace: 'pre-wrap' }}>{aiOutput}</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
            <button className="btn btn-green" onClick={save} disabled={saving || saved}>
              📋 {saving ? t('saving') : saved ? '✓ ' + t('save') : t('save_history').replace('📋 ', '')}
            </button>
            <button className="btn btn-primary" onClick={() => {
              const exhName = isNewExh ? newExhName : (exhibitions.find(e => e.id === exhId)?.name || '박람회')
              const lines = [
                `GME Booth Proposal`, `==================`, ``,
                `박람회: ${exhName} ${year}`, `행사 기간: ${dateOfEvent}`, `장소: ${venue}`, ``,
                `참가 목적`, `---------`, objective, ``,
                `예산 내역`, `---------`,
                ...budget.filter(b => b.curr > 0).map(r => `${r.item}: ${krw(r.curr)}  (${r.note || ''})`),
                ``, `합계: ${krw(totalBudget)}`, ``, `작성자: ${author}`, `작성일: ${propDate}`,
              ].join('\n')
              const a = Object.assign(document.createElement('a'), {
                href: 'data:text/plain;charset=utf-8,' + encodeURIComponent(lines),
                download: `${exhName}_${year}_Proposal.txt`,
              })
              document.body.appendChild(a); a.click(); document.body.removeChild(a)
            }}>
              💾 TXT 내보내기
            </button>
          </div>
          {saved && (
            <div style={{ background: '#E5F5EC', border: '1px solid #A0D8B0', borderRadius: 8, padding: 14, marginTop: 16, color: '#2E7D51', fontWeight: 700 }}>
              {t('save_complete')}
            </div>
          )}
        </div>
      )}

      {/* 저장된 Proposal 목록 */}
      <div style={{ marginTop: 32 }}>
        <div className="page-hdr-row" style={{ marginBottom: 14 }}>
          <div className="sec-hdr" style={{ margin: 0 }}>
            <div className="bar" />
            <span className="txt">{t('saved_proposals')}</span>
            <span className="sub">{t('total_items')} {savedList.length} &nbsp;·&nbsp; {t('click_to_edit')}</span>
          </div>
          {totalPages > 1 && (
            <div className="page-hdr-actions">
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>{proposalPage + 1} / {totalPages} {t('page_label')}</span>
              <button onClick={() => setProposalPage(p => Math.max(0, p - 1))} disabled={proposalPage === 0}
                style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid var(--border2)', background: 'white', cursor: 'pointer', fontSize: 15 }}>‹</button>
              <button onClick={() => setProposalPage(p => Math.min(totalPages - 1, p + 1))} disabled={proposalPage === totalPages - 1}
                style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid var(--border2)', background: 'white', cursor: 'pointer', fontSize: 15 }}>›</button>
            </div>
          )}
        </div>

        {pageItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted)', fontSize: 14, background: 'var(--light)', borderRadius: 10 }}>
            {t('no_saved_proposals_desc')}
          </div>
        ) : (
          pageItems.map((p, idx) => (
            <div key={`${p.exhId}-${p.year}`} className="proposal-list-item"
              style={{ cursor: 'default', transition: 'box-shadow .15s' }}
              onMouseOver={e => (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 14px rgba(0,0,0,.1)'}
              onMouseOut={e => (e.currentTarget as HTMLDivElement).style.boxShadow = ''}>
              <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600, width: 24, textAlign: 'center', flexShrink: 0 }}>
                {proposalPage * PER_PAGE + idx + 1}
              </div>
              <div className="pli-color" style={{ background: p.color }} />
              <div className="pli-body">
                <div className="pli-name">{exhDisplayName(p.name, p.key)} {p.year}</div>
                <div className="pli-meta">{p.year} &nbsp;·&nbsp; {formatEventDate(p.date, p.year)} &nbsp;·&nbsp; {t('total')} {krw(p.total)}</div>
              </div>
              <div className="pli-actions">
                <button className="btn btn-outline btn-sm" onClick={() => loadFromSaved(p, false)}>✏️ {t('edit')}</button>
                <button className="btn btn-muted btn-sm" onClick={() => loadFromSaved(p, true)}>{t('copy_create')}</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
