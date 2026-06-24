"use client"
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, MessageSquare, Bell, FileText, FileCheck,
  Search, Shield, Users, Briefcase, Settings, Scale,
  BookOpen, BarChart3, Gavel, Clock, Receipt, PieChart, Repeat, Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRoleStore } from '@/shared/stores/role-store'
import { useUIStore } from '@/shared/stores/ui-store'
import { useAuthStore } from '@/shared/stores/auth-store'
import type { UserRole } from '@/shared/types'

const ROLE_LABELS: Record<UserRole, string> = { socio: 'Socio', asociado: 'Asociado', cliente: 'Cliente', admin: 'Administrador' }

type NavItem = {
  href: string; label: string; icon: typeof LayoutDashboard; roles: UserRole[]
  dgatime?: boolean; managerOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Inicio', icon: LayoutDashboard, roles: ['socio', 'asociado', 'admin'] },
  { href: '/copiloto', label: 'DG&A IA', icon: MessageSquare, roles: ['socio', 'asociado', 'admin'] },
  { href: '/monitor', label: 'Monitor normativo', icon: Bell, roles: ['socio', 'asociado', 'admin'] },
  { href: '/legal-notes', label: 'Legal Notes', icon: BookOpen, roles: ['socio', 'asociado', 'admin'] },
  { href: '/contratos', label: 'Contratos', icon: FileText, roles: ['socio', 'asociado', 'admin'] },
  { href: '/due-diligence', label: 'Due Diligence', icon: Search, roles: ['socio', 'asociado', 'admin'] },
  { href: '/compliance', label: 'Compliance', icon: Shield, roles: ['socio', 'asociado', 'admin'] },
  { href: '/laboral', label: 'Laboral / RR.HH.', icon: Users, roles: ['socio', 'asociado', 'admin'] },
  { href: '/litigios', label: 'Litigios', icon: Scale, roles: ['socio', 'asociado', 'admin'] },
  { href: '/rama-judicial', label: 'Rama Judicial', icon: Gavel, roles: ['socio', 'asociado', 'admin'] },
  { href: '/clientes', label: 'Clientes', icon: Briefcase, roles: ['socio', 'asociado', 'admin'] },
  // ── DGA-Time (visible solo si el usuario tiene el módulo habilitado) ──
  { href: '/dgatime/captura', label: 'Captura inteligente', icon: Sparkles, roles: ['socio', 'asociado', 'admin'], dgatime: true },
  { href: '/dgatime', label: 'Resumen', icon: PieChart, roles: ['socio', 'asociado', 'admin'], dgatime: true },
  { href: '/dgatime/horas', label: 'Registro de horas', icon: Clock, roles: ['socio', 'asociado', 'admin'], dgatime: true },
  { href: '/dgatime/informes', label: 'Informes', icon: FileText, roles: ['socio', 'asociado', 'admin'], dgatime: true },
  { href: '/dgatime/facturacion', label: 'Facturación', icon: Receipt, roles: ['socio', 'admin'], dgatime: true, managerOnly: true },
  { href: '/dgatime/igualas', label: 'Igualas', icon: Repeat, roles: ['socio', 'admin'], dgatime: true, managerOnly: true },
  { href: '/reportes', label: 'Reportes', icon: BarChart3, roles: ['socio', 'admin'] },
  { href: '/configuracion', label: 'Configuración', icon: Settings, roles: ['socio', 'admin'] },
  { href: '/portal', label: 'Mi Portal', icon: LayoutDashboard, roles: ['cliente'] },
  { href: '/portal/asuntos', label: 'Mis Asuntos', icon: Scale, roles: ['cliente'] },
  { href: '/portal/documentos', label: 'Mis Documentos', icon: FileCheck, roles: ['cliente'] },
  { href: '/portal/alertas', label: 'Mis Alertas', icon: Bell, roles: ['cliente'] },
]

const SECTION_DIVIDERS: Record<string, string> = {
  '/clientes': 'Gestión',
  '/copiloto': 'Herramientas IA',
  '/contratos': 'Práctica legal',
  '/dgatime/captura': 'DGA-Time',
  '/reportes': 'Administración',
}

export function Sidebar() {
  const pathname = usePathname()
  const { currentRole } = useRoleStore()
  const { mobileNavOpen, setMobileNav } = useUIStore()
  const authUser = useAuthStore(s => s.user)
  const isManager = authUser?.role === 'socio' || authUser?.role === 'admin'
  const dgatimeAccess = isManager || authUser?.dgatime_enabled === true
  const visibleItems = NAV_ITEMS.filter(item => {
    if (!item.roles.includes(currentRole)) return false
    if (item.dgatime && !dgatimeAccess) return false
    if (item.managerOnly && !isManager) return false
    return true
  })
  const footerName = authUser?.name ?? 'Usuario DG&A'
  const footerRole = ROLE_LABELS[authUser?.role ?? currentRole]
  const footerInitials = ((footerName.trim().split(/\s+/)[0]?.[0] ?? '') + (footerName.trim().split(/\s+/)[1]?.[0] ?? '')).toUpperCase() || 'DG'

  return (
    <>
    {/* Backdrop (solo móvil/tablet cuando el cajón está abierto) */}
    <div
      onClick={() => setMobileNav(false)}
      className={cn(
        "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity lg:hidden",
        mobileNavOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      aria-hidden="true"
    />
    <aside className={cn(
      "fixed left-0 top-0 h-full w-[220px] flex flex-col z-50 bg-brand-navy transition-transform duration-300 ease-in-out lg:translate-x-0",
      mobileNavOpen ? "translate-x-0" : "-translate-x-full"
    )}>

      {/* Logo */}
      <div className="flex items-center px-5 pt-6 pb-5">
        <Image
          src="/logo.png"
          alt="DG&A Logo"
          width={140}
          height={48}
          className="object-contain"
          priority
        />
      </div>

      {/* Search pill */}
      <div className="px-4 mb-4">
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer bg-white/[0.07] border border-white/10">
          <Search className="w-3.5 h-3.5 text-white/35" />
          <span className="text-xs text-white/35">Buscar módulo...</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-0.5 pb-4">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && item.href !== '/portal' && item.href !== '/dgatime' && pathname.startsWith(item.href))
          const showDivider = SECTION_DIVIDERS[item.href]

          return (
            <div key={item.href}>
              {showDivider && (
                <p className="text-[9px] font-semibold uppercase tracking-widest px-3 pt-4 pb-1.5 text-white/30">
                  {showDivider}
                </p>
              )}
              <Link
                href={item.href}
                onClick={() => setMobileNav(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 group relative",
                  isActive
                    ? "font-semibold bg-brand-gold/[0.18] text-brand-gold-light"
                    : "text-white/60 hover:bg-white/[0.06]"
                )}
              >
                <Icon className={cn(
                  "w-4 h-4 flex-shrink-0 transition-colors",
                  isActive ? "text-brand-gold-light" : "group-hover:text-white/80"
                )} />
                <span className={cn(
                  "flex-1 text-[13px] truncate",
                  isActive ? "text-brand-gold-light" : "group-hover:text-white/90"
                )}>
                  {item.label}
                </span>
                {isActive && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-l-full bg-brand-gold-light" />
                )}
              </Link>
            </div>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="px-4 py-4 border-t border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 bg-brand-gold/40">
            {footerInitials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-white truncate leading-none">{footerName}</p>
            <p className="text-[10px] mt-0.5 text-white/40">{footerRole} · DG&A</p>
          </div>
        </div>
      </div>
    </aside>
    </>
  )
}
