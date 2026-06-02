// Supabase Edge Function: ai-proposal
// 브라우저에서 Anthropic API 키를 노출하지 않도록 서버사이드에서 호출
//
// 배포 방법:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase functions deploy ai-proposal

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const { prompt, system } = await req.json() as { prompt: string; system?: string }
    if (!prompt) {
      return new Response(JSON.stringify({ error: 'prompt is required' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        stream: true,
        system: system || 'GME(Global Money Express) 박람회 예산 담당자로서 간결하고 전문적인 비즈니스 문서 문체로 작성합니다.',
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!upstream.ok) {
      const err = await upstream.text()
      return new Response(JSON.stringify({ error: `Anthropic API ${upstream.status}: ${err}` }), {
        status: upstream.status, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // 스트림 그대로 클라이언트에게 전달
    return new Response(upstream.body, {
      headers: {
        ...CORS,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
