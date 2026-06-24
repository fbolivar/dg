// ─── Capa de datos CRUDA (server-only, service role, SIN autorización) ───────
// Bypassa RLS. Solo debe importarse desde código de servidor de confianza:
//   - la capa autorizada db.ts (que añade sesión + filtrado por cliente)
//   - jobs internos sin sesión de usuario (cron de Rama Judicial)
// NUNCA debe importarse desde un componente cliente.
import { supabaseAdmin as supabase } from '@/shared/lib/supabase-admin'
import { encryptToken, decryptToken } from '@/shared/lib/crypto'
import type {
  Client, User, PracticeArea, Alert, LegalNote, Document,
  ContractReview, DueDiligenceProject, DueDiligenceFinding,
  Matter, MatterEvent, ComplianceDiagnostic, HRTicket,
  JudicialProcess, JudicialActuacion, AuditLogEntry,
  TimeEntry, Invoice, InvoiceItem, DgaCurrency, RecurringFee, RecurringFrequency,
  CapturedActivity, CaptureStatus, UserIntegration
} from '@/shared/types'

type OAuthProvider = 'google' | 'microsoft'
export type IntegrationTokens = { access_token: string | null; refresh_token: string | null; token_expiry?: string | null }

// Item normalizado de "huella" de trabajo (plataforma o fuentes externas).
export type FootprintItem = {
  source: string          // plataforma | calendario | correo
  source_kind: string
  source_ref: string
  occurred_at: string
  title: string
  context: string
  client_id?: string
  matter_id?: string
  billable: boolean
  minutes?: number        // duración conocida (ej. reuniones); si no, la IA estima
}

const now = () => new Date().toISOString()

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

// Columnas públicas de users (excluye password_hash) para selects y joins.
const USER_PUBLIC = 'id,email,full_name,role,client_id,avatar_url,is_active,created_at'

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

// ─── Documents ───────────────────────────────────────────────────────────────
export async function getDocuments(): Promise<Document[]> {
  const { data } = await supabase
    .from('documents')
    .select('*, client:clients(*)')
    .order('created_at', { ascending: false })
  return (data ?? []) as unknown as Document[]
}

export async function createDocument(doc: Omit<Document, 'id' | 'client'>): Promise<Document | null> {
  const { data } = await supabase.from('documents').insert({ ...doc, id: `d${Date.now()}` }).select().single()
  return data as Document | null
}

export async function updateDocument(id: string, updates: Partial<Document>): Promise<void> {
  await supabase.from('documents').update(updates).eq('id', id)
}

export async function deleteDocument(id: string): Promise<void> {
  await supabase.from('documents').delete().eq('id', id)
}

// ─── Contract Reviews ────────────────────────────────────────────────────────
export async function getContractReviews(): Promise<ContractReview[]> {
  const { data } = await supabase
    .from('contract_reviews')
    .select('*, document:documents(*, client:clients(*))')
    .order('created_at', { ascending: false })
  return (data ?? []) as unknown as ContractReview[]
}

export async function createContractReview(review: Omit<ContractReview, 'id' | 'document'>): Promise<ContractReview | null> {
  const { data } = await supabase.from('contract_reviews').insert({ ...review, id: `cr${Date.now()}` }).select().single()
  return data as ContractReview | null
}

export async function updateContractReview(id: string, updates: Partial<ContractReview>): Promise<void> {
  await supabase.from('contract_reviews').update(updates).eq('id', id)
}

// ─── Matters ─────────────────────────────────────────────────────────────────
export async function getMatters(): Promise<Matter[]> {
  const { data } = await supabase
    .from('matters')
    .select(`*, client:clients(*), practice_area:practice_areas(*), assigned_user:users!matters_assigned_to_fkey(${USER_PUBLIC})`)
    .order('created_at', { ascending: false })
  return (data ?? []) as unknown as Matter[]
}

export async function createMatter(matter: Omit<Matter, 'id' | 'client' | 'practice_area' | 'assigned_user'>): Promise<Matter | null> {
  const { data } = await supabase.from('matters').insert({ ...matter, id: `m${Date.now()}` }).select().single()
  return data as Matter | null
}

export async function updateMatter(id: string, updates: Partial<Matter>): Promise<void> {
  const { client: _c, practice_area: _pa, assigned_user: _au, ...cols } = updates as Partial<Matter> & Record<string, unknown>
  void _c; void _pa; void _au
  await supabase.from('matters').update({ ...cols, updated_at: now() }).eq('id', id)
}

