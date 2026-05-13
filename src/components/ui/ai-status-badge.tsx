import { Badge } from '@/components/ui/badge'
import type { NoteStatus } from '@/shared/types'

const STATUS_MAP: Record<string, { label: string; variant: 'borrador' | 'revision' | 'aprobado' | 'publicado' | 'default' }> = {
  borrador_ia: { label: 'Borrador IA', variant: 'borrador' },
  en_revisión: { label: 'En revisión', variant: 'revision' },
  aprobado: { label: 'Aprobado por abogado', variant: 'aprobado' },
  publicado: { label: 'Publicado', variant: 'publicado' },
  rechazado: { label: 'Rechazado', variant: 'default' },
}

export function AiStatusBadge({ status }: { status: string }) {
  const config = STATUS_MAP[status] ?? { label: status, variant: 'default' as const }
  return <Badge variant={config.variant as NoteStatus}>{config.label}</Badge>
}
