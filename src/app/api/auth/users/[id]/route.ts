import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  verifySession, updateUser, removeUser, getUserRoleById,
  canAssignRole, canManageUserWithRole, SESSION_COOKIE,
} from '@/shared/lib/auth'
import { logAudit } from '@/shared/services/db-raw'
import { updateUserSchema } from '@/shared/lib/validation'

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

  const body = await req.json().catch(() => null)
  const parsed = updateUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })
  }
  const d = parsed.data
  const updates: Record<string, unknown> = {}
  if (d.name !== undefined) updates.name = d.name
  if (d.email !== undefined) updates.email = d.email
  if (d.role !== undefined) {
    // Nadie cambia su propio rol (evita auto-escalación).
    if (id === session.id) return NextResponse.json({ error: 'No puedes cambiar tu propio rol' }, { status: 403 })
    // Solo un admin asigna roles privilegiados.
    if (!canAssignRole(session.role, d.role)) {
      return NextResponse.json({ error: 'Solo un administrador puede asignar el rol de socio o administrador' }, { status: 403 })
    }
    updates.role = d.role
  }
  if (d.client_id !== undefined) updates.client_id = d.client_id
  if (d.is_active !== undefined) updates.is_active = d.is_active
  if (d.dgatime_enabled !== undefined) updates.dgatime_enabled = d.dgatime_enabled
  if (d.hourly_rate !== undefined) updates.hourly_rate = d.hourly_rate
  if (d.cost_rate !== undefined) updates.cost_rate = d.cost_rate
  if (d.rate_currency !== undefined) updates.rate_currency = d.rate_currency
  if (d.password) updates.password = d.password

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
