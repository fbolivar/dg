// ─── Capa de datos AUTORIZADA (Server Actions) ───────────────────────────────
// Única superficie que deben usar los componentes cliente. Cada acción:
//   1) exige sesión válida (getSession sobre el JWT en cookie httpOnly)
//   2) aplica autorización por rol (las mutaciones requieren staff)
//   3) aísla por client_id (un 'cliente' solo ve los datos de su cliente)
// El acceso crudo a la BD (service role, sin auth) vive en db-raw/.
//
// Barrel: la API pública es idéntica a la del antiguo `db.ts`. Las acciones
// están organizadas por dominio (legal, dgatime) y el aislamiento multi-tenant
// puro en `_isolation.ts`.
export * from './legal'
export * from './dgatime'
