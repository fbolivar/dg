// Reglas de privilegio PURAS (sin dependencias server-only) — testeables en aislamiento.
// Las cuentas `admin` y `socio` son privilegiadas: gestionarlas o asignar esos
// roles queda reservado a un `admin`. Esto evita que un `socio` se auto-promueva
// a admin o tome el control de otra cuenta privilegiada (cambio de rol / reseteo
// de contraseña). Un `socio` solo puede gestionar cuentas `asociado` y `cliente`.
import type { UserRole } from '@/shared/types'

const PRIVILEGED_ROLES: UserRole[] = ['admin', 'socio']

export function isPrivilegedRole(role: UserRole): boolean {
  return PRIVILEGED_ROLES.includes(role)
}

/** ¿Puede `actorRole` asignar/crear una cuenta con rol `targetRole`? */
export function canAssignRole(actorRole: UserRole, targetRole: UserRole): boolean {
  return isPrivilegedRole(targetRole) ? actorRole === 'admin' : true
}

/** ¿Puede `actorRole` editar/eliminar a un usuario que hoy tiene rol `targetRole`? */
export function canManageUserWithRole(actorRole: UserRole, targetRole: UserRole): boolean {
  return isPrivilegedRole(targetRole) ? actorRole === 'admin' : true
}
