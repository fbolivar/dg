"use client"
import { useState, useEffect } from 'react'
import { Bell, ExternalLink, BookOpen, Send, Archive, Filter, X, Plus, Pencil, Trash2, AlertCircle, ChevronDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { SeverityBadge } from '@/components/shared/severity-badge'
import { AlertStatusBadge } from '@/components/shared/alert-status-badge'
import { useData } from '@/shared/context/data-context'
import * as db from '@/shared/services/db'
import type { Alert, ImpactLevel, AlertStatus } from '@/shared/types'

const IMPACT_LEVELS: ImpactLevel[] = ['crítico', 'alto', 'medio', 'bajo']
const STATUS_OPTIONS: { value: AlertStatus; label: string }[] = [
  { value: 'nueva', label: 'Nueva' },
  { value: 'en_análisis', label: 'En análisis' },
  { value: 'enviada_cliente', label: 'Enviada al cliente' },
  { value: 'archivada', label: 'Archivada' },
]

const EMPTY_FORM = {
  title: '', source: '', source_url: '', practice_area_id: 'pa1', impact_level: 'alto' as ImpactLevel,
  summary: '', recommendation: '', assigned_to: 'u2', clients_affected: [] as string[],
}

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-foreground text-background text-sm px-4 py-3 rounded-xl shadow-card-lg">
      {msg}
      <button type="button" title="Cerrar" onClick={onClose}><X className="w-3.5 h-3.5" /></button>
    </div>
  )
}