export async function deleteMatter(id: string): Promise<void> {
  await supabase.from('matters').delete().eq('id', id)
}

export async function incrementMatterDeadline(id: string, onTime: boolean): Promise<void> {
  const { data } = await supabase.from('matters').select('deadlines_total, deadlines_ontime').eq('id', id).maybeSingle()
  const row = (data ?? {}) as { deadlines_total?: number; deadlines_ontime?: number }
  await supabase.from('matters').update({
    deadlines_total: (row.deadlines_total ?? 0) + 1,
    deadlines_ontime: (row.deadlines_ontime ?? 0) + (onTime ? 1 : 0),
    updated_at: now(),
  }).eq('id', id)
}

// ─── Matter Events ───────────────────────────────────────────────────────────
export async function getMatterEvents(matter_id?: string): Promise<MatterEvent[]> {
  let query = supabase.from('matter_events').select('*').order('event_date', { ascending: false })
  if (matter_id) query = query.eq('matter_id', matter_id)
  const { data } = await query
  return (data ?? []) as MatterEvent[]
}

export async function createMatterEvent(event: Omit<MatterEvent, 'id' | 'created_at'>): Promise<MatterEvent | null> {
  const { data } = await supabase.from('matter_events').insert({ ...event, id: `me${Date.now()}` }).select().single()
  return data as MatterEvent | null
}

// ─── Due Diligence ───────────────────────────────────────────────────────────
export async function getDueDiligenceProjects(): Promise<DueDiligenceProject[]> {
  const { data } = await supabase
    .from('due_diligence_projects')
    .select(`*, client:clients(*), lead_user:users!due_diligence_projects_lead_partner_fkey(${USER_PUBLIC})`)
    .order('created_at', { ascending: false })

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
  const { data } = await supabase.from('due_diligence_projects').insert({ ...project, id: `dd${Date.now()}` }).select().single()
  return data as DueDiligenceProject | null
}

export async function updateDueDiligenceProject(id: string, updates: Partial<DueDiligenceProject>): Promise<void> {
  await supabase.from('due_diligence_projects').update({ ...updates, updated_at: now() }).eq('id', id)
}

export async function deleteDueDiligenceProject(id: string): Promise<void> {
  await supabase.from('due_diligence_projects').delete().eq('id', id)
}

export async function getDueDiligenceFindings(project_id?: string): Promise<DueDiligenceFinding[]> {
  let query = supabase.from('due_diligence_findings').select('*').order('created_at', { ascending: false })
  if (project_id) query = query.eq('project_id', project_id)
  const { data } = await query
  return (data ?? []) as DueDiligenceFinding[]
}

export async function createDueDiligenceFinding(finding: Omit<DueDiligenceFinding, 'id' | 'created_at'>): Promise<DueDiligenceFinding | null> {
  const { data } = await supabase.from('due_diligence_findings').insert({ ...finding, id: `ddf${Date.now()}` }).select().single()
  return data as DueDiligenceFinding | null
}

export async function updateDueDiligenceFinding(id: string, updates: Partial<DueDiligenceFinding>): Promise<void> {
  await supabase.from('due_diligence_findings').update(updates).eq('id', id)
}

export async function deleteDueDiligenceFinding(id: string): Promise<void> {
  await supabase.from('due_diligence_findings').delete().eq('id', id)
}

// ─── Compliance ──────────────────────────────────────────────────────────────
export async function getComplianceDiagnostics(): Promise<ComplianceDiagnostic[]> {
  const { data } = await supabase
    .from('compliance_diagnostics')
    .select('*, client:clients(*)')
    .order('created_at', { ascending: false })
  return (data ?? []) as unknown as ComplianceDiagnostic[]
}

export async function createComplianceDiagnostic(diag: Omit<ComplianceDiagnostic, 'id' | 'client'>): Promise<ComplianceDiagnostic | null> {
  const { data } = await supabase.from('compliance_diagnostics').insert({ ...diag, id: `cd${Date.now()}` }).select().single()
  return data as ComplianceDiagnostic | null
}

export async function updateComplianceDiagnostic(id: string, updates: Partial<ComplianceDiagnostic>): Promise<void> {
  await supabase.from('compliance_diagnostics').update(updates).eq('id', id)
}

export async function deleteComplianceDiagnostic(id: string): Promise<void> {
  await supabase.from('compliance_diagnostics').delete().eq('id', id)
}

