"use client"
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, MessageSquare, Bell, FileText, FileCheck,
  Search, Shield, Users, Briefcase, Settings, Scale,
  BookOpen, BarChart3
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRoleStore } from '@/shared/stores/role-store'
import type { UserRole } from '@/shared/types'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Inicio', icon: LayoutDashboard, roles: ['socio', 'asociado', 'admin'] as UserRole[] },
  { href: '/copiloto', label: 'Copiloto DG&A', icon: MessageSquare, roles: ['socio', 'asociado', 'admin'] as UserRole[] },
  { href: '/monitor', label: 'Monitor normativo', icon: Bell, roles: ['socio', 'asociado', 'admin'] as UserRole[] },
  { href: '/legal-notes', label: 'Legal Notes', icon: BookOpen, roles: ['socio', 'asociado', 'admin'] as UserRole[] },
  { href: '/contratos', label: 'Contratos', icon: FileText, roles: ['socio', 'asociado', 'admin'] as UserRole[] },
  { href: '/due-diligence', label: 'Due Diligence', icon: Search, roles: ['socio', 'asociado', 'admin'] as UserRole[] },
  { href: '/compliance', label: 'Compliance', icon: Shield, roles: ['socio', 'asociado', 'admin'] as UserRole[] },
  { href: '/laboral', label: 'Laboral / RR.HH.', icon: Users, roles: ['socio', 'asociado', 'admin'] as UserRole[] },
  { href: '/litigios', label: 'Litigios', icon: Scale, roles: ['socio', 'asociado', 'admin'] as UserRole[] },
  { href: '/clientes', label: 'Clientes', icon: Briefcase, roles: ['socio', 'asociado', 'admin'] as UserRole[] },
  { href: '/reportes', label: 'Reportes', icon: BarChart3, roles: ['socio', 'admin'] as UserRole[] },
  { href: '/configuracion', label: 'Configuración', icon: Settings, roles: ['socio', 'admin'] as UserRole[] },
  { href: '/portal', label: 'Mi Portal', icon: LayoutDashboard, roles: ['cliente'] as UserRole[] },
  { href: '/portal/asuntos', label: 'Mis Asuntos', icon: Scale, roles: ['cliente'] as UserRole[] },
  { href: '/portal/documentos', label: 'Mis Documentos', icon: FileCheck, roles: ['cliente'] as UserRole[] },
  { href: '/portal/alertas', label: 'Mis Alertas', icon: Bell, roles: ['cliente'] as UserRole[] },
]

const SECTION_DIVIDERS: Record<string, string> = {
  '/clientes': 'Gestión',
  '/copiloto': 'Herramientas IA',
  '/contratos': 'Práctica legal',
}

export function Sidebar() {
  const pathname = usePathname()
  const { currentRole } = useRoleStore()
  const visibleItems = NAV_ITEMS.filter(item => item.roles.includes(currentRole))

  return (
    <aside className="fixed left-0 top-0 h-full w-[220px] flex flex-col z-40 bg-brand-navy">

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
            (item.href !== '/dashboard' && item.href !== '/portal' && pathname.startsWith(item.href))
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
            CG
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-white truncate leading-none">Carlos Gómez V.</p>
            <p className="text-[10px] mt-0.5 text-white/40">Socio DG&A</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
