"use client"
import { useState } from 'react'
import { Scale, Clock, AlertCircle, CheckCircle2, PauseCircle, ChevronDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useData } from '@/shared/context/data-context'
import type { Matter } from '@/shared/types'

const CLIENT_ID = 'cl1'

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  activo:    { label: 'Activo',    icon: CheckCircle2, color: 'text-green-600' },
  en_pausa:  { label: 'En pausa',  icon: PauseCircle,  color: 'text-yellow-600' },
  cerrado:   { label: 'Cerrado',   icon: CheckCircle2, color: 'text-gray-400' },
  archivado: { label: 'Archivado', icon: CheckCircle2, color: 'text-gray-400' },
}

const TYPE_LABELS: Record<string, string> = {
  litigio: 'Litigio', consultoría: 'Consultoría', transaccional: 'Transaccional',
  compliance: 'Compliance', regulatorio: 'Regulatorio',
}

function MatterCard({ matter, onClick }: { matter: Matter; onClick: () => void }) {
  const cfg = STATUS_CONFIG[matter.status] ?? STATUS_CONFIG.activo
  const Icon = cfg.icon
  const isUrgent = matter.next_deadline && new Date(matter.next_deadline) < new Date(Date.now() + 7 * 86400000)
  return (
    <button type="button" onClick={onClick} className="w-full text-left p-4 bg-white border border-border rounded-xl hover:border-brand-navy/40 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-snug">{matter.title}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Badge variant="outline" className="text-[10px]">{TYPE_LABELS[matter.type] ?? matter.type}</Badge>
            {matter.next_deadline && (
              <span className={`text-[10px] flex items-center gap-1 ${isUrgent ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                <Clock className="w-3 h-3" />
                Vence: {new Date(matter.next_deadline).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
          {matter.next_action && (
            <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-1">
              Próxima acción: {matter.next_action}
            </p>
          )}
        </div>
        <div className={`flex items-center gap-1 text-[11px] font-medium ${cfg.color} flex-shrink-0`}>
          <Icon className="w-3.5 h-3.5" />
          {cfg.label}
        </div>
      </div>
      {isUrgent && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
          <AlertCircle className="w-3 h-3" />
          Vencimiento próximo — requiere atención
        </div>
      )}
    </button>
  )
}

export default function PortalAsuntosPage() {
  const { matters, loading } = useData()
  const [filter, setFilter] = useState<'todos' | 'activo' | 'en_pausa' | 'cerrado'>('todos')
  const [selected, setSelected] = useState<Matter | null>(null)

  const myMatters = matters.filter(m => m.client_id === CLIENT_ID)
  const filtered = filter === 'todos' ? myMatters : myMatters.filter(m => m.status === filter)

  const counts = {
    todos: myMatters.length,
    activo: myMatters.filter(m => m.status === 'activo').length,
    en_pausa: myMatters.filter(m => m.status === 'en_pausa').length,
    cerrado: myMatters.filter(m => m.status === 'cerrado').length,
  }

  return (
    <div className="space-y-5 max-w-[900px]">
      <div>
        <h1 className="text-xl font-semibold font-playfair text-foreground">Mis Asuntos</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Seguimiento de todos los asuntos legales activos y cerrados</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { key: 'todos', label: 'Total', color: 'text-foreground' },
          { key: 'activo', label: 'Activos', color: 'text-green-600' },
          { key: 'en_pausa', label: 'En pausa', color: 'text-yellow-600' },
          { key: 'cerrado', label: 'Cerrados', color: 'text-gray-500' },
        ].map(s => (
          <button
            key={s.key}
            type="button"
            onClick={() => setFilter(s.key as typeof filter)}
            className={`p-3 rounded-xl border text-left transition-all ${filter === s.key ? 'border-brand-navy bg-brand-navy/5' : 'border-border bg-white hover:border-brand-navy/30'}`}
          >
            <p className={`text-xl font-bold ${s.color}`}>{counts[s.key as keyof typeof counts]}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </button>
        ))}
      </div>

      {/* List */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Scale className="w-4 h-4 text-brand-gold" />
            {filter === 'todos' ? 'Todos los asuntos' : `Asuntos ${STATUS_CONFIG[filter]?.label?.toLowerCase()}`}
            <span className="text-muted-foreground font-normal">({filtered.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 pt-0">
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Cargando asuntos...</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center">
              <Scale className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No hay asuntos en esta categoría</p>
            </div>
          ) : (
            filtered.map(m => <MatterCard key={m.id} matter={m} onClick={() => setSelected(m)} />)
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base leading-snug pr-6">{selected?.title}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 mt-1">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-muted-foreground text-[10px] uppercase tracking-wide mb-0.5">Tipo</p>
                  <p className="font-semibold capitalize">{TYPE_LABELS[selected.type] ?? selected.type}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-muted-foreground text-[10px] uppercase tracking-wide mb-0.5">Estado</p>
                  <p className={`font-semibold ${STATUS_CONFIG[selected.status]?.color ?? ''}`}>
                    {STATUS_CONFIG[selected.status]?.label ?? selected.status}
                  </p>
                </div>
                {selected.jurisdiction && (
                  <div className="bg-muted/40 rounded-lg p-3">
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wide mb-0.5">Jurisdicción</p>
                    <p className="font-semibold">{selected.jurisdiction}</p>
                  </div>
                )}
                {selected.next_deadline && (
                  <div className="bg-muted/40 rounded-lg p-3">
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wide mb-0.5">Próximo vencimiento</p>
                    <p className="font-semibold">{new Date(selected.next_deadline).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </div>
                )}
              </div>
              {selected.next_action && (
                <div className="bg-brand-navy/5 border border-brand-navy/20 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Próxima acción</p>
                  <p className="text-sm font-medium text-foreground">{selected.next_action}</p>
                </div>
              )}
              {selected.parties && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Partes</p>
                  <p className="text-xs text-foreground">{selected.parties}</p>
                </div>
              )}
              {selected.estimated_risk && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Riesgo estimado</p>
                  <p className="text-xs text-foreground">{selected.estimated_risk}</p>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground border-t pt-3">
                Abierto: {new Date(selected.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                {' · '}Actualizado: {new Date(selected.updated_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