// ─── HR Tickets ──────────────────────────────────────────────────────────────
export async function getHRTickets(): Promise<HRTicket[]> {
  const { data } = await supabase
    .from('hr_tickets')
    .select('*, client:clients(*)')
    .order('created_at', { ascending: false })
  return (data ?? []) as unknown as HRTicket[]
}

export async function createHRTicket(ticket: Omit<HRTicket, 'id' | 'client'>): Promise<HRTicket | null> {
  const { data } = await supabase.from('hr_tickets').insert({ ...ticket, id: `hr${Date.now()}` }).select().single()
  return data as HRTicket | null
}

export async function updateHRTicket(id: string, updates: Partial<HRTicket>): Promise<void> {
  await supabase.from('hr_tickets').update(updates).eq('id', id)
}

export async function deleteHRTicket(id: string): Promise<void> {
  await supabase.from('hr_tickets').delete().eq('id', id)
}

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

// ─── DGA-Time: registro de horas ──────────────────────────────────────────────
const TIME_JOIN = `*, user:users!time_entries_user_id_fkey(${USER_PUBLIC}), client:clients(*), matter:matters(*)`

export async function getDgatimeEnabledUserIds(): Promise<string[]> {
  const { data } = await supabase.from('users').select('id').eq('dgatime_enabled', true).eq('is_active', true)
  return ((data ?? []) as { id: string }[]).map(u => u.id)
}

export async function getUserRate(userId: string): Promise<{ hourly_rate: number; cost_rate: number; rate_currency: DgaCurrency }> {
  const { data } = await supabase.from('users').select('hourly_rate,cost_rate,rate_currency').eq('id', userId).maybeSingle()
  const row = (data ?? {}) as { hourly_rate?: number | null; cost_rate?: number | null; rate_currency?: DgaCurrency }
  return { hourly_rate: Number(row.hourly_rate ?? 0), cost_rate: Number(row.cost_rate ?? 0), rate_currency: row.rate_currency ?? 'COP' }
}

export async function getTimeEntries(filter?: { user_id?: string }): Promise<TimeEntry[]> {
  let q = supabase.from('time_entries').select(TIME_JOIN)
    .order('date', { ascending: false }).order('created_at', { ascending: false })
  if (filter?.user_id) q = q.eq('user_id', filter.user_id)
  const { data } = await q
  return (data ?? []) as unknown as TimeEntry[]
}

export async function getTimeEntry(id: string): Promise<TimeEntry | null> {
  const { data } = await supabase.from('time_entries').select(TIME_JOIN).eq('id', id).maybeSingle()
  return data as unknown as TimeEntry | null
}

type TimeEntryInsert = Omit<TimeEntry, 'id' | 'user' | 'client' | 'matter' | 'created_at' | 'approved_by' | 'approved_at' | 'invoice_id'>

export async function createTimeEntry(e: TimeEntryInsert): Promise<TimeEntry | null> {
  const { data } = await supabase.from('time_entries').insert({ ...e, id: `te${Date.now()}` }).select(TIME_JOIN).single()
  return data as unknown as TimeEntry | null
}

export async function updateTimeEntry(id: string, updates: Partial<TimeEntry>): Promise<void> {
  const { user: _u, client: _c, matter: _m, ...cols } = updates as Partial<TimeEntry> & Record<string, unknown>
  void _u; void _c; void _m
  await supabase.from('time_entries').update(cols).eq('id', id)
}

export async function deleteTimeEntry(id: string): Promise<void> {
  await supabase.from('time_entries').delete().eq('id', id)
}

// ─── DGA-Time: facturación ────────────────────────────────────────────────────
export async function countInvoices(): Promise<number> {
  const { count } = await supabase.from('invoices').select('id', { count: 'exact', head: true })
  return count ?? 0
}

export async function getInvoices(): Promise<Invoice[]> {
  const { data } = await supabase.from('invoices').select('*, client:clients(*)').order('created_at', { ascending: false })
  return (data ?? []) as unknown as Invoice[]
}

export async function getInvoiceItems(invoice_id: string): Promise<InvoiceItem[]> {
  const { data } = await supabase.from('invoice_items').select('*').eq('invoice_id', invoice_id).order('created_at')
  return (data ?? []) as InvoiceItem[]
}

type InvoiceInsert = Omit<Invoice, 'id' | 'client' | 'items' | 'created_at' | 'updated_at'>
type ItemInsert = Omit<InvoiceItem, 'id' | 'invoice_id' | 'created_at'>

