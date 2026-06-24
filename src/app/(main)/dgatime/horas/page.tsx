"use client"
import { useState, useEffect, useRef, useMemo } from 'react'
import { Clock, Play, Pause, Plus, Edit2, Trash2, Check, X, Save, CircleSlash } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useData } from '@/shared/context/data-context'
import { useAuthStore } from '@/shared/stores/auth-store'
import { getTimeEntries, createTimeEntry, updateTimeEntry, deleteTimeEntry, approveTimeEntry } from '@/shared/services/db'
import { fmtMoney, fmtHours, fmtDate } from '@/shared/lib/dgatime-format'
import type { TimeEntry, TimeEntryStatus } from '@/shared/types'

const ACTIVITIES = ['Reunión', 'Redacción', 'Investigación', 'Audiencia', 'Llamada', 'Revisión documental', 'Gestión', 'Diligencia', 'Otro']

const STATUS_STYLE: Record<TimeEntryStatus, string> = {
  borrador: 'bg-gray-100 text-gray-600 border-gray-200',
  aprobado: 'bg-green-50 text-green-700 border-green-200',
  rechazado: 'bg-red-50 text-red-700 border-red-200',
  facturado: 'bg-brand-gold/10 text-brand-gold border-brand-gold/30',
}
const STATUS_LABEL: Record<TimeEntryStatus, string> = {
  borrador: 'Borrador', aprobado: 'Aprobado', rechazado: 'Rechazado', facturado: 'Facturado',
}

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-foreground text-background text-sm px-4 py-3 rounded-xl shadow-lg">
      {msg}<button type="button" title="Cerrar" onClick={onClose}><X className="w-3.5 h-3.5" /></button>
    </div>
  )
}

const today = () => new Date().toISOString().slice(0, 10)
const emptyForm = () => ({ id: '', client_id: '', matter_id: '', date: today(), horas: '', minutos: '', activity: 'Redacción', description: '', billable: true, rework: false })

