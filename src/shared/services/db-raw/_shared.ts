// Helpers y constantes compartidas por la capa de datos cruda (server-only).
import { supabaseAdmin } from '@/shared/lib/supabase-admin'

export const supabase = supabaseAdmin

export const now = () => new Date().toISOString()

// Columnas públicas de users (excluye password_hash) para selects y joins.
export const USER_PUBLIC = 'id,email,full_name,role,client_id,avatar_url,is_active,created_at'
