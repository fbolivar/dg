"use client"
import { useState, useRef, useEffect } from 'react'
import { FileText, Eye, AlertTriangle, CheckSquare, Download, Plus, Pencil, Trash2, AlertCircle, X, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { SeverityBadge } from '@/components/shared/severity-badge'
import { AiDisclaimer } from '@/components/layout/ai-disclaimer'
import { useData } from '@/shared/context/data-context'
import * as db from '@/shared/services/db'
import type { Document, ContractReview, DocumentStatus } from '@/shared/types'

const DOC_STATUS: Record<string, { label: string; class: string }> = {
  pendiente: { label: 'Pendiente', class: 'bg-gray-100 text-gray-700 border-gray-200' },
  en_revisión: { label: 'En revisión', class: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  revisado: { label: 'Revisado', class: 'bg-blue-100 text-blue-800 border-blue-200' },
  aprobado: { label: 'Aprobado', class: 'bg-green-100 text-green-800 border-green-200' },
  archivado: { label: 'Archivado', class: 'bg-gray-100 text-gray-500 border-gray-200' },
}
const DOC_TYPES: Record<string, string> = {
  contrato_comercial: 'Contrato comercial', contrato_laboral: 'Contrato laboral', nda: 'NDA',
  distribucion: 'Distribución', franquicia: 'Franquicia', servicios: 'Servicios',
  societario: 'Societario', mna: 'M&A', otro: 'Otro',
}
const SEVERITY_PCT: Record<string, number> = { crítico: 100, alto: 75, medio: 50, bajo: 25 }

const MOCK_ANALYSIS: Omit<ContractReview, 'id' | 'document_id' | 'document' | 'created_at'> = {
  parties: 'Parte A (contratante) y Parte B (contratista)',
  object: 'Prestación de servicios profesionales especializados en asesoría legal y consultoría corporativa.',
  obligations: 'Parte A: pagar honorarios acordados en los plazos establecidos. Parte B: prestar los servicios con diligencia profesional y confidencialidad.',
  deadlines: 'Vigencia de 12 meses desde la firma. Renovación automática por períodos iguales salvo comunicación de terminación con 30 días de anticipación.',
  critical_dates: 'Fecha de inicio: a determinar. Pago mensual: día 5 de cada mes. Plazo para reportes: último día hábil del mes.',
  risks: [
    { clausula: 'Cláusula 4 — Exclusividad', riesgo: 'La cláusula de exclusividad no tiene delimitación geográfica ni temporal clara, lo que podría interpretarse de forma amplia en perjuicio del contratista.', severidad: 'alto', recomendacion: 'Delimitar expresamente el alcance territorial y temporal de la exclusividad. Considerar compensación económica.', responsable: 'DG&A', estado: 'pendiente' },
    { clausula: 'Cláusula 7 — Penalidades', riesgo: 'Las penalidades por incumplimiento son desproporcionadas y podrían considerarse una cláusula penal excesiva bajo el art. 1601 C.C.', severidad: 'crítico', recomendacion: 'Reducir las penalidades o incluir un tope máximo equivalente al valor del contrato. Revisar proporcionalidad.', responsable: 'Cliente', estado: 'pendiente' },
    { clausula: 'Cláusula 12 — Propiedad intelectual', riesgo: 'La cesión de derechos patrimoniales incluye obras futuras sin especificar tipos ni condiciones, lo cual es amplio y potencialmente problemático.', severidad: 'medio', recomendacion: 'Especificar las obras objeto de la cesión. Limitar el alcance temporal y territorial de la misma.', responsable: 'DG&A', estado: 'en_revisión' },
  ],
  omissions: '1. No se incluye cláusula de solución de controversias (arbitraje o conciliación).\n2. Ausencia de cláusula de protección de datos personales (Ley 1581/2012).\n3. No se define el procedimiento para cambios en el alcance del servicio.\n4. Falta regulación sobre subcontratación.',
  recommendations: 'Se recomienda incluir una cláusula compromisoria, actualizar la cláusula de propiedad intelectual, limitar las penalidades y agregar una cláusula de habeas data conforme a la ley colombiana.',
  client_questions: '¿Se contempla la posibilidad de subcontratar parte de las actividades? ¿Existen proveedores preferidos o excluidos? ¿Cuál es el procedimiento interno para autorizar variaciones al contrato?',
  status: 'borrador_ia',
}

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-foreground text-background text-sm px-4 py-3 rounded-xl shadow-card-lg">
      {msg}<button type="button" title="Cerrar" onClick={onClose}><X className="w-3.5 h-3.5" /></button>
    </div>
  )
}

