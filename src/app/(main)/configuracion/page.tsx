"use client"
import { useState, useEffect } from 'react'
import { Database, Shield, FileText, Clock, X, ToggleLeft, ToggleRight, Edit2, Save } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { getAuditLog } from '@/shared/services/db'
import type { AuditLogEntry } from '@/shared/types'
import { useToast, Toast } from './_components/toast'
import { UsersTab } from './_components/users-tab'
import { BackupTab } from './_components/backup-tab'

const fmtAuditDate = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

type Source = { name: string; type: string; active: boolean }
const INITIAL_SOURCES: Source[] = [
  { name: 'Min. Trabajo — Normativa laboral', type: 'Normativa oficial', active: true },
  { name: 'Supersociedades — Circulares y resoluciones', type: 'Normativa oficial', active: true },
  { name: 'SIC — Conceptos y actos administrativos', type: 'Normativa oficial', active: true },
  { name: 'UGPP — Conceptos y resoluciones', type: 'Normativa oficial', active: true },
  { name: 'Corte Constitucional — Jurisprudencia', type: 'Jurisprudencia', active: true },
  { name: 'Corte Suprema — Sala Laboral', type: 'Jurisprudencia', active: true },
  { name: 'Colombia Compra Eficiente', type: 'Contratación pública', active: false },
]

type Pref = { title: string; icon: React.ElementType; desc: string; value: string; key: string }
const INITIAL_PREFS: Pref[] = [
  { title: 'Aprobaciones', icon: FileText, key: 'approvals', desc: 'Legal Notes y documentos IA requieren aprobación de socio antes de envío', value: 'Habilitado' },
  { title: 'Retención de datos', icon: Database, key: 'retention', desc: 'Período de retención de sesiones del copiloto', value: '12 meses' },
  { title: 'Aviso de confidencialidad', icon: Shield, key: 'confidentiality', desc: 'Mostrar aviso de confidencialidad en todas las pantallas', value: 'Visible' },
  { title: 'Bitácora de auditoría', icon: Clock, key: 'audit', desc: 'Registro automático de todas las acciones en la plataforma', value: 'Activa' },
]

export default function ConfiguracionPage() {
  const { toast, showToast, clearToast } = useToast()
  const [sources, setSources] = useState<Source[]>(INITIAL_SOURCES)
  const [prefs, setPrefs] = useState<Pref[]>(INITIAL_PREFS)
  const [editingPref, setEditingPref] = useState<string | null>(null)
  const [prefEditVal, setPrefEditVal] = useState('')
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([])

  useEffect(() => {
    getAuditLog().then(setAuditLog).catch(() => { /* noop */ })
  }, [])

  function toggleSource(idx: number) {
    setSources(prev => prev.map((s, i) => i === idx ? { ...s, active: !s.active } : s))
    showToast('Fuente actualizada')
  }

  function startEditPref(pref: Pref) {
    setEditingPref(pref.key)
    setPrefEditVal(pref.value)
  }

  function savePref(key: string) {
    setPrefs(prev => prev.map(p => p.key === key ? { ...p, value: prefEditVal } : p))
    setEditingPref(null)
    showToast('Preferencia guardada')
  }

  return (
    <div className="space-y-5 max-w-[1100px]">
      <div>
        <h1 className="text-2xl font-bold font-playfair">Configuración</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Gestión de roles, fuentes, respaldo y auditoría del sistema</p>
      </div>

      <Tabs defaultValue="usuarios">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="usuarios" className="text-xs">Usuarios y roles</TabsTrigger>
          <TabsTrigger value="auditoria" className="text-xs">Bitácora de auditoría</TabsTrigger>
          <TabsTrigger value="fuentes" className="text-xs">Fuentes documentales</TabsTrigger>
          <TabsTrigger value="respaldo" className="text-xs">Respaldo</TabsTrigger>
          <TabsTrigger value="preferencias" className="text-xs">Preferencias</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="mt-4">
          <UsersTab />
        </TabsContent>

        <TabsContent value="auditoria" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Shield className="w-4 h-4" />Bitácora de auditoría ({auditLog.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {auditLog.length === 0 ? (
                <div className="py-12 text-center">
                  <Shield className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Sin actividad registrada todavía</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Las acciones (gestión de usuarios, aprobación de Legal Notes, etc.) quedarán registradas aquí.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Acción</TableHead>
                      <TableHead>Entidad</TableHead>
                      <TableHead>Detalle</TableHead>
                      <TableHead>Fecha y hora</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLog.map(entry => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-xs font-medium">{entry.actor_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{entry.action}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[220px]">
                          <span className="truncate block">{entry.entity ?? '—'}</span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{entry.detail ?? '—'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {fmtAuditDate(entry.created_at)}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fuentes" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Database className="w-4 h-4" />Fuentes documentales configuradas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {sources.map((src, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 bg-muted/40 rounded-md border border-border">
                  <div>
                    <p className="text-xs font-medium">{src.name}</p>
                    <p className="text-[10px] text-muted-foreground">{src.type}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${src.active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                      {src.active ? 'Activa' : 'Inactiva'}
                    </span>
                    <button type="button" title={src.active ? 'Desactivar fuente' : 'Activar fuente'} onClick={() => toggleSource(i)} className="text-muted-foreground hover:text-foreground transition-colors">
                      {src.active
                        ? <ToggleRight className="w-5 h-5 text-green-600" />
                        : <ToggleLeft className="w-5 h-5" />
                      }
                    </button>
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground pt-1">
                {sources.filter(s => s.active).length} de {sources.length} fuentes activas
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="respaldo" className="mt-4">
          <BackupTab />
        </TabsContent>

        <TabsContent value="preferencias" className="mt-4">
          <div className="grid grid-cols-2 gap-4">
            {prefs.map(pref => {
              const Icon = pref.icon
              return (
                <Card key={pref.key}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-md bg-brand-navy/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-brand-navy" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{pref.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{pref.desc}</p>
                        {editingPref === pref.key ? (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <Input value={prefEditVal} onChange={e => setPrefEditVal(e.target.value)} className="h-6 text-xs flex-1" />
                            <button type="button" title="Guardar" onClick={() => savePref(pref.key)} className="p-1 rounded bg-brand-navy text-white hover:bg-brand-navy/90">
                              <Save className="w-3 h-3" />
                            </button>
                            <button type="button" title="Cancelar" onClick={() => setEditingPref(null)} className="p-1 rounded hover:bg-muted text-muted-foreground">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 mt-1.5">
                            <Badge variant="outline" className="text-[10px]">{pref.value}</Badge>
                            <button type="button" title="Editar" onClick={() => startEditPref(pref)} className="p-0.5 rounded hover:bg-muted text-muted-foreground">
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>

      {toast && <Toast msg={toast} onClose={clearToast} />}
    </div>
  )
}