export async function createInvoice(inv: InvoiceInsert, items: ItemInsert[], timeEntryIds: string[]): Promise<Invoice | null> {
  const id = `inv${Date.now()}`
  const { data, error } = await supabase.from('invoices').insert({ ...inv, id }).select('*, client:clients(*)').single()
  if (error || !data) return null
  if (items.length) {
    await supabase.from('invoice_items').insert(items.map((it, i) => ({ ...it, id: `ii${Date.now()}${i}`, invoice_id: id })))
  }
  if (timeEntryIds.length) {
    await supabase.from('time_entries').update({ invoice_id: id, status: 'facturado' }).in('id', timeEntryIds)
  }
  return data as unknown as Invoice
}

export async function updateInvoice(id: string, updates: Partial<Invoice>): Promise<void> {
  const { client: _c, items: _i, ...cols } = updates as Partial<Invoice> & Record<string, unknown>
  void _c; void _i
  await supabase.from('invoices').update({ ...cols, updated_at: now() }).eq('id', id)
}

export async function deleteInvoice(id: string): Promise<void> {
  // Liberar las horas vinculadas (vuelven a estado aprobado, sin factura)
  await supabase.from('time_entries').update({ invoice_id: null, status: 'aprobado' }).eq('invoice_id', id)
  await supabase.from('invoices').delete().eq('id', id) // invoice_items se borran en cascada
}

// ─── DGA-Time: igualas / cobros recurrentes ───────────────────────────────────
export async function getRecurringFees(): Promise<RecurringFee[]> {
  const { data } = await supabase.from('recurring_fees').select('*, client:clients(*)').order('created_at', { ascending: false })
  return (data ?? []) as unknown as RecurringFee[]
}

type RecurringFeeInsert = Omit<RecurringFee, 'id' | 'client' | 'last_generated_period' | 'created_at' | 'updated_at'>

export async function createRecurringFee(fee: RecurringFeeInsert): Promise<RecurringFee | null> {
  const { data } = await supabase.from('recurring_fees').insert({ ...fee, id: `rf${Date.now()}` }).select('*, client:clients(*)').single()
  return data as unknown as RecurringFee | null
}

export async function updateRecurringFee(id: string, updates: Partial<RecurringFee>): Promise<void> {
  const { client: _c, ...cols } = updates as Partial<RecurringFee> & Record<string, unknown>
  void _c
  await supabase.from('recurring_fees').update({ ...cols, updated_at: now() }).eq('id', id)
}

export async function deleteRecurringFee(id: string): Promise<void> {
  await supabase.from('recurring_fees').delete().eq('id', id)
}

// ── Cálculo de períodos (en UTC para evitar desfases de zona horaria) ──
const isoDate = (d: Date) => d.toISOString().slice(0, 10)
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate()

function periodFor(freq: RecurringFrequency, today: Date): { start: Date; end: Date } {
  const y = today.getUTCFullYear()
  const m = today.getUTCMonth()
  if (freq === 'anual') {
    return { start: new Date(Date.UTC(y, 0, 1)), end: new Date(Date.UTC(y, 11, 31)) }
  }
  if (freq === 'trimestral') {
    const qStart = Math.floor(m / 3) * 3
    return { start: new Date(Date.UTC(y, qStart, 1)), end: new Date(Date.UTC(y, qStart + 3, 0)) }
  }
  // mensual
  return { start: new Date(Date.UTC(y, m, 1)), end: new Date(Date.UTC(y, m + 1, 0)) }
}

/**
 * Genera las facturas de igualas/recurrentes que vencen hoy y aún no se han
 * emitido para su período actual. Idempotente: usa last_generated_period.
 * Las facturas se crean en estado 'borrador' para revisión antes de enviarse.
 */
