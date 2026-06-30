"use client"
import { useState } from 'react'
import { Calendar, Pencil, Trash2, PlusCircle, Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import type { Matter, MatterEvent, MatterStatus } from '@/shared/types'

export const MATTER_STATUS_MAP: Record<MatterStatus, { label: string; class: string }> = {
  activo: { label: 'Activo', class: 'bg-green-100 text-green-800 border-green-200' },
  en_pausa: { label: 'En pausa', class: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  cerrado: { label: 'Cerrado', class: 'bg-gray-100 text-gray-600 border-gray-200' },
  archivado: { label: 'Archivado', class: 'bg-gray-100 text-gray-400 border-gray-200' },
}

const EMPTY_EVENT = { event_type: '', event_date: '', description: '' }

type Props = {
  selected: Matter | null
  events: MatterEvent[]
  onClose: () => void
  onEdit: (m: Matter) => void
  onDeleteRequest: (m: Matter) => void
  onChangeStatus: (id: string, status: MatterStatus) => void
  onRecordDeadline: (onTime: boolean) => void
  onAddEvent: (data: typeof EMPTY_EVENT) => void
}

export function MatterDetailDialog({ selected, events, onClose, onEdit, onDeleteRequest, onChangeStatus, onRecordDeadline, onAddEvent }: Props) {
  const [showEventForm, setShowEventForm] = useState(false)
  const [eventForm, setEventForm] = useState(EMPTY_EVENT)

  function submitEvent() {
    if (!eventForm.event_type.trim()) return
    onAddEvent(eventForm)
    setEventForm(EMPTY_EVENT)
    setShowEventForm(false)
  }

  return (
    <>
      <Dialog open={!!selected} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between pr-6">
                  <DialogTitle className="text-base pr-4">{selected.title}</DialogTitle>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => onEdit(selected)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-red-600" onClick={() => { onClose(); onDeleteRequest(selected) }}><Trash2 className="w-3.5 h-3.5" /></Button>
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
                    <button type="button" key={k} onClick={() => onChangeStatus(selected.id, k as MatterStatus)}
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

                {/* Cumplimiento de plazos */}
                <div className="bg-muted/40 border border-border rounded-md p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <p className="text-xs font-semibold">Cumplimiento de plazos</p>
                      <p className="text-[10px] text-muted-foreground">
                        {(selected.deadlines_total ?? 0) > 0
                          ? `${selected.deadlines_ontime ?? 0}/${selected.deadlines_total} a tiempo (${Math.round((selected.deadlines_ontime ?? 0) / (selected.deadlines_total ?? 1) * 100)}%)`
                          : 'Sin plazos registrados aún'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onRecordDeadline(true)}><Check className="w-3 h-3 mr-1" />A tiempo</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs text-amber-600" onClick={() => onRecordDeadline(false)}>Tarde</Button>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actuaciones procesales</p>
                    <Button size="sm" variant="outline" className="h-7" onClick={() => { setEventForm(EMPTY_EVENT); setShowEventForm(true) }}>
                      <PlusCircle className="w-3 h-3 mr-1" />Agregar
                    </Button>
                  </div>
                  {events.length > 0 ? (
                    <div className="relative">
                      <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
                      <div className="space-y-3 ml-8">
                        {events.map((event, i) => (
                          <div key={event.id} className="relative">
                            <div className="absolute -left-[22px] top-1 w-2 h-2 rounded-full bg-brand-navy border-2 border-white shadow-sm" />
                            <p className="text-[10px] text-muted-foreground">{new Date(event.event_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            <p className="text-xs font-semibold text-foreground">{event.event_type}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{event.description}</p>
                            {i < events.length - 1 && <Separator className="mt-2" />}
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
            <Button size="sm" onClick={submitEvent} disabled={!eventForm.event_type.trim()}>Agregar actuación</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
