"use client"
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { PieChart, Clock, Receipt, TrendingUp, Users, Wallet, ArrowUpRight, Scale, Layers, FileText, Target, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useData } from '@/shared/context/data-context'
import { useAuthStore } from '@/shared/stores/auth-store'
import { getTimeEntries, getInvoices } from '@/shared/services/db'
import { fmtMoney, fmtHours } from '@/shared/lib/dgatime-format'
import type { TimeEntry, Invoice, DgaCurrency } from '@/shared/types'

type Money = Record<DgaCurrency, number>
const zero = (): Money => ({ COP: 0, USD: 0 })
const sub = (a: Money, b: Money): Money => ({ COP: a.COP - b.COP, USD: a.USD - b.USD })
const totalOf = (m: Money) => m.COP + m.USD
function moneyMulti(m: Money): string {
  const parts: string[] = []
  if (m.COP) parts.push(fmtMoney(m.COP, 'COP'))
  if (m.USD) parts.push(fmtMoney(m.USD, 'USD'))
  return parts.length ? parts.join('  ·  ') : '$ 0'
}
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// Benchmark de utilización: óptimo 70–85%
function utilBand(u: number): { color: string; label: string } {
  if (u >= 70 && u <= 85) return { color: 'text-green-600', label: 'Óptimo (70–85%)' }
  if (u >= 60 && u < 95) return { color: 'text-amber-600', label: u < 70 ? 'Baja (<70%)' : 'Alta (>85%)' }
  return { color: 'text-red-600', label: u < 60 ? 'Muy baja' : 'Sobrecarga' }
}

type Agg = { min: number; billMin: number; revenue: Money; cost: Money; currency: DgaCurrency }
const newAgg = (currency: DgaCurrency): Agg => ({ min: 0, billMin: 0, revenue: zero(), cost: zero(), currency })
function addEntry(a: Agg, e: TimeEntry) {
  a.min += e.minutes
  a.cost[e.currency] += e.cost_amount ?? 0
  if (e.billable) { a.billMin += e.minutes; a.revenue[e.currency] += e.amount }
}
const ingresoHora = (a: Agg) => (a.billMin > 0 ? Math.round(a.revenue[a.currency] / (a.billMin / 60)) : 0)

