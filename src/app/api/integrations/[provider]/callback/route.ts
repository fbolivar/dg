import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/shared/lib/auth'
import { exchangeCode, getAccountEmail } from '@/shared/lib/oauth'
import * as raw from '@/shared/services/db-raw'

// Callback OAuth: valida el `state`, intercambia el código por tokens y los guarda (cifrados).
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.redirect(new URL('/login', req.url))

  const { provider } = await params
  if (provider !== 'google' && provider !== 'microsoft') {
    return NextResponse.json({ error: 'Proveedor inválido' }, { status: 400 })
  }

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const cookieState = req.cookies.get(`oauth_state_${provider}`)?.value
  const back = (q: string) => NextResponse.redirect(new URL(`/perfil?${q}`, req.url))

  if (url.searchParams.get('error')) return back(`error=denegado`)
  if (!code || !state || !cookieState || state !== cookieState) return back('error=state')

  const tokens = await exchangeCode(provider, code)
  if (!tokens?.access_token) return back('error=token')

  const email = await getAccountEmail(provider, tokens.access_token)
  const tokenExpiry = new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString()
  await raw.upsertIntegration(session.id, provider, {
    account_email: email, access_token: tokens.access_token, refresh_token: tokens.refresh_token,
    token_expiry: tokenExpiry, scope: tokens.scope,
  })

  const res = back(`connected=${provider}`)
  res.cookies.delete(`oauth_state_${provider}`)
  return res
}
