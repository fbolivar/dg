"use client"
import { useState, useEffect } from 'react'
import { Scale, Calendar, Clock, FileText, Plus, Pencil, Trash2, AlertCircle, X, PlusCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { useData } from '@/shared/context/data-context'
import * as db from '@/shared/services/db'
import type { Matter, MatterEvent, MatterStatus } from '@/shared/types'

const MATTER_STATUS_MAP: Record<MatterStatus, { label: string; class: string }> = {
  activo: { label: 'Activo', class: 'bg-green-100 text-green-800 border-green-200' },
  en_pausa: { label: 'En pausa', class: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  cerrado: { label: 'Cerrado', class: 'bg-gray-100 text-gray-600 border-gray-200' },
  archivado: { label: 'Archivado', class: 'bg-gray-100 text-gray-400 border-gray-200' },
}
const TYPES = ['litigio', 'consultoría', 'transaccional', 'compliance', 'regulatorio'] as const
const EMPTY_FORM = {
  title: '', client_id: '', practice_area_id: 'pa1', type: 'litigio' as typeof TYPES[number],
  jurisdiction: '', parties: '', process_state: '', estimated_risk: '',
  success_probability: '', next_action: '', next_deadline: '',
  status: 'activo' as MatterStatus, assigned_to: 'u2',
}
const EMPTY_EVENT = { event_type: '', event_date: '', description: '' }

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-foreground text-background text-sm px-4 py-3 rounded-xl shadow-card-lg">
      {msg}<button type="button" title="Cerrar" onClick={onClose}><X className="w-3.5 h-3.5" /></button>
    </div>
  )
}

