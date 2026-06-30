import { supabase } from './_shared'
import type { JudicialProcess, JudicialActuacion } from '@/shared/types'

// ─── Rama Judicial (procesos y actuaciones) ──────────────────────────────────
export async function getJudicialProcesses(): Promise<JudicialProcess[]> {
  const { data } = await supabase
    .from('judicial_processes')
    .select('*, client:clients(*)')
    .order('fecha_ultima_actuacion', { ascending: false })
  return (data ?? []) as unknown as JudicialProcess[]
}

export async function getJudicialActuaciones(process_id?: string): Promise<JudicialActuacion[]> {
  let q = supabase.from('judicial_actuaciones').select('*').order('fecha', { ascending: false })
  if (process_id) q = q.eq('process_id', process_id)
  const { data } = await q
  return (data ?? []) as JudicialActuacion[]
}

export async function createJudicialProcess(p: Omit<JudicialProcess, 'id' | 'client'>): Promise<JudicialProcess | null> {
  const { data } = await supabase.from('judicial_processes').insert({ ...p, id: `jp${Date.now()}` }).select().single()
  return data as JudicialProcess | null
}

export async function updateJudicialProcess(id: string, updates: Partial<JudicialProcess>): Promise<void> {
  // Excluir relaciones embebidas que no son columnas.
  const { client: _client, ...cols } = updates as Partial<JudicialProcess> & { client?: unknown }
  void _client
  await supabase.from('judicial_processes').update(cols).eq('id', id)
}

/** Inserta actuaciones nuevas (dedup por id). Devuelve cuántas se insertaron. */
export async function addJudicialActuaciones(actuaciones: JudicialActuacion[]): Promise<number> {
  if (!actuaciones.length) return 0
  const ids = actuaciones.map(a => a.id)
  const { data: existentes } = await supabase.from('judicial_actuaciones').select('id').in('id', ids)
  const existIds = new Set((existentes ?? []).map((r: { id: string }) => r.id))
  const nuevas = actuaciones.filter(a => !existIds.has(a.id)).map(a => {
    const { is_new, ...rest } = a
    return { ...rest, is_new: is_new ?? false }
  })
  if (nuevas.length) await supabase.from('judicial_actuaciones').insert(nuevas)
  return nuevas.length
}
