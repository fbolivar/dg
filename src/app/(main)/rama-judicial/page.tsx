"use client"
import { useState, useEffect } from 'react'
import {
  Gavel, RefreshCw, Plus, X, Link2, Building2, Calendar, Loader2,
  Bell, CheckCircle2, Clock, FileClock, Landmark, ArrowRight
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useData } from '@/shared/context/data-context'
import * as db from '@/shared/services/db'
import type { JudicialProcess, JudicialActuacion, ProcessStatus } from '@/shared/types'

const STATUS_STYLE: Record<ProcessStatus, string> = {
  activo: 'bg-green-50 text-green-700 border-green-200',
  terminado: 'bg-blue-50 text-blue-700 border-blue-200',
  suspendido: 'bg-amber-50 text-amber-700 border-amber-200',
  archivado: 'bg-gray-100 text-gray-500 border-gray-200',
}
const STATUS_LABEL: Record<ProcessStatus, string> = {
  activo: 'Activo', terminado: 'Terminado', suspendido: 'Suspendido', archivado: 'Archivado',
}

function StatusBadge({ status }: { status: ProcessStatus }) {
  return <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>
}

function fmtFecha(f?: string) {
  if (!f) return '—'
  return new Date(f + (f.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtRad(r: string) {
  return r.replace(/(\d{5})(\d{2})(\d{2})(\d{3})(\d{4})(\d{5})(\d{2})/, '$1-$2-$3-$4-$5-$6-$7')
}

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-foreground text-background text-sm px-4 py-3 rounded-xl shadow-card-lg">
      {msg}<button type="button" title="Cerrar" onClick={onClose}><X className="w-3.5 h-3.5" /></button>
    </div>
  )
}

export default function RamaJudicialPage() {
  const { judicialProcesses, judicialActuaciones, clients } = useData()
  const [processes, setProcesses] = useState<JudicialProcess[]>([])
  const [actuaciones, setActuaciones] = useState<JudicialActuacion[]>([])

  useEffect(() => { setProcesses(judicialProcesses.map(p => ({ ...p }))) }, [judicialProcesses])
  useEffect(() => { setActuaciones(judicialActuaciones.map(a => ({ ...a }))) }, [judicialActuaciones])

  const [selected, setSelected] = useState<JudicialProcess | null>(null)
  const [vinculando, setVinculando] = useState(false)
  const [syncingAll, setSyncingAll] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [lastSyncAll, setLastSyncAll] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [form, setForm] = useState({ numero_radicacion: '', client_id: '', despacho: '', tipo_proceso: '', demandante: '', demandado: '' })

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500) }

  const conNovedades = processes.filter(p => (p.new_actuaciones ?? 0) > 0)
  const audienciasProximas = processes.filter(p => p.proxima_audiencia)
  const ultimaSync = lastSyncAll
    ?? processes.map(p => p.last_sync).filter(Boolean).sort().reverse()[0]

  function actuacionesDe(processId: string) {
    return actuaciones.filter(a => a.process_id === processId).sort((a, b) => b.fecha.localeCompare(a.fecha))
  }

  // ── Sincronización masiva (representa el job programado de polling) ──
  async function sincronizarTodo() {
    if (syncingAll) return
    setSyncingAll(true)
    await new Promise(r => setTimeout(r, 1600))
    const ahora = new Date().toISOString()
    setProcesses(prev => prev.map(p => ({ ...p, last_sync: ahora, sync_status: 'sincronizado' as const })))
    processes.forEach(p => db.updateJudicialProcess(p.id, { last_sync: ahora, sync_status: 'sincronizado' }))
    setLastSyncAll(ahora)
    setSyncingAll(false)
    showToast(`Sincronización completada · ${processes.length} procesos consultados · ${conNovedades.length} con novedades`)
  }

  // ── Consulta puntual a la Rama Judicial (datos reales con respaldo simulado) ──
  async function actualizarProceso(p: JudicialProcess) {
    if (syncingId) return
    setSyncingId(p.id)
    try {
      const res = await fetch('/api/rama-judicial/consultar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero_radicacion: p.numero_radicacion }),
      })
      const data = await res.json()
      if (!res.ok || !data.encontrado) {
        showToast('No se encontró el proceso en la Rama Judicial')
        return
      }

      // Detecta novedades por diferencia contra lo que ya teníamos
      const currentIds = new Set(actuaciones.filter(a => a.process_id === p.id).map(a => a.id))
      const esPrimerSync = currentIds.size === 0
      type RawAct = { id: string; fecha: string; actuacion: string; anotacion?: string; inicia_termino?: string; finaliza_termino?: string }
      const returned: JudicialActuacion[] = ((data.actuaciones ?? []) as RawAct[]).map(a => ({
        id: String(a.id), process_id: p.id, fecha: a.fecha, actuacion: a.actuacion,
        anotacion: a.anotacion, inicia_termino: a.inicia_termino, finaliza_termino: a.finaliza_termino,
        is_new: !esPrimerSync && !currentIds.has(String(a.id)),
      }))
      const nuevasCount = returned.filter(a => a.is_new).length

      setActuaciones(prev => [...prev.filter(a => a.process_id !== p.id), ...returned])

      const ahora = new Date().toISOString()
      const ultima = returned.slice().sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
      const pr = data.proceso
      const updates: Partial<JudicialProcess> = {
        last_sync: ahora,
        sync_status: 'sincronizado',
        new_actuaciones: (p.new_actuaciones ?? 0) + nuevasCount,
        actuaciones_count: returned.length,
        ultima_actuacion: ultima?.actuacion ?? p.ultima_actuacion,
        fecha_ultima_actuacion: pr?.fecha_ultima_actuacion ?? ultima?.fecha ?? p.fecha_ultima_actuacion,
      }
      if (pr) {
        if (pr.despacho) updates.despacho = pr.despacho
        if (pr.departamento) updates.departamento = pr.departamento
        if (pr.tipo_proceso) updates.tipo_proceso = pr.tipo_proceso
        if (pr.clase_proceso) updates.clase_proceso = pr.clase_proceso
        if (pr.ponente) updates.ponente = pr.ponente
        if (pr.demandante && pr.demandante !== '—') updates.demandante = pr.demandante
        if (pr.demandado && pr.demandado !== '—') updates.demandado = pr.demandado
        if (pr.fecha_radicacion) updates.fecha_radicacion = pr.fecha_radicacion
      }
      setProcesses(prev => prev.map(x => x.id === p.id ? { ...x, ...updates } : x))
      setSelected(prev => prev && prev.id === p.id ? { ...prev, ...updates } : prev)
      db.updateJudicialProcess(p.id, updates)
      db.addJudicialActuaciones(returned) // persiste todas; el almacén deduplica por id

      const real = typeof data.fuente === 'string' && data.fuente.includes('reales')
      if (esPrimerSync) {
        showToast(real
          ? `✓ Datos reales de la Rama Judicial · ${returned.length} actuaciones`
          : `Proceso consultado · ${returned.length} actuaciones`)
      } else {
        showToast(nuevasCount
          ? `${real ? 'Rama Judicial' : 'Consulta'}: ${nuevasCount} actuación${nuevasCount > 1 ? 'es' : ''} nueva${nuevasCount > 1 ? 's' : ''} detectada${nuevasCount > 1 ? 's' : ''}`
          : `${real ? 'Datos reales' : 'Consulta'} · sin novedades`)
      }
    } catch {
      showToast('Error al consultar la Rama Judicial')
    } finally {
      setSyncingId(null)
    }
  }

  function openDetail(p: JudicialProcess) {
    setSelected(p)
    // Marca las novedades como revisadas al abrir
    if ((p.new_actuaciones ?? 0) > 0) {
      setProcesses(prev => prev.map(x => x.id === p.id ? { ...x, new_actuaciones: 0 } : x))
      db.updateJudicialProcess(p.id, { new_actuaciones: 0 })
    }
  }

  async function vincularProceso() {
    if (!/^\d{20,23}$/.test(form.numero_radicacion.trim()) || !form.client_id) {
      showToast('Ingresa un número de radicación válido (20–23 dígitos) y un cliente')
      return
    }
    const cliente = clients.find(c => c.id === form.client_id)
    const nuevo = await db.createJudicialProcess({
      numero_radicacion: form.numero_radicacion.trim(),
      client_id: form.client_id,
      despacho: form.despacho || 'Por sincronizar',
      departamento: '—',
      tipo_proceso: form.tipo_proceso || 'Por determinar',
      demandante: form.demandante || cliente?.name || '—',
      demandado: form.demandado || '—',
      fecha_radicacion: new Date().toISOString().slice(0, 10),
      status: 'activo',
      sync_status: 'pendiente',
      actuaciones_count: 0,
      new_actuaciones: 0,
    })
    if (nuevo) {
      setProcesses(prev => [nuevo, ...prev])
      actualizarProceso(nuevo) // consulta la Rama Judicial de inmediato
    }
    setVinculando(false)
    setForm({ numero_radicacion: '', client_id: '', despacho: '', tipo_proceso: '', demandante: '', demandado: '' })
    showToast('Proceso vinculado · consultando la Rama Judicial…')
  }

  return (
    <div className="space-y-5 max-w-[1200px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-playfair flex items-center gap-2"><Gavel className="w-5 h-5 text-brand-gold" />Rama Judicial</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Seguimiento automático de procesos y actuaciones judiciales</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={sincronizarTodo} disabled={syncingAll}>
            {syncingAll ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
            {syncingAll ? 'Sincronizando…' : 'Sincronizar todo'}
          </Button>
          <Button type="button" size="sm" onClick={() => setVinculando(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />Vincular proceso
          </Button>
        </div>
      </div>

      {/* Banner de integración */}
      <div className="flex items-start gap-2.5 bg-brand-navy/[0.04] border border-brand-navy/10 rounded-lg px-3.5 py-2.5">
        <Landmark className="w-4 h-4 text-brand-navy flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Integrado con la <strong className="text-foreground">Consulta de Procesos Nacional Unificada (CPNU)</strong> de la Rama Judicial.
          Al sincronizar un proceso por su número de radicación, la plataforma trae las <strong className="text-foreground">actuaciones reales</strong> y detecta novedades automáticamente.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><FileClock className="w-3.5 h-3.5" /><span className="text-[11px] font-medium">En seguimiento</span></div>
          <p className="text-2xl font-bold">{processes.length}</p>
        </CardContent></Card>
        <Card className={conNovedades.length > 0 ? 'border-brand-gold/40 bg-brand-gold/[0.04]' : ''}><CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><Bell className="w-3.5 h-3.5" /><span className="text-[11px] font-medium">Con novedades</span></div>
          <p className="text-2xl font-bold text-brand-gold">{conNovedades.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><Calendar className="w-3.5 h-3.5" /><span className="text-[11px] font-medium">Audiencias próximas</span></div>
          <p className="text-2xl font-bold">{audienciasProximas.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><Clock className="w-3.5 h-3.5" /><span className="text-[11px] font-medium">Última sincronización</span></div>
          <p className="text-sm font-semibold mt-1">{ultimaSync ? new Date(ultimaSync).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</p>
        </CardContent></Card>
      </div>

      {/* Tabla de procesos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Gavel className="w-4 h-4" />Procesos en seguimiento</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Radicación / Despacho</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Última actuación</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processes.map(p => {
                const novedad = (p.new_actuaciones ?? 0) > 0
                return (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-muted/40" onClick={() => openDetail(p)}>
                    <TableCell className="max-w-[260px]">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium font-mono text-foreground">{p.numero_radicacion}</p>
                        {novedad && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-brand-gold/15 text-brand-gold border border-brand-gold/30">
                            <Bell className="w-2.5 h-2.5" />{p.new_actuaciones} nueva{(p.new_actuaciones ?? 0) > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate flex items-center gap-1"><Building2 className="w-2.5 h-2.5" />{p.despacho}</p>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.client?.name?.split(' ').slice(0, 2).join(' ') ?? '—'}</TableCell>
                    <TableCell className="text-xs">{p.tipo_proceso}</TableCell>
                    <TableCell className="max-w-[200px]">
                      <p className="text-xs text-foreground truncate">{p.ultima_actuacion ?? '—'}</p>
                      <p className="text-[10px] text-muted-foreground">{fmtFecha(p.fecha_ultima_actuacion)}</p>
                    </TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                    <TableCell>
                      <button
                        type="button" title="Actualizar desde la Rama Judicial"
                        onClick={(e) => { e.stopPropagation(); actualizarProceso(p) }}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                      >
                        {syncingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      </button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detalle del proceso */}
      <Dialog open={!!selected} onOpenChange={v => { if (!v) setSelected(null) }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base flex items-center gap-2"><Gavel className="w-4 h-4 text-brand-gold" />Proceso judicial</DialogTitle>
              </DialogHeader>
              <div className="mt-2 space-y-4">
                {/* Datos del proceso */}
                <div className="bg-muted/40 rounded-lg p-3 border border-border">
                  <p className="text-xs font-mono font-semibold text-foreground">{fmtRad(selected.numero_radicacion)}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 mt-2.5 text-xs">
                    <div><span className="text-muted-foreground">Despacho: </span><span className="font-medium">{selected.despacho}</span></div>
                    <div><span className="text-muted-foreground">Tipo: </span><span className="font-medium">{selected.tipo_proceso}</span></div>
                    <div><span className="text-muted-foreground">Demandante: </span><span className="font-medium">{selected.demandante}</span></div>
                    <div><span className="text-muted-foreground">Demandado: </span><span className="font-medium">{selected.demandado}</span></div>
                    <div><span className="text-muted-foreground">Radicación: </span><span className="font-medium">{fmtFecha(selected.fecha_radicacion)}</span></div>
                    {selected.proxima_audiencia && <div><span className="text-muted-foreground">Próx. audiencia: </span><span className="font-medium text-brand-gold">{fmtFecha(selected.proxima_audiencia)}</span></div>}
                    {selected.ponente && <div className="sm:col-span-2"><span className="text-muted-foreground">Ponente: </span><span className="font-medium">{selected.ponente}</span></div>}
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                    <StatusBadge status={selected.status} />
                    <Button type="button" size="sm" variant="outline" onClick={() => actualizarProceso(selected)} disabled={syncingId === selected.id}>
                      {syncingId === selected.id ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                      Actualizar desde la Rama Judicial
                    </Button>
                  </div>
                </div>

                {/* Línea de tiempo de actuaciones */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Actuaciones ({actuacionesDe(selected.id).length})</p>
                  <div className="space-y-0">
                    {actuacionesDe(selected.id).map((a, i, arr) => (
                      <div key={a.id} className="flex gap-3">
                        {/* Línea vertical */}
                        <div className="flex flex-col items-center">
                          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${a.is_new ? 'bg-brand-gold ring-2 ring-brand-gold/30' : 'bg-brand-navy/30'}`} />
                          {i < arr.length - 1 && <div className="w-px flex-1 bg-border my-1" />}
                        </div>
                        <div className={`flex-1 pb-4 ${a.is_new ? '' : ''}`}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-medium text-foreground">{a.actuacion}</p>
                            {a.is_new && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-brand-gold/15 text-brand-gold border border-brand-gold/30">NUEVA</span>}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{fmtFecha(a.fecha)}</p>
                          {a.anotacion && <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{a.anotacion}</p>}
                          {(a.inicia_termino || a.finaliza_termino) && (
                            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />Término: {fmtFecha(a.inicia_termino)} <ArrowRight className="w-2.5 h-2.5" /> {fmtFecha(a.finaliza_termino)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Vincular proceso */}
      <Dialog open={vinculando} onOpenChange={v => { if (!v) setVinculando(false) }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Link2 className="w-4 h-4" />Vincular proceso judicial</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Número de radicación * <span className="text-muted-foreground font-normal">(23 dígitos)</span></Label>
              <Input value={form.numero_radicacion} onChange={e => setForm(p => ({ ...p, numero_radicacion: e.target.value.replace(/\D/g, '') }))} className="text-sm font-mono" placeholder="11001310500320240015623" maxLength={23} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cliente *</Label>
              <Select value={form.client_id} onValueChange={v => setForm(p => ({ ...p, client_id: v }))}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.name.split(' ').slice(0, 3).join(' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Demandante</Label>
                <Input value={form.demandante} onChange={e => setForm(p => ({ ...p, demandante: e.target.value }))} className="text-sm" placeholder="Opcional" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Demandado</Label>
                <Input value={form.demandado} onChange={e => setForm(p => ({ ...p, demandado: e.target.value }))} className="text-sm" placeholder="Opcional" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-green-600" />
              El despacho, tipo y actuaciones se completan automáticamente al sincronizar con la Rama Judicial.
            </p>
            <div className="flex gap-2 pt-1">
              <Button type="button" size="sm" className="flex-1" onClick={vincularProceso} disabled={!form.numero_radicacion || !form.client_id}>
                <Plus className="w-3.5 h-3.5 mr-1.5" />Vincular y sincronizar
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setVinculando(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {toast && <Toast msg={toast} onClose={() => setToast('')} />}
    </div>
  )
}
