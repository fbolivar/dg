"use client"
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserRole } from '@/shared/types'

interface RoleStore {
  currentRole: UserRole
  setRole: (role: UserRole) => void
}

export const useRoleStore = create<RoleStore>()(
  persist(
    (set) => ({
      currentRole: 'socio',
      setRole: (role) => set({ currentRole: role }),
    }),
    { name: 'dga-role' }
  )
)
