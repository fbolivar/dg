"use client"
import { useEffect } from 'react'
import { useAuthStore } from '@/shared/stores/auth-store'
import { useRoleStore } from '@/shared/stores/role-store'
import type { SessionUser } from '@/shared/types'

/** Siembra el usuario autenticado (desde el servidor) en los stores del cliente. */
export function SessionHydrator({ user }: { user: SessionUser }) {
  const setUser = useAuthStore(s => s.setUser)
  const setRole = useRoleStore(s => s.setRole)
  useEffect(() => {
    setUser(user)
    setRole(user.role)
  }, [user, setUser, setRole])
  return null
}
