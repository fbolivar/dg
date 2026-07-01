"use client"
import { useState, useEffect } from 'react'
import { Clock, FileText, Plus, Pencil, Trash2, AlertCircle, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { useData } from '@/shared/context/data-context'
import * as db from '@/shared/services/db'
import type { Matter, MatterEvent, MatterStatus } from '@/shared/types'
import { MatterFormDialog, EMPTY_FORM } from './_components/matter-form-dialog'
import { MatterDetailDialog, MATTER_STATUS_MAP } from './_components/matter-detail-dialog'

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

  useEffect(() => { setMatters(dbMatters.map(m => ({ ...m }))) }, [dbMatters])
  useEffect(() => { setEvents(dbMatterEvents.map(e => ({ ...e }))) }, [dbMatterEvents])
  const [selected, setSelected] = useState<Matter | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Matter | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<Matter | null>(null)
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
      budget_hours: m.budget_hours != null ? String(m.budget_hours) : '',
      budget_amount: m.budget_amount != null ? String(m.budget_amount) : '',
      budget_currency: m.budget_currency ?? 'COP',
      outcome: m.outcome ?? 'en_curso',
      satisfaction: m.satisfaction != null ? String(m.satisfaction) : '',
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
      // Fecha opcional: vacío → undefined (una cadena '' rompe la columna timestamptz).
      next_deadline: form.next_deadline || undefined,
      success_probability: form.success_probability ? parseInt(form.success_probability) : undefined,
      budget_hours: form.budget_hours ? Number(form.budget_hours) : undefined,
      budget_amount: form.budget_amount ? Number(form.budget_amount) : undefined,
      budget_currency: form.budget_currency,
      satisfaction: form.satisfaction ? Number(form.satisfaction) : undefined,
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
      if (!created) { showToast('No se pudo crear el asunto'); return } // no reportar éxito falso
      setMatters(prev => [{ ...created, client, practice_area: pa, assigned_user: user }, ...prev])
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

  const recordDeadline = async (onTime: boolean) => {
    if (!selected) return
    await db.recordMatterDeadline(selected.id, onTime)
    const upd = { deadlines_total: (selected.deadlines_total ?? 0) + 1, deadlines_ontime: (selected.deadlines_ontime ?? 0) + (onTime ? 1 : 0) }
    setMatters(prev => prev.map(m => m.id === selected.id ? { ...m, ...upd } : m))
    setSelected(prev => prev ? { ...prev, ...upd } : prev)
    showToast(onTime ? 'Plazo registrado: a tiempo' : 'Plazo registrado: tarde')
  }

  const changeStatus = async (matterId: string, status: MatterStatus) => {
    await db.updateMatter(matterId, { status })
    setMatters(prev => prev.map(m => m.id === matterId ? { ...m, status } : m))
    setSelected(prev => prev?.id === matterId ? { ...prev, status } : prev)
    showToast(`Estado cambiado a "${MATTER_STATUS_MAP[status].label}"`)
  }

  const addEvent = async (data: { event_type: string; event_date: string; description: string }) => {
    if (!data.event_type.trim() || !selected) return
    const eventData = {
      matter_id: selected.id,
      event_type: data.event_type, event_date: data.event_date || new Date().toISOString().split('T')[0],
      description: data.description, created_by: 'u1', created_at: new Date().toISOString(),
    }
    const created = await db.createMatterEvent(eventData)
    if (created) setEvents(prev => [...prev, created])
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

      <MatterDetailDialog
        selected={selected}
        events={selectedEvents}
        onClose={() => setSelected(null)}
        onEdit={openEdit}
        onDeleteRequest={setDeleteTarget}
        onChangeStatus={changeStatus}
        onRecordDeadline={recordDeadline}
        onAddEvent={addEvent}
      />

      <MatterFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        editing={!!editing}
        form={form}
        setForm={setForm}
        onSave={saveMatter}
        clients={clients}
        practiceAreas={practiceAreas}
        users={users}
      />

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
