// Exporta una Legal Note al formato de marca "Nota Legal" de DG&A.
// Abre una vista imprimible (nueva pestaña) y lanza el diálogo de impresión.
// Claves para que el PDF guardado sea IDÉNTICO a la vista:
//   - print-color-adjust: exact → fuerza los fondos de color/imagen al imprimir.
//   - @page { margin: 0 } → suprime encabezados/pies del navegador.
// El logo DG&A se carga desde /LogoDGyA.png (public/).
import type { LegalNote } from '@/shared/types'

const NAVY = '#1c2b48', GOLD = '#9a7c48', GOLD_L = '#b8965a', BLUE_L = '#c7d0e0', MUTED = '#5a6472'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function inline(s: string): string {
  return esc(s).replace(/\*\*(.+?)\*\*/g, `<strong style="color:${NAVY}">$1</strong>`)
}

// Convierte el borrador a la maqueta: '### ' → encabezado de sección;
// '• '/'- ' → viñetas; '**texto**' → negrilla.
function renderBody(text: string): string {
  const secH = `margin:16px 26px 8px;background:${GOLD};color:#fff;font-weight:700;font-size:14px;padding:6px 12px;border-radius:2px;`
  const p = `margin:0 26px 8px;text-align:justify;font-size:14px;color:#23282f;`
  const lines = (text || '').split(/\r?\n/)
  let html = ''
  let inList = false
  const closeList = () => { if (inList) { html += '</ul>'; inList = false } }
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) { closeList(); continue }
    if (/^#{2,3}\s+/.test(line)) { closeList(); html += `<div style="${secH}">${inline(line.replace(/^#{2,3}\s+/, ''))}</div>`; continue }
    if (/^[-•]\s+/.test(line)) { if (!inList) { html += `<ul style="margin:5px 44px 10px;padding:0;font-size:14px;color:#23282f;">`; inList = true } html += `<li style="margin:3px 0;">${inline(line.replace(/^[-•]\s+/, ''))}</li>`; continue }
    closeList(); html += `<p style="${p}">${inline(line)}</p>`
  }
  closeList()
  return html || `<p style="${p};color:${MUTED}">Sin contenido.</p>`
}

function buildContent(note: LegalNote): string {
  const fecha = new Date(note.created_at || Date.now())
    .toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
  const body = renderBody(note.content_draft || note.content_summary || '')
  const titulo = esc(note.title || 'Nota Legal')
  // URL absoluta: la pestaña de impresión es about:blank y no resuelve rutas relativas.
  const logo = `${typeof window !== 'undefined' ? window.location.origin : ''}/LogoDGyA.png`
  return `
<div style="font-family:Calibri,'Helvetica Neue',Arial,sans-serif;background:#fff;">
  <div style="background:${NAVY};color:#fff;padding:22px 26px 16px;display:flex;align-items:center;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:46px;color:${BLUE_L};line-height:.9;">Nota Legal</div>
    <div style="width:2px;height:52px;background:${GOLD_L};margin:0 22px;"></div>
    <div style="font-size:16px;line-height:1.35;">
      <b>Información jurídica de</b><br><b>Duarte García Abogados</b><br>
      <span style="font-style:italic;color:#c9d2e2;font-size:14px;">Bogotá D.C., ${esc(fecha)}</span>
    </div>
  </div>
  <div style="margin:20px 26px 14px;border:1.5px solid ${NAVY};border-radius:2px;padding:8px 14px;text-align:center;">
    <div style="font-family:Georgia,serif;color:${NAVY};font-size:20px;line-height:1.15;">${titulo}</div>
  </div>
  ${body}
  <div style="padding:22px 26px 4px;"><img src="${logo}" alt="DG&A Abogados" style="height:64px;width:auto;display:block;" /></div>
  <div style="margin:10px 26px 0;border:1px solid ${NAVY};padding:10px 14px;font-size:11px;color:#3a424e;line-height:1.45;">
    <div style="font-weight:700;color:${NAVY};margin-bottom:3px;">NOTA:</div>
    Los documentos a que alude esta <b style="color:${NAVY}">NOTA LEGAL</b> pueden ser consultados en nuestra página web www.col-law.com.
    También pueden ser solicitados vía correo electrónico a dga@col-law.com, telefónicamente al número +57 (1) 217 08 00
    o al número +57 315 367 56 67.<br>
    La <b style="color:${NAVY}">NOTA LEGAL</b> es un documento de carácter informativo elaborado por <b style="color:${NAVY}">Duarte García Abogados S.A.S. (DG&amp;A – Abogados)</b>
    para sus clientes y para todas aquellas personas que estén interesadas en el mismo, y en consecuencia no puede ser considerado
    como un consejo o recomendación legal brindada por Duarte García Abogados.
    <div style="text-align:center;font-weight:700;color:${NAVY};margin-top:6px;">* Si no desea recibir más notas legales de DG&amp;A, escriba a dga@col-law.com *</div>
  </div>
  <div style="text-align:center;color:${MUTED};font-size:11px;margin:8px 26px 18px;line-height:1.5;">Carrera 13 No. 96-67 Ofc. 604, Bogotá, D.C., Colombia · Tel.: +57 1 217 08 00 · Cel: +57 315 367 56 67 · www.col-law.com · dga@col-law.com</div>
</div>`
}

function buildFullHtml(note: LegalNote): string {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${esc(note.title || 'Nota Legal')}</title>
<style>
  @page{ size:A4; margin:0; }
  html,body{ margin:0; padding:0; background:#fff; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  *{ -webkit-print-color-adjust:exact; print-color-adjust:exact; box-sizing:border-box; }
  body{ padding:7mm 6mm; }
  @media screen{
    body{ background:#e9e7e1; }
    .sheet{ background:#fff; max-width:210mm; margin:14px auto; box-shadow:0 2px 14px rgba(0,0,0,.18); }
    .hint{ text-align:center; font-family:Arial,sans-serif; font-size:12px; color:#555; margin:10px auto 0; }
  }
  @media print{ .hint{ display:none; } }
</style></head>
<body>
  <div class="hint">Se abrió el diálogo de impresión. Elige <b>«Guardar como PDF»</b>. Los fondos ya vienen activados.</div>
  <div class="sheet">${buildContent(note)}</div>
  <script>window.onload=function(){setTimeout(function(){window.print();},450);};</script>
</body></html>`
}

/** Abre la Nota Legal maquetada (marca DG&A) y lanza «Guardar como PDF» con los fondos activados. */
export function downloadNotaLegalPdf(note: LegalNote): void {
  const w = window.open('', '_blank')
  if (!w) return
  w.document.open()
  w.document.write(buildFullHtml(note))
  w.document.close()
}
