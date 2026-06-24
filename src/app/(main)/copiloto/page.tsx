"use client"
import { useState, useRef, useEffect } from 'react'
import {
  Send, Loader2, FileText, MessageSquare, AlertTriangle, Star,
  Copy, CheckSquare, Check, Plus, Trash2, Library
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import * as db from '@/shared/services/db'
import { useData } from '@/shared/context/data-context'
import { useKnowledgeStore } from '@/shared/stores/knowledge-store'
import type { CopilotMessage } from '@/shared/types'

type NoteState = { draftId?: string; status?: 'borrador_ia' | 'en_revisión'; saving?: boolean }

function ConfidenceBadge({ level }: { level?: string }) {
  const map: Record<string, { label: string; class: string }> = {
    alto: { label: 'Confianza alta', class: 'bg-green-100 text-green-800 border-green-200' },
    medio: { label: 'Confianza media', class: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    bajo: { label: 'Confianza baja', class: 'bg-red-100 text-red-800 border-red-200' },
  }
  const config = map[level ?? 'medio']
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${config.class}`}>
      <Star className="w-2.5 h-2.5" />
      {config.label}
    </span>
  )
}

export default function DgaIaPage() {
  const { refresh } = useData()
  const { sources, addSource, removeSource } = useKnowledgeStore()
  const [messages, setMessages] = useState<CopilotMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [noteState, setNoteState] = useState<Record<number, NoteState>>({})
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [sourceDialog, setSourceDialog] = useState(false)
  const [newSource, setNewSource] = useState({ title: '', content: '' })
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function agregarFuente() {
    if (!newSource.title.trim() || !newSource.content.trim()) return
    addSource(newSource.title, newSource.content)
    setNewSource({ title: '', content: '' })
  }

  async function crearBorrador(idx: number, msg: CopilotMessage) {
    if (noteState[idx]?.draftId || noteState[idx]?.saving) return
    setNoteState(prev => ({ ...prev, [idx]: { ...prev[idx], saving: true } }))
    const firstLine = msg.content.split('\n').find(l => l.trim()) ?? 'Consulta jurídica'
    const note = await db.createLegalNote({
      title: `Borrador IA — ${firstLine.replace(/[*#>]/g, '').trim().slice(0, 70)}`,
      practice_area_id: 'pa1',
      audience: 'área_legal',
      tone: 'técnico',
      content_draft: msg.content,
      status: 'borrador_ia',
      author_id: 'u1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    if (note) {
      setNoteState(prev => ({ ...prev, [idx]: { draftId: note.id, status: 'borrador_ia' } }))
      await refresh('legal_notes')
    } else {
      setNoteState(prev => ({ ...prev, [idx]: { ...prev[idx], saving: false } }))
    }
  }

  async function enviarRevision(idx: number) {
    const st = noteState[idx]
    if (!st?.draftId || st.status === 'en_revisión' || st.saving) return
    setNoteState(prev => ({ ...prev, [idx]: { ...prev[idx], saving: true } }))
    await db.updateLegalNote(st.draftId, { status: 'en_revisión', reviewer_id: 'u1' })
    setNoteState(prev => ({ ...prev, [idx]: { draftId: st.draftId, status: 'en_revisión' } }))
    await refresh('legal_notes')
  }

  async function copiar(idx: number, content: string) {
    try {
      await navigator.clipboard.writeText(content)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = content
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch { /* noop */ }
      document.body.removeChild(ta)
    }
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(prev => (prev === idx ? null : prev)), 1800)
  }

  async function sendMessage() {
    if (!input.trim() || loading) return
    const userMsg: CopilotMessage = { role: 'user', content: input.trim(), timestamp: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    const apiMessages = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))

    try {
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          sources: sources.map(s => ({ title: s.title, content: s.content })),
        }),
      })
      const data = await res.json()
      const assistantMsg: CopilotMessage = {
        role: 'assistant',
        content: res.ok ? data.content : 'Lo siento, hubo un error al procesar su consulta. Por favor intente de nuevo.',
        confidence: res.ok ? data.confidence : 'bajo',
        requires_review: res.ok ? data.requires_review : false,
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Error de conexión. Verifique su conexión a internet y la configuración de la API.',
        confidence: 'bajo',
        requires_review: true,
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-7rem)] lg:h-[calc(100vh-8rem)] gap-4 max-w-[1300px]">
      {/* Main Chat */}
      <div className="flex-1 flex flex-col bg-white rounded-lg border border-border overflow-hidden">
        {/* Chat Header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 bg-brand-navy/3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-md bg-brand-navy flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">DG&A IA</p>
              <p className="text-[10px] text-muted-foreground truncate">Asistencia legal interactiva — powered by Claude</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setSourceDialog(true)}
              className="lg:hidden flex items-center gap-1 text-[11px] font-medium text-brand-navy bg-brand-navy/8 border border-brand-navy/15 px-2.5 py-1 rounded-md"
            >
              <Library className="w-3 h-3" />Fuentes ({sources.length})
            </button>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
              <AlertTriangle className="w-3 h-3" />
              Requiere revisión de abogado
            </div>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {messages.length === 0 && (
              <div className="py-12 text-center max-w-md mx-auto">
                <div className="w-12 h-12 rounded-xl bg-brand-navy/8 flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-6 h-6 text-brand-navy" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1.5">Consulta interactiva con DG&A IA</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Escriba su consulta jurídica con base en su experiencia. DG&A IA responde con derecho colombiano y prioriza las <strong className="text-foreground">fuentes propias de la firma</strong> que cargue.
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-3", msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold",
                  msg.role === 'user' ? 'bg-brand-navy text-white' : 'bg-brand-gold/20 text-brand-gold border border-brand-gold/30'
                )}>
                  {msg.role === 'user' ? 'U' : 'IA'}
                </div>
                <div className={cn("max-w-[75%]", msg.role === 'user' ? 'items-end flex flex-col' : '')}>
                  <div className={cn(
                    "rounded-lg px-4 py-3 text-sm",
                    msg.role === 'user'
                      ? 'bg-brand-navy text-white rounded-tr-sm'
                      : 'bg-muted text-foreground rounded-tl-sm border border-border'
                  )}>
                    <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <ConfidenceBadge level={msg.confidence} />
                      {msg.requires_review && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border bg-red-50 text-red-700 border-red-200">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          Requiere criterio de socio
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(msg.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {(() => {
                        const st = noteState[i]
                        const hasDraft = !!st?.draftId
                        const inReview = st?.status === 'en_revisión'
                        return (
                          <>
                            <Button
                              size="sm" variant="outline"
                              onClick={() => crearBorrador(i, msg)}
                              disabled={hasDraft || st?.saving}
                              className={cn('h-6 text-[10px] px-2', hasDraft && 'border-green-300 bg-green-50 text-green-700')}
                            >
                              {st?.saving && !hasDraft ? <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" />
                                : hasDraft ? <Check className="w-2.5 h-2.5 mr-1" />
                                : <FileText className="w-2.5 h-2.5 mr-1" />}
                              {hasDraft ? 'Borrador creado' : 'Crear borrador'}
                            </Button>
                            <Button
                              size="sm" variant="outline"
                              onClick={() => enviarRevision(i)}
                              disabled={!hasDraft || inReview || st?.saving}
                              className={cn('h-6 text-[10px] px-2', inReview && 'border-amber-300 bg-amber-50 text-amber-700')}
                            >
                              {st?.saving && hasDraft && !inReview ? <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" />
                                : inReview ? <Check className="w-2.5 h-2.5 mr-1" />
                                : <CheckSquare className="w-2.5 h-2.5 mr-1" />}
                              {inReview ? 'En revisión' : 'Enviar a revisión'}
                            </Button>
                            <Button
                              size="sm" variant="outline"
                              onClick={() => copiar(i, msg.content)}
                              className={cn('h-6 text-[10px] px-2', copiedIdx === i && 'border-green-300 bg-green-50 text-green-700')}
                            >
                              {copiedIdx === i ? <Check className="w-2.5 h-2.5 mr-1" /> : <Copy className="w-2.5 h-2.5 mr-1" />}
                              {copiedIdx === i ? 'Copiado' : 'Copiar'}
                            </Button>
                          </>
                        )
                      })()}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-brand-gold/20 border border-brand-gold/30 flex items-center justify-center text-xs font-bold text-brand-gold">IA</div>
                <div className="bg-muted rounded-lg rounded-tl-sm border border-border px-4 py-3 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Analizando la consulta...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-3 border-t border-border bg-white">
          <div className="flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              placeholder="Escriba su consulta jurídica... (Enter para enviar)"
              className="flex-1 min-h-[60px] max-h-32 resize-none text-sm"
            />
            <Button onClick={sendMessage} disabled={loading || !input.trim()} className="h-10 px-4">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
            Las respuestas de DG&A IA son asistencia preliminar. Toda respuesta requiere revisión de un abogado DG&A antes de ser utilizada.
          </p>
        </div>
      </div>

      {/* Panel de Fuentes propias (escritorio) */}
      <div className="hidden lg:flex w-64 flex-col gap-3">
        <div className="bg-white rounded-lg border border-border flex-1 flex flex-col overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Library className="w-3.5 h-3.5 text-brand-gold" />
              Fuentes propias ({sources.length})
            </p>
            <button type="button" onClick={() => setSourceDialog(true)} title="Agregar fuente" className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <ScrollArea className="flex-1 p-3">
            {sources.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-xs text-muted-foreground">Aún no hay fuentes propias.</p>
                <button type="button" onClick={() => setSourceDialog(true)} className="text-xs text-brand-gold font-medium mt-2 hover:underline">
                  + Agregar la primera
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {sources.map(s => (
                  <div key={s.id} className="group text-xs p-2 bg-muted rounded-md border border-border flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-foreground font-medium leading-snug truncate">{s.title || 'Sin título'}</p>
                      <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{s.content}</p>
                    </div>
                    <button type="button" onClick={() => removeSource(s.id)} title="Eliminar fuente" className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-600 flex-shrink-0 transition-opacity">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <div className="px-3 py-2 border-t border-border">
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              La IA prioriza estas fuentes en sus respuestas, además del conocimiento jurídico en línea.
            </p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-[10px] text-amber-800 leading-relaxed">
            <strong>Aviso de uso:</strong> DG&A IA provee asistencia jurídica preliminar. Las respuestas no constituyen concepto legal vinculante. Consulte con el equipo DG&A para criterios definitivos.
          </p>
        </div>
      </div>

      {/* Diálogo de gestión de fuentes propias */}
      <Dialog open={sourceDialog} onOpenChange={v => { if (!v) setSourceDialog(false) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Library className="w-4 h-4 text-brand-gold" />Fuentes propias de la firma</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Agrega documentos, criterios, conceptos o lineamientos propios de DG&A. La IA los usará y citará al responder, además de su conocimiento general del derecho colombiano.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Título *</Label>
              <Input value={newSource.title} onChange={e => setNewSource(p => ({ ...p, title: e.target.value }))} className="text-sm" placeholder="Ej. Lineamiento interno — cláusulas de confidencialidad" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Contenido *</Label>
              <Textarea
                value={newSource.content}
                onChange={e => setNewSource(p => ({ ...p, content: e.target.value }))}
                className="text-sm min-h-[120px] max-h-60 resize-none"
                placeholder="Pega aquí el texto de la fuente: criterio de la firma, concepto, política, extracto de un documento, etc."
              />
            </div>
            <Button type="button" size="sm" className="w-full" onClick={agregarFuente} disabled={!newSource.title.trim() || !newSource.content.trim()}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />Agregar fuente
            </Button>

            {sources.length > 0 && (
              <div className="pt-2 border-t border-border">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Fuentes cargadas ({sources.length})</p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {sources.map(s => (
                    <div key={s.id} className="flex items-center justify-between gap-2 text-xs p-2 bg-muted rounded-md border border-border">
                      <span className="truncate font-medium text-foreground">{s.title || 'Sin título'}</span>
                      <button type="button" onClick={() => removeSource(s.id)} title="Eliminar" className="text-muted-foreground hover:text-red-600 flex-shrink-0">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
