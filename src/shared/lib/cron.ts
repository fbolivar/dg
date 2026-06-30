import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * ─── AUTORIZACIÓN DE CRONS ───────────────────────────────────────────────────
 * Verifica el header `Authorization: Bearer ${CRON_SECRET}` que Vercel agrega a
 * las invocaciones programadas. La comparación es en TIEMPO CONSTANTE
 * (timingSafeEqual) para no filtrar el secreto por timing attacks.
 *
 * Fail-closed:
 *   - Si CRON_SECRET no está configurado → 500 (el job no corre sin secreto).
 *   - Si el header no coincide → 401.
 *   - Si está OK → devuelve `null` (el handler continúa).
 */
export function checkCronAuth(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET no configurado' }, { status: 500 })
  }
  const provided = Buffer.from(req.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  // timingSafeEqual exige buffers de igual longitud; la comprobación de longitud
  // no filtra el contenido del secreto.
  const ok = provided.length === expected.length && timingSafeEqual(provided, expected)
  if (!ok) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  return null
}
