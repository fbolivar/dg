import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, listUsers, addUser, canAssignRole, SESSION_COOKIE } from '@/shared/lib/auth'
import { logAudit } from '@/shared/services/db-raw'
import { createUserSchema } from '@/shared/lib/validation'

async function requireManager() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const s = verifySession(token)
  if (!s) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  if (s.role !== 'admin' && s.role !== 'socio') return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
  return { session: s }
}

export async function GET() {
  const { error } = await requireManager()
  if (error) return error
  return NextResponse.json({ users: await listUsers() })
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireManager()
  if (error || !session) return error ?? NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })
  }
  const { name, email, role, password, client_id, is_active = true, dgatime_enabled = false, hourly_rate, cost_rate, rate_currency = 'COP' } = parsed.data

  // Solo un admin puede crear cuentas privilegiadas (socio/admin).
  if (!canAssignRole(session.role, role)) {
    return NextResponse.json({ error: 'Solo un administrador puede crear cuentas de socio o administrador' }, { status: 403 })
  }

  const user = await addUser({ name, email, role, client_id, is_active, password, dgatime_enabled, hourly_rate, cost_rate, rate_currency })
  if (!user) return NextResponse.json({ error: 'Ya existe un usuario con ese correo' }, { status: 409 })
  await logAudit({ actor_id: session.id, actor_name: session.name, action: 'Usuario creado', entity: `${user.name} · ${user.email}`, detail: `Rol: ${user.role}` })
  return NextResponse.json({ user })
}
