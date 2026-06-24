import { JUDICIAL_PROCESSES, JUDICIAL_ACTUACIONES } from '@/shared/data/mock'

/**
 * Cliente de integración con la Rama Judicial (Consulta de Procesos Nacional
 * Unificada — CPNU). API pública no oficial-soportada; nótese el puerto 448.
 * Usado tanto por el endpoint de consulta puntual como por el job de
 * sincronización automática.
 */
const CPNU_BASE = 'https://consultaprocesos.ramajudicial.gov.co:448/api/v2'

export type RamaActuacion = {
  id: string; fecha: string; actuacion: string
  anotacion?: string; inicia_termino?: string; finaliza_termino?: string
}
export type RamaProceso = {
  despacho: string; departamento: string; tipo_proceso: string; clase_proceso: string
  ponente: string; demandante: string; demandado: string
  fecha_radicacion?: string; fecha_ultima_actuacion?: string
}
export type ConsultaResultado = {
  fuente: string
  numero_radicacion: string
  encontrado: boolean
  consultado_en: string
  total_actuaciones: number
  proceso?: RamaProceso
  actuaciones: RamaActuacion[]
}

async function fetchJson(url: string, ms = 8000): Promise<Record<string, unknown> | null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    const r = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (DGA Legal Intelligence Desk)' },
      signal: ctrl.signal,
      cache: 'no-store',
    })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

const cleanDate = (d: unknown): string | undefined =>
  typeof d === 'string' && d.length >= 10 && !d.startsWith('1900') ? d.slice(0, 10) : undefined

function parseSujetos(s: unknown): { demandante: string; demandado: string } {
  const out = { demandante: '—', demandado: '—' }
  if (typeof s !== 'string') return out
  for (const part of s.split('|')) {
    const idx = part.indexOf(':')
    if (idx === -1) continue
    const label = part.slice(0, idx).toLowerCase()
    const val = part.slice(idx + 1).trim()
    if (!val) continue
    // "demandado" primero (más específico) para no confundirlo con "demandante".
    if (/demandado|accionado|ejecutado|convocado|indiciado|causante|pasivo/.test(label)) out.demandado = val
    else if (/demandante|accionante|ejecutante|convocante|activo/.test(label)) out.demandante = val
  }
  return out
}

// Datos de demostración (respaldo cuando la radicación no existe en la CPNU).
function simulado(rad: string): ConsultaResultado {
  const proceso = JUDICIAL_PROCESSES.find(p => p.numero_radicacion === rad)
  if (!proceso) {
    return { fuente: 'Simulado', numero_radicacion: rad, encontrado: false, consultado_en: new Date().toISOString(), total_actuaciones: 0, actuaciones: [] }
  }
  const existentes: RamaActuacion[] = JUDICIAL_ACTUACIONES
    .filter(a => a.process_id === proceso.id)
    .map(a => ({ id: a.id, fecha: a.fecha, actuacion: a.actuacion, anotacion: a.anotacion, inicia_termino: a.inicia_termino, finaliza_termino: a.finaliza_termino }))
  const hoy = new Date().toISOString().slice(0, 10)
  const nueva = existentes.some(a => a.fecha === hoy) ? null : {
    id: `act-sync-${Date.now()}`, fecha: hoy, actuacion: 'Fijación en estado',
    anotacion: 'Se fija en estado la providencia. Queda a disposición de las partes (detectado en sincronización).',
  }
  const actuaciones = nueva ? [nueva, ...existentes] : existentes
  return {
    fuente: 'Simulado (demostración)', numero_radicacion: rad, encontrado: true,
    consultado_en: new Date().toISOString(), total_actuaciones: actuaciones.length, actuaciones,
  }
}

/** Consulta SOLO la Rama Judicial real. Devuelve null si no encuentra o no hay conexión. */
export async function fetchProcesoReal(rad: string): Promise<ConsultaResultado | null> {
  const consulta = await fetchJson(`${CPNU_BASE}/Procesos/Consulta/NumeroRadicacion?numero=${rad}&SoloActivos=false&pagina=1`)
  const procesos = consulta?.procesos as Array<Record<string, unknown>> | undefined
  const proc = procesos?.[0]
  if (!proc?.idProceso) return null

  const [act, det] = await Promise.all([
    fetchJson(`${CPNU_BASE}/Proceso/Actuaciones/${proc.idProceso}?pagina=1`),
    fetchJson(`${CPNU_BASE}/Proceso/Detalle/${proc.idProceso}`),
  ])
  const rawAct = (act?.actuaciones as Array<Record<string, unknown>>) ?? []
  const actuaciones: RamaActuacion[] = rawAct.map((a, i) => ({
    id: String(a.idRegActuacion ?? `r${i}`),
    fecha: (typeof a.fechaActuacion === 'string' ? a.fechaActuacion : '').slice(0, 10),
    actuacion: String(a.actuacion ?? '').trim(),
    anotacion: a.anotacion ? String(a.anotacion).trim() : undefined,
    inicia_termino: cleanDate(a.fechaInicial),
    finaliza_termino: cleanDate(a.fechaFinal),
  }))
  const sujetos = parseSujetos(proc.sujetosProcesales)
  return {
    fuente: 'Rama Judicial — CPNU (datos reales)',
    numero_radicacion: rad,
    encontrado: true,
    consultado_en: new Date().toISOString(),
    total_actuaciones: actuaciones.length,
    proceso: {
      despacho: String(proc.despacho ?? '').trim(),
      departamento: String(proc.departamento ?? '').trim(),
      tipo_proceso: String(det?.tipoProceso ?? det?.claseProceso ?? 'Proceso judicial').trim(),
      clase_proceso: String(det?.claseProceso ?? '').trim(),
      ponente: String(det?.ponente ?? '').trim(),
      demandante: sujetos.demandante,
      demandado: sujetos.demandado,
      fecha_radicacion: cleanDate(proc.fechaProceso),
      fecha_ultima_actuacion: cleanDate(proc.fechaUltimaActuacion),
    },
    actuaciones,
  }
}

/** Consulta la Rama real y, si no encuentra, cae al respaldo de demostración. */
export async function consultarProceso(rad: string): Promise<ConsultaResultado> {
  const real = await fetchProcesoReal(rad)
  return real ?? simulado(rad)
}
