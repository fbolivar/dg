"use client"
import { useState, useEffect } from 'react'
import { Search, AlertTriangle, Download, FileText, Plus, Pencil, Trash2, AlertCircle, X, PlusCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SeverityBadge } from '@/components/shared/severity-badge'
import { AiDisclaimer } from '@/components/layout/ai-disclaimer'
import { useData } from '@/shared/context/data-context'
import * as db from '@/shared/services/db'
import type { DueDiligenceProject, DueDiligenceFinding, Severity } from '@/shared/types'

const PROJECT_STATUS: Record<string, { label: string; class: string }> = {
  activo: { label: 'Activo', class: 'bg-green-100 text-green-800 border-green-200' },
  en_pausa: { label: 'En pausa', class: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  completado: { label: 'Completado', class: 'bg-blue-100 text-blue-800 border-blue-200' },
  cancelado: { label: 'Cancelado', class: 'bg-gray-100 text-gray-500 border-gray-200' },
}
const FINDING_STATUS_MAP: Record<string, { label: string; class: string }> = {
  pendiente: { label: 'Pendiente', class: 'bg-gray-100 text-gray-700 border-gray-200' },
  validado_asociado: { label: 'Validado', class: 'bg-blue-100 text-blue-800 border-blue-200' },
  requiere_socio: { label: 'Requiere socio', class: 'bg-red-100 text-red-800 border-red-200' },
  en_informe: { label: 'En informe', class: 'bg-purple-100 text-purple-800 border-purple-200' },
  cerrado: { label: 'Cerrado', class: 'bg-green-100 text-green-800 border-green-200' },
}
const CATEGORIES: Record<string, string> = {
  societario: 'Societario', contratos: 'Contratos', laboral: 'Laboral', tributario: 'Tributario',
  litigios: 'Litigios', inmobiliario: 'Inmobiliario', propiedad_intelectual: 'P. Intelectual',
  compliance: 'Compliance', datos_personales: 'Datos personales', ambiental_esg: 'Ambiental/ESG',
}
const PROJ_TYPES = ['mna', 'inmobiliario', 'corporativo'] as const

const EMPTY_PROJ = { name: '', client_id: '', type: 'mna' as typeof PROJ_TYPES[number], lead_partner: 'u1', risk_summary: '', status: 'activo' as DueDiligenceProject['status'] }
const EMPTY_FINDING = { title: '', category: 'societario', description: '', severity: 'medio' as Severity, status: 'pendiente', assigned_to: 'u2' }

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-foreground text-background text-sm px-4 py-3 rounded-xl shadow-card-lg">
      {msg}<button type="button" title="Cerrar" onClick={onClose}><X className="w-3.5 h-3.5" /></button>
    </div>
  )
}

