"use client"
import Link from 'next/link'
import { useData } from '@/shared/context/data-context'
import { Download, TrendingUp, Scale, Bell, Shield, X, ArrowUpRight, Printer, Calendar } from 'lucide-react'
import { openBrandedReport } from '@/shared/lib/pdf-report'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { useState, useMemo, useEffect, useRef } from 'react'

const PERIODS = [
  { key: '3m', label: 'Últimos 3 meses', months: 3 },
  { key: '6m', label: 'Últimos 6 meses', months: 6 },
  { key: '12m', label: 'Últimos 12 meses', months: 12 },
  { key: 'ytd', label: 'Este año', months: 0 },
  { key: 'all', label: 'Todo el histórico', months: 0 },
] as const

// Convierte el <svg> de una gráfica Recharts en un PNG (data URL) para incrustar en el PDF
async function svgToPng(container: HTMLElement | null, scale = 2): Promise<string | null> {
  if (!container) return null
  // Recharts renderiza varios <svg> (gráfica + íconos de leyenda). Tomamos el de mayor área.
  let svg: SVGSVGElement | null = null
  let best = -1
  for (const s of Array.from(container.querySelectorAll('svg'))) {
    const r = s.getBoundingClientRect()
    const area = r.width * r.height
    if (area > best) { best = area; svg = s }
  }
  if (!svg) return null
  const rect = svg.getBoundingClientRect()
  const w = Math.round(rect.width || 400)
  const h = Math.round(rect.height || 200)
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('width', String(w)); clone.setAttribute('height', String(h))
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const data = new XMLSerializer().serializeToString(clone)
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(data)
  return new Promise<string | null>(resolve => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = w * scale; canvas.height = h * scale
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(null); return }
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.scale(scale, scale); ctx.drawImage(img, 0, 0, w, h)
      try { resolve(canvas.toDataURL('image/png')) } catch { resolve(null) }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-foreground text-background text-sm px-4 py-3 rounded-xl shadow-card-lg">
      {msg}<button type="button" title="Cerrar" onClick={onClose}><X className="w-3.5 h-3.5" /></button>
    </div>
  )
}

