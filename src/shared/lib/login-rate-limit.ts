// ─── Límite de intentos de login (anti fuerza bruta) ─────────────────────────
// Cuenta intentos FALLIDOS por (IP + correo) y bloquea tras MAX_FAILED en la
// ventana. Complementa el límite por IP genérico de `src/proxy.ts`.
//
// Producción: Vercel KV (Upstash REST) → estado compartido entre instancias
// serverless, no evadible reiniciando el proceso. Sin KV cae a memoria local
// (suficiente en desarrollo; en serverless es best-effort por instancia).
// SOLO SERVIDOR.
const WINDOW_S = 15 * 60 // 15 minutos
const MAX_FAILED = 5

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

const keyFor = (id: string) => `login_fail:${encodeURIComponent(id)}`

// ── Respaldo en memoria (desarrollo / sin KV) ──
type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

function memStatus(id: string): { blocked: boolean; retryAfter: number } {
  const b = buckets.get(id)
  if (!b || Date.now() > b.resetAt) return { blocked: false, retryAfter: 0 }
  if (b.count >= MAX_FAILED) return { blocked: true, retryAfter: Math.ceil((b.resetAt - Date.now()) / 1000) }
  return { blocked: false, retryAfter: 0 }
}

/** ¿Está bloqueado este (ip+correo) por exceso de intentos fallidos? */
export async function isLoginBlocked(id: string): Promise<{ blocked: boolean; retryAfter: number }> {
  if (KV_ENABLED) {
    try {
      const { result } = await kvCmd(`get/${keyFor(id)}`)
      const count = Number(result ?? 0)
      if (count < MAX_FAILED) return { blocked: false, retryAfter: 0 }
      const ttl = await kvCmd(`ttl/${keyFor(id)}`)
      const retryAfter = Math.max(1, Number(ttl.result ?? WINDOW_S))
      return { blocked: true, retryAfter }
    } catch {
      return memStatus(id)
    }
  }
  return memStatus(id)
}

/** Registra un intento fallido y arranca/mantiene la ventana. */
export async function registerFailedLogin(id: string): Promise<void> {
  if (KV_ENABLED) {
    try {
      const { result } = await kvCmd(`incr/${keyFor(id)}`)
      if (Number(result) === 1) await kvCmd(`expire/${keyFor(id)}/${WINDOW_S}`)
      return
    } catch {
      // cae al respaldo en memoria
    }
  }
  const now = Date.now()
  const b = buckets.get(id)
  if (!b || now > b.resetAt) buckets.set(id, { count: 1, resetAt: now + WINDOW_S * 1000 })
  else b.count += 1
}

/** Limpia el contador tras un login exitoso. */
export async function clearLoginAttempts(id: string): Promise<void> {
  if (KV_ENABLED) {
    try {
      await kvCmd(`del/${keyFor(id)}`)
      return
    } catch {
      // cae al respaldo en memoria
    }
  }
  buckets.delete(id)
}
