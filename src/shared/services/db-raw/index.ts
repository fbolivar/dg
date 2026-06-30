// ─── Capa de datos CRUDA (server-only, service role, SIN autorización) ───────
// Bypassa RLS. Solo debe importarse desde código de servidor de confianza:
//   - la capa autorizada db.ts (que añade sesión + filtrado por cliente)
//   - jobs internos sin sesión de usuario (cron de Rama Judicial)
// NUNCA debe importarse desde un componente cliente.
//
// Barrel: la API pública es idéntica a la del antiguo `db-raw.ts`. Las funciones
// están organizadas por dominio en los módulos de esta carpeta.
export * from './audit'
export * from './catalog'
export * from './legal'
export * from './judicial'
export * from './dgatime'
export * from './integrations'
