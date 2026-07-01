import { NextRequest, NextResponse } from 'next/server'
import { consultarProceso } from '@/shared/lib/rama-judicial'
import { getSession } from '@/shared/lib/auth'
import { radicacionSchema } from '@/shared/lib/validation'

/**
 * Consulta puntual a la Rama Judicial por número de radicación.
 * Trae actuaciones REALES de la CPNU; si no encuentra el proceso (o no hay
 * conexión), cae al respaldo de demostración. Ver src/shared/lib/rama-judicial.ts
 */
export async function POST(req: NextRequest) {
  if (!(await getSession())) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = radicacionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Número de radicación inválido' }, { status: 400 })
  }
  return NextResponse.json(await consultarProceso(parsed.data.numero_radicacion))
}
