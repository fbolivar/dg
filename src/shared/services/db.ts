import { supabase } from '@/shared/lib/supabase'
import * as mock from '@/shared/data/mock'
import type {
  Client, User, PracticeArea, Alert, LegalNote, Document,
  ContractReview, DueDiligenceProject, DueDiligenceFinding,
  Matter, MatterEvent, ComplianceDiagnostic, HRTicket
} from '@/shared/types'

// ─── Modo demostración ───────────────────────────────────────────────────────
// Cuando NEXT_PUBLIC_USE_MOCK === 'true', toda la capa de datos se alimenta de
// src/shared/data/mock.ts en lugar de Supabase. Pensado para el recorrido guiado
// del prototipo: las pantallas se ven pobladas sin necesidad de una BD provisionada.
// Para volver a Supabase, quitar la variable del entorno (o ponerla en 'false').
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'

const now = () => new Date().toISOString()

// Almacén mutable de Legal Notes para el modo demo: permite que los borradores
// creados desde el Copiloto aparezcan en /legal-notes y cambien de estado en vivo.
const mockLegalNotes: LegalNote[] = USE_MOCK ? [...mock.LEGAL_NOTES] : []

// ─── Practice Areas ──────────────────────────────────────────────────────────
export async function getPracticeAreas(): Promise<PracticeArea[]> {
  if (USE_MOCK) return mock.PRACTICE_AREAS
  const { data } = await supabase.from('practice_areas').select('*').order('name')
  return (data ?? []) as PracticeArea[]
}

// ─── Clients ─────────────────────────────────────────────────────────────────
export async function getClients(): Promise<Client[]> {
  if (USE_MOCK) return mock.CLIENTS
  const { data } = await supabase.from('clients').select('*').order('name')
  return (data ?? []) as Client[]
}

export async function createClient_(client: Omit<Client, 'id' | 'created_at'>): Promise<Client | null> {
  if (USE_MOCK) return { ...client, id: `cl${Date.now()}`, created_at: now() } as Client
  const { data } = await supabase.from('clients').insert({ ...client, id: `cl${Date.now()}` }).select().single()
  return data as Client | null
}

export async function updateClient(id: string, updates: Partial<Client>): Promise<void> {
  if (USE_MOCK) return
  await supabase.from('clients').update(updates).eq('id', id)
}

export async function deleteClient(id: string): Promise<void> {
  if (USE_MOCK) return
  await supabase.from('clients').delete().eq('id', id)
}

// ─── Users ───────────────────────────────────────────────────────────────────
export async function getUsers(): Promise<User[]> {
  if (USE_MOCK) return mock.USERS
  const { data } = await supabase.from('users').select('*').order('full_name')
  return (data ?? []) as User[]
}

export async function createUser(user: Omit<User, 'id' | 'created_at'>): Promise<User | null> {
  if (USE_MOCK) return { ...user, id: `u${Date.now()}`, created_at: now() } as User
  const { data } = await supabase.from('users').insert({ ...user, id: `u${Date.now()}` }).select().single()
  return data as User | null
}

export async function updateUser(id: string, updates: Partial<User>): Promise<void> {
  if (USE_MOCK) return
  await supabase.from('users').update(updates).eq('id', id)
}

// ─── Alerts ──────────────────────────────────────────────────────────────────
export async function getAlerts(): Promise<Alert[]> {
  if (USE_MOCK) return mock.ALERTS
  const { data } = await supabase
    .from('alerts')
    .select('*, practice_area:practice_areas(*), assigned_user:users!alerts_assigned_to_fkey(*)')
    .order('published_at', { ascending: false })
  return (data ?? []) as unknown as Alert[]
}

export async function createAlert(alert: Omit<Alert, 'id' | 'created_at' | 'practice_area' | 'assigned_user'>): Promise<Alert | null> {
  if (USE_MOCK) return { ...alert, id: `a${Date.now()}`, created_at: now() } as Alert
  const { data } = await supabase.from('alerts').insert({ ...alert, id: `a${Date.now()}` }).select().single()
  return data as Alert | null
}

