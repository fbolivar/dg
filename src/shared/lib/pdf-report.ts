"use client"
// Generador de reportes PDF con identidad visual DG&A.
// Abre una ventana de impresión con membrete corporativo (navy + gold, logo, serif)
// y dispara el diálogo de impresión / "Guardar como PDF" del navegador.

type Cell = string | number
export interface ReportTable {
  columns: string[]
  rows: Cell[][]
  align?: ('left' | 'right' | 'center')[]
}
export interface ReportKpi { label: string; value: string; sub?: string }
export interface ReportImage { dataUrl: string; caption?: string }
export interface ReportSection {
  heading?: string
  kpis?: ReportKpi[]
  images?: ReportImage[]
  table?: ReportTable
  note?: string
}
export interface BrandedReportOptions {
  title: string
  subtitle?: string
  metaLine?: string
  filtersLine?: string
  sections: ReportSection[]
  totalsLine?: string
}

const esc = (s: Cell) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const alignClass = (a?: 'left' | 'right' | 'center') => a === 'right' ? ' class="right"' : a === 'center' ? ' class="center"' : ''

function kpisHtml(kpis: ReportKpi[]): string {
  return `<div class="kpis">${kpis.map(k => `
    <div class="kpi">
      <div class="kpi-val">${esc(k.value)}</div>
      <div class="kpi-label">${esc(k.label)}</div>
      ${k.sub ? `<div class="kpi-sub">${esc(k.sub)}</div>` : ''}
    </div>`).join('')}</div>`
}

