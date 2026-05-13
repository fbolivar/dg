import { NextRequest, NextResponse } from 'next/server'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: NextRequest) {
  const { messages } = await req.json() as { messages: Message[] }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: `Eres el Copiloto Legal interno de DG&A Abogados, una firma boutique colombiana especializada en derecho corporativo, laboral, compliance, M&A y contratación pública.

Respondes exclusivamente con base en el conocimiento legal colombiano y los lineamientos de la firma.
Siempre citas las fuentes consultadas (normas, jurisprudencia, conceptos).
Indicas el nivel de confianza de tu respuesta al final: [Confianza: alto/medio/bajo]
Cuando el caso sea sensible o de alto impacto, indicas: [Requiere criterio de socio: sí/no]
Nunca presentas tu respuesta como consejo legal definitivo — siempre aclara que es asistencia preliminar.
Responde en español formal colombiano.
Sé preciso, estructurado y usa referencias normativas específicas (artículos, normas, sentencias).
Máximo 400 palabras por respuesta.`,
      messages,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    return NextResponse.json({ error }, { status: response.status })
  }

  const data = await response.json()
  const content = data.content[0]?.text ?? ''

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