export default function DgatimeResumenPage() {
  const { clients, users, matters } = useData()
  const authUser = useAuthStore(s => s.user)
  const isManager = authUser?.role === 'socio' || authUser?.role === 'admin'

  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const te = await getTimeEntries()
        setEntries(te)
        if (isManager) { try { setInvoices(await getInvoices()) } catch { /* noop */ } }
      } catch { /* noop */ }
      setLoading(false)
    })()
  }, [isManager])

  const stats = useMemo(() => {
    const totalMin = entries.reduce((s, e) => s + e.minutes, 0)
    const billableMin = entries.filter(e => e.billable).reduce((s, e) => s + e.minutes, 0)
    const utilization = totalMin > 0 ? Math.round((billableMin / totalMin) * 100) : 0

    // Ingreso, costo y margen reales
    const revenue = zero(); const cost = zero()
    entries.forEach(e => { if (e.billable) revenue[e.currency] += e.amount; cost[e.currency] += e.cost_amount ?? 0 })
    const margin = sub(revenue, cost)

    const porFacturarEntries = entries.filter(e => e.billable && e.status === 'aprobado' && !e.invoice_id)
    const porFacturar = zero(); porFacturarEntries.forEach(e => { porFacturar[e.currency] += e.amount })

    const facturado = zero(); const porCobrar = zero()
    invoices.forEach(i => {
      if (i.status === 'pagada' || i.status === 'enviada') facturado[i.currency] += i.total
      if (i.status === 'enviada') porCobrar[i.currency] += i.total
    })

    // Tasa de realización: valor facturado ÷ valor facturable trabajado
    const facturableVal = zero(); const facturadoVal = zero()
    entries.forEach(e => { if (e.billable) { facturableVal[e.currency] += e.amount; if (e.invoice_id) facturadoVal[e.currency] += e.amount } })
    const realizacion = totalOf(facturableVal) > 0 ? Math.round(totalOf(facturadoVal) / totalOf(facturableVal) * 100) : null

    // Tasa de cobro: pagado ÷ emitido (facturas no anuladas)
    let emitido = 0, pagadoTot = 0
    invoices.forEach(i => { if (i.status === 'enviada' || i.status === 'pagada') emitido += i.total; if (i.status === 'pagada') pagadoTot += i.total })
    const cobro = emitido > 0 ? Math.round(pagadoTot / emitido * 100) : null

    // Retrabajo: % de horas marcadas como retrabajo
    const reworkMin = entries.filter(e => e.rework).reduce((s, e) => s + e.minutes, 0)
    const reworkPct = totalMin > 0 ? Math.round(reworkMin / totalMin * 100) : 0

    // Por cliente
    const byClient = new Map<string, Agg>()
    entries.forEach(e => { const a = byClient.get(e.client_id) ?? newAgg(e.currency); addEntry(a, e); byClient.set(e.client_id, a) })
    const clientRows = Array.from(byClient.entries())
      .map(([cid, v]) => ({ cid, name: clients.find(c => c.id === cid)?.name ?? '—', v, margin: sub(v.revenue, v.cost) }))
      .sort((a, b) => totalOf(b.margin) - totalOf(a.margin))

    // Por abogado
    const byUser = new Map<string, Agg>()
    entries.forEach(e => { const a = byUser.get(e.user_id) ?? newAgg(e.currency); addEntry(a, e); byUser.set(e.user_id, a) })
    const userRows = Array.from(byUser.entries())
      .map(([uid, v]) => ({ uid, name: users.find(u => u.id === uid)?.full_name ?? e2name(entries, uid), v, util: v.min > 0 ? Math.round((v.billMin / v.min) * 100) : 0 }))
      .sort((a, b) => b.v.min - a.v.min)

    // Por asunto (rentabilidad)
    const byMatter = new Map<string, { title: string; type: string; v: Agg }>()
    entries.filter(e => e.matter_id).forEach(e => {
      const cur = byMatter.get(e.matter_id!) ?? { title: e.matter?.title ?? '—', type: e.matter?.type ?? '—', v: newAgg(e.currency) }
      addEntry(cur.v, e); byMatter.set(e.matter_id!, cur)
    })
    const matterRows = Array.from(byMatter.entries())
      .map(([id, r]) => ({ id, ...r, margin: sub(r.v.revenue, r.v.cost), ih: ingresoHora(r.v) }))
      .sort((a, b) => totalOf(b.margin) - totalOf(a.margin))

    // Por tipo de caso (con tiempo promedio por asunto)
    const byType = new Map<string, Agg>()
    const typeMatters = new Map<string, Set<string>>()
    entries.filter(e => e.matter?.type).forEach(e => {
      const a = byType.get(e.matter!.type) ?? newAgg(e.currency); addEntry(a, e); byType.set(e.matter!.type, a)
      if (e.matter_id) { const set = typeMatters.get(e.matter!.type) ?? new Set<string>(); set.add(e.matter_id); typeMatters.set(e.matter!.type, set) }
    })
    const typeRows = Array.from(byType.entries())
      .map(([type, v]) => { const nm = typeMatters.get(type)?.size ?? 0; return { type, v, margin: sub(v.revenue, v.cost), ih: ingresoHora(v), avgMin: nm > 0 ? Math.round(v.min / nm) : v.min, nMatters: nm } })
      .sort((a, b) => totalOf(b.v.revenue) - totalOf(a.v.revenue))

    // Presupuesto vs real por asunto
    const budgetRows = matters
      .filter(m => (m.budget_hours ?? 0) > 0 || (m.budget_amount ?? 0) > 0)
      .map(m => {
        const a = byMatter.get(m.id)?.v
        const cur: DgaCurrency = m.budget_currency ?? 'COP'
        const actualMin = a?.min ?? 0
        const actualAmount = a ? a.revenue[cur] : 0
        const pctHours = m.budget_hours ? Math.round((actualMin / 60) / m.budget_hours * 100) : null
        const pctAmount = m.budget_amount ? Math.round(actualAmount / m.budget_amount * 100) : null
        const over = (pctHours ?? 0) > 100 || (pctAmount ?? 0) > 100
        const warn = !over && ((pctHours ?? 0) >= 80 || (pctAmount ?? 0) >= 80)
        return { id: m.id, title: m.title, cur, budget_hours: m.budget_hours, budget_amount: m.budget_amount, actualMin, actualAmount, pctHours, pctAmount, over, warn }
      })
      .sort((a, b) => Math.max(b.pctHours ?? 0, b.pctAmount ?? 0) - Math.max(a.pctHours ?? 0, a.pctAmount ?? 0))

    return {
      totalMin, billableMin, utilization, revenue, cost, margin,
      porFacturar, porFacturarCount: porFacturarEntries.length, facturado, porCobrar,
      realizacion, cobro, reworkPct,
      clientRows, userRows, matterRows, typeRows, budgetRows,
    }
  }, [entries, invoices, clients, users, matters])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold font-playfair flex items-center gap-2"><PieChart className="w-6 h-6 text-brand-gold" />DGA-Time · Resumen</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{isManager ? 'Rentabilidad real (ingreso − costo), por asunto, tipo de caso y abogado.' : 'Tu productividad y horas facturables.'}</p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Cargando…</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Card><CardContent className="p-4">
              <div className="w-8 h-8 rounded-lg bg-brand-navy/8 flex items-center justify-center mb-2"><Clock className="w-4 h-4 text-brand-navy" /></div>
              <p className="text-xl font-bold">{fmtHours(stats.totalMin)}</p>
              <p className="text-[11px] font-medium mt-0.5">Horas registradas</p>
              <p className="text-[10px] text-muted-foreground">{fmtHours(stats.billableMin)} facturables</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center mb-2"><TrendingUp className="w-4 h-4 text-blue-600" /></div>
              <p className={`text-xl font-bold ${utilBand(stats.utilization).color}`}>{stats.utilization}%</p>
              <p className="text-[11px] font-medium mt-0.5">Utilización</p>
              <p className={`text-[10px] ${utilBand(stats.utilization).color}`}>{utilBand(stats.utilization).label}</p>
            </CardContent></Card>
            <Card className="border-brand-gold/30 bg-gradient-to-br from-brand-gold/5 to-brand-gold/10"><CardContent className="p-4">
              <div className="w-8 h-8 rounded-lg bg-brand-gold/15 flex items-center justify-center mb-2"><Wallet className="w-4 h-4 text-brand-gold" /></div>
              <p className="text-base font-bold text-brand-gold leading-tight">{moneyMulti(stats.margin)}</p>
              <p className="text-[11px] font-medium mt-0.5">Margen real</p>
              <p className="text-[10px] text-muted-foreground">Ingreso − costo</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center mb-2"><Wallet className="w-4 h-4 text-purple-600" /></div>
              <p className="text-base font-bold leading-tight">{moneyMulti(stats.porFacturar)}</p>
              <p className="text-[11px] font-medium mt-0.5">Por facturar</p>
              <p className="text-[10px] text-muted-foreground">{stats.porFacturarCount} aprobados</p>
            </CardContent></Card>
          </div>

          {/* Segunda fila: indicadores financieros y de eficiencia */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card><CardContent className="p-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center mb-2"><Receipt className="w-4 h-4 text-indigo-600" /></div>
              <p className="text-xl font-bold">{stats.realizacion !== null ? `${stats.realizacion}%` : '—'}</p>
              <p className="text-[11px] font-medium mt-0.5">Tasa de realización</p>
              <p className="text-[10px] text-muted-foreground">Facturado ÷ trabajado</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center mb-2"><Wallet className="w-4 h-4 text-green-600" /></div>
              <p className="text-xl font-bold">{stats.cobro !== null ? `${stats.cobro}%` : '—'}</p>
              <p className="text-[11px] font-medium mt-0.5">Tasa de cobro</p>
              <p className="text-[10px] text-muted-foreground">Pagado ÷ facturado</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center mb-2"><AlertTriangle className="w-4 h-4 text-amber-600" /></div>
              <p className={`text-xl font-bold ${stats.reworkPct > 15 ? 'text-red-600' : stats.reworkPct > 5 ? 'text-amber-600' : ''}`}>{stats.reworkPct}%</p>
              <p className="text-[11px] font-medium mt-0.5">Retrabajo</p>
              <p className="text-[10px] text-muted-foreground">del tiempo total</p>
            </CardContent></Card>
            {isManager ? (
              <Card><CardContent className="p-4">
                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center mb-2"><Receipt className="w-4 h-4 text-green-600" /></div>
                <p className="text-base font-bold leading-tight">{moneyMulti(stats.facturado)}</p>
                <p className="text-[11px] font-medium mt-0.5">Facturado</p>
                <p className="text-[10px] text-muted-foreground">Por cobrar: {moneyMulti(stats.porCobrar)}</p>
              </CardContent></Card>
            ) : (
              <Card><CardContent className="p-4">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center mb-2"><Clock className="w-4 h-4 text-amber-600" /></div>
                <p className="text-xl font-bold">{entries.filter(e => e.status === 'borrador').length}</p>
                <p className="text-[11px] font-medium mt-0.5">Pendientes</p>
                <p className="text-[10px] text-muted-foreground">Por aprobar</p>
              </CardContent></Card>
            )}
          </div>

          {/* Rentabilidad por asunto y por tipo de caso */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Scale className="w-4 h-4" />Rentabilidad por asunto</CardTitle></CardHeader>
              <CardContent className="space-y-1 pt-0">
                {stats.matterRows.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-6 text-center">Registra horas en asuntos para ver su rentabilidad.</p>
                ) : stats.matterRows.slice(0, 8).map(r => {
                  const m = totalOf(r.margin)
                  return (
                    <div key={r.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{r.title}</p>
                        <p className="text-[10px] text-muted-foreground">{capitalize(r.type)} · {fmtHours(r.v.min)} · {fmtMoney(r.ih, r.v.currency)}/h</p>
                      </div>
                      <p className={`text-xs font-semibold whitespace-nowrap ${m >= 0 ? 'text-green-700' : 'text-red-600'}`}>{moneyMulti(r.margin)}</p>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Layers className="w-4 h-4" />Rentabilidad por tipo de caso</CardTitle></CardHeader>
              <CardContent className="space-y-1 pt-0">
                {stats.typeRows.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-6 text-center">Sin datos todavía.</p>
                ) : stats.typeRows.map(r => {
                  const m = totalOf(r.margin)
                  return (
                    <div key={r.type} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{capitalize(r.type)}</p>
                        <p className="text-[10px] text-muted-foreground">{fmtHours(r.v.min)}{r.nMatters > 0 ? ` · prom ${fmtHours(r.avgMin)}/asunto` : ''} · <strong>{fmtMoney(r.ih, r.v.currency)}/h</strong></p>
                      </div>
                      <p className={`text-xs font-semibold whitespace-nowrap ${m >= 0 ? 'text-green-700' : 'text-red-600'}`}>{moneyMulti(r.margin)}</p>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>

          {/* Por cliente y por abogado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4" />Rentabilidad por cliente</CardTitle>
                <Link href="/dgatime/informes" className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5">Informes <FileText className="w-3 h-3" /></Link>
              </CardHeader>
              <CardContent className="space-y-1 pt-0">
                {stats.clientRows.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-6 text-center">Sin horas registradas todavía.</p>
                ) : stats.clientRows.slice(0, 8).map(r => {
                  const m = totalOf(r.margin)
                  return (
                    <div key={r.cid} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{r.name}</p>
                        <p className="text-[10px] text-muted-foreground">{fmtHours(r.v.min)} · ingreso {moneyMulti(r.v.revenue)}</p>
                      </div>
                      <p className={`text-xs font-semibold whitespace-nowrap ${m >= 0 ? 'text-green-700' : 'text-red-600'}`}>{moneyMulti(r.margin)}</p>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4" />{isManager ? 'Desempeño del equipo' : 'Tu desempeño'}</CardTitle></CardHeader>
              <CardContent className="space-y-1 pt-0">
                {stats.userRows.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-6 text-center">Sin datos todavía.</p>
                ) : stats.userRows.slice(0, 8).map(r => (
                  <div key={r.uid} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{r.name}</p>
                      <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden max-w-[160px]">
                        <div className="h-full bg-brand-gold rounded-full" style={{ width: `${r.util}%` }} />
                      </div>
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-xs font-semibold">{fmtHours(r.v.min)}</p>
                      <p className="text-[10px] text-muted-foreground">{r.util}% fact.</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Presupuesto vs real por asunto (control de avance + alerta) */}
          {stats.budgetRows.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Target className="w-4 h-4" />Presupuesto vs real por asunto</CardTitle></CardHeader>
              <CardContent className="space-y-3 pt-0">
                {stats.budgetRows.map(b => (
                  <div key={b.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium truncate flex items-center gap-1.5">
                        {b.over ? <AlertTriangle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" /> : b.warn ? <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />}
                        {b.title}
                      </p>
                      {b.over && <span className="text-[10px] font-semibold text-red-600 whitespace-nowrap">Sobre-ejecutado</span>}
                    </div>
                    {b.budget_hours ? (
                      <div>
                        <div className="flex justify-between text-[10px] text-muted-foreground"><span>Horas: {fmtHours(b.actualMin)} / {b.budget_hours}h</span><span>{b.pctHours}%</span></div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className={`h-full rounded-full ${(b.pctHours ?? 0) > 100 ? 'bg-red-500' : (b.pctHours ?? 0) >= 80 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, b.pctHours ?? 0)}%` }} /></div>
                      </div>
                    ) : null}
                    {b.budget_amount ? (
                      <div>
                        <div className="flex justify-between text-[10px] text-muted-foreground"><span>Monto: {fmtMoney(b.actualAmount, b.cur)} / {fmtMoney(b.budget_amount, b.cur)}</span><span>{b.pctAmount}%</span></div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className={`h-full rounded-full ${(b.pctAmount ?? 0) > 100 ? 'bg-red-500' : (b.pctAmount ?? 0) >= 80 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, b.pctAmount ?? 0)}%` }} /></div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function e2name(entries: TimeEntry[], uid: string): string {
  return entries.find(e => e.user_id === uid)?.user?.full_name ?? '—'
}
