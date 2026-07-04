import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/shared/lib/auth'
import { copilotSchema } from '@/shared/lib/validation'

export async function POST(req: NextRequest) {
  if (!(await getSession())) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = copilotSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Formato de mensajes inválido' }, { status: 400 })
  }
  const { messages, sources } = parsed.data

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }
  let system = `Eres DG&A IA, el asistente jurídico interno de DG&A Abogados, una firma boutique colombiana especializada en derecho corporativo, laboral, compliance, M&A y contratación pública.

Respondes con base en el conocimiento legal colombiano y los lineamientos de la firma.
Siempre citas las fuentes consultadas (normas, jurisprudencia, conceptos).
Indicas el nivel de confianza de tu respuesta al final: [Confianza: alto/medio/bajo]
Cuando el caso sea sensible o de alto impacto, indicas: [Requiere criterio de socio: sí/no]
Nunca presentas tu respuesta como consejo legal definitivo — siempre aclara que es asistencia preliminar.
Responde en español formal colombiano.
Sé preciso, estructurado y usa referencias normativas específicas (artículos, normas, sentencias).
Máximo 400 palabras por respuesta.`

  if (sources.length > 0) {
    const bloque = sources.map((s, i) => `### Fuente interna ${i + 1}: ${s.title || 'Sin título'}\n${s.content}`).join('\n\n')
    system += `\n\n--- FUENTES PROPIAS DE LA FIRMA ---
La firma ha cargado las siguientes fuentes internas. Priorízalas y cítalas explícitamente (indica "según las fuentes internas de la firma") cuando sean pertinentes a la consulta. Si la consulta no se relaciona con ellas, responde con tu conocimiento general del derecho colombiano.

${bloque}`
  }

  let response: Response
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1500,
        // thinking off: respuesta directa, sin la latencia del adaptive thinking
        // (que en Sonnet 5 viene activo por defecto si se omite).
        thinking: { type: 'disabled' },
        // Streaming: mantiene la conexión viva en respuestas largas (evita "fetch failed").
        stream: true,
        system,
        messages,
      }),
      signal: AbortSignal.timeout(90_000),
    })
  } catch {
    return NextResponse.json({ error: 'La consulta tardó demasiado. Intente de nuevo.' }, { status: 504 })
  }

  if (!response.ok || !response.body) {
    await response.text?.().catch(() => '') // consume sin reenviar detalles del upstream
    return NextResponse.json({ error: 'No se pudo procesar la consulta. Intente de nuevo.' }, { status: 502 })
  }

  // Lee el stream SSE de Anthropic y acumula el texto de la respuesta.
  let content = ''
  try {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const l = line.trim()
        if (!l.startsWith('data:')) continue
        const payload = l.slice(5).trim()
        if (!payload || payload === '[DONE]') continue
        try {
          const ev = JSON.parse(payload)
          if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') content += ev.delta.text
        } catch { /* línea no-JSON: ignorar */ }
      }
    }
  } catch {
    return NextResponse.json({ error: 'La consulta se interrumpió. Intente de nuevo.' }, { status: 504 })
  }

  const confidenceMatch = content.match(/\[Confianza:\s*(alto|medio|bajo)\]/i)
  const requiresReviewMatch = content.match(/\[Requiere criterio de socio:\s*(sí|no)\]/i)

  return NextResponse.json({
    content: content
      .replace(/\[Confianza:.*?\]/gi, '')
      .replace(/\[Requiere criterio de socio:.*?\]/gi, '')
      .trim(),
    confidence: confidenceMatch?.[1]?.toLowerCase() ?? 'medio',
    requires_review: requiresReviewMatch?.[1]?.toLowerCase() === 'sí',
  })
}
