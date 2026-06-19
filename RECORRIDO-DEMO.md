# Recorrido guiado del prototipo — DG&A Legal Intelligence Desk

Guía rápida para presentar el prototipo poblado con datos de demostración.

## Cómo arrancarlo

```bash
npm run dev
```

Luego abre **http://localhost:3000** (idealmente en pantalla completa, F11).

> El prototipo está en **modo demostración**: se alimenta de datos de demostración
> (`src/shared/data/mock.ts`), no de Supabase. Esto se controla con la variable
> `NEXT_PUBLIC_USE_MOCK=true` en `.env.local`. Para volver a producción (Supabase),
> ponla en `false`.

## Ruta sugerida (5 pasos, ~3–4 min)

1. **Inicio (Dashboard)** — Panel ejecutivo: KPIs, actividad mensual, semáforo de riesgo por área, vencimientos.
2. **Monitor normativo** — Alertas regulatorias clasificadas por impacto y área. Filtros y estados.
3. **Legal Notes** — Boletines generados con IA, en distintos estados (borrador, en revisión, aprobado, publicado).
4. **Portal del cliente** — Arriba a la derecha, cambia el rol de demostración a **"Cliente"**. Verás el portal con la marca de la firma (Andina Retail), sus alertas y asuntos.
5. **Copiloto DG&A** — Asistente jurídico (ver nota de la API key abajo).

> Tip: el selector **"Demo: Socio / Asociado / Administrador / Cliente"** en la barra superior
> permite mostrar en vivo cómo cambia la vista según el rol. Útil para ilustrar el control de acceso.

## ⚠️ Importante — funciones de IA en vivo

El **Copiloto** y la **generación de Legal Notes** llaman a la API de Claude y requieren
una **API key real de Anthropic** en `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...   # actualmente es un placeholder → da error 401
```

- **Con** key válida: puedes hacer una consulta en vivo en el Copiloto (el mejor momento de la demo).
- **Sin** key: NO hagas la consulta en vivo. Muestra las Legal Notes ya generadas (su contenido es
  visible en el prototipo) y explica la generación como parte del piloto.

## Respaldo

Capturas de todas las pantallas en `demo-capturas/` por si falla el arranque en vivo.

## Estado honesto

Esto es un **prototipo funcional** con datos de demostración, no el sistema en producción.
Lo pendiente para producción: autenticación real, datos reales de la firma, y conexión a Supabase.
