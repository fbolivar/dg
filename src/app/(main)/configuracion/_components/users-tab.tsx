"use client"
import { useState, useEffect } from 'react'
import { Users, Plus, UserPlus, ToggleLeft, ToggleRight, Edit2, Save, Clock, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useData } from '@/shared/context/data-context'
import { Toast, useToast } from './toast'
import { MIN_PASSWORD_LENGTH } from '@/shared/lib/auth-constants'
import type { User, UserRole, DgaCurrency } from '@/shared/types'

const ROLE_LABELS: Record<UserRole, string> = { socio: 'Socio', asociado: 'Asociado', cliente: 'Cliente', admin: 'Administrador' }

type ApiUser = { id: string; email: string; name: string; role: UserRole; client_id?: string; is_active: boolean; dgatime_enabled?: boolean; hourly_rate?: number; cost_rate?: number; rate_currency?: DgaCurrency }

const EMPTY_FORM = { full_name: '', email: '', role: '' as UserRole | '', client_id: '', is_active: true, password: '', dgatime_enabled: false, hourly_rate: '', cost_rate: '', rate_currency: 'COP' as DgaCurrency }

export function UsersTab() {
  const { clients } = useData()
  const { toast, showToast, clearToast } = useToast()

  const [users, setUsers] = useState<User[]>([])
  const [userDialog, setUserDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null)
  const [userForm, setUserForm] = useState(EMPTY_FORM)

  async function loadUsers() {
    try {
      const res = await fetch('/api/auth/users')
      if (!res.ok) return
      const data = await res.json()
      setUsers((data.users as ApiUser[]).map(u => ({
        id: u.id, email: u.email, full_name: u.name, role: u.role,
        client_id: u.client_id, is_active: u.is_active, created_at: '',
        dgatime_enabled: u.dgatime_enabled, hourly_rate: u.hourly_rate, cost_rate: u.cost_rate, rate_currency: u.rate_currency,
      })))
    } catch { /* noop */ }
  }

  useEffect(() => { loadUsers() }, [])

  function openAddUser() {
    setEditingUser(null)
    setUserForm(EMPTY_FORM)
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
    if (!editingUser && (!userForm.password || userForm.password.length < MIN_PASSWORD_LENGTH)) {
      showToast(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`); return
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

  return (
    <>
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
              <Input type="password" value={userForm.password} onChange={e => setUserForm(p => ({ ...p, password: e.target.value }))} className="text-sm" placeholder={editingUser ? 'Dejar en blanco para no cambiarla' : `Mínimo ${MIN_PASSWORD_LENGTH} caracteres`} autoComplete="new-password" />
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

      {toast && <Toast msg={toast} onClose={clearToast} />}
    </>
  )
}
