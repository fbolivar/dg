import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { alert_title, alert_summary, alert_recommendation, audience, tone, practice_area } = await req.json()

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  const prompt = `Genera una Legal Note (boletín jurídico) para los clientes de DG&A Abogados con base en la siguiente alerta normativa:

ALERTA: ${alert_title}
RESUMEN: ${alert_summary}
RECOMENDACIÓN: ${alert_recommendation}
AUDIENCIA: ${audience}
TONO: ${tone}
ÁREA: ${practice_area}

Genera el siguiente contenido estructurado:

## BORRADOR PRINCIPAL
[Boletín completo de 3-4 párrafos, con encabezado, cuerpo y cierre con llamado a acción]

## VERSIÓN EMAIL
[Asunto del correo + cuerpo del correo en máximo 2 párrafos]

## VERSIÓN LINKEDIN
[Post de máximo 150 palabras adecuado para LinkedIn profesional, con 2-3 hashtags legales]

## RESUMEN EJECUTIVO
[2-3 bullets ejecutivos con los puntos más importantes para una junta directiva]

Usa lenguaje formal, preciso y colombiano. Evita tecnicismos innecesarios cuando la audiencia es no técnica.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    return NextResponse.json({ error: 'Error generando contenido' }, { status: 500 })
  }

  const data = await response.json()
  const raw = data.content[0]?.text ?? ''

  const extract = (label: string) => {
    const regex = new RegExp(`## ${label}\\n([\\s\\S]*?)(?=\\n## |$)`, 'i')
    return raw.match(regex)?.[1]?.trim() ?? ''
  }

  return NextResponse.json({
    content_draft: extract('BORRADOR PRINCIPAL'),
    content_email: extract('VERSIÓN EMAIL'),
    content_linkedin: extract('VERSIÓN LINKEDIN'),
    content_summary: extract('RESUMEN EJECUTIVO'),
  })
}
