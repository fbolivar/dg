"use client"
import { useState, useEffect, useMemo } from 'react'
import { Receipt, Plus, Trash2, X, Send, CheckCircle2, Ban, FileText, Check } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useData } from '@/shared/context/data-context'
import { getInvoices, getInvoiceItems, createInvoice, updateInvoiceStatus, deleteInvoice, getTimeEntries } from '@/shared/services/db'
import { fmtMoney, fmtHours, hoursDecimal, fmtDate } from '@/shared/lib/dgatime-format'
import type { Invoice, InvoiceItem, InvoiceType, InvoiceStatus, DgaCurrency, TimeEntry } from '@/shared/types'

const TYPE_LABEL: Record<InvoiceType, string> = {
  horas: 'Por horas', fijo: 'Monto fijo', hito: 'Por hito', iguala: 'Iguala', recurrente: 'Recurrente',
}
const STATUS_STYLE: Record<InvoiceStatus, string> = {
  borrador: 'bg-gray-100 text-gray-600 border-gray-200',
  enviada: 'bg-blue-50 text-blue-700 border-blue-200',
  pagada: 'bg-green-50 text-green-700 border-green-200',
  anulada: 'bg-red-50 text-red-600 border-red-200',
}

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  return <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-foreground text-background text-sm px-4 py-3 rounded-xl shadow-lg">{msg}<button type="button" title="Cerrar" onClick={onClose}><X className="w-3.5 h-3.5" /></button></div>
}

const today = () => new Date().toISOString().slice(0, 10)
type ManualItem = { description: string; quantity: string; unit_rate: string }

