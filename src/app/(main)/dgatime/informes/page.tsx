"use client"
import { useState, useEffect, useMemo } from 'react'
import { FileText, Download, Printer } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useData } from '@/shared/context/data-context'
import { useAuthStore } from '@/shared/stores/auth-store'
import { getTimeEntries } from '@/shared/services/db'
import { fmtMoney, fmtHours, hoursDecimal, fmtDate } from '@/shared/lib/dgatime-format'
import { openBrandedReport } from '@/shared/lib/pdf-report'
import type { TimeEntry, DgaCurrency } from '@/shared/types'

type Money = Record<DgaCurrency, number>
const zero = (): Money => ({ COP: 0, USD: 0 })
function moneyMulti(m: Money): string {
  const p: string[] = []
  if (m.COP) p.push(fmtMoney(m.COP, 'COP'))
  if (m.USD) p.push(fmtMoney(m.USD, 'USD'))
  return p.length ? p.join(' · ') : '$ 0'
}

export default function InformesPage() {
  const { clients, users } = useData()
  const authUser = useAuthStore(s => s.user)
  const isManager = authUser?.role === 'socio' || authUser?.role === 'admin'

  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [f, setF] = useState({ from: '', to: '', client_id: '', user_id: '', type: '', status: '', billable: '' })

  useEffect(() => {
    (async () => { setLoading(true); try { setEntries(await getTimeEntries()) } catch { /* noop */ } setLoading(false) })()
  }, [])

  const isoLocal = (d: Date) => {
    const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    return x.toISOString().slice(0, 10)
  }
  function applyPreset(key: string) {
    const n = new Date()
    const y = n.getFullYear(), m = n.getMonth(), d = n.getDate()
    let from = '', to = ''
    switch (key) {
      case 'hoy': from = to = isoLocal(new Date(y, m, d)); break
      case 'semana': { const day = (n.getDay() + 6) % 7; from = isoLocal(new Date(y, m, d - day)); to = isoLocal(new Date(y, m, d)); break }
      case 'mes': from = isoLocal(new Date(y, m, 1)); to = isoLocal(new Date(y, m + 1, 0)); break
      case 'mes_pasado': from = isoLocal(new Date(y, m - 1, 1)); to = isoLocal(new Date(y, m, 0)); break
      case 'trimestre': { const q = Math.floor(m / 3); from = isoLocal(new Date(y, q * 3, 1)); to = isoLocal(new Date(y, q * 3 + 3, 0)); break }
      case 'anio': from = isoLocal(new Date(y, 0, 1)); to = isoLocal(new Date(y, 11, 31)); break
      case '90d': from = isoLocal(new Date(y, m, d - 89)); to = isoLocal(new Date(y, m, d)); break
      case 'todo': from = ''; to = ''; break
    }
    setF(p => ({ ...p, from, to }))
  }
  const PRESETS: [string, string][] = [
    ['hoy', 'Hoy'], ['semana', 'Esta semana'], ['mes', 'Este mes'], ['mes_pasado', 'Mes pasado'],
    ['trimestre', 'Este trimestre'], ['anio', 'Este año'], ['90d', 'Últimos 90 días'], ['todo', 'Todo'],
  ]

  const filtered = useMemo(() => entries.filter(e => {
    if (f.from && e.date < f.from) return false
    if (f.to && e.date > f.to) return false
    if (f.client_id && e.client_id !== f.client_id) return false
    if (f.user_id && e.user_id !== f.user_id) return false
    if (f.type && e.matter?.type !== f.type) return false
    if (f.status && e.status !== f.status) return false
    if (f.billable === 'si' && !e.billable) return false
    if (f.billable === 'no' && e.billable) return false
    return true
  }), [entries, f])

  const totals = useMemo(() => {
    const min = filtered.reduce((s, e) => s + e.minutes, 0)
    const revenue = zero(); const cost = zero()
    filtered.forEach(e => { if (e.billable) revenue[e.currency] += e.amount; cost[e.currency] += e.cost_amount ?? 0 })
    const margin: Money = { COP: revenue.COP - cost.COP, USD: revenue.USD - cost.USD }
    return { min, revenue, cost, margin, count: filtered.length }
  }, [filtered])

  function rowsForExport(): string[][] {
    const header = ['Fecha', 'Abogado', 'Cliente', 'Asunto', 'Tipo', 'Actividad', 'Glosa', 'Horas', 'Facturable', 'Moneda', 'Tarifa', 'Ingreso', 'Costo', 'Margen', 'Estado']
    const body = filtered.map(e => {
      const ingreso = e.billable ? e.amount : 0
      const costo = e.cost_amount ?? 0
      return [
        e.date, e.user?.full_name ?? '', e.client?.name ?? '', e.matter?.title ?? '', e.matter?.type ?? '',
        e.activity, e.description, String(hoursDecimal(e.minutes)), e.billable ? 'Sí' : 'No', e.currency,
        String(e.rate), String(ingreso), String(costo), String(ingreso - costo), e.status,
      ]
    })
    return [header, ...body]
  }

  function exportCSV() {
    const rows = rowsForExport()
    const csv = rows.map(r => r.map(cell => {
      const s = String(cell ?? '')
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `informe-dgatime-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  }

  function filtersLine(): string {
    const parts: string[] = []
    if (f.from || f.to) parts.push(`Período: ${f.from || '…'} → ${f.to || '…'}`)
    if (f.client_id) parts.push(`Cliente: ${clients.find(c => c.id === f.client_id)?.name ?? ''}`)
    if (f.user_id) parts.push(`Abogado: ${users.find(u => u.id === f.user_id)?.full_name ?? ''}`)
    if (f.type) parts.push(`Tipo: ${f.type}`)
    if (f.billable) parts.push(f.billable === 'si' ? 'Solo facturables' : 'No facturables')
    return parts.length ? parts.join('   ·   ') : 'Todos los registros'
  }

  function printReport() {
    const cols = ['Fecha', 'Abogado', 'Cliente', 'Asunto', 'Actividad', 'Horas', 'Fact.', 'Ingreso', 'Costo', 'Margen', 'Estado']
    const rows = filtered.map(e => {
      const ingreso = e.billable ? e.amount : 0
      const costo = e.cost_amount ?? 0
      return [
        fmtDate(e.date), e.user?.full_name ?? '', e.client?.name ?? '', e.matter?.title ?? '—', e.activity,
        fmtHours(e.minutes), e.billable ? 'Sí' : 'No',
        ingreso ? fmtMoney(ingreso, e.currency) : '—', costo ? fmtMoney(costo, e.currency) : '—',
        fmtMoney(ingreso - costo, e.currency), e.status,
      ]
    })
    const ok = openBrandedReport({
      title: 'Informe de horas y rentabilidad',
      subtitle: 'DGA-Time · Registro de tiempo, facturación y rentabilidad',
      metaLine: `Generado: ${fmtDate(new Date().toISOString(), { day: '2-digit', month: 'long', year: 'numeric' })} · ${totals.count} registros`,
      filtersLine: filtersLine(),
      sections: [
        {
          kpis: [
            { label: 'Horas registradas', value: fmtHours(totals.min), sub: `${totals.count} registros` },
            { label: 'Ingreso', value: moneyMulti(totals.revenue) },
            { label: 'Costo', value: moneyMulti(totals.cost) },
            { label: 'Margen', value: moneyMulti(totals.margin) },
          ],
        },
        {
          heading: 'Detalle de registros',
          table: { columns: cols, rows, align: ['left', 'left', 'left', 'left', 'left', 'right', 'center', 'right', 'right', 'right', 'left'] },
        },
      ],
      totalsLine: `Totales — Horas: ${fmtHours(totals.min)}  ·  Ingreso: ${moneyMulti(totals.revenue)}  ·  Costo: ${moneyMulti(totals.cost)}  ·  Margen: ${moneyMulti(totals.margin)}`,
    })
    if (!ok) alert('Permite ventanas emergentes (pop-ups) para generar el PDF.')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold font-playfair flex items-center gap-2"><FileText className="w-6 h-6 text-brand-gold" />Informes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Filtra por período, cliente, abogado, tipo de caso y estado. Exporta a Excel o PDF.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={printReport} disabled={filtered.length === 0}><Printer className="w-4 h-4 mr-1.5" />Imprimir / PDF</Button>
          <Button type="button" onClick={exportCSV} disabled={filtered.length === 0}><Download className="w-4 h-4 mr-1.5" />Exportar Excel (CSV)</Button>
        </div>
      </div>

      {/* Filtros */}
      <Card><CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground mr-1">Atajos:</span>
          {PRESETS.map(([k, label]) => (
            <button key={k} type="button" onClick={() => applyPreset(k)} className="text-xs px-2.5 py-1 rounded-full border border-border hover:bg-muted hover:border-brand-gold/50 transition-colors">{label}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="space-y-1"><Label className="text-xs">Desde</Label><Input type="date" value={f.from} onChange={e => setF(p => ({ ...p, from: e.target.value }))} className="h-8 text-sm" /></div>
          <div className="space-y-1"><Label className="text-xs">Hasta</Label><Input type="date" value={f.to} onChange={e => setF(p => ({ ...p, to: e.target.value }))} className="h-8 text-sm" /></div>
          <div className="space-y-1">
            <Label className="text-xs">Cliente</Label>
            <Select value={f.client_id || 'all'} onValueChange={v => setF(p => ({ ...p, client_id: v === 'all' ? '' : v }))}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent><SelectItem value="all" className="text-xs">Todos</SelectItem>{clients.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {isManager && (
            <div className="space-y-1">
              <Label className="text-xs">Abogado</Label>
              <Select value={f.user_id || 'all'} onValueChange={v => setF(p => ({ ...p, user_id: v === 'all' ? '' : v }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent><SelectItem value="all" className="text-xs">Todos</SelectItem>{users.filter(u => u.role !== 'cliente').map(u => <SelectItem key={u.id} value={u.id} className="text-xs">{u.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Tipo de caso</Label>
            <Select value={f.type || 'all'} onValueChange={v => setF(p => ({ ...p, type: v === 'all' ? '' : v }))}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todos</SelectItem>
                {['litigio', 'consultoría', 'transaccional', 'compliance', 'regulatorio'].map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Facturable</Label>
            <Select value={f.billable || 'all'} onValueChange={v => setF(p => ({ ...p, billable: v === 'all' ? '' : v }))}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent><SelectItem value="all" className="text-xs">Todas</SelectItem><SelectItem value="si" className="text-xs">Solo facturables</SelectItem><SelectItem value="no" className="text-xs">No facturables</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
      </CardContent></Card>

      {/* Totales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Horas</p><p className="text-lg font-bold mt-0.5">{fmtHours(totals.min)}</p><p className="text-[10px] text-muted-foreground">{totals.count} registros</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Ingreso</p><p className="text-sm font-bold mt-0.5">{moneyMulti(totals.revenue)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Costo</p><p className="text-sm font-bold mt-0.5">{moneyMulti(totals.cost)}</p></CardContent></Card>
        <Card className="border-brand-gold/30 bg-gradient-to-br from-brand-gold/5 to-brand-gold/10"><CardContent className="p-4"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Margen</p><p className="text-sm font-bold mt-0.5 text-brand-gold">{moneyMulti(totals.margin)}</p></CardContent></Card>
      </div>

      {/* Tabla */}
      <Card><CardContent className="p-0">
        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No hay registros para los filtros seleccionados.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>{isManager && <TableHead>Abogado</TableHead>}<TableHead>Cliente / Asunto</TableHead>
                  <TableHead>Actividad</TableHead><TableHead>Horas</TableHead><TableHead>Ingreso</TableHead><TableHead>Costo</TableHead><TableHead>Margen</TableHead><TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 200).map(e => {
                  const ingreso = e.billable ? e.amount : 0
                  const costo = e.cost_amount ?? 0
                  const margen = ingreso - costo
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs whitespace-nowrap">{fmtDate(e.date)}</TableCell>
                      {isManager && <TableCell className="text-xs">{e.user?.full_name?.split(' ').slice(0, 2).join(' ')}</TableCell>}
                      <TableCell className="text-xs max-w-[220px]"><p className="font-medium truncate">{e.client?.name}</p>{e.matter?.title && <p className="text-[10px] text-muted-foreground truncate">{e.matter.title}</p>}</TableCell>
                      <TableCell className="text-xs">{e.activity}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{fmtHours(e.minutes)}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{ingreso ? fmtMoney(ingreso, e.currency) : '—'}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">{costo ? fmtMoney(costo, e.currency) : '—'}</TableCell>
                      <TableCell className={`text-xs whitespace-nowrap font-medium ${margen >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtMoney(margen, e.currency)}</TableCell>
                      <TableCell className="text-[10px] text-muted-foreground">{e.status}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            {filtered.length > 200 && <p className="text-[10px] text-muted-foreground text-center py-2">Mostrando 200 de {filtered.length}. Exporta para ver todos.</p>}
          </div>
        )}
      </CardContent></Card>
    </div>
  )
}
