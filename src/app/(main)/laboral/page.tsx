"use client"
import { useState, useEffect } from 'react'
import { Users, Send, AlertTriangle, Clock, CheckCircle, Plus, Pencil, Trash2, AlertCircle, X, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { AiDisclaimer } from '@/components/layout/ai-disclaimer'
import { useData } from '@/shared/context/data-context'
import * as db from '@/shared/services/db'
import type { HRTicket } from '@/shared/types'

const TICKET_STATUS: Record<string, { label: string; class: string; icon: React.ElementType }> = {
  abierto: { label: 'Abierto', class: 'bg-blue-100 text-blue-800 border-blue-200', icon: Clock },
  en_revisión: { label: 'En revisión', class: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
  respondido: { label: 'Respondido', class: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
  cerrado: { label: 'Cerrado', class: 'bg-gray-100 text-gray-500 border-gray-200', icon: CheckCircle },
}
const LABOR_TOPICS = [
  'Contratación laboral', 'Terminación de contrato', 'Procesos disciplinarios',
  'Incapacidades médicas', 'UGPP / parafiscales', 'Negociación colectiva',
  'Fuero sindical', 'Alcoholimetría / drogas', 'Inmigración laboral', 'Estructura salarial',
]

const AI_RESPONSES: Record<string, string> = {
  'Terminación de contrato': 'Conforme al artículo 62 del Código Sustantivo del Trabajo, la terminación con justa causa requiere que la causal esté expresamente tipificada y se surta el procedimiento de descargos previo. Es imprescindible: (1) comunicación escrita de los cargos, (2) audiencia de descargos con derecho a defensa técnica, (3) valoración de la respuesta, y (4) notificación de la decisión. Si existe vinculación sindical o fuero circunstancial, consulte con el equipo DG&A antes de proceder.',
  'Procesos disciplinarios': 'El proceso disciplinario interno debe ajustarse al reglamento de trabajo y garantizar el debido proceso. Pasos clave: (1) citación por escrito con enunciación de la falta, (2) audiencia de descargos, (3) deliberación y decisión motivada. La Circular 0042/2026 del MinTrabajo exige garantías adicionales de defensa técnica. Revise el reglamento del cliente.',
  'Incapacidades médicas': 'Cuando una incapacidad supera 180 días, el empleador tiene la obligación de iniciar el proceso de calificación de pérdida de capacidad laboral. No puede despedir al trabajador durante la incapacidad sin autorización del inspector del trabajo. Verifique si aplica el proceso de rehabilitación y reintegro laboral.',
  'default': 'Conforme a la legislación laboral colombiana y la jurisprudencia reciente, este caso requiere análisis de los hechos específicos. Los factores determinantes incluyen la antigüedad del trabajador, el tipo de contrato, la existencia de fueros especiales y los antecedentes disciplinarios. Se recomienda revisar el reglamento interno de trabajo del cliente y las actas o comunicaciones previas relacionadas.',
}

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-foreground text-background text-sm px-4 py-3 rounded-xl shadow-card-lg">
      {msg}<button type="button" title="Cerrar" onClick={onClose}><X className="w-3.5 h-3.5" /></button>
    </div>
  )
}

export default function LaboralPage() {
  const { hrTickets: dbHrTickets, clients } = useData()
  const [tickets, setTickets] = useState<HRTicket[]>([])

  useEffect(() => { if (dbHrTickets.length > 0) setTickets(dbHrTickets.map(t => ({ ...t }))) }, [dbHrTickets])
  const [selected, setSelected] = useState<HRTicket | null>(null)
  const [creating, setCreating] = useState(false)
  const [editingResponse, setEditingResponse] = useState(false)
  const [responseText, setResponseText] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<HRTicket | null>(null)
  const [generating, setGenerating] = useState(false)
  const [newTicket, setNewTicket] = useState({ client_id: '', topic: '', question: '', sensitivity_flag: false })
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const stats = {
    total: tickets.length,
    abiertas: tickets.filter(t => t.status === 'abierto').length,
    sensibles: tickets.filter(t => t.sensitivity_flag).length,
    respondidas: tickets.filter(t => t.status === 'respondido').length,
  }

  const saveTicket = async () => {
    if (!newTicket.client_id || !newTicket.topic || !newTicket.question.trim()) return
    const client = clients.find(c => c.id === newTicket.client_id)
    const ticketDbData = {
      client_id: newTicket.client_id,
      topic: newTicket.topic, question: newTicket.question,
      status: 'abierto' as HRTicket['status'], sensitivity_flag: newTicket.sensitivity_flag,
      created_at: new Date().toISOString(),
    }
    const created = await db.createHRTicket(ticketDbData)
    if (created) setTickets(prev => [{ ...created, client }, ...prev])
    setCreating(false)
    setNewTicket({ client_id: '', topic: '', question: '', sensitivity_flag: false })
    showToast('Consulta registrada')
  }

  const generateAIResponse = async (ticketId: string, topic: string) => {
    setGenerating(true)
    await new Promise(r => setTimeout(r, 1500))
    const response = AI_RESPONSES[topic] ?? AI_RESPONSES.default
    await db.updateHRTicket(ticketId, { ai_response: response, status: 'en_revisión' })
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, ai_response: response, status: 'en_revisión' } : t))
    setSelected(prev => prev?.id === ticketId ? { ...prev, ai_response: response, status: 'en_revisión' } : prev)
    setGenerating(false)
    showToast('Respuesta IA generada — requiere revisión')
  }

  const saveResponse = async () => {
    if (!selected) return
    await db.updateHRTicket(selected.id, { ai_response: responseText })
    setTickets(prev => prev.map(t => t.id === selected.id ? { ...t, ai_response: responseText } : t))
    setSelected(prev => prev ? { ...prev, ai_response: responseText } : prev)
    setEditingResponse(false)
    showToast('Respuesta guardada')
  }

  const changeStatus = async (ticketId: string, status: HRTicket['status']) => {
    await db.updateHRTicket(ticketId, { status })
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status } : t))
    setSelected(prev => prev?.id === ticketId ? { ...prev, status } : prev)
    showToast(`Estado: "${TICKET_STATUS[status].label}"`)
  }

  const sendToClient = (ticketId: string) => {
    changeStatus(ticketId, 'respondido')
    showToast('Respuesta enviada al cliente')
    setSelected(null)
  }

  const deleteTicket = async () => {
    if (!deleteTarget) return
    await db.deleteHRTicket(deleteTarget.id)
    setTickets(prev => prev.filter(t => t.id !== deleteTarget.id))
    if (selected?.id === deleteTarget.id) setSelected(null)
    showToast('Consulta eliminada')
    setDeleteTarget(null)
  }

  return (
    <div className="flex gap-5 h-[calc(100vh-8rem)]">
      {/* Left: Topics */}
      <div className="w-52 flex-shrink-0">
        <div className="bg-white rounded-lg border border-border overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border bg-muted/50">
            <p className="text-xs font-semibold text-foreground">Temas cubiertos</p>
          </div>
          <div className="p-2 space-y-0.5">
            {LABOR_TOPICS.map(topic => (
              <button type="button" key={topic} onClick={() => setNewTicket(p => ({ ...p, topic }))}
                className="w-full text-left text-xs px-2.5 py-2 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                {topic}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 min-w-0 space-y-4 overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-playfair">Laboral y RR.HH.</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Consultas laborales con asistencia de IA</p>
          </div>
          <Button size="sm" onClick={() => setCreating(true)}><Plus className="w-3.5 h-3.5 mr-1.5" />Nueva consulta</Button>
        </div>

        <AiDisclaimer message="Las respuestas son orientativas. Los casos sensibles requieren criterio de abogado DG&A antes de actuar." variant="banner" />

        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total consultas', value: stats.total, color: 'text-foreground', sub: 'Registradas' },
            { label: 'Abiertas', value: stats.abiertas, color: 'text-blue-600', sub: 'Sin respuesta' },
            { label: 'Casos sensibles', value: stats.sensibles, color: 'text-red-600', sub: 'Requieren abogado' },
            { label: 'Respondidas', value: stats.respondidas, color: 'text-green-600', sub: 'Enviadas al cliente' },
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
                  <TableHead className="w-[35%]">Consulta</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tema</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Sensible</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="w-20">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map(ticket => {
                  const sc = TICKET_STATUS[ticket.status]
                  const SIcon = sc.icon
                  return (
                    <TableRow key={ticket.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setSelected(ticket)}>
                      <TableCell><p className="text-xs font-medium text-foreground leading-snug line-clamp-2">{ticket.question}</p></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{ticket.client?.name.split(' ').slice(0, 2).join(' ')}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{ticket.topic}</Badge></TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border w-fit ${sc.class}`}>
                          <SIcon className="w-3 h-3" />{sc.label}
                        </div>
                      </TableCell>
                      <TableCell>
                        {ticket.sensitivity_flag
                          ? <span className="flex items-center gap-1 text-[10px] text-red-700 font-medium"><AlertTriangle className="w-3 h-3" />Sí</span>
                          : <span className="text-[10px] text-muted-foreground">No</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(ticket.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <button type="button" title="Editar" onClick={() => { setSelected(ticket); setResponseText(ticket.ai_response ?? '') }} className="p-1 rounded hover:bg-muted"><Pencil className="w-3.5 h-3.5 text-muted-foreground" /></button>
                          <button type="button" title="Eliminar" onClick={() => setDeleteTarget(ticket)} className="p-1 rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => { setSelected(null); setEditingResponse(false) }}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between pr-6">
                  <DialogTitle className="text-base">Consulta laboral</DialogTitle>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-red-600 flex-shrink-0" onClick={() => { setSelected(null); setDeleteTarget(selected) }}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <Badge variant="outline" className="text-[10px]">{selected.topic}</Badge>
                  <span className="text-xs text-muted-foreground">{selected.client?.name}</span>
                  {selected.sensitivity_flag && (
                    <span className="text-[10px] text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                      <AlertTriangle className="w-3 h-3" />Caso sensible
                    </span>
                  )}
                </div>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                {/* Change status */}
                <div className="flex items-center gap-2 p-2.5 bg-muted/40 rounded-md flex-wrap">
                  <span className="text-xs font-medium">Estado:</span>
                  {Object.entries(TICKET_STATUS).map(([k, v]) => (
                    <button type="button" key={k} onClick={() => changeStatus(selected.id, k as HRTicket['status'])}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all ${selected.status === k ? v.class : 'border-border text-muted-foreground hover:border-foreground'}`}>
                      {v.label}
                    </button>
                  ))}
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Consulta</p>
                  <p className="text-sm text-foreground leading-relaxed bg-muted/40 rounded-md p-3">{selected.question}</p>
                </div>

                {selected.ai_response ? (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Respuesta asistida por IA</p>
                      <div className="flex gap-1">
                        <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Borrador IA</span>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => { setResponseText(selected.ai_response ?? ''); setEditingResponse(true) }}>
                          <Pencil className="w-3 h-3 mr-1" />Editar
                        </Button>
                      </div>
                    </div>
                    {editingResponse ? (
                      <div className="space-y-2">
                        <Textarea value={responseText} onChange={e => setResponseText(e.target.value)} rows={6} className="text-sm" />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveResponse}>Guardar respuesta</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingResponse(false)}>Cancelar</Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-foreground leading-relaxed bg-blue-50 border border-blue-200 rounded-md p-3">{selected.ai_response}</p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4 space-y-2">
                    <p className="text-xs text-muted-foreground">Sin respuesta generada aún</p>
                    <Button size="sm" onClick={() => generateAIResponse(selected.id, selected.topic)} disabled={generating}>
                      {generating ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Generando...</> : 'Generar respuesta con IA'}
                    </Button>
                  </div>
                )}

                <AiDisclaimer variant="banner" message="Esta respuesta es orientativa. Casos con riesgo para la empresa o el trabajador requieren concepto definitivo del equipo DG&A." />

                <div className="flex gap-2 pt-2 border-t border-border flex-wrap">
                  {selected.sensitivity_flag && (
                    <Button size="sm" onClick={() => { changeStatus(selected.id, 'en_revisión'); showToast('Escalado a abogado') }}>
                      <Users className="w-3.5 h-3.5 mr-1.5" />Escalar a abogado
                    </Button>
                  )}
                  {selected.ai_response && (
                    <Button size="sm" variant="outline" onClick={() => sendToClient(selected.id)}>
                      <Send className="w-3.5 h-3.5 mr-1.5" />Enviar al cliente
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={creating} onOpenChange={() => setCreating(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nueva consulta laboral</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Cliente *</Label>
                <Select value={newTicket.client_id} onValueChange={v => setNewTicket(p => ({ ...p, client_id: v }))}>
                  <SelectTrigger className="text-sm h-8"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.name.split(' ').slice(0, 2).join(' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tema *</Label>
                <Select value={newTicket.topic} onValueChange={v => setNewTicket(p => ({ ...p, topic: v }))}>
                  <SelectTrigger className="text-sm h-8"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>{LABOR_TOPICS.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Consulta detallada *</Label>
              <Textarea value={newTicket.question} onChange={e => setNewTicket(p => ({ ...p, question: e.target.value }))} placeholder="Describa el caso..." rows={4} className="text-sm" />
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={newTicket.sensitivity_flag} onChange={e => setNewTicket(p => ({ ...p, sensitivity_flag: e.target.checked }))} className="w-3.5 h-3.5" />
              Marcar como caso sensible (requiere revisión de abogado)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button size="sm" onClick={saveTicket} disabled={!newTicket.client_id || !newTicket.topic || !newTicket.question.trim()}>Registrar consulta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-600"><AlertCircle className="w-4 h-4" />Eliminar consulta</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">¿Confirma eliminar esta consulta?</p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button size="sm" variant="destructive" onClick={deleteTicket}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {toast && <Toast msg={toast} onClose={() => setToast('')} />}
    </div>
  )
}