export async function updateAlert(id: string, updates: Partial<Alert>): Promise<void> {
  if (USE_MOCK) return
  await supabase.from('alerts').update(updates).eq('id', id)
}

export async function deleteAlert(id: string): Promise<void> {
  if (USE_MOCK) return
  await supabase.from('alerts').delete().eq('id', id)
}

// ─── Legal Notes ─────────────────────────────────────────────────────────────
export async function getLegalNotes(): Promise<LegalNote[]> {
  if (USE_MOCK) return [...mockLegalNotes]
  const { data } = await supabase
    .from('legal_notes')
    .select('*, practice_area:practice_areas(*), author:users!legal_notes_author_id_fkey(*)')
    .order('created_at', { ascending: false })
  return (data ?? []) as unknown as LegalNote[]
}

export async function createLegalNote(note: Omit<LegalNote, 'id' | 'practice_area' | 'author'>): Promise<LegalNote | null> {
  if (USE_MOCK) {
    const created = { ...note, id: `ln${Date.now()}` } as LegalNote
    mockLegalNotes.unshift(created)
    return created
  }
  const { data } = await supabase.from('legal_notes').insert({ ...note, id: `ln${Date.now()}` }).select().single()
  return data as LegalNote | null
}

export async function updateLegalNote(id: string, updates: Partial<LegalNote>): Promise<void> {
  if (USE_MOCK) {
    const i = mockLegalNotes.findIndex(n => n.id === id)
    if (i !== -1) mockLegalNotes[i] = { ...mockLegalNotes[i], ...updates, updated_at: now() }
    return
  }
  await supabase.from('legal_notes').update({ ...updates, updated_at: now() }).eq('id', id)
}

export async function deleteLegalNote(id: string): Promise<void> {
  if (USE_MOCK) return
  await supabase.from('legal_notes').delete().eq('id', id)
}

// ─── Documents ───────────────────────────────────────────────────────────────
export async function getDocuments(): Promise<Document[]> {
  if (USE_MOCK) return mock.DOCUMENTS
  const { data } = await supabase
    .from('documents')
    .select('*, client:clients(*)')
    .order('created_at', { ascending: false })
  return (data ?? []) as unknown as Document[]
}

export async function createDocument(doc: Omit<Document, 'id' | 'client'>): Promise<Document | null> {
  if (USE_MOCK) return { ...doc, id: `d${Date.now()}` } as Document
  const { data } = await supabase.from('documents').insert({ ...doc, id: `d${Date.now()}` }).select().single()
  return data as Document | null
}

export async function updateDocument(id: string, updates: Partial<Document>): Promise<void> {
  if (USE_MOCK) return
  await supabase.from('documents').update(updates).eq('id', id)
}

export async function deleteDocument(id: string): Promise<void> {
  if (USE_MOCK) return
  await supabase.from('documents').delete().eq('id', id)
}

// ─── Contract Reviews ────────────────────────────────────────────────────────
export async function getContractReviews(): Promise<ContractReview[]> {
  if (USE_MOCK) return mock.CONTRACT_REVIEWS
  const { data } = await supabase
    .from('contract_reviews')
    .select('*, document:documents(*, client:clients(*))')
    .order('created_at', { ascending: false })
  return (data ?? []) as unknown as ContractReview[]
}

export async function createContractReview(review: Omit<ContractReview, 'id' | 'document'>): Promise<ContractReview | null> {
  if (USE_MOCK) return { ...review, id: `cr${Date.now()}` } as ContractReview
  const { data } = await supabase.from('contract_reviews').insert({ ...review, id: `cr${Date.now()}` }).select().single()
  return data as ContractReview | null
}

export async function updateContractReview(id: string, updates: Partial<ContractReview>): Promise<void> {
  if (USE_MOCK) return
  await supabase.from('contract_reviews').update(updates).eq('id', id)
}