export default function LitigiosPage() {
  const { matters: dbMatters, matterEvents: dbMatterEvents, clients, practiceAreas, users } = useData()
  const [matters, setMatters] = useState<Matter[]>([])
  const [events, setEvents] = useState<MatterEvent[]>([])

  useEffect(() => { if (dbMatters.length > 0) setMatters(dbMatters.map(m => ({ ...m }))) }, [dbMatters])
  useEffect(() => { if (dbMatterEvents.length > 0) setEvents(dbMatterEvents.map(e => ({ ...e }))) }, [dbMatterEvents])
  const [selected, setSelected] = useState<Matter | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Matter | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<Matter | null>(null)
  const [showEventForm, setShowEventForm] = useState(false)
  const [eventForm, setEventForm] = useState(EMPTY_EVENT)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const selectedEvents = events.filter(e => e.matter_id === selected?.id)
    .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())

  const stats = {
    activos: matters.filter(m => m.status === 'activo').length,
    litigios: matters.filter(m => m.type === 'litigio').length,
    urgentes: matters.filter(m => m.next_deadline && new Date(m.next_deadline) < new Date(Date.now() + 7 * 86400000)).length,
    transaccionales: matters.filter(m => m.type === 'transaccional').length,
  }

  const openCreate = () => { setForm(EMPTY_FORM); setEditing(null); setShowForm(true) }
  const openEdit = (m: Matter) => {
    setForm({
      title: m.title, client_id: m.client_id, practice_area_id: m.practice_area_id,
      type: m.type, jurisdiction: m.jurisdiction ?? '', parties: m.parties ?? '',
      process_state: m.process_state ?? '', estimated_risk: m.estimated_risk ?? '',
      success_probability: m.success_probability?.toString() ?? '',
      next_action: m.next_action ?? '', next_deadline: m.next_deadline ?? '',
      status: m.status, assigned_to: m.assigned_to,
    })
    setEditing(m); setSelected(null); setShowForm(true)
  }

  const saveMatter = async () => {
    if (!form.title.trim() || !form.client_id) return
    const client = clients.find(c => c.id === form.client_id)
    const pa = practiceAreas.find(p => p.id === form.practice_area_id)
    const user = users.find(u => u.id === form.assigned_to)
    const base = {
      ...form,
      client, practice_area: pa, assigned_user: user,
      success_probability: form.success_probability ? parseInt(form.success_probability) : undefined,
      updated_at: new Date().toISOString(),
    }
    if (editing) {
      await db.updateMatter(editing.id, base)
      setMatters(prev => prev.map(m => m.id === editing.id ? { ...m, ...base } : m))
      if (selected?.id === editing.id) setSelected(prev => prev ? { ...prev, ...base } : prev)
      showToast('Asunto actualizado')
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { client: _c, practice_area: _pa, assigned_user: _au, ...matterDbFields } = base
      const created = await db.createMatter({ ...matterDbFields, created_at: new Date().toISOString() })
      if (created) setMatters(prev => [{ ...created, client, practice_area: pa, assigned_user: user }, ...prev])
      showToast('Asunto creado')
    }
    setShowForm(false)
  }

  const deleteMatter = async () => {
    if (!deleteTarget) return
    await db.deleteMatter(deleteTarget.id)
    setMatters(prev => prev.filter(m => m.id !== deleteTarget.id))
    if (selected?.id === deleteTarget.id) setSelected(null)
    showToast('Asunto eliminado')
    setDeleteTarget(null)
  }

  const changeStatus = async (matterId: string, status: MatterStatus) => {
    await db.updateMatter(matterId, { status })
    setMatters(prev => prev.map(m => m.id === matterId ? { ...m, status } : m))
    setSelected(prev => prev?.id === matterId ? { ...prev, status } : prev)
    showToast(`Estado cambiado a "${MATTER_STATUS_MAP[status].label}"`)
  }

  const addEvent = async () => {
    if (!eventForm.event_type.trim() || !selected) return
    const eventData = {
      matter_id: selected.id,
      event_type: eventForm.event_type, event_date: eventForm.event_date || new Date().toISOString().split('T')[0],
      description: eventForm.description, created_by: 'u1', created_at: new Date().toISOString(),
    }
    const created = await db.createMatterEvent(eventData)
    if (created) setEvents(prev => [...prev, created])
    setEventForm(EMPTY_EVENT); setShowEventForm(false)
    showToast('Actuación registrada')
  }

  const exportCSV = () => {
    const headers = ['Asunto', 'Cliente', 'Tipo', 'Estado', 'Probabilidad', 'Próximo vencimiento']
    const rows = matters.map(m => [m.title, m.client?.name ?? '', m.type, m.status, m.success_probability ?? '', m.next_deadline ?? ''])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'litigios.csv'; a.click()
    showToast('Reporte exportado')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-playfair">Litigios y asuntos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Seguimiento de procesos y actuaciones · {matters.length} asuntos</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCSV}><FileText className="w-3.5 h-3.5 mr-1.5" />Exportar CSV</Button>
          <Button size="sm" onClick={openCreate}><Plus className="w-3.5 h-3.5 mr-1.5" />Nuevo asunto</Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Asuntos activos', value: stats.activos, color: 'text-foreground', sub: 'En trámite' },
          { label: 'Litigios', value: stats.litigios, color: 'text-brand-navy', sub: 'Procesos judiciales' },
          { label: 'Vencen pronto', value: stats.urgentes, color: 'text-red-600', sub: 'Próximos 7 días' },
          { label: 'Transaccionales', value: stats.transaccionales, color: 'text-blue-600', sub: 'En estructuración' },
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
                <TableHead className="w-[28%]">Asunto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado procesal</TableHead>
                <TableHead>Probabilidad</TableHead>
                <TableHead>Próx. vencimiento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-20">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matters.map(matter => {
                const sc = MATTER_STATUS_MAP[matter.status]
                const isUrgent = matter.next_deadline && new Date(matter.next_deadline) < new Date(Date.now() + 14 * 86400000)
                return (
                  <TableRow key={matter.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setSelected(matter)}>
                    <TableCell>
                      <p className="text-xs font-medium text-foreground leading-snug">{matter.title}</p>
                      {matter.jurisdiction && <p className="text-[10px] text-muted-foreground mt-0.5">{matter.jurisdiction.split(' ').slice(0, 4).join(' ')}</p>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{matter.client?.name.split(' ').slice(0, 2).join(' ')}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{matter.type}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[140px]"><span className="truncate block">{matter.process_state ?? '—'}</span></TableCell>
                    <TableCell>
                      {matter.success_probability !== undefined ? (
                        <div className="flex items-center gap-1.5">
                          <Progress value={matter.success_probability} className="h-1.5 w-16" />
                          <span className="text-xs text-muted-foreground">{matter.success_probability}%</span>
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {matter.next_deadline ? (
                        <div className={`flex items-center gap-1 text-xs font-medium ${isUrgent ? 'text-red-600' : 'text-foreground'}`}>
                          {isUrgent && <Clock className="w-3 h-3" />}
                          {new Date(matter.next_deadline).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sc.class}`}>{sc.label}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button type="button" title="Editar" onClick={() => openEdit(matter)} className="p-1 rounded hover:bg-muted"><Pencil className="w-3.5 h-3.5 text-muted-foreground" /></button>
                        <button type="button" title="Eliminar" onClick={() => setDeleteTarget(matter)} className="p-1 rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between pr-6">
                  <DialogTitle className="text-base pr-4">{selected.title}</DialogTitle>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => openEdit(selected)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-red-600" onClick={() => { setSelected(null); setDeleteTarget(selected) }}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${MATTER_STATUS_MAP[selected.status].class}`}>{MATTER_STATUS_MAP[selected.status].label}</span>
                  <Badge variant="outline" className="text-[10px]">{selected.type}</Badge>
                  <span className="text-xs text-muted-foreground">{selected.client?.name}</span>
                </div>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                {/* Change status inline */}
                <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-md">
                  <span className="text-xs font-medium">Cambiar estado:</span>
                  {Object.entries(MATTER_STATUS_MAP).map(([k, v]) => (
                    <button type="button" key={k} onClick={() => changeStatus(selected.id, k as MatterStatus)}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all ${selected.status === k ? v.class : 'border-border text-muted-foreground hover:border-foreground'}`}>
                      {v.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Partes', value: selected.parties },
                    { label: 'Jurisdicción', value: selected.jurisdiction },
                    { label: 'Estado procesal', value: selected.process_state },
                    { label: 'Riesgo estimado', value: selected.estimated_risk },
                  ].filter(i => i.value).map(item => (
                    <div key={item.label} className="bg-muted/40 rounded-md p-2.5">
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">{item.label}</p>
                      <p className="text-xs text-foreground">{item.value}</p>
                    </div>
                  ))}
                </div>

                {selected.success_probability !== undefined && (
                  <div className="bg-muted/40 rounded-md p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-semibold text-foreground">Probabilidad de éxito estimada</p>
                      <span className={`text-lg font-bold ${selected.success_probability >= 60 ? 'text-green-600' : selected.success_probability >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {selected.success_probability}%
                      </span>
                    </div>
                    <Progress value={selected.success_probability} className="h-2" />
                  </div>
                )}

                {selected.next_action && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <p className="text-xs font-semibold text-blue-900 mb-1">Próxima acción</p>
                    <p className="text-sm text-blue-800">{selected.next_action}</p>
                    {selected.next_deadline && (
                      <div className="flex items-center gap-1.5 mt-1.5 text-xs text-blue-700">
                        <Calendar className="w-3 h-3" />
                        <span>Vence: {new Date(selected.next_deadline).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Timeline */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actuaciones procesales</p>
                    <Button size="sm" variant="outline" className="h-7" onClick={() => { setEventForm(EMPTY_EVENT); setShowEventForm(true) }}>
                      <PlusCircle className="w-3 h-3 mr-1" />Agregar
                    </Button>
                  </div>
                  {selectedEvents.length > 0 ? (
                    <div className="relative">
                      <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
                      <div className="space-y-3 ml-8">
                        {selectedEvents.map((event, i) => (
                          <div key={event.id} className="relative">
                            <div className="absolute -left-[22px] top-1 w-2 h-2 rounded-full bg-brand-navy border-2 border-white shadow-sm" />
                            <p className="text-[10px] text-muted-foreground">{new Date(event.event_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            <p className="text-xs font-semibold text-foreground">{event.event_type}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{event.description}</p>
                            {i < selectedEvents.length - 1 && <Separator className="mt-2" />}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4 bg-muted/30 rounded-md">Sin actuaciones registradas</p>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Event Dialog */}
      <Dialog open={showEventForm} onOpenChange={setShowEventForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nueva actuación procesal</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Tipo de actuación *</Label>
              <Input value={eventForm.event_type} onChange={e => setEventForm(p => ({ ...p, event_type: e.target.value }))} placeholder="Audiencia, notificación, recurso..." className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={eventForm.event_date} onChange={e => setEventForm(p => ({ ...p, event_date: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descripción</Label>
              <Textarea value={eventForm.description} onChange={e => setEventForm(p => ({ ...p, description: e.target.value }))} rows={3} className="text-sm resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowEventForm(false)}>Cancelar</Button>
            <Button size="sm" onClick={addEvent} disabled={!eventForm.event_type.trim()}>Agregar actuación</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Form */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar asunto' : 'Nuevo asunto'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Título *</Label>
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Nombre del asunto o caso" className="h-8 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Cliente *</Label>
                <Select value={form.client_id} onValueChange={v => setForm(p => ({ ...p, client_id: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name.split(' ').slice(0, 2).join(' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v as typeof TYPES[number] }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Área de práctica</Label>
                <Select value={form.practice_area_id} onValueChange={v => setForm(p => ({ ...p, practice_area_id: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{practiceAreas.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Estado</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v as MatterStatus }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activo">Activo</SelectItem>
                    <SelectItem value="en_pausa">En pausa</SelectItem>
                    <SelectItem value="cerrado">Cerrado</SelectItem>
                    <SelectItem value="archivado">Archivado</SelectItem>
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
              <div className="space-y-1">
                <Label className="text-xs">Probabilidad éxito (%)</Label>
                <Input type="number" min="0" max="100" value={form.success_probability} onChange={e => setForm(p => ({ ...p, success_probability: e.target.value }))} placeholder="0-100" className="h-8 text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Partes</Label>
              <Input value={form.parties} onChange={e => setForm(p => ({ ...p, parties: e.target.value }))} placeholder="Demandante vs. Demandado" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Jurisdicción</Label>
              <Input value={form.jurisdiction} onChange={e => setForm(p => ({ ...p, jurisdiction: e.target.value }))} placeholder="Juzgado, ciudad..." className="h-8 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Estado procesal</Label>
                <Input value={form.process_state} onChange={e => setForm(p => ({ ...p, process_state: e.target.value }))} placeholder="Etapa actual" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Próximo vencimiento</Label>
                <Input type="date" value={form.next_deadline} onChange={e => setForm(p => ({ ...p, next_deadline: e.target.value }))} className="h-8 text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Próxima acción recomendada</Label>
              <Textarea value={form.next_action} onChange={e => setForm(p => ({ ...p, next_action: e.target.value }))} rows={2} className="text-sm resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button size="sm" onClick={saveMatter} disabled={!form.title.trim() || !form.client_id}>{editing ? 'Guardar cambios' : 'Crear asunto'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-600"><AlertCircle className="w-4 h-4" />Eliminar asunto</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">¿Confirma eliminar <strong>{deleteTarget?.title}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button size="sm" variant="destructive" onClick={deleteMatter}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {toast && <Toast msg={toast} onClose={() => setToast('')} />}
    </div>
  )
}
