import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import { formatMonthLong, formatMonthShort, safeNumber } from './format'
import { getCampaignPlatform, tipoCampanaToBucket, bucketToLabel } from './campaigns'

// ─── Helpers ────────────────────────────────────────────────────────────────
const v   = (val) => safeNumber(val, 0)
const fN  = (val) => v(val).toLocaleString('es-MX')
const fC  = (val) => `$${v(val).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`
const fP  = (val) => { const r = v(val); return r === 0 ? '0%' : `${r.toFixed(1)}%` }
const vari = (act, ant) => {
  if (ant === 0) return act > 0 ? '+Nuevo' : '—'
  const p = ((act - ant) / ant) * 100
  return `${p > 0 ? '+' : ''}${p.toFixed(1)}%`
}
const prevMes = (m) => {
  if (!m?.includes('-')) return null
  const [y, mo] = m.split('-').map(Number)
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`
}
const clamp = (val, min, max) => Math.min(Math.max(val, min), max)

// Brand palettes
const BRAND_COLORS = {
  botanera: { main: [255, 107, 0],   light: [255, 237, 213], dark: [154, 52, 18]  },
  chamoy:   { main: [168, 85, 247],  light: [243, 232, 255], dark: [88,  28, 135] },
  pacific:  { main: [59,  130, 246], light: [219, 234, 254], dark: [30,  64, 175] },
  default:  { main: [99,  102, 241], light: [224, 231, 255], dark: [55,  48, 163] },
}

// ─── Drawing primitives ─────────────────────────────────────────────────────

function drawRoundRect(pdf, x, y, w, h, r, fill) {
  // Simple rounded rect via lineTo arcs
  pdf.setFillColor(...fill)
  pdf.roundedRect(x, y, w, h, r, r, 'F')
}

function drawKPICard(pdf, x, y, w, h, label, value, subtext, palette, accentOverride) {
  const accent = accentOverride || palette.main
  drawRoundRect(pdf, x, y, w, h, 2, [248, 250, 255])
  // left accent bar
  pdf.setFillColor(...accent)
  pdf.rect(x, y, 2.5, h, 'F')
  // label
  pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(120)
  pdf.text(label.toUpperCase(), x + 5, y + 5.5)
  // value
  pdf.setFontSize(14); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...accent)
  pdf.text(String(value), x + 5, y + 13)
  // subtext
  if (subtext) {
    pdf.setFontSize(6); pdf.setFont('helvetica', 'normal')
    const isPos = String(subtext).startsWith('+')
    const isNeg = String(subtext).startsWith('-')
    pdf.setTextColor(isPos ? 22 : isNeg ? 220 : 100, isPos ? 163 : isNeg ? 38 : 100, isPos ? 74 : isNeg ? 38 : 100)
    pdf.text(String(subtext), x + 5, y + 18)
  }
  // thin border
  pdf.setDrawColor(220); pdf.setLineWidth(0.2)
  pdf.roundedRect(x, y, w, h, 2, 2, 'S')
}

function drawProgressBar(pdf, x, y, w, h, pct, palette) {
  const filled = clamp(pct, 0, 1)
  // background
  pdf.setFillColor(230, 230, 235)
  pdf.roundedRect(x, y, w, h, h / 2, h / 2, 'F')
  // fill
  const color = pct >= 1 ? [22, 163, 74] : pct < 0.7 ? [220, 38, 38] : [217, 119, 6]
  pdf.setFillColor(...color)
  if (filled > 0) pdf.roundedRect(x, y, w * filled, h, h / 2, h / 2, 'F')
}

function drawMiniBarChart(pdf, x, y, w, h, dataPoints, palette) {
  if (!dataPoints || dataPoints.length === 0) return
  const maxVal = Math.max(...dataPoints.map(d => d.value), 1)
  const barW   = (w - (dataPoints.length - 1) * 1.5) / dataPoints.length
  // grid line
  pdf.setDrawColor(230); pdf.setLineWidth(0.2)
  pdf.line(x, y + h - 8, x + w, y + h - 8)

  dataPoints.forEach((d, i) => {
    const barH  = Math.max(((d.value / maxVal) * (h - 10)), 1)
    const bx    = x + i * (barW + 1.5)
    const by    = y + h - 8 - barH
    const isLast = i === dataPoints.length - 1
    pdf.setFillColor(...(isLast ? palette.main : palette.light))
    pdf.roundedRect(bx, by, barW, barH, 0.5, 0.5, 'F')
    // label below
    pdf.setFontSize(4.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(120)
    const lbl = String(d.label || '').slice(0, 4)
    pdf.text(lbl, bx + barW / 2, y + h - 2, { align: 'center' })
  })
}

// ─── Layout helpers ─────────────────────────────────────────────────────────

function makeFooter(pdf, brandName, label, pageNum, W, H, M) {
  pdf.setDrawColor(210); pdf.setLineWidth(0.25)
  pdf.line(M, H - 9, W - M, H - 9)
  pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(160)
  pdf.text(`${brandName}  ·  ${label}  ·  Confidencial`, M, H - 5)
  pdf.text(`${pageNum}`, W - M, H - 5, { align: 'right' })
}

function sectionHeader(pdf, title, palette, W, M) {
  pdf.setFillColor(...palette.main)
  pdf.rect(0, 0, W, 18, 'F')
  // subtle second stripe
  pdf.setFillColor(...palette.dark)
  pdf.rect(0, 14, W, 4, 'F')
  pdf.setFontSize(15); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(255)
  pdf.text(title, M, 12)
  return 26
}

function subHead(pdf, y, text, palette, M) {
  pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...palette.main)
  pdf.text(text.toUpperCase(), M, y)
  pdf.setDrawColor(...palette.light); pdf.setLineWidth(0.4)
  pdf.line(M, y + 1, M + 60, y + 1)
  pdf.setFont('helvetica', 'normal'); pdf.setTextColor(50)
  return y + 6
}

function tbl(pdf, sy, head, body, opts = {}) {
  pdf.autoTable({
    startY: sy,
    head:   [head],
    body,
    margin: { left: opts.marginLeft ?? 14, right: 14 },
    styles: {
      fontSize: 7.5, cellPadding: { top: 2.2, bottom: 2.2, left: 3, right: 3 },
      lineColor: [228, 228, 235], lineWidth: 0.2,
      textColor: [30, 30, 45], font: 'helvetica',
    },
    headStyles: {
      fillColor: opts.headColor ?? [30, 30, 50],
      textColor: 255, fontStyle: 'bold', fontSize: 7.2, halign: 'center',
    },
    alternateRowStyles: { fillColor: [249, 249, 253] },
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index > 0) d.cell.styles.halign = 'center'
    },
    ...opts,
  })
  return pdf.lastAutoTable.finalY + 4
}

function checkPB(pdf, y, needed, npFn) {
  const H = pdf.internal.pageSize.getHeight()
  if (y > H - needed) { npFn(); return 26 }
  return y
}

// ─── MAIN EXPORT ────────────────────────────────────────────────────────────
export async function exportDashboardPDF({
  brandConfig, filteredData, allData, selectedMonth, features, onProgress,
}) {
  const marcaId   = brandConfig?.marca_id || brandConfig?.id || 'default'
  const brandName = brandConfig?.nombre || 'Dashboard'
  const palette   = BRAND_COLORS[marcaId] || BRAND_COLORS.default
  const label     = formatMonthLong(selectedMonth)
  const mesAnt    = prevMes(selectedMonth)

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W   = pdf.internal.pageSize.getWidth()   // 297
  const H   = pdf.internal.pageSize.getHeight()  // 210
  const M   = 14

  const getH = (p, m) =>
    (Array.isArray(allData?.[p]) ? allData[p] : []).find(r => r.mes === m) || {}

  // page tracking for TOC links
  const sections = []   // { title, page, id }
  let pageNum = 1

  const np = () => {
    makeFooter(pdf, brandName, label, pageNum, W, H, M)
    pdf.addPage()
    pageNum++
  }

  const newSection = (title) => {
    np()
    const id = `sec_${sections.length}`
    sections.push({ title, page: pageNum, id })
    // add named destination for internal link
    pdf.link(0, 0, W, H, { pageNumber: pageNum })
    return { y: sectionHeader(pdf, title, palette, W, M), id }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PORTADA
  // ══════════════════════════════════════════════════════════════════════════
  onProgress?.(0, 10, 'Portada')

  // Background gradient effect (two rects)
  pdf.setFillColor(...palette.dark)
  pdf.rect(0, 0, W, H, 'F')
  pdf.setFillColor(...palette.main)
  pdf.rect(0, 0, W * 0.58, H, 'F')

  // Decorative circles
  pdf.setFillColor(...palette.dark)
  pdf.circle(W * 0.58 + 30, -10, 50, 'F')
  pdf.setFillColor(...palette.light.map ? palette.light : [220, 220, 255])
  pdf.setFillColor(palette.light[0], palette.light[1], palette.light[2])
  pdf.circle(W * 0.58 + 60, H + 10, 40, 'F')

  // Left panel — brand + title
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9); pdf.setTextColor(255, 255, 255)
  pdf.text('REPORTE MENSUAL DE PERFORMANCE', M, 28)

  pdf.setFontSize(34); pdf.setTextColor(255)
  pdf.text(brandName, M, 50)

  pdf.setFontSize(14); pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(255, 255, 255)
  pdf.text(label, M, 62)

  // Divider
  pdf.setDrawColor(255, 255, 255); pdf.setLineWidth(0.4)
  pdf.line(M, 68, M + 80, 68)

  pdf.setFontSize(7.5); pdf.setTextColor(220, 220, 255)
  pdf.text(`Generado: ${new Date().toLocaleString('es-MX')}`, M, 74)
  pdf.text('Documento confidencial', M, 79)

  // Right panel — KPI summary cards
  const cardX = W * 0.58 + 8
  const cardW = (W - cardX - M - 6) / 2

  const fbD  = getH('facebook',  selectedMonth)
  const igD  = getH('instagram', selectedMonth)
  const ttD  = getH('tiktok',    selectedMonth)
  const totSeg = v(fbD.seguidores) + v(igD.seguidores) + v(ttD.seguidores)
  const totAlc = v(fbD.alcance)    + v(igD.alcance)    + v(ttD.views)
  const totInt = v(fbD.interacciones) + v(igD.interacciones) + v(ttD.interacciones)
  const totInv = (filteredData.campanas  || []).reduce((s, r) => s + v(r.inversion), 0)
               + (filteredData.googleAds || []).reduce((s, r) => s + v(r.inversion), 0)

  const coverKPIs = [
    { label: 'Total Seguidores',   value: fN(totSeg) },
    { label: 'Alcance / Views',    value: fN(totAlc) },
    { label: 'Interacciones',      value: fN(totInt) },
    { label: 'Inversión Total',    value: fC(totInv) },
    { label: 'Facebook Seg.',      value: fN(fbD.seguidores) },
    { label: 'Instagram Seg.',     value: fN(igD.seguidores) },
    { label: 'TikTok Views',       value: fN(ttD.views) },
    { label: 'Engagement FB',      value: fP(fbD.engagement_rate) },
  ]
  coverKPIs.forEach((kpi, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const cx  = cardX + col * (cardW + 3)
    const cy  = 18 + row * 28
    drawRoundRect(pdf, cx, cy, cardW, 24, 2, [255, 255, 255])
    pdf.setFontSize(6); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(100)
    pdf.text(kpi.label.toUpperCase(), cx + 4, cy + 6)
    pdf.setFontSize(12); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...palette.dark)
    pdf.text(kpi.value, cx + 4, cy + 15)
    pdf.setDrawColor(230); pdf.setLineWidth(0.2)
    pdf.roundedRect(cx, cy, cardW, 24, 2, 2, 'S')
  })

  makeFooter(pdf, brandName, label, pageNum, W, H, M)

  // ══════════════════════════════════════════════════════════════════════════
  // ÍNDICE (se llenará después — guardamos página)
  // ══════════════════════════════════════════════════════════════════════════
  pdf.addPage(); pageNum++
  const tocPage = pageNum

  // ══════════════════════════════════════════════════════════════════════════
  // RESUMEN GENERAL
  // ══════════════════════════════════════════════════════════════════════════
  onProgress?.(1, 10, 'Resumen general')
  let { y } = newSection('Resumen General')

  const prevFb  = getH('facebook',  mesAnt)
  const prevIg  = getH('instagram', mesAnt)
  const prevTt  = getH('tiktok',    mesAnt)
  const pSeg    = v(prevFb.seguidores) + v(prevIg.seguidores) + v(prevTt.seguidores)
  const pAlc    = v(prevFb.alcance)    + v(prevIg.alcance)    + v(prevTt.views)
  const pInt    = v(prevFb.interacciones) + v(prevIg.interacciones) + v(prevTt.interacciones)

  // KPI cards row
  const kpiW = (W - M * 2 - 9) / 4
  const kpiH = 24
  ;[
    { label: 'Total Seguidores', value: fN(totSeg), sub: vari(totSeg, pSeg) },
    { label: 'Alcance / Views',  value: fN(totAlc), sub: vari(totAlc, pAlc) },
    { label: 'Interacciones',    value: fN(totInt), sub: vari(totInt, pInt) },
    { label: 'Inversión Total',  value: fC(totInv), sub: '' },
  ].forEach((k, i) => {
    drawKPICard(pdf, M + i * (kpiW + 3), y, kpiW, kpiH, k.label, k.value, k.sub, palette)
  })
  y += kpiH + 6

  y = subHead(pdf, y, 'Comparativo por plataforma', palette, M)
  y = tbl(pdf, y,
    ['Plataforma', 'Seguidores', 'vs Ant.', 'Alcance/Views', 'vs Ant.', 'Interacciones', 'vs Ant.', 'Inversión'],
    ['facebook', 'instagram', 'tiktok'].map(p => {
      const a = filteredData[p] || {}
      const b = getH(p, mesAnt)
      const alcF = p === 'tiktok' ? 'views' : 'alcance'
      return [
        p.charAt(0).toUpperCase() + p.slice(1),
        fN(a.seguidores),    vari(v(a.seguidores),    v(b.seguidores)),
        fN(a[alcF]),         vari(v(a[alcF]),         v(b[alcF])),
        fN(a.interacciones), vari(v(a.interacciones), v(b.interacciones)),
        fC(a.inversion),
      ]
    }),
    {
      headColor: palette.main,
      didParseCell: (d) => {
        if (d.section === 'body' && [2, 4, 6].includes(d.column.index)) {
          const s = String(d.cell.raw || '')
          d.cell.styles.fontStyle = 'bold'
          if (s.startsWith('+'))      d.cell.styles.textColor = [22, 163, 74]
          else if (s.startsWith('-')) d.cell.styles.textColor = [220, 38, 38]
        }
        if (d.section === 'body' && d.column.index > 0) d.cell.styles.halign = 'center'
      },
    },
  )

  // ══════════════════════════════════════════════════════════════════════════
  // PLATAFORMAS
  // ══════════════════════════════════════════════════════════════════════════
  const platConfigs = [
    { key: 'facebook',  label: 'Facebook',  reach: 'alcance' },
    { key: 'instagram', label: 'Instagram', reach: 'alcance' },
    { key: 'tiktok',    label: 'TikTok',    reach: 'views'   },
  ]

  for (let pi = 0; pi < platConfigs.length; pi++) {
    const pc  = platConfigs[pi]
    onProgress?.(pi + 2, 10, pc.label)
    ;({ y } = newSection(pc.label))

    const act  = filteredData[pc.key] || {}
    const ant  = getH(pc.key, mesAnt)
    const alcF = pc.reach

    // KPI cards — 5 across
    const pkW = (W - M * 2 - 12) / 5
    const pkH = 24
    const platKPIs = [
      { label: 'Seguidores',    value: fN(act.seguidores),    sub: vari(v(act.seguidores),    v(ant.seguidores))    },
      { label: 'Nuevos Seg.',   value: fN(act.nuevos_seguidores), sub: vari(v(act.nuevos_seguidores), v(ant.nuevos_seguidores)) },
      { label: pc.key === 'tiktok' ? 'Views' : 'Alcance',
                                value: fN(act[alcF]),          sub: vari(v(act[alcF]),         v(ant[alcF]))         },
      { label: 'Interacciones', value: fN(act.interacciones), sub: vari(v(act.interacciones), v(ant.interacciones)) },
      { label: 'Inversión',     value: fC(act.inversion),     sub: vari(v(act.inversion),     v(ant.inversion))     },
    ]
    platKPIs.forEach((k, i) => {
      drawKPICard(pdf, M + i * (pkW + 3), y, pkW, pkH, k.label, k.value, k.sub, palette)
    })
    y += pkH + 6

    // Mini bar chart — histórico seguidores
    const histRows = Array.isArray(allData?.[pc.key]) ? allData[pc.key] : []
    const histM    = [...new Set(histRows.map(r => r.mes).filter(Boolean))].sort().filter(m => m <= selectedMonth).slice(-6)
    if (histM.length > 1) {
      const chartW = 120; const chartH = 36
      y = subHead(pdf, y, 'Evolución de seguidores', palette, M)
      drawMiniBarChart(pdf, M, y, chartW, chartH,
        histM.map(m => ({ label: formatMonthShort(m).slice(0, 3), value: v(getH(pc.key, m).seguidores) })),
        palette,
      )
      // small table next to chart
      const tblX = M + chartW + 8
      const tblData = histM.map(m => {
        const d = getH(pc.key, m)
        return [formatMonthShort(m), fN(d.seguidores), fN(d[alcF]), fN(d.interacciones), fC(d.inversion)]
      })
      pdf.autoTable({
        startY: y, head: [['Mes', 'Seguidores', pc.key === 'tiktok' ? 'Views' : 'Alcance', 'Interacciones', 'Inversión']],
        body: tblData, margin: { left: tblX, right: 14 },
        styles: { fontSize: 6.8, cellPadding: { top: 1.8, bottom: 1.8, left: 2.5, right: 2.5 }, lineColor: [228, 228, 235], lineWidth: 0.2, textColor: [30, 30, 45] },
        headStyles: { fillColor: palette.dark, textColor: 255, fontStyle: 'bold', fontSize: 6.8, halign: 'center' },
        alternateRowStyles: { fillColor: [249, 249, 253] },
        didParseCell: (d) => { if (d.section === 'body' && d.column.index > 0) d.cell.styles.halign = 'center' },
        didDrawRow: (d) => {
          // highlight selected month
          if (d.section === 'body' && histM[d.row.index] === selectedMonth) {
            pdf.setFillColor(...palette.light)
            pdf.rect(d.row.cells[0]?.x ?? tblX, d.row.cells[0]?.y ?? y, d.row.cells[0]?.width * 5 ?? 80, d.row.height, 'F')
          }
        },
      })
      y = Math.max(y + chartH, pdf.lastAutoTable.finalY) + 5
    }

    // Métricas detalle
    y = checkPB(pdf, y, 55, () => { np(); y = sectionHeader(pdf, pc.label + ' (cont.)', palette, W, M) })
    y = subHead(pdf, y, 'Métricas del periodo', palette, M)
    const kpiRows = [
      ['Seguidores',        fN(act.seguidores),         fN(ant.seguidores),        vari(v(act.seguidores),         v(ant.seguidores))],
      ['Nuevos Seguidores', fN(act.nuevos_seguidores),  fN(ant.nuevos_seguidores), vari(v(act.nuevos_seguidores),  v(ant.nuevos_seguidores))],
      [pc.key === 'tiktok' ? 'Views' : 'Alcance', fN(act[alcF]), fN(ant[alcF]), vari(v(act[alcF]), v(ant[alcF]))],
      ['Interacciones',     fN(act.interacciones),      fN(ant.interacciones),     vari(v(act.interacciones),      v(ant.interacciones))],
      ['Impresiones',       fN(act.impresiones),        fN(ant.impresiones),       vari(v(act.impresiones),        v(ant.impresiones))],
      ['Publicaciones',     fN(act.publicaciones),      fN(ant.publicaciones),     vari(v(act.publicaciones),      v(ant.publicaciones))],
      ['Engagement Rate',   fP(act.engagement_rate),    fP(ant.engagement_rate),   ''],
      ['Inversión',         fC(act.inversion),          fC(ant.inversion),         vari(v(act.inversion),          v(ant.inversion))],
    ]
    if (pc.key === 'tiktok') kpiRows.splice(3, 0, ['Views 6s+', fN(act.views_6s), fN(ant.views_6s), vari(v(act.views_6s), v(ant.views_6s))])

    y = tbl(pdf, y, ['Métrica', 'Valor Actual', 'Mes Anterior', 'Variación'], kpiRows, {
      headColor: palette.main,
      columnStyles: { 0: { cellWidth: 45 } },
      didParseCell: (d) => {
        if (d.section === 'body' && d.column.index === 3) {
          const s = String(d.cell.raw || '')
          d.cell.styles.fontStyle = 'bold'
          if (s.startsWith('+'))      d.cell.styles.textColor = [22, 163, 74]
          else if (s.startsWith('-')) d.cell.styles.textColor = [220, 38, 38]
        }
        if (d.section === 'body' && d.column.index > 0) d.cell.styles.halign = 'center'
      },
    })

    // Campañas por bucket con barra de progreso
    const normPlat = s => String(s || '').toLowerCase().trim()
    const normKey  = s => String(s || '').toLowerCase().trim()
    const camps    = (filteredData.campanas || []).filter(c => getCampaignPlatform(c) === pc.key)
    const proyP    = (filteredData.proyecciones || []).filter(p => normPlat(p.plataforma) === pc.key)

    const invByBucket = {}
    for (const c of camps) {
      const b = c._bucket || tipoCampanaToBucket(c.tipo_campana)
      invByBucket[b] = (invByBucket[b] || 0) + v(c.inversion)
    }
    const bMap = new Map()
    for (const p of proyP) {
      const b    = tipoCampanaToBucket(p.tipo_campana || 'AON')
      const o    = p.metrica || p.objetivo || 'Sin objetivo'
      const k    = `${b}||${normKey(o)}`
      if (!bMap.has(k)) bMap.set(k, { b, o, res: 0, meta: 0, inv: 0 })
      const e    = bMap.get(k)
      e.meta += v(p.meta)
      e.inv      = invByBucket[b] || 0
    }
    for (const c of camps) {
      const b = c._bucket || tipoCampanaToBucket(c.tipo_campana)
      const o = c._objective || c.objetivo_detectado || c.objetivo || 'Sin objetivo'
      const k = `${b}||${normKey(o)}`
      if (!bMap.has(k)) bMap.set(k, { b, o, res: 0, meta: 0, inv: invByBucket[b] || 0 })
      const e = bMap.get(k)
      e.res += v(c.resultado)
      e.inv = invByBucket[b] || 0
    }

    if (bMap.size > 0) {
      y = checkPB(pdf, y, 60, () => { np(); y = sectionHeader(pdf, pc.label + ' (cont.)', palette, W, M) })
      y = subHead(pdf, y, 'Campañas y proyecciones', palette, M)

      // table with inline progress bars drawn after
      const campRows = Array.from(bMap.values()).map(e => {
        const cumplPct = e.meta > 0 ? e.res / e.meta : null
        const cumplStr = cumplPct !== null ? `${(cumplPct * 100).toFixed(1)}%` : '—'
        const cpr      = e.res > 0 ? e.inv / e.res : null
        return [bucketToLabel(e.b, e.b), e.o, fN(e.res), e.meta > 0 ? fN(e.meta) : '—', cumplStr, fC(e.inv), cpr ? `$${cpr.toFixed(2)}` : '—']
      })

      const startY = y
      y = tbl(pdf, y,
        ['Bucket', 'Objetivo', 'Resultado', 'Meta', 'Cumplimiento', 'Inversión', 'CPR'],
        campRows,
        {
          headColor: palette.main,
          columnStyles: { 1: { cellWidth: 50 } },
          didParseCell: (d) => {
            if (d.section === 'body' && d.column.index === 4 && d.cell.raw !== '—') {
              const pct = parseFloat(String(d.cell.raw))
              if (!isNaN(pct)) {
                if (pct >= 100)     d.cell.styles.textColor = [22, 163, 74]
                else if (pct < 70)  d.cell.styles.textColor = [220, 38, 38]
                else                d.cell.styles.textColor = [217, 119, 6]
                d.cell.styles.fontStyle = 'bold'
              }
            }
            if (d.section === 'body' && d.column.index > 1) d.cell.styles.halign = 'center'
          },
          didDrawCell: (d) => {
            // Draw progress bar inside cumplimiento column (index 4)
            if (d.section === 'body' && d.column.index === 4) {
              const rawStr = String(d.cell.raw || '')
              if (rawStr !== '—') {
                const pct = parseFloat(rawStr) / 100
                if (!isNaN(pct)) {
                  drawProgressBar(pdf,
                    d.cell.x + 2, d.cell.y + d.cell.height - 3.5,
                    d.cell.width - 4, 1.8,
                    clamp(pct, 0, 1.2), palette,
                  )
                }
              }
            }
          },
        },
      )
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GOOGLE ADS
  // ══════════════════════════════════════════════════════════════════════════
  onProgress?.(5, 10, 'Google Ads')
  const gaD = filteredData.googleAds || []
  if (features?.googleAds !== false && gaD.length > 0) {
    ;({ y } = newSection('Google Ads'))

    const gaAnt = (Array.isArray(allData?.googleAds) ? allData.googleAds : []).filter(r => r.mes === mesAnt)
    const tot   = gaD.reduce((a, r) => ({ i: a.i + v(r.impresiones_visibles), c: a.c + v(r.clics), vw: a.vw + v(r.visualizaciones), inv: a.inv + v(r.inversion) }), { i: 0, c: 0, vw: 0, inv: 0 })
    const antT  = gaAnt.reduce((a, r) => ({ i: a.i + v(r.impresiones_visibles), c: a.c + v(r.clics), vw: a.vw + v(r.visualizaciones), inv: a.inv + v(r.inversion) }), { i: 0, c: 0, vw: 0, inv: 0 })

    const gkW = (W - M * 2 - 9) / 4; const gkH = 24
    ;[
      { label: 'Impresiones',  value: fN(tot.i),   sub: vari(tot.i,   antT.i)   },
      { label: 'Clics',        value: fN(tot.c),   sub: vari(tot.c,   antT.c)   },
      { label: 'Views Video',  value: fN(tot.vw),  sub: vari(tot.vw,  antT.vw)  },
      { label: 'Inversión',    value: fC(tot.inv), sub: vari(tot.inv, antT.inv) },
    ].forEach((k, i) => drawKPICard(pdf, M + i * (gkW + 3), y, gkW, gkH, k.label, k.value, k.sub, palette))
    y += gkH + 6

    y = subHead(pdf, y, 'Detalle por tipo', palette, M)
    const byT = {}
    for (const r of gaD) {
      const tp = r.tipo_red || 'Otro'
      if (!byT[tp]) byT[tp] = { i: 0, vw: 0, c: 0, inv: 0 }
      byT[tp].i += v(r.impresiones_visibles); byT[tp].vw += v(r.visualizaciones)
      byT[tp].c += v(r.clics);                byT[tp].inv += v(r.inversion)
    }
    y = tbl(pdf, y,
      ['Tipo', 'Imp./Views', 'Clics', 'CTR', 'Inversión', 'CPM/CPV'],
      Object.entries(byT).map(([tp, vals]) => {
        const metric = tp.toLowerCase().includes('video') ? vals.vw : vals.i
        const ctr    = metric > 0 ? `${((vals.c / metric) * 100).toFixed(2)}%` : '—'
        const cpm    = metric > 0 ? (vals.inv / metric) * 1000 : 0
        return [tp, fN(metric), fN(vals.c), ctr, fC(vals.inv), cpm > 0 ? `$${cpm.toFixed(2)}` : '—']
      }),
      { headColor: palette.main },
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PROYECCIONES con barras de progreso
  // ══════════════════════════════════════════════════════════════════════════
  onProgress?.(6, 10, 'Proyecciones')
  const proy = filteredData.proyecciones || []
  if (proy.length > 0) {
    ;({ y } = newSection('Proyecciones y Metas'))
    const platsProy = [...new Set(proy.map(p => p.plataforma).filter(Boolean))]
    for (const plat of platsProy) {
      const rows = proy.filter(p => p.plataforma === plat)
      if (!rows.length) continue
      y = checkPB(pdf, y, 55, () => { np(); y = sectionHeader(pdf, 'Proyecciones (cont.)', palette, W, M) })
      y = subHead(pdf, y, plat.charAt(0).toUpperCase() + plat.slice(1), palette, M)
      const realForProjection = (row) => {
        const rowBucket = tipoCampanaToBucket(row.tipo_campana || 'AON')
        const keys = [row.objetivo, row.metrica].map(normKey).filter(Boolean)
        return (filteredData.campanas || [])
          .filter(c => getCampaignPlatform(c) === normPlat(plat))
          .filter(c => (c._bucket || tipoCampanaToBucket(c.tipo_campana)) === rowBucket)
          .filter(c => keys.includes(normKey(c._objective || c.objetivo_detectado || c.objetivo || '')))
          .reduce((sum, c) => sum + v(c.resultado), 0)
      }
      const invForProjection = (row) => {
        const rowBucket = tipoCampanaToBucket(row.tipo_campana || 'AON')
        const keys = [row.objetivo, row.metrica].map(normKey).filter(Boolean)
        return (filteredData.campanas || [])
          .filter(c => getCampaignPlatform(c) === normPlat(plat))
          .filter(c => (c._bucket || tipoCampanaToBucket(c.tipo_campana)) === rowBucket)
          .filter(c => keys.includes(normKey(c._objective || c.objetivo_detectado || c.objetivo || '')))
          .reduce((sum, c) => sum + v(c.inversion), 0)
      }
      y = tbl(pdf, y,
        ['Métrica / Objetivo', 'Tipo', 'Meta', 'Real', 'Cumplimiento', 'Inversión'],
        rows.map(r => {
          const meta = v(r.meta), real = realForProjection(r)
          const cumpl = meta > 0 ? `${((real / meta) * 100).toFixed(1)}%` : '—'
          return [r.metrica || r.objetivo || '—', r.tipo_campana || 'AON', fN(meta), fN(real), cumpl, fC(invForProjection(r))]
        }),
        {
          headColor: palette.main,
          didParseCell: (d) => {
            if (d.section === 'body' && d.column.index === 4 && d.cell.raw !== '—') {
              const pct = parseFloat(String(d.cell.raw))
              if (!isNaN(pct)) {
                if (pct >= 100) d.cell.styles.textColor = [22, 163, 74]
                else if (pct < 70) d.cell.styles.textColor = [220, 38, 38]
                else d.cell.styles.textColor = [217, 119, 6]
                d.cell.styles.fontStyle = 'bold'
              }
            }
            if (d.section === 'body' && d.column.index > 1) d.cell.styles.halign = 'center'
          },
          didDrawCell: (d) => {
            if (d.section === 'body' && d.column.index === 4) {
              const rawStr = String(d.cell.raw || '')
              if (rawStr !== '—') {
                const pct = parseFloat(rawStr) / 100
                if (!isNaN(pct)) {
                  drawProgressBar(pdf,
                    d.cell.x + 2, d.cell.y + d.cell.height - 3.5,
                    d.cell.width - 4, 1.8, clamp(pct, 0, 1.2), palette,
                  )
                }
              }
            }
          },
        },
      )
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SENTIMIENTO
  // ══════════════════════════════════════════════════════════════════════════
  onProgress?.(7, 10, 'Sentimiento')
  const sent = filteredData.sentiment
  if (sent) {
    ;({ y } = newSection('Análisis de Sentimiento'))

    // Big sentiment gauge — three colored blocks
    const gaugeX = M; const gaugeY = y; const gaugeH = 18; const gaugeW = W - M * 2
    const posW   = gaugeW * (v(sent.positivo_pct) / 100)
    const neuW   = gaugeW * (v(sent.neutro_pct)   / 100)
    const negW   = gaugeW * (v(sent.negativo_pct) / 100)

    pdf.setFillColor(22, 163, 74);  pdf.roundedRect(gaugeX,            gaugeY, posW, gaugeH, 2, 2, 'F')
    pdf.setFillColor(156, 163, 175); pdf.rect(gaugeX + posW,           gaugeY, neuW, gaugeH, 'F')
    pdf.setFillColor(220, 38, 38);  pdf.roundedRect(gaugeX + posW + neuW, gaugeY, Math.max(negW, 1), gaugeH, 2, 2, 'F')

    // labels inside gauge
    pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(255)
    if (posW > 20) pdf.text(`😊 ${fP(sent.positivo_pct)}`, gaugeX + posW / 2, gaugeY + 11, { align: 'center' })
    if (neuW > 20) pdf.text(`😐 ${fP(sent.neutro_pct)}`,   gaugeX + posW + neuW / 2, gaugeY + 11, { align: 'center' })
    if (negW > 20) pdf.text(`😞 ${fP(sent.negativo_pct)}`, gaugeX + posW + neuW + negW / 2, gaugeY + 11, { align: 'center' })
    y += gaugeH + 8

    if (sent.descripcion) {
      y = subHead(pdf, y, 'Análisis cualitativo', palette, M)
      pdf.setFontSize(8.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(55)
      const lines = pdf.splitTextToSize(String(sent.descripcion), W - M * 2)
      lines.forEach((line, i) => pdf.text(line, M, y + i * 4.8))
      y += lines.length * 4.8 + 6
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // COMPETENCIA
  // ══════════════════════════════════════════════════════════════════════════
  onProgress?.(8, 10, 'Competencia')
  const comp = filteredData.competencia || []
  if (comp.length > 0) {
    ;({ y } = newSection('Análisis de Competencia'))
    const cAnt  = (Array.isArray(allData?.competencia) ? allData.competencia : []).filter(r => r.mes === mesAnt)
    const redes = [...new Set(comp.map(c => c.red).filter(Boolean))]
    for (const red of redes) {
      y = checkPB(pdf, y, 50, () => { np(); y = sectionHeader(pdf, 'Competencia (cont.)', palette, W, M) })
      y = subHead(pdf, y, red.charAt(0).toUpperCase() + red.slice(1), palette, M)
      y = tbl(pdf, y,
        ['Competidor', 'Seguidores', 'vs Mes Ant.', 'Engagement %'],
        comp.filter(c => c.red === red).map(c => {
          const a = cAnt.find(x => x.competidor === c.competidor && x.red === red)
          return [c.competidor, fN(c.seguidores), a ? vari(v(c.seguidores), v(a.seguidores)) : '—', fP(c.engagement_pct)]
        }),
        {
          headColor: palette.main,
          didParseCell: (d) => {
            if (d.section === 'body' && d.column.index === 2) {
              const s = String(d.cell.raw || '')
              if (s.startsWith('+')) d.cell.styles.textColor = [22, 163, 74]
              else if (s.startsWith('-')) d.cell.styles.textColor = [220, 38, 38]
              d.cell.styles.fontStyle = 'bold'
            }
            if (d.section === 'body' && d.column.index > 0) d.cell.styles.halign = 'center'
          },
        },
      )
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HALLAZGOS
  // ══════════════════════════════════════════════════════════════════════════
  onProgress?.(9, 10, 'Hallazgos')
  const hall = filteredData.hallazgos    || []
  const obs  = filteredData.observaciones || []
  if (hall.length > 0 || obs.length > 0) {
    ;({ y } = newSection('Hallazgos y Observaciones'))
    if (hall.length > 0) {
      y = subHead(pdf, y, 'Hallazgos', palette, M)
      y = tbl(pdf, y,
        ['Tipo', 'Sección', 'Título', 'Descripción'],
        hall.map(h => [h.tipo || '', h.seccion || '', h.titulo || '', h.descripcion || '']),
        {
          headColor: palette.main,
          columnStyles: { 3: { cellWidth: 110 } },
          didParseCell: (d) => {
            if (d.section === 'body' && d.column.index === 0) {
              const t = String(d.cell.raw || '').toLowerCase()
              if (t.includes('oportun'))                       d.cell.styles.textColor = [22, 163, 74]
              else if (t.includes('alerta') || t.includes('riesgo')) d.cell.styles.textColor = [220, 38, 38]
              d.cell.styles.fontStyle = 'bold'
            }
          },
        },
      )
    }
    if (obs.length > 0) {
      y = checkPB(pdf, y, 50, () => { np(); y = sectionHeader(pdf, 'Hallazgos (cont.)', palette, W, M) })
      y = subHead(pdf, y, 'Observaciones', palette, M)
      y = tbl(pdf, y,
        ['Sección', 'Título', 'Descripción'],
        obs.map(o => [o.seccion || '', o.titulo || '', o.descripcion || '']),
        { headColor: palette.main, columnStyles: { 2: { cellWidth: 130 } } },
      )
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ÍNDICE — volver a la página reservada y dibujarlo
  // ══════════════════════════════════════════════════════════════════════════
  makeFooter(pdf, brandName, label, pageNum, W, H, M)

  // Go back to TOC page
  pdf.setPage(tocPage)
  pdf.setFillColor(...palette.dark)
  pdf.rect(0, 0, W, H, 'F')
  pdf.setFillColor(...palette.main)
  pdf.rect(0, 0, W * 0.5, H, 'F')

  // TOC left column header
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(22); pdf.setTextColor(255)
  pdf.text('Contenido', M, 28)
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(220, 220, 255)
  pdf.text(`${brandName}  ·  ${label}`, M, 36)
  pdf.setDrawColor(255, 255, 255); pdf.setLineWidth(0.3)
  pdf.line(M, 40, M + 60, 40)

  const allEntries = [{ title: 'Portada', page: 1 }, { title: 'Índice', page: tocPage }, ...sections]
  let ty = 50
  for (const e of allEntries) {
    // Clickable link
    pdf.link(M, ty - 5, W * 0.5 - M * 2, 8, { pageNumber: e.page })
    // Hover effect area (light highlight)
    pdf.setFillColor(255, 255, 255)
    pdf.setGState(new pdf.GState({ opacity: 0.07 }))
    pdf.rect(M - 1, ty - 5, W * 0.5 - M * 2, 7, 'F')
    pdf.setGState(new pdf.GState({ opacity: 1 }))

    // Page number badge
    const badgeX = W * 0.5 - M - 12
    pdf.setFillColor(...palette.light)
    pdf.roundedRect(badgeX, ty - 4.5, 12, 6, 1, 1, 'F')
    pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...palette.dark)
    pdf.text(String(e.page), badgeX + 6, ty, { align: 'center' })

    // Title
    pdf.setFontSize(9); pdf.setFont('helvetica', e.page === 1 || e.page === tocPage ? 'normal' : 'bold')
    pdf.setTextColor(255)
    pdf.text(e.title, M + 2, ty)

    // Dots
    pdf.setDrawColor(255, 255, 255); pdf.setLineDashPattern([0.6, 0.6])
    const tw = pdf.getTextWidth(e.title)
    pdf.line(M + 2 + tw + 2, ty - 0.5, badgeX - 2, ty - 0.5)
    pdf.setLineDashPattern([])

    ty += 9
    if (ty > H - 14) break
  }

  // Right column of TOC — brand summary repeat
  const rX = W * 0.5 + 10
  pdf.setFillColor(255); pdf.setGState(new pdf.GState({ opacity: 0.08 }))
  pdf.roundedRect(rX, 14, W - rX - M, H - 28, 3, 3, 'F')
  pdf.setGState(new pdf.GState({ opacity: 1 }))

  pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(255)
  pdf.text('Resumen del periodo', rX + 6, 26)
  pdf.setFontSize(7.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(220, 220, 255)

  const sumLines = [
    `Periodo:  ${label}`,
    `Seguidores totales:  ${fN(totSeg)}`,
    `Alcance / Views:  ${fN(totAlc)}`,
    `Interacciones:  ${fN(totInt)}`,
    `Inversión total:  ${fC(totInv)}`,
    `Facebook:  ${fN(v(getH('facebook', selectedMonth).seguidores))} seg.`,
    `Instagram:  ${fN(v(getH('instagram', selectedMonth).seguidores))} seg.`,
    `TikTok:  ${fN(v(getH('tiktok', selectedMonth).views))} views`,
  ]
  sumLines.forEach((l, i) => pdf.text(l, rX + 6, 34 + i * 8))
  makeFooter(pdf, brandName, label, tocPage, W, H, M)

  // ══════════════════════════════════════════════════════════════════════════
  // GUARDAR
  // ══════════════════════════════════════════════════════════════════════════
  const safe     = brandName.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '').trim().replace(/\s+/g, '_')
  const filename = `Reporte_${safe}_${selectedMonth}.pdf`
  const blob     = pdf.output('blob')
  const url      = URL.createObjectURL(blob)
  const a        = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
