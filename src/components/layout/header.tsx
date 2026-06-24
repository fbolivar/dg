"use client"
import { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown, LogOut, User, Settings, Menu } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useRoleStore } from '@/shared/stores/role-store'
import { useUIStore } from '@/shared/stores/ui-store'
import { useAuthStore } from '@/shared/stores/auth-store'
import { useRouter } from 'next/navigation'
import { NotificationsBell } from './notifications-bell'
import type { UserRole } from '@/shared/types'

const ROLE_LABELS: Record<UserRole, string> = {
  socio: 'Socio',
  asociado: 'Asociado',
  cliente: 'Cliente',
  admin: 'Administrador',
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'DG'
}

export function Header({ title }: { title?: string }) {
  const { currentRole } = useRoleStore()
  const { toggleMobileNav } = useUIStore()
  const authUser = useAuthStore(s => s.user)
  const role = authUser?.role ?? currentRole
  const user = authUser
    ? { name: authUser.name, email: authUser.email, initials: initialsOf(authUser.name) }
    : { name: 'Usuario DG&A', email: '', initials: 'DG' }
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

  async function handleLogout() {
    setMenuOpen(false)
    try { await fetch('/api/auth/logout', { method: 'POST' }) } catch { /* noop */ }
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="fixed top-0 left-0 lg:left-[220px] right-0 h-14 bg-white border-b border-border z-30 flex items-center justify-between px-3 sm:px-6 gap-2 sm:gap-4">
      {/* Hamburguesa (solo móvil/tablet) */}
      <button
        type="button"
        onClick={toggleMobileNav}
        aria-label="Abrir menú"
        className="lg:hidden flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
      >
        <Menu className="w-5 h-5 text-foreground" />
      </button>

      {/* Search bar */}
      <div className="hidden md:flex items-center gap-2 bg-muted/60 rounded-lg px-3 py-2 w-44 lg:w-64 flex-shrink-0">
        <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <input
          type="text"
          placeholder="Buscar..."
          className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none w-full"
        />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 sm:gap-3 ml-auto min-w-0">
        {/* Notifications */}
        <NotificationsBell />

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
              <p className="text-[10px] text-muted-foreground mt-0.5">{ROLE_LABELS[role]}</p>
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
                  {ROLE_LABELS[role]}
                </span>
              </div>
              {/* Mi perfil — todos los roles */}
              <button
                type="button"
                onClick={() => { setMenuOpen(false); router.push('/perfil') }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors"
              >
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                Mi perfil
              </button>
              {/* Configuración — solo socio y admin */}
              {(role === 'socio' || role === 'admin') && (
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); router.push('/configuracion') }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors"
                >
                  <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                  Configuración
                </button>
              )}
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