// ─── Matters ─────────────────────────────────────────────────────────────────
export async function getMatters(): Promise<Matter[]> {
  if (USE_MOCK) return mock.MATTERS
  const { data } = await supabase
    .from('matters')
    .select('*, client:clients(*), practice_area:practice_areas(*), assigned_user:users!matters_assigned_to_fkey(*)')
    .order('created_at', { ascending: false })
  return (data ?? []) as unknown as Matter[]
}

export async function createMatter(matter: Omit<Matter, 'id' | 'client' | 'practice_area' | 'assigned_user'>): Promise<Matter | null> {
  if (USE_MOCK) return { ...matter, id: `m${Date.now()}` } as Matter
  const { data } = await supabase.from('matters').insert({ ...matter, id: `m${Date.now()}` }).select().single()
  return data as Matter | null
}

export async function updateMatter(id: string, updates: Partial<Matter>): Promise<void> {
  if (USE_MOCK) return
  await supabase.from('matters').update({ ...updates, updated_at: now() }).eq('id', id)
}

export async function deleteMatter(id: string): Promise<void> {
  if (USE_MOCK) return
  await supabase.from('matters').delete().eq('id', id)
}

// ─── Matter Events ───────────────────────────────────────────────────────────
export async function getMatterEvents(matter_id?: string): Promise<MatterEvent[]> {
  if (USE_MOCK) return matter_id ? mock.MATTER_EVENTS.filter(e => e.matter_id === matter_id) : mock.MATTER_EVENTS
  let query = supabase.from('matter_events').select('*').order('event_date', { ascending: false })
  if (matter_id) query = query.eq('matter_id', matter_id)
  const { data } = await query
  return (data ?? []) as MatterEvent[]
}

export async function createMatterEvent(event: Omit<MatterEvent, 'id' | 'created_at'>): Promise<MatterEvent | null> {
  if (USE_MOCK) return { ...event, id: `me${Date.now()}`, created_at: now() } as MatterEvent
  const { data } = await supabase.from('matter_events').insert({ ...event, id: `me${Date.now()}` }).select().single()
  return data as MatterEvent | null
}

// ─── Due Diligence ───────────────────────────────────────────────────────────
export async function getDueDiligenceProjects(): Promise<DueDiligenceProject[]> {
  if (USE_MOCK) return mock.DUE_DILIGENCE_PROJECTS
  const { data } = await supabase
    .from('due_diligence_projects')
    .select('*, client:clients(*), lead_user:users!due_diligence_projects_lead_partner_fkey(*)')
    .order('created_at', { ascending: false })

  // attach findings count
  const projects = (data ?? []) as unknown as DueDiligenceProject[]
  const ids = projects.map(p => p.id)
  if (ids.length > 0) {
    const { data: findings } = await supabase
      .from('due_diligence_findings')
      .select('project_id, severity')
      .in('project_id', ids)
    const findingsArr = (findings ?? []) as { project_id: string; severity: string }[]
    return projects.map(p => ({
      ...p,
      findings_count: findingsArr.filter(f => f.project_id === p.id).length,
      critical_count: findingsArr.filter(f => f.project_id === p.id && f.severity === 'crítico').length,
    }))
  }
  return projects
}

export async function createDueDiligenceProject(project: Omit<DueDiligenceProject, 'id' | 'client' | 'lead_user' | 'findings_count' | 'critical_count'>): Promise<DueDiligenceProject | null> {
  if (USE_MOCK) return { ...project, id: `dd${Date.now()}` } as DueDiligenceProject
  const { data } = await supabase.from('due_diligence_projects').insert({ ...project, id: `dd${Date.now()}` }).select().single()
  return data as DueDiligenceProject | null
}

export async function updateDueDiligenceProject(id: string, updates: Partial<DueDiligenceProject>): Promise<void> {
  if (USE_MOCK) return
  await supabase.from('due_diligence_projects').update({ ...updates, updated_at: now() }).eq('id', id)
}

export async function deleteDueDiligenceProject(id: string): Promise<void> {
  if (USE_MOCK) return
  await supabase.from('due_diligence_projects').delete().eq('id', id)
}

