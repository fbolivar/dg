import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AiDisclaimerProps {
  message?: string
  className?: string
  variant?: 'inline' | 'banner'
}

export function AiDisclaimer({
  message = 'Las respuestas del copiloto son asistencia preliminar. Toda respuesta requiere revisión de un abogado DG&A antes de ser utilizada.',
  className,
  variant = 'inline'
}: AiDisclaimerProps) {
  if (variant === 'banner') {
    return (
      <div className={cn("bg-amber-50 border border-amber-200 rounded-md px-4 py-2.5 flex items-start gap-2.5", className)}>
        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-800 leading-relaxed">{message}</p>
      </div>
    )
  }
  return (
    <p className={cn("text-xs text-muted-foreground italic", className)}>
      <AlertTriangle className="inline w-3 h-3 text-amber-500 mr-1" />
      {message}
    </p>
  )
}
