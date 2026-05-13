import { Badge } from '@/components/ui/badge'
import type { AlertStatus } from '@/shared/types'

const STATUS_MAP: Record<AlertStatus, { label: string; variant: 'nueva' | 'en_analisis' | 'enviada' | 'archivada' }> = {
  nueva: { label: 'Nueva', variant: 'nueva' },
  en_análisis: { label: 'En análisis', variant: 'en_analisis' },
  enviada_cliente: { label: 'Enviada al cliente', variant: 'enviada' },
  archivada: { label: 'Archivada', variant: 'archivada' },
}

export function AlertStatusBadge({ status }: { status: AlertStatus }) {
  const config = STATUS_MAP[status]
  return <Badge variant={config.variant}>{config.label}</Badge>
}
