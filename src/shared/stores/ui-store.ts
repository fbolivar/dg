"use client"
import { create } from 'zustand'

interface UIStore {
  mobileNavOpen: boolean
  setMobileNav: (open: boolean) => void
  toggleMobileNav: () => void
}

export const useUIStore = create<UIStore>((set) => ({
  mobileNavOpen: false,
  setMobileNav: (open) => set({ mobileNavOpen: open }),
  toggleMobileNav: () => set((s) => ({ mobileNavOpen: !s.mobileNavOpen })),
}))
