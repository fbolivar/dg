import { supabase, now, USER_PUBLIC } from './_shared'
import type {
  Client, User, PracticeArea, Alert, LegalNote,
} from '@/shared/types'

// ─── Practice Areas ──────────────────────────────────────────────────────────
export async function getPracticeAreas(): Promise<PracticeArea[]> {
  const { data } = await supabase.from('practice_areas').select('*').order('name')
  return (data ?? []) as PracticeArea[]
}

// ─── Clients ─────────────────────────────────────────────────────────────────
export async function getClients(): Promise<Client[]> {
  const { data } = await supabase.from('clients').select('*').order('name')
  return (data ?? []) as Client[]
}

export async function createClient_(client: Omit<Client, 'id' | 'created_at'>): Promise<Client | null> {
  const { data } = await supabase.from('clients').insert({ ...client, id: `cl${Date.now()}` }).select().single()
  return data as Client | null
}

export async function updateClient(id: string, updates: Partial<Client>): Promise<void> {
  await supabase.from('clients').update(updates).eq('id', id)
}

export async function deleteClient(id: string): Promise<void> {
  await supabase.from('clients').delete().eq('id', id)
}

// ─── Users ───────────────────────────────────────────────────────────────────
export async function getUsers(): Promise<User[]> {
  const { data } = await supabase.from('users').select(USER_PUBLIC).order('full_name')
  return (data ?? []) as User[]
}

// ─── Alerts ──────────────────────────────────────────────────────────────────
export async function getAlerts(): Promise<Alert[]> {
  const { data } = await supabase
    .from('alerts')
    .select(`*, practice_area:practice_areas(*), assigned_user:users!alerts_assigned_to_fkey(${USER_PUBLIC})`)
    .order('published_at', { ascending: false })
  return (data ?? []) as unknown as Alert[]
}

export async function createAlert(alert: Omit<Alert, 'id' | 'created_at' | 'practice_area' | 'assigned_user'>): Promise<Alert | null> {
  const { data } = await supabase.from('alerts').insert({ ...alert, id: `a${Date.now()}` }).select().single()
  return data as Alert | null
}

export async function updateAlert(id: string, updates: Partial<Alert>): Promise<void> {
  await supabase.from('alerts').update(updates).eq('id', id)
}

export async function deleteAlert(id: string): Promise<void> {
  await supabase.from('alerts').delete().eq('id', id)
}

// ─── Legal Notes ─────────────────────────────────────────────────────────────
export async function getLegalNotes(): Promise<LegalNote[]> {
  const { data } = await supabase
    .from('legal_notes')
    .select(`*, practice_area:practice_areas(*), author:users!legal_notes_author_id_fkey(${USER_PUBLIC})`)
    .order('created_at', { ascending: false })
  return (data ?? []) as unknown as LegalNote[]
}

export async function createLegalNote(note: Omit<LegalNote, 'id' | 'practice_area' | 'author'>): Promise<LegalNote | null> {
  const { data } = await supabase.from('legal_notes').insert({ ...note, id: `ln${Date.now()}` }).select().single()
  return data as LegalNote | null
}

export async function updateLegalNote(id: string, updates: Partial<LegalNote>): Promise<void> {
  await supabase.from('legal_notes').update({ ...updates, updated_at: now() }).eq('id', id)
}

export async function deleteLegalNote(id: string): Promise<void> {
  await supabase.from('legal_notes').delete().eq('id', id)
}
