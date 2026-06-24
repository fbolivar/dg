"use client"
import { useState, useEffect } from 'react'
import { User, Lock, Save, Eye, EyeOff, X, CheckCircle2, Plug } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useRoleStore } from '@/shared/stores/role-store'
import { useAuthStore } from '@/shared/stores/auth-store'
import { IntegrationsPanel } from '@/components/dgatime/integrations-panel'
import type { UserRole } from '@/shared/types'

const ROLE_LABELS: Record<UserRole, string> = {
  socio: 'Socio', asociado: 'Asociado', cliente: 'Cliente', admin: 'Administrador',
}

const DEMO_PROFILES: Record<UserRole, { name: string; email: string; phone: string; position: string }> = {
  socio:    { name: 'Carlos Gómez Vargas',   email: 'cgomez@dga.com',           phone: '+57 310 123 4567', position: 'Socio principal' },
  asociado: { name: 'Ana Martínez Díaz',     email: 'amartin@dga.com',          phone: '+57 311 234 5678', position: 'Abogada asociada' },
  admin:    { name: 'Laura Rodríguez',       email: 'lrodriguez@dga.com',       phone: '+57 312 345 6789', position: 'Administradora' },
  cliente:  { name: 'Director Legal Andina', email: 'legal@andinaretail.com',   phone: '+57 313 456 7890', position: 'Director Legal' },
}

