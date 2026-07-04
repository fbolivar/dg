// Exporta una Legal Note al formato de marca "Nota Legal" de DG&A.
// Abre una vista imprimible (nueva pestaña) que el usuario guarda como PDF.
// El contenido del borrador se convierte a la maqueta: '### ' → encabezado de
// sección; '• ' o '- ' → viñetas; '**texto**' → negrilla.
import type { LegalNote } from '@/shared/types'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function inline(s: string): string {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

function renderBody(text: string): string {
  const lines = (text || '').split(/\r?\n/)
  let html = ''
  let inList = false
  const closeList = () => { if (inList) { html += '</ul>'; inList = false } }
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) { closeList(); continue }
    if (/^#{2,3}\s+/.test(line)) { closeList(); html += `<div class="sec-h">${inline(line.replace(/^#{2,3}\s+/, ''))}</div>`; continue }
    if (/^[-•]\s+/.test(line)) { if (!inList) { html += '<ul>'; inList = true } html += `<li>${inline(line.replace(/^[-•]\s+/, ''))}</li>`; continue }
    closeList(); html += `<p>${inline(line)}</p>`
  }
  closeList()
  return html || '<p class="muted">Sin contenido.</p>'
}

export function buildNotaLegalHtml(note: LegalNote): string {
  const fecha = new Date(note.created_at || Date.now())
    .toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
  const body = renderBody(note.content_draft || note.content_summary || '')
  const titulo = esc(note.title || 'Nota Legal')

  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${titulo}</title>
<style>
  :root{--navy:#1c2b48;--gold:#9a7c48;--gold-l:#b8965a;--blue-l:#c7d0e0;--ink:#23282f;--muted:#5a6472;--soft:#f3f1ea;--line:#e2ddd2;}
  *{box-sizing:border-box;} html,body{margin:0;padding:0;}
  body{font-family:"Calibri","Helvetica Neue",Arial,sans-serif;color:var(--ink);font-size:11pt;line-height:1.45;}
  @page{size:A4;margin:16mm 0 14mm;}
  .band{background:var(--navy);color:#fff;padding:11mm 16mm 8mm;display:flex;align-items:center;gap:9mm;}
  .band .nl{font-family:"Georgia","Times New Roman",serif;font-size:34pt;color:var(--blue-l);line-height:.9;}
  .band .div{width:2px;align-self:stretch;background:var(--gold-l);margin:2mm 0;}
  .band .info{font-size:11.5pt;line-height:1.25;} .band .info .city{font-style:italic;color:#c9d2e2;font-size:10pt;}
  .wrap{padding:8mm 16mm 0;}
  .title{border:1.5px solid var(--navy);border-radius:2px;padding:7px 12px;text-align:center;margin:0 0 12px;}
  .title h1{font-family:"Georgia",serif;color:var(--navy);font-size:15pt;margin:0;line-height:1.15;}
  p{margin:0 0 8px;text-align:justify;} .muted{color:var(--muted);}
  strong{color:var(--navy);}
  .sec-h{background:var(--gold);color:#fff;font-weight:700;font-size:10.5pt;padding:5px 11px;border-radius:2px;margin:14px 0 7px;letter-spacing:.3px;break-after:avoid;}
  ul{margin:4px 0 9px;padding-left:18px;} li{margin:3px 0;}
  .brand{margin-top:12mm;}
  .brand .dga{font-family:"Georgia",serif;font-weight:700;color:var(--navy);font-size:24pt;letter-spacing:2px;line-height:1;}
  .brand .abg{font-size:9pt;letter-spacing:6px;color:var(--navy);border-top:1.5px solid var(--gold);display:inline-block;padding-top:2px;margin-top:1px;}
  .notebox{border:1px solid var(--navy);margin:8mm 16mm 0;padding:9px 12px;font-size:8pt;color:#3a424e;line-height:1.4;break-inside:avoid;}
  .notebox .head{font-weight:700;color:var(--navy);margin-bottom:2px;} .notebox b{color:var(--navy);}
  .notebox .unsub{text-align:center;font-weight:700;color:var(--navy);margin-top:5px;}
  .contact{text-align:center;color:var(--muted);font-size:8pt;margin:5mm 16mm 0;line-height:1.5;}
  @media screen{ body{background:#e9e7e1;} .sheet{background:#fff;max-width:210mm;margin:14px auto;box-shadow:0 2px 12px rgba(0,0,0,.15);} }
</style></head><body>
<div class="sheet">
  <div class="band">
    <div class="nl">Nota Legal</div><div class="div"></div>
    <div class="info"><b>Información jurídica de</b><br><b>Duarte García Abogados</b><br>
    <span class="city">Bogotá D.C., ${esc(fecha)}</span></div>
  </div>
  <div class="wrap">
    <div class="title"><h1>${titulo}</h1></div>
    ${body}
    <div class="brand"><div class="dga">DG&amp;A</div><div class="abg">A B O G A D O S</div></div>
  </div>
  <div class="notebox">
    <div class="head">NOTA:</div>
    Los documentos a que alude esta <b>NOTA LEGAL</b> pueden ser consultados en nuestra página web www.col-law.com.
    También pueden ser solicitados vía correo electrónico a dga@col-law.com, telefónicamente al número +57 (1) 217 08 00
    o al número +57 315 367 56 67.<br>
    La <b>NOTA LEGAL</b> es un documento de carácter informativo elaborado por <b>Duarte García Abogados S.A.S. (DG&amp;A – Abogados)</b>
    para sus clientes y para todas aquellas personas que estén interesadas en el mismo, y en consecuencia no puede ser considerado
    como un consejo o recomendación legal brindada por Duarte García Abogados.
    <div class="unsub">* Si no desea recibir más notas legales de DG&amp;A, por favor escriba un correo electrónico a dga@col-law.com *</div>
  </div>
  <div class="contact">Carrera 13 No. 96-67 Ofc. 604, Bogotá, D.C., Colombia · Tel.: +57 1 217 08 00 · Cel: +57 315 367 56 67 · www.col-law.com · dga@col-law.com</div>
</div>
<script>window.onload=function(){setTimeout(function(){window.print();},350);};</script>
</body></html>`
}

/** Abre la Nota Legal maquetada en una pestaña nueva y lanza el diálogo de impresión (Guardar como PDF). */
export function printNotaLegal(note: LegalNote): void {
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(buildNotaLegalHtml(note))
  w.document.close()
}
