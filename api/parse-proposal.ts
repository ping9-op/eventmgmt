import { GoogleGenerativeAI } from '@google/generative-ai'

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { fileData, mediaType } = req.body
  if (!fileData || !mediaType) return res.status(400).json({ error: '파일 데이터가 없습니다.' })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' })

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `이 파일은 박람회 참가 Proposal 문서입니다. 아래 정보를 추출하여 JSON으로만 반환하세요. 다른 텍스트 없이 순수 JSON만 출력하세요.

{
  "name": "박람회 이름 (없으면 빈 문자열)",
  "year": 연도 숫자 (없으면 ${new Date().getFullYear()}),
  "author": "작성자 이름 (없으면 빈 문자열)",
  "date_of_event": "행사 기간 (예: 2026 Jun 23-25, 없으면 빈 문자열)",
  "venue": "장소 (없으면 빈 문자열)",
  "objective": "참가 목적 (없으면 빈 문자열)",
  "recurring": true,
  "budget": [
    {"item": "항목명", "curr": 금액숫자, "currency": "KRW 또는 JPY 또는 USD", "note": "비고"}
  ]
}

예산 정보가 없으면 budget은 []로 반환하세요.`

    const result = await model.generateContent([
      { inlineData: { data: fileData, mimeType: mediaType } },
      prompt,
    ])

    const raw = result.response.text()
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)

    return res.json({ success: true, data: parsed })
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'AI 분석 실패' })
  }
}
