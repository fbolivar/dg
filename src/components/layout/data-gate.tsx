"use client"
import { Loader2, AlertTriangle } from 'lucide-react'
import { useData } from '@/shared/context/data-context'

/**
 * Muestra un indicador de carga mientras el contexto trae los datos,
 * evitando el "flash" de KPIs en 0 / tablas vacías en todas las páginas.
 * Si la carga falla, muestra un estado de error con reintento en vez de
 * dejar la app congelada en el spinner.
 */
export function DataGate({ children }: { children: React.ReactNode }) {
  const { loading, error, reload } = useData()

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-brand-gold" />
        <p className="text-xs text-muted-foreground">Cargando información…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-28 gap-4 text-center">
        <AlertTriangle className="w-8 h-8 text-amber-500" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">No se pudieron cargar los datos</p>
          <p className="text-xs text-muted-foreground">Revisa tu conexión e intenta de nuevo.</p>
        </div>
        <button
          onClick={() => reload()}
          className="text-xs font-medium px-4 py-2 rounded-lg bg-brand-navy text-white hover:opacity-90 transition"
        >
          Reintentar
        </button>
      </div>
    )
  }

  return <>{children}</>
}
