import { describe, it, expect } from 'vitest'
import { loginSchema, createUserSchema, radicacionSchema, copilotSchema } from './validation'
import { MIN_PASSWORD_LENGTH } from './auth-constants'

describe('loginSchema', () => {
  it('acepta credenciales válidas', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true)
  })
  it('rechaza correo inválido o sin contraseña', () => {
    expect(loginSchema.safeParse({ email: 'no-es-correo', password: 'x' }).success).toBe(false)
    expect(loginSchema.safeParse({ email: 'a@b.com' }).success).toBe(false)
  })
})

describe('createUserSchema', () => {
  const base = { name: 'X', email: 'a@b.com', role: 'asociado' as const }
  it('exige longitud mínima de contraseña', () => {
    expect(createUserSchema.safeParse({ ...base, password: 'a'.repeat(MIN_PASSWORD_LENGTH - 1) }).success).toBe(false)
    expect(createUserSchema.safeParse({ ...base, password: 'a'.repeat(MIN_PASSWORD_LENGTH) }).success).toBe(true)
  })
  it('rechaza rol fuera del enum', () => {
    expect(createUserSchema.safeParse({ ...base, role: 'root', password: 'a'.repeat(12) }).success).toBe(false)
  })
})

describe('radicacionSchema', () => {
  it('acepta 20–23 dígitos y rechaza lo demás', () => {
    expect(radicacionSchema.safeParse({ numero_radicacion: '1'.repeat(20) }).success).toBe(true)
    expect(radicacionSchema.safeParse({ numero_radicacion: '1'.repeat(19) }).success).toBe(false)
    expect(radicacionSchema.safeParse({ numero_radicacion: '11001AB0987654321000' }).success).toBe(false)
  })
})

describe('copilotSchema', () => {
  it('exige al menos un mensaje válido', () => {
    expect(copilotSchema.safeParse({ messages: [] }).success).toBe(false)
    expect(copilotSchema.safeParse({ messages: [{ role: 'user', content: 'hola' }] }).success).toBe(true)
  })
  it('rechaza rol de mensaje inválido', () => {
    expect(copilotSchema.safeParse({ messages: [{ role: 'system', content: 'x' }] }).success).toBe(false)
  })
})
