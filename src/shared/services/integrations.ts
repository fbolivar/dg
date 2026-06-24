// Captura externa (correo + calendario) vía Google/Microsoft — SOLO SERVIDOR.
// Convierte reuniones y correos enviados en "huella" para la captura inteligente.
import * as raw from '@/shared/services/db-raw'
import type { FootprintItem } from '@/shared/services/db-raw'
import { refreshAccess, type OAuthProvider } from '@/shared/lib/oauth'

/** Devuelve un access token válido (refresca si está por expirar). */
async function getValidAccessToken(userId: string, provider: OAuthProvider): Promise<string | null> {
  const t = await raw.getIntegrationTokens(userId, provider)
  if (!t) return null
  const stillValid = t.access_token && t.token_expiry && new Date(t.token_expiry).getTime() > Date.now() + 30_000
  if (stillValid) return t.access_token
  if (!t.refresh_token) return t.access_token
  const refreshed = await refreshAccess(provider, t.refresh_token)
  if (!refreshed?.access_token) return null
  const expiry = new Date(Date.now() + (refreshed.expires_in - 60) * 1000).toISOString()
  await raw.updateIntegrationAccess(userId, provider, refreshed.access_token, expiry)
  return refreshed.access_token
}

const minutesBetween = (a?: string, b?: string) => {
  if (!a || !b) return undefined
  const m = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)
  return m > 0 && m < 1440 ? m : undefined
}

// ── Google (Calendar + Gmail) ──
async function googleFootprint(userId: string, sinceISO: string): Promise<FootprintItem[]> {
  const token = await getValidAccessToken(userId, 'google')
  if (!token) return []
  const auth = { Authorization: `Bearer ${token}` }
  const out: FootprintItem[] = []

  // Calendario
  try {
    const u = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events')
    u.searchParams.set('timeMin', sinceISO)
    u.searchParams.set('timeMax', new Date().toISOString())
    u.searchParams.set('singleEvents', 'true')
    u.searchParams.set('orderBy', 'startTime')
    u.searchParams.set('maxResults', '50')
    const r = await fetch(u.toString(), { headers: auth })
    if (r.ok) {
      const d = await r.json()
      for (const ev of (d.items ?? []) as Record<string, unknown>[]) {
        const start = (ev.start as { dateTime?: string })?.dateTime
        const end = (ev.end as { dateTime?: string })?.dateTime
        if (!start) continue
        const summary = String(ev.summary ?? 'Reunión')
        const attendees = ((ev.attendees as { email?: string }[]) ?? []).map(a => a.email).filter(Boolean).slice(0, 5).join(', ')
        out.push({
          source: 'calendario', source_kind: 'reunion', source_ref: `g_${String(ev.id)}`, occurred_at: start,
          title: `Reunión: ${summary}`,
          context: `Reunión de calendario "${summary}"${attendees ? ` con ${attendees}` : ''}${ev.description ? `. ${String(ev.description).slice(0, 200)}` : ''}.`,
          billable: true, minutes: minutesBetween(start, end),
        })
      }
    }
  } catch { /* noop */ }

  // Correos enviados (metadatos)
  try {
    const after = Math.floor(new Date(sinceISO).getTime() / 1000)
    const list = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=in:sent after:${after}&maxResults=15`, { headers: auth })
    if (list.ok) {
      const ld = await list.json()
      for (const m of (ld.messages ?? []) as { id: string }[]) {
        const mr = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=To&metadataHeaders=Date`, { headers: auth })
        if (!mr.ok) continue
        const md = await mr.json()
        const headers = (md.payload?.headers ?? []) as { name: string; value: string }[]
        const h = (n: string) => headers.find(x => x.name === n)?.value ?? ''
        const subject = h('Subject') || '(sin asunto)'
        const occurred = md.internalDate ? new Date(Number(md.internalDate)).toISOString() : new Date().toISOString()
        out.push({
          source: 'correo', source_kind: 'correo', source_ref: `g_${m.id}`, occurred_at: occurred,
          title: `Correo: ${subject}`,
          context: `Envió un correo electrónico con asunto "${subject}"${h('To') ? ` a ${h('To')}` : ''}.`,
          billable: true,
        })
      }
    }
  } catch { /* noop */ }

  return out
}

