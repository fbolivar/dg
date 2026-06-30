import { NextRequest, NextResponse } from 'next/server'
import { generateDueRecurringFees } from '@/shared/services/db-raw'
import { checkCronAuth } from '@/shared/lib/cron'

/**
 * ─── CRON: generación automática de igualas / cobros recurrentes ─────────────
 * Se ejecuta a diario (ver vercel.json → crons). Genera las facturas de las
 * igualas activas que vencen en su período actual y aún no se han emitido.
 * Las facturas se crean en estado 'borrador' para revisión antes de enviarse.
 *
 * Seguridad: fail-closed. Si CRON_SECRET no está configurado, se rechaza.
 * Vercel agrega automáticamente "Authorization: Bearer ${CRON_SECRET}".
 */
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req)
  if (denied) return denied

  const todayISO = new Date().toISOString().slice(0, 10)
  const res = await generateDueRecurringFees(todayISO)

  return NextResponse.json({
    ok: true,
    job: 'dgatime:igualas',
    ejecutado_en: new Date().toISOString(),
    generadas: res.generated,
    detalle: res.details,
  })
}
