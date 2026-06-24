// Cliente Supabase con SERVICE ROLE — SOLO SERVIDOR.
// Bypassa RLS. Nunca debe importarse desde un componente cliente.
// Usa SUPABASE_SERVICE_ROLE_KEY (no NEXT_PUBLIC*), por lo que no existe en el bundle del navegador.
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (process.env.NODE_ENV === 'production' && (!url || !serviceKey)) {
  throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en producción')
}

export const supabaseAdmin = createClient(url ?? '', serviceKey ?? '', {
  auth: { persistSession: false, autoRefreshToken: false },
})
