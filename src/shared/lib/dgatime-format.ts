import type { DgaCurrency } from '@/shared/types'

/** Formatea un monto según la moneda (COP: $ 1.500.000 · USD: US$ 1,500). */
export function fmtMoney(amount: number, currency: DgaCurrency): string {
  if (currency === 'USD') return 'US$ ' + Math.round(amount).toLocaleString('en-US')
  return '$ ' + Math.round(amount).toLocaleString('es-CO')
}

/** Minutos → "2h 30m". */
export function fmtHours(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

/** Minutos → horas decimales (2.5). */
export function hoursDecimal(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100
}

/**
 * Formatea una fecha sin desfase de zona horaria. Para fechas tipo 'YYYY-MM-DD'
 * usa el mediodía local para evitar que la conversión UTC retroceda un día.
 */
export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' }): string {
  const d = iso.length <= 10 ? new Date(iso + 'T12:00:00') : new Date(iso)
  return d.toLocaleDateString('es-CO', opts)
}