function tableHtml(t: ReportTable): string {
  const head = t.columns.map((c, i) => `<th${alignClass(t.align?.[i])}>${esc(c)}</th>`).join('')
  const body = t.rows.length
    ? t.rows.map(r => `<tr>${r.map((c, i) => `<td${alignClass(t.align?.[i])}>${esc(c)}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${t.columns.length}" class="empty">Sin datos para los filtros seleccionados.</td></tr>`
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
}

function imagesHtml(images: ReportImage[]): string {
  return `<div class="charts">${images.map(im => `
    <figure class="chart">
      <img src="${im.dataUrl}" alt="${esc(im.caption ?? '')}" />
      ${im.caption ? `<figcaption>${esc(im.caption)}</figcaption>` : ''}
    </figure>`).join('')}</div>`
}

function sectionHtml(s: ReportSection): string {
  return [
    s.heading ? `<h2>${esc(s.heading)}</h2>` : '',
    s.kpis ? kpisHtml(s.kpis) : '',
    s.images && s.images.length ? imagesHtml(s.images) : '',
    s.table ? tableHtml(s.table) : '',
    s.note ? `<p class="note">${esc(s.note)}</p>` : '',
  ].join('')
}

export function openBrandedReport(opts: BrandedReportOptions): boolean {
  const origin = window.location.origin
  const year = new Date().getFullYear()
  const sections = opts.sections.map(sectionHtml).join('')

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>${esc(opts.title)} — DG&amp;A</title>
<style>
  * { box-sizing: border-box; }
  @page { size: A4; margin: 14mm 12mm 16mm; }
  body { font-family: Helvetica, Arial, sans-serif; color: #1A2B4A; margin: 0; font-size: 11px; }
  .header { display: flex; align-items: center; justify-content: space-between; background: #1A2B4A; padding: 14px 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .header img { height: 36px; object-fit: contain; }
  .header .tag { color: #D4AF50; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; font-weight: 600; text-align: right; line-height: 1.5; }
  .goldrule { height: 3px; background: linear-gradient(90deg, #B8962E, #D4AF50); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .body { padding: 18px 6px 30px; }
  h1 { font-family: Georgia, 'Times New Roman', serif; font-size: 22px; margin: 6px 0 2px; color: #1A2B4A; }
  .subtitle { color: #475569; font-size: 12px; margin: 0 0 3px; }
  .meta { color: #94a3b8; font-size: 10px; margin: 0; }
  .filters { color: #475569; font-size: 10px; margin: 10px 0 0; padding: 7px 11px; background: #f4f6f8; border-left: 3px solid #B8962E; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h2 { font-family: Georgia, serif; font-size: 13px; color: #1A2B4A; margin: 22px 0 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  .kpis { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 4px; }
  .kpi { flex: 1 1 150px; border: 1px solid #e2e8f0; border-top: 3px solid #B8962E; border-radius: 6px; padding: 10px 12px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .kpi-val { font-size: 20px; font-weight: 700; color: #1A2B4A; line-height: 1.1; }
  .kpi-label { font-size: 10px; font-weight: 600; margin-top: 3px; }
  .kpi-sub { font-size: 9px; color: #94a3b8; margin-top: 1px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; margin: 4px 0; }
  th { background: #1A2B4A; color: #fff; text-align: left; padding: 6px 8px; font-size: 9px; text-transform: uppercase; letter-spacing: .03em; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  td { padding: 5px 8px; border-bottom: 1px solid #e8edf2; }
  tbody tr:nth-child(even) td { background: #f7f9fb; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  td.empty { text-align: center; color: #94a3b8; padding: 14px; }
  .right { text-align: right; } .center { text-align: center; }
  thead { display: table-header-group; } tr { page-break-inside: avoid; }
  .totals { margin-top: 16px; padding: 11px 15px; background: #fbf7ec; border: 1px solid #e8d9a8; border-radius: 6px; font-weight: 700; font-size: 12px; color: #1A2B4A; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .charts { display: flex; flex-wrap: wrap; gap: 12px; margin: 8px 0; }
  .chart { flex: 1 1 320px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; background: #fff; page-break-inside: avoid; }
  .chart img { width: 100%; height: auto; display: block; }
  .chart figcaption { font-size: 9px; color: #64748b; text-align: center; margin-top: 6px; }
  .note { font-size: 10px; color: #64748b; margin: 6px 0; }
  .footer { position: fixed; bottom: 0; left: 0; right: 0; padding: 6px 12px; font-size: 8px; color: #94a3b8; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .toolbar { position: fixed; top: 12px; right: 12px; }
  .toolbar button { background: #1A2B4A; color: #fff; border: none; padding: 9px 16px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,.18); }
  .toolbar button:hover { background: #243860; }
  @media screen { body { background: #e9edf2; } .page { max-width: 820px; margin: 24px auto 60px; background: #fff; box-shadow: 0 6px 28px rgba(0,0,0,.12); border-radius: 8px; overflow: hidden; } }
  @media print { .no-print { display: none !important; } .page { box-shadow: none; } }
</style></head>
<body>
  <div class="no-print toolbar"><button onclick="window.print()">⇩ Guardar como PDF / Imprimir</button></div>
  <div class="page">
    <div class="header">
      <img src="${origin}/logo.png" alt="DG&amp;A Abogados" />
      <div class="tag">Legal Intelligence Desk<br/>Reporte confidencial</div>
    </div>
    <div class="goldrule"></div>
    <div class="body">
      <h1>${esc(opts.title)}</h1>
      ${opts.subtitle ? `<p class="subtitle">${esc(opts.subtitle)}</p>` : ''}
      ${opts.metaLine ? `<p class="meta">${esc(opts.metaLine)}</p>` : ''}
      ${opts.filtersLine ? `<div class="filters">${esc(opts.filtersLine)}</div>` : ''}
      ${sections}
      ${opts.totalsLine ? `<div class="totals">${esc(opts.totalsLine)}</div>` : ''}
    </div>
  </div>
  <div class="footer">
    <span>DG&amp;A Abogados · Documento confidencial — uso interno</span>
    <span>Generado por DG&amp;A Legal Intelligence Desk · ${year}</span>
  </div>
  <script>
    (function () {
      function go() { try { window.focus(); window.print(); } catch (e) {} }
      var imgs = Array.prototype.slice.call(document.images);
      var pending = imgs.filter(function (i) { return !i.complete; });
      if (!pending.length) { setTimeout(go, 350); return; }
      var done = 0;
      function tick() { if (++done >= pending.length) setTimeout(go, 150); }
      pending.forEach(function (i) { i.addEventListener('load', tick); i.addEventListener('error', tick); });
      setTimeout(go, 2500);
    })();
  </script>
</body></html>`

  const w = window.open('', '_blank')
  if (!w) return false
  w.document.write(html)
  w.document.close()
  return true
}
