"use client"
import { useState } from 'react'
import { FileText, Download, Eye, Search, CheckCircle2, Clock, Archive, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useData } from '@/shared/context/data-context'
import type { Document } from '@/shared/types'

const CLIENT_ID = 'cl1'

const STATUS_CONFIG: Record<string, { label: string; variant: string; icon: React.ElementType }> = {
  pendiente:    { label: 'Pendiente',    variant: 'outline',  icon: Clock },
  en_revisión:  { label: 'En revisión',  variant: 'revision', icon: Clock },
  revisado:     { label: 'Revisado',     variant: 'aprobado', icon: CheckCircle2 },
  aprobado:     { label: 'Aprobado',     variant: 'aprobado', icon: CheckCircle2 },
  archivado:    { label: 'Archivado',    variant: 'default',  icon: Archive },
}

const TYPE_LABELS: Record<string, string> = {
  contrato: 'Contrato', acta: 'Acta', concepto: 'Concepto', certificado: 'Certificado',
  poder: 'Poder', demanda: 'Demanda', contestacion: 'Contestación', otro: 'Otro',
}

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-foreground text-background text-sm px-4 py-3 rounded-xl shadow-lg">
      {msg}<button type="button" title="Cerrar" onClick={onClose}><X className="w-3.5 h-3.5" /></button>
    </div>
  )
}

export default function PortalDocumentosPage() {
  const { documents, clients, loading } = useData()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('todos')
  const [selected, setSelected] = useState<Document | null>(null)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }
  const client = clients.find(c => c.id === CLIENT_ID)

  const myDocs = documents.filter(d => d.client_id === CLIENT_ID)
  const filtered = myDocs.filter(d => {
    const matchSearch = !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.type?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'todos' || d.status === filterStatus
    return matchSearch && matchStatus
  })

  function download(doc: Document) {
    const content = `DOCUMENTO: ${doc.name}\nTipo: ${TYPE_LABELS[doc.type] ?? doc.type}\nEstado: ${doc.status}\nCliente: ${client?.name ?? 'DG&A'}\nFecha: ${new Date().toLocaleDateString('es-CO')}\n\n[Documento descargado desde el Portal DG&A. Para el documento completo contacte a su abogado asignado.]`
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${doc.name.replace(/\s+/g, '-').toLowerCase()}.txt`; a.click()
    URL.revokeObjectURL(url)
    showToast(`"${doc.name}" descargado`)
  }

  const statuses = ['todos', ...Array.from(new Set(myDocs.map(d => d.status)))]

  return (
    <div className="space-y-5 max-w-[900px]">
      <div>
        <h1 className="text-xl font-semibold font-playfair text-foreground">Mis Documentos</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Documentos compartidos por DG&amp;A Abogados</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total documentos', value: myDocs.length, color: 'text-foreground' },
          { label: 'Aprobados', value: myDocs.filter(d => d.status === 'aprobado' || d.status === 'revisado').length, color: 'text-green-600' },
          { label: 'En revisión', value: myDocs.filter(d => d.status === 'en_revisión').length, color: 'text-yellow-600' },
        ].map(s => (
          <div key={s.label} className="p-3 rounded-xl border border-border bg-white text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar documentos..."
                className="pl-8 text-sm h-8"
              />
            </div>
            <div className="flex gap-1.5">
              {statuses.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilterStatus(s)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${filterStatus === s ? 'bg-brand-navy text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
                >
                  {s === 'todos' ? 'Todos' : (STATUS_CONFIG[s]?.label ?? s)}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Cargando documentos...</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center">
              <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No se encontraron documentos</p>
            </div>
          ) : (
            filtered.map(doc => {
              const cfg = STATUS_CONFIG[doc.status] ?? { label: doc.status, variant: 'outline', icon: FileText }
              const Icon = cfg.icon
              return (
                <div key={doc.id} className="flex items-center gap-3 p-3 bg-white border border-border rounded-lg hover:border-brand-navy/30 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-brand-navy/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-brand-navy" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground capitalize">{TYPE_LABELS[doc.type] ?? doc.type}</span>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(doc.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${doc.status === 'aprobado' || doc.status === 'revisado' ? 'bg-green-50 border-green-200 text-green-700' : doc.status === 'en_revisión' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                      <Icon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                    <button type="button" title="Ver detalles" onClick={() => setSelected(doc)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" title="Descargar" onClick={() => download(doc)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Detalle del documento</DialogTitle></DialogHeader>
          {selected && (() => {
            const cfg = STATUS_CONFIG[selected.status] ?? { label: selected.status, variant: 'outline', icon: FileText }
            return (
              <div className="space-y-4 mt-1">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-brand-navy/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-brand-navy" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-snug">{selected.name}</p>
                    <p className="text-[11px] text-muted-foreground capitalize">{TYPE_LABELS[selected.type] ?? selected.type}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-muted/40 rounded-lg p-2.5">
                    <p className="text-[10px] text-muted-foreground">Estado</p>
                    <p className={`font-semibold mt-0.5 ${selected.status === 'aprobado' || selected.status === 'revisado' ? 'text-green-600' : selected.status === 'en_revisión' ? 'text-yellow-600' : 'text-foreground'}`}>{cfg.label}</p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-2.5">
                    <p className="text-[10px] text-muted-foreground">Fecha</p>
                    <p className="font-semibold mt-0.5">{new Date(selected.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: '2-digit' })}</p>
                  </div>
                </div>
                <Button type="button" size="sm" className="w-full bg-brand-navy hover:bg-brand-navy/90 text-white" onClick={() => { download(selected); setSelected(null) }}>
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Descargar documento
                </Button>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {toast && <Toast msg={toast} onClose={() => setToast('')} />}
    </div>
  )
}
