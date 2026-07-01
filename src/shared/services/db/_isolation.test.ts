import { describe, it, expect } from 'vitest'
import { filterByClient, filterAlertsByClient } from './_isolation'
import type { SessionUser } from '@/shared/types'

const session = (role: SessionUser['role'], client_id?: string): SessionUser => ({
  id: 'u1', email: 'x@y.com', name: 'X', role, client_id, dgatime_enabled: false,
})

const rows = [
  { client_id: 'cl1', v: 'a' },
  { client_id: 'cl2', v: 'b' },
  { client_id: null, v: 'interno' }, // fila sin cliente (columna FK nullable)
]

describe('filterByClient — aislamiento multi-tenant', () => {
  it('el staff ve todas las filas', () => {
    for (const role of ['admin', 'socio', 'asociado'] as const) {
      expect(filterByClient(session(role), rows)).toHaveLength(3)
    }
  })

  it('un cliente solo ve las filas de su client_id', () => {
    const out = filterByClient(session('cliente', 'cl1'), rows)
    expect(out).toEqual([{ client_id: 'cl1', v: 'a' }])
  })

  it('un cliente NUNCA ve filas con client_id null aunque tenga id', () => {
    const out = filterByClient(session('cliente', 'cl2'), rows)
    expect(out.some(r => r.client_id === null)).toBe(false)
  })

  it('un cliente SIN client_id no ve nada (fix colisión null===undefined)', () => {
    expect(filterByClient(session('cliente', undefined), rows)).toEqual([])
  })
})

describe('filterAlertsByClient — membresía por clients_affected', () => {
  const alerts = [
    { clients_affected: ['cl1', 'cl3'], t: 'a' },
    { clients_affected: ['cl2'], t: 'b' },
    { clients_affected: null, t: 'sin' },
  ]

  it('el staff ve todas', () => {
    expect(filterAlertsByClient(session('admin'), alerts)).toHaveLength(3)
  })

  it('un cliente ve solo donde está incluido', () => {
    expect(filterAlertsByClient(session('cliente', 'cl1'), alerts)).toEqual([{ clients_affected: ['cl1', 'cl3'], t: 'a' }])
  })

  it('un cliente sin client_id no ve nada', () => {
    expect(filterAlertsByClient(session('cliente', undefined), alerts)).toEqual([])
  })
})
