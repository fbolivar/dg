---
name: seguridad-rls-y-roles
description: Postura de seguridad de dga-legal — RLS sin políticas (service-role only), modelo de roles y hardening aplicado 2026-06-30.
metadata:
  type: reference
---

# Seguridad: RLS, roles y hardening

## RLS habilitado SIN políticas — es intencional, NO lo "arregles"
Las 23 tablas tienen RLS habilitado pero **cero políticas**. Esto es deliberado:
toda la app accede vía **service role** (servidor), que ignora RLS. RLS-on-sin-políticas
deja **deny-by-default** para anon/authenticated (si se filtra la anon key, no leen nada).
La autorización real y el aislamiento multi-tenant por `client_id` viven en
`src/shared/services/db.ts` (server-side). No agregar políticas con `auth.uid()`:
la app NO usa Supabase Auth, los ids de usuario son TEXT (`u<timestamp>`), no `auth.uid()`.

## Modelo de roles
Roles: `socio`, `asociado`, `cliente`, `admin`. Privilegiados = `admin` + `socio`.
Reglas (en `src/shared/lib/auth.ts` → `canAssignRole` / `canManageUserWithRole` y
aplicadas en `src/app/api/auth/users/route.ts` y `.../users/[id]/route.ts`):
- Solo un `admin` crea/asigna roles privilegiados y gestiona cuentas privilegiadas.
- Nadie cambia su propio rol ni se auto-elimina (evita auto-escalación socio→admin).

## Hardening aplicado 2026-06-30
- Cierre de escalación de privilegios en gestión de usuarios (#1).
- Migración `supabase/migrations/001_dga_schema.sql` regenerada desde la BD en vivo
  (estaba muy desincronizada) — ahora reproduce prod 1:1 (#2).
- Contraseña mínima 6→10 (`MIN_PASSWORD_LENGTH` en auth.ts) (#7).
- `CRON_SECRET` se compara con `timingSafeEqual` vía `src/shared/lib/cron.ts`
  (`checkCronAuth`), usado por los 4 crons (#10).
- Rate-limit específico de login: `src/shared/lib/login-rate-limit.ts` (5 fallos/15min
  por IP+correo, KV + fallback memoria) integrado en `api/auth/login`.
- Backup cifrado en reposo (AES-256-GCM) en `api/cron/backup`: usa
  `BACKUP_ENCRYPTION_KEY` (o `TOKEN_ENCRYPTION_KEY`); sube `.json.enc`. Helpers
  `encryptBackup`/`decryptBackup` en `src/shared/lib/crypto.ts`. Sin clave sube en
  claro y lo avisa en la respuesta → **configurar `BACKUP_ENCRYPTION_KEY` en Vercel**.

## Pendientes de seguridad (no hechos aún)
- Adoptar Zod en endpoints; sanear inputs de IA (prompt injection); tests.
- Configurar `BACKUP_ENCRYPTION_KEY` en Vercel (si no, los backups van sin cifrar).

Relacionado: [[supabase-dga-legal]] · [[dgatime-captura-inteligente]]
