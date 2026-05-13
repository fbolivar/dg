"use client"
import { useState, useEffect } from 'react'
import { Settings, Users, Database, Shield, FileText, Clock, Plus, X, UserPlus, ToggleLeft, ToggleRight, Edit2, Save } from 'lucide-react'
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
import * as db from '@/shared/services/db'
import type { User, UserRole } from '@/shared/types'

const AUDIT_LOG = [
  { user: 'Carlos Gómez', action: 'Aprobó Legal Note', entity: 'Alerta SAGRILAFT 2026', client: 'BioNova Colombia', date: '13 may 2026 10:22' },
  { user: 'Ana Martínez', action: 'Generó análisis de contrato IA', entity: 'Contrato distribución — Andina Retail', client: 'Andina Retail S.A.S.', date: '12 may 2026 16:45' },
  { user: 'Juan Pérez', action: 'Actualizó estado de alerta', entity: 'Criterios UGPP pagos no salariales', client: 'Servicios Industriales', date: '11 may 2026 09:10' },
  { user: 'Carlos Gómez', action: 'Rechazó Legal Note', entity: 'Boletín datos personales', client: 'Andina Retail S.A.S.', date: '10 may 2026 14:55' },
  { user: 'Ana Martínez', action: 'Creó consulta de copiloto', entity: 'Copiloto DG&A', client: '—', date: '09 may 2026 11:30' },
]

const ROLE_LABELS: Record<UserRole, string> = { socio: 'Socio', asociado: 'Asociado', cliente: 'Cliente', admin: 'Administrador' }

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

export default function ConfiguracionPage() {
  const { users: dbUsers, clients } = useData()
  const [users, setUsers] = useState<User[]>([])

  useEffect(() => { if (dbUsers.length > 0) setUsers(dbUsers.map(u => ({ ...u }))) }, [dbUsers])
  const [sources, setSources] = useState<Source[]>(INITIAL_SOURCES)
  const [prefs, setPrefs] = useState<Pref[]>(INITIAL_PREFS)
  const [inviting, setInviting] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editingPref, setEditingPref] = useState<string | null>(null)
  const [prefEditVal, setPrefEditVal] = useState('')
  const [toast, setToast] = useState('')
  const [newUser, setNewUser] = useState({ full_name: '', email: '', role: '' as UserRole | '', client_id: '' })

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  async function inviteUser() {
    if (!newUser.full_name || !newUser.email || !newUser.role) return
    const userData = {
      full_name: newUser.full_name,
      email: newUser.email,
      role: newUser.role as UserRole,
      client_id: newUser.client_id || undefined,
      is_active: true,
      created_at: new Date().toISOString(),
    }
    const created = await db.createUser(userData)
    if (created) setUsers(prev => [...prev, created])
    setInviting(false)
    setNewUser({ full_name: '', email: '', role: '', client_id: '' })
    showToast(`Usuario ${newUser.full_name} invitado correctamente`)
  }

  async function changeRole(userId: string, role: UserRole) {
    await db.updateUser(userId, { role })
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
    setEditingUser(null)
    showToast('Rol actualizado')
  }

  async function toggleUserStatus(userId: string) {
    const user = users.find(u => u.id === userId)
    if (!user) return
    await db.updateUser(userId, { is_active: !user.is_active })
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: !u.is_active } : u))
    showToast('Estado de usuario actualizado')
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
        <p className="text-sm text-muted-foreground mt-0.5">Gestión de roles, fuentes y auditoría del sistema</p>
      </div>

      <Tabs defaultValue="usuarios">
        <TabsList>
          <TabsTrigger value="usuarios" className="text-xs">Usuarios y roles</TabsTrigger>
          <TabsTrigger value="auditoria" className="text-xs">Bitácora de auditoría</TabsTrigger>
          <TabsTrigger value="fuentes" className="text-xs">Fuentes documentales</TabsTrigger>
          <TabsTrigger value="preferencias" className="text-xs">Preferencias</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="mt-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4" />Usuarios registrados ({users.length})</CardTitle>
              <Button type="button" size="sm" variant="outline" onClick={() => setInviting(true)}>
                <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                Invitar usuario
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
                        {editingUser?.id === user.id ? (
                          <Select value={user.role} onValueChange={v => changeRole(user.id, v as UserRole)}>
                            <SelectTrigger className="h-6 text-xs w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([k, v]) =>
                                <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">{ROLE_LABELS[user.role as UserRole]}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {user.client_id ? clients.find(c => c.id === user.client_id)?.name.split(' ').slice(0, 2).join(' ') : '—'}
                      </TableCell>
                      <TableCell>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${user.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                          {user.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <button type="button" title="Editar rol" onClick={() => setEditingUser(editingUser?.id === user.id ? null : user)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button type="button" title={user.is_active ? 'Desactivar' : 'Activar'} onClick={() => toggleUserStatus(user.id)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                            {user.is_active ? <ToggleRight className="w-3.5 h-3.5 text-green-600" /> : <ToggleLeft className="w-3.5 h-3.5" />}
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
              <CardTitle className="text-sm flex items-center gap-2"><Shield className="w-4 h-4" />Bitácora de auditoría</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Entidad</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Fecha y hora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {AUDIT_LOG.map((entry, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs font-medium">{entry.user}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{entry.action}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                        <span className="truncate block">{entry.entity}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{entry.client}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {entry.date}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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

      {/* Invite Dialog */}
      <Dialog open={inviting} onOpenChange={v => { if (!v) setInviting(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Invitar usuario</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre completo *</Label>
              <Input value={newUser.full_name} onChange={e => setNewUser(p => ({ ...p, full_name: e.target.value }))} className="text-sm" placeholder="Ej. María González" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Correo electrónico *</Label>
              <Input type="email" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} className="text-sm" placeholder="correo@dominio.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Rol *</Label>
              <Select value={newUser.role} onValueChange={v => setNewUser(p => ({ ...p, role: v as UserRole }))}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Seleccionar rol" /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([k, v]) =>
                    <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            {newUser.role === 'cliente' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Cliente asociado</Label>
                <Select value={newUser.client_id} onValueChange={v => setNewUser(p => ({ ...p, client_id: v }))}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.name.split(' ').slice(0, 3).join(' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button type="button" size="sm" className="flex-1" onClick={inviteUser} disabled={!newUser.full_name || !newUser.email || !newUser.role}>
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Invitar
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setInviting(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {toast && <Toast msg={toast} onClose={() => setToast('')} />}
    </div>
  )
}
