"use server"
// ─── Capa de datos AUTORIZADA — dominio legal (Server Actions) ────────────────
// Cada acción exige sesión, autoriza por rol y aísla por client_id (helper puro).
import * as raw from '@/shared/services/db-raw'
import { requireSession, requireStaff } from './_guards'
import { filterByClient, filterAlertsByClient } from './_isolation'
import type {
  Client, User, PracticeArea, Alert, LegalNote, Document,
  ContractReview, DueDiligenceProject, DueDiligenceFinding,
  Matter, MatterEvent, ComplianceDiagnostic, HRTicket,
  JudicialProcess, JudicialActuacion, AuditLogEntry,
} from '@/shared/types'

// ─── Practice Areas (referencia, visible para todos los autenticados) ─────────
export async function getPracticeAreas(): Promise<PracticeArea[]> {
  await requireSession()
  return raw.getPracticeAreas()
}

// ─── Clients ─────────────────────────────────────────────────────────────────
export async function getClients(): Promise<Client[]> {
  const s = await requireSession()
  const all = await raw.getClients()
  // El cliente solo ve su propia ficha: filtramos por id (no por client_id).
  return s.role === 'cliente' ? all.filter(c => !!s.client_id && c.id === s.client_id) : all
}
export async function createClient_(client: Omit<Client, 'id' | 'created_at'>): Promise<Client | null> {
  await requireStaff(); return raw.createClient_(client)
}
export async function updateClient(id: string, updates: Partial<Client>): Promise<void> {
  await requireStaff(); return raw.updateClient(id, updates)
}
export async function deleteClient(id: string): Promise<void> {
  await requireStaff(); return raw.deleteClient(id)
}

// ─── Users (solo staff; nunca expone password_hash) ───────────────────────────
export async function getUsers(): Promise<User[]> {
  const s = await requireSession()
  if (s.role === 'cliente') return []
  return raw.getUsers()
}

// ─── Alerts ──────────────────────────────────────────────────────────────────
export async function getAlerts(): Promise<Alert[]> {
  const s = await requireSession()
  return filterAlertsByClient(s, await raw.getAlerts())
}
export async function createAlert(alert: Omit<Alert, 'id' | 'created_at' | 'practice_area' | 'assigned_user'>): Promise<Alert | null> {
  await requireStaff(); return raw.createAlert(alert)
}
export async function updateAlert(id: string, updates: Partial<Alert>): Promise<void> {
  await requireStaff(); return raw.updateAlert(id, updates)
}
export async function deleteAlert(id: string): Promise<void> {
  await requireStaff(); return raw.deleteAlert(id)
}

// ─── Legal Notes (internas; no visibles para clientes) ────────────────────────
export async function getLegalNotes(): Promise<LegalNote[]> {
  const s = await requireSession()
  if (s.role === 'cliente') return []
  return raw.getLegalNotes()
}
export async function createLegalNote(note: Omit<LegalNote, 'id' | 'practice_area' | 'author'>): Promise<LegalNote | null> {
  await requireStaff(); return raw.createLegalNote(note)
}
export async function updateLegalNote(id: string, updates: Partial<LegalNote>): Promise<void> {
  const s = await requireStaff()
  await raw.updateLegalNote(id, updates)
  // Auditar cambios de estado relevantes (aprobación/rechazo/publicación)
  if (updates.status && ['aprobado', 'rechazado', 'publicado', 'en_revisión'].includes(updates.status)) {
    await raw.logAudit({
      actor_id: s.id, actor_name: s.name,
      action: `Legal Note → ${updates.status}`,
      entity: updates.title ?? id,
    })
  }
}
export async function deleteLegalNote(id: string): Promise<void> {
  await requireStaff(); return raw.deleteLegalNote(id)
}

// ─── Documents ───────────────────────────────────────────────────────────────
export async function getDocuments(): Promise<Document[]> {
  const s = await requireSession()
  return filterByClient(s, await raw.getDocuments())
}
export async function createDocument(doc: Omit<Document, 'id' | 'client'>): Promise<Document | null> {
  await requireStaff(); return raw.createDocument(doc)
}
export async function updateDocument(id: string, updates: Partial<Document>): Promise<void> {
  await requireStaff(); return raw.updateDocument(id, updates)
}
export async function deleteDocument(id: string): Promise<void> {
  await requireStaff(); return raw.deleteDocument(id)
}

// ─── Contract Reviews (internas) ──────────────────────────────────────────────
export async function getContractReviews(): Promise<ContractReview[]> {
  const s = await requireSession()
  if (s.role === 'cliente') return []
  return raw.getContractReviews()
}
export async function createContractReview(review: Omit<ContractReview, 'id' | 'document'>): Promise<ContractReview | null> {
  await requireStaff(); return raw.createContractReview(review)
}
export async function updateContractReview(id: string, updates: Partial<ContractReview>): Promise<void> {
  await requireStaff(); return raw.updateContractReview(id, updates)
}

// ─── Matters ─────────────────────────────────────────────────────────────────
export async function getMatters(): Promise<Matter[]> {
  const s = await requireSession()
  return filterByClient(s, await raw.getMatters())
}
export async function createMatter(matter: Omit<Matter, 'id' | 'client' | 'practice_area' | 'assigned_user'>): Promise<Matter | null> {
  await requireStaff(); return raw.createMatter(matter)
}
export async function updateMatter(id: string, updates: Partial<Matter>): Promise<void> {
  await requireStaff(); return raw.updateMatter(id, updates)
}
export async function deleteMatter(id: string): Promise<void> {
  await requireStaff(); return raw.deleteMatter(id)
}
export async function recordMatterDeadline(matterId: string, onTime: boolean): Promise<void> {
  await requireStaff(); return raw.incrementMatterDeadline(matterId, onTime)
}

