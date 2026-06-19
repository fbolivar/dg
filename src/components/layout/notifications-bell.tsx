"use client"
import { useState, useRef, useEffect, useMemo } from 'react'
import { Bell, AlertTriangle, Scale, FileText, Clock, CheckCircle2, BookOpen, Users, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRoleStore } from '@/shared/stores/role-store'
import { useData } from '@/shared/context/data-context'
import type { UserRole } from '@/shared/types'

type Notification = {
  id: string
  icon: React.ElementType
  iconColor: string
  title: string
  body: string
  href: string
  urgent?: boolean
  time: string
}

const CLIENT_ID = 'cl1'
const NOW = Date.now()
const DAYS7 = 7 * 86400000

function useNotifications(role: UserRole): Notification[] {
  const { alerts, matters, legalNotes, hrTickets, documents } = useData()

  return useMemo(() => {
    const notifs: Notification[] = []

    if (role === 'socio' || role === 'admin') {
      // Alertas críticas sin archivar
      alerts
        .filter(a => a.impact_level === 'crítico' && a.status !== 'archivada')
        .slice(0, 3)
        .forEach(a => notifs.push({
          id: `alert-${a.id}`,
          icon: AlertTriangle,
          iconColor: 'text-red-600 bg-red-50',
          title: 'Alerta crítica',
          body: a.title,
          href: '/monitor',
          urgent: true,
          time: new Date(a.published_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }),
        }))

      // Asuntos con vencimiento en 7 días
      matters
        .filter(m => m.status === 'activo' && m.next_deadline && new Date(m.next_deadline).getTime() - NOW < DAYS7 && new Date(m.next_deadline).getTime() > NOW)
        .slice(0, 3)
        .forEach(m => notifs.push({
          id: `matter-${m.id}`,
          icon: Scale,
          iconColor: 'text-orange-600 bg-orange-50',
          title: 'Vencimiento próximo',
          body: m.title,
          href: '/litigios',
          urgent: true,
          time: new Date(m.next_deadline!).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }),
        }))

      // Legal Notes pendientes de revisión
      legalNotes
        .filter(n => n.status === 'en_revisión')
        .slice(0, 2)
        .forEach(n => notifs.push({
          id: `note-${n.id}`,
          icon: BookOpen,
          iconColor: 'text-yellow-600 bg-yellow-50',
          title: 'Legal Note para revisar',
          body: n.title,
          href: '/legal-notes',
          time: new Date(n.updated_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }),
        }))

      // Casos laborales sensibles abiertos
      hrTickets
        .filter(t => t.sensitivity_flag && t.status === 'abierto')
        .slice(0, 2)
        .forEach(t => notifs.push({
          id: `hr-${t.id}`,
          icon: Users,
          iconColor: 'text-red-600 bg-red-50',
          title: 'Caso laboral sensible',
          body: t.question.slice(0, 80) + (t.question.length > 80 ? '…' : ''),
          href: '/laboral',
          urgent: true,
          time: new Date(t.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }),
        }))
    }

    if (role === 'asociado') {
      // Alertas altas/críticas recientes
      alerts
        .filter(a => (a.impact_level === 'alto' || a.impact_level === 'crítico') && a.status === 'nueva')
        .slice(0, 3)
        .forEach(a => notifs.push({
          id: `alert-${a.id}`,
          icon: AlertTriangle,
          iconColor: a.impact_level === 'crítico' ? 'text-red-600 bg-red-50' : 'text-orange-600 bg-orange-50',
          title: `Alerta ${a.impact_level}`,
          body: a.title,
          href: '/monitor',
          urgent: a.impact_level === 'crítico',
          time: new Date(a.published_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }),
        }))

      // Asuntos con vencimiento próximo
      matters
        .filter(m => m.status === 'activo' && m.next_deadline && new Date(m.next_deadline).getTime() - NOW < DAYS7 && new Date(m.next_deadline).getTime() > NOW)
        .slice(0, 3)
        .forEach(m => notifs.push({
          id: `matter-${m.id}`,
          icon: Scale,
          iconColor: 'text-orange-600 bg-orange-50',
          title: 'Vencimiento próximo',
          body: m.title,
          href: '/litigios',
          urgent: true,
          time: new Date(m.next_deadline!).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }),
        }))

      // Legal Notes en borrador sin responder
      legalNotes
        .filter(n => n.status === 'borrador_ia')
        .slice(0, 2)
        .forEach(n => notifs.push({
          id: `note-${n.id}`,
          icon: BookOpen,
          iconColor: 'text-blue-600 bg-blue-50',
          title: 'Borrador IA listo',
          body: n.title,
          href: '/legal-notes',
          time: new Date(n.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }),
        }))
    }

    if (role === 'cliente') {
      // Alertas que afectan al cliente
      alerts
        .filter(a => a.clients_affected?.includes(CLIENT_ID) && a.status !== 'archivada')
        .slice(0, 3)
        .forEach(a => notifs.push({
          id: `alert-${a.id}`,
          icon: AlertTriangle,
          iconColor: a.impact_level === 'crítico' ? 'text-red-600 bg-red-50' : 'text-orange-600 bg-orange-50',
          title: 'Nueva alerta normativa',
          body: a.title,
          href: '/portal/alertas',
          urgent: a.impact_level === 'crítico' || a.impact_level === 'alto',
          time: new Date(a.published_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }),
        }))

      // Asuntos con vencimiento próximo
      matters
        .filter(m => m.client_id === CLIENT_ID && m.status === 'activo' && m.next_deadline && new Date(m.next_deadline).getTime() - NOW < DAYS7 && new Date(m.next_deadline).getTime() > NOW)
        .slice(0, 2)
        .forEach(m => notifs.push({
          id: `matter-${m.id}`,
          icon: Scale,
          iconColor: 'text-orange-600 bg-orange-50',
          title: 'Asunto con vencimiento',
          body: m.title,
          href: '/portal/asuntos',
          urgent: true,
          time: new Date(m.next_deadline!).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }),
        }))

      // Documentos nuevos o aprobados
      documents
        .filter(d => d.client_id === CLIENT_ID && (d.status === 'aprobado' || d.status === 'revisado'))
        .slice(0, 2)
        .forEach(d => notifs.push({
          id: `doc-${d.id}`,
          icon: FileText,
          iconColor: 'text-green-600 bg-green-50',
          title: 'Documento disponible',
          body: d.name,
          href: '/portal/documentos',
          time: new Date(d.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }),
        }))
    }

    // Sort: urgent first, then by insertion order
    return notifs.sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0))
  }, [role, alerts, matters, legalNotes, hrTickets, documents])
}