export default function FacturacionPage() {
  const { clients } = useData()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000) }

  const [dialog, setDialog] = useState(false)
  const [detail, setDetail] = useState<Invoice | null>(null)
  const [detailItems, setDetailItems] = useState<InvoiceItem[]>([])
  const [confirmDel, setConfirmDel] = useState<Invoice | null>(null)

  // formulario de creación
  const [type, setType] = useState<InvoiceType>('horas')
  const [clientId, setClientId] = useState('')
  const [currency, setCurrency] = useState<DgaCurrency>('COP')
  const [issueDate, setIssueDate] = useState(today())
  const [dueDate, setDueDate] = useState('')
  const [taxRate, setTaxRate] = useState('19')
  const [notes, setNotes] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set())
  const [manualItems, setManualItems] = useState<ManualItem[]>([{ description: '', quantity: '1', unit_rate: '' }])

  async function load() {
    setLoading(true)
    try { const [inv, te] = await Promise.all([getInvoices(), getTimeEntries()]); setInvoices(inv); setEntries(te) } catch { /* noop */ }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // Horas aprobadas, facturables y sin factura, del cliente y moneda elegidos
  const availableEntries = useMemo(
    () => entries.filter(e => e.status === 'aprobado' && e.billable && !e.invoice_id && e.client_id === clientId && e.currency === currency),
    [entries, clientId, currency]
  )

  function resetForm() {
    setType('horas'); setClientId(''); setCurrency('COP'); setIssueDate(today()); setDueDate('')
    setTaxRate('19'); setNotes(''); setPeriodStart(''); setPeriodEnd('')
    setSelectedEntries(new Set()); setManualItems([{ description: '', quantity: '1', unit_rate: '' }])
  }
  function openNew() { resetForm(); setDialog(true) }

  // Totales en vivo
  const liveItems = useMemo(() => {
    if (type === 'horas') {
      return availableEntries.filter(e => selectedEntries.has(e.id)).map(e => ({
        description: `${e.activity} · ${fmtDate(e.date)}${e.description ? ' — ' + e.description : ''}`,
        quantity: hoursDecimal(e.minutes), unit_rate: e.rate, amount: e.amount, time_entry_id: e.id,
      }))
    }
    return manualItems.map(it => {
      const q = Number(it.quantity) || 0, r = Number(it.unit_rate) || 0
      return { description: it.description, quantity: q, unit_rate: r, amount: Math.round(q * r), time_entry_id: undefined }
    }).filter(it => it.description && it.amount > 0)
  }, [type, availableEntries, selectedEntries, manualItems])

  const subtotal = liveItems.reduce((s, it) => s + it.amount, 0)
  const tax = Math.round(subtotal * (Number(taxRate) || 0) / 100)
  const total = subtotal + tax

  async function create() {
    if (!clientId) { showToast('Selecciona un cliente'); return }
    if (liveItems.length === 0) { showToast('Agrega al menos una línea / hora'); return }
    try {
      await createInvoice({
        client_id: clientId, type, currency, issue_date: issueDate,
        due_date: dueDate || undefined,
        period_start: periodStart || undefined, period_end: periodEnd || undefined,
        tax_rate: Number(taxRate) || 0, notes: notes || undefined,
        items: liveItems.map(it => ({ description: it.description, quantity: it.quantity, unit_rate: it.unit_rate, time_entry_id: it.time_entry_id })),
        time_entry_ids: type === 'horas' ? liveItems.map(it => it.time_entry_id!).filter(Boolean) : [],
      })
      setDialog(false); await load(); showToast('Factura creada')
    } catch (err) { showToast(err instanceof Error ? err.message : 'No se pudo crear') }
  }

  async function openDetail(inv: Invoice) {
    setDetail(inv)
    try { setDetailItems(await getInvoiceItems(inv.id)) } catch { setDetailItems([]) }
  }
  async function changeStatus(inv: Invoice, status: InvoiceStatus) {
    try { await updateInvoiceStatus(inv.id, status); await load(); setDetail(d => d && d.id === inv.id ? { ...d, status } : d); showToast('Estado actualizado') }
    catch (err) { showToast(err instanceof Error ? err.message : 'Error') }
  }
  async function remove(inv: Invoice) {
    try { await deleteInvoice(inv.id); setConfirmDel(null); setDetail(null); await load(); showToast('Factura eliminada') }
    catch (err) { setConfirmDel(null); showToast(err instanceof Error ? err.message : 'Error') }
  }

  const usesManual = type !== 'horas'
  const usesPeriod = type === 'iguala' || type === 'recurrente'

  // KPIs
  const facturado = invoices.filter(i => i.status !== 'anulada' && i.status !== 'borrador')
  const porCobrar = invoices.filter(i => i.status === 'enviada')

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold font-playfair flex items-center gap-2"><Receipt className="w-6 h-6 text-brand-gold" />Facturación</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Genera prefacturas desde las horas aprobadas o por monto fijo, hito, iguala y recurrente.</p>
        </div>
        <Button type="button" onClick={openNew}><Plus className="w-4 h-4 mr-1.5" />Nueva factura</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Facturas</p><p className="text-2xl font-bold mt-1">{invoices.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Emitidas (no anuladas)</p><p className="text-2xl font-bold mt-1">{facturado.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Por cobrar (enviadas)</p><p className="text-2xl font-bold mt-1">{porCobrar.length}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Cargando…</div>
          ) : invoices.length === 0 ? (
            <div className="py-12 text-center">
              <Receipt className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Aún no hay facturas</p>
              <p className="text-xs text-muted-foreground mt-0.5">Crea una desde las horas aprobadas o por monto fijo.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead><TableHead>Cliente</TableHead><TableHead>Tipo</TableHead>
                  <TableHead>Emisión</TableHead><TableHead>Total</TableHead><TableHead>Estado</TableHead><TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map(inv => (
                  <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/40" onClick={() => openDetail(inv)}>
                    <TableCell className="text-xs font-mono font-medium">{inv.number}</TableCell>
                    <TableCell className="text-xs">{inv.client?.name ?? clients.find(c => c.id === inv.client_id)?.name ?? '—'}</TableCell>
                    <TableCell className="text-xs">{TYPE_LABEL[inv.type]}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{fmtDate(inv.issue_date, { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                    <TableCell className="text-xs font-semibold whitespace-nowrap">{fmtMoney(inv.total, inv.currency)}</TableCell>
                    <TableCell><span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLE[inv.status]}`}>{inv.status}</span></TableCell>
                    <TableCell className="text-right"><FileText className="w-3.5 h-3.5 text-muted-foreground inline" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog crear factura */}
      <Dialog open={dialog} onOpenChange={v => { if (!v) setDialog(false) }}>
        <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nueva factura</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de cobro</Label>
                <Select value={type} onValueChange={v => setType(v as InvoiceType)}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(TYPE_LABEL) as InvoiceType[]).map(t => <SelectItem key={t} value={t} className="text-xs">{TYPE_LABEL[t]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cliente *</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Cliente" /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Moneda</Label>
                <Select value={currency} onValueChange={v => setCurrency(v as DgaCurrency)}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="COP" className="text-xs">COP</SelectItem><SelectItem value="USD" className="text-xs">USD</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Emisión</Label><Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className="text-sm" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Vencimiento</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="text-sm" /></div>
            </div>

            {usesPeriod && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5"><Label className="text-xs">Período desde</Label><Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="text-sm" /></div>
                <div className="space-y-1.5"><Label className="text-xs">Período hasta</Label><Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="text-sm" /></div>
              </div>
            )}

            {/* Horas aprobadas */}
            {type === 'horas' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Horas aprobadas a facturar {clientId && `(${availableEntries.length})`}</Label>
                {!clientId ? (
                  <p className="text-xs text-muted-foreground border border-dashed border-border rounded-md p-3">Selecciona un cliente para ver sus horas aprobadas.</p>
                ) : availableEntries.length === 0 ? (
                  <p className="text-xs text-muted-foreground border border-dashed border-border rounded-md p-3">No hay horas aprobadas, facturables y sin facturar para este cliente en {currency}.</p>
                ) : (
                  <div className="border border-border rounded-md divide-y divide-border max-h-44 overflow-y-auto">
                    {availableEntries.map(e => {
                      const sel = selectedEntries.has(e.id)
                      return (
                        <button type="button" key={e.id} onClick={() => setSelectedEntries(prev => { const n = new Set(prev); n.has(e.id) ? n.delete(e.id) : n.add(e.id); return n })} className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-muted/40">
                          <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${sel ? 'bg-brand-gold border-brand-gold text-white' : 'border-muted-foreground/40'}`}>{sel && <Check className="w-3 h-3" />}</span>
                          <span className="flex-1 min-w-0">
                            <span className="text-xs font-medium block truncate">{e.activity} · {fmtHours(e.minutes)}</span>
                            <span className="text-[10px] text-muted-foreground block truncate">{fmtDate(e.date)}{e.user?.full_name ? ' · ' + e.user.full_name.split(' ')[0] : ''}{e.description ? ' — ' + e.description : ''}</span>
                          </span>
                          <span className="text-xs font-semibold whitespace-nowrap">{fmtMoney(e.amount, e.currency)}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Líneas manuales */}
            {usesManual && (
              <div className="space-y-1.5">
                <Label className="text-xs">Conceptos</Label>
                {manualItems.map((it, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Input value={it.description} onChange={e => setManualItems(prev => prev.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} className="text-xs flex-1" placeholder="Concepto" />
                    <Input type="number" min="0" value={it.quantity} onChange={e => setManualItems(prev => prev.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))} className="text-xs w-14" placeholder="Cant." title="Cantidad" />
                    <Input type="number" min="0" value={it.unit_rate} onChange={e => setManualItems(prev => prev.map((x, j) => j === i ? { ...x, unit_rate: e.target.value } : x))} className="text-xs w-24" placeholder="Valor unit." title="Valor unitario" />
                    <button type="button" title="Quitar" onClick={() => setManualItems(prev => prev.filter((_, j) => j !== i))} className="p-1 text-muted-foreground hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setManualItems(prev => [...prev, { description: '', quantity: '1', unit_rate: '' }])}><Plus className="w-3 h-3 mr-1" />Agregar concepto</Button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 items-end">
              <div className="space-y-1.5"><Label className="text-xs">IVA %</Label><Input type="number" min="0" value={taxRate} onChange={e => setTaxRate(e.target.value)} className="text-sm" /></div>
              <div className="text-right">
                <p className="text-[11px] text-muted-foreground">Subtotal {fmtMoney(subtotal, currency)} · IVA {fmtMoney(tax, currency)}</p>
                <p className="text-lg font-bold">{fmtMoney(total, currency)}</p>
              </div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Notas</Label><Input value={notes} onChange={e => setNotes(e.target.value)} className="text-sm" placeholder="Notas de la factura (opcional)" /></div>

            <div className="flex gap-2 pt-1">
              <Button type="button" size="sm" className="flex-1" onClick={create}><Plus className="w-3.5 h-3.5 mr-1.5" />Crear factura</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detalle de factura */}
      <Dialog open={!!detail} onOpenChange={v => { if (!v) setDetail(null) }}>
        <DialogContent className="max-w-lg">
          {detail && (
            <>
              <DialogHeader><DialogTitle className="flex items-center gap-2"><span className="font-mono">{detail.number}</span><span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLE[detail.status]}`}>{detail.status}</span></DialogTitle></DialogHeader>
              <div className="space-y-3 mt-1 text-sm">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{detail.client?.name ?? clients.find(c => c.id === detail.client_id)?.name}</span>
                  <span>{TYPE_LABEL[detail.type]} · {detail.currency}</span>
                </div>
                <div className="border border-border rounded-md divide-y divide-border">
                  {detailItems.map(it => (
                    <div key={it.id} className="flex items-center justify-between px-2.5 py-1.5 text-xs">
                      <span className="flex-1 min-w-0 truncate">{it.description}</span>
                      <span className="text-muted-foreground mx-2 whitespace-nowrap">{it.quantity} × {fmtMoney(it.unit_rate, detail.currency)}</span>
                      <span className="font-medium whitespace-nowrap">{fmtMoney(it.amount, detail.currency)}</span>
                    </div>
                  ))}
                  {detailItems.length === 0 && <div className="px-2.5 py-3 text-xs text-muted-foreground">Sin líneas</div>}
                </div>
                <div className="text-right text-xs space-y-0.5">
                  <p className="text-muted-foreground">Subtotal {fmtMoney(detail.subtotal, detail.currency)}</p>
                  <p className="text-muted-foreground">IVA ({detail.tax_rate}%) {fmtMoney(detail.tax, detail.currency)}</p>
                  <p className="text-base font-bold text-foreground">Total {fmtMoney(detail.total, detail.currency)}</p>
                </div>
                {detail.notes && <p className="text-xs text-muted-foreground border-t border-border pt-2">{detail.notes}</p>}

                {/* Acciones de estado */}
                <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
                  {detail.status === 'borrador' && <Button type="button" size="sm" className="h-7 text-xs" onClick={() => changeStatus(detail, 'enviada')}><Send className="w-3 h-3 mr-1" />Marcar enviada</Button>}
                  {detail.status === 'enviada' && <Button type="button" size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => changeStatus(detail, 'pagada')}><CheckCircle2 className="w-3 h-3 mr-1" />Marcar pagada</Button>}
                  {detail.status !== 'anulada' && detail.status !== 'pagada' && <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => changeStatus(detail, 'anulada')}><Ban className="w-3 h-3 mr-1" />Anular</Button>}
                  <Button type="button" size="sm" variant="outline" className="h-7 text-xs text-red-600 hover:bg-red-50 ml-auto" onClick={() => setConfirmDel(detail)}><Trash2 className="w-3 h-3 mr-1" />Eliminar</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmar eliminación */}
      <Dialog open={!!confirmDel} onOpenChange={v => { if (!v) setConfirmDel(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-600"><Trash2 className="w-4 h-4" />Eliminar factura</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mt-2">¿Eliminar la factura {confirmDel?.number}? Las horas vinculadas volverán a estado aprobado.</p>
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
