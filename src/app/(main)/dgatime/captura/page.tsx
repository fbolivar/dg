"use client"
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Sparkles, Check, X, Trash2, Lock, Zap, PlusCircle, FileText, Scale, FileSignature, PenLine, Loader2, Plug } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useData } from '@/shared/context/data-context'
import { getCapturedActivities, capturarMiDia, approveCapturedActivity, discardCapturedActivity, addManualCapture } from '@/shared/services/db'
import { fmtHours, fmtDate } from '@/shared/lib/dgatime-format'
import type { CapturedActivity, CaptureStatus, CaptureConfidence } from '@/shared/types'

const ACTIVITIES = ['Reunión', 'Redacción', 'Investigación', 'Audiencia', 'Llamada', 'Revisión documental', 'Gestión', 'Diligencia', 'Otro']
const CONF_STYLE: Record<CaptureConfidence, string> = { alto: 'bg-green-50 text-green-700 border-green-200', medio: 'bg-amber-50 text-amber-700 border-amber-200', bajo: 'bg-gray-100 text-gray-500 border-gray-200' }
const KIND_ICON: Record<string, typeof FileText> = { documento: FileText, contrato: FileSignature, evento_asunto: Scale, manual: PenLine }
const KIND_LABEL: Record<string, string> = { documento: 'Documento', contrato: 'Contrato', evento_asunto: 'Asunto', legal_note: 'Legal Note', manual: 'Manual' }

type Edit = { client_id: string; matter_id: string; glosa: string; minutes: string; billable: boolean; activity: string }

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  return <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-foreground text-background text-sm px-4 py-3 rounded-xl shadow-lg max-w-sm">{msg}<button type="button" title="Cerrar" onClick={onClose}><X className="w-3.5 h-3.5" /></button></div>
}

