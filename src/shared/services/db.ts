"use server"
// ─── Capa de datos AUTORIZADA (Server Actions) ───────────────────────────────
// Única superficie que deben usar los componentes cliente. Cada acción:
//   1) exige sesión válida (getSession sobre el JWT en cookie httpOnly)
//   2) aplica autorización por rol (las mutaciones requieren staff)
//   3) aísla por client_id (un 'cliente' solo ve los datos de su cliente)
// El acceso crudo a la BD (service role, sin auth) vive en db-raw.ts.
import * as raw from '@/shared/services/db-raw'
import { captureForUser, addManualCaptureForUser } from '@/shared/services/capture'
import { providerConfigured } from '@/shared/lib/oauth'
import { getSession } from '@/shared/lib/auth'
import type {
  Client, User, PracticeArea, Alert, LegalNote, Document,
  ContractReview, DueDiligenceProject, DueDiligenceFinding,
  Matter, MatterEvent, ComplianceDiagnostic, HRTicket,
  JudicialProcess, JudicialActuacion, SessionUser, AuditLogEntry,
  TimeEntry, Invoice, InvoiceItem, InvoiceType, InvoiceStatus, DgaCurrency,
  RecurringFee, RecurringFrequency, CapturedActivity, ProviderStatus
} from '@/shared/types'

async function requireSession(): Promise<SessionUser> {
  const s = await getSession()
  if (!s) throw new Error('No autenticado')
  return s
}
function isStaff(role: SessionUser['role']): boolean {
  return role === 'admin' || role === 'socio' || role === 'asociado'
}
async function requireStaff(): Promise<SessionUser> {
  const s = await requireSession()
  if (!isStaff(s.role)) throw new Error('No autorizado')
  return s
}

// ─── Practice Areas (referencia, visible para todos los autenticados) ─────────
export async function getPracticeAreas(): Promise<PracticeArea[]> {
  await requireSession()
  return raw.getPracticeAreas()
}