export default function RegistroHorasPage() {
  const { clients, matters } = useData()
  const authUser = useAuthStore(s => s.user)
  const isManager = authUser?.role === 'socio' || authUser?.role === 'admin'

  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState(false)
  const [editing, setEditing] = useState<TimeEntry | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [toast, setToast] = useState('')
  const [confirmDel, setConfirmDel] = useState<TimeEntry | null>(null)
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000) }

  // ── Timer ──
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0) // segundos
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (running) { timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000) }
    else if (timerRef.current) { clearInterval(timerRef.current) }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [running])

  async function load() {
    setLoading(true)
    try { setEntries(await getTimeEntries()) } catch { /* noop */ }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const mattersForClient = useMemo(
    () => matters.filter(m => !form.client_id || m.client_id === form.client_id),
    [matters, form.client_id]
  )

  function openNew(prefillMinutes?: number) {
    setEditing(null)
    const f = emptyForm()
    if (prefillMinutes) { f.horas = String(Math.floor(prefillMinutes / 60)); f.minutos = String(prefillMinutes % 60) }
    setForm(f)
    setDialog(true)
  }
  function openEdit(e: TimeEntry) {
    setEditing(e)
    setForm({
      id: e.id, client_id: e.client_id, matter_id: e.matter_id ?? '', date: e.date.slice(0, 10),
      horas: String(Math.floor(e.minutes / 60)), minutos: String(e.minutes % 60),
      activity: e.activity || 'Redacción', description: e.description, billable: e.billable, rework: e.rework ?? false,
    })
    setDialog(true)
  }

  async function save() {
    const minutes = (Number(form.horas) || 0) * 60 + (Number(form.minutos) || 0)
    if (!form.client_id) { showToast('Selecciona un cliente'); return }
    if (minutes <= 0) { showToast('Indica la duración'); return }
    const payload = {
      client_id: form.client_id,
      matter_id: form.matter_id || undefined,
      date: form.date,
      minutes,
      activity: form.activity,
      description: form.description,
      billable: form.billable,
      rework: form.rework,
    }
    try {
      if (editing) await updateTimeEntry(editing.id, payload)
      else await createTimeEntry(payload)
      setDialog(false); setEditing(null)
      if (!editing) { setRunning(false); setElapsed(0) }
      await load()
      showToast(editing ? 'Registro actualizado' : 'Horas registradas')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo guardar')
    }
  }

  async function remove(e: TimeEntry) {
    try { await deleteTimeEntry(e.id); setConfirmDel(null); await load(); showToast('Registro eliminado') }
    catch (err) { setConfirmDel(null); showToast(err instanceof Error ? err.message : 'No se pudo eliminar') }
  }

  async function approve(e: TimeEntry, ok: boolean) {
    try { await approveTimeEntry(e.id, ok); await load(); showToast(ok ? 'Hora aprobada' : 'Hora rechazada') }
    catch (err) { showToast(err instanceof Error ? err.message : 'Error') }
  }

  // ── KPIs de la cabecera ──
  const totalMin = entries.reduce((s, e) => s + e.minutes, 0)
  const billableMin = entries.filter(e => e.billable).reduce((s, e) => s + e.minutes, 0)
  const utilization = totalMin > 0 ? Math.round((billableMin / totalMin) * 100) : 0
  const pendientes = entries.filter(e => e.status === 'borrador').length

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold font-playfair flex items-center gap-2"><Clock className="w-6 h-6 text-brand-gold" />Registro de horas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Carga tus horas por cliente y asunto. {isManager ? 'Como socio, ves y apruebas las del equipo.' : 'Un socio aprobará tus horas antes de facturarse.'}</p>
        </div>
        <Button type="button" onClick={() => openNew()}><Plus className="w-4 h-4 mr-1.5" />Cargar horas</Button>
      </div>

      {/* Timer + KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="sm:col-span-1 border-brand-gold/30 bg-gradient-to-br from-brand-gold/5 to-brand-gold/10">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Cronómetro</p>
            <p className="text-2xl font-bold tabular-nums text-foreground mt-1">
              {String(Math.floor(elapsed / 3600)).padStart(2, '0')}:{String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Button type="button" size="sm" variant={running ? 'outline' : 'default'} onClick={() => setRunning(r => !r)} className="h-7 text-xs">
                {running ? <><Pause className="w-3 h-3 mr-1" />Pausar</> : <><Play className="w-3 h-3 mr-1" />Iniciar</>}
              </Button>
              {elapsed > 0 && (
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => openNew(Math.max(1, Math.round(elapsed / 60)))}>
                  Guardar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
        <Card><CardContent className="p-4"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Horas totales</p><p className="text-2xl font-bold mt-1">{fmtHours(totalMin)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Utilización (facturable)</p><p className="text-2xl font-bold mt-1">{utilization}%</p><p className="text-[10px] text-muted-foreground">{fmtHours(billableMin)} facturables</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Pendientes de aprobar</p><p className="text-2xl font-bold mt-1">{pendientes}</p></CardContent></Card>
      </div>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Cargando…</div>
          ) : entries.length === 0 ? (
            <div className="py-12 text-center">
              <Clock className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Aún no hay horas registradas</p>
              <p className="text-xs text-muted-foreground mt-0.5">Usa el cronómetro o &quot;Cargar horas&quot; para empezar.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  {isManager && <TableHead>Abogado</TableHead>}
                  <TableHead>Cliente / Asunto</TableHead>
                  <TableHead>Actividad</TableHead>
                  <TableHead>Duración</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs whitespace-nowrap">{fmtDate(e.date)}</TableCell>
                    {isManager && <TableCell className="text-xs">{e.user?.full_name?.split(' ').slice(0, 2).join(' ') ?? '—'}</TableCell>}
                    <TableCell className="text-xs max-w-[220px]">
                      <p className="font-medium truncate">{e.client?.name ?? clients.find(c => c.id === e.client_id)?.name ?? '—'}</p>
                      {e.matter_id && <p className="text-[10px] text-muted-foreground truncate">{e.matter?.title ?? matters.find(m => m.id === e.matter_id)?.title}</p>}
                    </TableCell>
                    <TableCell className="text-xs">
                      {e.activity}
                      {e.description && <p className="text-[10px] text-muted-foreground truncate max-w-[160px]">{e.description}</p>}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {fmtHours(e.minutes)}
                      {!e.billable && <span className="ml-1 text-[9px] text-muted-foreground">(no fact.)</span>}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{e.billable ? fmtMoney(e.amount, e.currency) : '—'}</TableCell>
                    <TableCell>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLE[e.status]}`}>{STATUS_LABEL[e.status]}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {isManager && e.status === 'borrador' && (
                          <>
                            <button type="button" title="Aprobar" onClick={() => approve(e, true)} className="p-1 rounded hover:bg-green-50 text-muted-foreground hover:text-green-600"><Check className="w-3.5 h-3.5" /></button>
                            <button type="button" title="Rechazar" onClick={() => approve(e, false)} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"><CircleSlash className="w-3.5 h-3.5" /></button>
                          </>
                        )}
                        {e.status !== 'facturado' && (
                          <>
                            <button type="button" title="Editar" onClick={() => openEdit(e)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Edit2 className="w-3 h-3" /></button>
                            <button type="button" title="Eliminar" onClick={() => setConfirmDel(e)} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog cargar/editar */}
      <Dialog open={dialog} onOpenChange={v => { if (!v) { setDialog(false); setEditing(null) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar registro' : 'Cargar horas'}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Cliente *</Label>
                <Select value={form.client_id} onValueChange={v => setForm(p => ({ ...p, client_id: v, matter_id: '' }))}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Cliente" /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Asunto</Label>
                <Select value={form.matter_id || 'none'} onValueChange={v => setForm(p => ({ ...p, matter_id: v === 'none' ? '' : v }))}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Asunto" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">— Sin asunto —</SelectItem>
                    {mattersForClient.map(m => <SelectItem key={m.id} value={m.id} className="text-xs">{m.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha</Label>
                <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Horas</Label>
                <Input type="number" min="0" value={form.horas} onChange={e => setForm(p => ({ ...p, horas: e.target.value }))} className="text-sm" placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Minutos</Label>
                <Input type="number" min="0" max="59" value={form.minutos} onChange={e => setForm(p => ({ ...p, minutos: e.target.value }))} className="text-sm" placeholder="0" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Actividad</Label>
              <Select value={form.activity} onValueChange={v => setForm(p => ({ ...p, activity: v }))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{ACTIVITIES.map(a => <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descripción</Label>
              <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="text-sm" placeholder="Detalle de la actividad" />
            </div>
            <div className="flex items-center gap-5">
              <button type="button" onClick={() => setForm(p => ({ ...p, billable: !p.billable }))} className="flex items-center gap-2 text-xs">
                <span className={`w-4 h-4 rounded border flex items-center justify-center ${form.billable ? 'bg-brand-gold border-brand-gold text-white' : 'border-muted-foreground/40'}`}>
                  {form.billable && <Check className="w-3 h-3" />}
                </span>
                Hora facturable
              </button>
              <button type="button" onClick={() => setForm(p => ({ ...p, rework: !p.rework }))} className="flex items-center gap-2 text-xs" title="Marca si esta hora corrige/rehace trabajo previo">
                <span className={`w-4 h-4 rounded border flex items-center justify-center ${form.rework ? 'bg-amber-500 border-amber-500 text-white' : 'border-muted-foreground/40'}`}>
                  {form.rework && <Check className="w-3 h-3" />}
                </span>
                Retrabajo
              </button>
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" size="sm" className="flex-1" onClick={save}>{editing ? <><Save className="w-3.5 h-3.5 mr-1.5" />Guardar</> : <><Plus className="w-3.5 h-3.5 mr-1.5" />Registrar</>}</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => { setDialog(false); setEditing(null) }}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmar eliminación */}
      <Dialog open={!!confirmDel} onOpenChange={v => { if (!v) setConfirmDel(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-600"><Trash2 className="w-4 h-4" />Eliminar registro</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mt-2">¿Eliminar este registro de horas? No se puede deshacer.</p>
          <div className="flex gap-2 pt-3">
            <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => setConfirmDel(null)}>Cancelar</Button>
            <Button type="button" size="sm" className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={() => confirmDel && remove(confirmDel)}><Trash2 className="w-3.5 h-3.5 mr-1.5" />Eliminar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {toast && <Toast msg={toast} onClose={() => setToast('')} />}
    </div>
  )
}
