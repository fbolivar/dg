"use client"
import { useState } from 'react'
import { Bell, Scale, FileText, MessageSquare, CheckCircle, ChevronRight, Download, X, Clock, CheckCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SeverityBadge } from '@/components/shared/severity-badge'
import { useData } from '@/shared/context/data-context'

// For demo: client is Andina Retail (cl1)
const CLIENT_ID = 'cl1'

type ConceptRequest = {
  id: string
  topic: string
  description: string
  urgency: string
  status: 'recibida' | 'en_proceso' | 'respondida'
  created_at: string
}

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-foreground text-background text-sm px-4 py-3 rounded-xl shadow-card-lg">
      {msg}<button type="button" title="Cerrar" onClick={onClose}><X className="w-3.5 h-3.5" /></button>
    </div>
  )
}

const STATUS_STYLES: Record<string, string> = {
  recibida: 'bg-gray-100 text-gray-700 border-gray-200',
  en_proceso: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  respondida: 'bg-green-100 text-green-800 border-green-200',
}
const STATUS_LABELS: Record<string, string> = { recibida: 'Recibida', en_proceso: 'En proceso', respondida: 'Respondida' }

const URGENCY_OPTS = ['Normal (2-3 días hábiles)', 'Urgente (24 horas)', 'Muy urgente (mismo día)']