// ─── Clients ─────────────────────────────────────────────────────────────────
export async function getClients(): Promise<Client[]> {
  const s = await requireSession()
  const all = await raw.getClients()
  return s.role === 'cliente' ? all.filter(c => c.id === s.client_id) : all
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
  const all = await raw.getAlerts()
  return s.role === 'cliente'
    ? all.filter(a => a.clients_affected?.includes(s.client_id ?? '__none__'))
    : all
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
  const all = await raw.getDocuments()
  return s.role === 'cliente' ? all.filter(d => d.client_id === s.client_id) : all
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
  const all = await raw.getMatters()
  return s.role === 'cliente' ? all.filter(m => m.client_id === s.client_id) : all
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
  const all = await raw.getDueDiligenceProjects()
  return s.role === 'cliente' ? all.filter(p => p.client_id === s.client_id) : all
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
  const all = await raw.getComplianceDiagnostics()
  return s.role === 'cliente' ? all.filter(c => c.client_id === s.client_id) : all
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
  const all = await raw.getHRTickets()
  return s.role === 'cliente' ? all.filter(t => t.client_id === s.client_id) : all
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
  const all = await raw.getJudicialProcesses()
  return s.role === 'cliente' ? all.filter(p => p.client_id === s.client_id) : all
}
export async function getJudicialActuaciones(process_id?: string): Promise<JudicialActuacion[]> {
  const s = await requireSession()
  if (s.role === 'cliente') {
    const procesos = await raw.getJudicialProcesses()
    const permitidos = new Set(procesos.filter(p => p.client_id === s.client_id).map(p => p.id))
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

// ═══ DGA-Time ════════════════════════════════════════════════════════════════
function isManager(role: SessionUser['role']): boolean {
  return role === 'admin' || role === 'socio'
}
async function requireDgatime(): Promise<SessionUser> {
  const s = await requireSession()
  if (!(isManager(s.role) || s.dgatime_enabled)) throw new Error('Sin acceso a DGA-Time')
  return s
}
async function requireManager(): Promise<SessionUser> {
  const s = await requireSession()
  if (!isManager(s.role)) throw new Error('No autorizado')
  return s
}

// ─── Registro de horas ────────────────────────────────────────────────────────
export async function getTimeEntries(): Promise<TimeEntry[]> {
  const s = await requireDgatime()
  // Managers ven todo; cada abogado solo sus propias horas.
  return isManager(s.role) ? raw.getTimeEntries() : raw.getTimeEntries({ user_id: s.id })
}

export async function createTimeEntry(input: {
  client_id: string; matter_id?: string; date: string; minutes: number
  activity: string; description: string; billable: boolean; rework?: boolean
}): Promise<TimeEntry | null> {
  const s = await requireDgatime()
  const { hourly_rate, cost_rate, rate_currency } = await raw.getUserRate(s.id)
  const amount = Math.round((input.minutes / 60) * hourly_rate)
  const cost_amount = Math.round((input.minutes / 60) * cost_rate)
  return raw.createTimeEntry({
    user_id: s.id,
    client_id: input.client_id,
    matter_id: input.matter_id,
    date: input.date,
    minutes: input.minutes,
    activity: input.activity,
    description: input.description,
    billable: input.billable,
    rework: input.rework ?? false,
    rate: hourly_rate,
    cost: cost_rate,
    cost_amount,
    currency: rate_currency,
    amount,
    status: 'borrador',
  })
}

export async function updateTimeEntry(id: string, updates: {
  client_id?: string; matter_id?: string; date?: string; minutes?: number
  activity?: string; description?: string; billable?: boolean; rework?: boolean
}): Promise<void> {
  const s = await requireDgatime()
  const entry = await raw.getTimeEntry(id)
  if (!entry) throw new Error('Registro no encontrado')
  if (!(entry.user_id === s.id || isManager(s.role))) throw new Error('No autorizado')
  if (entry.status === 'facturado') throw new Error('No se puede editar una hora ya facturada')
  const patch: Partial<TimeEntry> = { ...updates }
  if (updates.minutes !== undefined) {
    patch.amount = Math.round((updates.minutes / 60) * entry.rate)
    patch.cost_amount = Math.round((updates.minutes / 60) * (entry.cost ?? 0))
  }
  await raw.updateTimeEntry(id, patch)
}

export async function deleteTimeEntry(id: string): Promise<void> {
  const s = await requireDgatime()
  const entry = await raw.getTimeEntry(id)
  if (!entry) return
  if (!(entry.user_id === s.id || isManager(s.role))) throw new Error('No autorizado')
  if (entry.status === 'facturado') throw new Error('No se puede eliminar una hora facturada')
  await raw.deleteTimeEntry(id)
}

export async function approveTimeEntry(id: string, approve: boolean): Promise<void> {
  const s = await requireManager()
  await raw.updateTimeEntry(id, {
    status: approve ? 'aprobado' : 'rechazado',
    approved_by: s.id,
    approved_at: new Date().toISOString(),
  })
}

// ─── Facturación (solo managers: socio/admin) ─────────────────────────────────
export async function getInvoices(): Promise<Invoice[]> {
  await requireManager()
  return raw.getInvoices()
}

export async function getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
  await requireManager()
  return raw.getInvoiceItems(invoiceId)
}

export async function createInvoice(input: {
  client_id: string; matter_id?: string; type: InvoiceType; currency: DgaCurrency
  issue_date: string; due_date?: string; period_start?: string; period_end?: string
  tax_rate: number; notes?: string
  items: { description: string; quantity: number; unit_rate: number; time_entry_id?: string }[]
  time_entry_ids?: string[]
}): Promise<Invoice | null> {
  const s = await requireManager()
  const n = await raw.countInvoices()
  const year = new Date().getFullYear()
  const number = `DGA-${year}-${String(n + 1).padStart(4, '0')}`
  const items = input.items.map(it => ({
    description: it.description,
    quantity: it.quantity,
    unit_rate: it.unit_rate,
    amount: Math.round(it.quantity * it.unit_rate),
    time_entry_id: it.time_entry_id,
  }))
  const subtotal = items.reduce((sum, it) => sum + it.amount, 0)
  const tax = Math.round(subtotal * (input.tax_rate / 100))
  const total = subtotal + tax
  const invoice = await raw.createInvoice(
    {
      number, client_id: input.client_id, matter_id: input.matter_id, type: input.type,
      status: 'borrador', currency: input.currency, issue_date: input.issue_date,
      due_date: input.due_date, period_start: input.period_start, period_end: input.period_end,
      subtotal, tax_rate: input.tax_rate, tax, total, notes: input.notes, created_by: s.id,
    },
    items,
    input.time_entry_ids ?? []
  )
  if (invoice) {
    await raw.logAudit({ actor_id: s.id, actor_name: s.name, action: 'Factura creada', entity: number, detail: `${input.type} · ${input.currency} ${total.toLocaleString('es-CO')}` })
  }
  return invoice
}

export async function updateInvoiceStatus(id: string, status: InvoiceStatus): Promise<void> {
  const s = await requireManager()
  await raw.updateInvoice(id, { status })
  await raw.logAudit({ actor_id: s.id, actor_name: s.name, action: `Factura → ${status}`, entity: id })
}

export async function deleteInvoice(id: string): Promise<void> {
  await requireManager()
  await raw.deleteInvoice(id)
}

// ─── Igualas / cobros recurrentes (solo managers) ─────────────────────────────
export async function getRecurringFees(): Promise<RecurringFee[]> {
  await requireManager()
  return raw.getRecurringFees()
}

export async function createRecurringFee(input: {
  client_id: string; matter_id?: string; type: InvoiceType; description: string
  amount: number; currency: DgaCurrency; tax_rate: number
  frequency: RecurringFrequency; day_of_month: number; start_date: string; end_date?: string; active?: boolean
}): Promise<RecurringFee | null> {
  const s = await requireManager()
  const fee = await raw.createRecurringFee({
    client_id: input.client_id, matter_id: input.matter_id, type: input.type,
    description: input.description, amount: input.amount, currency: input.currency,
    tax_rate: input.tax_rate, frequency: input.frequency, day_of_month: input.day_of_month,
    start_date: input.start_date, end_date: input.end_date, active: input.active ?? true,
    created_by: s.id,
  })
  if (fee) await raw.logAudit({ actor_id: s.id, actor_name: s.name, action: 'Iguala creada', entity: input.description, detail: `${input.frequency} · ${input.currency} ${Math.round(input.amount).toLocaleString('es-CO')}` })
  return fee
}

export async function updateRecurringFee(id: string, updates: Partial<{
  description: string; amount: number; currency: DgaCurrency; tax_rate: number
  frequency: RecurringFrequency; day_of_month: number; start_date: string; end_date: string | null; active: boolean; matter_id: string | null
}>): Promise<void> {
  await requireManager()
  await raw.updateRecurringFee(id, updates as Partial<RecurringFee>)
}

export async function deleteRecurringFee(id: string): Promise<void> {
  await requireManager()
  await raw.deleteRecurringFee(id)
}

/** Genera ahora las igualas que vencen (acción manual del manager). */
export async function generateIgualasNow(): Promise<{ generated: number }> {
  const s = await requireManager()
  const todayISO = new Date().toISOString().slice(0, 10)
  const res = await raw.generateDueRecurringFees(todayISO)
  if (res.generated > 0) {
    await raw.logAudit({ actor_id: s.id, actor_name: s.name, action: 'Igualas generadas (manual)', entity: `${res.generated} factura(s)` })
  }
  return { generated: res.generated }
}

// ─── Captura inteligente (privada por abogado) ────────────────────────────────
export async function getCapturedActivities(): Promise<CapturedActivity[]> {
  const s = await requireDgatime()
  return raw.getCapturedActivities(s.id) // solo las propias
}

/** "Capturar mi día": detecta la actividad reciente del abogado en la plataforma. */
export async function capturarMiDia(): Promise<{ captured: number }> {
  const s = await requireDgatime()
  const captured = await captureForUser(s.id)
  return { captured }
}

export async function addManualCapture(input: {
  note: string; client_id?: string; matter_id?: string; date?: string; minutes?: number
}): Promise<void> {
  const s = await requireDgatime()
  if (!input.note?.trim()) throw new Error('Escribe la actividad')
  await addManualCaptureForUser(s.id, input)
}

/** Aprueba una sugerencia → crea el registro de horas (entra al flujo de DGA-Time). */
export async function approveCapturedActivity(id: string, edits?: {
  client_id?: string; matter_id?: string | null; activity?: string; glosa?: string; minutes?: number; billable?: boolean
}): Promise<void> {
  const s = await requireDgatime()
  const cap = await raw.getCapturedActivity(id)
  if (!cap || cap.user_id !== s.id) throw new Error('No autorizado')
  if (cap.status !== 'sugerida') throw new Error('Esta sugerencia ya fue procesada')

  const client_id = edits?.client_id ?? cap.suggested_client_id
  if (!client_id) throw new Error('Asigna un cliente antes de aprobar')
  const matter_id = edits?.matter_id !== undefined ? (edits.matter_id ?? undefined) : cap.suggested_matter_id
  const minutes = edits?.minutes ?? cap.suggested_minutes
  const activity = edits?.activity ?? cap.suggested_activity
  const glosa = edits?.glosa ?? cap.suggested_glosa
  const billable = edits?.billable ?? cap.suggested_billable

  const { hourly_rate, cost_rate, rate_currency } = await raw.getUserRate(s.id)
  const amount = Math.round((minutes / 60) * hourly_rate)
  const cost_amount = Math.round((minutes / 60) * cost_rate)
  const entry = await raw.createTimeEntry({
    user_id: s.id, client_id, matter_id, date: cap.occurred_at.slice(0, 10),
    minutes, activity, description: glosa, billable,
    rate: hourly_rate, cost: cost_rate, cost_amount, currency: rate_currency, amount, status: 'borrador',
  })
  await raw.updateCapturedActivity(id, { status: 'aprobada', time_entry_id: entry?.id })
}

export async function discardCapturedActivity(id: string): Promise<void> {
  const s = await requireDgatime()
  const cap = await raw.getCapturedActivity(id)
  if (!cap || cap.user_id !== s.id) throw new Error('No autorizado')
  await raw.updateCapturedActivity(id, { status: 'descartada' })
}

// ─── Integraciones de correo / calendario (Google / Microsoft) ────────────────
export async function getIntegrationsStatus(): Promise<Record<'google' | 'microsoft', ProviderStatus>> {
  const s = await requireDgatime()
  const list = await raw.listUserIntegrations(s.id)
  const mk = (p: 'google' | 'microsoft'): ProviderStatus => {
    const it = list.find(x => x.provider === p)
    return { configured: providerConfigured(p), connected: !!it, account_email: it?.account_email, last_sync: it?.last_sync }
  }
  return { google: mk('google'), microsoft: mk('microsoft') }
}

export async function disconnectIntegration(provider: 'google' | 'microsoft'): Promise<void> {
  const s = await requireDgatime()
  await raw.deleteIntegration(s.id, provider)
}
