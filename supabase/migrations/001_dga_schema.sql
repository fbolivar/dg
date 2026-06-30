-- ════════════════════════════════════════════════════════════════════════════
-- DG&A Legal Intelligence Desk — Esquema autoritativo de Supabase
-- ════════════════════════════════════════════════════════════════════════════
-- REGENERADO 2026-06-30 desde la base de datos en PRODUCCIÓN (proyecto
-- `dga-legal` = kbjihgmpmfccpmhbotys, región sa-east-1) para que coincida 1:1
-- con el estado real. La versión anterior de este archivo estaba desincronizada
-- (faltaban 9 tablas, las columnas nuevas de `users`, y usaba text+CHECK en vez
-- de tipos ENUM). Aplicar este script a una base limpia reproduce producción.
--
-- Notas de arquitectura:
--   • Los IDs son TEXT (la app genera ids tipo `u<timestamp>`), salvo audit_log
--     que usa una identidad bigint.
--   • RLS está HABILITADO en todas las tablas pero SIN políticas: el acceso es
--     exclusivamente vía service role (servidor), que ignora RLS. Esto deja
--     deny-by-default para cualquier conexión no privilegiada (anon/authenticated).
--   • Idempotente: enums con guarda, tablas IF NOT EXISTS, FKs/índices guardados.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Tipos ENUM ──────────────────────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE alert_status AS ENUM ('nueva','en_análisis','enviada_cliente','archivada'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE compliance_type AS ENUM ('sagrilaft','ptee','habeas_data'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE dd_status AS ENUM ('activo','en_pausa','completado','cancelado'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE dd_type AS ENUM ('mna','inmobiliario','corporativo'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE dgatime_capture_status AS ENUM ('sugerida','aprobada','descartada'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE dgatime_currency AS ENUM ('COP','USD'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE dgatime_entry_status AS ENUM ('borrador','aprobado','rechazado','facturado'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE dgatime_frequency AS ENUM ('mensual','trimestral','anual'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE dgatime_invoice_status AS ENUM ('borrador','enviada','pagada','anulada'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE dgatime_invoice_type AS ENUM ('horas','fijo','hito','iguala','recurrente'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE document_status AS ENUM ('pendiente','en_revisión','revisado','aprobado','archivado'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE hr_status AS ENUM ('abierto','en_revisión','respondido','cerrado'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE impact_level AS ENUM ('bajo','medio','alto','crítico'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE implementation_status AS ENUM ('no_iniciado','en_progreso','completado'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE matter_outcome AS ENUM ('en_curso','ganado','perdido','desistido'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE matter_status AS ENUM ('activo','en_pausa','cerrado','archivado'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE matter_type AS ENUM ('litigio','consultoría','transaccional','compliance','regulatorio'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE note_status AS ENUM ('borrador_ia','en_revisión','aprobado','publicado','rechazado'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE process_status AS ENUM ('activo','terminado','suspendido','archivado'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE risk_level AS ENUM ('bajo','medio','alto','crítico'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE severity AS ENUM ('bajo','medio','alto','crítico'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE sync_status AS ENUM ('sincronizado','pendiente','error'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('socio','asociado','cliente','admin'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─── Tablas ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS practice_areas (
  id text PRIMARY KEY,
  name text NOT NULL,
  code text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clients (
  id text PRIMARY KEY,
  name text NOT NULL,
  nit text NOT NULL,
  sector text NOT NULL,
  contact_name text,
  contact_email text,
  assigned_partner text,
  risk_level risk_level DEFAULT 'bajo'::risk_level,
  is_active boolean DEFAULT true,
  asuntos_activos integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  role user_role DEFAULT 'asociado'::user_role,
  client_id text,
  avatar_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  password_hash text,
  dgatime_enabled boolean NOT NULL DEFAULT false,
  hourly_rate numeric(14,2),
  rate_currency dgatime_currency NOT NULL DEFAULT 'COP'::dgatime_currency,
  cost_rate numeric(14,2)
);

CREATE TABLE IF NOT EXISTS alerts (
  id text PRIMARY KEY,
  title text NOT NULL,
  source text NOT NULL,
  source_url text,
  published_at timestamptz DEFAULT now(),
  practice_area_id text,
  impact_level impact_level DEFAULT 'medio'::impact_level,
  summary text,
  recommendation text,
  status alert_status DEFAULT 'nueva'::alert_status,
  assigned_to text,
  clients_affected text[] DEFAULT '{}'::text[],
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS legal_notes (
  id text PRIMARY KEY,
  title text NOT NULL,
  alert_id text,
  practice_area_id text,
  audience text,
  tone text,
  content_draft text,
  content_email text,
  content_linkedin text,
  content_summary text,
  status note_status DEFAULT 'borrador_ia'::note_status,
  author_id text,
  reviewer_id text,
  approved_by text,
  approved_at timestamptz,
  reviewer_comments text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id text PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL,
  client_id text,
  practice_area_id text,
  file_url text,
  content_text text,
  status document_status DEFAULT 'pendiente'::document_status,
  uploaded_by text,
  reviewed_by text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contract_reviews (
  id text PRIMARY KEY,
  document_id text,
  parties text,
  object text,
  obligations text,
  deadlines text,
  critical_dates text,
  risks jsonb DEFAULT '[]'::jsonb,
  omissions text,
  recommendations text,
  client_questions text,
  status text DEFAULT 'borrador_ia'::text,
  reviewed_by text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS due_diligence_projects (
  id text PRIMARY KEY,
  client_id text,
  name text NOT NULL,
  type dd_type NOT NULL,
  status dd_status DEFAULT 'activo'::dd_status,
  lead_partner text,
  risk_summary text,
  executive_summary text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS due_diligence_findings (
  id text PRIMARY KEY,
  project_id text,
  category text NOT NULL,
  title text NOT NULL,
  description text,
  severity severity DEFAULT 'medio'::severity,
  status text DEFAULT 'pendiente'::text,
  assigned_to text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS matters (
  id text PRIMARY KEY,
  client_id text,
  practice_area_id text,
  title text NOT NULL,
  type matter_type NOT NULL,
  jurisdiction text,
  parties text,
  process_state text,
  estimated_risk text,
  success_probability integer,
  next_action text,
  next_deadline timestamptz,
  status matter_status DEFAULT 'activo'::matter_status,
  assigned_to text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  budget_amount numeric(14,2),
  budget_hours numeric(8,2),
  budget_currency dgatime_currency,
  deadlines_total integer NOT NULL DEFAULT 0,
  deadlines_ontime integer NOT NULL DEFAULT 0,
  outcome matter_outcome NOT NULL DEFAULT 'en_curso'::matter_outcome,
  satisfaction integer
);

CREATE TABLE IF NOT EXISTS matter_events (
  id text PRIMARY KEY,
  matter_id text,
  event_date timestamptz NOT NULL,
  event_type text NOT NULL,
  description text NOT NULL,
  document_id text,
  created_by text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compliance_diagnostics (
  id text PRIMARY KEY,
  client_id text,
  type compliance_type NOT NULL,
  responses jsonb DEFAULT '{}'::jsonb,
  risk_matrix jsonb DEFAULT '{}'::jsonb,
  implementation_status implementation_status DEFAULT 'no_iniciado'::implementation_status,
  completion_pct integer DEFAULT 0,
  assigned_to text,
  last_review timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hr_tickets (
  id text PRIMARY KEY,
  client_id text,
  topic text NOT NULL,
  question text NOT NULL,
  ai_response text,
  status hr_status DEFAULT 'abierto'::hr_status,
  sensitivity_flag boolean DEFAULT false,
  assigned_to text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS judicial_processes (
  id text PRIMARY KEY,
  numero_radicacion text NOT NULL,
  client_id text NOT NULL,
  matter_id text,
  despacho text NOT NULL DEFAULT ''::text,
  departamento text NOT NULL DEFAULT ''::text,
  tipo_proceso text NOT NULL DEFAULT ''::text,
  clase_proceso text,
  ponente text,
  demandante text NOT NULL DEFAULT ''::text,
  demandado text NOT NULL DEFAULT ''::text,
  fecha_radicacion text,
  ultima_actuacion text,
  fecha_ultima_actuacion text,
  proxima_audiencia text,
  status process_status NOT NULL DEFAULT 'activo'::process_status,
  sync_status sync_status NOT NULL DEFAULT 'pendiente'::sync_status,
  last_sync timestamptz,
  actuaciones_count integer NOT NULL DEFAULT 0,
  new_actuaciones integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS judicial_actuaciones (
  id text PRIMARY KEY,
  process_id text NOT NULL,
  fecha text,
  actuacion text NOT NULL DEFAULT ''::text,
  anotacion text,
  inicia_termino text,
  finaliza_termino text,
  is_new boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_sources (
  id text PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS time_entries (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  client_id text NOT NULL,
  matter_id text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  minutes integer NOT NULL DEFAULT 0,
  activity text NOT NULL DEFAULT ''::text,
  description text NOT NULL DEFAULT ''::text,
  billable boolean NOT NULL DEFAULT true,
  rate numeric(14,2) NOT NULL DEFAULT 0,
  currency dgatime_currency NOT NULL DEFAULT 'COP'::dgatime_currency,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  status dgatime_entry_status NOT NULL DEFAULT 'borrador'::dgatime_entry_status,
  approved_by text,
  approved_at timestamptz,
  invoice_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  cost numeric(14,2) NOT NULL DEFAULT 0,
  cost_amount numeric(14,2) NOT NULL DEFAULT 0,
  rework boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS invoices (
  id text PRIMARY KEY,
  number text NOT NULL,
  client_id text NOT NULL,
  matter_id text,
  type dgatime_invoice_type NOT NULL DEFAULT 'horas'::dgatime_invoice_type,
  status dgatime_invoice_status NOT NULL DEFAULT 'borrador'::dgatime_invoice_status,
  currency dgatime_currency NOT NULL DEFAULT 'COP'::dgatime_currency,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  period_start date,
  period_end date,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,2) NOT NULL DEFAULT 0,
  tax numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id text PRIMARY KEY,
  invoice_id text NOT NULL,
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_rate numeric(14,2) NOT NULL DEFAULT 0,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  time_entry_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recurring_fees (
  id text PRIMARY KEY,
  client_id text NOT NULL,
  matter_id text,
  type dgatime_invoice_type NOT NULL DEFAULT 'iguala'::dgatime_invoice_type,
  description text NOT NULL DEFAULT ''::text,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  currency dgatime_currency NOT NULL DEFAULT 'COP'::dgatime_currency,
  tax_rate numeric(5,2) NOT NULL DEFAULT 0,
  frequency dgatime_frequency NOT NULL DEFAULT 'mensual'::dgatime_frequency,
  day_of_month integer NOT NULL DEFAULT 1,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  active boolean NOT NULL DEFAULT true,
  last_generated_period date,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS captured_activities (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  source text NOT NULL DEFAULT 'plataforma'::text,
  source_kind text NOT NULL DEFAULT ''::text,
  source_ref text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL DEFAULT ''::text,
  context text NOT NULL DEFAULT ''::text,
  suggested_client_id text,
  suggested_matter_id text,
  suggested_activity text NOT NULL DEFAULT 'Gestión'::text,
  suggested_glosa text NOT NULL DEFAULT ''::text,
  suggested_minutes integer NOT NULL DEFAULT 30,
  suggested_billable boolean NOT NULL DEFAULT true,
  confidence text NOT NULL DEFAULT 'medio'::text,
  status dgatime_capture_status NOT NULL DEFAULT 'sugerida'::dgatime_capture_status,
  time_entry_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_integrations (
  user_id text NOT NULL,
  provider text NOT NULL,
  account_email text,
  access_token text,
  refresh_token text,
  token_expiry timestamptz,
  scope text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_sync timestamptz,
  PRIMARY KEY (user_id, provider)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id text,
  actor_name text NOT NULL DEFAULT '—'::text,
  action text NOT NULL,
  entity text,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Claves foráneas (guardadas para idempotencia) ───────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alerts_assigned_to_fkey') THEN ALTER TABLE alerts ADD CONSTRAINT alerts_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES users(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alerts_practice_area_id_fkey') THEN ALTER TABLE alerts ADD CONSTRAINT alerts_practice_area_id_fkey FOREIGN KEY (practice_area_id) REFERENCES practice_areas(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'captured_activities_suggested_client_id_fkey') THEN ALTER TABLE captured_activities ADD CONSTRAINT captured_activities_suggested_client_id_fkey FOREIGN KEY (suggested_client_id) REFERENCES clients(id) ON DELETE SET NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'captured_activities_suggested_matter_id_fkey') THEN ALTER TABLE captured_activities ADD CONSTRAINT captured_activities_suggested_matter_id_fkey FOREIGN KEY (suggested_matter_id) REFERENCES matters(id) ON DELETE SET NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'captured_activities_time_entry_id_fkey') THEN ALTER TABLE captured_activities ADD CONSTRAINT captured_activities_time_entry_id_fkey FOREIGN KEY (time_entry_id) REFERENCES time_entries(id) ON DELETE SET NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'captured_activities_user_id_fkey') THEN ALTER TABLE captured_activities ADD CONSTRAINT captured_activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'compliance_diagnostics_assigned_to_fkey') THEN ALTER TABLE compliance_diagnostics ADD CONSTRAINT compliance_diagnostics_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES users(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'compliance_diagnostics_client_id_fkey') THEN ALTER TABLE compliance_diagnostics ADD CONSTRAINT compliance_diagnostics_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contract_reviews_document_id_fkey') THEN ALTER TABLE contract_reviews ADD CONSTRAINT contract_reviews_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contract_reviews_reviewed_by_fkey') THEN ALTER TABLE contract_reviews ADD CONSTRAINT contract_reviews_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES users(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_client_id_fkey') THEN ALTER TABLE documents ADD CONSTRAINT documents_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_practice_area_id_fkey') THEN ALTER TABLE documents ADD CONSTRAINT documents_practice_area_id_fkey FOREIGN KEY (practice_area_id) REFERENCES practice_areas(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_reviewed_by_fkey') THEN ALTER TABLE documents ADD CONSTRAINT documents_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES users(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_uploaded_by_fkey') THEN ALTER TABLE documents ADD CONSTRAINT documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES users(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'due_diligence_findings_assigned_to_fkey') THEN ALTER TABLE due_diligence_findings ADD CONSTRAINT due_diligence_findings_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES users(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'due_diligence_findings_project_id_fkey') THEN ALTER TABLE due_diligence_findings ADD CONSTRAINT due_diligence_findings_project_id_fkey FOREIGN KEY (project_id) REFERENCES due_diligence_projects(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'due_diligence_projects_client_id_fkey') THEN ALTER TABLE due_diligence_projects ADD CONSTRAINT due_diligence_projects_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'due_diligence_projects_lead_partner_fkey') THEN ALTER TABLE due_diligence_projects ADD CONSTRAINT due_diligence_projects_lead_partner_fkey FOREIGN KEY (lead_partner) REFERENCES users(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_tickets_assigned_to_fkey') THEN ALTER TABLE hr_tickets ADD CONSTRAINT hr_tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES users(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_tickets_client_id_fkey') THEN ALTER TABLE hr_tickets ADD CONSTRAINT hr_tickets_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_items_invoice_id_fkey') THEN ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_client_id_fkey') THEN ALTER TABLE invoices ADD CONSTRAINT invoices_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_created_by_fkey') THEN ALTER TABLE invoices ADD CONSTRAINT invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_matter_id_fkey') THEN ALTER TABLE invoices ADD CONSTRAINT invoices_matter_id_fkey FOREIGN KEY (matter_id) REFERENCES matters(id) ON DELETE SET NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'judicial_actuaciones_process_id_fkey') THEN ALTER TABLE judicial_actuaciones ADD CONSTRAINT judicial_actuaciones_process_id_fkey FOREIGN KEY (process_id) REFERENCES judicial_processes(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'judicial_processes_client_id_fkey') THEN ALTER TABLE judicial_processes ADD CONSTRAINT judicial_processes_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'judicial_processes_matter_id_fkey') THEN ALTER TABLE judicial_processes ADD CONSTRAINT judicial_processes_matter_id_fkey FOREIGN KEY (matter_id) REFERENCES matters(id) ON DELETE SET NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_sources_created_by_fkey') THEN ALTER TABLE knowledge_sources ADD CONSTRAINT knowledge_sources_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legal_notes_alert_id_fkey') THEN ALTER TABLE legal_notes ADD CONSTRAINT legal_notes_alert_id_fkey FOREIGN KEY (alert_id) REFERENCES alerts(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legal_notes_author_id_fkey') THEN ALTER TABLE legal_notes ADD CONSTRAINT legal_notes_author_id_fkey FOREIGN KEY (author_id) REFERENCES users(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legal_notes_practice_area_id_fkey') THEN ALTER TABLE legal_notes ADD CONSTRAINT legal_notes_practice_area_id_fkey FOREIGN KEY (practice_area_id) REFERENCES practice_areas(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legal_notes_reviewer_id_fkey') THEN ALTER TABLE legal_notes ADD CONSTRAINT legal_notes_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES users(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'matter_events_created_by_fkey') THEN ALTER TABLE matter_events ADD CONSTRAINT matter_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'matter_events_document_id_fkey') THEN ALTER TABLE matter_events ADD CONSTRAINT matter_events_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'matter_events_matter_id_fkey') THEN ALTER TABLE matter_events ADD CONSTRAINT matter_events_matter_id_fkey FOREIGN KEY (matter_id) REFERENCES matters(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'matters_assigned_to_fkey') THEN ALTER TABLE matters ADD CONSTRAINT matters_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES users(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'matters_client_id_fkey') THEN ALTER TABLE matters ADD CONSTRAINT matters_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'matters_practice_area_id_fkey') THEN ALTER TABLE matters ADD CONSTRAINT matters_practice_area_id_fkey FOREIGN KEY (practice_area_id) REFERENCES practice_areas(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recurring_fees_client_id_fkey') THEN ALTER TABLE recurring_fees ADD CONSTRAINT recurring_fees_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recurring_fees_created_by_fkey') THEN ALTER TABLE recurring_fees ADD CONSTRAINT recurring_fees_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recurring_fees_matter_id_fkey') THEN ALTER TABLE recurring_fees ADD CONSTRAINT recurring_fees_matter_id_fkey FOREIGN KEY (matter_id) REFERENCES matters(id) ON DELETE SET NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'time_entries_approved_by_fkey') THEN ALTER TABLE time_entries ADD CONSTRAINT time_entries_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'time_entries_client_id_fkey') THEN ALTER TABLE time_entries ADD CONSTRAINT time_entries_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'time_entries_invoice_id_fkey') THEN ALTER TABLE time_entries ADD CONSTRAINT time_entries_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'time_entries_matter_id_fkey') THEN ALTER TABLE time_entries ADD CONSTRAINT time_entries_matter_id_fkey FOREIGN KEY (matter_id) REFERENCES matters(id) ON DELETE SET NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'time_entries_user_id_fkey') THEN ALTER TABLE time_entries ADD CONSTRAINT time_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_integrations_user_id_fkey') THEN ALTER TABLE user_integrations ADD CONSTRAINT user_integrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_client_id_fkey') THEN ALTER TABLE users ADD CONSTRAINT users_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id); END IF;
END $$;

-- ─── Índices ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_captured_user_status ON captured_activities USING btree (user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_captured_source ON captured_activities USING btree (user_id, source_kind, source_ref) WHERE (source_ref IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items USING btree (invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices USING btree (status);
CREATE INDEX IF NOT EXISTS idx_judicial_actuaciones_process ON judicial_actuaciones USING btree (process_id);
CREATE INDEX IF NOT EXISTS idx_judicial_processes_client ON judicial_processes USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_recurring_fees_active ON recurring_fees USING btree (active);
CREATE INDEX IF NOT EXISTS idx_time_entries_client ON time_entries USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_status ON time_entries USING btree (status);
CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries USING btree (user_id);

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- RLS habilitado SIN políticas: deny-by-default para roles anon/authenticated.
-- Todo el acceso de la app es vía service role (servidor), que ignora RLS. La
-- autorización real y el aislamiento multi-tenant por client_id se aplican en la
-- capa de servicios del servidor (src/shared/services/db.ts).
ALTER TABLE practice_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE due_diligence_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE due_diligence_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE matters ENABLE ROW LEVEL SECURITY;
ALTER TABLE matter_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE judicial_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE judicial_actuaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE captured_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
