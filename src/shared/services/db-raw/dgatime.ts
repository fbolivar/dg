import { supabase, now, USER_PUBLIC } from './_shared'
import type {
  TimeEntry, Invoice, InvoiceItem, DgaCurrency, RecurringFee, RecurringFrequency,
  CapturedActivity, CaptureStatus,
} from '@/shared/types'

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
