"use client"
import { useState } from 'react'
import { Briefcase, ChevronRight, Building2, Plus, Pencil, Trash2, Search, X, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { SeverityBadge } from '@/components/shared/severity-badge'
import { useData } from '@/shared/context/data-context'
import * as db from '@/shared/services/db'
import { useEffect } from 'react'
import type { Client, RiskLevel } from '@/shared/types'

const RISK_BORDER: Record<RiskLevel, string> = {
  crítico: 'border-l-red-600', alto: 'border-l-orange-500', medio: 'border-l-yellow-500', bajo: 'border-l-green-500',
}

const SECTORS = ['Retail', 'Farmacéutico', 'Construcción', 'Franquicias', 'Industrial', 'Financiero', 'Tecnología', 'Salud', 'Educación', 'Otro']

const EMPTY_FORM = {
  name: '', nit: '', sector: '', contact_name: '', contact_email: '',
  assigned_partner: 'u1', risk_level: 'medio' as RiskLevel,
}

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-foreground text-background text-sm px-4 py-3 rounded-xl shadow-card-lg animate-in slide-in-from-bottom-2">
      {msg}
      <button type="button" title="Cerrar" onClick={onClose}><X className="w-3.5 h-3.5" /></button>
    </div>
  )
}

export default function ClientesPage() {
  const { clients: dbClients, matters, alerts, documents, complianceDiagnostics } = useData()
  const [clients, setClients] = useState<Client[]>([])

  useEffect(() => { if (dbClients.length > 0) setClients(dbClients.map(c => ({ ...c }))) }, [dbClients])
  const [selected, setSelected] = useState<Client | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.sector.toLowerCase().includes(search.toLowerCase()) ||
    c.nit.includes(search)
  )

  const openCreate = () => { setForm(EMPTY_FORM); setEditing(null); setShowForm(true) }
  const openEdit = (c: Client) => {
    setForm({ name: c.name, nit: c.nit, sector: c.sector, contact_name: c.contact_name, contact_email: c.contact_email, assigned_partner: c.assigned_partner, risk_level: c.risk_level })
    setEditing(c); setShowForm(true)
  }

  const saveClient = async () => {
    if (!form.name.trim() || !form.nit.trim()) return
    if (editing) {
      await db.updateClient(editing.id, form)
      setClients(prev => prev.map(c => c.id === editing.id ? { ...c, ...form } : c))
      if (selected?.id === editing.id) setSelected(prev => prev ? { ...prev, ...form } : prev)
      showToast('Cliente actualizado correctamente')
    } else {
      const created = await db.createClient_({ ...form, is_active: true, asuntos_activos: 0 })
      if (created) setClients(prev => [...prev, created])
      showToast('Cliente creado correctamente')
    }
    setShowForm(false)
  }

  const deleteClient = async () => {
    if (!deleteTarget) return
    await db.deleteClient(deleteTarget.id)
    setClients(prev => prev.filter(c => c.id !== deleteTarget.id))
    if (selected?.id === deleteTarget.id) setSelected(null)
    showToast('Cliente eliminado')
    setDeleteTarget(null)
  }

  const clientMatters = matters.filter(m => m.client_id === selected?.id)
  const clientAlerts = alerts.filter(a => a.clients_affected?.includes(selected?.id ?? ''))
  const clientDocs = documents.filter(d => d.client_id === selected?.id)
  const clientCompliance = complianceDiagnostics.filter(c => c.client_id === selected?.id)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-playfair">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Cartera de clientes corporativos · {clients.length} registros</p>
        </div>
        <Button size="sm" onClick={openCreate}><Plus className="w-3.5 h-3.5 mr-1.5" />Nuevo cliente</Button>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input placeholder="Buscar por nombre, sector, NIT..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
        {search && <button type="button" title="Limpiar" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5 text-muted-foreground" /></button>}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(client => (
          <Card key={client.id} className={`cursor-pointer hover:shadow-card-md transition-shadow border-l-4 ${RISK_BORDER[client.risk_level]}`} onClick={() => setSelected(client)}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-brand-navy/10 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4 h-4 text-brand-navy" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-snug">{client.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{client.sector} · NIT {client.nit}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <SeverityBadge level={client.risk_level} />
                    <span className="text-[10px] text-muted-foreground">{client.asuntos_activos ?? 0} asunto{(client.asuntos_activos ?? 0) !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button type="button" title="Editar" onClick={e => { e.stopPropagation(); openEdit(client) }} className="p-1 rounded hover:bg-muted transition-colors">
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button type="button" title="Eliminar" onClick={e => { e.stopPropagation(); setDeleteTarget(client) }} className="p-1 rounded hover:bg-red-50 transition-colors">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-12 text-sm text-muted-foreground">No se encontraron clientes.</div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between pr-6">
                  <DialogTitle className="text-base">{selected.name}</DialogTitle>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => { setSelected(null); openEdit(selected) }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-red-600 hover:text-red-700" onClick={() => { setSelected(null); setDeleteTarget(selected) }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <SeverityBadge level={selected.risk_level} />
                  <Badge variant="outline" className="text-[10px]">{selected.sector}</Badge>
                  <span className="text-xs text-muted-foreground">NIT: {selected.nit}</span>
                </div>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="bg-muted/40 rounded-md p-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide mb-0.5">Contacto</p>
                  <p className="text-xs font-medium">{selected.contact_name}</p>
                  <p className="text-[10px] text-muted-foreground">{selected.contact_email}</p>
                </div>
                <div className="bg-muted/40 rounded-md p-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide mb-0.5">Vinculado</p>
                  <p className="text-xs font-medium">{new Date(selected.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  <p className="text-[10px] text-muted-foreground">{selected.is_active ? 'Activo' : 'Inactivo'}</p>
                </div>
              </div>
              <Tabs defaultValue="asuntos" className="mt-2">
                <TabsList className="h-8">
                  <TabsTrigger value="asuntos" className="text-xs">Asuntos ({clientMatters.length})</TabsTrigger>
                  <TabsTrigger value="alertas" className="text-xs">Alertas ({clientAlerts.length})</TabsTrigger>
                  <TabsTrigger value="docs" className="text-xs">Documentos ({clientDocs.length})</TabsTrigger>
                  <TabsTrigger value="compliance" className="text-xs">Compliance</TabsTrigger>
                </TabsList>
                <TabsContent value="asuntos" className="mt-3 space-y-2">
                  {clientMatters.map(m => (
                    <div key={m.id} className="p-2.5 bg-muted/40 rounded-md border border-border">
                      <p className="text-xs font-medium">{m.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px]">{m.type}</Badge>
                        {m.next_deadline && <span className="text-[10px] text-muted-foreground">Vence: {new Date(m.next_deadline).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</span>}
                      </div>
                    </div>
                  ))}
                  {clientMatters.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Sin asuntos registrados</p>}
                </TabsContent>
                <TabsContent value="alertas" className="mt-3 space-y-2">
                  {clientAlerts.map(a => (
                    <div key={a.id} className="flex items-center gap-2.5 p-2.5 bg-muted/40 rounded-md border border-border">
                      <SeverityBadge level={a.impact_level} />
                      <p className="text-xs text-foreground flex-1 leading-snug">{a.title}</p>
                    </div>
                  ))}
                  {clientAlerts.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Sin alertas aplicables</p>}
                </TabsContent>
                <TabsContent value="docs" className="mt-3 space-y-2">
                  {clientDocs.map(d => (
                    <div key={d.id} className="flex items-center gap-2.5 p-2.5 bg-muted/40 rounded-md border border-border">
                      <p className="text-xs text-foreground flex-1 leading-snug">{d.name}</p>
                      <Badge variant="outline" className="text-[10px]">{d.status.replace('_', ' ')}</Badge>
                    </div>
                  ))}
                  {clientDocs.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Sin documentos</p>}
                </TabsContent>
                <TabsContent value="compliance" className="mt-3 space-y-2">
                  {clientCompliance.map(c => (
                    <div key={c.id} className="p-2.5 bg-muted/40 rounded-md border border-border">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className="text-[10px] uppercase">{c.type}</Badge>
                        <span className="text-xs font-bold text-foreground">{c.completion_pct}%</span>
                      </div>
                      <Progress value={c.completion_pct} className="h-1.5" />
                    </div>
                  ))}
                  {clientCompliance.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Sin diagnósticos de compliance</p>}
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Form */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar cliente' : 'Nuevo cliente'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Razón social *</Label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Empresa S.A.S." className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">NIT *</Label>
                <Input value={form.nit} onChange={e => setForm(p => ({ ...p, nit: e.target.value }))} placeholder="900.123.456-7" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sector</Label>
                <Select value={form.sector} onValueChange={v => setForm(p => ({ ...p, sector: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Sector..." /></SelectTrigger>
                  <SelectContent>{SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nombre de contacto</Label>
                <Input value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))} placeholder="Nombre completo" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email de contacto</Label>
                <Input value={form.contact_email} onChange={e => setForm(p => ({ ...p, contact_email: e.target.value }))} placeholder="legal@empresa.com" className="h-8 text-sm" type="email" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nivel de riesgo</Label>
                <Select value={form.risk_level} onValueChange={v => setForm(p => ({ ...p, risk_level: v as RiskLevel }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bajo">Bajo</SelectItem>
                    <SelectItem value="medio">Medio</SelectItem>
                    <SelectItem value="alto">Alto</SelectItem>
                    <SelectItem value="crítico">Crítico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button size="sm" onClick={saveClient} disabled={!form.name.trim() || !form.nit.trim()}>
              {editing ? 'Guardar cambios' : 'Crear cliente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-4 h-4" /> Eliminar cliente
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">¿Confirma eliminar <strong>{deleteTarget?.name}</strong>? Esta acción no se puede deshacer.</p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button size="sm" variant="destructive" onClick={deleteClient}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {toast && <Toast msg={toast} onClose={() => setToast('')} />}
    </div>
  )
}
