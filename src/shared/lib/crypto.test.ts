import { describe, it, expect, beforeAll } from 'vitest'
import { randomBytes } from 'node:crypto'

// La clave se lee en tiempo de llamada (getKey/getBackupKey), así que basta
// configurarla antes de importar/ejecutar.
beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('hex') // 64 hex
})

describe('crypto — tokens OAuth (AES-256-GCM)', () => {
  it('roundtrip: descifra lo que cifró', async () => {
    const { encryptToken, decryptToken, tokenEncryptionReady } = await import('./crypto')
    expect(tokenEncryptionReady()).toBe(true)
    const plain = 'ya29.secreto-de-acceso'
    const enc = encryptToken(plain)
    expect(enc).not.toContain(plain)
    expect(decryptToken(enc)).toBe(plain)
  })

  it('un payload manipulado devuelve null (no rompe)', async () => {
    const { encryptToken, decryptToken } = await import('./crypto')
    const enc = encryptToken('algo')
    const [iv, tag, data] = enc.split('.')
    const tampered = `${iv}.${tag}.${Buffer.from('otra-cosa').toString('base64')}`
    expect(decryptToken(tampered)).toBeNull()
    expect(decryptToken(null)).toBeNull()
    expect(decryptToken('formato-invalido')).toBeNull()
    void data
  })
})

describe('crypto — respaldos (AES-256-GCM, binario)', () => {
  it('roundtrip de un dump JSON', async () => {
    const { encryptBackup, decryptBackup, backupEncryptionReady } = await import('./crypto')
    expect(backupEncryptionReady()).toBe(true)
    const dump = JSON.stringify({ users: [{ id: 'u1' }], n: 42 })
    const enc = encryptBackup(dump)
    expect(Buffer.isBuffer(enc)).toBe(true)
    expect(enc.toString('utf8')).not.toContain('u1')
    expect(decryptBackup(enc)).toBe(dump)
  })

  it('un buffer manipulado lanza error (GCM detecta el tag)', async () => {
    const { encryptBackup, decryptBackup } = await import('./crypto')
    const enc = encryptBackup('contenido')
    enc[enc.length - 1] ^= 0xff // corromper el último byte
    expect(() => decryptBackup(enc)).toThrow()
  })
})
