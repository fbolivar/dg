"use client"
import { useState, useEffect, useMemo } from 'react'
import { Repeat, Plus, Edit2, Trash2, X, Save, Play, ToggleLeft, ToggleRight, Zap } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useData } from '@/shared/context/data-context'
import { getRecurringFees, createRecurringFee, updateRecurringFee, deleteRecurringFee, generateIgualasNow } from '@/shared/services/db'
import { fmtMoney, fmtDate } from '@/shared/lib/dgatime-format'
import type { RecurringFee, RecurringFrequency, InvoiceType, DgaCurrency } from '@/shared/types'

const FREQ_LABEL: Record<RecurringFrequency, string> = { mensual: 'Mensual', trimestral: 'Trimestral', anual: 'Anual' }

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  return <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-foreground text-background text-sm px-4 py-3 rounded-xl shadow-lg">{msg}<button type="button" title="Cerrar" onClick={onClose}><X className="w-3.5 h-3.5" /></button></div>
}

const today = () => new Date().toISOString().slice(0, 10)
const emptyForm = () => ({ id: '', client_id: '', matter_id: '', type: 'iguala' as InvoiceType, description: '', amount: '', currency: 'COP' as DgaCurrency, tax_rate: '19', frequency: 'mensual' as RecurringFrequency, day_of_month: '1', start_date: today(), end_date: '', active: true })

