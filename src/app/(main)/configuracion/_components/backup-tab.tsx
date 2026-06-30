"use client"
import { useState } from 'react'
import { Clock, Download, HardDrive, Loader2, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useData } from '@/shared/context/data-context'
import { Toast, useToast } from './toast'

type Backup = { fecha: string; tipo: string; registros: number; tamano: string; estado: string }

export function BackupTab() {
  const {
    clients, users, practiceAreas, alerts, legalNotes, documents,
    contractReviews, matters, matterEvents, dueDiligenceProjects,
    dueDiligenceFindings, complianceDiagnostics, hrTickets,
  } = useData()
  const { toast, showToast, clearToast } = useToast()

  const [backups, setBackups] = useState<Backup[]>([])
  const [generating, setGenerating] = useState(false)

  async function generateBackup() {
    if (generating) return
    setGenerating(true)
    await new Promise(r => setTimeout(r, 700)) // feedback visual

    const payload = {
      meta: {
        plataforma: 'DG&A Legal Intelligence Desk',
        generado: new Date().toISOString(),
        version: '1.0',
      },
      datos: {
        clientes: clients,
        usuarios: users,
        areas_practica: practiceAreas,
        alertas: alerts,
        legal_notes: legalNotes,
        documentos: documents,
        revisiones_contratos: contractReviews,
        asuntos: matters,
        eventos_asuntos: matterEvents,
        due_diligence: dueDiligenceProjects,
        hallazgos_due_diligence: dueDiligenceFindings,
        compliance: complianceDiagnostics,
        tickets_rrhh: hrTickets,
      },
    }

    const total = [
      clients, users, practiceAreas, alerts, legalNotes, documents, contractReviews,
      matters, matterEvents, dueDiligenceProjects, dueDiligenceFindings,
      complianceDiagnostics, hrTickets,
    ].reduce((sum, arr) => sum + arr.length, 0)

    const json = JSON.stringify(payload, null, 2)
    const sizeKB = Math.max(1, Math.round(json.length / 1024))

    // Descargar el archivo de respaldo
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `respaldo-dga-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)

    const fecha = new Date().toLocaleString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
    setBackups(prev => [{ fecha, tipo: 'Manual', registros: total, tamano: `${sizeKB} KB`, estado: 'Completado' }, ...prev])
    setGenerating(false)
    showToast('Respaldo generado y descargado correctamente')
  }

  return (
    <div className="space-y-4">
      {/* Acción principal de respaldo */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><HardDrive className="w-4 h-4" />Respaldo de la información</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1 max-w-xl">
              <p className="text-sm font-medium">Copia de seguridad completa</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Genera y descarga una copia de toda la información de la plataforma —clientes, asuntos, alertas, Legal Notes, contratos, due diligence y compliance— en un archivo JSON cifrable. Úsala para respaldo manual o migración.
              </p>
            </div>
            <Button type="button" onClick={generateBackup} disabled={generating} className="flex-shrink-0">
              {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              {generating ? 'Generando…' : 'Generar respaldo ahora'}
            </Button>
          </div>
          {/* Configuración de respaldo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Frecuencia automática</p>
              <p className="text-sm font-medium mt-0.5">Diaria · 03:00</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Retención</p>
              <p className="text-sm font-medium mt-0.5">30 días</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Destino</p>
              <p className="text-sm font-medium mt-0.5">Almacenamiento cifrado</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Historial de respaldos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4" />Historial de respaldos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha y hora</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Registros</TableHead>
                <TableHead>Tamaño</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {backups.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">
                    No hay respaldos en esta sesión. Genera uno con el botón de arriba.
                  </TableCell>
                </TableRow>
              )}
              {backups.map((b, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs font-medium">{b.fecha}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{b.tipo}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{b.registros}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{b.tamano}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-200">
                      <CheckCircle2 className="w-2.5 h-2.5" />{b.estado}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {toast && <Toast msg={toast} onClose={clearToast} />}
    </div>
  )
}
