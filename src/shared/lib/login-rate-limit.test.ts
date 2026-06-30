import { describe, it, expect } from 'vitest'
import { isLoginBlocked, registerFailedLogin, clearLoginAttempts } from './login-rate-limit'

// Sin KV configurado en el entorno de test, usa el respaldo en memoria.
describe('login-rate-limit (respaldo en memoria)', () => {
  it('bloquea tras 5 intentos fallidos y se reinicia al limpiar', async () => {
    const id = 'ip-1.2.3.4:victima@dga.com'

    // Antes de fallar, no está bloqueado.
    expect((await isLoginBlocked(id)).blocked).toBe(false)

    // 5 fallos: el 5º alcanza el máximo.
    for (let i = 0; i < 5; i++) await registerFailedLogin(id)

    const status = await isLoginBlocked(id)
    expect(status.blocked).toBe(true)
    expect(status.retryAfter).toBeGreaterThan(0)

    // Un login exitoso limpia el contador.
    await clearLoginAttempts(id)
    expect((await isLoginBlocked(id)).blocked).toBe(false)
  })

  it('cuenta por clave (IP+correo) de forma independiente', async () => {
    const a = 'ip-a:correo-a'
    const b = 'ip-b:correo-b'
    for (let i = 0; i < 5; i++) await registerFailedLogin(a)
    expect((await isLoginBlocked(a)).blocked).toBe(true)
    expect((await isLoginBlocked(b)).blocked).toBe(false)
    await clearLoginAttempts(a)
  })
})
