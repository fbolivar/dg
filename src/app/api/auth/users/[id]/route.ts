import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  verifySession, updateUser, removeUser, getUserRoleById,
  canAssignRole, canManageUserWithRole, MIN_PASSWORD_LENGTH, SESSION_COOKIE,
} from '@/shared/lib/auth'
import { logAudit } from '@/shared/services/db-raw'
import type { UserRole } from '@/shared/types'

const VALID_ROLES: UserRole[] = ['socio', 'asociado', 'cliente', 'admin']

async function requireManager() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const s = verifySession(token)
  if (!s) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  if (s.role !== 'admin' && s.role !== 'socio') return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
  return { session: s }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireManager()
  if (error || !session) return error ?? NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params

  // Reglas de privilegio: cargar el rol actual del objetivo.
  const targetRole = await getUserRoleById(id)
  if (!targetRole) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  // Solo un admin gestiona cuentas privilegiadas (socio/admin).
  if (!canManageUserWithRole(session.role, targetRole)) {
    return NextResponse.json({ error: 'No autorizado para gestionar esta cuenta' }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const updates: Record<string, unknown> = {}
  if (typeof body?.name === 'string') updates.name = body.name
  if (typeof body?.email === 'string') updates.email = body.email
  if (typeof body?.role === 'string') {
    const newRole = body.role as UserRole
    if (!VALID_ROLES.includes(newRole)) return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
    // Nadie cambia su propio rol (evita auto-escalación).
    if (id === session.id) return NextResponse.json({ error: 'No puedes cambiar tu propio rol' }, { status: 403 })
    // Solo un admin asigna roles privilegiados.
    if (!canAssignRole(session.role, newRole)) {
      return NextResponse.json({ error: 'Solo un administrador puede asignar el rol de socio o administrador' }, { status: 403 })
    }
    updates.role = newRole
  }
  if (typeof body?.client_id === 'string') updates.client_id = body.client_id
  if (typeof body?.is_active === 'boolean') updates.is_active = body.is_active
  if (typeof body?.dgatime_enabled === 'boolean') updates.dgatime_enabled = body.dgatime_enabled
  if (typeof body?.hourly_rate === 'number') updates.hourly_rate = body.hourly_rate
  if (typeof body?.cost_rate === 'number') updates.cost_rate = body.cost_rate
  if (body?.rate_currency === 'COP' || body?.rate_currency === 'USD') updates.rate_currency = body.rate_currency
  if (typeof body?.password === 'string' && body.password.length > 0) {
    if (body.password.length < MIN_PASSWORD_LENGTH) return NextResponse.json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` }, { status: 400 })
    updates.password = body.password
  }

  const user = await updateUser(id, updates)
  if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  await logAudit({ actor_id: session.id, actor_name: session.name, action: 'Usuario actualizado', entity: `${user.name} · ${user.email}` })
  return NextResponse.json({ user })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireManager()
  if (error || !session) return error ?? NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  // No permitir auto-eliminación.
  if (id === session.id) return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta' }, { status: 403 })
  // Solo un admin elimina cuentas privilegiadas (socio/admin).
  const targetRole = await getUserRoleById(id)
  if (!targetRole) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  if (!canManageUserWithRole(session.role, targetRole)) {
    return NextResponse.json({ error: 'No autorizado para eliminar esta cuenta' }, { status: 403 })
  }
  const ok = await removeUser(id)
  if (!ok) return NextResponse.json({ error: 'No se pudo eliminar (debe quedar al menos un administrador)' }, { status: 400 })
  await logAudit({ actor_id: session.id, actor_name: session.name, action: 'Usuario eliminado', entity: id })
  return NextResponse.json({ ok: true })
}