// ─── Matter Events (internos) ─────────────────────────────────────────────────
export async function getMatterEvents(matter_id?: string): Promise<MatterEvent[]> {
  const s = await requireSession()
  if (s.role === 'cliente') return []
  return raw.getMatterEvents(matter_id)
}
export async function createMatterEvent(event: Omit<MatterEvent, 'id' | 'created_at'>): Promise<MatterEvent | null> {
  await requireStaff(); return raw.createMatterEvent(event)
}

// ─── Due Diligence ───────────────────────────────────────────────────────────
export async function getDueDiligenceProjects(): Promise<DueDiligenceProject[]> {
  const s = await requireSession()
  return filterByClient(s, await raw.getDueDiligenceProjects())
}
export async function createDueDiligenceProject(project: Omit<DueDiligenceProject, 'id' | 'client' | 'lead_user' | 'findings_count' | 'critical_count'>): Promise<DueDiligenceProject | null> {
  await requireStaff(); return raw.createDueDiligenceProject(project)
}
export async function updateDueDiligenceProject(id: string, updates: Partial<DueDiligenceProject>): Promise<void> {
  await requireStaff(); return raw.updateDueDiligenceProject(id, updates)
}
export async function deleteDueDiligenceProject(id: string): Promise<void> {
  await requireStaff(); return raw.deleteDueDiligenceProject(id)
}
export async function getDueDiligenceFindings(project_id?: string): Promise<DueDiligenceFinding[]> {
  const s = await requireSession()
  if (s.role === 'cliente') return []
  return raw.getDueDiligenceFindings(project_id)
}
export async function createDueDiligenceFinding(finding: Omit<DueDiligenceFinding, 'id' | 'created_at'>): Promise<DueDiligenceFinding | null> {
  await requireStaff(); return raw.createDueDiligenceFinding(finding)
}
export async function updateDueDiligenceFinding(id: string, updates: Partial<DueDiligenceFinding>): Promise<void> {
  await requireStaff(); return raw.updateDueDiligenceFinding(id, updates)
}
export async function deleteDueDiligenceFinding(id: string): Promise<void> {
  await requireStaff(); return raw.deleteDueDiligenceFinding(id)
}

// ─── Compliance ──────────────────────────────────────────────────────────────
export async function getComplianceDiagnostics(): Promise<ComplianceDiagnostic[]> {
  const s = await requireSession()
  return filterByClient(s, await raw.getComplianceDiagnostics())
}
export async function createComplianceDiagnostic(diag: Omit<ComplianceDiagnostic, 'id' | 'client'>): Promise<ComplianceDiagnostic | null> {
  await requireStaff(); return raw.createComplianceDiagnostic(diag)
}
export async function updateComplianceDiagnostic(id: string, updates: Partial<ComplianceDiagnostic>): Promise<void> {
  await requireStaff(); return raw.updateComplianceDiagnostic(id, updates)
}
export async function deleteComplianceDiagnostic(id: string): Promise<void> {
  await requireStaff(); return raw.deleteComplianceDiagnostic(id)
}

// ─── HR Tickets ──────────────────────────────────────────────────────────────
export async function getHRTickets(): Promise<HRTicket[]> {
  const s = await requireSession()
  return filterByClient(s, await raw.getHRTickets())
}
export async function createHRTicket(ticket: Omit<HRTicket, 'id' | 'client'>): Promise<HRTicket | null> {
  await requireStaff(); return raw.createHRTicket(ticket)
}
export async function updateHRTicket(id: string, updates: Partial<HRTicket>): Promise<void> {
  await requireStaff(); return raw.updateHRTicket(id, updates)
}
export async function deleteHRTicket(id: string): Promise<void> {
  await requireStaff(); return raw.deleteHRTicket(id)
}

// ─── Rama Judicial ───────────────────────────────────────────────────────────
export async function getJudicialProcesses(): Promise<JudicialProcess[]> {
  const s = await requireSession()
  return filterByClient(s, await raw.getJudicialProcesses())
}
export async function getJudicialActuaciones(process_id?: string): Promise<JudicialActuacion[]> {
  const s = await requireSession()
  if (s.role === 'cliente') {
    const procesos = filterByClient(s, await raw.getJudicialProcesses())
    const permitidos = new Set(procesos.map(p => p.id))
    const acts = await raw.getJudicialActuaciones(process_id)
    return acts.filter(a => permitidos.has(a.process_id))
  }
  return raw.getJudicialActuaciones(process_id)
}
export async function createJudicialProcess(p: Omit<JudicialProcess, 'id' | 'client'>): Promise<JudicialProcess | null> {
  await requireStaff(); return raw.createJudicialProcess(p)
}
export async function updateJudicialProcess(id: string, updates: Partial<JudicialProcess>): Promise<void> {
  await requireStaff(); return raw.updateJudicialProcess(id, updates)
}
export async function addJudicialActuaciones(actuaciones: JudicialActuacion[]): Promise<void> {
  await requireStaff(); await raw.addJudicialActuaciones(actuaciones)
}

// ─── Auditoría (solo staff) ───────────────────────────────────────────────────
export async function getAuditLog(): Promise<AuditLogEntry[]> {
  const s = await requireSession()
  if (s.role === 'cliente') return []
  return raw.getAuditLog(100)
}
