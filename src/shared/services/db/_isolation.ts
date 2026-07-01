// Aislamiento multi-tenant PURO (testeable, sin dependencias server-only).
// Como el RLS está habilitado SIN políticas, esta es la barrera real que impide
// que un 'cliente' vea datos de otro cliente.
import type { SessionUser } from '@/shared/types'

/**
 * Para un rol `cliente`, deja solo las filas cuyo `client_id` coincide con el
 * suyo. Para el staff (admin/socio/asociado) devuelve todo.
 *
 * Importante: un `cliente` SIN `client_id` no ve nada. Esto evita la colisión
 * `undefined === undefined` (o `null`) que dejaría pasar filas con client_id
 * vacío a una cuenta de cliente mal formada.
 */
export function filterByClient<T extends { client_id?: string | null }>(
  session: SessionUser,
  rows: T[],
): T[] {
  if (session.role !== 'cliente') return rows
  if (!session.client_id) return []
  return rows.filter(r => r.client_id === session.client_id)
}

/**
 * Variante para alertas: el vínculo con el cliente es la lista `clients_affected`
 * (membresía), no un único `client_id`. Mismo principio: cliente sin id → nada.
 */
export function filterAlertsByClient<T extends { clients_affected?: string[] | null }>(
  session: SessionUser,
  rows: T[],
): T[] {
  if (session.role !== 'cliente') return rows
  if (!session.client_id) return []
  return rows.filter(r => r.clients_affected?.includes(session.client_id as string))
}
