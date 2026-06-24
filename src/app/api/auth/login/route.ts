import { NextRequest, NextResponse } from 'next/server'
import { verifyCredentials, signSession, SESSION_COOKIE, SESSION_MAX_AGE } from '@/shared/lib/auth'

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

  const user = await verifyCredentials(email, password)
  if (!user) {
    return NextResponse.json({ error: 'Correo o contraseña incorrectos' }, { status: 401 })
  }

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