// ── Microsoft (Outlook Calendar + Mail) vía Graph ──
async function microsoftFootprint(userId: string, sinceISO: string): Promise<FootprintItem[]> {
  const token = await getValidAccessToken(userId, 'microsoft')
  if (!token) return []
  const auth = { Authorization: `Bearer ${token}` }
  const out: FootprintItem[] = []

  // Calendario
  try {
    const u = new URL('https://graph.microsoft.com/v1.0/me/calendarView')
    u.searchParams.set('startDateTime', sinceISO)
    u.searchParams.set('endDateTime', new Date().toISOString())
    u.searchParams.set('$select', 'subject,start,end,attendees,bodyPreview')
    u.searchParams.set('$top', '50')
    const r = await fetch(u.toString(), { headers: { ...auth, Prefer: 'outlook.timezone="UTC"' } })
    if (r.ok) {
      const d = await r.json()
      for (const ev of (d.value ?? []) as Record<string, unknown>[]) {
        const start = (ev.start as { dateTime?: string })?.dateTime
        const end = (ev.end as { dateTime?: string })?.dateTime
        if (!start) continue
        const subject = String(ev.subject ?? 'Reunión')
        const attendees = ((ev.attendees as { emailAddress?: { address?: string } }[]) ?? []).map(a => a.emailAddress?.address).filter(Boolean).slice(0, 5).join(', ')
        out.push({
          source: 'calendario', source_kind: 'reunion', source_ref: `m_${String(ev.id)}`, occurred_at: new Date(start + 'Z').toISOString(),
          title: `Reunión: ${subject}`,
          context: `Reunión de calendario "${subject}"${attendees ? ` con ${attendees}` : ''}${ev.bodyPreview ? `. ${String(ev.bodyPreview).slice(0, 200)}` : ''}.`,
          billable: true, minutes: minutesBetween(start, end),
        })
      }
    }
  } catch { /* noop */ }

  // Correos enviados
  try {
    const u = new URL('https://graph.microsoft.com/v1.0/me/mailFolders/sentitems/messages')
    u.searchParams.set('$filter', `sentDateTime ge ${sinceISO}`)
    u.searchParams.set('$select', 'subject,toRecipients,sentDateTime')
    u.searchParams.set('$top', '15')
    const r = await fetch(u.toString(), { headers: auth })
    if (r.ok) {
      const d = await r.json()
      for (const m of (d.value ?? []) as Record<string, unknown>[]) {
        const subject = String(m.subject ?? '(sin asunto)')
        const to = ((m.toRecipients as { emailAddress?: { address?: string } }[]) ?? []).map(x => x.emailAddress?.address).filter(Boolean).slice(0, 5).join(', ')
        out.push({
          source: 'correo', source_kind: 'correo', source_ref: `m_${String(m.id)}`, occurred_at: String(m.sentDateTime ?? new Date().toISOString()),
          title: `Correo: ${subject}`,
          context: `Envió un correo electrónico con asunto "${subject}"${to ? ` a ${to}` : ''}.`,
          billable: true,
        })
      }
    }
  } catch { /* noop */ }

  return out
}

/** Huella externa combinada de todas las integraciones conectadas del abogado. */
export async function fetchExternalFootprint(userId: string, sinceISO: string): Promise<FootprintItem[]> {
  const integrations = await raw.listUserIntegrations(userId)
  const out: FootprintItem[] = []
  for (const it of integrations) {
    if (it.provider === 'google') out.push(...await googleFootprint(userId, sinceISO))
    else if (it.provider === 'microsoft') out.push(...await microsoftFootprint(userId, sinceISO))
    await raw.setIntegrationLastSync(userId, it.provider, new Date().toISOString())
  }
  return out
}
