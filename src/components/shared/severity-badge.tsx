import { Badge } from '@/components/ui/badge'
import type { ImpactLevel, Severity } from '@/shared/types'

const SEVERITY_VARIANT: Record<string, 'critico' | 'alto' | 'medio' | 'bajo'> = {
  'crítico': 'critico',
  'alto': 'alto',
  'medio': 'medio',
  'bajo': 'bajo',
}

export function SeverityBadge({ level }: { level: ImpactLevel | Severity | string }) {
  const variant = SEVERITY_VARIANT[level] ?? 'bajo'
  return <Badge variant={variant}>{level.charAt(0).toUpperCase() + level.slice(1)}</Badge>
}
