"use client"
import { create } from 'zustand'
import type { SessionUser } from '@/shared/types'

interface AuthStore {
  user: SessionUser | null
  setUser: (user: SessionUser | null) => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}))