export default function IgualasPage() {
  const { clients, matters } = useData()
  const [fees, setFees] = useState<RecurringFee[]>([])
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState(false)
  const [editing, setEditing] = useState<RecurringFee | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [confirmDel, setConfirmDel] = useState<RecurringFee | null>(null)
  const [generating, setGenerating] = useState(false)
  const [toast, setToast] = useState('')
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3500) }

  async function load() {
    setLoading(true)
    try { setFees(await getRecurringFees()) } catch { /* noop */ }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const mattersForClient = useMemo(() => matters.filter(m => !form.client_id || m.client_id === form.client_id), [matters, form.client_id])

  function openNew() { setEditing(null); setForm(emptyForm()); setDialog(true) }
  function openEdit(f: RecurringFee) {
    setEditing(f)
    setForm({
      id: f.id, client_id: f.client_id, matter_id: f.matter_id ?? '', type: f.type, description: f.description,
      amount: String(f.amount), currency: f.currency, tax_rate: String(f.tax_rate), frequency: f.frequency,
      day_of_month: String(f.day_of_month), start_date: f.start_date.slice(0, 10), end_date: f.end_date?.slice(0, 10) ?? '', active: f.active,
    })
    setDialog(true)
  }

  async function save() {
    if (!form.client_id) { showToast('Selecciona un cliente'); return }
    if (!form.description.trim()) { showToast('Agrega una descripción'); return }
    const amount = Number(form.amount) || 0
    if (amount <= 0) { showToast('Indica el monto'); return }
    const payload = {
      client_id: form.client_id,
      matter_id: form.matter_id || undefined,
      type: form.type,
      description: form.description.trim(),
      amount,
      currency: form.currency,
      tax_rate: Number(form.tax_rate) || 0,
      frequency: form.frequency,
      day_of_month: Math.min(28, Math.max(1, Number(form.day_of_month) || 1)),
      start_date: form.start_date || today(), // vacío → hoy (columna date no acepta '')
      end_date: form.end_date || undefined,
      active: form.active,
    }
    try {
      if (editing) await updateRecurringFee(editing.id, payload)
      else await createRecurringFee(payload)
      setDialog(false); setEditing(null); await load()
      showToast(editing ? 'Iguala actualizada' : 'Iguala creada')
    } catch (err) { showToast(err instanceof Error ? err.message : 'No se pudo guardar') }
  }

  async function toggleActive(f: RecurringFee) {
    try { await updateRecurringFee(f.id, { active: !f.active }); await load(); showToast(f.active ? 'Iguala pausada' : 'Iguala reactivada') }
    catch (err) { showToast(err instanceof Error ? err.message : 'Error') }
  }
  async function remove(f: RecurringFee) {
    try { await deleteRecurringFee(f.id); setConfirmDel(null); await load(); showToast('Iguala eliminada') }
    catch (err) { setConfirmDel(null); showToast(err instanceof Error ? err.message : 'Error') }
  }
  async function generarAhora() {
    if (generating) return
    setGenerating(true)
    try {
      const res = await generateIgualasNow()
      await load()
      showToast(res.generated > 0 ? `${res.generated} factura(s) generada(s) en estado borrador` : 'No hay igualas que generar hoy')
    } catch (err) { showToast(err instanceof Error ? err.message : 'Error') }
    setGenerating(false)
  }

  const activas = fees.filter(f => f.active).length

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold font-playfair flex items-center gap-2"><Repeat className="w-6 h-6 text-brand-gold" />Igualas y cobros recurrentes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Configura el cobro una vez; el sistema genera la factura cada período automáticamente (como borrador para revisión).</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={generarAhora} disabled={generating}><Zap className="w-4 h-4 mr-1.5" />{generating ? 'Generando…' : 'Generar ahora'}</Button>
          <Button type="button" onClick={openNew}><Plus className="w-4 h-4 mr-1.5" />Nueva iguala</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Igualas configuradas</p><p className="text-2xl font-bold mt-1">{fees.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Activas</p><p className="text-2xl font-bold mt-1">{activas}</p></CardContent></Card>
        <Card className="bg-gradient-to-br from-brand-gold/5 to-brand-gold/10 border-brand-gold/30"><CardContent className="p-4"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Generación automática</p><p className="text-sm font-bold mt-1 flex items-center gap-1.5"><Play className="w-3.5 h-3.5 text-brand-gold" />Diaria · 06:00</p><p className="text-[10px] text-muted-foreground">Crea borradores al vencer cada período</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Cargando…</div>
          ) : fees.length === 0 ? (
            <div className="py-12 text-center">
              <Repeat className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No hay igualas configuradas</p>
              <p className="text-xs text-muted-foreground mt-0.5">Crea una para empezar a facturar cobros recurrentes automáticamente.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead><TableHead>Descripción</TableHead><TableHead>Frecuencia</TableHead>
                  <TableHead>Monto</TableHead><TableHead>Última generada</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fees.map(f => (
                  <TableRow key={f.id}>
                    <TableCell className="text-xs font-medium">{f.client?.name ?? clients.find(c => c.id === f.client_id)?.name ?? '—'}</TableCell>
                    <TableCell className="text-xs max-w-[200px]"><span className="truncate block">{f.description}</span><span className="text-[10px] text-muted-foreground">{f.type === 'iguala' ? 'Iguala' : 'Recurrente'}</span></TableCell>
                    <TableCell className="text-xs">{FREQ_LABEL[f.frequency]}<span className="text-[10px] text-muted-foreground block">día {f.day_of_month}</span></TableCell>
                    <TableCell className="text-xs font-semibold whitespace-nowrap">{fmtMoney(f.amount, f.currency)}<span className="text-[10px] text-muted-foreground font-normal block">+{f.tax_rate}% IVA</span></TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{f.last_generated_period ? fmtDate(f.last_generated_period, { month: 'short', year: 'numeric' }) : 'Nunca'}</TableCell>
                    <TableCell><span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${f.active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>{f.active ? 'Activa' : 'Pausada'}</span></TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" title={f.active ? 'Pausar' : 'Reactivar'} onClick={() => toggleActive(f)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">{f.active ? <ToggleRight className="w-4 h-4 text-green-600" /> : <ToggleLeft className="w-4 h-4" />}</button>
                        <button type="button" title="Editar" onClick={() => openEdit(f)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Edit2 className="w-3 h-3" /></button>
                        <button type="button" title="Eliminar" onClick={() => setConfirmDel(f)} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog crear/editar */}
      <Dialog open={dialog} onOpenChange={v => { if (!v) { setDialog(false); setEditing(null) } }}>
        <DialogContent className="max-w-md max-h-[88vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar iguala' : 'Nueva iguala'}</DialogTitle></DialogHeader>
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
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none" className="text-xs">— Sin asunto —</SelectItem>{mattersForClient.map(m => <SelectItem key={m.id} value={m.id} className="text-xs">{m.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descripción *</Label>
              <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="text-sm" placeholder="Ej. Asesoría legal mensual" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v as InvoiceType }))}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="iguala" className="text-xs">Iguala</SelectItem><SelectItem value="recurrente" className="text-xs">Recurrente</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Frecuencia</Label>
                <Select value={form.frequency} onValueChange={v => setForm(p => ({ ...p, frequency: v as RecurringFrequency }))}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(FREQ_LABEL) as RecurringFrequency[]).map(fq => <SelectItem key={fq} value={fq} className="text-xs">{FREQ_LABEL[fq]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5"><Label className="text-xs">Monto</Label><Input type="number" min="0" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} className="text-sm" placeholder="0" /></div>
              <div className="space-y-1.5">
                <Label className="text-xs">Moneda</Label>
                <Select value={form.currency} onValueChange={v => setForm(p => ({ ...p, currency: v as DgaCurrency }))}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="COP" className="text-xs">COP</SelectItem><SelectItem value="USD" className="text-xs">USD</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">IVA %</Label><Input type="number" min="0" value={form.tax_rate} onChange={e => setForm(p => ({ ...p, tax_rate: e.target.value }))} className="text-sm" /></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5"><Label className="text-xs">Día emisión</Label><Input type="number" min="1" max="28" value={form.day_of_month} onChange={e => setForm(p => ({ ...p, day_of_month: e.target.value }))} className="text-sm" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Inicio</Label><Input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} className="text-sm" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Fin (opc.)</Label><Input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} className="text-sm" /></div>
            </div>
            <button type="button" onClick={() => setForm(p => ({ ...p, active: !p.active }))} className="flex items-center justify-between w-full pt-1">
              <span className="text-xs font-medium">Activa (genera automáticamente)</span>
              {form.active ? <ToggleRight className="w-7 h-7 text-green-600" /> : <ToggleLeft className="w-7 h-7 text-muted-foreground" />}
            </button>
            <div className="flex gap-2 pt-1">
              <Button type="button" size="sm" className="flex-1" onClick={save}>{editing ? <><Save className="w-3.5 h-3.5 mr-1.5" />Guardar</> : <><Plus className="w-3.5 h-3.5 mr-1.5" />Crear</>}</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => { setDialog(false); setEditing(null) }}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmar eliminación */}
      <Dialog open={!!confirmDel} onOpenChange={v => { if (!v) setConfirmDel(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-600"><Trash2 className="w-4 h-4" />Eliminar iguala</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mt-2">¿Eliminar esta iguala? Dejará de generar facturas. Las ya emitidas no se afectan.</p>
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