export function NotificationsBell() {
  const { currentRole } = useRoleStore()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const panelRef = useRef<HTMLDivElement>(null)

  const notifications = useNotifications(currentRole)
  const unread = notifications.filter(n => !readIds.has(n.id))

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Reset unread when role changes
  useEffect(() => { setReadIds(new Set()) }, [currentRole])

  function markAllRead() {
    setReadIds(new Set(notifications.map(n => n.id)))
  }

  function handleClick(notif: Notification) {
    setReadIds(prev => new Set([...prev, notif.id]))
    setOpen(false)
    router.push(notif.href)
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        title="Notificaciones"
        onClick={() => setOpen(v => !v)}
        className="relative w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
      >
        <Bell className={`w-4 h-4 ${open ? 'text-brand-navy' : 'text-muted-foreground'}`} />
        {unread.length > 0 && (
          <span className="absolute top-1 right-1 min-w-[14px] h-[14px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">Notificaciones</p>
              {unread.length > 0 && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                  {unread.length} nuevas
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unread.length > 0 && (
                <button type="button" onClick={markAllRead} className="text-[10px] text-brand-navy hover:underline font-medium">
                  Marcar todas
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-border">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Todo al día</p>
                <p className="text-xs text-muted-foreground mt-0.5">No hay notificaciones pendientes</p>
              </div>
            ) : (
              notifications.map(notif => {
                const Icon = notif.icon
                const isUnread = !readIds.has(notif.id)
                return (
                  <button
                    key={notif.id}
                    type="button"
                    onClick={() => handleClick(notif)}
                    className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors ${isUnread ? 'bg-blue-50/40' : ''}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${notif.iconColor}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-[11px] font-semibold leading-none ${notif.urgent ? 'text-red-700' : 'text-foreground'}`}>
                          {notif.title}
                          {notif.urgent && <span className="ml-1 text-[9px] bg-red-100 text-red-600 px-1 py-0.5 rounded font-bold">URGENTE</span>}
                        </p>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">{notif.time}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-snug">{notif.body}</p>
                    </div>
                    {isUnread && <div className="w-1.5 h-1.5 rounded-full bg-brand-navy flex-shrink-0 mt-2" />}
                  </button>
                )
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-border bg-muted/30">
              <p className="text-[10px] text-muted-foreground text-center">
                {notifications.length} notificación{notifications.length !== 1 ? 'es' : ''} · basadas en datos en tiempo real
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
