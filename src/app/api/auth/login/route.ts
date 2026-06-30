import { NextRequest, NextResponse } from 'next/server'
import { verifyCredentials, signSession, SESSION_COOKIE, SESSION_MAX_AGE } from '@/shared/lib/auth'
import { isLoginBlocked, registerFailedLogin, clearLoginAttempts } from '@/shared/lib/login-rate-limit'

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }
  const email = typeof (body as { email?: unknown })?.email === 'string' ? (body as { email: string }).email : ''
  const password = typeof (body as { password?: unknown })?.password === 'string' ? (body as { password: string }).password : ''
  if (!email || !password) {
    return NextResponse.json({ error: 'Ingresa correo y contraseña' }, { status: 400 })
  }

  // Anti fuerza bruta: límite de intentos fallidos por (IP + correo).
  const rlId = `${clientIp(req)}:${email.trim().toLowerCase()}`
  const { blocked, retryAfter } = await isLoginBlocked(rlId)
  if (blocked) {
    return NextResponse.json(
      { error: 'Demasiados intentos fallidos. Intenta de nuevo más tarde.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  const user = await verifyCredentials(email, password)
  if (!user) {
    await registerFailedLogin(rlId)
    return NextResponse.json({ error: 'Correo o contraseña incorrectos' }, { status: 401 })
  }

  await clearLoginAttempts(rlId)
  const token = signSession(user)
  const res = NextResponse.json({ user })
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  return res
}
