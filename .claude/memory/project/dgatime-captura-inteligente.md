---
name: dgatime-captura-inteligente
description: Feature DGA-Time + Captura Inteligente (integraciones OAuth correo/calendario, Rama Judicial). Estado y pendientes.
metadata:
  type: project
---

# DGA-Time + Captura Inteligente

Feature grande commiteada el **2026-06-24** (commit `36f1a9f`, rama `main`).

## Qué es
Módulo de tiempo facturable que conecta el **correo y calendario** de cada abogado vía
**OAuth (Google Workspace / Microsoft 365)** para detectar reuniones y correos enviados
y convertirlos en **sugerencias privadas de tiempo** (glosa redactada por IA, listas para aprobar).
Acceso **solo lectura** + solo metadatos de correo. Tokens cifrados con **AES-256-GCM**.
Incluye integración de **Rama Judicial** (consulta + sync de procesos/actuaciones).

## Dónde está el código
- UI: `src/app/(main)/dgatime/` (captura, facturacion, horas, igualas, informes) y `rama-judicial/`
- API: `src/app/api/dgatime/`, `src/app/api/integrations/[provider]/{start,callback}`, `src/app/api/rama-judicial/`, `src/app/api/cron/backup`, `src/app/api/auth/`
- Libs: `src/shared/lib/{oauth,crypto,auth,capture-ai,rama-judicial,supabase-admin,dgatime-format,pdf-report}.ts`
- Servicios: `src/shared/services/{integrations,capture,db-raw}.ts`
- Guía de setup OAuth: `GUIA-INTEGRACIONES.md` (raíz)

## Estado de Supabase (proyecto `dga-legal` = `kbjihgmpmfccpmhbotys`, región sa-east-1)
**VERIFICADO 2026-06-24**: todas las 23 tablas existen con RLS habilitado.
Tablas clave de la feature: `captured_activities` y `user_integrations` (ambas existen, RLS ✓).
Bucket de Storage privado `backups` existe ✓ (lo usa el cron de respaldo).
Compila: `npm run build` pasa limpio (no hay script `typecheck`; el build hace el chequeo de tipos).

## Pendiente (runtime, NO bloquea compilación)
- Crear apps OAuth y poblar `.env.local` + Vercel: `TOKEN_ENCRYPTION_KEY` (openssl rand -hex 32),
  `GOOGLE_CLIENT_ID/SECRET`, `MICROSOFT_CLIENT_ID/SECRET/TENANT`. Sin `TOKEN_ENCRYPTION_KEY`
  las integraciones aparecen como "No configurado".
- `CRON_SECRET` para el cron de backup (fail-closed: sin él, el endpoint responde 500).
- Cada abogado conecta su cuenta desde **Mi perfil → Mis conexiones** o DGA-Time → Conexiones.

Relacionado: [[supabase-dga-legal]]
