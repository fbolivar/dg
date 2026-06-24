---
name: supabase-dga-legal
description: Proyecto Supabase de la app (ref, región, cómo conectarse desde MCP).
metadata:
  type: reference
---

# Supabase: proyecto `dga-legal`

- **project_id / ref**: `kbjihgmpmfccpmhbotys`
- **Región**: sa-east-1 · Postgres 17
- **URL**: `https://kbjihgmpmfccpmhbotys.supabase.co` (en `.env.local` como `NEXT_PUBLIC_SUPABASE_URL`)
- Org: `lajzkapodbsjwpojomef`. Hay muchos otros proyectos en la misma org (bc-money, task, bc-pos, etc.) — **no confundir**; el de esta app es `dga-legal`.

## Cómo conectarse desde Claude
El MCP `mcp__supabase__*` da **Unauthorized** (sin access token). Usar en su lugar el server
**`mcp__claude_ai_Supabase__*`** (list_tables, execute_sql, etc.), pasando `project_id=kbjihgmpmfccpmhbotys`.

## Tablas (23, todas con RLS)
practice_areas, clients, users, alerts, legal_notes, documents, contract_reviews, matters,
matter_events, due_diligence_projects, due_diligence_findings, compliance_diagnostics, hr_tickets,
judicial_processes, judicial_actuaciones, knowledge_sources, audit_log, invoices, invoice_items,
time_entries, recurring_fees, captured_activities, user_integrations.
Storage buckets: `backups` (privado).

Capa de datos en `src/shared/services/db-raw.ts`. Ver [[dgatime-captura-inteligente]].
