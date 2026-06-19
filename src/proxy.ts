import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ─── Límite de tasa para las rutas /api/* ────────────────────────────────────
// Ventana fija en memoria por IP. Protege los endpoints de IA (que consumen la
// API key de Anthropic y cuestan dinero) contra abuso, fuerza bruta y DoS básico.
// Nota: el estado vive en memoria del proceso; para escalar a múltiples
// instancias en producción se usaría un store compartido (Upstash/Redis).
// (En Next.js 16 este archivo se llama `proxy.ts`, antes `middleware.ts`.)
const WINDOW_MS = 60_000 // 1 minuto
const MAX_REQUESTS = 20  // máx. peticiones por IP por ventana

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

function rateLimit(ip: string): { ok: boolean; retryAfter: number } {
  const now = Date.now()
  const bucket = buckets.get(ip)

  if (!bucket || now > bucket.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return { ok: true, retryAfter: 0 }
  }

  bucket.count += 1
  if (bucket.count > MAX_REQUESTS) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) }
  }
  return { ok: true, retryAfter: 0 }
}

// Limpieza periódica para que el Map no crezca sin límite.
function sweep() {
  const now = Date.now()
  for (const [ip, b] of buckets) {
    if (now > b.resetAt) buckets.delete(ip)
  }
}

export function proxy(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'

  if (buckets.size > 5000) sweep()

  const { ok, retryAfter } = rateLimit(ip)
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
