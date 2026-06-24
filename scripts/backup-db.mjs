// Respaldo completo de la base de datos a un archivo JSON.
// Uso: node --env-file=.env.local scripts/backup-db.mjs
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'node:fs'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

const tables = [
  'practice_areas', 'clients', 'users', 'alerts', 'legal_notes', 'documents',
  'contract_reviews', 'matters', 'matter_events', 'due_diligence_projects',
  'due_diligence_findings', 'compliance_diagnostics', 'hr_tickets',
  'judicial_processes', 'judicial_actuaciones', 'knowledge_sources',
]

const out = { exported_at: new Date().toISOString() }
const counts = {}
for (const t of tables) {
  const { data, error } = await supabase.from(t).select('*')
  if (error) { console.error(`Error leyendo ${t}:`, error.message); process.exit(1) }
  out[t] = data
  counts[t] = data.length
}

mkdirSync('supabase/backups', { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const file = `supabase/backups/backup-${stamp}.json`
writeFileSync(file, JSON.stringify(out, null, 2), 'utf8')
console.log('Backup escrito:', file)
console.log('Filas por tabla:', counts)
