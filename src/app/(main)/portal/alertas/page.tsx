"use client"
import { useState } from 'react'
import { Bell, AlertTriangle, ExternalLink, Filter, ChevronDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SeverityBadge } from '@/components/shared/severity-badge'
import { useData } from '@/shared/context/data-context'
import type { Alert } from '@/shared/types'

const CLIENT_ID = 'cl1'

const IMPACT_ORDER: Record<string, number> = { crítico: 0, alto: 1, medio: 2, bajo: 3 }

const IMPACT_CONFIG: Record<string, { label: string; bg: string; border: string; text: string }> = {
  crítico: { label: 'Crítico', bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700' },
  alto:    { label: 'Alto',    bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
  medio:   { label: 'Medio',  bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700' },
  bajo:    { label: 'Bajo',   bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700' },
}

export default function PortalAlertasPage() {
  const { alerts, practiceAreas, loading } = useData()
  const [filterLevel, setFilterLevel] = useState<string>('todos')
  const [selected, setSelected] = useState<Alert | null>(null)

  const myAlerts = alerts
    .filter(a => a.clients_affected?.includes(CLIENT_ID))
    .sort((a, b) => (IMPACT_ORDER[a.impact_level] ?? 99) - (IMPACT_ORDER[b.impact_level] ?? 99))

  const filtered = filterLevel === 'todos' ? myAlerts : myAlerts.filter(a => a.impact_level === filterLevel)

  const counts = {
    todos: myAlerts.length,
    crítico: myAlerts.filter(a => a.impact_level === 'crítico').length,
    alto: myAlerts.filter(a => a.impact_level === 'alto').length,
    medio: myAlerts.filter(a => a.impact_level === 'medio').length,
    bajo: myAlerts.filter(a => a.impact_level === 'bajo').length,
  }

  function getPracticeArea(id: string) {
    return practiceAreas.find(p => p.id === id)?.name ?? id
  }

  return (
    <div className="space-y-5 max-w-[900px]">
      <div>
        <h1 className="text-xl font-semibold font-playfair text-foreground">Mis Alertas</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Novedades normativas que aplican a su empresa</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-2.5">
        {[
          { key: 'todos', label: 'Total', color: 'text-foreground' },
          { key: 'crítico', label: 'Críticas', color: 'text-red-600' },
          { key: 'alto', label: 'Altas', color: 'text-orange-600' },
          { key: 'medio', label: 'Medias', color: 'text-yellow-600' },
          { key: 'bajo', label: 'Bajas', color: 'text-green-600' },
        ].map(s => (
          <button
            key={s.key}
            type="button"
            onClick={() => setFilterLevel(s.key)}
            className={`p-3 rounded-xl border text-left transition-all ${filterLevel === s.key ? 'border-brand-navy bg-brand-navy/5' : 'border-border bg-white hover:border-brand-navy/30'}`}
          >
            <p className={`text-xl font-bold ${s.color}`}>{counts[s.key as keyof typeof counts]}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Alerts list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bell className="w-4 h-4 text-brand-gold" />
            Alertas legales
            <span className="text-muted-foreground font-normal">({filtered.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 pt-0">
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Cargando alertas...</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center">
              <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No hay alertas en esta categoría</p>
            </div>
          ) : (
            filtered.map(alert => {
              const cfg = IMPACT_CONFIG[alert.impact_level] ?? IMPACT_CONFIG.bajo
              return (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => setSelected(alert)}
                  className={`w-full text-left p-3.5 rounded-xl border ${cfg.bg} ${cfg.border} hover:shadow-sm transition-all`}
                >
                  <div className="flex items-start gap-3">
                    <SeverityBadge level={alert.impact_level} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground leading-snug">{alert.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{alert.summary}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-muted-foreground font-medium">{alert.source}</span>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="text-[10px] text-muted-foreground">{getPracticeArea(alert.practice_area_id)}</span>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="text-[10px] text-muted-foreground">{new Date(alert.published_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base leading-snug pr-6">{selected?.title}</DialogTitle>
          </DialogHeader>
          {selected && (() => {
            const cfg = IMPACT_CONFIG[selected.impact_level] ?? IMPACT_CONFIG.bajo
            return (
              <div className="space-y-4 mt-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <SeverityBadge level={selected.impact_level} />
                  <span className="text-xs text-muted-foreground">{selected.source}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-xs text-muted-foreground">{new Date(selected.published_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>

                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">Resumen</p>
                  <p className="text-sm text-foreground leading-relaxed">{selected.summary}</p>
                </div>

                {selected.recommendation && (
                  <div className={`p-3 rounded-lg border ${cfg.bg} ${cfg.border}`}>
                    <p className={`text-[10px] uppercase tracking-wide font-semibold mb-1 ${cfg.text}`}>Recomendación para su empresa</p>
                    <p className="text-xs text-foreground leading-relaxed">{selected.recommendation}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-muted/40 rounded-lg p-2.5">
                    <p className="text-[10px] text-muted-foreground">Área de práctica</p>
                    <p className="font-semibold mt-0.5">{getPracticeArea(selected.practice_area_id)}</p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-2.5">
                    <p className="text-[10px] text-muted-foreground">Impacto</p>
                    <p className={`font-semibold mt-0.5 capitalize ${cfg.text}`}>{selected.impact_level}</p>
                  </div>
                </div>

                {selected.source_url && (
                  <a
                    href={selected.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-brand-navy hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Ver fuente oficial
                  </a>
                )}
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
