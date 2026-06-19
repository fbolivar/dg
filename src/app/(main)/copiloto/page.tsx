"use client"
import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, BookOpen, FileText, MessageSquare, AlertTriangle, Star, Copy, CheckSquare, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import * as db from '@/shared/services/db'
import { useData } from '@/shared/context/data-context'
import type { CopilotMessage } from '@/shared/types'

type NoteState = { draftId?: string; status?: 'borrador_ia' | 'en_revisión'; saving?: boolean }

const SUGGESTED_QUESTIONS = [
  '¿Cuáles son las causales de terminación con justa causa bajo el CST?',
  '¿Qué obligaciones genera el SAGRILAFT para una empresa comercial con activos superiores a 30.000 SMMLV?',
  '¿Cuándo aplica la cláusula compromisoria en contratos estatales colombianos?',
  '¿Qué requisitos exige la SIC para el aviso de privacidad en plataformas digitales?',
  '¿Qué es el fuero sindical circunstancial según la jurisprudencia reciente?',
  '¿Cuáles son los deberes del empleador en casos de incapacidad médica prolongada?',
]

const MOCK_SOURCES = [
  'Código Sustantivo del Trabajo — Arts. 62, 64, 71',
  'Circular Min. Trabajo 0042/2026',
  'Sentencia C-218/26 — Corte Constitucional',
  'Ley 1581 de 2012 — Habeas Data',
  'Decreto 1234/2016 — SAGRILAFT',
]

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

export default function CopilotoPage() {
  const { refresh } = useData()
  const [messages, setMessages] = useState<CopilotMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeSources, setActiveSources] = useState<string[]>([])
  const [noteState, setNoteState] = useState<Record<number, NoteState>>({})
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
        body: JSON.stringify({ messages: apiMessages }),
      })
      const data = await res.json()
      const sources = MOCK_SOURCES.slice(0, 2 + Math.floor(Math.random() * 3))
      setActiveSources(sources)
      const assistantMsg: CopilotMessage = {
        role: 'assistant',
        content: res.ok ? data.content : 'Lo siento, hubo un error al procesar su consulta. Por favor intente de nuevo.',
        sources,
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
        <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-brand-navy/3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-brand-navy flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Copiloto DG&A</p>
              <p className="text-[10px] text-muted-foreground">Asistencia legal preliminar — powered by Claude</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
            <AlertTriangle className="w-3 h-3" />
            Toda respuesta requiere revisión de abogado
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {messages.length === 0 && (
              <div className="py-8">
                <p className="text-sm text-muted-foreground text-center mb-6">
                  Consulte al Copiloto DG&A sobre temas de derecho colombiano.<br />
                  <span className="text-xs">Respuestas basadas en legislación, jurisprudencia y doctrina nacional.</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl mx-auto">
                  {SUGGESTED_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(q)}
                      className="text-left text-xs text-foreground bg-muted hover:bg-muted/80 border border-border rounded-md px-3 py-2.5 transition-colors leading-snug"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-3", msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold",
                  msg.role === 'user' ? 'bg-brand-navy text-white' : 'bg-brand-gold/20 text-brand-gold border border-brand-gold/30'
                )}>
                  {msg.role === 'user' ? 'U' : 'DG'}
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
                <div className="w-7 h-7 rounded-full bg-brand-gold/20 border border-brand-gold/30 flex items-center justify-center text-xs font-bold text-brand-gold">DG</div>
                <div className="bg-muted rounded-lg rounded-tl-sm border border-border px-4 py-3 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Consultando fuentes legales...</span>
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
              placeholder="Consulte un tema legal colombiano... (Enter para enviar)"
              className="flex-1 min-h-[60px] max-h-32 resize-none text-sm"
            />
            <Button onClick={sendMessage} disabled={loading || !input.trim()} className="h-10 px-4">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
            Las respuestas del copiloto son asistencia preliminar. Toda respuesta requiere revisión de un abogado DG&A antes de ser utilizada.
          </p>
        </div>
      </div>

      {/* Sources Panel */}
      <div className="hidden lg:flex w-60 flex-col gap-3">
        <div className="bg-white rounded-lg border border-border flex-1 flex flex-col overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-brand-gold" />
              Fuentes consultadas
            </p>
          </div>
          <ScrollArea className="flex-1 p-3">
            {activeSources.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Las fuentes aparecerán cuando realice una consulta</p>
            ) : (
              <div className="space-y-2">
                {activeSources.map((src, i) => (
                  <div key={i} className="text-xs p-2 bg-muted rounded-md border border-border">
                    <p className="text-foreground font-medium leading-snug">{src}</p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-[10px] text-amber-800 leading-relaxed">
            <strong>Aviso de uso:</strong> Este copiloto provee asistencia jurídica preliminar. Las respuestas no constituyen concepto legal vinculante. Consulte con el equipo DG&A para criterios definitivos.
          </p>
        </div>
      </div>
    </div>
  )
}
