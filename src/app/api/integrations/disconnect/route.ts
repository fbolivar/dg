import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/shared/lib/auth'
import * as raw from '@/shared/services/db-raw'

// Desconecta una integración del abogado (borra los tokens).
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = (await req.json().catch(() => null)) as { provider?: string } | null
  const provider = body?.provider
  if (provider !== 'google' && provider !== 'microsoft') {
    return NextResponse.json({ error: 'Proveedor inválido' }, { status: 400 })
  }
  await raw.deleteIntegration(session.id, provider)
  return NextResponse.json({ ok: true })
}