export default function PortalPage() {
  const { clients, alerts, matters, documents } = useData()
  const client = clients.find(c => c.id === CLIENT_ID)
  const myAlerts = alerts.filter(a => a.clients_affected?.includes(CLIENT_ID)).slice(0, 4)
  const myMatters = matters.filter(m => m.client_id === CLIENT_ID)
  const myDocuments = documents.filter(d => d.client_id === CLIENT_ID)

  const [requesting, setRequesting] = useState(false)
  const [requests, setRequests] = useState<ConceptRequest[]>([
    { id: 'rq1', topic: 'Revisión cláusula de no competencia', description: 'Necesitamos revisar la cláusula de no competencia de un contrato antes de firmar.', urgency: 'Normal (2-3 días hábiles)', status: 'respondida', created_at: '2026-05-10T09:00:00Z' },
    { id: 'rq2', topic: 'Concepto sobre política de datos', description: 'Actualización de la política de habeas data según nuevas directrices.', urgency: 'Urgente (24 horas)', status: 'en_proceso', created_at: '2026-05-12T14:30:00Z' },
  ])
  const [form, setForm] = useState({ topic: '', description: '', urgency: '' })
  const [toast, setToast] = useState('')
  const [selectedDoc, setSelectedDoc] = useState<typeof myDocuments[0] | null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  function submitRequest() {
    if (!form.topic || !form.description || !form.urgency) return
    const req: ConceptRequest = {
      id: `rq${Date.now()}`,
      topic: form.topic,
      description: form.description,
      urgency: form.urgency,
      status: 'recibida',
      created_at: new Date().toISOString(),
    }
    setRequests(prev => [req, ...prev])
    setRequesting(false)
    setForm({ topic: '', description: '', urgency: '' })
    showToast('Solicitud enviada. Tiempo estimado de respuesta: ' + ((form.urgency.split('(')[1] || '').replace(')', '') || '2-3 días hábiles'))
  }

  function downloadDoc(doc: typeof myDocuments[0]) {
    const content = `DOCUMENTO: ${doc.name}\nEstado: ${doc.status}\nCliente: ${client?.name ?? 'DG&A'}\nFecha: ${new Date().toLocaleDateString('es-CO')}\n\n[Contenido del documento descargado desde el Portal DG&A]`
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${doc.name.replace(/\s+/g, '-').toLowerCase()}.txt`; a.click()
    showToast('Documento descargado')
  }

  return (
    <div className="space-y-6 max-w-[1100px]">
      {/* Welcome */}
      <div className="bg-brand-navy rounded-lg p-6 text-white">
        <p className="text-sm text-white/60 font-medium mb-1">Portal de cliente</p>
        <h1 className="text-2xl font-semibold font-playfair">{client?.name ?? 'Portal DG&A'}</h1>
        <p className="text-white/70 text-sm mt-1">
          {client ? `NIT: ${client.nit} · Sector: ${client.sector} · ` : ''}Socio asignado: Carlos Gómez Vargas
        </p>
        <div className="flex gap-3 mt-4">
          <div className="bg-white/10 rounded-md px-3 py-2 text-center min-w-[80px]">
            <p className="text-xl font-bold">{myAlerts.length}</p>
            <p className="text-[10px] text-white/60">Alertas legales</p>
          </div>
          <div className="bg-white/10 rounded-md px-3 py-2 text-center min-w-[80px]">
            <p className="text-xl font-bold">{myMatters.length}</p>
            <p className="text-[10px] text-white/60">Asuntos activos</p>
          </div>
          <div className="bg-white/10 rounded-md px-3 py-2 text-center min-w-[80px]">
            <p className="text-xl font-bold">{myDocuments.length}</p>
            <p className="text-[10px] text-white/60">Documentos</p>
          </div>
          <div className="bg-white/10 rounded-md px-3 py-2 text-center min-w-[80px]">
            <p className="text-xl font-bold">{requests.length}</p>
            <p className="text-[10px] text-white/60">Solicitudes</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Alertas */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bell className="w-4 h-4 text-brand-gold" />
              Alertas legales aplicables
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {myAlerts.map(alert => (
              <div key={alert.id} className="flex items-start gap-3 p-2.5 bg-muted/40 rounded-md border border-border">
                <SeverityBadge level={alert.impact_level} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground leading-snug">{alert.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{alert.source} · {new Date(alert.published_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</p>
                </div>
              </div>
            ))}
            {myAlerts.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Sin alertas activas</p>}
          </CardContent>
        </Card>

        {/* Asuntos */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Scale className="w-4 h-4 text-brand-gold" />
              Asuntos activos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {myMatters.map(matter => (
              <div key={matter.id} className="p-2.5 bg-muted/40 rounded-md border border-border">
                <p className="text-xs font-medium text-foreground leading-snug">{matter.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px]">{matter.type}</Badge>
                  {matter.next_deadline && (
                    <span className="text-[10px] text-muted-foreground">Vence: {new Date(matter.next_deadline).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</span>
                  )}
                </div>
                {matter.next_action && (
                  <p className="text-[10px] text-muted-foreground mt-1">{matter.next_action}</p>
                )}
              </div>
            ))}
            {myMatters.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Sin asuntos activos</p>}
          </CardContent>
        </Card>

        {/* Documentos */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-gold" />
              Documentos compartidos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {myDocuments.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 p-2.5 bg-muted/40 rounded-md border border-border">
                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{doc.name}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{doc.status.replace(/_/g, ' ')}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" title="Ver detalles" onClick={() => setSelectedDoc(doc)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" title="Descargar" onClick={() => downloadDoc(doc)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Tareas y solicitudes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-brand-gold" />
              Tareas pendientes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {[
              { task: 'Revisar y aprobar Política de Tratamiento de Datos', deadline: '20 may 2026', urgent: true },
              { task: 'Enviar documentos para actualización SAGRILAFT', deadline: '30 jun 2026', urgent: false },
              { task: 'Confirmar reunión de revisión contrato distribución', deadline: '17 may 2026', urgent: true },
            ].map((t, i) => (
              <div key={i} className={`flex items-start gap-2.5 p-2.5 rounded-md border ${t.urgent ? 'bg-red-50 border-red-200' : 'bg-muted/40 border-border'}`}>
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${t.urgent ? 'bg-red-500' : 'bg-muted-foreground'}`} />
                <div className="flex-1">
                  <p className="text-xs font-medium text-foreground leading-snug">{t.task}</p>
                  <p className={`text-[10px] mt-0.5 ${t.urgent ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>Vence: {t.deadline}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Solicitudes de concepto */}
      {requests.length > 0 && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-brand-gold" />
              Mis solicitudes de concepto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {requests.map(req => (
              <div key={req.id} className="flex items-start gap-3 p-3 bg-muted/40 rounded-md border border-border">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">{req.topic}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{req.description}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[req.status]}`}>
                      {STATUS_LABELS[req.status]}
                    </span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(req.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{req.urgency.split('(')[0].trim()}</span>
                  </div>
                </div>
                {req.status === 'respondida' && <CheckCheck className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* CTA solicitar concepto */}
      <Card className="border-brand-gold/30">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">¿Necesita un concepto legal?</p>
            <p className="text-xs text-muted-foreground mt-0.5">Envíe su consulta al equipo DG&A. Tiempo de respuesta estimado: 2 días hábiles.</p>
          </div>
          <Button type="button" variant="gold" size="sm" onClick={() => setRequesting(true)}>
            <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
            Solicitar concepto legal
          </Button>
        </CardContent>
      </Card>

      {/* Document Detail Dialog */}
      <Dialog open={!!selectedDoc} onOpenChange={open => { if (!open) setSelectedDoc(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Documento</DialogTitle></DialogHeader>
          {selectedDoc && (
            <div className="space-y-3 mt-1">
              <div>
                <p className="text-sm font-medium">{selectedDoc.name}</p>
                <p className="text-xs text-muted-foreground capitalize mt-0.5">{selectedDoc.status.replace(/_/g, ' ')}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-muted/40 rounded p-2">
                  <p className="text-muted-foreground text-[10px]">Tipo</p>
                  <p className="font-medium capitalize">{selectedDoc.type?.replace(/_/g, ' ') ?? 'Documento'}</p>
                </div>
                <div className="bg-muted/40 rounded p-2">
                  <p className="text-muted-foreground text-[10px]">Creado</p>
                  <p className="font-medium">{new Date(selectedDoc.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: '2-digit' })}</p>
                </div>
              </div>
              <Button type="button" size="sm" className="w-full" onClick={() => { downloadDoc(selectedDoc); setSelectedDoc(null) }}>
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Descargar documento
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Request Dialog */}
      <Dialog open={requesting} onOpenChange={v => { if (!v) setRequesting(false) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Solicitar concepto legal</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Tema / Asunto *</Label>
              <Input
                value={form.topic}
                onChange={e => setForm(p => ({ ...p, topic: e.target.value }))}
                className="text-sm"
                placeholder="Ej. Revisión cláusula de no competencia"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descripción de la consulta *</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                className="text-sm min-h-[90px]"
                placeholder="Describa su consulta con el mayor detalle posible para que podamos brindarle una respuesta precisa..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Urgencia *</Label>
              <Select value={form.urgency} onValueChange={v => setForm(p => ({ ...p, urgency: v }))}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Seleccionar nivel de urgencia" /></SelectTrigger>
                <SelectContent>
                  {URGENCY_OPTS.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <p className="text-[10px] text-muted-foreground bg-muted/40 rounded p-2">
              Su solicitud será atendida por el equipo DG&A. Recibirá una notificación cuando esté lista la respuesta.
            </p>
            <div className="flex gap-2">
              <Button type="button" size="sm" className="flex-1" onClick={submitRequest} disabled={!form.topic || !form.description || !form.urgency}>
                <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                Enviar solicitud
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setRequesting(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {toast && <Toast msg={toast} onClose={() => setToast('')} />}
    </div>
  )
}
