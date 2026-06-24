import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ─── Límite de tasa para las rutas /api/* ────────────────────────────────────
// Protege los endpoints de IA (que consumen la API key de Anthropic) y el login
// contra abuso, fuerza bruta y DoS básico.
//
// Producción: usa Vercel KV (Upstash REST) → estado compartido entre instancias
// serverless, no evadible reiniciando el proceso. Si KV no está configurado
// (p. ej. en desarrollo local), cae a un contador en memoria.
// (En Next.js 16 este archivo se llama `proxy.ts`, antes `middleware.ts`.)
const WINDOW_S = 60        // ventana de 1 minuto
const MAX_REQUESTS = 20    // máx. peticiones por IP por ventana

// ── Vercel KV / Upstash (REST) ──
const KV_URL = process.env.KV_REST_API_URL
const KV_TOKEN = process.env.KV_REST_API_TOKEN
const KV_ENABLED = !!(KV_URL && KV_TOKEN)

async function kvCmd(path: string): Promise<{ result: number | string | null }> {
  const r = await fetch(`${KV_URL}/${path}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    cache: 'no-store',
  })
  if (!r.ok) throw new Error(`KV ${r.status}`)
  return r.json()
}

async function rateLimitKV(ip: string): Promise<{ ok: boolean; retryAfter: number }> {
  const key = `rl:${encodeURIComponent(ip)}`
  const { result } = await kvCmd(`incr/${key}`)
  const count = Number(result)
  if (count === 1) await kvCmd(`expire/${key}/${WINDOW_S}`) // primera petición: arranca la ventana
  if (count > MAX_REQUESTS) return { ok: false, retryAfter: WINDOW_S }
  return { ok: true, retryAfter: 0 }
}

// ── Respaldo en memoria (desarrollo / sin KV) ──
type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

function rateLimitMemory(ip: string): { ok: boolean; retryAfter: number } {
  const now = Date.now()
  const bucket = buckets.get(ip)
  if (!bucket || now > bucket.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_S * 1000 })
    return { ok: true, retryAfter: 0 }
  }
  bucket.count += 1
  if (bucket.count > MAX_REQUESTS) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) }
  }
  return { ok: true, retryAfter: 0 }
}

function sweep() {
  const now = Date.now()
  for (const [ip, b] of buckets) if (now > b.resetAt) buckets.delete(ip)
}

async function limit(ip: string): Promise<{ ok: boolean; retryAfter: number }> {
  if (KV_ENABLED) {
    try {
      return await rateLimitKV(ip)
    } catch {
      // Si KV falla puntualmente, no tumbar el servicio: cae al respaldo en memoria.
      return rateLimitMemory(ip)
    }
  }
  return rateLimitMemory(ip)
}

export async function proxy(request: NextRequest) {
  // IP confiable de Vercel primero (no falsificable por el cliente), luego respaldos.
  const ip =
    request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'

  if (!KV_ENABLED && buckets.size > 5000) sweep()

  const { ok, retryAfter } = await limit(ip)
  if (!ok) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes. Intente de nuevo en un momento.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  return NextResponse.next()
}

export const config = {
  // Solo aplica a las rutas de API.
  matcher: ['/api/:path*'],
}
