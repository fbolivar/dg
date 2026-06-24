"use client"
import { useState, useEffect } from 'react'
import { Plug, Lock, Check, X, Calendar, Mail, AlertTriangle, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getIntegrationsStatus, disconnectIntegration } from '@/shared/services/db'
import { fmtDate } from '@/shared/lib/dgatime-format'
import type { ProviderStatus } from '@/shared/types'

type Provider = 'google' | 'microsoft'
const META: Record<Provider, { name: string; desc: string; color: string }> = {
  google: { name: 'Google Workspace', desc: 'Gmail (correos enviados) + Google Calendar', color: 'text-[#4285F4]' },
  microsoft: { name: 'Microsoft 365', desc: 'Outlook (correos enviados) + Calendario', color: 'text-[#0078D4]' },
}

export function IntegrationsPanel({ onMessage }: { onMessage?: (m: string) => void }) {
  const [status, setStatus] = useState<Record<Provider, ProviderStatus> | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<Provider | null>(null)

  async function load() {
    setLoading(true)
    try { setStatus(await getIntegrationsStatus()) } catch { /* noop */ }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function disconnect(p: Provider) {
    setBusy(p)
    try { await disconnectIntegration(p); await load(); onMessage?.(`${META[p].name} desconectado`) }
    catch (err) { onMessage?.(err instanceof Error ? err.message : 'Error') }
    setBusy(null)
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Cada abogado conecta su propio correo y calendario para que la <strong>Captura inteligente</strong> detecte automáticamente sus reuniones y correos enviados.</p>

      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 border border-border rounded-lg px-3 py-2.5">
        <Lock className="w-3.5 h-3.5 text-brand-navy flex-shrink-0 mt-0.5" />
        <span>Acceso de <strong>solo lectura</strong> a los eventos de calendario y a los <strong>metadatos</strong> de los correos enviados (asunto y destinatario). Los tokens se guardan <strong>cifrados</strong> y solo se usan para preparar las sugerencias privadas de cada abogado.</span>
      </div>

      {loading || !status ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Cargando…</div>
      ) : (
        (['google', 'microsoft'] as Provider[]).map(p => {
          const st = status[p]
          const m = META[p]
          return (
            <Card key={p}>
              <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                    <div className="flex gap-0.5"><Mail className={`w-3.5 h-3.5 ${m.color}`} /><Calendar className={`w-3.5 h-3.5 ${m.color}`} /></div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.desc}</p>
                    {st.connected && st.account_email && (
                      <p className="text-[11px] text-green-700 mt-0.5 flex items-center gap-1"><Check className="w-3 h-3" />{st.account_email}{st.last_sync ? ` · última sync ${fmtDate(st.last_sync)}` : ''}</p>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {!st.configured ? (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600"><AlertTriangle className="w-3.5 h-3.5" />No configurado</div>
                  ) : st.connected ? (
                    <Button type="button" variant="outline" size="sm" disabled={busy === p} onClick={() => disconnect(p)}>
                      {busy === p ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <X className="w-3.5 h-3.5 mr-1.5" />}Desconectar
                    </Button>
                  ) : (
                    <Button asChild size="sm"><a href={`/api/integrations/${p}/start`}><Plug className="w-3.5 h-3.5 mr-1.5" />Conectar</a></Button>
                  )}
                </div>
              </CardContent>
              {!st.configured && (
                <div className="px-4 pb-3 -mt-1">
                  <p className="text-[11px] text-muted-foreground">El administrador debe registrar las credenciales OAuth de {m.name} (ver <span className="font-mono">GUIA-INTEGRACIONES.md</span>) y definir las variables de entorno en el servidor.</p>
                </div>
              )}
            </Card>
          )
        })
      )}
    </div>
  )
}
