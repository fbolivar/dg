"use client"
import { useState, useEffect } from 'react'
import { Shield, CheckCircle, Clock, AlertTriangle, XCircle, Plus, Pencil, Trash2, AlertCircle, X, Download } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { AiDisclaimer } from '@/components/layout/ai-disclaimer'
import { useData } from '@/shared/context/data-context'
import * as db from '@/shared/services/db'
import type { ComplianceDiagnostic } from '@/shared/types'

const TYPE_LABELS: Record<string, { label: string; full: string }> = {
  sagrilaft: { label: 'SAGRILAFT', full: 'Sistema de Autocontrol y Gestión del Riesgo LA/FT' },
  ptee: { label: 'PTEE', full: 'Programa de Transparencia y Ética Empresarial' },
  habeas_data: { label: 'Habeas Data', full: 'Protección de Datos Personales — Ley 1581/2012' },
}
const IMPL_STATUS: Record<string, { label: string; icon: React.ElementType; class: string }> = {
  no_iniciado: { label: 'No iniciado', icon: XCircle, class: 'text-gray-400' },
  en_progreso: { label: 'En progreso', icon: Clock, class: 'text-yellow-600' },
  completado: { label: 'Completado', icon: CheckCircle, class: 'text-green-600' },
}

const CHECKLISTS: Record<string, string[]> = {
  sagrilaft: [
    'Designación de oficial de cumplimiento',
    'Metodología de gestión de riesgo LA/FT',
    'Segmentación de clientes y contrapartes',
    'Políticas de conocimiento del cliente (KYC)',
    'Señales de alerta documentadas',
    'Capacitación anual al personal',
    'Reporte a UIAF actualizado',
    'Auditoría interna del programa',
  ],
  ptee: [
    'Diagnóstico de riesgos de corrupción',
    'Código de ética y conducta aprobado',
    'Canal de denuncias implementado',
    'Política de regalos y conflictos de interés',
    'Capacitación a empleados y directivos',
    'Revisión de terceros y contratistas',
    'Reporte de implementación PTEE',
  ],
  habeas_data: [
    'Aviso de privacidad publicado',
    'Política de tratamiento de datos aprobada',
    'Base de datos de titulares registrada',
    'Mecanismos para ejercicio de derechos',
    'Contratos con encargados del tratamiento',
    'Medidas de seguridad implementadas',
    'Oficial de protección de datos designado',
  ],
}

const EMPTY_FORM = { client_id: '', type: 'sagrilaft' as ComplianceDiagnostic['type'], assigned_to: 'u2' }

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-foreground text-background text-sm px-4 py-3 rounded-xl shadow-card-lg">
      {msg}<button type="button" title="Cerrar" onClick={onClose}><X className="w-3.5 h-3.5" /></button>
    </div>
  )
}

type ChecklistState = Record<string, boolean[]>

function buildChecklist(diags: ComplianceDiagnostic[]): ChecklistState {
  const state: ChecklistState = {}
  diags.forEach(d => {
    const items = CHECKLISTS[d.type] ?? []
    const doneCount = Math.floor((d.completion_pct / 100) * items.length)
    state[d.id] = items.map((_, i) => i < doneCount)
  })
  return state
}

