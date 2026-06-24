// Orquestación de la captura inteligente — SOLO SERVIDOR.
// Detecta la huella de trabajo del abogado en la plataforma, la pasa por el motor
// de IA (glosa + duración) y guarda sugerencias privadas para su aprobación.
import * as raw from '@/shared/services/db-raw'
import { fetchExternalFootprint } from '@/shared/services/integrations'
import { generateGlosas, type GlosaInput } from '@/shared/lib/capture-ai'
import type { CaptureStatus } from '@/shared/types'

const LOOKBACK_DAYS = 7

/** Captura la actividad reciente de un abogado (plataforma + correo/calendario) y crea sugerencias (dedup por origen). */
export async function captureForUser(userId: string): Promise<number> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString()
  const [inApp, external] = await Promise.all([
    raw.getUserFootprint(userId, since),
    fetchExternalFootprint(userId, since),
  ])
  const footprint = [...inApp, ...external]
  if (footprint.length === 0) return 0

  const existing = await raw.getExistingCaptureRefs(userId)
  const fresh = footprint.filter(f => !existing.has(`${f.source_kind}:${f.source_ref}`))
  if (fresh.length === 0) return 0

  const inputs: GlosaInput[] = fresh.map(f => ({ title: f.title, context: f.context }))
  const glosas = await generateGlosas(inputs)

  const rows = fresh.map((f, i) => {
    const g = glosas[i]
    return {
      user_id: userId,
      source: f.source,
      source_kind: f.source_kind,
      source_ref: f.source_ref,
      occurred_at: f.occurred_at,
      title: f.title,
      context: f.context,
      suggested_client_id: f.client_id,
      suggested_matter_id: f.matter_id,
      suggested_activity: g?.activity ?? 'Gestión',
      suggested_glosa: g?.glosa ?? f.title,
      suggested_minutes: f.minutes ?? g?.minutes ?? 30,
      suggested_billable: f.billable && (g?.billable ?? true),
      confidence: g?.confidence ?? 'medio',
      status: 'sugerida' as CaptureStatus,
    }
  })
  return raw.insertCapturedActivities(rows)
}

/** Para el cron: captura para todos los abogados con DGA-Time habilitado. */
export async function captureForAllEnabled(): Promise<{ users: number; captured: number }> {
  const ids = await raw.getDgatimeEnabledUserIds()
  let captured = 0
  for (const uid of ids) captured += await captureForUser(uid)
  return { users: ids.length, captured }
}

/** Captura manual: el abogado anota una actividad y la IA redacta la glosa. */
export async function addManualCaptureForUser(userId: string, input: {
  note: string; client_id?: string; matter_id?: string; date?: string; minutes?: number
}): Promise<void> {
  const occurred_at = input.date ? new Date(input.date + 'T12:00:00').toISOString() : new Date().toISOString()
  const [g] = await generateGlosas([{ title: input.note, context: `Actividad anotada manualmente por el abogado: ${input.note}` }])
  await raw.insertCapturedActivities([{
    user_id: userId,
    source: 'manual',
    source_kind: 'manual',
    occurred_at,
    title: input.note.slice(0, 80),
    context: input.note,
    suggested_client_id: input.client_id,
    suggested_matter_id: input.matter_id,
    suggested_activity: g?.activity ?? 'Gestión',
    suggested_glosa: g?.glosa ?? input.note,
    suggested_minutes: input.minutes ?? g?.minutes ?? 30,
    suggested_billable: g?.billable ?? true,
    confidence: g?.confidence ?? 'medio',
    status: 'sugerida',
  }])
}
