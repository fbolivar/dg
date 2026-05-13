"use client"
import { useState, useRef, useEffect } from 'react'
import { Bell, Search, ChevronDown, LogOut, User, Settings } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useRoleStore } from '@/shared/stores/role-store'
import { useRouter } from 'next/navigation'
import type { UserRole } from '@/shared/types'

const ROLE_LABELS: Record<UserRole, string> = {
  socio: 'Socio',
  asociado: 'Asociado',
  cliente: 'Cliente',
  admin: 'Administrador',
}

const ROLE_USERS: Record<UserRole, { name: string; initials: string; email: string }> = {
  socio: { name: 'Carlos Gómez V.', initials: 'CG', email: 'cgomez@dga.com' },
  asociado: { name: 'Ana Martínez D.', initials: 'AM', email: 'amartin@dga.com' },
  cliente: { name: 'María Ospina', initials: 'MO', email: 'legal@andinaretail.com' },
  admin: { name: 'Laura Rodríguez S.', initials: 'LR', email: 'lrodriguez@dga.com' },
}

const ROLES: UserRole[] = ['socio', 'asociado', 'admin', 'cliente']

export function Header({ title }: { title?: string }) {
  const { currentRole, setRole } = useRoleStore()
  const user = ROLE_USERS[currentRole]
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleLogout() {
    setMenuOpen(false)
    router.push('/login')
  }

  return (
    <header className="fixed top-0 left-[220px] right-0 h-14 bg-white border-b border-border z-30 flex items-center justify-between px-6 gap-4">
      {/* Search bar */}
      <div className="flex items-center gap-2 bg-muted/60 rounded-lg px-3 py-2 w-64 flex-shrink-0">
        <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <input
          type="text"
          placeholder="Buscar..."
          className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none w-full"
        />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 ml-auto">
        {/* Demo Role Switcher */}
        <div className="flex items-center gap-0.5 bg-muted rounded-lg p-1">
          <span className="text-[10px] text-muted-foreground px-2 font-medium whitespace-nowrap">Demo:</span>
          {ROLES.map(role => (
            <button
              key={role}
              type="button"
              onClick={() => setRole(role)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                currentRole === role
                  ? 'bg-brand-navy text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background'
              }`}
            >
              {ROLE_LABELS[role]}
            </button>
          ))}
        </div>

        {/* Notifications */}
        <button type="button" title="Notificaciones" className="relative w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
          <Bell className="w-4 h-4 text-muted-foreground" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>

        {/* User dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(v => !v)}
            className="flex items-center gap-2 pl-3 border-l border-border hover:opacity-80 transition-opacity"
          >
            <Avatar className="w-7 h-7">
              <AvatarFallback className="text-[10px] font-semibold bg-brand-gold/20 text-brand-navy">
                {user.initials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-foreground leading-none">{user.name}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{ROLE_LABELS[currentRole]}</p>
            </div>
            <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-border rounded-xl shadow-card-lg py-1 z-50">
              {/* User info */}
              <div className="px-3 py-2.5 border-b border-border">
                <p className="text-xs font-semibold text-foreground">{user.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{user.email}</p>
                <span className="inline-flex mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-brand-navy/10 text-brand-navy">
                  {ROLE_LABELS[currentRole]}
                </span>
              </div>
              {/* Menu items */}
              <button
                type="button"
                onClick={() => { setMenuOpen(false); router.push('/configuracion') }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors"
              >
                <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                Configuración
              </button>
              <button
                type="button"
                onClick={() => { setMenuOpen(false); router.push('/configuracion') }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors"
              >
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                Mi perfil
              </button>
              <div className="border-t border-border mt-1 pt-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Cerrar sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