function Toast({ msg, ok, onClose }: { msg: string; ok?: boolean; onClose: () => void }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 text-sm px-4 py-3 rounded-xl shadow-lg ${ok ? 'bg-green-700 text-white' : 'bg-foreground text-background'}`}>
      {ok && <CheckCircle2 className="w-4 h-4" />}
      {msg}
      <button type="button" title="Cerrar" onClick={onClose}><X className="w-3.5 h-3.5" /></button>
    </div>
  )
}

export default function PerfilPage() {
  const { currentRole } = useRoleStore()
  const authUser = useAuthStore(s => s.user)
  const base = DEMO_PROFILES[currentRole]

  const [profile, setProfile] = useState({ ...base })
  const [profileDirty, setProfileDirty] = useState(false)

  // Re-sincroniza el perfil con el usuario autenticado y el rol actual.
  useEffect(() => {
    const b = DEMO_PROFILES[currentRole]
    setProfile({
      name: authUser?.name ?? b.name,
      email: authUser?.email ?? b.email,
      phone: b.phone,
      position: b.position,
    })
    setProfileDirty(false)
  }, [currentRole, authUser])

  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' })
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pwError, setPwError] = useState('')

  const [toast, setToast] = useState<{ msg: string; ok?: boolean } | null>(null)
  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000) }

  // Acceso a DGA-Time → muestra "Mis conexiones"
  const hasDgatime = authUser?.role === 'socio' || authUser?.role === 'admin' || authUser?.dgatime_enabled === true

  // Retorno del flujo OAuth de conexiones
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('connected')) showToast('Cuenta conectada correctamente')
    else if (p.get('error') === 'no_configurado') showToast('Esa integración aún no está configurada', false)
    else if (p.get('error')) showToast('No se pudo completar la conexión', false)
    if (p.get('connected') || p.get('error')) window.history.replaceState({}, '', '/perfil')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleProfileChange(field: string, value: string) {
    setProfile(p => ({ ...p, [field]: value }))
    setProfileDirty(true)
  }

  function saveProfile() {
    if (!profile.name.trim() || !profile.email.trim()) return
    setProfileDirty(false)
    showToast('Perfil actualizado correctamente')
  }

  function savePassword() {
    setPwError('')
    if (!passwords.current) { setPwError('Ingresa tu contraseña actual'); return }
    if (passwords.next.length < 8) { setPwError('La nueva contraseña debe tener al menos 8 caracteres'); return }
    if (passwords.next !== passwords.confirm) { setPwError('Las contraseñas no coinciden'); return }
    if (passwords.current !== 'demo1234') { setPwError('Contraseña actual incorrecta'); return }
    setPasswords({ current: '', next: '', confirm: '' })
    showToast('Contraseña actualizada correctamente')
  }

  const pwStrength = passwords.next.length === 0 ? null
    : passwords.next.length < 6 ? 'débil'
    : passwords.next.length < 10 ? 'moderada'
    : 'fuerte'

  const pwStrengthColor = { débil: 'bg-red-400', moderada: 'bg-yellow-400', fuerte: 'bg-green-500' }
  const pwStrengthWidth = { débil: 'w-1/3', moderada: 'w-2/3', fuerte: 'w-full' }

  return (
    <div className="space-y-6 max-w-[640px]">
      <div>
        <h1 className="text-xl font-semibold font-playfair text-foreground">Mi perfil</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Administra tu información personal y contraseña</p>
      </div>

      {/* Avatar + role */}
      <div className="flex items-center gap-4 p-4 bg-brand-navy rounded-xl text-white">
        <div className="w-14 h-14 rounded-full bg-brand-gold/30 flex items-center justify-center text-xl font-bold flex-shrink-0">
          {profile.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
        </div>
        <div>
          <p className="font-semibold text-base">{profile.name}</p>
          <p className="text-white/60 text-sm">{profile.email}</p>
          <span className="inline-flex mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-gold/20 text-brand-gold-light">
            {ROLE_LABELS[currentRole]}
          </span>
        </div>
      </div>

      {/* Personal data */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="w-4 h-4 text-brand-gold" />
            Datos personales
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre completo *</Label>
              <Input
                value={profile.name}
                onChange={e => handleProfileChange('name', e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cargo / Posición</Label>
              <Input
                value={profile.position}
                onChange={e => handleProfileChange('position', e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Correo electrónico *</Label>
              <Input
                type="email"
                value={profile.email}
                onChange={e => handleProfileChange('email', e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Teléfono</Label>
              <Input
                value={profile.phone}
                onChange={e => handleProfileChange('phone', e.target.value)}
                className="text-sm"
                placeholder="+57 300 000 0000"
              />
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <Button
              size="sm"
              onClick={saveProfile}
              disabled={!profileDirty}
              className="bg-brand-navy hover:bg-brand-navy/90 text-white"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              Guardar cambios
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Lock className="w-4 h-4 text-brand-gold" />
            Cambiar contraseña
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Contraseña actual *</Label>
            <div className="relative">
              <Input
                type={showCurrent ? 'text' : 'password'}
                value={passwords.current}
                onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))}
                className="text-sm pr-10"
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">En modo demo, la contraseña actual es <span className="font-mono font-semibold">demo1234</span></p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Nueva contraseña *</Label>
            <div className="relative">
              <Input
                type={showNext ? 'text' : 'password'}
                value={passwords.next}
                onChange={e => setPasswords(p => ({ ...p, next: e.target.value }))}
                className="text-sm pr-10"
                placeholder="Mínimo 8 caracteres"
              />
              <button type="button" onClick={() => setShowNext(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showNext ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {pwStrength && (
              <div className="space-y-1">
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${pwStrengthColor[pwStrength]} ${pwStrengthWidth[pwStrength]}`} />
                </div>
                <p className={`text-[10px] font-medium ${pwStrength === 'débil' ? 'text-red-500' : pwStrength === 'moderada' ? 'text-yellow-600' : 'text-green-600'}`}>
                  Seguridad: {pwStrength}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Confirmar nueva contraseña *</Label>
            <div className="relative">
              <Input
                type={showConfirm ? 'text' : 'password'}
                value={passwords.confirm}
                onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))}
                className="text-sm pr-10"
                placeholder="Repite la nueva contraseña"
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {passwords.confirm && passwords.next !== passwords.confirm && (
              <p className="text-[10px] text-red-500">Las contraseñas no coinciden</p>
            )}
          </div>

          {pwError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{pwError}</p>
          )}

          <div className="flex justify-end pt-1">
            <Button
              size="sm"
              onClick={savePassword}
              disabled={!passwords.current || !passwords.next || !passwords.confirm}
              className="bg-brand-navy hover:bg-brand-navy/90 text-white"
            >
              <Lock className="w-3.5 h-3.5 mr-1.5" />
              Actualizar contraseña
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Mis conexiones (correo y calendario) — solo para usuarios con DGA-Time */}
      {hasDgatime && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Plug className="w-4 h-4 text-brand-gold" />
              Mis conexiones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <IntegrationsPanel onMessage={(m) => showToast(m)} />
          </CardContent>
        </Card>
      )}

      {toast && <Toast msg={toast.msg} ok={toast.ok} onClose={() => setToast(null)} />}
    </div>
  )
}
