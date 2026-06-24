import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { getSession } from '@/shared/lib/auth'
import { buildAuthUrl, providerConfigured } from '@/shared/lib/oauth'

// Inicia el flujo OAuth: genera un `state` anti-CSRF y redirige al consentimiento.
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.redirect(new URL('/login', req.url))

  const { provider } = await params
  if (provider !== 'google' && provider !== 'microsoft') {
    return NextResponse.json({ error: 'Proveedor inválido' }, { status: 400 })
  }
  if (!providerConfigured(provider)) {
    return NextResponse.redirect(new URL('/perfil?error=no_configurado', req.url))
  }

  const state = randomBytes(16).toString('hex')
  const res = NextResponse.redirect(buildAuthUrl(provider, state))
  res.cookies.set(`oauth_state_${provider}`, state, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 600, path: '/',
  })
  return res
}
