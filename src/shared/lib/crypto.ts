// Cifrado de tokens OAuth en reposo (AES-256-GCM) — SOLO SERVIDOR.
// Usa TOKEN_ENCRYPTION_KEY (32 bytes en hex). Formato: iv.tag.ciphertext (base64).
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

function getKey(): Buffer | null {
  const hex = process.env.TOKEN_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) return null
  return Buffer.from(hex, 'hex')
}

export function tokenEncryptionReady(): boolean {
  return getKey() !== null
}

export function encryptToken(plain: string): string {
  const key = getKey()
  if (!key) throw new Error('TOKEN_ENCRYPTION_KEY no configurado')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`
}

export function decryptToken(payload: string | null | undefined): string | null {
  const key = getKey()
  if (!key || !payload) return null
  try {
    const [ivB64, tagB64, dataB64] = payload.split('.')
    if (!ivB64 || !tagB64 || !dataB64) return null
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'))
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}

// ─── Cifrado de respaldos (AES-256-GCM, payloads grandes) ────────────────────
// Usa BACKUP_ENCRYPTION_KEY (32 bytes hex) o, en su defecto, TOKEN_ENCRYPTION_KEY.
// Formato binario compacto: [12 bytes IV][16 bytes tag][ciphertext]. Se sube como
// archivo .json.enc al bucket privado de Storage.
function getBackupKey(): Buffer | null {
  const hex = process.env.BACKUP_ENCRYPTION_KEY || process.env.TOKEN_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) return null
  return Buffer.from(hex, 'hex')
}

export function backupEncryptionReady(): boolean {
  return getBackupKey() !== null
}

export function encryptBackup(plain: string): Buffer {
  const key = getBackupKey()
  if (!key) throw new Error('BACKUP_ENCRYPTION_KEY/TOKEN_ENCRYPTION_KEY no configurado')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(Buffer.from(plain, 'utf8')), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc])
}

export function decryptBackup(buf: Buffer): string {
  const key = getBackupKey()
  if (!key) throw new Error('BACKUP_ENCRYPTION_KEY/TOKEN_ENCRYPTION_KEY no configurado')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const data = buf.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}
