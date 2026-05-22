import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { formatMonthShort, formatMonthLong, safeNumber } from './format'
import { tipoCampanaToBucket, bucketToLabel } from './campaigns'

const v = (val) => safeNumber(val, 0)
const delta = (act, ant) => {
  if (ant === 0) return act > 0 ? 'Nuevo' : '—'
  const p = ((act - ant) / ant) * 100
  return { text: `${p > 0 ? '+' : ''}${p.toFixed(1)}%`, value: p }
}
const prevMonth = (m) => {
  if (!m?.includes('-')) return null
  const [y, mo] = m.split('-').map(Number)
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`
}
const pctField = (val) => {
  const raw = v(val)
  return raw === 0 ? 0 : raw / 100 // ExcelJS percentage format expects 0.0117 for 1.17%
}

// ── Brand accent colors ──
const BRAND = {
  botanera: 'FF6B00',
  chamoy: 'A855F7',
  pacific: '3B82F6',
}

// ── Style helpers ──
const DARK_BG = '1E293B'
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFF' }, size: 10, name: 'Calibri' }
const TITLE_FONT = { bold: true, color: { argb: 'FFFFFF' }, size: 14, name: 'Calibri' }
const SUB_FONT = { bold: true, size: 10, name: 'Calibri' }
const BODY_FONT = { size: 9.5, name: 'Calibri' }
const THIN_BORDER = {
  top: { style: 'thin', color: { argb: 'D1D5DB' } },
  bottom: { style: 'thin', color: { argb: 'D1D5DB' } },
  left: { style: 'thin', color: { argb: 'D1D5DB' } },
  right: { style: 'thin', color: { argb: 'D1D5DB' } },
}

function styleHeaderRow(ws, row, colCount, accentColor) {
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c)
    cell.font = HEADER_FONT
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: accentColor } }
    cell.border = THIN_BORDER
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  }
  row.height = 22
}

function styleTitleRow(ws, row, colCount, color) {
  ws.mergeCells(row.number, 1, row.number, colCount)
  const cell = row.getCell(1)
  cell.font = TITLE_FONT
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color || DARK_BG } }
  cell.alignment = { vertical: 'middle' }
  row.height = 28
}

function styleSubtitleRow(ws, row, colCount) {
  ws.mergeCells(row.number, 1, row.number, colCount)
  row.getCell(1).font = { ...SUB_FONT, color: { argb: '374151' } }
  row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F3F4F6' } }
  row.height = 20
}

function styleBodyRow(row, colCount, isAlt) {
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c)
    cell.font = BODY_FONT
    cell.border = THIN_BORDER
    cell.alignment = { vertical: 'middle' }
    if (isAlt) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F9FAFB' } }
  }
}

function styleDeltaCell(cell, deltaObj) {
  if (!deltaObj || typeof deltaObj === 'string') {
    cell.value = deltaObj || '—'
    return
  }
  cell.value = deltaObj.text
  if (deltaObj.value > 5) {
    cell.font = { ...BODY_FONT, color: { argb: '16A34A' }, bold: true } // green
  } else if (deltaObj.value < -5) {
    cell.font = { ...BODY_FONT, color: { argb: 'DC2626' }, bold: true } // red
  }
}

function autoWidth(ws) {
  ws.columns.forEach(col => {
    let max = 10
    col.eachCell({ includeEmpty: false }, cell => {
      const len = String(cell.value || '').length
      if (len > max) max = len
    })
    col.width = Math.min(max + 3, 40)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export async function exportDashboardData(marcaId, mesSeleccionado, filteredData, allData, allProyecciones, brandConfig) {
  const wb = new ExcelJS.Workbook()
  wb.creator = brandConfig?.nombre || marcaId
  wb.created = new Date()

  const mesAnt = prevMonth(mesSeleccionado)
  const nombre = brandConfig?.nombre || marcaId
  const monthLabel = formatMonthLong(mesSeleccionado)
  const accent = BRAND[marcaId] || '6366F1'
  const getH = (p, m) => (allData[p] || []).find(r => r.mes === m) || {}

  // ═══════════════════════════════════════════════════════════════════════
  // 1. RESUMEN EJECUTIVO
  // ═══════════════════════════════════════════════════════════════════════
  const ws1 = wb.addWorksheet('Resumen Ejecutivo', { properties: { tabColor: { argb: accent } } })

  // Title
  const r1 = ws1.addRow([`${nombre} — Resumen Ejecutivo`])
  styleTitleRow(ws1, r1, 9, accent)
  const r2 = ws1.addRow([monthLabel])
  ws1.mergeCells(r2.number, 1, r2.number, 9)
  r2.getCell(1).font = { ...SUB_FONT, color: { argb: '6B7280' } }
  r2.height = 18
  ws1.addRow([])

  // Headers
  const hdr = ws1.addRow(['Plataforma', 'Seguidores', 'vs Ant.', 'Alcance/Views', 'vs Ant.', 'Interacciones', 'vs Ant.', 'Inversión', 'vs Ant.'])
  styleHeaderRow(ws1, hdr, 9, DARK_BG)

  let totalSeg = 0, totalAlc = 0, totalInt = 0, totalInv = 0
  for (const [i, plat] of ['facebook', 'instagram', 'tiktok'].entries()) {
    const act = getH(plat, mesSeleccionado), ant = getH(plat, mesAnt)
    const alcF = plat === 'tiktok' ? 'views' : 'alcance'
    const seg = v(act.seguidores), alc = v(act[alcF]), int = v(act.interacciones), inv = v(act.inversion)
    totalSeg += seg; totalAlc += alc; totalInt += int; totalInv += inv

    const row = ws1.addRow([plat.charAt(0).toUpperCase() + plat.slice(1), seg, '', alc, '', int, '', inv, ''])
    styleBodyRow(row, 9, i % 2 === 1)
    styleDeltaCell(row.getCell(3), delta(seg, v(ant.seguidores)))
    styleDeltaCell(row.getCell(5), delta(alc, v(ant[alcF])))
    styleDeltaCell(row.getCell(7), delta(int, v(ant.interacciones)))
    styleDeltaCell(row.getCell(9), delta(inv, v(ant.inversion)))
    // Currency format for inversión
    row.getCell(8).numFmt = '$#,##0.00'
    row.getCell(2).numFmt = '#,##0'
    row.getCell(4).numFmt = '#,##0'
    row.getCell(6).numFmt = '#,##0'
  }

  // Google Ads row
  const gaAct = (filteredData.googleAds || []).reduce((s, r) => s + v(r.inversion), 0)
  const gaAntT = (allData.googleAds || []).filter(r => r.mes === mesAnt).reduce((s, r) => s + v(r.inversion), 0)
  totalInv += gaAct
  const gaRow = ws1.addRow(['Google Ads', '—', '', '—', '', '—', '', gaAct, ''])
  styleBodyRow(gaRow, 9, true)
  styleDeltaCell(gaRow.getCell(9), delta(gaAct, gaAntT))
  gaRow.getCell(8).numFmt = '$#,##0.00'

  // Totals row
  ws1.addRow([])
  const totRow = ws1.addRow(['TOTALES', totalSeg, '', totalAlc, '', totalInt, '', totalInv, ''])
  for (let c = 1; c <= 9; c++) {
    const cell = totRow.getCell(c)
    cell.font = { ...BODY_FONT, bold: true, color: { argb: 'FFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: accent } }
    cell.border = THIN_BORDER
  }
  totRow.getCell(2).numFmt = '#,##0'
  totRow.getCell(4).numFmt = '#,##0'
  totRow.getCell(6).numFmt = '#,##0'
  totRow.getCell(8).numFmt = '$#,##0.00'
  autoWidth(ws1)

  // ═══════════════════════════════════════════════════════════════════════
  // 2. PLATFORM SHEETS (Facebook, Instagram, TikTok)
  // ═══════════════════════════════════════════════════════════════════════
  for (const plat of ['facebook', 'instagram', 'tiktok']) {
    const label = plat.charAt(0).toUpperCase() + plat.slice(1)
    const ws = wb.addWorksheet(label, { properties: { tabColor: { argb: accent } } })
    const act = filteredData[plat] || {}, ant = getH(plat, mesAnt)
    const alcF = plat === 'tiktok' ? 'views' : 'alcance'

    // Title
    const t = ws.addRow([`${label} — ${monthLabel}`])
    styleTitleRow(ws, t, 7, accent)
    ws.addRow([])

    // KPIs section
    const sub1 = ws.addRow(['MÉTRICAS PRINCIPALES'])
    styleSubtitleRow(ws, sub1, 3)
    const kh = ws.addRow(['Métrica', 'Valor', 'vs Mes Anterior'])
    styleHeaderRow(ws, kh, 3, DARK_BG)

    const metrics = [
      ['Seguidores', v(act.seguidores), v(ant.seguidores)],
      ['Nuevos seguidores', v(act.nuevos_seguidores), v(ant.nuevos_seguidores)],
      [plat === 'tiktok' ? 'Views' : 'Alcance', v(act[alcF]), v(ant[alcF])],
      ['Interacciones', v(act.interacciones), v(ant.interacciones)],
      ['Impresiones', v(act.impresiones), v(ant.impresiones)],
      ['Publicaciones', v(act.publicaciones), v(ant.publicaciones)],
      ['Engagement Rate', v(act.engagement_rate), null],
      ['Inversión', v(act.inversion), v(ant.inversion)],
    ]
    if (plat === 'tiktok') metrics.splice(3, 0, ['Views 6s+', v(act.views_6s), v(ant.views_6s)])

    metrics.forEach(([name, val, antVal], i) => {
      const row = ws.addRow([name, val, ''])
      styleBodyRow(row, 3, i % 2 === 1)
      if (name === 'Engagement Rate') {
        row.getCell(2).numFmt = '0.00"%"'
      } else if (name === 'Inversión') {
        row.getCell(2).numFmt = '$#,##0.00'
      } else {
        row.getCell(2).numFmt = '#,##0'
      }
      if (antVal !== null) styleDeltaCell(row.getCell(3), delta(val, antVal))
      else row.getCell(3).value = ''
    })

    // Campaigns
    const camps = (filteredData.campanas || []).filter(c => c.plataforma === plat)
    const proyP = (allProyecciones || []).filter(p => p.mes === mesSeleccionado && p.plataforma === plat)
    const bMap = new Map()
    for (const c of camps) {
      const b = c._bucket || tipoCampanaToBucket(c.tipo_campana)
      const o = c._objective || c.objetivo_detectado || c.objetivo || 'Sin objetivo'
      const k = `${b}|${o}`
      if (!bMap.has(k)) bMap.set(k, { b, o, res: 0, inv: 0, meta: null })
      const e = bMap.get(k); e.res += v(c.resultado); e.inv += v(c.inversion)
    }
    for (const p of proyP) {
      const b = tipoCampanaToBucket(p.tipo_campana), o = p.objetivo || p.metrica || 'Sin objetivo'
      const k = `${b}|${o}`
      if (!bMap.has(k)) bMap.set(k, { b, o, res: 0, inv: 0, meta: null })
      const e = bMap.get(k); e.meta = v(p.meta)
      if (e.res === 0) e.res = v(p.real)
    }

    if (bMap.size > 0) {
      ws.addRow([])
      const sub2 = ws.addRow(['CAMPAÑAS POR BUCKET'])
      styleSubtitleRow(ws, sub2, 7)
      const ch = ws.addRow(['Bucket', 'Objetivo', 'Resultado', 'Meta', 'Cumplimiento', 'Inversión', 'CPR'])
      styleHeaderRow(ws, ch, 7, DARK_BG)

      let ci = 0
      for (const e of bMap.values()) {
        const cumpl = e.meta > 0 ? (e.res / e.meta) : null
        const cpr = e.res > 0 ? e.inv / e.res : 0
        const row = ws.addRow([bucketToLabel(e.b, e.b), e.o, e.res, e.meta || '—', cumpl !== null ? cumpl : '—', e.inv, cpr > 0 ? cpr : '—'])
        styleBodyRow(row, 7, ci % 2 === 1)
        row.getCell(3).numFmt = '#,##0'
        row.getCell(4).numFmt = '#,##0'
        if (cumpl !== null) {
          row.getCell(5).numFmt = '0.0%'
          // Conditional color for compliance
          if (cumpl >= 1) {
            row.getCell(5).font = { ...BODY_FONT, color: { argb: '16A34A' }, bold: true }
            row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DCFCE7' } }
          } else if (cumpl < 0.7) {
            row.getCell(5).font = { ...BODY_FONT, color: { argb: 'DC2626' }, bold: true }
            row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } }
          } else {
            row.getCell(5).font = { ...BODY_FONT, color: { argb: 'D97706' }, bold: true }
            row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } }
          }
        }
        row.getCell(6).numFmt = '$#,##0.00'
        if (typeof row.getCell(7).value === 'number') row.getCell(7).numFmt = '$#,##0.00'
        ci++
      }
    }

    // Historical
    const histM = (allData[plat] || []).map(r => r.mes).filter(Boolean).sort().slice(-6)
    if (histM.length > 1) {
      ws.addRow([])
      const sub3 = ws.addRow(['EVOLUCIÓN HISTÓRICA'])
      styleSubtitleRow(ws, sub3, 5)
      const hh = ws.addRow(['Mes', 'Seguidores', plat === 'tiktok' ? 'Views' : 'Alcance', 'Interacciones', 'Inversión'])
      styleHeaderRow(ws, hh, 5, DARK_BG)
      histM.forEach((m, i) => {
        const d = getH(plat, m)
        const row = ws.addRow([formatMonthShort(m), v(d.seguidores), v(d[alcF]), v(d.interacciones), v(d.inversion)])
        styleBodyRow(row, 5, i % 2 === 1)
        row.getCell(2).numFmt = '#,##0'
        row.getCell(3).numFmt = '#,##0'
        row.getCell(4).numFmt = '#,##0'
        row.getCell(5).numFmt = '$#,##0.00'
      })
    }
    autoWidth(ws)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 3. GOOGLE ADS
  // ═══════════════════════════════════════════════════════════════════════
  const gaData = filteredData.googleAds || []
  if (gaData.length > 0) {
    const ws = wb.addWorksheet('Google Ads', { properties: { tabColor: { argb: accent } } })
    const t = ws.addRow([`Google Ads — ${monthLabel}`])
    styleTitleRow(ws, t, 5, accent)
    ws.addRow([])

    const gaAntArr = (allData.googleAds || []).filter(r => r.mes === mesAnt)
    const tot = gaData.reduce((a, r) => ({ i: a.i + v(r.impresiones_visibles), c: a.c + v(r.clics), vw: a.vw + v(r.visualizaciones), inv: a.inv + v(r.inversion) }), { i: 0, c: 0, vw: 0, inv: 0 })
    const antT = gaAntArr.reduce((a, r) => ({ i: a.i + v(r.impresiones_visibles), c: a.c + v(r.clics), vw: a.vw + v(r.visualizaciones), inv: a.inv + v(r.inversion) }), { i: 0, c: 0, vw: 0, inv: 0 })

    const sub = ws.addRow(['KPIs GENERALES'])
    styleSubtitleRow(ws, sub, 3)
    const hdr = ws.addRow(['Métrica', 'Valor', 'vs Anterior'])
    styleHeaderRow(ws, hdr, 3, DARK_BG)

    const kpis = [
      ['Imp. Visibles', tot.i, antT.i, '#,##0'],
      ['Clics', tot.c, antT.c, '#,##0'],
      ['CTR', tot.i > 0 ? tot.c / tot.i : 0, null, '0.00%'],
      ['Views (Video)', tot.vw, antT.vw, '#,##0'],
      ['Inversión', tot.inv, antT.inv, '$#,##0.00'],
    ]
    kpis.forEach(([name, val, antVal, fmt], i) => {
      const row = ws.addRow([name, val, ''])
      styleBodyRow(row, 3, i % 2 === 1)
      row.getCell(2).numFmt = fmt
      if (antVal !== null) styleDeltaCell(row.getCell(3), delta(val, antVal))
    })

    // By type
    ws.addRow([])
    const sub2 = ws.addRow(['DESGLOSE POR TIPO'])
    styleSubtitleRow(ws, sub2, 5)
    const h2 = ws.addRow(['Tipo', 'Imp./Views', 'Clics', 'Inversión', 'CPR'])
    styleHeaderRow(ws, h2, 5, DARK_BG)
    const byT = {}
    for (const r of gaData) { const t = r.tipo_red || 'Otro'; if (!byT[t]) byT[t] = { i: 0, vw: 0, c: 0, inv: 0 }; byT[t].i += v(r.impresiones_visibles); byT[t].vw += v(r.visualizaciones); byT[t].c += v(r.clics); byT[t].inv += v(r.inversion) }
    let ci = 0
    for (const [tp, vals] of Object.entries(byT)) {
      const metric = tp.toLowerCase().includes('video') ? vals.vw : vals.i
      const cpr = metric > 0 ? vals.inv / metric : 0
      const row = ws.addRow([tp, metric, vals.c, vals.inv, cpr > 0 ? cpr : '—'])
      styleBodyRow(row, 5, ci % 2 === 1)
      row.getCell(2).numFmt = '#,##0'
      row.getCell(3).numFmt = '#,##0'
      row.getCell(4).numFmt = '$#,##0.00'
      if (typeof row.getCell(5).value === 'number') row.getCell(5).numFmt = '$#,##0.00'
      ci++
    }
    autoWidth(ws)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 4. ALERTAS Y OPORTUNIDADES
  // ═══════════════════════════════════════════════════════════════════════
  const alertas = []
  const evaluar = (nombre, val, ant, umbral = 30, mejorSiCrece = true) => {
    if (ant === 0) return
    const cambio = ((val - ant) / ant) * 100
    if (Math.abs(cambio) >= umbral) {
      const esPositivo = (cambio > 0 && mejorSiCrece) || (cambio < 0 && !mejorSiCrece)
      alertas.push({ nombre, val, cambio, tipo: esPositivo ? 'Oportunidad' : 'Alerta' })
    }
  }
  for (const plat of ['facebook', 'instagram', 'tiktok']) {
    const act = filteredData[plat] || {}, ant = getH(plat, mesAnt)
    const l = plat.charAt(0).toUpperCase() + plat.slice(1)
    evaluar(`${l} — Seguidores`, v(act.seguidores), v(ant.seguidores), 10, true)
    evaluar(`${l} — Interacciones`, v(act.interacciones), v(ant.interacciones), 30, true)
    evaluar(`${l} — Inversión`, v(act.inversion), v(ant.inversion), 40, false)
  }
  for (const p of (allProyecciones || []).filter(p => p.mes === mesSeleccionado)) {
    const meta = v(p.meta), real = v(p.real)
    if (meta === 0) continue
    const cumpl = (real / meta) * 100
    if (cumpl < 70) alertas.push({ nombre: `Meta: ${p.metrica || p.objetivo} (${p.plataforma})`, val: real, cambio: cumpl, tipo: 'Alerta' })
    else if (cumpl > 120) alertas.push({ nombre: `Meta: ${p.metrica || p.objetivo} (${p.plataforma})`, val: real, cambio: cumpl, tipo: 'Oportunidad' })
  }

  if (alertas.length > 0) {
    const ws = wb.addWorksheet('Alertas', { properties: { tabColor: { argb: 'EF4444' } } })
    const t = ws.addRow(['Alertas y Oportunidades'])
    styleTitleRow(ws, t, 4, accent)
    ws.addRow([])
    const hdr = ws.addRow(['Indicador', 'Valor', 'Cambio %', 'Tipo'])
    styleHeaderRow(ws, hdr, 4, DARK_BG)
    alertas.forEach((a, i) => {
      const row = ws.addRow([a.nombre, a.val, a.cambio / 100, a.tipo])
      styleBodyRow(row, 4, i % 2 === 1)
      row.getCell(2).numFmt = '#,##0'
      row.getCell(3).numFmt = '+0.0%;-0.0%'
      // Color the type cell
      const typeCell = row.getCell(4)
      if (a.tipo === 'Oportunidad') {
        typeCell.font = { ...BODY_FONT, color: { argb: '16A34A' }, bold: true }
        typeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DCFCE7' } }
      } else {
        typeCell.font = { ...BODY_FONT, color: { argb: 'DC2626' }, bold: true }
        typeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } }
      }
    })
    autoWidth(ws)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SAVE
  // ═══════════════════════════════════════════════════════════════════════
  const buffer = await wb.xlsx.writeBuffer()
  const safeName = nombre.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '').trim().replace(/\s+/g, '_')
  saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Dashboard_${safeName}_${mesSeleccionado}.xlsx`)
}
