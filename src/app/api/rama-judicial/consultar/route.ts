import { NextRequest, NextResponse } from 'next/server'
import { consultarProceso } from '@/shared/lib/rama-judicial'
import { getSession } from '@/shared/lib/auth'

/**
 * Consulta puntual a la Rama Judicial por número de radicación.
 * Trae actuaciones REALES de la CPNU; si no encuentra el proceso (o no hay
 * conexión), cae al respaldo de demostración. Ver src/shared/lib/rama-judicial.ts
 */

function isValidRadicacion(v: unknown): v is string {
  return typeof v === 'string' && /^\d{20,23}$/.test(v.trim())
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
  const numero = (body as { numero_radicacion?: unknown })?.numero_radicacion
  if (!isValidRadicacion(numero)) {
    return NextResponse.json({ error: 'Número de radicación inválido (deben ser 20–23 dígitos)' }, { status: 400 })
  }
  return NextResponse.json(await consultarProceso(numero.trim()))
}
