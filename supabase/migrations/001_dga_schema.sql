-- DG&A Legal Intelligence Desk — Supabase Schema
-- Run this migration on your Supabase project

-- Practice Areas
CREATE TABLE IF NOT EXISTS practice_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE
);

-- Clients
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  nit TEXT,
  sector TEXT,
  contact_name TEXT,
  contact_email TEXT,
  assigned_partner UUID,
  risk_level TEXT CHECK (risk_level IN ('bajo', 'medio', 'alto', 'crítico')) DEFAULT 'bajo',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT CHECK (role IN ('socio', 'asociado', 'cliente', 'admin')) NOT NULL,
  client_id UUID REFERENCES clients(id),
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE clients ADD CONSTRAINT clients_assigned_partner_fkey
  FOREIGN KEY (assigned_partner) REFERENCES users(id);

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT,
  published_at DATE,
  practice_area_id UUID REFERENCES practice_areas(id),
  impact_level TEXT CHECK (impact_level IN ('bajo', 'medio', 'alto', 'crítico')) NOT NULL,
  summary TEXT,
  recommendation TEXT,
  status TEXT CHECK (status IN ('nueva', 'en_análisis', 'enviada_cliente', 'archivada')) DEFAULT 'nueva',
  assigned_to UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Client Alerts
CREATE TABLE IF NOT EXISTS client_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES alerts(id),
  client_id UUID REFERENCES clients(id),
  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES users(id),
  notes TEXT
);

-- Legal Notes
CREATE TABLE IF NOT EXISTS legal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  alert_id UUID REFERENCES alerts(id),
  practice_area_id UUID REFERENCES practice_areas(id),
  audience TEXT CHECK (audience IN ('general', 'junta_directiva', 'rrhh', 'área_legal', 'cumplimiento', 'gerencia_financiera')),
  tone TEXT CHECK (tone IN ('técnico', 'ejecutivo', 'preventivo', 'comercial')),
  content_draft TEXT,
  content_email TEXT,
  content_linkedin TEXT,
  content_summary TEXT,
  status TEXT CHECK (status IN ('borrador_ia', 'en_revisión', 'aprobado', 'publicado', 'rechazado')) DEFAULT 'borrador_ia',
  author_id UUID REFERENCES users(id),
  reviewer_id UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  reviewer_comments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('contrato_comercial', 'contrato_laboral', 'nda', 'distribucion', 'franquicia', 'inmobiliario', 'servicios', 'societario', 'mna', 'habeas_data', 'sagrilaft', 'ptee', 'otro')),
  client_id UUID REFERENCES clients(id),
  practice_area_id UUID REFERENCES practice_areas(id),
  file_url TEXT,
  content_text TEXT,
  status TEXT CHECK (status IN ('pendiente', 'en_revisión', 'revisado', 'aprobado', 'archivado')) DEFAULT 'pendiente',
  uploaded_by UUID REFERENCES users(id),
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contract Reviews
CREATE TABLE IF NOT EXISTS contract_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id),
  parties TEXT,
  object TEXT,
  obligations TEXT,
  deadlines TEXT,
  critical_dates TEXT,
  risks JSONB,
  omissions TEXT,
  recommendations TEXT,
  client_questions TEXT,
  status TEXT CHECK (status IN ('borrador_ia', 'en_revisión', 'aprobado')) DEFAULT 'borrador_ia',
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Due Diligence Projects
CREATE TABLE IF NOT EXISTS due_diligence_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('mna', 'inmobiliario', 'corporativo')),
  status TEXT CHECK (status IN ('activo', 'en_pausa', 'completado', 'cancelado')) DEFAULT 'activo',
  lead_partner UUID REFERENCES users(id),
  risk_summary TEXT,
  executive_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Due Diligence Findings
CREATE TABLE IF NOT EXISTS due_diligence_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES due_diligence_projects(id),
  category TEXT CHECK (category IN ('societario', 'contratos', 'laboral', 'tributario', 'litigios', 'inmobiliario', 'propiedad_intelectual', 'consumidor', 'datos_personales', 'compliance', 'ambiental_esg')),
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT CHECK (severity IN ('bajo', 'medio', 'alto', 'crítico')),
  status TEXT CHECK (status IN ('pendiente', 'validado_asociado', 'requiere_socio', 'en_informe', 'cerrado')) DEFAULT 'pendiente',
  assigned_to UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Matters
CREATE TABLE IF NOT EXISTS matters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  practice_area_id UUID REFERENCES practice_areas(id),
  title TEXT NOT NULL,
  type TEXT CHECK (type IN ('litigio', 'consultoría', 'transaccional', 'compliance', 'regulatorio')),
  jurisdiction TEXT,
  parties TEXT,
  process_state TEXT,
  estimated_risk TEXT,
  success_probability INTEGER CHECK (success_probability BETWEEN 0 AND 100),
  next_action TEXT,
  next_deadline DATE,
  status TEXT CHECK (status IN ('activo', 'en_pausa', 'cerrado', 'archivado')) DEFAULT 'activo',
  assigned_to UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Matter Events
CREATE TABLE IF NOT EXISTS matter_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID REFERENCES matters(id),
  event_date DATE NOT NULL,
  event_type TEXT,
  description TEXT,
  document_id UUID REFERENCES documents(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compliance Diagnostics
CREATE TABLE IF NOT EXISTS compliance_diagnostics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  type TEXT CHECK (type IN ('sagrilaft', 'ptee', 'habeas_data')),
  responses JSONB,
  risk_matrix JSONB,
  implementation_status TEXT CHECK (implementation_status IN ('no_iniciado', 'en_progreso', 'completado')) DEFAULT 'no_iniciado',
  completion_pct INTEGER DEFAULT 0,
  assigned_to UUID REFERENCES users(id),
  last_review DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Copilot Sessions
CREATE TABLE IF NOT EXISTS copilot_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  client_id UUID REFERENCES clients(id),
  messages JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  document_source TEXT,
  version TEXT,
  approver_id UUID REFERENCES users(id),
  client_id UUID REFERENCES clients(id),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HR Tickets
CREATE TABLE IF NOT EXISTS hr_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  topic TEXT,
  question TEXT,
  ai_response TEXT,
  status TEXT CHECK (status IN ('abierto', 'en_revisión', 'respondido', 'cerrado')) DEFAULT 'abierto',
  sensitivity_flag BOOLEAN DEFAULT FALSE,
  assigned_to UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE matters ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE due_diligence_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE due_diligence_findings ENABLE ROW LEVEL SECURITY;

-- Internal staff see everything
CREATE POLICY "Internal staff full access to clients" ON clients
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('socio', 'asociado', 'admin'))
  );

-- Clients see only their own data
CREATE POLICY "Clients see own data" ON clients
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'cliente' AND client_id = clients.id)
  );

CREATE POLICY "Internal staff full access to alerts" ON alerts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('socio', 'asociado', 'admin'))
  );

CREATE POLICY "Internal staff full access to documents" ON documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('socio', 'asociado', 'admin'))
  );

CREATE POLICY "Clients see own documents" ON documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'cliente' AND client_id = documents.client_id)
  );

CREATE POLICY "Internal staff full access to matters" ON matters
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('socio', 'asociado', 'admin'))
  );

CREATE POLICY "Clients see own matters" ON matters
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'cliente' AND client_id = matters.client_id)
  );
