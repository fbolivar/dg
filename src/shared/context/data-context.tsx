"use client"
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import * as db from '@/shared/services/db'
import type {
  Client, User, PracticeArea, Alert, LegalNote, Document,
  ContractReview, DueDiligenceProject, DueDiligenceFinding,
  Matter, MatterEvent, ComplianceDiagnostic, HRTicket,
  JudicialProcess, JudicialActuacion
} from '@/shared/types'

type DataState = {
  clients: Client[]
  users: User[]
  practiceAreas: PracticeArea[]
  alerts: Alert[]
  legalNotes: LegalNote[]
  documents: Document[]
  contractReviews: ContractReview[]
  matters: Matter[]
  matterEvents: MatterEvent[]
  dueDiligenceProjects: DueDiligenceProject[]
  dueDiligenceFindings: DueDiligenceFinding[]
  complianceDiagnostics: ComplianceDiagnostic[]
  hrTickets: HRTicket[]
  judicialProcesses: JudicialProcess[]
  judicialActuaciones: JudicialActuacion[]
  loading: boolean
  error: boolean
  reload: () => Promise<void>
  refresh: (table: string) => Promise<void>
}

const DataContext = createContext<DataState | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [practiceAreas, setPracticeAreas] = useState<PracticeArea[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [legalNotes, setLegalNotes] = useState<LegalNote[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [contractReviews, setContractReviews] = useState<ContractReview[]>([])
  const [matters, setMatters] = useState<Matter[]>([])
  const [matterEvents, setMatterEvents] = useState<MatterEvent[]>([])
  const [dueDiligenceProjects, setDueDiligenceProjects] = useState<DueDiligenceProject[]>([])
  const [dueDiligenceFindings, setDueDiligenceFindings] = useState<DueDiligenceFinding[]>([])
  const [complianceDiagnostics, setComplianceDiagnostics] = useState<ComplianceDiagnostic[]>([])
  const [hrTickets, setHRTickets] = useState<HRTicket[]>([])
  const [judicialProcesses, setJudicialProcesses] = useState<JudicialProcess[]>([])
  const [judicialActuaciones, setJudicialActuaciones] = useState<JudicialActuacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const refresh = useCallback(async (table: string) => {
    switch (table) {
      case 'clients': setClients(await db.getClients()); break
      case 'practice_areas': setPracticeAreas(await db.getPracticeAreas()); break
      case 'users': setUsers(await db.getUsers()); break
      case 'alerts': setAlerts(await db.getAlerts()); break
      case 'legal_notes': setLegalNotes(await db.getLegalNotes()); break
      case 'documents': setDocuments(await db.getDocuments()); break
      case 'contract_reviews': setContractReviews(await db.getContractReviews()); break
      case 'matters': setMatters(await db.getMatters()); break
      case 'matter_events': setMatterEvents(await db.getMatterEvents()); break
      case 'due_diligence_projects': setDueDiligenceProjects(await db.getDueDiligenceProjects()); break
      case 'due_diligence_findings': setDueDiligenceFindings(await db.getDueDiligenceFindings()); break
      case 'compliance_diagnostics': setComplianceDiagnostics(await db.getComplianceDiagnostics()); break
      case 'hr_tickets': setHRTickets(await db.getHRTickets()); break
      case 'judicial_processes': setJudicialProcesses(await db.getJudicialProcesses()); break
      case 'judicial_actuaciones': setJudicialActuaciones(await db.getJudicialActuaciones()); break
    }
  }, [])

  // Tablas pesadas/voluminosas que solo se usan en vistas de detalle
  // (timeline de actuaciones de un asunto, actuaciones de un proceso). Se cargan
  // en segundo plano para no bloquear la primera interacción.
  const loadDeferred = useCallback(async () => {
    const [me, ja] = await Promise.all([
      db.getMatterEvents(),
      db.getJudicialActuaciones(),
    ])
    setMatterEvents(me)
    setJudicialActuaciones(ja)
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      // Fase 1 (bloqueante): lo que necesita la mayoría de páginas y KPIs.
      const [
        c, u, pa, a, ln, d, cr, m, dd, ddf, comp, hr, jp
      ] = await Promise.all([
        db.getClients(),
        db.getUsers(),
        db.getPracticeAreas(),
        db.getAlerts(),
        db.getLegalNotes(),
        db.getDocuments(),
        db.getContractReviews(),
        db.getMatters(),
        db.getDueDiligenceProjects(),
        db.getDueDiligenceFindings(),
        db.getComplianceDiagnostics(),
        db.getHRTickets(),
        db.getJudicialProcesses(),
      ])
      setClients(c)
      setUsers(u)
      setPracticeAreas(pa)
      setAlerts(a)
      setLegalNotes(ln)
      setDocuments(d)
      setContractReviews(cr)
      setMatters(m)
      setDueDiligenceProjects(dd)
      setDueDiligenceFindings(ddf)
      setComplianceDiagnostics(comp)
      setHRTickets(hr)
      setJudicialProcesses(jp)
    } catch (e) {
      // Una sola tabla que falle no debe dejar la app congelada en el spinner:
      // marcamos error para que DataGate muestre un reintento.
      console.error('Error cargando datos del proyecto:', e)
      setError(true)
      setLoading(false)
      return
    }
    // La UI ya es usable: liberamos el gate y traemos lo diferido en segundo plano.
    setLoading(false)
    loadDeferred().catch(e => console.error('Error cargando datos diferidos:', e))
  }, [loadDeferred])

  useEffect(() => {
    reload()
  }, [reload])

  return (
    <DataContext.Provider value={{
      clients, users, practiceAreas, alerts, legalNotes, documents,
      contractReviews, matters, matterEvents, dueDiligenceProjects,
      dueDiligenceFindings, complianceDiagnostics, hrTickets,
      judicialProcesses, judicialActuaciones, loading, error, reload, refresh,
    }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
