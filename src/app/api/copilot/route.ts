import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/shared/lib/auth'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

// Límites de validación: previenen payloads abusivos / inyección de contexto.
const MAX_MESSAGES = 30
const MAX_CONTENT_CHARS = 8000

function validateMessages(input: unknown): Message[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_MESSAGES) return null
  const clean: Message[] = []
  for (const m of input) {
    if (typeof m !== 'object' || m === null) return null
    const { role, content } = m as Record<string, unknown>
    if (role !== 'user' && role !== 'assistant') return null
    if (typeof content !== 'string' || content.length === 0 || content.length > MAX_CONTENT_CHARS) return null
    clean.push({ role, content })
  }
  return clean
}

// Fuentes propias de la firma (base de conocimiento). Se inyectan en el prompt.
interface Source { title: string; content: string }
const MAX_SOURCES = 8
const MAX_SOURCE_CHARS = 4000

function validateSources(input: unknown): Source[] {
  if (!Array.isArray(input)) return []
  const clean: Source[] = []
  for (const s of input.slice(0, MAX_SOURCES)) {
    if (typeof s !== 'object' || s === null) continue
    const { title, content } = s as Record<string, unknown>
    if (typeof content !== 'string' || !content.trim()) continue
    clean.push({
      title: (typeof title === 'string' ? title : '').trim().slice(0, 200),
      content: content.trim().slice(0, MAX_SOURCE_CHARS),
    })
  }
  return clean
}

export async function POST(req: NextRequest) {
  if (!(await getSession())) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo de solicitud inválido' }, { status: 400 })
  }

  const messages = validateMessages((body as { messages?: unknown })?.messages)
  if (!messages) {
    return NextResponse.json({ error: 'Formato de mensajes inválido' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  const sources = validateSources((body as { sources?: unknown })?.sources)
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

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system,
      messages,
    }),
  })

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
