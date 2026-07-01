"use server"
// ─── Capa de datos AUTORIZADA — DGA-Time (Server Actions) ─────────────────────
import * as raw from '@/shared/services/db-raw'
import { captureForUser, addManualCaptureForUser } from '@/shared/services/capture'
import { providerConfigured } from '@/shared/lib/oauth'
import { requireSession, isManager, requireManager, requireDgatime } from './_guards'
import type {
  TimeEntry, Invoice, InvoiceItem, InvoiceType, InvoiceStatus, DgaCurrency,
  RecurringFee, RecurringFrequency, CapturedActivity, ProviderStatus,
} from '@/shared/types'

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
