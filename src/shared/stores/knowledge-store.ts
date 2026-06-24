"use client"
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface KnowledgeSource {
  id: string
  title: string
  content: string
}

interface KnowledgeStore {
  sources: KnowledgeSource[]
  addSource: (title: string, content: string) => void
  removeSource: (id: string) => void
}

// Fuentes de información propias de la firma. La IA las prioriza al responder.
// Persistidas localmente para que sobrevivan recargas durante la demo.
export const useKnowledgeStore = create<KnowledgeStore>()(
  persist(
    (set) => ({
      sources: [],
      addSource: (title, content) =>
        set((s) => ({
          sources: [...s.sources, { id: `src${Date.now()}`, title: title.trim(), content: content.trim() }],
        })),
      removeSource: (id) => set((s) => ({ sources: s.sources.filter((x) => x.id !== id) })),
    }),
    { name: 'dga-knowledge' }
  )
)
