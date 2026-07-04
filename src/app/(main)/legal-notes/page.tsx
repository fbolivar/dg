"use client"
import { useState, useEffect } from 'react'
import { Plus, BookOpen, CheckSquare, Send, Loader2, ChevronRight, AlertTriangle, Trash2, Edit2, X, Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AiDisclaimer } from '@/components/layout/ai-disclaimer'
import { useData } from '@/shared/context/data-context'
import * as db from '@/shared/services/db'
import type { LegalNote, NoteStatus } from '@/shared/types'
import { printNotaLegal } from './_lib/nota-legal-pdf'

type NoteSource = 'alert' | 'manual'
const EMPTY_NEW = {
  source: 'alert' as NoteSource,
  alert_id: '', man_title: '', man_text: '', man_reco: '', man_area: '',
  audience: '', tone: '', title: '', generated: false,
  content_draft: '', content_email: '', content_linkedin: '', content_summary: '',
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  borrador_ia: { label: 'Borrador IA', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  en_revisión: { label: 'En revisión', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  aprobado: { label: 'Aprobado', color: 'bg-green-100 text-green-800 border-green-200' },
  publicado: { label: 'Publicado', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  rechazado: { label: 'Rechazado', color: 'bg-red-100 text-red-800 border-red-200' },
}

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-foreground text-background text-sm px-4 py-3 rounded-xl shadow-card-lg">
      {msg}<button type="button" title="Cerrar" onClick={onClose}><X className="w-3.5 h-3.5" /></button>
    </div>
  )
}

export default function LegalNotesPage() {
  const { legalNotes: dbLegalNotes, alerts, practiceAreas } = useData()
  const [notes, setNotes] = useState<LegalNote[]>([])

  useEffect(() => { setNotes(dbLegalNotes.map(n => ({ ...n }))) }, [dbLegalNotes])
  const [selected, setSelected] = useState<LegalNote | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editDraft, setEditDraft] = useState({ content_draft: '', content_email: '', content_linkedin: '', content_summary: '', title: '' })
  const [reviewComment, setReviewComment] = useState('')
  const [creating, setCreating] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<LegalNote | null>(null)
  const [toast, setToast] = useState('')
  const [newNote, setNewNote] = useState(EMPTY_NEW)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  // Construye el payload para la IA según el modo (alerta registrada o texto propio).
  function buildPayload(): { alert_title: string; alert_summary: string; alert_recommendation: string; audience: string; tone: string; practice_area: string; titleBase: string } | null {
    if (!newNote.audience || !newNote.tone) return null
    if (newNote.source === 'manual') {
      if (!newNote.man_title.trim() || !newNote.man_text.trim()) return null
      return {
        alert_title: newNote.man_title.trim(),
        alert_summary: newNote.man_text.trim(),
        alert_recommendation: newNote.man_reco.trim(),
        audience: newNote.audience, tone: newNote.tone,
        practice_area: practiceAreas.find(p => p.id === newNote.man_area)?.name ?? '',
        titleBase: newNote.man_title.trim(),
      }
    }
    const alert = alerts.find(a => a.id === newNote.alert_id)
    if (!alert) return null
    return {
      alert_title: alert.title,
      alert_summary: alert.summary ?? '',
      alert_recommendation: alert.recommendation ?? '',
      audience: newNote.audience, tone: newNote.tone,
      practice_area: alert.practice_area?.name ?? '',
      titleBase: alert.title,
    }
  }

  async function generateDraft() {
    const payload = buildPayload()
    if (!payload) return
    setGenerating(true)
    try {
      const { titleBase, ...body } = payload
      const res = await fetch('/api/legal-notes/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { showToast(data.error || 'No se pudo generar el borrador'); return }
      setNewNote(prev => ({
        ...prev,
        generated: true,
        title: `Nota Legal: ${titleBase.slice(0, 60)}`,
        content_draft: data.content_draft ?? '',
        content_email: data.content_email ?? '',
        content_linkedin: data.content_linkedin ?? '',
        content_summary: data.content_summary ?? '',
      }))
    } catch {
      showToast('Error de conexión al generar el borrador')
    } finally {
      setGenerating(false)
    }
  }

  async function saveNote() {
    // Área de práctica: de la alerta o de la seleccionada en modo manual.
    const paId = newNote.source === 'manual'
      ? newNote.man_area
      : (alerts.find(a => a.id === newNote.alert_id)?.practice_area_id ?? '')
    // alert_id y practice_area_id vacíos se OMITEN (son claves foráneas; '' rompe el insert).
    const noteData = {
      title: newNote.title,
      audience: newNote.audience, tone: newNote.tone,
      content_draft: newNote.content_draft, content_email: newNote.content_email,
      content_linkedin: newNote.content_linkedin, content_summary: newNote.content_summary,
      status: 'en_revisión' as NoteStatus,
      author_id: '', // el servidor lo sobreescribe con el usuario en sesión
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      ...(newNote.alert_id ? { alert_id: newNote.alert_id } : {}),
      ...(paId ? { practice_area_id: paId } : {}),
    } as Omit<LegalNote, 'id' | 'practice_area' | 'author'>
    const created = await db.createLegalNote(noteData)
    if (!created) { showToast('No se pudo guardar la Nota Legal'); return }
    setNotes(prev => [created, ...prev])
    setCreating(false)
    setNewNote(EMPTY_NEW)
    showToast('Nota Legal enviada a revisión de socio')
  }

  function openEdit(note: LegalNote) {
    setEditDraft({ content_draft: note.content_draft ?? '', content_email: note.content_email ?? '', content_linkedin: note.content_linkedin ?? '', content_summary: note.content_summary ?? '', title: note.title })
    setEditMode(true)
  }

  async function saveEdit() {
    if (!selected) return
    await db.updateLegalNote(selected.id, { ...editDraft, updated_at: new Date().toISOString() })
    setNotes(prev => prev.map(n => n.id === selected.id ? { ...n, ...editDraft, updated_at: new Date().toISOString() } : n))
    setSelected(prev => prev ? { ...prev, ...editDraft } : null)
    setEditMode(false)
    showToast('Cambios guardados')
  }

  async function changeStatus(noteId: string, status: NoteStatus) {
    await db.updateLegalNote(noteId, { status, updated_at: new Date().toISOString() })
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, status, updated_at: new Date().toISOString() } : n))
    setSelected(prev => prev ? { ...prev, status } : null)
    const msgs: Record<NoteStatus, string> = { aprobado: 'Legal Note aprobada', publicado: 'Legal Note publicada', rechazado: 'Legal Note rechazada', en_revisión: 'Enviada a revisión', borrador_ia: 'Revertida a borrador' }
    showToast(msgs[status])
    setReviewComment('')
  }

  async function deleteNote(note: LegalNote) {
    await db.deleteLegalNote(note.id)
    setNotes(prev => prev.filter(n => n.id !== note.id))
    setConfirmDelete(null)
    if (selected?.id === note.id) setSelected(null)
    showToast('Legal Note eliminada')
  }

  function exportNote(note: LegalNote) {
    const content = `LEGAL NOTE — DG&A\n${'='.repeat(50)}\nTítulo: ${note.title}\nEstado: ${STATUS_LABELS[note.status].label}\nAudiencia: ${note.audience}\nTono: ${note.tone}\nFecha: ${new Date(note.created_at).toLocaleDateString('es-CO')}\n\n--- BORRADOR ---\n${note.content_draft ?? ''}\n\n--- EMAIL ---\n${note.content_email ?? ''}\n\n--- LINKEDIN ---\n${note.content_linkedin ?? ''}\n\n--- RESUMEN EJECUTIVO ---\n${note.content_summary ?? ''}\n`
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `legal-note-${note.id}.txt`; a.click()
    showToast('Nota exportada')
  }

  const counts = {
    total: notes.length,
    borrador: notes.filter(n => n.status === 'borrador_ia').length,
    revision: notes.filter(n => n.status === 'en_revisión').length,
    aprobado: notes.filter(n => n.status === 'aprobado' || n.status === 'publicado').length,
  }

  return (
    <div className="space-y-5 max-w-[1200px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-playfair">Legal Notes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Boletines jurídicos generados con asistencia de IA</p>
        </div>
        <Button type="button" onClick={() => setCreating(true)} size="sm">
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Nueva Legal Note
        </Button>
      </div>

      <AiDisclaimer
        message="Todos los borradores son generados con asistencia de IA. Requieren revisión y aprobación de abogado DG&A antes de su envío o publicación."
        variant="banner"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: counts.total },
          { label: 'Borrador IA', value: counts.borrador },
          { label: 'En revisión', value: counts.revision },
          { label: 'Aprobadas/Publicadas', value: counts.aprobado },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-xl font-bold text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[35%]">Título</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Audiencia</TableHead>
                <TableHead>Tono</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notes.map(note => {
                const status = STATUS_LABELS[note.status]
                return (
                  <TableRow key={note.id} className="cursor-pointer" onClick={() => { setSelected(note); setEditMode(false); setReviewComment('') }}>
                    <TableCell>
                      <p className="text-xs font-medium text-foreground leading-snug">{note.title}</p>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {practiceAreas.find(p => p.id === note.practice_area_id)?.code ?? '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground capitalize">{note.audience?.replace('_', ' ')}</TableCell>
                    <TableCell className="text-xs text-muted-foreground capitalize">{note.tone}</TableCell>
                    <TableCell>
                      <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full border ${status.color}`}>
                        {status.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(note.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button type="button" title="Editar" onClick={() => { setSelected(note); openEdit(note) }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" title="Eliminar" onClick={() => setConfirmDelete(note)} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" title="Exportar" onClick={() => exportNote(note)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail / Edit Dialog */}
      <Dialog open={!!selected} onOpenChange={open => { if (!open) { setSelected(null); setEditMode(false) } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                {editMode ? (
                  <Input value={editDraft.title} onChange={e => setEditDraft(p => ({ ...p, title: e.target.value }))} className="text-sm font-semibold" />
                ) : (
                  <DialogTitle className="text-base pr-6">{selected.title}</DialogTitle>
                )}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_LABELS[selected.status].color}`}>
                    {STATUS_LABELS[selected.status].label}
                  </span>
                  <Badge variant="outline" className="text-[10px]">{selected.audience?.replace('_', ' ')}</Badge>
                  <Badge variant="outline" className="text-[10px]">{selected.tone}</Badge>
                  <div className="ml-auto flex gap-1.5">
                    {!editMode && (
                      <button type="button" title="Editar" onClick={() => openEdit(selected)} className="p-1 rounded hover:bg-muted text-muted-foreground">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button type="button" title="Descargar Nota Legal (PDF con marca DG&A)" onClick={() => printNotaLegal(selected)} className="p-1 rounded hover:bg-muted text-brand-navy">
                      <BookOpen className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" title="Exportar texto (.txt)" onClick={() => exportNote(selected)} className="p-1 rounded hover:bg-muted text-muted-foreground">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" title="Eliminar" onClick={() => setConfirmDelete(selected)} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </DialogHeader>

              <Tabs defaultValue="draft" className="mt-2">
                <TabsList className="h-8">
                  <TabsTrigger value="draft" className="text-xs">Borrador</TabsTrigger>
                  <TabsTrigger value="email" className="text-xs">Email</TabsTrigger>
                  <TabsTrigger value="linkedin" className="text-xs">LinkedIn</TabsTrigger>
                  <TabsTrigger value="summary" className="text-xs">Resumen ejecutivo</TabsTrigger>
                </TabsList>
                {(['draft', 'email', 'linkedin', 'summary'] as const).map(tab => {
                  const field = tab === 'draft' ? 'content_draft' : tab === 'email' ? 'content_email' : tab === 'linkedin' ? 'content_linkedin' : 'content_summary'
                  const value = editMode ? (editDraft as Record<string, string>)[field] : ((selected as unknown as Record<string, unknown>)[field] as string) ?? 'Sin contenido.'
                  return (
                    <TabsContent key={tab} value={tab}>
                      <Textarea
                        value={value}
                        onChange={editMode ? e => setEditDraft(p => ({ ...p, [field]: e.target.value })) : undefined}
                        className="min-h-[180px] text-sm font-mono"
                        readOnly={!editMode}
                      />
                    </TabsContent>
                  )
                })}
              </Tabs>

              {editMode && (
                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button type="button" size="sm" onClick={saveEdit} className="flex-1">Guardar cambios</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditMode(false)}>Cancelar</Button>
                </div>
              )}

              {!editMode && selected.status === 'en_revisión' && (
                <div className="border-t border-border pt-3 space-y-2">
                  <Label className="text-xs">Comentarios del revisor</Label>
                  <Textarea
                    placeholder="Ingrese comentarios antes de aprobar o rechazar..."
                    className="text-sm min-h-[60px]"
                    value={reviewComment}
                    onChange={e => setReviewComment(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="default" className="flex-1" onClick={() => changeStatus(selected.id, 'aprobado')}>
                      <CheckSquare className="w-3.5 h-3.5 mr-1.5" />
                      Aprobar
                    </Button>
                    <Button type="button" size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => changeStatus(selected.id, 'publicado')}>
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      Aprobar y publicar
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="text-red-600 hover:text-red-600" onClick={() => changeStatus(selected.id, 'rechazado')}>
                      Rechazar
                    </Button>
                  </div>
                </div>
              )}

              {!editMode && selected.status === 'borrador_ia' && (
                <div className="border-t border-border pt-3">
                  <Button type="button" size="sm" className="w-full" onClick={() => changeStatus(selected.id, 'en_revisión')}>
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    Enviar a revisión de socio
                  </Button>
                </div>
              )}

              {!editMode && (selected.status === 'aprobado' || selected.status === 'publicado') && (
                <div className="border-t border-border pt-3 flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => { showToast('Email enviado al cliente'); setSelected(null) }}>
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    Enviar por email
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => { showToast('Publicado en LinkedIn'); changeStatus(selected.id, 'publicado') }}>
                    Publicar en LinkedIn
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => changeStatus(selected.id, 'en_revisión')}>Reabrir revisión</Button>
                </div>
              )}

              {!editMode && selected.status === 'rechazado' && (
                <div className="border-t border-border pt-3 flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => { openEdit(selected) }}>
                    <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                    Corregir y reenviar
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => changeStatus(selected.id, 'en_revisión')}>Reenviar sin cambios</Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={open => { if (!open) setConfirmDelete(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Eliminar Legal Note</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">¿Está seguro de que desea eliminar <strong className="text-foreground">{confirmDelete?.title}</strong>? Esta acción no se puede deshacer.</p>
          <div className="flex gap-2 mt-2">
            <Button type="button" size="sm" variant="destructive" className="flex-1" onClick={() => confirmDelete && deleteNote(confirmDelete)}>Eliminar</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={creating} onOpenChange={v => { if (!v) { setCreating(false); setNewNote(EMPTY_NEW) } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Legal Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {!newNote.generated ? (
              <>
                {/* Modo: desde alerta registrada o texto propio */}
                <div className="flex gap-2">
                  {([['alert', 'Desde alerta registrada'], ['manual', 'Escribir o pegar texto']] as const).map(([val, label]) => (
                    <button key={val} type="button" onClick={() => setNewNote(p => ({ ...p, source: val }))}
                      className={`flex-1 text-xs font-medium px-3 py-2 rounded-lg border transition ${newNote.source === val ? 'bg-brand-navy text-white border-brand-navy' : 'bg-background text-muted-foreground border-border hover:border-foreground'}`}>
                      {label}
                    </button>
                  ))}
                </div>

                {newNote.source === 'alert' ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Alerta origen</Label>
                    <Select value={newNote.alert_id} onValueChange={v => setNewNote(p => ({ ...p, alert_id: v }))}>
                      <SelectTrigger className="text-sm"><SelectValue placeholder={alerts.length ? 'Seleccionar alerta' : 'No hay alertas registradas'} /></SelectTrigger>
                      <SelectContent>
                        {alerts.map(a => <SelectItem key={a.id} value={a.id} className="text-xs">{a.title.slice(0, 60)}...</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {alerts.length === 0 && (
                      <p className="text-[11px] text-muted-foreground">No hay alertas cargadas. Usa <strong>«Escribir o pegar texto»</strong> para partir de tu propio contenido.</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Título del tema / norma *</Label>
                      <Input value={newNote.man_title} onChange={e => setNewNote(p => ({ ...p, man_title: e.target.value }))} className="text-sm" placeholder="Ej. Resolución 000610 de 2026 — Salas Amigas de la Familia Lactante" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Texto / contenido *</Label>
                      <Textarea value={newNote.man_text} onChange={e => setNewNote(p => ({ ...p, man_text: e.target.value }))} className="text-sm min-h-[150px]" placeholder="Pega aquí el texto de la resolución o la novedad normativa…" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Recomendación (opcional)</Label>
                        <Input value={newNote.man_reco} onChange={e => setNewNote(p => ({ ...p, man_reco: e.target.value }))} className="text-sm" placeholder="Acción sugerida al cliente" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Área de práctica (opcional)</Label>
                        <Select value={newNote.man_area} onValueChange={v => setNewNote(p => ({ ...p, man_area: v }))}>
                          <SelectTrigger className="text-sm"><SelectValue placeholder="Seleccionar área" /></SelectTrigger>
                          <SelectContent>
                            {practiceAreas.map(pa => <SelectItem key={pa.id} value={pa.id} className="text-xs">{pa.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Audiencia</Label>
                    <Select value={newNote.audience} onValueChange={v => setNewNote(p => ({ ...p, audience: v }))}>
                      <SelectTrigger className="text-sm"><SelectValue placeholder="Seleccionar audiencia" /></SelectTrigger>
                      <SelectContent>
                        {['general', 'junta_directiva', 'rrhh', 'área_legal', 'cumplimiento', 'gerencia_financiera'].map(a =>
                          <SelectItem key={a} value={a} className="text-xs capitalize">{a.replace(/_/g, ' ')}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tono</Label>
                    <Select value={newNote.tone} onValueChange={v => setNewNote(p => ({ ...p, tone: v }))}>
                      <SelectTrigger className="text-sm"><SelectValue placeholder="Seleccionar tono" /></SelectTrigger>
                      <SelectContent>
                        {['técnico', 'ejecutivo', 'preventivo', 'comercial'].map(t =>
                          <SelectItem key={t} value={t} className="text-xs capitalize">{t}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={generateDraft}
                  disabled={generating || !buildPayload()}
                  className="w-full"
                >
                  {generating ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generando borrador con asistencia de IA...</>
                  ) : (
                    <><BookOpen className="w-4 h-4 mr-2" />Generar borrador</>
                  )}
                </Button>
                <AiDisclaimer variant="banner" />
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Título</Label>
                  <Input value={newNote.title} onChange={e => setNewNote(p => ({ ...p, title: e.target.value }))} className="text-sm" />
                </div>
                <Tabs defaultValue="draft">
                  <TabsList className="h-8">
                    <TabsTrigger value="draft" className="text-xs">Borrador</TabsTrigger>
                    <TabsTrigger value="email" className="text-xs">Email</TabsTrigger>
                    <TabsTrigger value="linkedin" className="text-xs">LinkedIn</TabsTrigger>
                    <TabsTrigger value="summary" className="text-xs">Resumen</TabsTrigger>
                  </TabsList>
                  <TabsContent value="draft">
                    <Textarea value={newNote.content_draft} onChange={e => setNewNote(p => ({ ...p, content_draft: e.target.value }))} className="min-h-[160px] text-sm" />
                  </TabsContent>
                  <TabsContent value="email">
                    <Textarea value={newNote.content_email} onChange={e => setNewNote(p => ({ ...p, content_email: e.target.value }))} className="min-h-[120px] text-sm" placeholder="Versión para email..." />
                  </TabsContent>
                  <TabsContent value="linkedin">
                    <Textarea value={newNote.content_linkedin} onChange={e => setNewNote(p => ({ ...p, content_linkedin: e.target.value }))} className="min-h-[100px] text-sm" placeholder="Post para LinkedIn..." />
                  </TabsContent>
                  <TabsContent value="summary">
                    <Textarea value={newNote.content_summary} onChange={e => setNewNote(p => ({ ...p, content_summary: e.target.value }))} className="min-h-[100px] text-sm" placeholder="Resumen ejecutivo..." />
                  </TabsContent>
                </Tabs>
                <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  Borrador generado con asistencia de IA. Revise antes de enviar a aprobación.
                </div>
                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button type="button" size="sm" onClick={saveNote} disabled={!newNote.title} className="flex-1">
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    Enviar a revisión de socio
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => printNotaLegal({
                    id: 'preview', title: newNote.title, audience: newNote.audience, tone: newNote.tone,
                    content_draft: newNote.content_draft, content_email: newNote.content_email,
                    content_linkedin: newNote.content_linkedin, content_summary: newNote.content_summary,
                    practice_area_id: '', status: 'borrador_ia', author_id: '',
                    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
                  })}>
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    PDF
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setNewNote(p => ({ ...p, generated: false }))}>Volver</Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {toast && <Toast msg={toast} onClose={() => setToast('')} />}
    </div>
  )
}
