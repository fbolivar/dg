"use client"
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Bell, FileText, CheckSquare, Scale, Clock, TrendingUp,
  AlertTriangle, ChevronRight, BookOpen, Users, ArrowUpRight
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SeverityBadge } from '@/components/shared/severity-badge'
import { AlertStatusBadge } from '@/components/shared/alert-status-badge'
import { useData } from '@/shared/context/data-context'

// Factores honestos de horas ahorradas por artefacto generado con IA.
const HORAS_POR_NOTA = 2          // borrador de Legal Note revisado
const HORAS_POR_CONTRATO = 3      // análisis de contrato

const RISK_COLORS: Record<string, string> = {
  'crítico': 'bg-red-500',
  'alto': 'bg-orange-500',
  'medio': 'bg-yellow-500',
  'bajo': 'bg-green-500',
}
const RISK_ORDER: Record<string, number> = { 'crítico': 4, 'alto': 3, 'medio': 2, 'bajo': 1 }

interface KpiCardProps {
  label: string
  value: string
  sub: string
  icon: React.ReactNode
  iconBg: string
  accent?: boolean
}

function KpiCard({ label, value, sub, icon, iconBg, accent }: KpiCardProps) {
  return (
    <Card className={accent ? 'border-brand-gold/30 bg-gradient-to-br from-brand-gold/5 to-brand-gold/10' : ''}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
            {icon}
          </div>
        </div>
        <p className={`text-3xl font-bold tracking-tight ${accent ? 'text-brand-gold' : 'text-foreground'}`}>{value}</p>
        <p className="text-xs font-medium text-foreground mt-1">{label}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { alerts, matters, clients, legalNotes, documents, contractReviews, practiceAreas } = useData()
  const [today, setToday] = useState('')
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    const n = new Date()
    setToday((d => d.charAt(0).toUpperCase() + d.slice(1))(n.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })))
    setNow(n.getTime())
  }, [])

  const recentAlerts = alerts.slice(0, 5)
  const upcomingDeadlines = matters.filter(m => m.next_deadline).sort((a, b) =>
    new Date(a.next_deadline!).getTime() - new Date(b.next_deadline!).getTime()
  ).slice(0, 4)

  const horasEstimadas = legalNotes.length * HORAS_POR_NOTA + contractReviews.length * HORAS_POR_CONTRATO

  const dashboardStats = {
    alertas_nuevas: alerts.filter(a => a.status === 'nueva').length,
    asuntos_activos: matters.filter(m => m.status === 'activo').length,
    horas_ahorradas_estimadas: horasEstimadas,
    documentos_pendientes: documents.filter(d => d.status === 'pendiente').length,
    aprobaciones_pendientes: legalNotes.filter(n => n.status === 'en_revisión').length,
    notas_borrador: legalNotes.filter(n => n.status === 'borrador_ia').length,
  }

  // ── Actividad mensual (últimos 6 meses, derivada de created_at) ──
  const monthlyActivity = useMemo(() => {
    const base = now ?? Date.now()
    const ref = new Date(base)
    const meses = Array.from({ length: 6 }, (_, k) => {
      const d = new Date(ref.getFullYear(), ref.getMonth() - (5 - k), 1)
      return { key: `${d.getFullYear()}-${d.getMonth()}`, mes: d.toLocaleDateString('es-CO', { month: 'short' }).replace('.', ''), alertas: 0, notas: 0, contratos: 0 }
    })
    const idx = new Map(meses.map((m, i) => [m.key, i]))
    const bump = (dateStr: string | undefined, field: 'alertas' | 'notas' | 'contratos') => {
      if (!dateStr) return
      const d = new Date(dateStr)
      const i = idx.get(`${d.getFullYear()}-${d.getMonth()}`)
      if (i !== undefined) meses[i][field]++
    }
    alerts.forEach(a => bump(a.created_at ?? a.published_at, 'alertas'))
    legalNotes.forEach(n => bump(n.created_at, 'notas'))
    contractReviews.forEach(c => bump(c.created_at, 'contratos'))
    return meses
  }, [alerts, legalNotes, contractReviews, now])

  // ── Riesgo por área (asuntos activos por área + mayor riesgo de cliente) ──
  const areaRisk = useMemo(() => {
    const map = new Map<string, { level: string; count: number }>()
    practiceAreas.forEach(pa => map.set(pa.name, { level: 'bajo', count: 0 }))
    matters.filter(m => m.status === 'activo').forEach(m => {
      const area = m.practice_area?.name
      if (!area) return
      const entry = map.get(area) ?? { level: 'bajo', count: 0 }
      entry.count++
      const r = m.client?.risk_level
      if (r && (RISK_ORDER[r] ?? 0) > (RISK_ORDER[entry.level] ?? 0)) entry.level = r
      map.set(area, entry)
    })
    return Array.from(map.entries()).map(([area, info]) => ({ area, ...info }))
  }, [practiceAreas, matters])

  // ── Horas ahorradas por semana (últimas 7, estimadas de artefactos IA) ──
  const hoursTrend = useMemo(() => {
    const base = now ?? Date.now()
    const semanas = Array.from({ length: 7 }, (_, k) => ({ sem: `S${k + 1}`, horas: 0 }))
    const addWeek = (dateStr: string | undefined, hrs: number) => {
      if (!dateStr) return
      const wk = Math.floor((base - new Date(dateStr).getTime()) / (7 * 86400000))
      if (wk >= 0 && wk < 7) semanas[6 - wk].horas += hrs
    }
    legalNotes.forEach(n => addWeek(n.created_at, HORAS_POR_NOTA))
    contractReviews.forEach(c => addWeek(c.created_at, HORAS_POR_CONTRATO))
    return semanas
  }, [legalNotes, contractReviews, now])

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Main column */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-playfair text-foreground">Panel ejecutivo</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{today}</p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/reportes">
              <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
              Ver reportes
            </Link>
          </Button>
        </div>

        {/* KPI Cards — 3 columns */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            label="Alertas nuevas"
            value={String(dashboardStats.alertas_nuevas)}
            sub="Requieren análisis"
            icon={<Bell className="w-5 h-5 text-red-600" />}
            iconBg="bg-red-50"
          />
          <KpiCard
            label="Asuntos activos"
            value={String(dashboardStats.asuntos_activos)}
            sub="En trámite"
            icon={<Scale className="w-5 h-5 text-brand-navy" />}
            iconBg="bg-brand-navy/8"
          />
          <KpiCard
            label="Horas ahorradas"
            value={`${dashboardStats.horas_ahorradas_estimadas}h`}
            sub="Estimado desde actividad IA"
            icon={<Clock className="w-5 h-5 text-brand-gold" />}
            iconBg="bg-brand-gold/15"
            accent
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            label="Docs. pendientes"
            value={String(dashboardStats.documentos_pendientes)}
            sub="Para revisión"
            icon={<FileText className="w-5 h-5 text-blue-600" />}
            iconBg="bg-blue-50"
          />
          <KpiCard
            label="Aprobaciones"
            value={String(dashboardStats.aprobaciones_pendientes)}
            sub="Legal Notes"
            icon={<CheckSquare className="w-5 h-5 text-amber-600" />}
            iconBg="bg-amber-50"
          />
          <KpiCard
            label="Notes IA borrador"
            value={String(dashboardStats.notas_borrador)}
            sub="Generados por IA"
            icon={<BookOpen className="w-5 h-5 text-purple-600" />}
            iconBg="bg-purple-50"
          />
        </div>

        {/* Activity chart */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Actividad mensual</CardTitle>
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-brand-navy inline-block" />Alertas</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-brand-gold inline-block" />Legal Notes</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-400 inline-block" />Contratos</span>
            </div>
          </CardHeader>
          <CardContent className="pt-2 pb-4">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={monthlyActivity} barSize={8} barGap={3}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(214 20% 90%)" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(214 20% 90%)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                />
                <Bar dataKey="alertas" fill="#1A2B4A" radius={[4, 4, 0, 0]} />
                <Bar dataKey="notas" fill="#B8962E" radius={[4, 4, 0, 0]} />
                <Bar dataKey="contratos" fill="#60a5fa" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recent alerts table */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Alertas normativas recientes</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/monitor" className="text-xs text-muted-foreground hover:text-foreground">
                Ver todas <ChevronRight className="w-3 h-3 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alerta</TableHead>
                  <TableHead>Fuente</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Impacto</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentAlerts.map(alert => (
                  <TableRow key={alert.id} className="cursor-pointer hover:bg-muted/40">
                    <TableCell className="max-w-[220px]">
                      <p className="text-xs font-medium text-foreground truncate">{alert.title.slice(0, 55)}{alert.title.length > 55 ? '…' : ''}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(alert.published_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{alert.source}</TableCell>
                    <TableCell className="text-xs">{alert.practice_area?.code}</TableCell>
                    <TableCell><SeverityBadge level={alert.impact_level} /></TableCell>
                    <TableCell><AlertStatusBadge status={alert.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Right panel */}
      <div className="w-full lg:w-[260px] lg:flex-shrink-0 space-y-4">
        {/* IA hours trend */}
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Horas ahorradas / semana</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-3">
            <p className="text-2xl font-bold text-foreground mb-1">{dashboardStats.horas_ahorradas_estimadas}h</p>
            <p className="text-[11px] text-muted-foreground mb-3">
              Estimado: {HORAS_POR_NOTA}h/nota IA · {HORAS_POR_CONTRATO}h/contrato
            </p>
            <ResponsiveContainer width="100%" height={80}>
              <AreaChart data={hoursTrend}>
                <defs>
                  <linearGradient id="hoursGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#B8962E" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#B8962E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="horas" stroke="#B8962E" strokeWidth={2} fill="url(#hoursGrad)" dot={false} />
                <XAxis dataKey="sem" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Semáforo por área */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Riesgo por área</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 pt-0">
            {areaRisk.map(info => (
              <div key={info.area} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${RISK_COLORS[info.level]}`} />
                  <span className="text-xs font-medium truncate">{info.area}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {info.count > 0 && (
                    <span className="text-[10px] text-muted-foreground">{info.count}</span>
                  )}
                  <SeverityBadge level={info.level} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Vencimientos próximos */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              Vencimientos
            </CardTitle>
            <Link href="/litigios" className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5">
              Ver <ArrowUpRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {upcomingDeadlines.map(matter => (
              <div key={matter.id} className="py-1.5 border-b border-border last:border-0">
                <p className="text-xs font-medium text-foreground truncate">{matter.title.slice(0, 35)}{matter.title.length > 35 ? '…' : ''}</p>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-[10px] text-muted-foreground">{matter.client?.name.split(' ').slice(0, 2).join(' ')}</p>
                  <p className={`text-[10px] font-semibold ${new Date(matter.next_deadline!) < new Date(Date.now() + 7 * 86400000) ? 'text-red-600' : 'text-muted-foreground'}`}>
                    {new Date(matter.next_deadline!).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Clientes activos */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Clientes activos
            </CardTitle>
            <Link href="/clientes" className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5">
              Ver <ArrowUpRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-1 pt-0">
            {clients.filter(c => c.is_active).slice(0, 4).map(client => (
              <div key={client.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                <div>
                  <p className="text-xs font-medium text-foreground truncate max-w-[130px]">{client.name.split(' ').slice(0, 2).join(' ')}</p>
                  <p className="text-[10px] text-muted-foreground">{client.sector}</p>
                </div>
                <SeverityBadge level={client.risk_level} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
