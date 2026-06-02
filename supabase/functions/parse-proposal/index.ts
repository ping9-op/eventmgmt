// parse-proposal: PDF/이미지 Proposal 파일을 Claude로 파싱해 구조화된 JSON 반환
// 배포: supabase functions deploy parse-proposal

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = `You are a document parser for GME Remit Korea Team's event management system.
Extract exhibition proposal information from the provided document and return ONLY valid JSON.
No markdown, no explanation — raw JSON only.

JSON schema:
{
  "exhName": "Full exhibition name (string)",
  "year": 2026,
  "venue": "Venue name and city (string)",
  "dateOfEvent": "Date range as text, e.g. '2026 Aug 12-15' (string)",
  "eventStart": "YYYY-MM-DD (string, first day)",
  "eventEnd": "YYYY-MM-DD (string, last day or same as start)",
  "objective": "Purpose/objective of participation (string)",
  "budget": [
    { "item": "Item name", "amount": 5000000, "currency": "KRW" }
  ]
}

Rules:
- exhName: use full official exhibition name from the document
- If currency symbols present: ₩ or KRW→KRW, ¥→JPY, $→USD
- amounts: numbers only (no commas, no symbols)
- If a field is not found, use empty string "" or 0
- budget: list ALL budget line items found in the document`

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { fileBase64, mimeType, fileName } = await req.json() as {
      fileBase64: string
      mimeType: string
      fileName: string
    }

    if (!fileBase64 || !mimeType) {
      return new Response(JSON.stringify({ error: 'fileBase64 and mimeType are required' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // Claude API content 블록 구성
    // PDF → document type, 이미지 → image type
    const isPdf = mimeType === 'application/pdf'
    const isImage = mimeType.startsWith('image/')

    let contentBlock: unknown
    if (isPdf) {
      contentBlock = {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 },
      }
    } else if (isImage) {
      contentBlock = {
        type: 'image',
        source: { type: 'base64', media_type: mimeType, data: fileBase64 },
      }
    } else {
      // Word/기타: 텍스트 fallback
      return new Response(JSON.stringify({
        error: `Unsupported file type: ${mimeType}. Please use PDF or image files.`
      }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            contentBlock,
            { type: 'text', text: `Parse this proposal document ("${fileName}") and return JSON only.` },
          ],
        }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return new Response(JSON.stringify({ error: `Anthropic API error ${res.status}: ${err}` }), {
        status: res.status, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const data = await res.json() as { content: { type: string; text: string }[] }
    const text = data.content?.find(c => c.type === 'text')?.text || '{}'

    // JSON 파싱 (마크다운 코드블록 제거)
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return new Response(JSON.stringify({ error: 'AI returned invalid JSON', raw: text }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ result: parsed }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
