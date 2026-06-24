export type UserRole = 'socio' | 'asociado' | 'cliente' | 'admin'
export type RiskLevel = 'bajo' | 'medio' | 'alto' | 'crítico'
export type ImpactLevel = 'bajo' | 'medio' | 'alto' | 'crítico'
export type AlertStatus = 'nueva' | 'en_análisis' | 'enviada_cliente' | 'archivada'
export type DocumentStatus = 'pendiente' | 'en_revisión' | 'revisado' | 'aprobado' | 'archivado'
export type NoteStatus = 'borrador_ia' | 'en_revisión' | 'aprobado' | 'publicado' | 'rechazado'
export type MatterStatus = 'activo' | 'en_pausa' | 'cerrado' | 'archivado'
export type MatterOutcome = 'en_curso' | 'ganado' | 'perdido' | 'desistido'
export type Severity = 'bajo' | 'medio' | 'alto' | 'crítico'

// ─── DGA-Time ────────────────────────────────────────────────────────────────
export type DgaCurrency = 'COP' | 'USD'
export type TimeEntryStatus = 'borrador' | 'aprobado' | 'rechazado' | 'facturado'
export type InvoiceType = 'horas' | 'fijo' | 'hito' | 'iguala' | 'recurrente'
export type InvoiceStatus = 'borrador' | 'enviada' | 'pagada' | 'anulada'
export type RecurringFrequency = 'mensual' | 'trimestral' | 'anual'
export type CaptureStatus = 'sugerida' | 'aprobada' | 'descartada'
export type CaptureConfidence = 'alto' | 'medio' | 'bajo'

export interface Client {
  id: string
  name: string
  nit: string
  sector: string
  contact_name: string
  contact_email: string
  assigned_partner: string
  risk_level: RiskLevel
  is_active: boolean
  created_at: string
  asuntos_activos?: number
}

export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  client_id?: string
  avatar_url?: string
  is_active: boolean
  created_at: string
  dgatime_enabled?: boolean
  hourly_rate?: number
  cost_rate?: number
  rate_currency?: DgaCurrency
}

// Usuario de sesión (autenticación local)
export interface SessionUser {
  id: string
  email: string
  name: string
  role: UserRole
  client_id?: string
  dgatime_enabled?: boolean
}

export interface PracticeArea {
  id: string
  name: string
  code: string
  description: string
  is_active: boolean
}

export interface Alert {
  id: string
  title: string
  source: string
  source_url?: string
  published_at: string
  practice_area_id: string
  practice_area?: PracticeArea
  impact_level: ImpactLevel
  summary: string
  recommendation: string
  status: AlertStatus
  assigned_to?: string
  assigned_user?: User
  created_at: string
  clients_affected?: string[]
}

export interface LegalNote {
  id: string
  title: string
  alert_id?: string
  practice_area_id: string
  practice_area?: PracticeArea
  audience: string
  tone: string
  content_draft?: string
  content_email?: string
  content_linkedin?: string
  content_summary?: string
  status: NoteStatus
  author_id: string
  author?: User
  reviewer_id?: string
  approved_by?: string
  approved_at?: string
  reviewer_comments?: string
  created_at: string
  updated_at: string
}

export interface Document {
  id: string
  name: string
  type: string
  client_id: string
  client?: Client
  practice_area_id?: string
  file_url?: string
  content_text?: string
  status: DocumentStatus
  uploaded_by: string
  reviewed_by?: string
  created_at: string
}

export interface ContractRisk {
  clausula: string
  riesgo: string
  severidad: Severity
  recomendacion: string
  responsable: string
  estado: string
}

export interface ContractReview {
  id: string
  document_id: string
  document?: Document
  parties: string
  object: string
  obligations: string
  deadlines: string
  critical_dates: string
  risks: ContractRisk[]
  omissions: string
  recommendations: string
  client_questions: string
  status: 'borrador_ia' | 'en_revisión' | 'aprobado'
  reviewed_by?: string
  created_at: string
}

export interface DueDiligenceProject {
  id: string
  client_id: string
  client?: Client
  name: string
  type: 'mna' | 'inmobiliario' | 'corporativo'
  status: 'activo' | 'en_pausa' | 'completado' | 'cancelado'
  lead_partner: string
  lead_user?: User
  risk_summary?: string
  executive_summary?: string
  created_at: string
  updated_at: string
  findings_count?: number
  critical_count?: number
}

export interface DueDiligenceFinding {
  id: string
  project_id: string
  category: string
  title: string
  description: string
  severity: Severity
  status: string
  assigned_to?: string
  created_at: string
}

export interface Matter {
  id: string
  client_id: string
  client?: Client
  practice_area_id: string
  practice_area?: PracticeArea
  title: string
  type: 'litigio' | 'consultoría' | 'transaccional' | 'compliance' | 'regulatorio'
  jurisdiction?: string
  parties?: string
  process_state?: string
  estimated_risk?: string
  success_probability?: number
  next_action?: string
  next_deadline?: string
  status: MatterStatus
  assigned_to: string
  assigned_user?: User
  budget_amount?: number
  budget_hours?: number
  budget_currency?: DgaCurrency
  deadlines_total?: number
  deadlines_ontime?: number
  outcome?: MatterOutcome
  satisfaction?: number
  created_at: string
  updated_at: string
}