export default function ContratosPage() {
  const { documents: dbDocuments, contractReviews: dbContractReviews, clients } = useData()
  const [docs, setDocs] = useState<Document[]>([])
  const [reviews, setReviews] = useState<ContractReview[]>([])

  useEffect(() => { if (dbDocuments.length > 0) setDocs(dbDocuments.map(d => ({ ...d }))) }, [dbDocuments])
  useEffect(() => { if (dbContractReviews.length > 0) setReviews(dbContractReviews.map(r => ({ ...r }))) }, [dbContractReviews])
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [uploadForm, setUploadForm] = useState({ name: '', type: 'contrato_comercial', client_id: '', practice_area_id: 'pa3' })
  const [toast, setToast] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const selectedReview = reviews.find(r => r.document_id === selectedDoc?.id)

  const stats = {
    total: docs.length,
    pendiente: docs.filter(d => d.status === 'pendiente').length,
    revision: docs.filter(d => d.status === 'en_revisión').length,
    aprobado: docs.filter(d => d.status === 'aprobado').length,
  }

  const uploadDoc = async () => {
    if (!uploadForm.name.trim() || !uploadForm.client_id) return
    const client = clients.find(c => c.id === uploadForm.client_id)
    const docDbData = {
      name: uploadForm.name, type: uploadForm.type,
      client_id: uploadForm.client_id, practice_area_id: uploadForm.practice_area_id,
      status: 'pendiente' as DocumentStatus, uploaded_by: 'u1', created_at: new Date().toISOString(),
    }
    const created = await db.createDocument(docDbData)
    if (created) setDocs(prev => [{ ...created, client }, ...prev])
    setUploadForm({ name: '', type: 'contrato_comercial', client_id: '', practice_area_id: 'pa3' })
    setShowUpload(false)
    showToast('Documento registrado. Listo para análisis IA.')
  }

  const analyzeWithAI = async (docId: string) => {
    setAnalyzing(true)
    await new Promise(r => setTimeout(r, 1800))
    await db.updateDocument(docId, { status: 'en_revisión' })
    setDocs(prev => prev.map(d => d.id === docId ? { ...d, status: 'en_revisión' } : d))
    setSelectedDoc(prev => prev?.id === docId ? { ...prev, status: 'en_revisión' } : prev)
    const docForReview = docs.find(d => d.id === docId)
    const reviewDbData = {
      document_id: docId,
      ...MOCK_ANALYSIS, created_at: new Date().toISOString(),
    }
    const created = await db.createContractReview(reviewDbData)
    if (created) setReviews(prev => [...prev, { ...created, document: docForReview }])
    setAnalyzing(false)
    showToast('Análisis IA completado — requiere revisión de abogado')
  }

  const changeDocStatus = async (docId: string, status: DocumentStatus) => {
    await db.updateDocument(docId, { status })
    setDocs(prev => prev.map(d => d.id === docId ? { ...d, status } : d))
    setSelectedDoc(prev => prev?.id === docId ? { ...prev, status } : prev)
    if (status === 'aprobado') {
      const review = reviews.find(r => r.document_id === docId)
      if (review) await db.updateContractReview(review.id, { status: 'aprobado' })
      setReviews(prev => prev.map(r => r.document_id === docId ? { ...r, status: 'aprobado' } : r))
    }
    showToast(`Estado cambiado a "${DOC_STATUS[status].label}"`)
  }

  const deleteDoc = async () => {
    if (!deleteTarget) return
    await db.deleteDocument(deleteTarget.id)
    setDocs(prev => prev.filter(d => d.id !== deleteTarget.id))
    setReviews(prev => prev.filter(r => r.document_id !== deleteTarget.id))
    if (selectedDoc?.id === deleteTarget.id) setSelectedDoc(null)
    showToast('Documento eliminado')
    setDeleteTarget(null)
  }

  const exportReport = () => {
    if (!selectedDoc || !selectedReview) return
    const lines = [
      `INFORME DE REVISIÓN — ${selectedDoc.name}`,
      `Fecha: ${new Date().toLocaleDateString('es-CO')}`,
      `Estado: ${DOC_STATUS[selectedDoc.status].label}`,
      '', 'PARTES:', selectedReview.parties,
      '', 'OBJETO:', selectedReview.object,
      '', 'OBLIGACIONES:', selectedReview.obligations,
      '', 'PLAZOS:', selectedReview.deadlines,
      '', 'RIESGOS IDENTIFICADOS:',
      ...selectedReview.risks.map(r => `- ${r.clausula}: ${r.riesgo} [${r.severidad.toUpperCase()}]`),
      '', 'OMISIONES:', selectedReview.omissions,
      '', 'RECOMENDACIONES:', selectedReview.recommendations,
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `informe-${selectedDoc.name}.txt`; a.click()
    showToast('Informe exportado')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-playfair">Contratos y documentos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Revisión y análisis de contratos con asistencia de IA</p>
        </div>
        <Button size="sm" onClick={() => setShowUpload(true)}><Plus className="w-3.5 h-3.5 mr-1.5" />Subir documento</Button>
      </div>

      <AiDisclaimer message="Los análisis son generados con IA y requieren revisión de abogado DG&A antes de ser utilizados." variant="banner" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total documentos', value: stats.total, color: 'text-foreground', sub: 'Registrados' },
          { label: 'Pendientes', value: stats.pendiente, color: 'text-gray-600', sub: 'Sin análisis' },
          { label: 'En revisión', value: stats.revision, color: 'text-yellow-600', sub: 'Análisis IA listo' },
          { label: 'Aprobados', value: stats.aprobado, color: 'text-green-600', sub: 'Revisados por abogado' },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-5">
            <p className={`text-3xl font-bold tracking-tight ${s.color}`}>{s.value}</p>
            <p className="text-xs font-medium text-foreground mt-1">{s.label}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{s.sub}</p>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Documento</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Revisión IA</TableHead>
                <TableHead className="w-20">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map(doc => {
                const sc = DOC_STATUS[doc.status]
                const hasReview = reviews.some(r => r.document_id === doc.id)
                return (
                  <TableRow key={doc.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setSelectedDoc(doc)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <p className="text-xs font-medium text-foreground leading-snug">{doc.name}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{DOC_TYPES[doc.type] ?? doc.type}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{doc.client?.name.split(' ').slice(0, 2).join(' ')}</TableCell>
                    <TableCell><span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sc.class}`}>{sc.label}</span></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(doc.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</TableCell>
                    <TableCell>
                      {hasReview
                        ? <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Borrador IA</span>
                        : <span className="text-[10px] text-muted-foreground">Sin análisis</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button type="button" title="Ver detalle" onClick={() => setSelectedDoc(doc)} className="p-1 rounded hover:bg-muted"><Eye className="w-3.5 h-3.5 text-muted-foreground" /></button>
                        <button type="button" title="Eliminar" onClick={() => setDeleteTarget(doc)} className="p-1 rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Document Detail */}
      <Dialog open={!!selectedDoc} onOpenChange={() => setSelectedDoc(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedDoc && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between pr-6">
                  <DialogTitle className="text-base pr-4">{selectedDoc.name}</DialogTitle>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-red-600 flex-shrink-0" onClick={() => { setSelectedDoc(null); setDeleteTarget(selectedDoc) }}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${DOC_STATUS[selectedDoc.status].class}`}>{DOC_STATUS[selectedDoc.status].label}</span>
                  <Badge variant="outline" className="text-[10px]">{DOC_TYPES[selectedDoc.type]}</Badge>
                  <span className="text-xs text-muted-foreground">{selectedDoc.client?.name}</span>
                </div>
              </DialogHeader>

              {/* Status change bar */}
              <div className="flex items-center gap-2 p-2.5 bg-muted/40 rounded-md flex-wrap">
                <span className="text-xs font-medium">Estado:</span>
                {Object.entries(DOC_STATUS).map(([k, v]) => (
                  <button type="button" key={k} onClick={() => changeDocStatus(selectedDoc.id, k as DocumentStatus)}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all ${selectedDoc.status === k ? v.class : 'border-border text-muted-foreground hover:border-foreground'}`}>
                    {v.label}
                  </button>
                ))}
              </div>

              {!selectedReview ? (
                <div className="py-6 text-center space-y-3">
                  <FileText className="w-10 h-10 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">No hay análisis de IA para este documento aún.</p>
                  <Button size="sm" onClick={() => analyzeWithAI(selectedDoc.id)} disabled={analyzing}>
                    {analyzing ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Analizando...</> : <><Eye className="w-3.5 h-3.5 mr-1.5" />Iniciar análisis con IA</>}
                  </Button>
                </div>
              ) : (
                <>
                  <Tabs defaultValue="summary" className="mt-2">
                    <TabsList className="h-8">
                      <TabsTrigger value="summary" className="text-xs">Resumen</TabsTrigger>
                      <TabsTrigger value="risks" className="text-xs">Riesgos ({selectedReview.risks.length})</TabsTrigger>
                      <TabsTrigger value="omissions" className="text-xs">Omisiones</TabsTrigger>
                    </TabsList>
                    <TabsContent value="summary" className="space-y-3 mt-3">
                      <AiDisclaimer variant="banner" />
                      {[
                        { label: 'Partes', value: selectedReview.parties },
                        { label: 'Objeto', value: selectedReview.object },
                        { label: 'Obligaciones principales', value: selectedReview.obligations },
                        { label: 'Plazos', value: selectedReview.deadlines },
                        { label: 'Fechas críticas', value: selectedReview.critical_dates },
                      ].map(item => (
                        <div key={item.label} className="space-y-1">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{item.label}</p>
                          <p className="text-sm text-foreground leading-relaxed bg-muted/40 rounded-md p-2.5">{item.value}</p>
                        </div>
                      ))}
                    </TabsContent>
                    <TabsContent value="risks" className="mt-3">
                      <AiDisclaimer variant="banner" className="mb-3" />
                      <div className="overflow-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="border-b-2 border-border">
                              <th className="text-left p-2 text-muted-foreground font-semibold">Cláusula</th>
                              <th className="text-left p-2 text-muted-foreground font-semibold">Riesgo</th>
                              <th className="text-left p-2 text-muted-foreground font-semibold">Severidad</th>
                              <th className="text-left p-2 text-muted-foreground font-semibold">Recomendación</th>
                              <th className="text-left p-2 text-muted-foreground font-semibold">Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedReview.risks.map((risk, i) => (
                              <tr key={i} className="border-b border-border hover:bg-muted/30">
                                <td className="p-2 font-medium">{risk.clausula}</td>
                                <td className="p-2 text-muted-foreground leading-snug max-w-[200px]">{risk.riesgo}</td>
                                <td className="p-2">
                                  <div className="space-y-1">
                                    <SeverityBadge level={risk.severidad} />
                                    <Progress value={SEVERITY_PCT[risk.severidad]} className="h-1 w-16" />
                                  </div>
                                </td>
                                <td className="p-2 text-muted-foreground leading-snug max-w-[200px]">{risk.recomendacion}</td>
                                <td className="p-2"><Badge variant="outline" className="text-[10px]">{risk.estado}</Badge></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-3 space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Preguntas sugeridas al cliente</p>
                        <p className="text-sm text-foreground bg-muted/40 rounded-md p-2.5 leading-relaxed">{selectedReview.client_questions}</p>
                      </div>
                    </TabsContent>
                    <TabsContent value="omissions" className="mt-3 space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Omisiones detectadas</p>
                        <p className="text-sm text-foreground bg-muted/40 rounded-md p-2.5 leading-relaxed whitespace-pre-line">{selectedReview.omissions}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Recomendaciones generales</p>
                        <p className="text-sm text-foreground bg-muted/40 rounded-md p-2.5 leading-relaxed">{selectedReview.recommendations}</p>
                      </div>
                    </TabsContent>
                  </Tabs>
                  <div className="flex items-center gap-2 pt-3 border-t border-border flex-wrap">
                    {selectedDoc.status !== 'aprobado' ? (
                      <Button size="sm" onClick={() => changeDocStatus(selectedDoc.id, 'aprobado')}>
                        <CheckSquare className="w-3.5 h-3.5 mr-1.5" />Aprobar análisis
                      </Button>
                    ) : (
                      <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-md font-medium">✓ Análisis aprobado</span>
                    )}
                    <Button size="sm" variant="outline" onClick={exportReport}>
                      <Download className="w-3.5 h-3.5 mr-1.5" />Exportar informe
                    </Button>
                    {selectedDoc.status !== 'aprobado' && (
                      <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md ml-auto flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />Borrador IA — pendiente aprobación
                      </span>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar documento</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Nombre del documento *</Label>
              <Input value={uploadForm.name} onChange={e => setUploadForm(p => ({ ...p, name: e.target.value }))} placeholder="Contrato de servicios..." className="h-8 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tipo de documento</Label>
                <Select value={uploadForm.type} onValueChange={v => setUploadForm(p => ({ ...p, type: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(DOC_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cliente *</Label>
                <Select value={uploadForm.client_id} onValueChange={v => setUploadForm(p => ({ ...p, client_id: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name.split(' ').slice(0, 2).join(' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {/* File input (cosmetic for demo) */}
            <div className="space-y-1">
              <Label className="text-xs">Archivo (opcional en demo)</Label>
              <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" title="Seleccionar archivo" />
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="w-full h-16 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-brand-navy transition-colors text-xs">
                <FileText className="w-4 h-4" />
                Seleccionar archivo PDF o Word
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowUpload(false)}>Cancelar</Button>
            <Button size="sm" onClick={uploadDoc} disabled={!uploadForm.name.trim() || !uploadForm.client_id}>Registrar documento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-600"><AlertCircle className="w-4 h-4" />Eliminar documento</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">¿Confirma eliminar <strong>{deleteTarget?.name}</strong> y su análisis asociado?</p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button size="sm" variant="destructive" onClick={deleteDoc}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {toast && <Toast msg={toast} onClose={() => setToast('')} />}
    </div>
  )
}