export default function ReportesPage() {
  const { clients, alerts, matters, legalNotes, complianceDiagnostics, practiceAreas } = useData()
  const [toast, setToast] = useState('')
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  // Período de reporte (afecta las gráficas de actividad y el desglose por área)
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => { setNow(Date.now()) }, [])
  const [period, setPeriod] = useState<string>('6m')
  const refActividad = useRef<HTMLDivElement>(null)
  const refArea = useRef<HTMLDivElement>(null)
  const refRiesgo = useRef<HTMLDivElement>(null)

  const periodInfo = useMemo(() => {
    const ref = new Date(now ?? Date.now())
    const p = PERIODS.find(x => x.key === period) ?? PERIODS[1]
    let start: Date | null = null
    let monthsCount = 6
    if (p.key === 'all') { start = null; monthsCount = 12 }
    else if (p.key === 'ytd') { start = new Date(ref.getFullYear(), 0, 1); monthsCount = ref.getMonth() + 1 }
    else { start = new Date(ref.getFullYear(), ref.getMonth() - (p.months - 1), 1); monthsCount = p.months }
    return { start, monthsCount, label: p.label }
  }, [period, now])
  const inPeriod = (s?: string) => { if (!s) return false; if (!periodInfo.start) return true; return new Date(s) >= periodInfo.start }

  const monthlyData = useMemo(() => {
    const ref = new Date(now ?? Date.now())
    const n = periodInfo.monthsCount
    const meses = Array.from({ length: n }, (_, k) => {
      const d = new Date(ref.getFullYear(), ref.getMonth() - (n - 1 - k), 1)
      return { key: `${d.getFullYear()}-${d.getMonth()}`, mes: d.toLocaleDateString('es-CO', { month: 'short' }).replace('.', ''), alertas: 0, asuntos: 0, notas: 0 }
    })
    const idx = new Map(meses.map((m, i) => [m.key, i]))
    const bump = (dateStr: string | undefined, field: 'alertas' | 'asuntos' | 'notas') => {
      if (!dateStr) return
      const d = new Date(dateStr)
      const i = idx.get(`${d.getFullYear()}-${d.getMonth()}`)
      if (i !== undefined) meses[i][field]++
    }
    alerts.forEach(a => bump(a.created_at ?? a.published_at, 'alertas'))
    matters.forEach(m => bump(m.created_at, 'asuntos'))
    legalNotes.forEach(n => bump(n.created_at, 'notas'))
    return meses
  }, [alerts, matters, legalNotes, now, periodInfo])

  const avgCompliance = complianceDiagnostics.length
    ? Math.round(complianceDiagnostics.reduce((s, c) => s + c.completion_pct, 0) / complianceDiagnostics.length)
    : 0

  // Métricas de calidad
  const quality = useMemo(() => {
    const dTotal = matters.reduce((s, m) => s + (m.deadlines_total ?? 0), 0)
    const dOnTime = matters.reduce((s, m) => s + (m.deadlines_ontime ?? 0), 0)
    const cumplimiento = dTotal > 0 ? Math.round(dOnTime / dTotal * 100) : null
    const ganados = matters.filter(m => m.outcome === 'ganado').length
    const perdidos = matters.filter(m => m.outcome === 'perdido').length
    const exito = (ganados + perdidos) > 0 ? Math.round(ganados / (ganados + perdidos) * 100) : null
    const sats = matters.map(m => m.satisfaction).filter((n): n is number => typeof n === 'number')
    const satisfaccion = sats.length ? Math.round((sats.reduce((s, n) => s + n, 0) / sats.length) * 10) / 10 : null
    const ref = new Date(now ?? Date.now())
    const overdue = matters.filter(m => m.status === 'activo' && m.next_deadline && new Date(m.next_deadline) < ref).length
    return { cumplimiento, exito, satisfaccion, ganados, perdidos, overdue, satCount: sats.length }
  }, [matters, now])

  const AREA_DATA = practiceAreas.map(pa => ({
    area: pa.code,
    full: pa.name,
    alertas: alerts.filter(a => a.practice_area_id === pa.id && inPeriod(a.created_at ?? a.published_at)).length,
    asuntos: matters.filter(m => m.practice_area_id === pa.id && inPeriod(m.created_at)).length,
  })).filter(d => d.alertas > 0 || d.asuntos > 0)

  const RISK_DATA = [
    { name: 'Crítico', value: clients.filter(c => c.risk_level === 'crítico').length, color: '#dc2626', tw: 'bg-red-600' },
    { name: 'Alto', value: clients.filter(c => c.risk_level === 'alto').length, color: '#f97316', tw: 'bg-orange-500' },
    { name: 'Medio', value: clients.filter(c => c.risk_level === 'medio').length, color: '#eab308', tw: 'bg-yellow-500' },
    { name: 'Bajo', value: clients.filter(c => c.risk_level === 'bajo').length, color: '#16a34a', tw: 'bg-green-600' },
  ].filter(d => d.value > 0)

  const MATTER_TYPE_DATA = (['litigio', 'consultoría', 'transaccional', 'compliance', 'regulatorio'] as const).map(type => ({
    tipo: type,
    count: matters.filter(m => m.type === type).length,
  })).filter(d => d.count > 0)

  const exportCSV = () => {
    const sections = [
      ['REPORTE EJECUTIVO DG&A', `Fecha: ${new Date().toLocaleDateString('es-CO')}`],
      [],
      ['=== KPIs PRINCIPALES ==='],
      ['Métrica', 'Valor'],
      ['Alertas normativas', alerts.length],
      ['Asuntos activos', matters.filter(m => m.status === 'activo').length],
      ['Clientes activos', clients.filter(c => c.is_active).length],
      [],
      ['=== PERFIL DE RIESGO CLIENTES ==='],
      ['Cliente', 'Sector', 'Riesgo', 'Asuntos activos'],
      ...clients.map(c => [c.name, c.sector, c.risk_level, c.asuntos_activos ?? 0]),
      [],
      ['=== ASUNTOS POR TIPO ==='],
      ['Tipo', 'Cantidad'],
      ...MATTER_TYPE_DATA.map(d => [d.tipo, d.count]),
      [],
      ['=== ALERTAS POR ÁREA ==='],
      ['Área', 'Alertas', 'Asuntos'],
      ...AREA_DATA.map(d => [d.full, d.alertas, d.asuntos]),
      [],
      ['=== COMPLIANCE ==='],
      ['Cliente', 'Programa', 'Avance (%)'],
      ...complianceDiagnostics.map(cd => [cd.client?.name ?? '', cd.type.toUpperCase(), cd.completion_pct]),
    ]
    const csv = sections.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `reporte-dga-${new Date().toISOString().split('T')[0]}.csv`; a.click()
    showToast('Reporte CSV exportado correctamente')
  }

  const exportPDF = async () => {
    showToast('Preparando gráficas…')
    const shots = await Promise.all([
      svgToPng(refActividad.current), svgToPng(refArea.current), svgToPng(refRiesgo.current),
    ])
    const captions = [
      'Actividad mensual — Alertas (azul oscuro), Asuntos (oro), Legal Notes (azul claro)',
      'Alertas y asuntos por área de práctica',
      'Distribución de riesgo de clientes',
    ]
    const chartImages = shots
      .map((dataUrl, i) => dataUrl ? { dataUrl, caption: captions[i] } : null)
      .filter((x): x is { dataUrl: string; caption: string } => x !== null)

    const ok = openBrandedReport({
      title: 'Reporte ejecutivo',
      subtitle: 'Estado operativo de la práctica: riesgo, alertas, asuntos y compliance',
      metaLine: `Generado: ${new Date(now ?? Date.now()).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}`,
      filtersLine: `Período del reporte: ${periodInfo.label}   ·   Las gráficas reflejan el período seleccionado; los indicadores y tablas muestran el estado actual`,
      sections: [
        {
          heading: 'Indicadores principales',
          kpis: [
            { label: 'Alertas normativas', value: String(alerts.length), sub: `${alerts.filter(a => a.status === 'nueva').length} nuevas` },
            { label: 'Asuntos activos', value: String(matters.filter(m => m.status === 'activo').length), sub: `${matters.length} en total` },
            { label: 'Clientes riesgo alto+', value: String(clients.filter(c => ['alto', 'crítico'].includes(c.risk_level)).length), sub: `de ${clients.length} clientes` },
            { label: 'Avance compliance prom.', value: `${avgCompliance}%`, sub: `${complianceDiagnostics.length} programas` },
          ],
        },
        {
          heading: 'Métricas de calidad',
          kpis: [
            { label: 'Cumplimiento de plazos', value: quality.cumplimiento !== null ? `${quality.cumplimiento}%` : '—', sub: 'plazos a tiempo' },
            { label: 'Tasa de éxito', value: quality.exito !== null ? `${quality.exito}%` : '—', sub: `${quality.ganados} ganados · ${quality.perdidos} perdidos` },
            { label: 'Satisfacción cliente', value: quality.satisfaccion !== null ? `${quality.satisfaccion} / 5` : '—', sub: `${quality.satCount} calificados` },
            { label: 'Asuntos vencidos', value: String(quality.overdue), sub: 'plazo pasado, activos' },
          ],
        },
        ...(chartImages.length ? [{ heading: 'Indicadores gráficos', images: chartImages }] : []),
        {
          heading: 'Perfil de riesgo por cliente',
          table: {
            columns: ['Cliente', 'Sector', 'Riesgo', 'Asuntos activos'],
            rows: clients.map(c => [c.name, c.sector, c.risk_level, c.asuntos_activos ?? 0]),
            align: ['left', 'left', 'left', 'right'],
          },
        },
        {
          heading: 'Asuntos por tipo',
          table: { columns: ['Tipo', 'Cantidad'], rows: MATTER_TYPE_DATA.map(d => [d.tipo, d.count]), align: ['left', 'right'] },
        },
        {
          heading: 'Alertas y asuntos por área',
          table: { columns: ['Área', 'Alertas', 'Asuntos'], rows: AREA_DATA.map(d => [d.full, d.alertas, d.asuntos]), align: ['left', 'right', 'right'] },
        },
        {
          heading: 'Estado de compliance',
          table: {
            columns: ['Cliente', 'Programa', 'Avance'],
            rows: complianceDiagnostics.map(cd => [cd.client?.name ?? '', cd.type.toUpperCase(), `${cd.completion_pct}%`]),
            align: ['left', 'left', 'right'],
          },
        },
      ],
    })
    showToast(ok ? 'Generando PDF…' : 'Permite ventanas emergentes para generar el PDF.')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold font-playfair">Reportes ejecutivos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Estado operativo de la práctica: riesgo, alertas, asuntos y compliance.</p>
          <Link href="/dgatime/informes" className="text-xs text-brand-navy hover:underline inline-flex items-center gap-1 mt-1">Para horas, facturación y rentabilidad → DGA-Time · Informes <ArrowUpRight className="w-3 h-3" /></Link>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="h-9 w-[168px] text-sm"><Calendar className="w-3.5 h-3.5 mr-1 text-muted-foreground" /><SelectValue /></SelectTrigger>
            <SelectContent>{PERIODS.map(p => <SelectItem key={p.key} value={p.key} className="text-xs">{p.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={exportCSV}><Download className="w-3.5 h-3.5 mr-1.5" />CSV</Button>
          <Button size="sm" onClick={() => void exportPDF()}><Printer className="w-3.5 h-3.5 mr-1.5" />Exportar PDF</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Alertas normativas', value: String(alerts.length), icon: Bell, sub: `${alerts.filter(a => a.status === 'nueva').length} nuevas` },
          { label: 'Asuntos activos', value: String(matters.filter(m => m.status === 'activo').length), icon: Scale, sub: `${matters.length} en total` },
          { label: 'Clientes riesgo alto+', value: String(clients.filter(c => ['alto', 'crítico'].includes(c.risk_level)).length), icon: TrendingUp, sub: `de ${clients.length} clientes` },
          { label: 'Avance compliance prom.', value: `${avgCompliance}%`, icon: Shield, sub: `${complianceDiagnostics.length} programas` },
        ].map(kpi => {
          const Icon = kpi.icon
          return (
            <Card key={kpi.label}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-navy/8 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-brand-navy" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-foreground tracking-tight">{kpi.value}</p>
                <p className="text-xs font-medium text-foreground mt-1">{kpi.label}</p>
                <p className="text-[10px] mt-0.5 text-muted-foreground">{kpi.sub}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Métricas de calidad */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">Métricas de calidad</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card><CardContent className="p-5">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center mb-3"><Shield className="w-5 h-5 text-green-600" /></div>
            <p className="text-3xl font-bold tracking-tight">{quality.cumplimiento !== null ? `${quality.cumplimiento}%` : '—'}</p>
            <p className="text-xs font-medium mt-1">Cumplimiento de plazos</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">plazos cumplidos a tiempo</p>
          </CardContent></Card>
          <Card><CardContent className="p-5">
            <div className="w-10 h-10 rounded-xl bg-brand-navy/8 flex items-center justify-center mb-3"><Scale className="w-5 h-5 text-brand-navy" /></div>
            <p className="text-3xl font-bold tracking-tight">{quality.exito !== null ? `${quality.exito}%` : '—'}</p>
            <p className="text-xs font-medium mt-1">Tasa de éxito</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{quality.ganados} ganados · {quality.perdidos} perdidos</p>
          </CardContent></Card>
          <Card><CardContent className="p-5">
            <div className="w-10 h-10 rounded-xl bg-brand-gold/15 flex items-center justify-center mb-3"><TrendingUp className="w-5 h-5 text-brand-gold" /></div>
            <p className="text-3xl font-bold tracking-tight">{quality.satisfaccion !== null ? `${quality.satisfaccion} ★` : '—'}</p>
            <p className="text-xs font-medium mt-1">Satisfacción cliente</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{quality.satCount} asuntos calificados</p>
          </CardContent></Card>
          <Card><CardContent className="p-5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center mb-3"><Bell className="w-5 h-5 text-amber-600" /></div>
            <p className={`text-3xl font-bold tracking-tight ${quality.overdue > 0 ? 'text-red-600' : ''}`}>{quality.overdue}</p>
            <p className="text-xs font-medium mt-1">Asuntos vencidos</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">plazo pasado, aún activos</p>
          </CardContent></Card>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Actividad mensual */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Actividad mensual</CardTitle></CardHeader>
          <CardContent className="pt-0 pb-4">
            <div ref={refActividad}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={monthlyData} barSize={10} barGap={2}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(214 20% 90%)" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={24} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="alertas" name="Alertas" fill="#1A2B4A" radius={[4, 4, 0, 0]} />
                <Bar dataKey="asuntos" name="Asuntos" fill="#B8962E" radius={[4, 4, 0, 0]} />
                <Bar dataKey="notas" name="Legal Notes" fill="#60a5fa" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Alertas por área */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Alertas y asuntos por área</CardTitle></CardHeader>
          <CardContent className="pt-0 pb-4">
            <div ref={refArea}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={AREA_DATA} layout="vertical" barSize={8}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="hsl(214 20% 90%)" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="area" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="alertas" name="Alertas" fill="#1A2B4A" radius={[0, 4, 4, 0]} />
                <Bar dataKey="asuntos" name="Asuntos" fill="#D4AF50" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Distribución de riesgo */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Distribución de riesgo — clientes</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-4">
            <div ref={refRiesgo} className="w-1/2">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={RISK_DATA} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={3}>
                  {RISK_DATA.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
            </div>
            <div className="space-y-2 flex-1">
              {RISK_DATA.map(d => (
                <div key={d.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${d.tw}`} />
                    <span className="text-xs font-medium">{d.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{d.value} cliente{d.value !== 1 ? 's' : ''}</span>
                    <span className="text-xs font-semibold">{Math.round(d.value / (clients.length || 1) * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Compliance estado */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Shield className="w-4 h-4" />Estado de compliance</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {complianceDiagnostics.map(cd => (
              <div key={cd.id} className="flex items-center gap-3 py-1.5 border-b border-border last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{cd.client?.name.split(' ').slice(0, 2).join(' ')}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">{cd.type}</p>
                </div>
                <div className="flex items-center gap-2 w-32">
                  <Progress value={cd.completion_pct} className="h-1.5 flex-1" />
                  <span className="text-[10px] text-muted-foreground w-7 text-right">{cd.completion_pct}%</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Tabla resumen clientes */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Perfil de riesgo por cliente</CardTitle>
          <span className="text-xs text-muted-foreground">{clients.filter(c => c.is_active).length} clientes activos</span>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {clients.map(client => (
              <div key={client.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                <div>
                  <p className="text-xs font-medium">{client.name.split(' ').slice(0, 3).join(' ')}</p>
                  <p className="text-[10px] text-muted-foreground">{client.sector}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{client.asuntos_activos ?? 0} asunto{(client.asuntos_activos ?? 0) !== 1 ? 's' : ''}</span>
                  <Badge variant={client.risk_level === 'crítico' ? 'critico' : client.risk_level === 'alto' ? 'alto' : client.risk_level === 'medio' ? 'medio' : 'bajo'}>
                    {client.risk_level}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {toast && <Toast msg={toast} onClose={() => setToast('')} />}
    </div>
  )
}