export interface MatterEvent {
  id: string
  matter_id: string
  event_date: string
  event_type: string
  description: string
  document_id?: string
  created_by: string
  created_at: string
}

export interface ComplianceDiagnostic {
  id: string
  client_id: string
  client?: Client
  type: 'sagrilaft' | 'ptee' | 'habeas_data'
  responses?: Record<string, unknown>
  risk_matrix?: Record<string, unknown>
  implementation_status: 'no_iniciado' | 'en_progreso' | 'completado'
  completion_pct: number
  assigned_to?: string
  last_review?: string
  created_at: string
}

export interface HRTicket {
  id: string
  client_id: string
  client?: Client
  topic: string
  question: string
  ai_response?: string
  status: 'abierto' | 'en_revisión' | 'respondido' | 'cerrado'
  sensitivity_flag: boolean
  assigned_to?: string
  created_at: string
}

// ─── Rama Judicial (integración) ─────────────────────────────────────────────
export type ProcessStatus = 'activo' | 'terminado' | 'suspendido' | 'archivado'
export type SyncStatus = 'sincronizado' | 'pendiente' | 'error'

export interface JudicialActuacion {
  id: string
  process_id: string
  fecha: string                 // fecha de la actuación
  actuacion: string             // nombre de la actuación
  anotacion?: string            // detalle / anotación del despacho
  inicia_termino?: string
  finaliza_termino?: string
  is_new?: boolean              // detectada en el último sondeo
}

export interface JudicialProcess {
  id: string
  numero_radicacion: string     // 23 dígitos
  client_id: string
  client?: Client
  matter_id?: string            // vínculo con asunto interno
  despacho: string
  departamento: string
  tipo_proceso: string          // Ordinario Laboral, Ejecutivo, etc.
  clase_proceso?: string
  ponente?: string
  demandante: string
  demandado: string
  fecha_radicacion: string
  ultima_actuacion?: string
  fecha_ultima_actuacion?: string
  proxima_audiencia?: string
  status: ProcessStatus
  sync_status: SyncStatus
  last_sync?: string
  actuaciones_count?: number
  new_actuaciones?: number      // novedades sin revisar
}

export interface CopilotMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: string[]
  confidence?: 'alto' | 'medio' | 'bajo'
  requires_review?: boolean
  timestamp: string
}

// ─── Auditoría ───────────────────────────────────────────────────────────────
export interface AuditLogEntry {
  id: number
  actor_id?: string
  actor_name: string
  action: string
  entity?: string
  detail?: string
  created_at: string
}

// ─── DGA-Time: registro de horas y facturación ───────────────────────────────
export interface TimeEntry {
  id: string
  user_id: string
  user?: User
  client_id: string
  client?: Client
  matter_id?: string
  matter?: Matter
  date: string
  minutes: number
  activity: string
  description: string
  billable: boolean
  rework?: boolean
  rate: number
  cost?: number
  cost_amount?: number
  currency: DgaCurrency
  amount: number
  status: TimeEntryStatus
  approved_by?: string
  approved_at?: string
  invoice_id?: string
  created_at: string
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  description: string
  quantity: number
  unit_rate: number
  amount: number
  time_entry_id?: string
  created_at?: string
}

export interface Invoice {
  id: string
  number: string
  client_id: string
  client?: Client
  matter_id?: string
  type: InvoiceType
  status: InvoiceStatus
  currency: DgaCurrency
  issue_date: string
  due_date?: string
  period_start?: string
  period_end?: string
  subtotal: number
  tax_rate: number
  tax: number
  total: number
  notes?: string
  created_by?: string
  created_at: string
  updated_at: string
  items?: InvoiceItem[]
}

// Estado de una integración para la UI (sin tokens).
export interface ProviderStatus {
  configured: boolean
  connected: boolean
  account_email?: string
  last_sync?: string
}

// Conexión OAuth de un abogado (correo/calendario). Nunca expone los tokens.
export interface UserIntegration {
  user_id: string
  provider: 'google' | 'microsoft'
  account_email?: string
  connected_at: string
  last_sync?: string
}

// Captura inteligente: actividad detectada + sugerencia de IA (privada por abogado)
export interface CapturedActivity {
  id: string
  user_id: string
  source: string
  source_kind: string
  source_ref?: string
  occurred_at: string
  title: string
  context: string
  suggested_client_id?: string
  suggested_client?: Client
  suggested_matter_id?: string
  suggested_matter?: Matter
  suggested_activity: string
  suggested_glosa: string
  suggested_minutes: number
  suggested_billable: boolean
  confidence: CaptureConfidence
  status: CaptureStatus
  time_entry_id?: string
  created_at: string
}

// Iguala / cobro recurrente (configuración; el cron genera las facturas)
export interface RecurringFee {
  id: string
  client_id: string
  client?: Client
  matter_id?: string
  type: InvoiceType
  description: string
  amount: number
  currency: DgaCurrency
  tax_rate: number
  frequency: RecurringFrequency
  day_of_month: number
  start_date: string
  end_date?: string
  active: boolean
  last_generated_period?: string
  created_by?: string
  created_at: string
  updated_at: string
}