export default function DueDiligencePage() {
  const { dueDiligenceProjects: dbProjects, dueDiligenceFindings: dbFindings, clients, users } = useData()
  const [projects, setProjects] = useState<DueDiligenceProject[]>([])
  const [findings, setFindings] = useState<DueDiligenceFinding[]>([])

  useEffect(() => { setProjects(dbProjects.map(p => ({ ...p }))) }, [dbProjects])
  useEffect(() => { setFindings(dbFindings.map(f => ({ ...f }))) }, [dbFindings])
  const [selectedProject, setSelectedProject] = useState<DueDiligenceProject | null>(null)
  const [showProjForm, setShowProjForm] = useState(false)
  const [editingProj, setEditingProj] = useState<DueDiligenceProject | null>(null)
  const [projForm, setProjForm] = useState(EMPTY_PROJ)
  const [deleteTarget, setDeleteTarget] = useState<DueDiligenceProject | null>(null)
  const [showFindingForm, setShowFindingForm] = useState(false)
  const [findingForm, setFindingForm] = useState(EMPTY_FINDING)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const projectFindings = findings.filter(f => f.project_id === selectedProject?.id)

  const openCreateProj = () => { setProjForm(EMPTY_PROJ); setEditingProj(null); setShowProjForm(true) }
  const openEditProj = (p: DueDiligenceProject) => {
    setProjForm({ name: p.name, client_id: p.client_id, type: p.type, lead_partner: p.lead_partner, risk_summary: p.risk_summary ?? '', status: p.status })
    setEditingProj(p); setSelectedProject(null); setShowProjForm(true)
  }

  const saveProject = async () => {
    if (!projForm.name.trim() || !projForm.client_id) return
    const client = clients.find(c => c.id === projForm.client_id)
    const leadUser = users.find(u => u.id === projForm.lead_partner)
    if (editingProj) {
      await db.updateDueDiligenceProject(editingProj.id, { ...projForm, client, lead_user: leadUser, updated_at: new Date().toISOString() })
      setProjects(prev => prev.map(p => p.id === editingProj.id ? { ...p, ...projForm, client, lead_user: leadUser, updated_at: new Date().toISOString() } : p))
      showToast('Proyecto actualizado')
    } else {
      const projDbData = {
        ...projForm,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }
      const created = await db.createDueDiligenceProject(projDbData)
      if (created) setProjects(prev => [{ ...created, client, lead_user: leadUser, findings_count: 0, critical_count: 0 }, ...prev])
      showToast('Proyecto creado')
    }
    setShowProjForm(false)
  }

  const deleteProject = async () => {
    if (!deleteTarget) return
    await db.deleteDueDiligenceProject(deleteTarget.id)
    setProjects(prev => prev.filter(p => p.id !== deleteTarget.id))
    setFindings(prev => prev.filter(f => f.project_id !== deleteTarget.id))
    if (selectedProject?.id === deleteTarget.id) setSelectedProject(null)
    showToast('Proyecto eliminado')
    setDeleteTarget(null)
  }

  const changeProjectStatus = async (projId: string, status: DueDiligenceProject['status']) => {
    await db.updateDueDiligenceProject(projId, { status })
    setProjects(prev => prev.map(p => p.id === projId ? { ...p, status } : p))
    setSelectedProject(prev => prev?.id === projId ? { ...prev, status } : prev)
    showToast(`Estado cambiado a "${PROJECT_STATUS[status].label}"`)
  }

  const addFinding = async () => {
    if (!findingForm.title.trim() || !selectedProject) return
    const findingData = {
      project_id: selectedProject.id, ...findingForm,
      created_at: new Date().toISOString(),
    }
    const created = await db.createDueDiligenceFinding(findingData)
    if (created) {
      setFindings(prev => [...prev, created])
      setProjects(prev => prev.map(p => {
        if (p.id !== selectedProject.id) return p
        const newCount = (p.findings_count ?? 0) + 1
        const critCount = findingForm.severity === 'crítico' ? (p.critical_count ?? 0) + 1 : (p.critical_count ?? 0)
        return { ...p, findings_count: newCount, critical_count: critCount }
      }))
    }
    setFindingForm(EMPTY_FINDING); setShowFindingForm(false)
    showToast('Hallazgo registrado')
  }

  const setFindingStatus = async (findingId: string, status: string) => {
    await db.updateDueDiligenceFinding(findingId, { status })
    setFindings(prev => prev.map(f => f.id === findingId ? { ...f, status } : f))
  }

  const exportReport = () => {
    if (!selectedProject) return
    const lines = [
      `DUE DILIGENCE — ${selectedProject.name}`,
      `Cliente: ${selectedProject.client?.name}`,
      `Tipo: ${selectedProject.type.toUpperCase()}`,
      `Estado: ${PROJECT_STATUS[selectedProject.status].label}`,
      '', `HALLAZGOS (${projectFindings.length}):`,
      ...projectFindings.map(f => `[${f.severity.toUpperCase()}] ${f.title}\n  ${f.description}`),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `dd-${selectedProject.name}.txt`; a.click()
    showToast('Informe exportado')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-playfair">Due Diligence</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Proyectos de revisión legal estructurada · {projects.length} proyectos</p>
        </div>
        <Button size="sm" onClick={openCreateProj}><Plus className="w-3.5 h-3.5 mr-1.5" />Nuevo proyecto</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Proyectos activos', value: projects.filter(p => p.status === 'activo').length, color: 'text-foreground', sub: 'En progreso' },
          { label: 'Total hallazgos', value: findings.length, color: 'text-brand-navy', sub: 'Registrados' },
          { label: 'Hallazgos críticos', value: findings.filter(f => f.severity === 'crítico').length, color: 'text-red-600', sub: 'Requieren atención' },
          { label: 'Completados', value: projects.filter(p => p.status === 'completado').length, color: 'text-green-600', sub: 'Este año' },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-5">
            <p className={`text-3xl font-bold tracking-tight ${s.color}`}>{s.value}</p>
            <p className="text-xs font-medium text-foreground mt-1">{s.label}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{s.sub}</p>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[32%]">Proyecto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Hallazgos</TableHead>
                <TableHead>Críticos</TableHead>
                <TableHead>Líder</TableHead>
                <TableHead className="w-20">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map(project => {
                const sc = PROJECT_STATUS[project.status]
                return (
                  <TableRow key={project.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setSelectedProject(project)}>
                    <TableCell><p className="text-xs font-medium text-foreground leading-snug">{project.name}</p></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{project.client?.name.split(' ').slice(0, 2).join(' ')}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] uppercase">{project.type}</Badge></TableCell>
                    <TableCell><span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sc.class}`}>{sc.label}</span></TableCell>
                    <TableCell><span className="text-sm font-semibold">{findings.filter(f => f.project_id === project.id).length}</span></TableCell>
                    <TableCell><span className={`text-sm font-semibold ${(project.critical_count ?? 0) > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>{project.critical_count ?? 0}</span></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{project.lead_user?.full_name.split(' ')[0] ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button type="button" title="Editar" onClick={() => openEditProj(project)} className="p-1 rounded hover:bg-muted"><Pencil className="w-3.5 h-3.5 text-muted-foreground" /></button>
                        <button type="button" title="Eliminar" onClick={() => setDeleteTarget(project)} className="p-1 rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedProject} onOpenChange={() => setSelectedProject(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedProject && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between pr-6">
                  <DialogTitle className="text-base pr-4">{selectedProject.name}</DialogTitle>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => openEditProj(selectedProject)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-red-600" onClick={() => { setSelectedProject(null); setDeleteTarget(selectedProject) }}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${PROJECT_STATUS[selectedProject.status].class}`}>{PROJECT_STATUS[selectedProject.status].label}</span>
                  <Badge variant="outline" className="text-[10px] uppercase">{selectedProject.type}</Badge>
                  <span className="text-xs text-muted-foreground">{selectedProject.client?.name}</span>
                </div>
              </DialogHeader>

              {/* Status change */}
              <div className="flex items-center gap-2 p-2.5 bg-muted/40 rounded-md flex-wrap">
                <span className="text-xs font-medium">Estado:</span>
                {Object.entries(PROJECT_STATUS).map(([k, v]) => (
                  <button type="button" key={k} onClick={() => changeProjectStatus(selectedProject.id, k as DueDiligenceProject['status'])}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all ${selectedProject.status === k ? v.class : 'border-border text-muted-foreground hover:border-foreground'}`}>
                    {v.label}
                  </button>
                ))}
              </div>

              {selectedProject.risk_summary && (
                <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                  <p className="text-xs font-semibold text-orange-900 mb-1 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />Resumen de riesgo</p>
                  <p className="text-xs text-orange-800">{selectedProject.risk_summary}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { label: 'Total hallazgos', value: projectFindings.length, color: '' },
                  { label: 'Críticos', value: projectFindings.filter(f => f.severity === 'crítico').length, color: 'text-red-600' },
                  { label: 'Alto impacto', value: projectFindings.filter(f => f.severity === 'alto').length, color: 'text-orange-600' },
                ].map(s => (
                  <div key={s.label} className="bg-muted/50 rounded-md p-2.5 text-center border border-border">
                    <p className={`text-xl font-bold ${s.color || 'text-foreground'}`}>{s.value}</p>
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>

              <Tabs defaultValue="findings">
                <TabsList className="h-8">
                  <TabsTrigger value="findings" className="text-xs">Hallazgos ({projectFindings.length})</TabsTrigger>
                  <TabsTrigger value="categories" className="text-xs">Por categoría</TabsTrigger>
                </TabsList>
                <TabsContent value="findings" className="mt-3">
                  <div className="flex justify-end mb-2">
                    <Button size="sm" variant="outline" className="h-7" onClick={() => { setFindingForm(EMPTY_FINDING); setShowFindingForm(true) }}>
                      <PlusCircle className="w-3 h-3 mr-1" />Agregar hallazgo
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {projectFindings.map(f => {
                      const sc = FINDING_STATUS_MAP[f.status] ?? FINDING_STATUS_MAP.pendiente
                      return (
                        <div key={f.id} className="border border-border rounded-md p-3 hover:bg-muted/30 transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-semibold text-foreground leading-snug flex-1">{f.title}</p>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <SeverityBadge level={f.severity} />
                              <Select value={f.status} onValueChange={v => setFindingStatus(f.id, v)}>
                                <SelectTrigger className="h-6 text-[10px] w-32 border-0 bg-transparent p-0 pr-4">
                                  <span className={`inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full border ${sc.class}`}>{sc.label}</span>
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(FINDING_STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1.5 leading-snug">{f.description}</p>
                          <Badge variant="outline" className="text-[10px] mt-2">{CATEGORIES[f.category] ?? f.category}</Badge>
                        </div>
                      )
                    })}
                    {projectFindings.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Sin hallazgos registrados</p>}
                  </div>
                </TabsContent>
                <TabsContent value="categories" className="mt-3">
                  {Object.entries(CATEGORIES).map(([key, label]) => {
                    const cats = projectFindings.filter(f => f.category === key)
                    if (cats.length === 0) return null
                    const maxSev = cats.some(f => f.severity === 'crítico') ? 'crítico' : cats.some(f => f.severity === 'alto') ? 'alto' : cats.some(f => f.severity === 'medio') ? 'medio' : 'bajo'
                    return (
                      <div key={key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <p className="text-xs font-medium">{label}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{cats.length} hallazgo{cats.length !== 1 ? 's' : ''}</span>
                          <SeverityBadge level={maxSev} />
                        </div>
                      </div>
                    )
                  })}
                </TabsContent>
              </Tabs>

              <div className="flex gap-2 pt-3 border-t border-border">
                <Button size="sm" onClick={exportReport}><Download className="w-3.5 h-3.5 mr-1.5" />Exportar informe</Button>
                <AiDisclaimer className="ml-auto text-[10px]" />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Finding Dialog */}
      <Dialog open={showFindingForm} onOpenChange={setShowFindingForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nuevo hallazgo</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Título *</Label>
              <Input value={findingForm.title} onChange={e => setFindingForm(p => ({ ...p, title: e.target.value }))} placeholder="Describe el hallazgo..." className="h-8 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Categoría</Label>
                <Select value={findingForm.category} onValueChange={v => setFindingForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Severidad</Label>
                <Select value={findingForm.severity} onValueChange={v => setFindingForm(p => ({ ...p, severity: v as Severity }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="crítico">Crítico</SelectItem>
                    <SelectItem value="alto">Alto</SelectItem>
                    <SelectItem value="medio">Medio</SelectItem>
                    <SelectItem value="bajo">Bajo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descripción</Label>
              <Textarea value={findingForm.description} onChange={e => setFindingForm(p => ({ ...p, description: e.target.value }))} rows={3} className="text-sm resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowFindingForm(false)}>Cancelar</Button>
            <Button size="sm" onClick={addFinding} disabled={!findingForm.title.trim()}>Agregar hallazgo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Project Form */}
      <Dialog open={showProjForm} onOpenChange={setShowProjForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingProj ? 'Editar proyecto' : 'Nuevo proyecto DD'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Nombre del proyecto *</Label>
              <Input value={projForm.name} onChange={e => setProjForm(p => ({ ...p, name: e.target.value }))} placeholder="DD Adquisición de..." className="h-8 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Cliente *</Label>
                <Select value={projForm.client_id} onValueChange={v => setProjForm(p => ({ ...p, client_id: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name.split(' ').slice(0, 2).join(' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={projForm.type} onValueChange={v => setProjForm(p => ({ ...p, type: v as typeof PROJ_TYPES[number] }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{PROJ_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Socio líder</Label>
                <Select value={projForm.lead_partner} onValueChange={v => setProjForm(p => ({ ...p, lead_partner: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{users.filter(u => u.role !== 'cliente').map(u => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Estado</Label>
                <Select value={projForm.status} onValueChange={v => setProjForm(p => ({ ...p, status: v as DueDiligenceProject['status'] }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PROJECT_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Resumen de riesgo</Label>
              <Textarea value={projForm.risk_summary} onChange={e => setProjForm(p => ({ ...p, risk_summary: e.target.value }))} rows={2} className="text-sm resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowProjForm(false)}>Cancelar</Button>
            <Button size="sm" onClick={saveProject} disabled={!projForm.name.trim() || !projForm.client_id}>{editingProj ? 'Guardar' : 'Crear proyecto'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-600"><AlertCircle className="w-4 h-4" />Eliminar proyecto</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">¿Eliminar <strong>{deleteTarget?.name}</strong> y todos sus hallazgos?</p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button size="sm" variant="destructive" onClick={deleteProject}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {toast && <Toast msg={toast} onClose={() => setToast('')} />}
    </div>
  )
}
