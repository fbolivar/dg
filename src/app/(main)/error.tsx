"use client"
import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

/**
 * Error boundary del área principal: si una página lanza en render, en vez de
 * tumbar toda la vista mostramos un mensaje con reintento (reset) sin perder el
 * shell (sidebar/header siguen montados por el layout).
 */
export default function MainError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Error en una vista del área principal:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center py-28 gap-4 text-center">
      <AlertTriangle className="w-9 h-9 text-amber-500" />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Ocurrió un error al mostrar esta sección</p>
        <p className="text-xs text-muted-foreground">Puedes reintentar; si persiste, vuelve a iniciar sesión.</p>
      </div>
      <button
        onClick={() => reset()}
        className="text-xs font-medium px-4 py-2 rounded-lg bg-brand-navy text-white hover:opacity-90 transition"
      >
        Reintentar
      </button>
    </div>
  )
}
