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
        system,
        messages,
      }),
      signal: AbortSignal.timeout(60_000), // evita que un upstream colgado bloquee la función
    })
  } catch {
    return NextResponse.json({ error: 'La consulta tardó demasiado. Intente de nuevo.' }, { status: 504 })
  }

  if (!response.ok) {
    await response.text().catch(() => '') // consume sin reenviar detalles del upstream
    return NextResponse.json({ error: 'No se pudo procesar la consulta. Intente de nuevo.' }, { status: 502 })
  }

  const data = await response.json()
  const content = data?.content?.[0]?.text ?? ''

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
