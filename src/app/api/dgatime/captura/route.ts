import { NextRequest, NextResponse } from 'next/server'
import { captureForAllEnabled } from '@/shared/services/capture'

/**
 * ─── CRON: captura inteligente diaria ────────────────────────────────────────
 * Al final del día prepara la bandeja de cada abogado con DGA-Time habilitado:
 * detecta su actividad reciente en la plataforma, la clasifica y redacta la glosa.
 * Las sugerencias quedan PRIVADAS para cada abogado, que aprueba o descarta.
 *
 * Seguridad: fail-closed. Requiere CRON_SECRET (Vercel agrega el Bearer).
 */
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET no configurado' }, { status: 500 })
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const res = await captureForAllEnabled()
  return NextResponse.json({
    ok: true,
    job: 'dgatime:captura',
    ejecutado_en: new Date().toISOString(),
    abogados: res.users,
    sugerencias_creadas: res.captured,
  })
}