export default function MonitorPage() {
  const { alerts: dbAlerts, clients, practiceAreas, users } = useData()
  const [alerts, setAlerts] = useState<Alert[]>([])

  useEffect(() => { setAlerts(dbAlerts.map(a => ({ ...a }))) }, [dbAlerts])
  const [selected, setSelected] = useState<Alert | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Alert | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<Alert | null>(null)
  const [search, setSearch] = useState('')
  const [filterImpact, setFilterImpact] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const filtered = alerts.filter(a => {
    const matchSearch = a.title.toLowerCase().includes(search.toLowerCase()) || a.source.toLowerCase().includes(search.toLowerCase())
    const matchImpact = !filterImpact || a.impact_level === filterImpact
    const matchStatus = !filterStatus || a.status === filterStatus
    return matchSearch && matchImpact && matchStatus
  })

  const stats = {
    total: alerts.length,
    critico: alerts.filter(a => a.impact_level === 'crítico').length,
    alto: alerts.filter(a => a.impact_level === 'alto').length,
    nueva: alerts.filter(a => a.status === 'nueva').length,
  }

  const openCreate = () => { setForm(EMPTY_FORM); setEditing(null); setShowForm(true) }
  const openEdit = (a: Alert) => {
    setForm({
      title: a.title, source: a.source, source_url: a.source_url ?? '',
      practice_area_id: a.practice_area_id, impact_level: a.impact_level,
      summary: a.summary, recommendation: a.recommendation,
      assigned_to: a.assigned_to ?? 'u2', clients_affected: a.clients_affected ?? [],
    })
    setEditing(a); setSelected(null); setShowForm(true)
  }

  const saveAlert = async () => {
    if (!form.title.trim()) return
    const pa = practiceAreas.find(p => p.id === form.practice_area_id)
    if (editing) {
      await db.updateAlert(editing.id, form)
      setAlerts(prev => prev.map(a => a.id === editing.id ? { ...a, ...form, practice_area: pa } : a))
      showToast('Alerta actualizada')
    } else {
      const alertData = {
        ...form,
        status: 'nueva' as AlertStatus,
        published_at: new Date().toISOString().split('T')[0],
      }
      const created = await db.createAlert(alertData)
      if (created) {
        setAlerts(prev => [{ ...created, practice_area: pa }, ...prev])
      }
      showToast('Alerta creada')
    }
    setShowForm(false)
  }

  const setStatus = async (alertId: string, status: AlertStatus) => {
    await db.updateAlert(alertId, { status })
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status } : a))
    setSelected(prev => prev?.id === alertId ? { ...prev, status } : prev)
    showToast(`Estado actualizado a "${STATUS_OPTIONS.find(s => s.value === status)?.label}"`)
  }

  const setAssigned = async (alertId: string, userId: string) => {
    await db.updateAlert(alertId, { assigned_to: userId })
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, assigned_to: userId } : a))
    setSelected(prev => prev?.id === alertId ? { ...prev, assigned_to: userId } : prev)
    showToast('Responsable asignado')
  }

  const deleteAlert = async () => {
    if (!deleteTarget) return
    await db.deleteAlert(deleteTarget.id)
    setAlerts(prev => prev.filter(a => a.id !== deleteTarget.id))
    if (selected?.id === deleteTarget.id) setSelected(null)
    showToast('Alerta eliminada')
    setDeleteTarget(null)
  }

  const toggleClientAffected = (clientId: string) => {
    setForm(prev => ({
      ...prev,
      clients_affected: prev.clients_affected.includes(clientId)
        ? prev.clients_affected.filter(c => c !== clientId)
        : [...prev.clients_affected, clientId],
    }))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-playfair">Monitor normativo</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Alertas normativas y jurisprudenciales actualizadas</p>
        </div>
        <Button size="sm" onClick={openCreate}><Plus className="w-3.5 h-3.5 mr-1.5" />Nueva alerta</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total alertas', value: stats.total, color: 'text-foreground', sub: 'Registradas' },
          { label: 'Críticas', value: stats.critico, color: 'text-red-600', sub: 'Acción inmediata' },
          { label: 'Alto impacto', value: stats.alto, color: 'text-orange-600', sub: 'Revisión prioritaria' },
          { label: 'Sin atender', value: stats.nueva, color: 'text-blue-600', sub: 'Pendientes análisis' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <p className={`text-3xl font-bold tracking-tight ${s.color}`}>{s.value}</p>
              <p className="text-xs font-medium text-foreground mt-1">{s.label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Input placeholder="Buscar alerta o fuente..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 text-sm pr-8" />
          {search && <button type="button" title="Limpiar" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5 text-muted-foreground" /></button>}
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          {IMPACT_LEVELS.map(level => (
            <button type="button" key={level} onClick={() => setFilterImpact(filterImpact === level ? '' : level)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${filterImpact === level ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:border-foreground'}`}>
              {level}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {STATUS_OPTIONS.map(s => (
            <button type="button" key={s.value} onClick={() => setFilterStatus(filterStatus === s.value ? '' : s.value)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${filterStatus === s.value ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:border-foreground'}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[35%]">Alerta</TableHead>
                <TableHead>Fuente</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Clientes</TableHead>
                <TableHead>Impacto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead className="w-20">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(alert => (
                <TableRow key={alert.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setSelected(alert)}>
                  <TableCell>
                    <p className="text-xs font-medium text-foreground leading-snug">{alert.title}</p>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{alert.source}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(alert.published_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </TableCell>
                  <TableCell className="text-xs">{alert.practice_area?.code}</TableCell>
                  <TableCell>
                    <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium">{alert.clients_affected?.length ?? 0}</span>
                  </TableCell>
                  <TableCell><SeverityBadge level={alert.impact_level} /></TableCell>
                  <TableCell><AlertStatusBadge status={alert.status} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {users.find(u => u.id === alert.assigned_to)?.full_name.split(' ')[0] ?? '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button type="button" title="Editar" onClick={() => openEdit(alert)} className="p-1 rounded hover:bg-muted">
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button type="button" title="Eliminar" onClick={() => setDeleteTarget(alert)} className="p-1 rounded hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-sm text-muted-foreground">No se encontraron alertas.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Alert Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between pr-6">
                  <DialogTitle className="text-base leading-snug pr-4">{selected.title}</DialogTitle>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => openEdit(selected)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-red-600" onClick={() => { setSelected(null); setDeleteTarget(selected) }}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <SeverityBadge level={selected.impact_level} />
                  <AlertStatusBadge status={selected.status} />
                  <Badge variant="outline" className="text-[10px]">{selected.practice_area?.name}</Badge>
                  <span className="text-xs text-muted-foreground">{selected.source}</span>
                </div>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Resumen</h4>
                  <p className="text-sm text-foreground leading-relaxed">{selected.summary}</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <h4 className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1.5">Recomendación DG&A</h4>
                  <p className="text-sm text-blue-900 leading-relaxed">{selected.recommendation}</p>
                </div>

                {/* Actions row */}
                <div className="space-y-3 border-t border-border pt-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">Estado:</span>
                      <Select value={selected.status} onValueChange={v => setStatus(selected.id, v as AlertStatus)}>
                        <SelectTrigger className="h-7 text-xs w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">Responsable:</span>
                      <Select value={selected.assigned_to ?? ''} onValueChange={v => setAssigned(selected.id, v)}>
                        <SelectTrigger className="h-7 text-xs w-44"><SelectValue placeholder="Asignar..." /></SelectTrigger>
                        <SelectContent>
                          {users.filter(u => u.role !== 'cliente').map(u => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button size="sm" onClick={() => { setStatus(selected.id, 'enviada_cliente'); showToast('Alerta enviada al cliente') }}>
                      <Send className="w-3.5 h-3.5 mr-1.5" />Enviar al cliente
                    </Button>
                    <Button size="sm" variant="outline">
                      <BookOpen className="w-3.5 h-3.5 mr-1.5" />Generar Legal Note
                    </Button>
                    <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setStatus(selected.id, 'archivada')}>
                      <Archive className="w-3.5 h-3.5 mr-1.5" />Archivar
                    </Button>
                    {selected.source_url && selected.source_url !== '#' && (
                      <a href={selected.source_url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="ghost" className="text-muted-foreground ml-auto">
                          <ExternalLink className="w-3.5 h-3.5 mr-1.5" />Fuente original
                        </Button>
                      </a>
                    )}
                  </div>
                </div>

                {selected.clients_affected && selected.clients_affected.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Clientes impactados</h4>
                    <div className="flex flex-wrap gap-2">
                      {selected.clients_affected.map(cid => {
                        const client = clients.find(c => c.id === cid)
                        return client ? (
                          <span key={cid} className="text-xs bg-muted text-foreground px-2.5 py-1 rounded-full border border-border">{client.name}</span>
                        ) : null
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Form */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar alerta' : 'Nueva alerta normativa'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Título *</Label>
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Título de la alerta normativa" className="h-8 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Fuente</Label>
                <Input value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))} placeholder="Min. Trabajo, SIC, etc." className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">URL fuente</Label>
                <Input value={form.source_url} onChange={e => setForm(p => ({ ...p, source_url: e.target.value }))} placeholder="https://..." className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Área de práctica</Label>
                <Select value={form.practice_area_id} onValueChange={v => setForm(p => ({ ...p, practice_area_id: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{practiceAreas.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Impacto</Label>
                <Select value={form.impact_level} onValueChange={v => setForm(p => ({ ...p, impact_level: v as ImpactLevel }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="crítico">Crítico</SelectItem>
                    <SelectItem value="alto">Alto</SelectItem>
                    <SelectItem value="medio">Medio</SelectItem>
                    <SelectItem value="bajo">Bajo</SelectItem>
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
            <div className="space-y-1">
              <Label className="text-xs">Resumen</Label>
              <Textarea value={form.summary} onChange={e => setForm(p => ({ ...p, summary: e.target.value }))} rows={3} className="text-sm resize-none" placeholder="Descripción de la norma o jurisprudencia..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Recomendación DG&A</Label>
              <Textarea value={form.recommendation} onChange={e => setForm(p => ({ ...p, recommendation: e.target.value }))} rows={3} className="text-sm resize-none" placeholder="Acciones recomendadas para los clientes..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Clientes impactados</Label>
              <div className="flex flex-wrap gap-2">
                {clients.map(c => (
                  <button type="button" key={c.id} onClick={() => toggleClientAffected(c.id)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-all ${form.clients_affected.includes(c.id) ? 'bg-brand-navy text-white border-brand-navy' : 'border-border text-muted-foreground hover:border-brand-navy'}`}>
                    {c.name.split(' ').slice(0, 2).join(' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button size="sm" onClick={saveAlert} disabled={!form.title.trim()}>{editing ? 'Guardar cambios' : 'Crear alerta'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-600"><AlertCircle className="w-4 h-4" />Eliminar alerta</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">¿Confirma eliminar esta alerta? Esta acción no se puede deshacer.</p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button size="sm" variant="destructive" onClick={deleteAlert}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {toast && <Toast msg={toast} onClose={() => setToast('')} />}
    </div>
  )
}
