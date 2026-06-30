"use client"
import { useState, useEffect } from 'react'
import { Settings, Users, Database, Shield, FileText, Clock, Plus, X, UserPlus, ToggleLeft, ToggleRight, Edit2, Save, Download, HardDrive, Loader2, CheckCircle2, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useData } from '@/shared/context/data-context'
import { getAuditLog } from '@/shared/services/db'
import type { User, UserRole, AuditLogEntry, DgaCurrency } from '@/shared/types'

const ROLE_LABELS: Record<UserRole, string> = { socio: 'Socio', asociado: 'Asociado', cliente: 'Cliente', admin: 'Administrador' }

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

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-foreground text-background text-sm px-4 py-3 rounded-xl shadow-card-lg">
      {msg}<button type="button" title="Cerrar" onClick={onClose}><X className="w-3.5 h-3.5" /></button>
    </div>
  )
}

type Backup = { fecha: string; tipo: string; registros: number; tamano: string; estado: string }

export default function ConfiguracionPage() {
  const {
    clients, practiceAreas, alerts, legalNotes, documents,
    contractReviews, matters, matterEvents, dueDiligenceProjects,
    dueDiligenceFindings, complianceDiagnostics, hrTickets,
  } = useData()

  const [users, setUsers] = useState<User[]>([])
  const [sources, setSources] = useState<Source[]>(INITIAL_SOURCES)
  const [prefs, setPrefs] = useState<Pref[]>(INITIAL_PREFS)
  const [userDialog, setUserDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null)
  const [editingPref, setEditingPref] = useState<string | null>(null)
  const [prefEditVal, setPrefEditVal] = useState('')
  const [toast, setToast] = useState('')
  const [userForm, setUserForm] = useState({ full_name: '', email: '', role: '' as UserRole | '', client_id: '', is_active: true, password: '', dgatime_enabled: false, hourly_rate: '', cost_rate: '', rate_currency: 'COP' as DgaCurrency })
  const [backups, setBackups] = useState<Backup[]>([])
  const [generating, setGenerating] = useState(false)
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

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

  async function loadUsers() {
    try {
      const res = await fetch('/api/auth/users')
      if (!res.ok) return
      const data = await res.json()
      type ApiUser = { id: string; email: string; name: string; role: UserRole; client_id?: string; is_active: boolean; dgatime_enabled?: boolean; hourly_rate?: number; cost_rate?: number; rate_currency?: DgaCurrency }
      setUsers((data.users as ApiUser[]).map(u => ({
        id: u.id, email: u.email, full_name: u.name, role: u.role,
        client_id: u.client_id, is_active: u.is_active, created_at: '',
        dgatime_enabled: u.dgatime_enabled, hourly_rate: u.hourly_rate, cost_rate: u.cost_rate, rate_currency: u.rate_currency,
      })))
    } catch { /* noop */ }
  }

  useEffect(() => {
    loadUsers()
    getAuditLog().then(setAuditLog).catch(() => { /* noop */ })
  }, [])

  function openAddUser() {
    setEditingUser(null)
    setUserForm({ full_name: '', email: '', role: '', client_id: '', is_active: true, password: '', dgatime_enabled: false, hourly_rate: '', cost_rate: '', rate_currency: 'COP' })
    setUserDialog(true)
  }

  function openEditUser(u: User) {
    setEditingUser(u)
    setUserForm({
      full_name: u.full_name, email: u.email, role: u.role, client_id: u.client_id ?? '', is_active: u.is_active, password: '',
      dgatime_enabled: u.dgatime_enabled ?? false,
      hourly_rate: u.hourly_rate != null ? String(u.hourly_rate) : '',
      cost_rate: u.cost_rate != null ? String(u.cost_rate) : '',
      rate_currency: u.rate_currency ?? 'COP',
    })
    setUserDialog(true)
  }

  async function saveUser() {
    if (!userForm.full_name || !userForm.email || !userForm.role) return
    if (!editingUser && (!userForm.password || userForm.password.length < 10)) {
      showToast('La contraseña debe tener al menos 10 caracteres'); return
    }
    const payload = {
      name: userForm.full_name,
      email: userForm.email,
      role: userForm.role,
      client_id: userForm.role === 'cliente' ? userForm.client_id : undefined,
      is_active: userForm.is_active,
      password: userForm.password,
      dgatime_enabled: userForm.dgatime_enabled,
      hourly_rate: userForm.hourly_rate ? Number(userForm.hourly_rate) : undefined,
      cost_rate: userForm.cost_rate ? Number(userForm.cost_rate) : undefined,
      rate_currency: userForm.rate_currency,
    }
    try {
      const res = editingUser
        ? await fetch(`/api/auth/users/${editingUser.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/auth/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { showToast(data.error || 'No se pudo guardar el usuario'); return }
      await loadUsers()
      setUserDialog(false)
      setEditingUser(null)
      showToast(editingUser ? 'Usuario actualizado' : `Usuario ${userForm.full_name} agregado`)
    } catch {
      showToast('Error de conexión')
    }
  }

  async function deleteUser(u: User) {
    try {
      const res = await fetch(`/api/auth/users/${u.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { showToast(data.error || 'No se pudo eliminar'); setConfirmDelete(null); return }
      await loadUsers()
      setConfirmDelete(null)
      showToast(`Usuario ${u.full_name} eliminado`)
    } catch {
      showToast('Error de conexión')
    }
  }

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
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4" />Usuarios registrados ({users.length})</CardTitle>
              <Button type="button" size="sm" onClick={openAddUser}>
                <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                Agregar usuario
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(user => (
                    <TableRow key={user.id}>
                      <TableCell className="text-xs font-medium">{user.full_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{ROLE_LABELS[user.role as UserRole]}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {user.client_id ? clients.find(c => c.id === user.client_id)?.name.split(' ').slice(0, 2).join(' ') : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${user.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                            {user.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                          {user.dgatime_enabled && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border bg-brand-gold/10 text-brand-gold border-brand-gold/30 inline-flex items-center gap-0.5" title="Acceso a DGA-Time">
                              <Clock className="w-2.5 h-2.5" />Time
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <button type="button" title="Editar usuario" onClick={() => openEditUser(user)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button" title="Eliminar usuario"
                            onClick={() => setConfirmDelete(user)}
                            disabled={users.length <= 1}
                            className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
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

        <TabsContent value="respaldo" className="mt-4 space-y-4">
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

      {/* Agregar / Editar usuario */}
      <Dialog open={userDialog} onOpenChange={v => { if (!v) { setUserDialog(false); setEditingUser(null) } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingUser ? 'Editar usuario' : 'Agregar usuario'}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre completo *</Label>
              <Input value={userForm.full_name} onChange={e => setUserForm(p => ({ ...p, full_name: e.target.value }))} className="text-sm" placeholder="Ej. María González" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Correo electrónico *</Label>
              <Input type="email" value={userForm.email} onChange={e => setUserForm(p => ({ ...p, email: e.target.value }))} className="text-sm" placeholder="correo@dominio.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                {editingUser ? 'Nueva contraseña' : 'Contraseña *'}
                {editingUser && <span className="text-muted-foreground font-normal"> (opcional)</span>}
              </Label>
              <Input type="password" value={userForm.password} onChange={e => setUserForm(p => ({ ...p, password: e.target.value }))} className="text-sm" placeholder={editingUser ? 'Dejar en blanco para no cambiarla' : 'Mínimo 6 caracteres'} autoComplete="new-password" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Rol *</Label>
              <Select value={userForm.role} onValueChange={v => setUserForm(p => ({ ...p, role: v as UserRole }))}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Seleccionar rol" /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([k, v]) =>
                    <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            {userForm.role === 'cliente' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Cliente asociado</Label>
                <Select value={userForm.client_id} onValueChange={v => setUserForm(p => ({ ...p, client_id: v }))}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.name.split(' ').slice(0, 3).join(' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Estado</Label>
              <Select value={userForm.is_active ? 'activo' : 'inactivo'} onValueChange={v => setUserForm(p => ({ ...p, is_active: v === 'activo' }))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo" className="text-xs">Activo</SelectItem>
                  <SelectItem value="inactivo" className="text-xs">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* DGA-Time: habilitación del módulo + tarifa */}
            {userForm.role !== 'cliente' && (
              <div className="space-y-2 pt-2 border-t border-border">
                <button type="button" onClick={() => setUserForm(p => ({ ...p, dgatime_enabled: !p.dgatime_enabled }))} className="flex items-center justify-between w-full">
                  <div className="text-left">
                    <p className="text-xs font-medium flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-brand-gold" />Acceso a DGA-Time</p>
                    <p className="text-[10px] text-muted-foreground">Registro de horas, facturación y rentabilidad</p>
                  </div>
                  {userForm.dgatime_enabled
                    ? <ToggleRight className="w-7 h-7 text-brand-gold" />
                    : <ToggleLeft className="w-7 h-7 text-muted-foreground" />}
                </button>
                {userForm.dgatime_enabled && (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Tarifa / hora</Label>
                        <Input type="number" min="0" value={userForm.hourly_rate} onChange={e => setUserForm(p => ({ ...p, hourly_rate: e.target.value }))} className="text-sm" placeholder="250000" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Costo / hora</Label>
                        <Input type="number" min="0" value={userForm.cost_rate} onChange={e => setUserForm(p => ({ ...p, cost_rate: e.target.value }))} className="text-sm" placeholder="120000" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Moneda</Label>
                        <Select value={userForm.rate_currency} onValueChange={v => setUserForm(p => ({ ...p, rate_currency: v as DgaCurrency }))}>
                          <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="COP" className="text-xs">COP</SelectItem>
                            <SelectItem value="USD" className="text-xs">USD</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground -mt-1">El <strong>costo/hora</strong> es lo que le cuesta a la firma esa hora; se usa para calcular la rentabilidad real (margen = ingreso − costo).</p>
                  </>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button type="button" size="sm" className="flex-1" onClick={saveUser} disabled={!userForm.full_name || !userForm.email || !userForm.role || (!editingUser && !userForm.password)}>
                {editingUser ? <><Save className="w-3.5 h-3.5 mr-1.5" />Guardar cambios</> : <><Plus className="w-3.5 h-3.5 mr-1.5" />Agregar</>}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => { setUserDialog(false); setEditingUser(null) }}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmar eliminación */}
      <Dialog open={!!confirmDelete} onOpenChange={v => { if (!v) setConfirmDelete(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-600"><Trash2 className="w-4 h-4" />Eliminar usuario</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mt-2">
            ¿Seguro que deseas eliminar a <strong className="text-foreground">{confirmDelete?.full_name}</strong>? Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-2 pt-3">
            <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button type="button" size="sm" className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={() => confirmDelete && deleteUser(confirmDelete)}>
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {toast && <Toast msg={toast} onClose={() => setToast('')} />}
    </div>
  )
}
