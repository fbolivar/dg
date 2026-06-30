import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, listUsers, addUser, canAssignRole, MIN_PASSWORD_LENGTH, SESSION_COOKIE } from '@/shared/lib/auth'
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

export async function GET() {
  const { error } = await requireManager()
  if (error) return error
  return NextResponse.json({ users: await listUsers() })
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireManager()
  if (error || !session) return error ?? NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const name = typeof body?.name === 'string' ? body.name : ''
  const email = typeof body?.email === 'string' ? body.email : ''
  const role = typeof body?.role === 'string' ? body.role : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const client_id = typeof body?.client_id === 'string' ? body.client_id : undefined
  const is_active = typeof body?.is_active === 'boolean' ? body.is_active : true
  const dgatime_enabled = body?.dgatime_enabled === true
  const hourly_rate = typeof body?.hourly_rate === 'number' && body.hourly_rate >= 0 ? body.hourly_rate : undefined
  const cost_rate = typeof body?.cost_rate === 'number' && body.cost_rate >= 0 ? body.cost_rate : undefined
  const rate_currency = body?.rate_currency === 'USD' ? 'USD' : 'COP'

  if (!name || !email || !role || !password) {
    return NextResponse.json({ error: 'Faltan campos: nombre, correo, rol y contraseña' }, { status: 400 })
  }
  if (!VALID_ROLES.includes(role as UserRole)) {
    return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
  }
  // Solo un admin puede crear cuentas privilegiadas (socio/admin).
  if (!canAssignRole(session.role, role as UserRole)) {
    return NextResponse.json({ error: 'Solo un administrador puede crear cuentas de socio o administrador' }, { status: 403 })
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` }, { status: 400 })
  }

  const user = await addUser({ name, email, role: role as UserRole, client_id, is_active, password, dgatime_enabled, hourly_rate, cost_rate, rate_currency })
  if (!user) return NextResponse.json({ error: 'Ya existe un usuario con ese correo' }, { status: 409 })
  await logAudit({ actor_id: session.id, actor_name: session.name, action: 'Usuario creado', entity: `${user.name} · ${user.email}`, detail: `Rol: ${user.role}` })
  return NextResponse.json({ user })
}