export async function generateDueRecurringFees(todayISO: string): Promise<{ generated: number; details: { number: string; client_id: string; total: number }[] }> {
  const today = new Date(todayISO + 'T00:00:00Z')
  const { data } = await supabase.from('recurring_fees').select('*').eq('active', true)
  const fees = (data ?? []) as RecurringFee[]
  let count = await countInvoices()
  const details: { number: string; client_id: string; total: number }[] = []

  for (const fee of fees) {
    const period = periodFor(fee.frequency, today)
    if (new Date(fee.start_date) > period.end) continue           // aún no inicia
    if (fee.end_date && new Date(fee.end_date) < period.start) continue // ya terminó

    // Día de emisión dentro del período (primer mes del período)
    const ps = period.start
    const due = new Date(Date.UTC(ps.getUTCFullYear(), ps.getUTCMonth(), Math.min(fee.day_of_month, daysInMonth(ps.getUTCFullYear(), ps.getUTCMonth()))))
    if (today < due) continue                                      // aún no es la fecha de emisión

    const periodStartISO = isoDate(period.start)
    if (fee.last_generated_period && fee.last_generated_period >= periodStartISO) continue // ya generada este período

    count += 1
    const number = `DGA-${today.getUTCFullYear()}-${String(count).padStart(4, '0')}`
    const subtotal = Math.round(fee.amount)
    const tax = Math.round(subtotal * (fee.tax_rate / 100))
    const total = subtotal + tax
    const inv = await createInvoice(
      {
        number, client_id: fee.client_id, matter_id: fee.matter_id, type: fee.type,
        status: 'borrador', currency: fee.currency, issue_date: todayISO,
        period_start: periodStartISO, period_end: isoDate(period.end),
        subtotal, tax_rate: fee.tax_rate, tax, total,
        notes: `Generada automáticamente (${fee.frequency}) — ${fee.description}`,
        created_by: fee.created_by,
      },
      [{ description: fee.description || 'Iguala', quantity: 1, unit_rate: subtotal, amount: subtotal, time_entry_id: undefined }],
      []
    )
    if (inv) {
      await updateRecurringFee(fee.id, { last_generated_period: periodStartISO })
      details.push({ number, client_id: fee.client_id, total })
    }
  }
  return { generated: details.length, details }
}

// ─── DGA-Time: captura inteligente (privada por abogado) ──────────────────────
const CAPTURE_JOIN = '*, suggested_client:clients!captured_activities_suggested_client_id_fkey(*), suggested_matter:matters!captured_activities_suggested_matter_id_fkey(*)'

export async function getCapturedActivities(userId: string, statuses?: CaptureStatus[]): Promise<CapturedActivity[]> {
  let q = supabase.from('captured_activities').select(CAPTURE_JOIN).eq('user_id', userId).order('occurred_at', { ascending: false })
  if (statuses && statuses.length) q = q.in('status', statuses)
  const { data } = await q
  return (data ?? []) as unknown as CapturedActivity[]
}

export async function getCapturedActivity(id: string): Promise<CapturedActivity | null> {
  const { data } = await supabase.from('captured_activities').select(CAPTURE_JOIN).eq('id', id).maybeSingle()
  return data as unknown as CapturedActivity | null
}

export async function getExistingCaptureRefs(userId: string): Promise<Set<string>> {
  const { data } = await supabase.from('captured_activities').select('source_kind, source_ref').eq('user_id', userId).not('source_ref', 'is', null)
  const rows = (data ?? []) as { source_kind: string; source_ref: string }[]
  return new Set(rows.map(r => `${r.source_kind}:${r.source_ref}`))
}

type CapturedInsert = Omit<CapturedActivity, 'id' | 'suggested_client' | 'suggested_matter' | 'created_at' | 'time_entry_id'>

export async function insertCapturedActivities(rows: CapturedInsert[]): Promise<number> {
  if (!rows.length) return 0
  const withIds = rows.map((r, i) => ({ ...r, id: `cap${Date.now()}${i}` }))
  const { error } = await supabase.from('captured_activities').insert(withIds)
  return error ? 0 : withIds.length
}

export async function updateCapturedActivity(id: string, updates: Partial<CapturedActivity>): Promise<void> {
  const { suggested_client: _sc, suggested_matter: _sm, ...cols } = updates as Partial<CapturedActivity> & Record<string, unknown>
  void _sc; void _sm
  await supabase.from('captured_activities').update(cols).eq('id', id)
}

// ─── Integraciones OAuth (correo / calendario) ────────────────────────────────
export async function listUserIntegrations(userId: string): Promise<UserIntegration[]> {
  const { data } = await supabase.from('user_integrations')
    .select('user_id, provider, account_email, connected_at, last_sync').eq('user_id', userId)
  return (data ?? []) as UserIntegration[]
}

export async function getIntegrationTokens(userId: string, provider: OAuthProvider): Promise<IntegrationTokens | null> {
  const { data } = await supabase.from('user_integrations')
    .select('access_token, refresh_token, token_expiry').eq('user_id', userId).eq('provider', provider).maybeSingle()
  if (!data) return null
  const row = data as { access_token?: string; refresh_token?: string; token_expiry?: string }
  return { access_token: decryptToken(row.access_token), refresh_token: decryptToken(row.refresh_token), token_expiry: row.token_expiry ?? null }
}

