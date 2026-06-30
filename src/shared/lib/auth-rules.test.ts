import { describe, it, expect } from 'vitest'
import { isPrivilegedRole, canAssignRole, canManageUserWithRole } from './auth-rules'
import type { UserRole } from '@/shared/types'

const ALL: UserRole[] = ['socio', 'asociado', 'cliente', 'admin']

describe('isPrivilegedRole', () => {
  it('marca admin y socio como privilegiados', () => {
    expect(isPrivilegedRole('admin')).toBe(true)
    expect(isPrivilegedRole('socio')).toBe(true)
  })
  it('asociado y cliente no son privilegiados', () => {
    expect(isPrivilegedRole('asociado')).toBe(false)
    expect(isPrivilegedRole('cliente')).toBe(false)
  })
})

describe('canAssignRole — solo admin asigna roles privilegiados', () => {
  it('un admin puede asignar cualquier rol', () => {
    for (const r of ALL) expect(canAssignRole('admin', r)).toBe(true)
  })
  it('un socio NO puede crear/asignar admin ni socio (anti escalación)', () => {
    expect(canAssignRole('socio', 'admin')).toBe(false)
    expect(canAssignRole('socio', 'socio')).toBe(false)
  })
  it('un socio sí puede asignar asociado y cliente', () => {
    expect(canAssignRole('socio', 'asociado')).toBe(true)
    expect(canAssignRole('socio', 'cliente')).toBe(true)
  })
})

describe('canManageUserWithRole — solo admin gestiona cuentas privilegiadas', () => {
  it('un socio NO puede gestionar a otro socio ni a un admin', () => {
    expect(canManageUserWithRole('socio', 'socio')).toBe(false)
    expect(canManageUserWithRole('socio', 'admin')).toBe(false)
  })
  it('un socio sí puede gestionar asociado/cliente', () => {
    expect(canManageUserWithRole('socio', 'asociado')).toBe(true)
    expect(canManageUserWithRole('socio', 'cliente')).toBe(true)
  })
  it('un admin puede gestionar cualquier cuenta', () => {
    for (const r of ALL) expect(canManageUserWithRole('admin', r)).toBe(true)
  })
})
