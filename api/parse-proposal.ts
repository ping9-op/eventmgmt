export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { fileData, mediaType } = req.body
  if (!fileData || !mediaType) return res.status(400).json({ error: '파일 데이터가 없습니다.' })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' })

  const prompt = `이 파일은 박람회 참가 Proposal 문서입니다. 아래 정보를 추출하여 JSON으로만 반환하세요. 다른 텍스트 없이 순수 JSON만 출력하세요.

{
  "name": "박람회 이름",
  "year": 연도 숫자,
  "author": "작성자 이름",
  "date_of_event": "행사 기간",
  "venue": "장소",
  "objective": "참가 목적",
  "recurring": true,
  "budget": [{"item": "항목명", "curr": 금액숫자, "currency": "KRW", "note": ""}]
}`

  // 여러 모델과 API 버전 시도
  const attempts = [
    { model: 'gemini-1.5-flash-latest', version: 'v1beta' },
    { model: 'gemini-1.5-flash', version: 'v1beta' },
    { model: 'gemini-1.5-flash-8b', version: 'v1beta' },
    { model: 'gemini-1.5-flash-latest', version: 'v1' },
    { model: 'gemini-1.5-pro-latest', version: 'v1beta' },
  ]

  const errors: string[] = []

  for (const { model, version } of attempts) {
    try {
      const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`
      const body = {
        contents: [{
          parts: [
            { inline_data: { mime_type: mediaType, data: fileData } },
            { text: prompt }
          ]
        }],
        generationConfig: { maxOutputTokens: 1024, temperature: 0.1 }
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const json = await response.json()

      if (!response.ok) {
        errors.push(`[${model}/${version}] ${response.status}: ${json.error?.message || JSON.stringify(json)}`)
        continue
      }

      const raw = json.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(cleaned)

      return res.json({ success: true, data: parsed, model })
    } catch (err: any) {
      errors.push(`[${model}/${version}] ${err.message}`)
    }
  }

  return res.status(500).json({
    success: false,
    error: '모든 모델 시도 실패',
    details: errors
  })
}
