// Motor de IA de la captura inteligente — SOLO SERVIDOR.
// Redacta una "glosa" profesional de facturación, estima la duración y clasifica
// la actividad a partir del contexto de cada item. Procesa en lote (1 llamada).
import type { CaptureConfidence } from '@/shared/types'

export type GlosaInput = { title: string; context: string; client_name?: string; matter_title?: string }
export type GlosaResult = { glosa: string; activity: string; minutes: number; billable: boolean; confidence: CaptureConfidence }

const ACTIVITIES = ['Reunión', 'Redacción', 'Investigación', 'Audiencia', 'Llamada', 'Revisión documental', 'Gestión', 'Diligencia', 'Otro']

function fallback(item: GlosaInput): GlosaResult {
  return { glosa: item.title, activity: 'Gestión', minutes: 30, billable: true, confidence: 'bajo' }
}

export async function generateGlosas(items: GlosaInput[]): Promise<GlosaResult[]> {
  if (items.length === 0) return []
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return items.map(fallback)

  const lista = items.map((it, i) =>
    `${i + 1}. ${it.title}\n   Contexto: ${it.context}${it.client_name ? `\n   Cliente: ${it.client_name}` : ''}${it.matter_title ? `\n   Asunto: ${it.matter_title}` : ''}`
  ).join('\n\n')

  const system = `Eres el asistente de facturación de una firma de abogados colombiana (DG&A Abogados).
Para cada actividad, redacta una GLOSA profesional de facturación en español: una descripción clara, formal y específica del trabajo realizado, en tono jurídico, que el cliente no cuestionaría (1 a 2 frases, sin relleno).
Además: estima una DURACIÓN razonable en minutos según el tipo de trabajo, clasifica la ACTIVIDAD en una de [${ACTIVITIES.join(', ')}], indica si es FACTURABLE (true por defecto; false si es claramente interno/administrativo), y un nivel de CONFIANZA (alto, medio, bajo).
Responde ÚNICAMENTE con un array JSON válido, en el MISMO ORDEN, sin texto adicional:
[{"glosa": "...", "activity": "...", "minutes": 60, "billable": true, "confidence": "alto"}, ...]`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system,
        messages: [{ role: 'user', content: `Actividades:\n\n${lista}` }],
      }),
    })
    if (!res.ok) return items.map(fallback)
    const data = await res.json()
    const text: string = data?.content?.[0]?.text ?? ''
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return items.map(fallback)
    const parsed = JSON.parse(match[0]) as Partial<GlosaResult>[]
    return items.map((it, i) => {
      const p = parsed[i]
      if (!p) return fallback(it)
      const activity = typeof p.activity === 'string' && ACTIVITIES.includes(p.activity) ? p.activity : 'Gestión'
      const minutes = typeof p.minutes === 'number' && p.minutes > 0 ? Math.round(p.minutes) : 30
      const confidence: CaptureConfidence = p.confidence === 'alto' || p.confidence === 'bajo' ? p.confidence : 'medio'
      return {
        glosa: typeof p.glosa === 'string' && p.glosa.trim() ? p.glosa.trim() : it.title,
        activity, minutes,
        billable: p.billable !== false,
        confidence,
      }
    })
  } catch {
    return items.map(fallback)
  }
}
