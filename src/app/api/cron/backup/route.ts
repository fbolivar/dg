import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/shared/lib/supabase-admin'

/**
 * ─── CRON: respaldo automático de la base de datos ───────────────────────────
 * Exporta todas las tablas a un JSON y lo sube al bucket privado `backups`
 * (Supabase Storage). Conserva los últimos 30 respaldos automáticos.
 *
 * Seguridad: fail-closed. Si CRON_SECRET no está configurado, se rechaza.
 * Vercel agrega automáticamente "Authorization: Bearer ${CRON_SECRET}".
 * El bucket es privado: solo accesible con el service role (servidor).
 */
export const maxDuration = 120

const TABLES = [
  'practice_areas', 'clients', 'users', 'alerts', 'legal_notes', 'documents',
  'contract_reviews', 'matters', 'matter_events', 'due_diligence_projects',
  'due_diligence_findings', 'compliance_diagnostics', 'hr_tickets',
  'judicial_processes', 'judicial_actuaciones', 'knowledge_sources',
  'time_entries', 'invoices', 'invoice_items', 'recurring_fees',
  'captured_activities', 'user_integrations', 'audit_log',
]

const RETENTION = 30

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET no configurado' }, { status: 500 })
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const exported_at = new Date().toISOString()
  const dump: Record<string, unknown> = { exported_at }
  const counts: Record<string, number> = {}

  for (const t of TABLES) {
    const { data, error } = await supabaseAdmin.from(t).select('*')
    if (error) {
      return NextResponse.json({ error: `Error leyendo ${t}: ${error.message}` }, { status: 500 })
    }
    dump[t] = data
    counts[t] = data?.length ?? 0
  }

  const stamp = exported_at.replace(/[:.]/g, '-')
  const path = `auto/backup-${stamp}.json`
  const { error: upErr } = await supabaseAdmin.storage
    .from('backups')
    .upload(path, JSON.stringify(dump), { contentType: 'application/json', upsert: false })
  if (upErr) {
    return NextResponse.json({ error: `Error subiendo respaldo: ${upErr.message}` }, { status: 500 })
  }

  // Retención: conservar solo los últimos RETENTION respaldos automáticos
  let pruned = 0
  const { data: list } = await supabaseAdmin.storage
    .from('backups')
    .list('auto', { limit: 1000, sortBy: { column: 'name', order: 'desc' } })
  if (list && list.length > RETENTION) {
    const toDelete = list.slice(RETENTION).map(f => `auto/${f.name}`)
    if (toDelete.length) {
      await supabaseAdmin.storage.from('backups').remove(toDelete)
      pruned = toDelete.length
    }
  }

  return NextResponse.json({
    ok: true,
    job: 'backup',
    ejecutado_en: exported_at,
    archivo: path,
    filas: counts,
    eliminados_por_retencion: pruned,
  })
}