export async function upsertIntegration(userId: string, provider: OAuthProvider, t: {
  account_email?: string | null; access_token: string; refresh_token?: string; token_expiry?: string; scope?: string
}): Promise<void> {
  const row: Record<string, unknown> = {
    user_id: userId, provider,
    account_email: t.account_email ?? null,
    access_token: encryptToken(t.access_token),
    token_expiry: t.token_expiry ?? null,
    scope: t.scope ?? null,
    connected_at: now(),
  }
  if (t.refresh_token) row.refresh_token = encryptToken(t.refresh_token)
  await supabase.from('user_integrations').upsert(row, { onConflict: 'user_id,provider' })
}

export async function updateIntegrationAccess(userId: string, provider: OAuthProvider, accessToken: string, tokenExpiry: string): Promise<void> {
  await supabase.from('user_integrations').update({ access_token: encryptToken(accessToken), token_expiry: tokenExpiry }).eq('user_id', userId).eq('provider', provider)
}

export async function setIntegrationLastSync(userId: string, provider: OAuthProvider, iso: string): Promise<void> {
  await supabase.from('user_integrations').update({ last_sync: iso }).eq('user_id', userId).eq('provider', provider)
}

export async function deleteIntegration(userId: string, provider: OAuthProvider): Promise<void> {
  await supabase.from('user_integrations').delete().eq('user_id', userId).eq('provider', provider)
}

/** Lee la "huella" de trabajo del abogado en la plataforma desde `sinceISO`. */
export async function getUserFootprint(userId: string, sinceISO: string): Promise<FootprintItem[]> {
  const items: FootprintItem[] = []

  const { data: docs } = await supabase
    .from('documents')
    .select('id, name, type, status, client_id, created_at, client:clients(name)')
    .or(`uploaded_by.eq.${userId},reviewed_by.eq.${userId}`)
    .gte('created_at', sinceISO)
  for (const d of (docs ?? []) as { id: string; name: string; type: string; status: string; client_id?: string; created_at: string; client?: { name?: string } }[]) {
    items.push({
      source: 'plataforma', source_kind: 'documento', source_ref: d.id, occurred_at: d.created_at,
      title: `Documento: ${d.name}`,
      context: `Trabajó el documento "${d.name}" (tipo: ${d.type}, estado: ${d.status})${d.client?.name ? ` del cliente ${d.client.name}` : ''}.`,
      client_id: d.client_id, billable: true,
    })
  }

  const { data: reviews } = await supabase
    .from('contract_reviews')
    .select('id, created_at, document:documents(name, client_id, client:clients(name))')
    .eq('reviewed_by', userId)
    .gte('created_at', sinceISO)
  for (const r of (reviews ?? []) as { id: string; created_at: string; document?: { name?: string; client_id?: string; client?: { name?: string } } }[]) {
    items.push({
      source: 'plataforma', source_kind: 'contrato', source_ref: r.id, occurred_at: r.created_at,
      title: `Revisión de contrato${r.document?.name ? `: ${r.document.name}` : ''}`,
      context: `Realizó el análisis/revisión del contrato "${r.document?.name ?? 'documento'}"${r.document?.client?.name ? ` del cliente ${r.document.client.name}` : ''}.`,
      client_id: r.document?.client_id, billable: true,
    })
  }

  const { data: events } = await supabase
    .from('matter_events')
    .select('id, event_type, description, event_date, created_at, matter:matters(id, title, client_id, client:clients(name))')
    .eq('created_by', userId)
    .gte('created_at', sinceISO)
  for (const e of (events ?? []) as { id: string; event_type: string; description: string; event_date?: string; created_at: string; matter?: { id?: string; title?: string; client_id?: string; client?: { name?: string } } }[]) {
    items.push({
      source: 'plataforma', source_kind: 'evento_asunto', source_ref: e.id, occurred_at: e.event_date ?? e.created_at,
      title: `${e.event_type}${e.matter?.title ? ` — ${e.matter.title}` : ''}`,
      context: `Registró la actuación "${e.event_type}" en el asunto "${e.matter?.title ?? ''}"${e.matter?.client?.name ? ` del cliente ${e.matter.client.name}` : ''}. Detalle: ${e.description}`,
      client_id: e.matter?.client_id, matter_id: e.matter?.id, billable: true,
    })
  }

  return items
}
