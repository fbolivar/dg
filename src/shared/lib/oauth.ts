// Configuración OAuth de Google y Microsoft — SOLO SERVIDOR.
// Captura de correo (enviados) y calendario para la captura inteligente.
import { tokenEncryptionReady } from '@/shared/lib/crypto'

export type OAuthProvider = 'google' | 'microsoft'

export type TokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
}

const site = () => process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
const msTenant = () => process.env.MICROSOFT_TENANT || 'common'

const GOOGLE_SCOPES = [
  'openid', 'email',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
]
const MS_SCOPES = ['openid', 'email', 'offline_access', 'User.Read', 'Calendars.Read', 'Mail.Read']

export function googleRedirectUri() { return `${site()}/api/integrations/google/callback` }
export function microsoftRedirectUri() { return `${site()}/api/integrations/microsoft/callback` }

export function providerConfigured(p: OAuthProvider): boolean {
  if (!tokenEncryptionReady()) return false
  return p === 'google'
    ? !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
    : !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET)
}

export function buildAuthUrl(provider: OAuthProvider, state: string): string {
  if (provider === 'google') {
    const p = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      redirect_uri: googleRedirectUri(),
      response_type: 'code',
      scope: GOOGLE_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    })
    return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`
  }
  const p = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID || '',
    redirect_uri: microsoftRedirectUri(),
    response_type: 'code',
    scope: MS_SCOPES.join(' '),
    response_mode: 'query',
    state,
  })
  return `https://login.microsoftonline.com/${msTenant()}/oauth2/v2.0/authorize?${p.toString()}`
}

async function postToken(url: string, body: Record<string, string>): Promise<TokenResponse | null> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body).toString(),
    })
    if (!res.ok) return null
    return await res.json() as TokenResponse
  } catch {
    return null
  }
}

export async function exchangeCode(provider: OAuthProvider, code: string): Promise<TokenResponse | null> {
  if (provider === 'google') {
    return postToken('https://oauth2.googleapis.com/token', {
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      code, grant_type: 'authorization_code', redirect_uri: googleRedirectUri(),
    })
  }
  return postToken(`https://login.microsoftonline.com/${msTenant()}/oauth2/v2.0/token`, {
    client_id: process.env.MICROSOFT_CLIENT_ID || '',
    client_secret: process.env.MICROSOFT_CLIENT_SECRET || '',
    code, grant_type: 'authorization_code', redirect_uri: microsoftRedirectUri(),
    scope: MS_SCOPES.join(' '),
  })
}

export async function refreshAccess(provider: OAuthProvider, refreshToken: string): Promise<TokenResponse | null> {
  if (provider === 'google') {
    return postToken('https://oauth2.googleapis.com/token', {
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      refresh_token: refreshToken, grant_type: 'refresh_token',
    })
  }
  return postToken(`https://login.microsoftonline.com/${msTenant()}/oauth2/v2.0/token`, {
    client_id: process.env.MICROSOFT_CLIENT_ID || '',
    client_secret: process.env.MICROSOFT_CLIENT_SECRET || '',
    refresh_token: refreshToken, grant_type: 'refresh_token',
    scope: MS_SCOPES.join(' '),
  })
}

/** Obtiene el correo de la cuenta conectada (para mostrarlo en la UI). */
export async function getAccountEmail(provider: OAuthProvider, accessToken: string): Promise<string | null> {
  try {
    if (provider === 'google') {
      const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } })
      if (!r.ok) return null
      const d = await r.json()
      return typeof d.email === 'string' ? d.email : null
    }
    const r = await fetch('https://graph.microsoft.com/v1.0/me', { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!r.ok) return null
    const d = await r.json()
    return (d.mail || d.userPrincipalName || null) as string | null
  } catch {
    return null
  }
}
