"use client"
import { Loader2 } from 'lucide-react'
import { useData } from '@/shared/context/data-context'

/**
 * Muestra un indicador de carga mientras el contexto trae los datos,
 * evitando el "flash" de KPIs en 0 / tablas vacías en todas las páginas.
 */
export function DataGate({ children }: { children: React.ReactNode }) {
  const { loading } = useData()
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-brand-gold" />
        <p className="text-xs text-muted-foreground">Cargando información…</p>
      </div>
    )
  }
  return <>{children}</>
}
