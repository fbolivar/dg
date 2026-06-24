// Módulo server-only: solo debe importarse desde route handlers o server components.
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/shared/lib/supabase-admin'
import type { SessionUser, UserRole, DgaCurrency } from '@/shared/types'

/**
 * ─── AUTENTICACIÓN LOCAL (persistida en BD) ─────────────────────────────────
 * Directorio de usuarios en la tabla `users` de Supabase (sin Supabase Auth).
 * Las contraseñas se guardan con hash bcrypt en `users.password_hash`; la sesión
 * se firma con JWT (HS256) en cookie httpOnly. El acceso a la BD es server-only
 * con service role. Persistente y consistente entre instancias serverless.
 */

export interface AuthUser extends SessionUser {
  is_active: boolean
  hourly_rate?: number
  cost_rate?: number
  rate_currency?: DgaCurrency
}

type UserRow = {
  id: string
  email: string
  full_name: string
  role: UserRole
  client_id: string | null
  is_active: boolean
  dgatime_enabled?: boolean
  hourly_rate?: number | null
  cost_rate?: number | null
  rate_currency?: DgaCurrency
  password_hash?: string | null
}

const PUBLIC_COLS = 'id,email,full_name,role,client_id,is_active,dgatime_enabled,hourly_rate,cost_rate,rate_currency'

function rowToAuthUser(u: UserRow): AuthUser {
  return {
    id: u.id,
    email: u.email,
    name: u.full_name,
    role: u.role,
    client_id: u.client_id ?? undefined,
    is_active: u.is_active,
    dgatime_enabled: u.dgatime_enabled ?? false,
    hourly_rate: u.hourly_rate ?? undefined,
    cost_rate: u.cost_rate ?? undefined,
    rate_currency: u.rate_currency ?? 'COP',
  }
}

// Fail-closed: en producción exige JWT_SECRET; en dev usa un fallback solo local.
function getSecret(): string {
  const s = process.env.JWT_SECRET
  if (!s) {
    if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET es obligatorio en producción')
    return 'dev-insecure-secret-CHANGE-ME'
  }
  return s
}
export const SESSION_COOKIE = 'dga_session'
export const SESSION_MAX_AGE = 60 * 60 * 8 // 8 horas

// ─── Directorio de usuarios (tabla `users`) ──────────────────────────────────
export async function listUsers(): Promise<AuthUser[]> {
  const { data } = await supabaseAdmin.from('users').select(PUBLIC_COLS).order('full_name')
  return ((data ?? []) as UserRow[]).map(rowToAuthUser)
}

export async function addUser(data: {
  name: string; email: string; role: UserRole; client_id?: string; is_active?: boolean; password: string
  dgatime_enabled?: boolean; hourly_rate?: number; cost_rate?: number; rate_currency?: DgaCurrency
}): Promise<AuthUser | null> {
  const email = data.email.trim().toLowerCase()
  const { data: existing } = await supabaseAdmin.from('users').select('id').eq('email', email).maybeSingle()
  if (existing) return null // correo duplicado
  const row = {
    id: `u${Date.now()}`,
    email,
    full_name: data.name.trim(),
    role: data.role,
    client_id: data.role === 'cliente' ? (data.client_id ?? null) : null,
    is_active: data.is_active ?? true,
    dgatime_enabled: data.dgatime_enabled ?? false,
    hourly_rate: data.hourly_rate ?? null,
    cost_rate: data.cost_rate ?? null,
    rate_currency: data.rate_currency ?? 'COP',
    password_hash: bcrypt.hashSync(data.password, 10),
  }
  const { data: created, error } = await supabaseAdmin.from('users').insert(row).select(PUBLIC_COLS).single()
  if (error || !created) return null
  return rowToAuthUser(created as UserRow)
}

export async function updateUser(
  id: string,
  data: Partial<{
    name: string; email: string; role: UserRole; client_id?: string; is_active: boolean; password: string
    dgatime_enabled: boolean; hourly_rate: number | null; cost_rate: number | null; rate_currency: DgaCurrency
  }>
): Promise<AuthUser | null> {
  const patch: Record<string, unknown> = {}
  if (data.name !== undefined) patch.full_name = data.name.trim()
  if (data.email !== undefined) patch.email = data.email.trim().toLowerCase()
  if (data.role !== undefined) {
    patch.role = data.role
    patch.client_id = data.role === 'cliente' ? (data.client_id ?? null) : null
  } else if (data.client_id !== undefined) {
    patch.client_id = data.client_id
  }
  if (data.is_active !== undefined) patch.is_active = data.is_active
  if (data.dgatime_enabled !== undefined) patch.dgatime_enabled = data.dgatime_enabled
  if (data.hourly_rate !== undefined) patch.hourly_rate = data.hourly_rate
  if (data.cost_rate !== undefined) patch.cost_rate = data.cost_rate
  if (data.rate_currency !== undefined) patch.rate_currency = data.rate_currency
  if (data.password) patch.password_hash = bcrypt.hashSync(data.password, 10)
  const { data: updated } = await supabaseAdmin.from('users').update(patch).eq('id', id).select(PUBLIC_COLS).single()
  return updated ? rowToAuthUser(updated as UserRow) : null
}

export async function removeUser(id: string): Promise<boolean> {
  // No permitir borrar el último administrador.
  const { data: target } = await supabaseAdmin.from('users').select('role').eq('id', id).maybeSingle()
  if (!target) return false
  if ((target as { role: UserRole }).role === 'admin') {
    const { count } = await supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).eq('role', 'admin')
    if ((count ?? 0) <= 1) return false
  }
  const { error } = await supabaseAdmin.from('users').delete().eq('id', id)
  return !error
}

// ─── Sesión ──────────────────────────────────────────────────────────────────
export async function verifyCredentials(email: string, password: string): Promise<SessionUser | null> {
  const { data: u } = await supabaseAdmin
    .from('users')
    .select('id,email,full_name,role,client_id,is_active,dgatime_enabled,password_hash')
    .eq('email', email.trim().toLowerCase())
    .eq('is_active', true)
    .maybeSingle()
  const row = u as UserRow | null
  if (!row || !row.password_hash) return null
  const ok = await bcrypt.compare(password, row.password_hash)
  if (!ok) return null
  return {
    id: row.id, email: row.email, name: row.full_name, role: row.role,
    client_id: row.client_id ?? undefined, dgatime_enabled: row.dgatime_enabled ?? false,
  }
}

export function signSession(user: SessionUser): string {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role, client_id: user.client_id, dgatime_enabled: user.dgatime_enabled ?? false },
    getSecret(),
    { expiresIn: SESSION_MAX_AGE }
  )
}

const VALID_ROLES: UserRole[] = ['socio', 'asociado', 'cliente', 'admin']

export function verifySession(token?: string | null): SessionUser | null {
  if (!token) return null
  try {
    const d = jwt.verify(token, getSecret()) as Record<string, unknown>
    if (!VALID_ROLES.includes(d.role as UserRole)) return null
    if (!d.id || !d.email || !d.role) return null
    return {
      id: String(d.id),
      email: String(d.email),
      name: String(d.name ?? ''),
      role: d.role as SessionUser['role'],
      client_id: d.client_id ? String(d.client_id) : undefined,
      dgatime_enabled: d.dgatime_enabled === true,
    }
  } catch {
    return null
  }
}

/** Lee la sesión desde la cookie de la petición. Para usar en route handlers. */
export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  return verifySession(token)
}