export async function getDueDiligenceFindings(project_id?: string): Promise<DueDiligenceFinding[]> {
  if (USE_MOCK) return project_id ? mock.DUE_DILIGENCE_FINDINGS.filter(f => f.project_id === project_id) : mock.DUE_DILIGENCE_FINDINGS
  let query = supabase.from('due_diligence_findings').select('*').order('created_at', { ascending: false })
  if (project_id) query = query.eq('project_id', project_id)
  const { data } = await query
  return (data ?? []) as DueDiligenceFinding[]
}

export async function createDueDiligenceFinding(finding: Omit<DueDiligenceFinding, 'id' | 'created_at'>): Promise<DueDiligenceFinding | null> {
  if (USE_MOCK) return { ...finding, id: `ddf${Date.now()}`, created_at: now() } as DueDiligenceFinding
  const { data } = await supabase.from('due_diligence_findings').insert({ ...finding, id: `ddf${Date.now()}` }).select().single()
  return data as DueDiligenceFinding | null
}

export async function updateDueDiligenceFinding(id: string, updates: Partial<DueDiligenceFinding>): Promise<void> {
  if (USE_MOCK) return
  await supabase.from('due_diligence_findings').update(updates).eq('id', id)
}

export async function deleteDueDiligenceFinding(id: string): Promise<void> {
  if (USE_MOCK) return
  await supabase.from('due_diligence_findings').delete().eq('id', id)
}

// ─── Compliance ──────────────────────────────────────────────────────────────
export async function getComplianceDiagnostics(): Promise<ComplianceDiagnostic[]> {
  if (USE_MOCK) return mock.COMPLIANCE_DIAGNOSTICS
  const { data } = await supabase
    .from('compliance_diagnostics')
    .select('*, client:clients(*)')
    .order('created_at', { ascending: false })
  return (data ?? []) as unknown as ComplianceDiagnostic[]
}

export async function createComplianceDiagnostic(diag: Omit<ComplianceDiagnostic, 'id' | 'client'>): Promise<ComplianceDiagnostic | null> {
  if (USE_MOCK) return { ...diag, id: `cd${Date.now()}` } as ComplianceDiagnostic
  const { data } = await supabase.from('compliance_diagnostics').insert({ ...diag, id: `cd${Date.now()}` }).select().single()
  return data as ComplianceDiagnostic | null
}

export async function updateComplianceDiagnostic(id: string, updates: Partial<ComplianceDiagnostic>): Promise<void> {
  if (USE_MOCK) return
  await supabase.from('compliance_diagnostics').update(updates).eq('id', id)
}

export async function deleteComplianceDiagnostic(id: string): Promise<void> {
  if (USE_MOCK) return
  await supabase.from('compliance_diagnostics').delete().eq('id', id)
}

// ─── HR Tickets ──────────────────────────────────────────────────────────────
export async function getHRTickets(): Promise<HRTicket[]> {
  if (USE_MOCK) return mock.HR_TICKETS
  const { data } = await supabase
    .from('hr_tickets')
    .select('*, client:clients(*)')
    .order('created_at', { ascending: false })
  return (data ?? []) as unknown as HRTicket[]
}

export async function createHRTicket(ticket: Omit<HRTicket, 'id' | 'client'>): Promise<HRTicket | null> {
  if (USE_MOCK) return { ...ticket, id: `hr${Date.now()}` } as HRTicket
  const { data } = await supabase.from('hr_tickets').insert({ ...ticket, id: `hr${Date.now()}` }).select().single()
  return data as HRTicket | null
}

export async function updateHRTicket(id: string, updates: Partial<HRTicket>): Promise<void> {
  if (USE_MOCK) return
  await supabase.from('hr_tickets').update(updates).eq('id', id)
}

export async function deleteHRTicket(id: string): Promise<void> {
  if (USE_MOCK) return
  await supabase.from('hr_tickets').delete().eq('id', id)
}