export default function CapturaPage() {
  const { clients, matters } = useData()
  const [activities, setActivities] = useState<CapturedActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [capturing, setCapturing] = useState(false)
  const [tab, setTab] = useState<CaptureStatus>('sugerida')
  const [edits, setEdits] = useState<Record<string, Edit>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 4000) }

  // Captura manual
  const [manualOpen, setManualOpen] = useState(false)
  const [manual, setManual] = useState({ note: '', client_id: '', matter_id: '', date: new Date().toISOString().slice(0, 10), minutes: '' })
  const [manualBusy, setManualBusy] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const list = await getCapturedActivities()
      setActivities(list)
      const e: Record<string, Edit> = {}
      list.filter(a => a.status === 'sugerida').forEach(a => {
        e[a.id] = { client_id: a.suggested_client_id ?? '', matter_id: a.suggested_matter_id ?? '', glosa: a.suggested_glosa, minutes: String(a.suggested_minutes), billable: a.suggested_billable, activity: a.suggested_activity }
      })
      setEdits(e)
    } catch { /* noop */ }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function capturar() {
    if (capturing) return
    setCapturing(true)
    try { const r = await capturarMiDia(); await load(); showToast(r.captured > 0 ? `${r.captured} actividad(es) detectada(s) y lista(s) para revisar` : 'No se detectó actividad nueva para capturar') }
    catch (err) { showToast(err instanceof Error ? err.message : 'Error') }
    setCapturing(false)
  }

  function setEdit(id: string, patch: Partial<Edit>) { setEdits(prev => ({ ...prev, [id]: { ...prev[id], ...patch } })) }

  async function approve(a: CapturedActivity) {
    const e = edits[a.id]
    if (!e?.client_id) { showToast('Asigna un cliente antes de aprobar'); return }
    setBusy(a.id)
    try {
      await approveCapturedActivity(a.id, { client_id: e.client_id, matter_id: e.matter_id || null, activity: e.activity, glosa: e.glosa, minutes: Number(e.minutes) || 0, billable: e.billable })
      await load(); showToast('Aprobada → registro de horas creado (borrador)')
    } catch (err) { showToast(err instanceof Error ? err.message : 'Error') }
    setBusy(null)
  }
  async function discard(a: CapturedActivity) {
    setBusy(a.id)
    try { await discardCapturedActivity(a.id); await load(); showToast('Sugerencia descartada') }
    catch (err) { showToast(err instanceof Error ? err.message : 'Error') }
    setBusy(null)
  }

  async function saveManual() {
    if (!manual.note.trim()) { showToast('Escribe la actividad'); return }
    setManualBusy(true)
    try {
      await addManualCapture({ note: manual.note, client_id: manual.client_id || undefined, matter_id: manual.matter_id || undefined, date: manual.date, minutes: manual.minutes ? Number(manual.minutes) : undefined })
      setManualOpen(false); setManual({ note: '', client_id: '', matter_id: '', date: new Date().toISOString().slice(0, 10), minutes: '' })
      setTab('sugerida'); await load(); showToast('Actividad anotada — la IA redactó la glosa')
    } catch (err) { showToast(err instanceof Error ? err.message : 'Error') }
    setManualBusy(false)
  }

  const counts = useMemo(() => ({
    sugerida: activities.filter(a => a.status === 'sugerida').length,
    aprobada: activities.filter(a => a.status === 'aprobada').length,
    descartada: activities.filter(a => a.status === 'descartada').length,
  }), [activities])
  const shown = activities.filter(a => a.status === tab)
  const mattersFor = (cid: string) => matters.filter(m => !cid || m.client_id === cid)

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold font-playfair flex items-center gap-2"><Sparkles className="w-6 h-6 text-brand-gold" />Captura inteligente</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Detecta tu actividad del día, la clasifica y redacta la glosa. Tú revisas, ajustas y apruebas con un clic.</p>
          <Link href="/perfil" className="text-xs text-brand-navy hover:underline inline-flex items-center gap-1 mt-1"><Plug className="w-3 h-3" />Conecta tu correo y calendario en Mi perfil</Link>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setManualOpen(true)}><PlusCircle className="w-4 h-4 mr-1.5" />Anotar actividad</Button>
          <Button type="button" onClick={capturar} disabled={capturing}>{capturing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Zap className="w-4 h-4 mr-1.5" />}{capturing ? 'Capturando…' : 'Capturar mi día'}</Button>
        </div>
      </div>

      {/* Aviso de privacidad */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 border border-border rounded-lg px-3 py-2">
        <Lock className="w-3.5 h-3.5 text-brand-navy flex-shrink-0" />
        Privado: estas sugerencias solo las ves tú. Nada se factura hasta que apruebes. Procesamiento confidencial en el servidor de la firma.
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {([['sugerida', 'Por revisar'], ['aprobada', 'Aprobadas'], ['descartada', 'Descartadas']] as [CaptureStatus, string][]).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${tab === k ? 'border-brand-gold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {label} <span className="ml-1 text-[10px] text-muted-foreground">({counts[k]})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Cargando…</div>
      ) : shown.length === 0 ? (
        <div className="py-16 text-center">
          <Sparkles className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{tab === 'sugerida' ? 'No hay sugerencias por revisar' : tab === 'aprobada' ? 'Sin actividades aprobadas' : 'Sin actividades descartadas'}</p>
          {tab === 'sugerida' && <p className="text-xs text-muted-foreground mt-0.5">Pulsa &quot;Capturar mi día&quot; o anota una actividad para empezar.</p>}
        </div>
      ) : tab === 'sugerida' ? (
        <div className="space-y-3">
          {shown.map(a => {
            const e = edits[a.id]
            if (!e) return null
            const Icon = KIND_ICON[a.source_kind] ?? Sparkles
            return (
              <Card key={a.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-brand-navy/8 flex items-center justify-center flex-shrink-0"><Icon className="w-3.5 h-3.5 text-brand-navy" /></span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{a.title}</p>
                        <p className="text-[10px] text-muted-foreground">{KIND_LABEL[a.source_kind] ?? a.source} · {fmtDate(a.occurred_at)}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${CONF_STYLE[a.confidence]}`} title="Confianza de la IA">conf. {a.confidence}</span>
                  </div>

                  {/* Glosa editable */}
                  <div>
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Glosa (descripción de facturación)</Label>
                    <textarea value={e.glosa} onChange={ev => setEdit(a.id, { glosa: ev.target.value })} rows={2} className="w-full mt-1 text-sm rounded-md border border-border px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-brand-gold/40" />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Cliente</Label>
                      <Select value={e.client_id} onValueChange={v => setEdit(a.id, { client_id: v, matter_id: '' })}>
                        <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Asignar" /></SelectTrigger>
                        <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Asunto</Label>
                      <Select value={e.matter_id || 'none'} onValueChange={v => setEdit(a.id, { matter_id: v === 'none' ? '' : v })}>
                        <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="none" className="text-xs">— Sin asunto —</SelectItem>{mattersFor(e.client_id).map(m => <SelectItem key={m.id} value={m.id} className="text-xs">{m.title}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Actividad</Label>
                      <Select value={e.activity} onValueChange={v => setEdit(a.id, { activity: v })}>
                        <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>{ACTIVITIES.map(ac => <SelectItem key={ac} value={ac} className="text-xs">{ac}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Minutos ({fmtHours(Number(e.minutes) || 0)})</Label>
                      <Input type="number" min="0" value={e.minutes} onChange={ev => setEdit(a.id, { minutes: ev.target.value })} className="text-xs h-8" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                    <button type="button" onClick={() => setEdit(a.id, { billable: !e.billable })} className="flex items-center gap-1.5 text-xs">
                      <span className={`w-4 h-4 rounded border flex items-center justify-center ${e.billable ? 'bg-brand-gold border-brand-gold text-white' : 'border-muted-foreground/40'}`}>{e.billable && <Check className="w-3 h-3" />}</span>
                      Facturable
                    </button>
                    <div className="flex items-center gap-2">
                      <Button type="button" size="sm" variant="outline" className="h-8 text-xs text-muted-foreground" disabled={busy === a.id} onClick={() => discard(a)}><Trash2 className="w-3.5 h-3.5 mr-1" />Descartar</Button>
                      <Button type="button" size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700" disabled={busy === a.id} onClick={() => approve(a)}>{busy === a.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}Aprobar</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        // Aprobadas / Descartadas (resumen)
        <div className="space-y-2">
          {shown.map(a => (
            <Card key={a.id}><CardContent className="p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{a.suggested_glosa || a.title}</p>
                <p className="text-[10px] text-muted-foreground">{a.suggested_client?.name ?? clients.find(c => c.id === a.suggested_client_id)?.name ?? '—'} · {fmtDate(a.occurred_at)} · {fmtHours(a.suggested_minutes)}</p>
              </div>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${a.status === 'aprobada' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>{a.status === 'aprobada' ? 'Aprobada' : 'Descartada'}</span>
            </CardContent></Card>
          ))}
        </div>
      )}

      {/* Captura manual */}
      <Dialog open={manualOpen} onOpenChange={v => { if (!v) setManualOpen(false) }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Anotar actividad</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">¿Qué hiciste? *</Label>
              <textarea value={manual.note} onChange={e => setManual(p => ({ ...p, note: e.target.value }))} rows={3} className="w-full text-sm rounded-md border border-border px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-brand-gold/40" placeholder="Ej. Reunión con el cliente para revisar la estrategia del litigio laboral…" />
              <p className="text-[10px] text-muted-foreground">La IA redactará la glosa profesional y estimará la duración.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Cliente</Label>
                <Select value={manual.client_id || 'none'} onValueChange={v => setManual(p => ({ ...p, client_id: v === 'none' ? '' : v, matter_id: '' }))}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent><SelectItem value="none" className="text-xs">— Sin asignar —</SelectItem>{clients.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Asunto</Label>
                <Select value={manual.matter_id || 'none'} onValueChange={v => setManual(p => ({ ...p, matter_id: v === 'none' ? '' : v }))}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent><SelectItem value="none" className="text-xs">— Sin asunto —</SelectItem>{mattersFor(manual.client_id).map(m => <SelectItem key={m.id} value={m.id} className="text-xs">{m.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label className="text-xs">Fecha</Label><Input type="date" value={manual.date} onChange={e => setManual(p => ({ ...p, date: e.target.value }))} className="text-sm" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Minutos (opc.)</Label><Input type="number" min="0" value={manual.minutes} onChange={e => setManual(p => ({ ...p, minutes: e.target.value }))} className="text-sm" placeholder="IA estima" /></div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" size="sm" className="flex-1" onClick={saveManual} disabled={manualBusy}>{manualBusy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}Anotar y redactar glosa</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setManualOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {toast && <Toast msg={toast} onClose={() => setToast('')} />}
    </div>
  )
}
