# Guía de integraciones — Correo y calendario (DGA-Time · Captura inteligente)

Esta guía explica, paso a paso, cómo conectar **Google Workspace** y/o **Microsoft 365** para que la **Captura inteligente** detecte automáticamente las reuniones del calendario y los correos enviados de cada abogado.

> El código de la integración ya está construido en la aplicación. Solo falta **crear las apps OAuth** (esto requiere tus cuentas de Google/Microsoft) y **pegar las credenciales** en las variables de entorno. Una vez hecho, cada abogado conecta su cuenta desde **DGA-Time → Conexiones**.

Acceso solicitado: **solo lectura** del calendario y de los **metadatos** de los correos enviados (asunto y destinatario). Los tokens se guardan **cifrados** (AES‑256‑GCM) y solo se usan para preparar las sugerencias privadas de cada abogado.

---

## 0) Paso común — Clave de cifrado de tokens

Genera una clave de 32 bytes y guárdala como variable de entorno `TOKEN_ENCRYPTION_KEY`:

```bash
openssl rand -hex 32
```

Pega el resultado en `.env.local` (desarrollo) y en **Vercel → Settings → Environment Variables** (producción):

```
TOKEN_ENCRYPTION_KEY=<el valor de 64 caracteres hex>
```

> Sin esta clave, las integraciones aparecerán como **"No configurado"** aunque tengas las credenciales OAuth.

**URLs de redirección (Redirect URIs)** que usarás en ambos proveedores (reemplaza el dominio por el tuyo):

| Entorno | Google | Microsoft |
|---|---|---|
| Desarrollo | `http://localhost:3000/api/integrations/google/callback` | `http://localhost:3000/api/integrations/microsoft/callback` |
| Producción | `https://TU-DOMINIO/api/integrations/google/callback` | `https://TU-DOMINIO/api/integrations/microsoft/callback` |

> El dominio de producción se toma de `NEXT_PUBLIC_SITE_URL`. Asegúrate de que esté bien configurada en Vercel.

---

## 1) Google Workspace (Gmail + Calendar)

### 1.1 Crear/seleccionar proyecto
1. Entra a **https://console.cloud.google.com/**.
2. Arriba, selector de proyecto → **Nuevo proyecto** (ej. "DGA Legal Desk") → **Crear**.

### 1.2 Habilitar las APIs
1. Menú → **APIs y servicios → Biblioteca**.
2. Busca y **Habilita**: **Gmail API** y **Google Calendar API**.

### 1.3 Configurar la pantalla de consentimiento OAuth
1. **APIs y servicios → Pantalla de consentimiento de OAuth**.
2. **Tipo de usuario**:
   - Si toda la firma usa Google Workspace del mismo dominio → **Interno** (recomendado: no requiere verificación de Google).
   - Si no → **Externo** (tendrás que agregar a los abogados como *usuarios de prueba* mientras la app no esté verificada).
3. Completa nombre de la app, correo de soporte y de contacto.
4. **Scopes** → Agregar:
   - `.../auth/calendar.readonly`
   - `.../auth/gmail.readonly`
   - (`openid`, `email` se agregan solos)
5. Guarda. Si elegiste **Externo**, en **Usuarios de prueba** agrega los correos de los abogados.

> Nota: `gmail.readonly` y `calendar.readonly` son *sensibles*. Con **Interno** (Workspace) funcionan sin verificación. Con **Externo** y muchos usuarios, Google puede exigir verificación de la app.

### 1.4 Crear el Client ID
1. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**.
2. **Tipo de aplicación**: *Aplicación web*.
3. **URIs de redireccionamiento autorizados** → agrega las dos de la tabla (localhost y producción).
4. **Crear**. Copia el **Client ID** y el **Client Secret**.

### 1.5 Variables de entorno (Google)
```
GOOGLE_CLIENT_ID=<tu client id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<tu client secret>
```

---

## 2) Microsoft 365 (Outlook + Calendario)

### 2.1 Registrar la aplicación
1. Entra a **https://portal.azure.com/** → **Microsoft Entra ID** (Azure AD).
2. **Registros de aplicaciones → Nuevo registro**.
3. Nombre: "DGA Legal Desk".
4. **Tipos de cuenta admitidos**:
   - Solo tu organización → deja `MICROSOFT_TENANT` con el **ID del directorio (tenant)**.
   - Varias organizaciones → usa `MICROSOFT_TENANT=common`.
5. **URI de redirección**: plataforma **Web** → pega la URL de callback de Microsoft (localhost o producción).
6. **Registrar**.

### 2.2 Permisos de API (Microsoft Graph)
1. En la app → **Permisos de API → Agregar permiso → Microsoft Graph → Permisos delegados**.
2. Agrega: **Calendars.Read**, **Mail.Read**, **User.Read**, **offline_access**, **openid**, **email**.
3. **Conceder consentimiento del administrador** para la organización.

### 2.3 Crear el secreto
1. **Certificados y secretos → Nuevo secreto de cliente** → descripción y vigencia → **Agregar**.
2. Copia el **Valor** del secreto *de inmediato* (no se vuelve a mostrar).

### 2.4 Datos a copiar
- **Información general → ID de aplicación (cliente)** = client ID.
- **ID de directorio (inquilino)** = tenant (si elegiste "solo tu organización").

### 2.5 Variables de entorno (Microsoft)
```
MICROSOFT_CLIENT_ID=<application (client) id>
MICROSOFT_CLIENT_SECRET=<el valor del secreto>
MICROSOFT_TENANT=<tenant id  ó  common>
```

---

## 3) Dónde poner las variables

- **Desarrollo local**: archivo `.env.local` (ya está en `.gitignore`). Reinicia `npm run dev`.
- **Producción**: **Vercel → Settings → Environment Variables**. Vuelve a desplegar para que tomen efecto.

Variables totales de integraciones:
```
TOKEN_ENCRYPTION_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT=common
```

> Puedes configurar **solo uno** de los dos proveedores. El que no configures aparecerá como "No configurado".

---

## 4) Cómo conecta cada abogado

1. Inicia sesión y ve a **Mi perfil → Mis conexiones** (cada abogado conecta su propia cuenta; también hay un acceso directo desde *Captura inteligente*).
2. Pulsa **Conectar** en Google Workspace o Microsoft 365.
3. Acepta el consentimiento (pantalla del proveedor).
4. Vuelves a la app con la cuenta conectada (verás el correo y la fecha de última sincronización).

A partir de ahí, **Capturar mi día** (o el cron diario) incluirá tus reuniones y correos enviados como sugerencias privadas, con su glosa redactada por la IA, listas para aprobar.

Para revocar: **Conexiones → Desconectar** (borra los tokens de la firma). También puedes revocar el acceso desde la cuenta Google/Microsoft del abogado.

---

## 5) Seguridad y privacidad

- Acceso **de solo lectura**; nunca se envían correos ni se modifican calendarios.
- De los correos solo se leen **metadatos** (asunto, destinatario, fecha) — no el cuerpo.
- Los tokens se almacenan **cifrados** y en una tabla accesible **solo desde el servidor** (RLS).
- Cada abogado ve **únicamente** sus propias sugerencias; nada se factura hasta que él lo apruebe.