export default function CompliancePage() {
  const { complianceDiagnostics: dbDiags, clients, users } = useData()
  const [diags, setDiags] = useState<ComplianceDiagnostic[]>([])
  const [checklists, setChecklists] = useState<ChecklistState>({})

  useEffect(() => {
    if (dbDiags.length > 0) {
      setDiags(dbDiags.map(d => ({ ...d })))
      setChecklists(buildChecklist(dbDiags))
    }
  }, [dbDiags])
  const [selected, setSelected] = useState<ComplianceDiagnostic | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ComplianceDiagnostic | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const stats = {
    total: diags.length,
    completado: diags.filter(d => d.implementation_status === 'completado').length,
    en_progreso: diags.filter(d => d.implementation_status === 'en_progreso').length,
    no_iniciado: diags.filter(d => d.implementation_status === 'no_iniciado').length,
  }

  const toggleItem = async (diagId: string, idx: number) => {
    const items = CHECKLISTS[diags.find(d => d.id === diagId)?.type ?? 'sagrilaft']
    const current = checklists[diagId] ?? items.map(() => false)
    const updated = current.map((v, i) => i === idx ? !v : v)
    const doneCount = updated.filter(Boolean).length
    const pct = Math.round((doneCount / items.length) * 100)
    const status: ComplianceDiagnostic['implementation_status'] = pct === 100 ? 'completado' : pct > 0 ? 'en_progreso' : 'no_iniciado'
    await db.updateComplianceDiagnostic(diagId, { completion_pct: pct, implementation_status: status })
    setChecklists(prev => ({ ...prev, [diagId]: updated }))
    setDiags(prev => prev.map(d => d.id === diagId ? { ...d, completion_pct: pct, implementation_status: status } : d))
    setSelected(prev => prev?.id === diagId ? { ...prev, completion_pct: pct, implementation_status: status } : prev)
  }

  const createDiag = async () => {
    if (!form.client_id) return
    const client = clients.find(c => c.id === form.client_id)
    const items = CHECKLISTS[form.type]
    const diagDbData = {
      client_id: form.client_id, type: form.type,
      implementation_status: 'no_iniciado' as ComplianceDiagnostic['implementation_status'],
      completion_pct: 0,
      assigned_to: form.assigned_to, created_at: new Date().toISOString(),
    }
    const created = await db.createComplianceDiagnostic(diagDbData)
    if (created) {
      setDiags(prev => [...prev, { ...created, client }])
      setChecklists(prev => ({ ...prev, [created.id]: items.map(() => false) }))
    }
    setForm(EMPTY_FORM); setShowForm(false)
    showToast('Diagnóstico creado')
  }

  const deleteDiag = async () => {
    if (!deleteTarget) return
    await db.deleteComplianceDiagnostic(deleteTarget.id)
    setDiags(prev => prev.filter(d => d.id !== deleteTarget.id))
    if (selected?.id === deleteTarget.id) setSelected(null)
    showToast('Diagnóstico eliminado')
    setDeleteTarget(null)
  }

  const exportReport = () => {
    if (!selected) return
    const items = CHECKLISTS[selected.type] ?? []
    const cl = checklists[selected.id] ?? items.map(() => false)
    const lines = [
      `DIAGNÓSTICO ${TYPE_LABELS[selected.type].full.toUpperCase()}`,
      `Cliente: ${selected.client?.name}`,
      `Avance: ${selected.completion_pct}%`,
      `Estado: ${IMPL_STATUS[selected.implementation_status].label}`,
      '', 'LISTA DE VERIFICACIÓN:',
      ...items.map((item, i) => `${cl[i] ? '✓' : '☐'} ${item}`),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `compliance-${selected.type}.txt`; a.click()
    showToast('Informe exportado')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-playfair">Compliance y regulatorio</h1>
          <p className="text-sm text-muted-foreground mt-0.5">SAGRILAFT · PTEE · Protección de datos personales</p>
        </div>
        <Button size="sm" onClick={() => { setForm(EMPTY_FORM); setShowForm(true) }}><Plus className="w-3.5 h-3.5 mr-1.5" />Nuevo diagnóstico</Button>
      </div>

      <AiDisclaimer message="Los diagnósticos son orientativos. Requieren validación del equipo legal de DG&A antes de ser utilizados." variant="banner" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total diagnósticos', value: stats.total, color: 'text-foreground', sub: 'Registrados' },
          { label: 'Completados', value: stats.completado, color: 'text-green-600', sub: '100% de avance' },
          { label: 'En progreso', value: stats.en_progreso, color: 'text-yellow-600', sub: 'Implementando' },
          { label: 'No iniciados', value: stats.no_iniciado, color: 'text-gray-500', sub: 'Pendientes' },
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
                <TableHead>Cliente</TableHead>
                <TableHead>Programa</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[200px]">Avance</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead>Última revisión</TableHead>
                <TableHead className="w-20">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {diags.map(diag => {
                const ti = TYPE_LABELS[diag.type]
                const si = IMPL_STATUS[diag.implementation_status]
                const SIcon = si.icon
                return (
                  <TableRow key={diag.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setSelected(diag)}>
                    <TableCell>
                      <p className="text-xs font-medium text-foreground">{diag.client?.name.split(' ').slice(0, 3).join(' ')}</p>
                      <p className="text-[10px] text-muted-foreground">{diag.client?.sector}</p>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{ti.label}</Badge></TableCell>
                    <TableCell>
                      <div className={`flex items-center gap-1 text-xs font-medium ${si.class}`}>
                        <SIcon className="w-3.5 h-3.5" />{si.label}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={diag.completion_pct} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground w-8 text-right">{diag.completion_pct}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {users.find(u => u.id === diag.assigned_to)?.full_name.split(' ')[0] ?? '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {diag.last_review ? new Date(diag.last_review).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : 'Sin revisión'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button type="button" title="Eliminar" onClick={() => setDeleteTarget(diag)} className="p-1 rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
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
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-xl max-h-[88vh] overflow-y-auto">
          {selected && (() => {
            const items = CHECKLISTS[selected.type] ?? []
            const cl = checklists[selected.id] ?? items.map(() => false)
            const si = IMPL_STATUS[selected.implementation_status]
            const SIcon = si.icon
            return (
              <>
                <DialogHeader>
                  <div className="flex items-start justify-between pr-6">
                    <DialogTitle className="text-base">{TYPE_LABELS[selected.type].full}</DialogTitle>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-red-600 flex-shrink-0" onClick={() => { setSelected(null); setDeleteTarget(selected) }}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{selected.client?.name}</p>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  <div className="bg-muted/50 rounded-md p-4 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className={`flex items-center gap-1.5 text-xs font-semibold ${si.class}`}>
                        <SIcon className="w-4 h-4" />{si.label}
                      </div>
                      <span className="text-2xl font-bold text-foreground">{selected.completion_pct}%</span>
                    </div>
                    <Progress value={selected.completion_pct} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {cl.filter(Boolean).length} de {items.length} ítems completados
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Lista de verificación — interactiva</p>
                    <div className="space-y-1.5">
                      {items.map((item, i) => (
                        <button
                          type="button"
                          key={i}
                          onClick={() => toggleItem(selected.id, i)}
                          className="w-full flex items-center gap-2.5 py-2 px-2 rounded-md border border-border hover:bg-muted/40 transition-colors text-left"
                        >
                          {cl[i]
                            ? <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                            : <Clock className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                          }
                          <span className={`text-xs flex-1 ${cl[i] ? 'text-foreground line-through' : 'text-foreground'}`}>{item}</span>
                          {!cl[i] && <Badge variant="outline" className="text-[10px] ml-auto">Pendiente</Badge>}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                    <p className="text-[10px] text-amber-800 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      Este diagnóstico es orientativo. Requiere validación del equipo legal antes de presentarse a autoridades.
                    </p>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-border">
                    <Button size="sm" className="flex-1" onClick={() => { showToast('Diagnóstico guardado'); setSelected(null) }}>
                      <CheckCircle className="w-3.5 h-3.5 mr-1.5" />Guardar progreso
                    </Button>
                    <Button size="sm" variant="outline" onClick={exportReport}>
                      <Download className="w-3.5 h-3.5 mr-1.5" />Exportar
                    </Button>
                  </div>
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Create Form */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nuevo diagnóstico de compliance</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Cliente *</Label>
              <Select value={form.client_id} onValueChange={v => setForm(p => ({ ...p, client_id: v }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Seleccionar cliente..." /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Programa *</Label>
                <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v as ComplianceDiagnostic['type'] }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sagrilaft">SAGRILAFT</SelectItem>
                    <SelectItem value="ptee">PTEE</SelectItem>
                    <SelectItem value="habeas_data">Habeas Data</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Responsable</Label>
                <Select value={form.assigned_to} onValueChange={v => setForm(p => ({ ...p, assigned_to: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{users.filter(u => u.role !== 'cliente').map(u => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button size="sm" onClick={createDiag} disabled={!form.client_id}>Crear diagnóstico</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-600"><AlertCircle className="w-4 h-4" />Eliminar diagnóstico</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">¿Eliminar el diagnóstico de <strong>{deleteTarget?.client?.name}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button size="sm" variant="destructive" onClick={deleteDiag}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {toast && <Toast msg={toast} onClose={() => setToast('')} />}
    </div>
  )
}
