# Checklist de variables — Vercel (Producción)

> Vercel → tu proyecto → **Settings → Environment Variables**.
> Marca el entorno **Production** (y **Preview** si vas a usar deploys de prueba).
> Las `NEXT_PUBLIC_*` se exponen al navegador; las demás son **secretas** (solo servidor).
> Tras guardar, **redeploy** para que tomen efecto.

---

## 🔴 Obligatorias para arrancar (sin estas, la app no funciona en prod)

| Variable | Valor | Notas |
|---|---|---|
| `NEXT_PUBLIC_USE_MOCK` | `false` | Si queda en `true`, usa datos de demo, no Supabase |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://kbjihgmpmfccpmhbotys.supabase.co` | Proyecto `dga-legal` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | _(copiar de Supabase → Settings → API)_ | Pública |
| `SUPABASE_SERVICE_ROLE_KEY` | _(copiar de Supabase → Settings → API)_ | 🔒 SECRETA — nunca exponer |
| `JWT_SECRET` | _(64 hex — ver más abajo)_ | 🔒 Firma las sesiones. Fail-closed: sin ella, la app lanza error en prod |
| `CRON_SECRET` | _(64 hex — ver más abajo)_ | 🔒 Protege los endpoints de cron |
| `ANTHROPIC_API_KEY` | _(tu API key de Anthropic)_ | 🔒 Copiloto + generación de Legal Notes |
| `NEXT_PUBLIC_SITE_URL` | `https://TU-DOMINIO` | ⚠️ El dominio REAL de producción, no localhost |

## 🟠 Recomendadas con datos reales

| Variable | Valor | Notas |
|---|---|---|
| `KV_REST_API_URL` | _(autollenado al crear Vercel KV)_ | Rate-limit compartido entre instancias |
| `KV_REST_API_TOKEN` | _(autollenado al crear Vercel KV)_ | 🔒 Crear store en Vercel → Storage → KV |

> Vercel KV inyecta ambas solo. Sin ellas el rate-limit cae a memoria (funciona, menos robusto).

## ⚪ Integraciones OAuth (DESPUÉS, con el cliente — opcional)

| Variable | Valor | Notas |
|---|---|---|
| `TOKEN_ENCRYPTION_KEY` | _(64 hex — ver abajo)_ | 🔒 Cifra los tokens OAuth. Sin ella, las conexiones = "No configurado" |
| `GOOGLE_CLIENT_ID` | _(de Google Cloud Console)_ | Ver GUIA-INTEGRACIONES.md |
| `GOOGLE_CLIENT_SECRET` | _(de Google Cloud Console)_ | 🔒 |
| `MICROSOFT_CLIENT_ID` | _(de Azure Entra ID)_ | Ver GUIA-INTEGRACIONES.md |
| `MICROSOFT_CLIENT_SECRET` | _(de Azure Entra ID)_ | 🔒 |
| `MICROSOFT_TENANT` | `common` _(o tu tenant id)_ | |

---

## Cómo generar los secretos (64 caracteres hex)

Genera un valor **distinto** para cada uno:

```bash
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # CRON_SECRET
openssl rand -hex 32   # TOKEN_ENCRYPTION_KEY (cuando hagas OAuth)
```

> Sin `openssl` (Windows con Node): `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

⚠️ **No reutilices** los valores de desarrollo en producción. Genera secretos nuevos para prod.

---

## Verificación post-deploy

- [ ] La app carga datos reales (no demo) → `NEXT_PUBLIC_USE_MOCK=false`
- [ ] Login funciona y la cookie de sesión es `Secure` (HTTPS)
- [ ] Cuenta demo `admin@dga.com` eliminada o con contraseña fuerte
- [ ] Usuarios reales del cliente creados
- [ ] `/api/cron/backup` agendado en `vercel.json` (si activaste respaldos)
