import { describe, it, expect, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'
import { checkCronAuth } from './cron'

// Construye un NextRequest mínimo con sólo el header Authorization.
function reqWith(auth: string | null): NextRequest {
  return {
    headers: { get: (k: string) => (k.toLowerCase() === 'authorization' ? auth : null) },
  } as unknown as NextRequest
}

describe('checkCronAuth (fail-closed + tiempo constante)', () => {
  beforeEach(() => { delete process.env.CRON_SECRET })

  it('sin CRON_SECRET configurado → 500 (no corre el job)', () => {
    const res = checkCronAuth(reqWith('Bearer lo-que-sea'))
    expect(res?.status).toBe(500)
  })

  it('header ausente o incorrecto → 401', () => {
    process.env.CRON_SECRET = 'super-secreto'
    expect(checkCronAuth(reqWith(null))?.status).toBe(401)
    expect(checkCronAuth(reqWith('Bearer otro'))?.status).toBe(401)
    expect(checkCronAuth(reqWith('super-secreto'))?.status).toBe(401) // falta "Bearer "
  })

  it('Bearer correcto → null (autorizado)', () => {
    process.env.CRON_SECRET = 'super-secreto'
    expect(checkCronAuth(reqWith('Bearer super-secreto'))).toBeNull()
  })
})
