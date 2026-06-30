import { supabase, now, USER_PUBLIC } from './_shared'
import type {
  Document, ContractReview, Matter, MatterEvent,
  DueDiligenceProject, DueDiligenceFinding, ComplianceDiagnostic, HRTicket,
} from '@/shared/types'

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
