// Esquemas Zod para validar entradas de los endpoints. Centralizados y puros
// (sin dependencias de Next), así son reutilizables y testeables.
import { z } from 'zod'
import { MIN_PASSWORD_LENGTH } from '@/shared/lib/auth-constants'

export const ROLES = ['socio', 'asociado', 'cliente', 'admin'] as const
export const CURRENCIES = ['COP', 'USD'] as const

// ─── Login ────────────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().trim().min(1).email().max(200),
  password: z.string().min(1).max(200),
})

// ─── Usuarios ──────────────────────────────────────────────────────────────────
const optionalRate = z.number().min(0).optional()

export const createUserSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().min(1).email().max(200),
  role: z.enum(ROLES),
  password: z.string().min(MIN_PASSWORD_LENGTH, `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`).max(200),
  client_id: z.string().optional(),
  is_active: z.boolean().optional(),
  dgatime_enabled: z.boolean().optional(),
  hourly_rate: optionalRate,
  cost_rate: optionalRate,
  rate_currency: z.enum(CURRENCIES).optional(),
})

// En edición todo es opcional; si viene password, respeta la longitud mínima.
export const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  email: z.string().trim().min(1).email().max(200).optional(),
  role: z.enum(ROLES).optional(),
  password: z.string().min(MIN_PASSWORD_LENGTH, `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`).max(200).optional(),
  client_id: z.string().optional(),
  is_active: z.boolean().optional(),
  dgatime_enabled: z.boolean().optional(),
  hourly_rate: z.number().min(0).nullable().optional(),
  cost_rate: z.number().min(0).nullable().optional(),
  rate_currency: z.enum(CURRENCIES).optional(),
})

// ─── Legal Notes (generación IA) ───────────────────────────────────────────────
const MAX_FIELD = 4000
export const legalNoteSchema = z.object({
  alert_title: z.string().trim().min(1).max(MAX_FIELD),
  alert_summary: z.string().max(MAX_FIELD).optional().default(''),
  alert_recommendation: z.string().max(MAX_FIELD).optional().default(''),
  audience: z.string().trim().min(1).max(MAX_FIELD),
  tone: z.string().trim().min(1).max(MAX_FIELD),
  practice_area: z.string().max(MAX_FIELD).optional().default(''),
})

// ─── Copiloto (chat IA) ────────────────────────────────────────────────────────
export const copilotSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(8000),
  })).min(1).max(30),
  sources: z.array(z.object({
    title: z.string().max(200).optional().default(''),
    content: z.string().min(1).max(4000),
  })).max(8).optional().default([]),
})

// ─── Rama Judicial (consulta puntual) ──────────────────────────────────────────
export const radicacionSchema = z.object({
  numero_radicacion: z.string().trim().regex(/^\d{20,23}$/, 'Número de radicación inválido (deben ser 20–23 dígitos)'),
})
