import { supabase } from './_shared'
import type { AuditLogEntry } from '@/shared/types'

// ─── Auditoría ───────────────────────────────────────────────────────────────
export async function logAudit(e: {
  actor_id?: string; actor_name?: string; action: string; entity?: string; detail?: string
}): Promise<void> {
  await supabase.from('audit_log').insert({
    actor_id: e.actor_id ?? null,
    actor_name: e.actor_name ?? '—',
    action: e.action,
    entity: e.entity ?? null,
    detail: e.detail ?? null,
  })
}

export async function getAuditLog(limit = 100): Promise<AuditLogEntry[]> {
  const { data } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as AuditLogEntry[]
}
