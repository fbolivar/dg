export type UserRole = 'socio' | 'asociado' | 'cliente' | 'admin'
export type RiskLevel = 'bajo' | 'medio' | 'alto' | 'crítico'
export type ImpactLevel = 'bajo' | 'medio' | 'alto' | 'crítico'
export type AlertStatus = 'nueva' | 'en_análisis' | 'enviada_cliente' | 'archivada'
export type DocumentStatus = 'pendiente' | 'en_revisión' | 'revisado' | 'aprobado' | 'archivado'
export type NoteStatus = 'borrador_ia' | 'en_revisión' | 'aprobado' | 'publicado' | 'rechazado'
export type MatterStatus = 'activo' | 'en_pausa' | 'cerrado' | 'archivado'
export type Severity = 'bajo' | 'medio' | 'alto' | 'crítico'

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

export interface CopilotMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: string[]
  confidence?: 'alto' | 'medio' | 'bajo'
  requires_review?: boolean
  timestamp: string
}
