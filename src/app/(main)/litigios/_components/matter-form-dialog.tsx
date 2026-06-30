"use client"
import type { Dispatch, SetStateAction } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import type { Client, PracticeArea, User, MatterStatus, DgaCurrency, MatterOutcome } from '@/shared/types'

export const TYPES = ['litigio', 'consultoría', 'transaccional', 'compliance', 'regulatorio'] as const

export const EMPTY_FORM = {
  title: '', client_id: '', practice_area_id: 'pa1', type: 'litigio' as typeof TYPES[number],
  jurisdiction: '', parties: '', process_state: '', estimated_risk: '',
  success_probability: '', next_action: '', next_deadline: '',
  status: 'activo' as MatterStatus, assigned_to: 'u2',
  budget_hours: '', budget_amount: '', budget_currency: 'COP' as DgaCurrency,
  outcome: 'en_curso' as MatterOutcome, satisfaction: '',
}

export type MatterForm = typeof EMPTY_FORM

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: boolean
  form: MatterForm
  setForm: Dispatch<SetStateAction<MatterForm>>
  onSave: () => void
  clients: Client[]
  practiceAreas: PracticeArea[]
  users: User[]
}

export function MatterFormDialog({ open, onOpenChange, editing, form, setForm, onSave, clients, practiceAreas, users }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          {/* Presupuesto del asunto (DGA-Time) */}
          <div className="pt-2 border-t border-border">
            <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Presupuesto del asunto (opcional) · se compara contra las horas reales en DGA-Time</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Horas presupuestadas</Label>
                <Input type="number" min="0" value={form.budget_hours} onChange={e => setForm(p => ({ ...p, budget_hours: e.target.value }))} className="h-8 text-sm" placeholder="Ej. 40" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Monto presupuestado</Label>
                <Input type="number" min="0" value={form.budget_amount} onChange={e => setForm(p => ({ ...p, budget_amount: e.target.value }))} className="h-8 text-sm" placeholder="Ej. 10000000" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Moneda</Label>
                <Select value={form.budget_currency} onValueChange={v => setForm(p => ({ ...p, budget_currency: v as DgaCurrency }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="COP" className="text-xs">COP</SelectItem><SelectItem value="USD" className="text-xs">USD</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="pt-2 border-t border-border grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Resultado del caso</Label>
              <Select value={form.outcome} onValueChange={v => setForm(p => ({ ...p, outcome: v as MatterOutcome }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en_curso" className="text-xs">En curso</SelectItem>
                  <SelectItem value="ganado" className="text-xs">Ganado</SelectItem>
                  <SelectItem value="perdido" className="text-xs">Perdido</SelectItem>
                  <SelectItem value="desistido" className="text-xs">Desistido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Satisfacción cliente (1–5)</Label>
              <Select value={form.satisfaction || 'none'} onValueChange={v => setForm(p => ({ ...p, satisfaction: v === 'none' ? '' : v }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Sin registrar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-xs">Sin registrar</SelectItem>
                  {[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={String(n)} className="text-xs">{n} ★</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={onSave} disabled={!form.title.trim() || !form.client_id}>{editing ? 'Guardar cambios' : 'Crear asunto'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
