"use client"
import { useEffect } from 'react'

/**
 * Error boundary global: captura fallos que escapan a los segmentos (incluido el
 * layout raíz). Debe renderizar su propio <html>/<body>. Último recurso para no
 * mostrar una pantalla en blanco.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Error global de la aplicación:', error)
  }, [error])

  return (
    <html lang="es">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', margin: 0, background: '#f8f7f4' }}>
        <div style={{ textAlign: 'center', padding: 24, maxWidth: 420 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: '#1a2b4a', margin: '0 0 8px' }}>Algo salió mal</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px' }}>
            Ocurrió un error inesperado. Intenta de nuevo.
          </p>
          <button
            onClick={() => reset()}
            style={{ fontSize: 13, fontWeight: 500, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1a2b4a', color: '#fff', cursor: 'pointer' }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  )
}
