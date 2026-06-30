import { NextRequest, NextResponse } from 'next/server'
import { consultarProceso } from '@/shared/lib/rama-judicial'
import * as raw from '@/shared/services/db-raw'
import { checkCronAuth } from '@/shared/lib/cron'
import type { JudicialActuacion } from '@/shared/types'

/**
 * ─── JOB DE SINCRONIZACIÓN AUTOMÁTICA (CRON) ─────────────────────────────────
 *
 * Se ejecuta a diario (ver vercel.json → crons). Recorre todos los procesos en
 * seguimiento, consulta la Rama Judicial (CPNU) y detecta NOVEDADES comparando
 * la última actuación contra la que ya teníamos registrada.
 *
 * En PRODUCCIÓN, por cada novedad detectada este job debe:
 *   1. Insertar las nuevas actuaciones en Supabase (judicial_actuaciones).
 *   2. Actualizar el proceso (fecha/última actuación, contador de novedades).
 *   3. Crear una notificación + alerta para el equipo y registrar en audit_log.
 * (Esa capa de persistencia se activa con las tablas reales del piloto.)
 *
 * Seguridad: Vercel agrega automáticamente la cabecera
 *   Authorization: Bearer ${CRON_SECRET}
 * a las invocaciones programadas. Si CRON_SECRET está definido, se exige.
 */

export const maxDuration = 60 // segundos (la consulta a la Rama puede tardar)

export async function GET(req: NextRequest) {
  // Autorización del cron (fail-closed + comparación en tiempo constante).
  const denied = checkCronAuth(req)
  if (denied) return denied

  // Procesos reales en seguimiento (Supabase, vía service role — sin sesión).
  const procesos = await raw.getJudicialProcesses()
  const ahora = new Date().toISOString()

  const detalle = await Promise.all(procesos.map(async (p) => {
    const r = await consultarProceso(p.numero_radicacion)
    const fechas = r.actuaciones.map(a => a.fecha).filter(Boolean).sort()
    const ultimaFecha = fechas[fechas.length - 1]
    const novedad = !!ultimaFecha && (!p.fecha_ultima_actuacion || ultimaFecha > p.fecha_ultima_actuacion)

    let insertadas = 0
    if (novedad) {
      // Persistir actuaciones nuevas (posteriores a la última registrada) — dedup por id.
      const nuevas: JudicialActuacion[] = r.actuaciones
        .filter(a => !!a.fecha && (!p.fecha_ultima_actuacion || a.fecha > p.fecha_ultima_actuacion))
        .map(a => ({ ...a, process_id: p.id, is_new: true }))
      insertadas = await raw.addJudicialActuaciones(nuevas)
      await raw.updateJudicialProcess(p.id, {
        ultima_actuacion: r.actuaciones[0]?.actuacion,
        fecha_ultima_actuacion: ultimaFecha,
        last_sync: ahora,
        sync_status: 'sincronizado',
        new_actuaciones: (p.new_actuaciones ?? 0) + insertadas,
        actuaciones_count: (p.actuaciones_count ?? 0) + insertadas,
      })
    } else {
      await raw.updateJudicialProcess(p.id, { last_sync: ahora, sync_status: 'sincronizado' })
    }

    return {
      radicacion: p.numero_radicacion,
      cliente: p.client?.name ?? null,
      fuente: r.fuente,
      ultima_actuacion: r.actuaciones[0]?.actuacion ?? '—',
      fecha_ultima: ultimaFecha ?? null,
      novedad,
      actuaciones_nuevas: insertadas,
    }
  }))

  const conNovedades = detalle.filter(d => d.novedad).length

  return NextResponse.json({
    ok: true,
    job: 'rama-judicial:sync',
    ejecutado_en: new Date().toISOString(),
    revisados: procesos.length,
    con_novedades: conNovedades,
    detalle,
  })
}
