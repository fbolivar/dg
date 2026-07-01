// Guards de sesión/rol compartidos por las acciones de servidor de db/.
// No es "use server" (no son acciones, son helpers internos del servidor).
import { getSession } from '@/shared/lib/auth'
import type { SessionUser } from '@/shared/types'

export async function requireSession(): Promise<SessionUser> {
  const s = await getSession()
  if (!s) throw new Error('No autenticado')
  return s
}

export function isStaff(role: SessionUser['role']): boolean {
  return role === 'admin' || role === 'socio' || role === 'asociado'
}

export async function requireStaff(): Promise<SessionUser> {
  const s = await requireSession()
  if (!isStaff(s.role)) throw new Error('No autorizado')
  return s
}

export function isManager(role: SessionUser['role']): boolean {
  return role === 'admin' || role === 'socio'
}

export async function requireManager(): Promise<SessionUser> {
  const s = await requireSession()
  if (!isManager(s.role)) throw new Error('No autorizado')
  return s
}

export async function requireDgatime(): Promise<SessionUser> {
  const s = await requireSession()
  if (!(isManager(s.role) || s.dgatime_enabled)) throw new Error('Sin acceso a DGA-Time')
  return s
}
