"use client"
import { useData } from '@/shared/context/data-context'
import { BarChart3, Download, TrendingUp, Scale, Bell, Shield, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { useState } from 'react'

const MONTHLY_DATA = [
  { mes: 'Ene', alertas: 3, asuntos: 2, notas: 1 },
  { mes: 'Feb', alertas: 5, asuntos: 3, notas: 2 },
  { mes: 'Mar', alertas: 4, asuntos: 1, notas: 3 },
  { mes: 'Abr', alertas: 7, asuntos: 4, notas: 4 },
  { mes: 'May', alertas: 6, asuntos: 5, notas: 5 },
]

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-foreground text-background text-sm px-4 py-3 rounded-xl shadow-card-lg">
      {msg}<button type="button" title="Cerrar" onClick={onClose}><X className="w-3.5 h-3.5" /></button>
    </div>
  )
}

export default function ReportesPage() {
  const { clients, alerts, matters, complianceDiagnostics, practiceAreas } = useData()
  const [toast, setToast] = useState('')
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const AREA_DATA = practiceAreas.map(pa => ({
    area: pa.code,
    full: pa.name,
    alertas: alerts.filter(a => a.practice_area_id === pa.id).length,
    asuntos: matters.filter(m => m.practice_area_id === pa.id).length,
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-playfair">Reportes ejecutivos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Visión consolidada del estado legal de la cartera</p>
        </div>
        <Button size="sm" variant="outline" onClick={exportCSV}><Download className="w-3.5 h-3.5 mr-1.5" />Exportar CSV</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Alertas normativas', value: alerts.length, icon: Bell, trend: '+20% vs. mes ant.', up: false },
          { label: 'Asuntos activos', value: matters.filter(m => m.status === 'activo').length, icon: Scale, trend: 'Sin cambio', up: null },
          { label: 'Clientes riesgo alto+', value: clients.filter(c => ['alto', 'crítico'].includes(c.risk_level)).length, icon: TrendingUp, trend: '↑ Monitoreo activo', up: false },
          { label: 'Horas ahorradas IA', value: `${(alerts.length + matters.length) * 2}h`, icon: BarChart3, trend: '+18% este mes', up: true },
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
                <p className={`text-[10px] mt-0.5 font-medium ${kpi.up === true ? 'text-green-600' : kpi.up === false ? 'text-red-500' : 'text-muted-foreground'}`}>
                  {kpi.trend}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Actividad mensual */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Actividad mensual</CardTitle></CardHeader>
          <CardContent className="pt-0 pb-4">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={MONTHLY_DATA} barSize={10} barGap={2}>
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
          </CardContent>
        </Card>

        {/* Alertas por área */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Alertas y asuntos por área</CardTitle></CardHeader>
          <CardContent className="pt-0 pb-4">
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
          </CardContent>
        </Card>

        {/* Distribución de riesgo */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Distribución de riesgo — clientes</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={160}>
              <PieChart>
                <Pie data={RISK_DATA} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={3}>
                  {RISK_DATA.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 flex-1">
              {RISK_DATA.map(d => (
                <div key={d.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${d.tw}`} />
                    <span className="text-xs font-medium">{d.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{d.value} cliente{d.value !== 1 ? 's' : ''}</span>
                    <span className="text-xs font-semibold">{Math.round(d.value / clients.length * 100)}%</span>
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
