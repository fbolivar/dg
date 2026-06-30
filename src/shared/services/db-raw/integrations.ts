import { supabase, now } from './_shared'
import { encryptToken, decryptToken } from '@/shared/lib/crypto'
import type { UserIntegration } from '@/shared/types'

type OAuthProvider = 'google' | 'microsoft'
export type IntegrationTokens = { access_token: string | null; refresh_token: string | null; token_expiry?: string | null }

// ─── Integraciones OAuth (correo / calendario) ────────────────────────────────
export async function listUserIntegrations(userId: string): Promise<UserIntegration[]> {
  const { data } = await supabase.from('user_integrations')
    .select('user_id, provider, account_email, connected_at, last_sync').eq('user_id', userId)
  return (data ?? []) as UserIntegration[]
}

export async function getIntegrationTokens(userId: string, provider: OAuthProvider): Promise<IntegrationTokens | null> {
  const { data } = await supabase.from('user_integrations')
    .select('access_token, refresh_token, token_expiry').eq('user_id', userId).eq('provider', provider).maybeSingle()
  if (!data) return null
  const row = data as { access_token?: string; refresh_token?: string; token_expiry?: string }
  return { access_token: decryptToken(row.access_token), refresh_token: decryptToken(row.refresh_token), token_expiry: row.token_expiry ?? null }
}

export async function upsertIntegration(userId: string, provider: OAuthProvider, t: {
  account_email?: string | null; access_token: string; refresh_token?: string; token_expiry?: string; scope?: string
}): Promise<void> {
  const row: Record<string, unknown> = {
    user_id: userId, provider,
    account_email: t.account_email ?? null,
    access_token: encryptToken(t.access_token),
    token_expiry: t.token_expiry ?? null,
    scope: t.scope ?? null,
    connected_at: now(),
  }
  if (t.refresh_token) row.refresh_token = encryptToken(t.refresh_token)
  await supabase.from('user_integrations').upsert(row, { onConflict: 'user_id,provider' })
}

export async function updateIntegrationAccess(userId: string, provider: OAuthProvider, accessToken: string, tokenExpiry: string): Promise<void> {
  await supabase.from('user_integrations').update({ access_token: encryptToken(accessToken), token_expiry: tokenExpiry }).eq('user_id', userId).eq('provider', provider)
}

export async function setIntegrationLastSync(userId: string, provider: OAuthProvider, iso: string): Promise<void> {
  await supabase.from('user_integrations').update({ last_sync: iso }).eq('user_id', userId).eq('provider', provider)
}

export async function deleteIntegration(userId: string, provider: OAuthProvider): Promise<void> {
  await supabase.from('user_integrations').delete().eq('user_id', userId).eq('provider', provider)
}
