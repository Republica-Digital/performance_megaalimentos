import ExcelJS from 'exceljs'
import { formatMonthShort, formatMonthLong, safeNumber } from './format'
import { tipoCampanaToBucket, bucketToLabel } from './campaigns'

const v = (val) => safeNumber(val, 0)
const prevMonth = (m) => {
  if (!m?.includes('-')) return null
  const [y, mo] = m.split('-').map(Number)
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`
}
const pctDelta = (act, ant) => {
  if (ant === 0) return act > 0 ? null : null   // returns null → caller decides
  return ((act - ant) / Math.abs(ant))           // decimal, e.g. 0.12 = 12 %
}

// ── Brand palette ──────────────────────────────────────────────────────────
const BRAND_HEX = {
  botanera: 'FF6B00', chamoy: 'A855F7', pacific: '3B82F6', default: '6366F1',
}
const DARK_BG  = '1E293B'
const ALT_ROW  = 'F8F9FD'
const WHITE    = 'FFFFFF'

// ── Font / border helpers ──────────────────────────────────────────────────
const font   = (opts = {}) => ({ name: 'Calibri', size: 9.5, ...opts })
const border = (color = 'D1D5DB') => ({ style: 'thin', color: { argb: color } })
const allBorders = (c) => ({ top: border(c), bottom: border(c), left: border(c), right: border(c) })
const THIN = allBorders('D1D5DB')

function applyHeader(row, ncols, bgArgb, textArgb = WHITE) {
  for (let c = 1; c <= ncols; c++) {
    const cell = row.getCell(c)
    cell.font      = font({ bold: true, color: { argb: textArgb }, size: 9 })
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } }
    cell.border    = THIN
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  }
  row.height = 22
}

function applyTitle(ws, row, ncols, bgArgb) {
  ws.mergeCells(row.number, 1, row.number, ncols)
  const cell = row.getCell(1)
  cell.font      = font({ bold: true, color: { argb: WHITE }, size: 13 })
  cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } }
  cell.alignment = { vertical: 'middle', indent: 1 }
  row.height = 28
}

function applySubtitle(ws, row, ncols, accent) {
  ws.mergeCells(row.number, 1, row.number, ncols)
  const cell = row.getCell(1)
  cell.font      = font({ bold: true, color: { argb: accent }, size: 9.5 })
  cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EEF2FF' } }
  cell.border    = { bottom: border('C7D2FE') }
  cell.alignment = { vertical: 'middle', indent: 1 }
  row.height = 20
}

function applyBody(row, ncols, isAlt) {
  for (let c = 1; c <= ncols; c++) {
    const cell = row.getCell(c)
    if (!cell.font?.bold) cell.font = font()
    cell.border    = THIN
    cell.alignment = cell.alignment || { vertical: 'middle' }
    if (isAlt) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT_ROW } }
  }
}

function deltaCell(cell, deltaDecimal, thresholdPct = 5) {
  if (deltaDecimal === null || deltaDecimal === undefined) { cell.value = '—'; return }
  const pct = deltaDecimal * 100
  const sign = pct >= 0 ? '+' : ''
  cell.value  = `${sign}${pct.toFixed(1)}%`
  cell.font   = font({
    bold:  Math.abs(pct) >= thresholdPct,
    color: { argb: pct > thresholdPct ? '16A34A' : pct < -thresholdPct ? 'DC2626' : '6B7280' },
  })
  cell.alignment = { horizontal: 'center', vertical: 'middle' }
}

function cumplCell(cell, cumplDecimal) {
  if (cumplDecimal === null) { cell.value = '—'; return }
  cell.value  = cumplDecimal
  cell.numFmt = '0.0%'
  const pct   = cumplDecimal * 100
  if (pct >= 100) {
    cell.font = font({ bold: true, color: { argb: '16A34A' } })
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DCFCE7' } }
  } else if (pct < 70) {
    cell.font = font({ bold: true, color: { argb: 'DC2626' } })
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } }
  } else {
    cell.font = font({ bold: true, color: { argb: 'D97706' } })
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } }
  }
  cell.border    = THIN
  cell.alignment = { horizontal: 'center', vertical: 'middle' }
}

function autoWidth(ws) {
  ws.columns.forEach(col => {
    let max = 10
    col.eachCell({ includeEmpty: false }, cell => {
      const len = String(cell.value ?? '').length
      if (len > max) max = len
    })
    col.width = Math.min(max + 3, 42)
  })
}

function addBlank(ws) { ws.addRow([]).height = 6 }

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// Called from Dashboard as: exportDashboardData({ brandConfig, filteredData, allData, selectedMonth })
// ─────────────────────────────────────────────────────────────────────────────
export async function exportDashboardData({ brandConfig, filteredData, allData, selectedMonth }) {
  const marcaId    = brandConfig?.marca_id || brandConfig?.id || 'default'
  const nombre     = brandConfig?.nombre   || marcaId
  const accent     = (BRAND_HEX[marcaId] || BRAND_HEX.default).toUpperCase()
  const monthLabel = formatMonthLong(selectedMonth)
  const mesAnt     = prevMonth(selectedMonth)
  const getH       = (p, m) => (Array.isArray(allData?.[p]) ? allData[p] : []).find(r => r.mes === m) || {}

  // Collect last 6 months for historical tabs
  const allMonths = new Set()
  ;['facebook', 'instagram', 'tiktok'].forEach(p => {
    ;(allData?.[p] || []).forEach(r => r.mes && allMonths.add(r.mes))
  })
  const histMonths = [...allMonths].sort().filter(m => m <= selectedMonth).slice(-6)

  const wb       = new ExcelJS.Workbook()
  wb.creator     = nombre
  wb.created     = new Date()
  wb.description = `Dashboard Export — ${nombre} — ${monthLabel}`

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 1: RESUMEN EJECUTIVO
  // ═══════════════════════════════════════════════════════════════════════════
  {
    const ws = wb.addWorksheet('Resumen Ejecutivo', { properties: { tabColor: { argb: accent } } })
    const N  = 10

    let r = ws.addRow([`${nombre} — Resumen Ejecutivo — ${monthLabel}`])
    applyTitle(ws, r, N, accent)

    r = ws.addRow([`Generado: ${new Date().toLocaleString('es-MX')}   ·   Mes filtrado: ${monthLabel}`])
    ws.mergeCells(r.number, 1, r.number, N)
    r.getCell(1).font      = font({ color: { argb: '6B7280' }, size: 8.5 })
    r.getCell(1).alignment = { indent: 1, vertical: 'middle' }
    r.height = 16

    addBlank(ws)

    // Platform summary
    r = ws.addRow(['COMPARATIVO POR PLATAFORMA'])
    applySubtitle(ws, r, N, accent)

    r = ws.addRow(['Plataforma','Seguidores','vs Ant.','Nuevos Seg.','vs Ant.','Alcance/Views','vs Ant.','Interacciones','vs Ant.','Inversión'])
    applyHeader(r, N, DARK_BG)

    let totalSeg = 0, totalAlc = 0, totalInt = 0, totalInv = 0
    for (const [i, plat] of ['facebook','instagram','tiktok'].entries()) {
      const act  = filteredData[plat] || {}
      const ant  = getH(plat, mesAnt)
      const alcF = plat === 'tiktok' ? 'views' : 'alcance'

      const seg = v(act.seguidores), newSeg = v(act.nuevos_seguidores)
      const alc = v(act[alcF]),      int    = v(act.interacciones)
      const inv = v(act.inversion)
      totalSeg += seg; totalAlc += alc; totalInt += int; totalInv += inv

      const row = ws.addRow([plat.charAt(0).toUpperCase() + plat.slice(1), seg, '', newSeg, '', alc, '', int, '', inv])
      applyBody(row, N, i % 2 === 1)
      deltaCell(row.getCell(3),  pctDelta(seg,    v(ant.seguidores)))
      deltaCell(row.getCell(5),  pctDelta(newSeg, v(ant.nuevos_seguidores)))
      deltaCell(row.getCell(7),  pctDelta(alc,    v(ant[alcF])))
      deltaCell(row.getCell(9),  pctDelta(int,    v(ant.interacciones)))
      row.getCell(2).numFmt = '#,##0'; row.getCell(4).numFmt = '#,##0'
      row.getCell(6).numFmt = '#,##0'; row.getCell(8).numFmt = '#,##0'
      row.getCell(10).numFmt = '$#,##0.00'
    }

    // Google Ads row
    const gaInv    = (filteredData.googleAds || []).reduce((s, r) => s + v(r.inversion), 0)
    const gaAntInv = (Array.isArray(allData?.googleAds) ? allData.googleAds : [])
      .filter(r => r.mes === mesAnt).reduce((s, r) => s + v(r.inversion), 0)
    totalInv += gaInv
    const gaRow = ws.addRow(['Google Ads', '—', '', '—', '', '—', '', '—', '', gaInv])
    applyBody(gaRow, N, true)
    deltaCell(gaRow.getCell(9), pctDelta(gaInv, gaAntInv))
    gaRow.getCell(10).numFmt = '$#,##0.00'

    // Totals
    addBlank(ws)
    const totRow = ws.addRow(['TOTAL', totalSeg, '', '', '', totalAlc, '', totalInt, '', totalInv])
    for (let c = 1; c <= N; c++) {
      const cell = totRow.getCell(c)
      cell.font   = font({ bold: true, color: { argb: WHITE }, size: 10 })
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: accent } }
      cell.border = THIN
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    }
    totRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    totRow.getCell(2).numFmt  = '#,##0'
    totRow.getCell(6).numFmt  = '#,##0'
    totRow.getCell(8).numFmt  = '#,##0'
    totRow.getCell(10).numFmt = '$#,##0.00'

    autoWidth(ws)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TABS 2-4: FACEBOOK / INSTAGRAM / TIKTOK
  // ═══════════════════════════════════════════════════════════════════════════
  for (const plat of ['facebook', 'instagram', 'tiktok']) {
    const label = plat.charAt(0).toUpperCase() + plat.slice(1)
    const ws    = wb.addWorksheet(label, { properties: { tabColor: { argb: accent } } })
    const alcF  = plat === 'tiktok' ? 'views' : 'alcance'
    const act   = filteredData[plat] || {}
    const ant   = getH(plat, mesAnt)

    // Title
    let r = ws.addRow([`${label} — ${monthLabel}`])
    applyTitle(ws, r, 7, accent)
    addBlank(ws)

    // ─ KPIs principales ─────────────────────────────────────────────────────
    r = ws.addRow(['MÉTRICAS PRINCIPALES'])
    applySubtitle(ws, r, 7, accent)
    r = ws.addRow(['Métrica', 'Mes Actual', 'Mes Anterior', 'Δ Absoluto', 'Δ Porcentual', '', ''])
    applyHeader(r, 5, DARK_BG)

    const metrics = [
      { name: 'Seguidores',              val: v(act.seguidores),          antVal: v(ant.seguidores),          fmt: '#,##0' },
      { name: 'Nuevos Seguidores',       val: v(act.nuevos_seguidores),   antVal: v(ant.nuevos_seguidores),   fmt: '#,##0' },
      { name: plat === 'tiktok' ? 'Views' : 'Alcance',
                                         val: v(act[alcF]),               antVal: v(ant[alcF]),               fmt: '#,##0' },
      { name: 'Interacciones',           val: v(act.interacciones),       antVal: v(ant.interacciones),       fmt: '#,##0' },
      { name: 'Impresiones',             val: v(act.impresiones),         antVal: v(ant.impresiones),         fmt: '#,##0' },
      { name: 'Publicaciones',           val: v(act.publicaciones),       antVal: v(ant.publicaciones),       fmt: '#,##0' },
      { name: 'Engagement Rate',         val: v(act.engagement_rate)/100, antVal: null,                       fmt: '0.00%' },
      { name: 'Inversión',               val: v(act.inversion),           antVal: v(ant.inversion),           fmt: '$#,##0.00' },
    ]
    if (plat === 'tiktok') {
      metrics.splice(3, 0, { name: 'Views 6s+', val: v(act.views_6s), antVal: v(ant.views_6s), fmt: '#,##0' })
    }
    metrics.forEach(({ name, val, antVal, fmt }, i) => {
      const row = ws.addRow([name, val, antVal !== null ? antVal : '—', '', ''])
      applyBody(row, 5, i % 2 === 1)
      row.getCell(2).numFmt = fmt
      if (antVal !== null) {
        row.getCell(3).numFmt = fmt
        row.getCell(4).value   = val - antVal
        row.getCell(4).numFmt  = fmt
        deltaCell(row.getCell(5), pctDelta(val, antVal))
      }
      row.getCell(1).alignment = { vertical: 'middle', indent: 1 }
    })

    // ─ Campañas ─────────────────────────────────────────────────────────────
    const camps = (filteredData.campanas || []).filter(c => c.plataforma === plat)
    const proyP = (filteredData.proyecciones || []).filter(p => p.plataforma === plat)
    const bMap  = new Map()
    for (const c of camps) {
      const b = c._bucket || tipoCampanaToBucket(c.tipo_campana)
      const o = c._objective || c.objetivo_detectado || c.objetivo || 'Sin objetivo'
      const k = `${b}|${o}`
      if (!bMap.has(k)) bMap.set(k, { b, o, res: 0, inv: 0, meta: null })
      const e = bMap.get(k); e.res += v(c.resultado); e.inv += v(c.inversion)
    }
    for (const p of proyP) {
      const b = tipoCampanaToBucket(p.tipo_campana)
      const o = p.objetivo || p.metrica || 'Sin objetivo'
      const k = `${b}|${o}`
      if (!bMap.has(k)) bMap.set(k, { b, o, res: 0, inv: 0, meta: null })
      const e = bMap.get(k); e.meta = v(p.meta)
      if (e.res === 0) e.res = v(p.real)
    }

    if (bMap.size > 0) {
      addBlank(ws)
      r = ws.addRow(['CAMPAÑAS POR BUCKET'])
      applySubtitle(ws, r, 7, accent)
      r = ws.addRow(['Bucket', 'Objetivo', 'Resultado', 'Meta', 'Cumplimiento', 'Inversión', 'CPR'])
      applyHeader(r, 7, DARK_BG)
      let ci = 0
      for (const e of bMap.values()) {
        const cumpl = e.meta > 0 ? e.res / e.meta : null
        const cpr   = e.res  > 0 ? e.inv / e.res  : null
        const row   = ws.addRow([bucketToLabel(e.b, e.b), e.o, e.res, e.meta || 0, '', e.inv, cpr || 0])
        applyBody(row, 7, ci % 2 === 1)
        row.getCell(3).numFmt  = '#,##0'
        row.getCell(4).numFmt  = '#,##0'
        if (!e.meta) row.getCell(4).value = '—'
        cumplCell(row.getCell(5), cumpl)
        row.getCell(6).numFmt  = '$#,##0.00'
        if (cpr) row.getCell(7).numFmt = '$#,##0.00'
        else row.getCell(7).value = '—'
        row.getCell(1).alignment = { vertical: 'middle', indent: 1 }
        ci++
      }
    }

    // ─ Histórico mensual ─────────────────────────────────────────────────────
    if (histMonths.length > 1) {
      addBlank(ws)
      r = ws.addRow(['EVOLUCIÓN HISTÓRICA (últimos 6 meses)'])
      applySubtitle(ws, r, 7, accent)
      r = ws.addRow(['Mes', 'Seguidores', 'Nuevos Seg.', plat === 'tiktok' ? 'Views' : 'Alcance', 'Interacciones', 'Engagement%', 'Inversión'])
      applyHeader(r, 7, DARK_BG)
      histMonths.forEach((m, i) => {
        const d = getH(plat, m)
        const row = ws.addRow([
          formatMonthShort(m),
          v(d.seguidores), v(d.nuevos_seguidores), v(d[alcF]),
          v(d.interacciones), v(d.engagement_rate) / 100, v(d.inversion),
        ])
        applyBody(row, 7, i % 2 === 1)
        row.getCell(2).numFmt = '#,##0'; row.getCell(3).numFmt = '#,##0'
        row.getCell(4).numFmt = '#,##0'; row.getCell(5).numFmt = '#,##0'
        row.getCell(6).numFmt = '0.00%'; row.getCell(7).numFmt = '$#,##0.00'
        // Highlight the selected month row
        if (m === selectedMonth) {
          for (let c = 1; c <= 7; c++) {
            const cell = row.getCell(c)
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EEF2FF' } }
            cell.font = font({ bold: true })
          }
        }
      })
    }

    autoWidth(ws)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 5: GOOGLE ADS
  // ═══════════════════════════════════════════════════════════════════════════
  const gaData = filteredData.googleAds || []
  if (gaData.length > 0) {
    const ws     = wb.addWorksheet('Google Ads', { properties: { tabColor: { argb: accent } } })
    const gaAnt  = (Array.isArray(allData?.googleAds) ? allData.googleAds : []).filter(r => r.mes === mesAnt)
    const tot    = gaData.reduce((a, r) => ({
      i: a.i + v(r.impresiones_visibles), c: a.c + v(r.clics),
      vw: a.vw + v(r.visualizaciones),    inv: a.inv + v(r.inversion),
    }), { i: 0, c: 0, vw: 0, inv: 0 })
    const antT   = gaAnt.reduce((a, r) => ({
      i: a.i + v(r.impresiones_visibles), c: a.c + v(r.clics),
      vw: a.vw + v(r.visualizaciones),    inv: a.inv + v(r.inversion),
    }), { i: 0, c: 0, vw: 0, inv: 0 })

    let r = ws.addRow([`Google Ads — ${monthLabel}`])
    applyTitle(ws, r, 6, accent)
    addBlank(ws)

    r = ws.addRow(['KPIS GENERALES'])
    applySubtitle(ws, r, 6, accent)
    r = ws.addRow(['Métrica', 'Actual', 'Mes Anterior', 'Δ Absoluto', 'Δ %', ''])
    applyHeader(r, 5, DARK_BG)

    const kpis = [
      { n: 'Imp. Visibles',  act: tot.i,   ant: antT.i,   fmt: '#,##0' },
      { n: 'Clics',          act: tot.c,   ant: antT.c,   fmt: '#,##0' },
      { n: 'CTR',            act: tot.i > 0 ? tot.c / tot.i : 0, ant: null, fmt: '0.00%' },
      { n: 'Views (Video)',  act: tot.vw,  ant: antT.vw,  fmt: '#,##0' },
      { n: 'Inversión',      act: tot.inv, ant: antT.inv, fmt: '$#,##0.00' },
    ]
    kpis.forEach(({ n, act, ant, fmt }, i) => {
      const row = ws.addRow([n, act, ant !== null ? ant : '—', '', ''])
      applyBody(row, 5, i % 2 === 1)
      row.getCell(2).numFmt = fmt
      if (ant !== null) {
        row.getCell(3).numFmt  = fmt
        row.getCell(4).value   = act - ant
        row.getCell(4).numFmt  = fmt
        deltaCell(row.getCell(5), pctDelta(act, ant))
      }
      row.getCell(1).alignment = { indent: 1, vertical: 'middle' }
    })

    // By type
    addBlank(ws)
    r = ws.addRow(['DESGLOSE POR TIPO DE CAMPAÑA'])
    applySubtitle(ws, r, 6, accent)
    r = ws.addRow(['Tipo', 'Imp./Views', 'Clics', 'CTR', 'Inversión', 'CPM/CPV'])
    applyHeader(r, 6, DARK_BG)
    const byT = {}
    for (const row of gaData) {
      const tp = row.tipo_red || 'Otro'
      if (!byT[tp]) byT[tp] = { i: 0, vw: 0, c: 0, inv: 0 }
      byT[tp].i   += v(row.impresiones_visibles)
      byT[tp].vw  += v(row.visualizaciones)
      byT[tp].c   += v(row.clics)
      byT[tp].inv += v(row.inversion)
    }
    let ci = 0
    for (const [tp, vals] of Object.entries(byT)) {
      const metric = tp.toLowerCase().includes('video') ? vals.vw : vals.i
      const ctr    = metric > 0 ? vals.c / metric : 0
      const cpm    = metric > 0 ? (vals.inv / metric) * 1000 : 0
      const row    = ws.addRow([tp, metric, vals.c, ctr, vals.inv, cpm || 0])
      applyBody(row, 6, ci % 2 === 1)
      row.getCell(2).numFmt = '#,##0'
      row.getCell(3).numFmt = '#,##0'
      row.getCell(4).numFmt = '0.00%'
      row.getCell(5).numFmt = '$#,##0.00'
      row.getCell(6).numFmt = cpm > 0 ? '$#,##0.00' : '@'
      row.getCell(1).alignment = { indent: 1, vertical: 'middle' }
      ci++
    }

    // Historical Google Ads
    const gaAllMonths = [...new Set((Array.isArray(allData?.googleAds) ? allData.googleAds : []).map(r => r.mes).filter(Boolean))].sort().filter(m => m <= selectedMonth).slice(-6)
    if (gaAllMonths.length > 1) {
      addBlank(ws)
      r = ws.addRow(['HISTÓRICO GOOGLE ADS (últimos 6 meses)'])
      applySubtitle(ws, r, 6, accent)
      r = ws.addRow(['Mes', 'Imp. Visibles', 'Clics', 'CTR', 'Views (Video)', 'Inversión'])
      applyHeader(r, 6, DARK_BG)
      gaAllMonths.forEach((m, i) => {
        const rows = (Array.isArray(allData?.googleAds) ? allData.googleAds : []).filter(r => r.mes === m)
        const agg  = rows.reduce((a, r) => ({
          i: a.i + v(r.impresiones_visibles), c: a.c + v(r.clics),
          vw: a.vw + v(r.visualizaciones),    inv: a.inv + v(r.inversion),
        }), { i: 0, c: 0, vw: 0, inv: 0 })
        const row = ws.addRow([formatMonthShort(m), agg.i, agg.c, agg.i > 0 ? agg.c / agg.i : 0, agg.vw, agg.inv])
        applyBody(row, 6, i % 2 === 1)
        row.getCell(2).numFmt = '#,##0'; row.getCell(3).numFmt = '#,##0'
        row.getCell(4).numFmt = '0.00%'; row.getCell(5).numFmt = '#,##0'
        row.getCell(6).numFmt = '$#,##0.00'
        if (m === selectedMonth) {
          for (let c = 1; c <= 6; c++) {
            row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EEF2FF' } }
            row.getCell(c).font = font({ bold: true })
          }
        }
      })
    }
    autoWidth(ws)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 6: PROYECCIONES
  // ═══════════════════════════════════════════════════════════════════════════
  const proy = filteredData.proyecciones || []
  if (proy.length > 0) {
    const ws = wb.addWorksheet('Proyecciones', { properties: { tabColor: { argb: '22C55E' } } })
    let r = ws.addRow([`Proyecciones y Metas — ${monthLabel}`])
    applyTitle(ws, r, 8, '22C55E')
    addBlank(ws)

    const platsProy = [...new Set(proy.map(p => p.plataforma).filter(Boolean))]
    for (const plat of platsProy) {
      const rows = proy.filter(p => p.plataforma === plat)
      if (!rows.length) continue

      r = ws.addRow([plat.charAt(0).toUpperCase() + plat.slice(1)])
      applySubtitle(ws, r, 8, '16A34A')
      r = ws.addRow(['Métrica / Objetivo', 'Tipo Campaña', 'Meta', 'Real', 'Cumplimiento', 'Gap', 'Inversión', 'CPR'])
      applyHeader(r, 8, DARK_BG)

      rows.forEach((p, i) => {
        const meta  = v(p.meta), real = v(p.real)
        const cumpl = meta > 0 ? real / meta : null
        const gap   = meta > 0 ? real - meta : null
        const cpr   = real > 0 ? v(p.inversion) / real : null
        const row   = ws.addRow([
          p.metrica || p.objetivo || '—', p.tipo_campana || 'AON',
          meta, real, '', gap || 0, v(p.inversion), cpr || 0,
        ])
        applyBody(row, 8, i % 2 === 1)
        row.getCell(3).numFmt = '#,##0'
        row.getCell(4).numFmt = '#,##0'
        cumplCell(row.getCell(5), cumpl)
        row.getCell(6).numFmt = '+#,##0;-#,##0;—'
        if (gap !== null && gap < 0) row.getCell(6).font = font({ bold: true, color: { argb: 'DC2626' } })
        row.getCell(7).numFmt = '$#,##0.00'
        row.getCell(8).numFmt = cpr ? '$#,##0.000' : '@'
        if (!cpr) row.getCell(8).value = '—'
        row.getCell(1).alignment = { indent: 1, vertical: 'middle' }
      })
      addBlank(ws)
    }
    autoWidth(ws)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 7: COMPETENCIA
  // ═══════════════════════════════════════════════════════════════════════════
  const comp = filteredData.competencia || []
  if (comp.length > 0) {
    const ws   = wb.addWorksheet('Competencia', { properties: { tabColor: { argb: 'F59E0B' } } })
    const cAnt = (Array.isArray(allData?.competencia) ? allData.competencia : []).filter(r => r.mes === mesAnt)

    let r = ws.addRow([`Análisis de Competencia — ${monthLabel}`])
    applyTitle(ws, r, 6, 'F59E0B')
    addBlank(ws)

    const redes = [...new Set(comp.map(c => c.red).filter(Boolean))]
    for (const red of redes) {
      r = ws.addRow([red.charAt(0).toUpperCase() + red.slice(1)])
      applySubtitle(ws, r, 6, 'D97706')
      r = ws.addRow(['Competidor', 'Seguidores', 'Mes Anterior', 'Δ Seguidores', 'Δ %', 'Engagement %'])
      applyHeader(r, 6, DARK_BG)
      comp.filter(c => c.red === red).forEach((c, i) => {
        const a    = cAnt.find(x => x.competidor === c.competidor && x.red === red)
        const seg  = v(c.seguidores), aSeg = a ? v(a.seguidores) : null
        const row  = ws.addRow([c.competidor, seg, aSeg !== null ? aSeg : '—', '', '', v(c.engagement_pct) / 100])
        applyBody(row, 6, i % 2 === 1)
        row.getCell(2).numFmt = '#,##0'
        if (aSeg !== null) {
          row.getCell(3).numFmt  = '#,##0'
          row.getCell(4).value   = seg - aSeg
          row.getCell(4).numFmt  = '+#,##0;-#,##0;0'
          deltaCell(row.getCell(5), pctDelta(seg, aSeg))
        } else {
          row.getCell(4).value = '—'; row.getCell(5).value = '—'
        }
        row.getCell(6).numFmt = '0.00%'
        row.getCell(1).alignment = { indent: 1, vertical: 'middle' }
      })
      addBlank(ws)
    }

    // Historical competencia
    const compAllMonths = [...new Set((Array.isArray(allData?.competencia) ? allData.competencia : []).map(r => r.mes).filter(Boolean))].sort().filter(m => m <= selectedMonth).slice(-6)
    if (compAllMonths.length > 1) {
      r = ws.addRow(['HISTÓRICO DE COMPETENCIA'])
      applySubtitle(ws, r, 6, 'D97706')
      r = ws.addRow(['Mes', 'Competidor', 'Red', 'Seguidores', 'Engagement %', ''])
      applyHeader(r, 5, DARK_BG)
      let ci = 0
      for (const m of compAllMonths) {
        const rows = (Array.isArray(allData?.competencia) ? allData.competencia : []).filter(r => r.mes === m)
        for (const c of rows) {
          const row = ws.addRow([formatMonthShort(m), c.competidor, c.red, v(c.seguidores), v(c.engagement_pct) / 100])
          applyBody(row, 5, ci % 2 === 1)
          row.getCell(4).numFmt = '#,##0'
          row.getCell(5).numFmt = '0.00%'
          if (m === selectedMonth) {
            for (let col = 1; col <= 5; col++) {
              row.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFBEB' } }
              row.getCell(col).font = font({ bold: true })
            }
          }
          ci++
        }
      }
    }
    autoWidth(ws)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 8: SENTIMENT
  // ═══════════════════════════════════════════════════════════════════════════
  const sent = filteredData.sentiment
  if (sent) {
    const ws = wb.addWorksheet('Sentimiento', { properties: { tabColor: { argb: 'A78BFA' } } })
    let r = ws.addRow([`Análisis de Sentimiento — ${monthLabel}`])
    applyTitle(ws, r, 4, 'A78BFA')
    addBlank(ws)

    r = ws.addRow(['DISTRIBUCIÓN DE SENTIMIENTO'])
    applySubtitle(ws, r, 4, '7C3AED')
    r = ws.addRow(['Positivo %', 'Neutro %', 'Negativo %', 'Índice Neto'])
    applyHeader(r, 4, DARK_BG)
    const net = v(sent.positivo_pct) - v(sent.negativo_pct)
    const row = ws.addRow([v(sent.positivo_pct) / 100, v(sent.neutro_pct) / 100, v(sent.negativo_pct) / 100, net / 100])
    applyBody(row, 4, false)
    row.getCell(1).numFmt = '0.0%'; row.getCell(1).font = font({ bold: true, color: { argb: '16A34A' } })
    row.getCell(2).numFmt = '0.0%'; row.getCell(2).font = font({ bold: true, color: { argb: '6B7280' } })
    row.getCell(3).numFmt = '0.0%'; row.getCell(3).font = font({ bold: true, color: { argb: 'DC2626' } })
    row.getCell(4).numFmt = '+0.0%;-0.0%;0.0%'
    row.getCell(4).font   = font({ bold: true, color: { argb: net >= 0 ? '16A34A' : 'DC2626' } })
    for (let c = 1; c <= 4; c++) row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }
    row.height = 24

    if (sent.descripcion) {
      addBlank(ws)
      r = ws.addRow(['ANÁLISIS CUALITATIVO'])
      applySubtitle(ws, r, 4, '7C3AED')
      const descRow = ws.addRow([String(sent.descripcion)])
      ws.mergeCells(descRow.number, 1, descRow.number, 4)
      descRow.getCell(1).font      = font({ size: 9.5, color: { argb: '374151' } })
      descRow.getCell(1).alignment = { wrapText: true, vertical: 'top', indent: 1 }
      descRow.getCell(1).border    = THIN
      descRow.height = 80
    }
    autoWidth(ws)
    ws.getColumn(1).width = 16
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 9: HALLAZGOS Y OBSERVACIONES
  // ═══════════════════════════════════════════════════════════════════════════
  const hall = filteredData.hallazgos    || []
  const obs  = filteredData.observaciones || []
  if (hall.length > 0 || obs.length > 0) {
    const ws = wb.addWorksheet('Hallazgos', { properties: { tabColor: { argb: 'EF4444' } } })
    let r = ws.addRow([`Hallazgos y Observaciones — ${monthLabel}`])
    applyTitle(ws, r, 5, 'EF4444')
    addBlank(ws)

    if (hall.length > 0) {
      r = ws.addRow(['HALLAZGOS'])
      applySubtitle(ws, r, 5, 'DC2626')
      r = ws.addRow(['Tipo', 'Sección', 'Título', 'Descripción', ''])
      applyHeader(r, 4, DARK_BG)
      hall.forEach((h, i) => {
        const row = ws.addRow([h.tipo || '—', h.seccion || '—', h.titulo || '—', h.descripcion || '—'])
        applyBody(row, 4, i % 2 === 1)
        const tipo = String(h.tipo || '').toLowerCase()
        if (tipo.includes('oportun')) {
          row.getCell(1).font = font({ bold: true, color: { argb: '16A34A' } })
          row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DCFCE7' } }
        } else if (tipo.includes('alerta') || tipo.includes('riesgo')) {
          row.getCell(1).font = font({ bold: true, color: { argb: 'DC2626' } })
          row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } }
        }
        row.getCell(4).alignment = { wrapText: true, vertical: 'top' }
        row.height = 30
      })
    }

    if (obs.length > 0) {
      addBlank(ws)
      r = ws.addRow(['OBSERVACIONES'])
      applySubtitle(ws, r, 5, 'DC2626')
      r = ws.addRow(['Sección', 'Título', 'Descripción', '', ''])
      applyHeader(r, 3, DARK_BG)
      obs.forEach((o, i) => {
        const row = ws.addRow([o.seccion || '—', o.titulo || '—', o.descripcion || '—'])
        applyBody(row, 3, i % 2 === 1)
        row.getCell(3).alignment = { wrapText: true, vertical: 'top' }
        row.height = 30
      })
    }
    autoWidth(ws)
    ws.getColumn(4).width = 50   // widen description column
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 10: ALERTAS Y OPORTUNIDADES (auto-generated)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    const alertas = []
    const evaluar = (nombre, val, antVal, umbral = 20, mejorSiCrece = true) => {
      if (!antVal || antVal === 0) return
      const cambio = pctDelta(val, antVal) * 100
      if (Math.abs(cambio) >= umbral) {
        const esPositivo = (cambio > 0 && mejorSiCrece) || (cambio < 0 && !mejorSiCrece)
        alertas.push({ nombre, val, cambio, tipo: esPositivo ? 'Oportunidad ✓' : 'Alerta ⚠' })
      }
    }
    for (const plat of ['facebook', 'instagram', 'tiktok']) {
      const act  = filteredData[plat] || {}
      const ant  = getH(plat, mesAnt)
      const alcF = plat === 'tiktok' ? 'views' : 'alcance'
      const l    = plat.charAt(0).toUpperCase() + plat.slice(1)
      evaluar(`${l} — Seguidores`,     v(act.seguidores),     v(ant.seguidores),     10, true)
      evaluar(`${l} — Alcance/Views`,  v(act[alcF]),          v(ant[alcF]),           30, true)
      evaluar(`${l} — Interacciones`,  v(act.interacciones),  v(ant.interacciones),   30, true)
      evaluar(`${l} — Inversión`,      v(act.inversion),      v(ant.inversion),       40, false)
    }
    for (const p of (filteredData.proyecciones || [])) {
      const meta = v(p.meta), real = v(p.real)
      if (!meta) continue
      const cumpl = (real / meta) * 100
      const nm    = `${p.metrica || p.objetivo || 'Meta'} — ${p.plataforma}`
      if (cumpl < 70) alertas.push({ nombre: nm, val: real, cambio: cumpl - 100, tipo: 'Alerta ⚠' })
      else if (cumpl > 120) alertas.push({ nombre: nm, val: real, cambio: cumpl - 100, tipo: 'Oportunidad ✓' })
    }

    if (alertas.length > 0) {
      const ws = wb.addWorksheet('Alertas', { properties: { tabColor: { argb: 'F97316' } } })
      let r    = ws.addRow([`Alertas y Oportunidades — ${monthLabel}`])
      applyTitle(ws, r, 4, 'F97316')
      addBlank(ws)
      r = ws.addRow(['Indicador', 'Valor', 'Δ %', 'Clasificación'])
      applyHeader(r, 4, DARK_BG)
      alertas.forEach((a, i) => {
        const row  = ws.addRow([a.nombre, a.val, a.cambio / 100, a.tipo])
        applyBody(row, 4, i % 2 === 1)
        row.getCell(2).numFmt = '#,##0'
        row.getCell(3).numFmt = '+0.0%;-0.0%'
        const typeCell = row.getCell(4)
        if (a.tipo.startsWith('Oport')) {
          typeCell.font = font({ bold: true, color: { argb: '16A34A' } })
          typeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DCFCE7' } }
        } else {
          typeCell.font = font({ bold: true, color: { argb: 'DC2626' } })
          typeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } }
        }
        typeCell.border = THIN
        typeCell.alignment = { horizontal: 'center', vertical: 'middle' }
      })
      autoWidth(ws)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SAVE
  // ═══════════════════════════════════════════════════════════════════════════
  const buffer   = await wb.xlsx.writeBuffer()
  const safeName = nombre.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '').trim().replace(/\s+/g, '_')
  const blob     = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url      = URL.createObjectURL(blob)
  const a        = document.createElement('a')
  a.href         = url
  a.download     = `Dashboard_${safeName}_${selectedMonth}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
