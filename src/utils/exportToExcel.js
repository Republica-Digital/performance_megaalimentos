import ExcelJS from 'exceljs'
import FileSaver from 'file-saver'
import { formatMonthShort, formatMonthLong, safeNumber } from './format'
import { buildCampaignPerformance, getCampaignPlatform, tipoCampanaToBucket, bucketToLabel } from './campaigns'

const v = (val) => safeNumber(val, 0)
const normP  = s => String(s || '').toLowerCase().trim()
const normK  = s => String(s || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const isCPM  = m => { const k = normK(m || ''); return k.includes('alcance') || k.includes('reach') }
const isCPV  = m => { const k = normK(m || ''); return k.includes('view') || k.includes('thruplay') }
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

const INVALID_XLSX_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g

function cleanWorkbookValues(wb) {
  wb.eachSheet(ws => {
    ws.eachRow(row => {
      row.eachCell(cell => {
        if (typeof cell.value === 'string') {
          cell.value = cell.value.replace(INVALID_XLSX_CHARS, '').slice(0, 32767)
          return
        }

        if (typeof cell.value === 'number' && !Number.isFinite(cell.value)) {
          cell.value = null
        }
      })
    })
  })
}

function downloadWorkbook(buffer, filename) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const saveWorkbookAs = FileSaver?.saveAs || FileSaver?.default || FileSaver

  if (typeof saveWorkbookAs === 'function') {
    saveWorkbookAs(blob, filename)
    return
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

const INVESTMENT_PLATFORMS = ['facebook', 'instagram', 'tiktok', 'google_ads']

function investmentPlatformKey(value) {
  const key = normK(value).replace(/\s+/g, ' ')
  if (!key) return 'sin_plataforma'
  if (key === 'fb' || key === 'facebook') return 'facebook'
  if (key === 'ig' || key === 'instagram') return 'instagram'
  if (key === 'tt' || key === 'tik tok' || key === 'tiktok') return 'tiktok'
  if (key === 'google' || key === 'google ads' || key === 'googleads') return 'google_ads'
  return key.replace(/\s+/g, '_')
}

function investmentPlatformLabel(key) {
  return {
    facebook: 'Facebook',
    instagram: 'Instagram',
    tiktok: 'TikTok',
    google_ads: 'Google Ads',
    sin_plataforma: 'Sin plataforma',
  }[key] || String(key || '').replace(/_/g, ' ')
}

function isThroughSelectedMonth(month, selectedMonth) {
  return Boolean(month && selectedMonth && month.slice(0, 4) === selectedMonth.slice(0, 4) && month <= selectedMonth)
}

function investmentObjectiveKey(row) {
  return normK(row?.objetivo || row?.metrica || row?._objective || row?.objetivo_detectado || row?.tipo_red || row?.tipo_objetivo || 'Sin objetivo')
}

function investmentObjectiveLabel(row) {
  return row?.objetivo || row?.metrica || row?._objective || row?.objetivo_detectado || row?.tipo_red || row?.tipo_objetivo || 'Sin objetivo'
}

function makeInvestmentModel({ allData, selectedMonth }) {
  const makeTotals = () => ({ budget: 0, actual: 0, hasBudget: false })
  const monthMap = new Map()
  const platformMonthMap = new Map()
  const platformYtdMap = new Map()
  const detailMap = new Map()
  const getOrCreate = (map, key, seed = {}) => {
    if (!map.has(key)) map.set(key, { ...makeTotals(), ...seed })
    return map.get(key)
  }

  const addActual = (month, platform, amount) => {
    if (!isThroughSelectedMonth(month, selectedMonth)) return
    const platformKey = investmentPlatformKey(platform)
    getOrCreate(monthMap, month).actual += amount
    getOrCreate(platformMonthMap, `${platformKey}|${month}`, { platform: platformKey, month }).actual += amount
    getOrCreate(platformYtdMap, platformKey, { platform: platformKey }).actual += amount
  }
  const addBudget = (month, platform, amount) => {
    if (!isThroughSelectedMonth(month, selectedMonth) || amount <= 0) return
    const platformKey = investmentPlatformKey(platform)
    const monthRec = getOrCreate(monthMap, month)
    monthRec.budget += amount
    monthRec.hasBudget = true
    const platformMonthRec = getOrCreate(platformMonthMap, `${platformKey}|${month}`, { platform: platformKey, month })
    platformMonthRec.budget += amount
    platformMonthRec.hasBudget = true
    const platformYtdRec = getOrCreate(platformYtdMap, platformKey, { platform: platformKey })
    platformYtdRec.budget += amount
    platformYtdRec.hasBudget = true
  }
  const addDetailActual = (row, platform, type, objective, amount) => {
    const month = row?.mes
    if (!isThroughSelectedMonth(month, selectedMonth)) return
    const platformKey = investmentPlatformKey(platform)
    const bucket = type || 'Mensual / AON'
    const objectiveKey = normK(objective || 'Sin objetivo')
    const rec = getOrCreate(detailMap, `${platformKey}|${bucket}|${objectiveKey}`, {
      platform: platformKey,
      bucket,
      objective: objective || 'Sin objetivo',
      currentActual: 0,
      currentBudget: 0,
      hasCurrentBudget: false,
    })
    rec.actual += amount
    if (month === selectedMonth) rec.currentActual += amount
  }
  const addDetailBudget = (row, amount) => {
    const month = row?.mes
    if (!isThroughSelectedMonth(month, selectedMonth) || amount <= 0) return
    const platformKey = investmentPlatformKey(row.plataforma)
    const bucket = bucketToLabel(tipoCampanaToBucket(row.tipo_campana || 'AON'), row.tipo_campana || 'AON')
    const objective = investmentObjectiveLabel(row)
    const rec = getOrCreate(detailMap, `${platformKey}|${bucket}|${investmentObjectiveKey(row)}`, {
      platform: platformKey,
      bucket,
      objective,
      currentActual: 0,
      currentBudget: 0,
      hasCurrentBudget: false,
    })
    rec.budget += amount
    rec.hasBudget = true
    if (month === selectedMonth) {
      rec.currentBudget += amount
      rec.hasCurrentBudget = true
    }
  }

  for (const row of (allData?.campanas || [])) {
    const platform = getCampaignPlatform(row)
    const amount = v(row.inversion)
    addActual(row.mes, platform, amount)
    addDetailActual(
      row,
      platform,
      bucketToLabel(row._bucket || tipoCampanaToBucket(row.tipo_campana), row.tipo_campana || row._tipoCampana || 'AON'),
      row._objective || row.objetivo_detectado || row.objetivo,
      amount,
    )
  }

  for (const row of (allData?.googleAds || [])) {
    const amount = v(row.inversion)
    addActual(row.mes, 'google_ads', amount)
    addDetailActual(row, 'google_ads', 'Mensual / AON', row.tipo_red || row.tipo_objetivo || 'Google Ads', amount)
  }

  for (const row of (allData?.proyecciones || [])) {
    const budget = v(row.presupuesto)
    addBudget(row.mes, row.plataforma, budget)
    addDetailBudget(row, budget)
  }

  const months = [...monthMap.keys()].sort()
  const hasAnyBudget = [...monthMap.values()].some(rec => rec.hasBudget)
  const platformKeys = [...new Set([
    ...INVESTMENT_PLATFORMS,
    ...[...platformYtdMap.keys()],
    ...[...platformMonthMap.values()].map(rec => rec.platform),
  ])]
  const platformRows = platformKeys.map(platform => {
    const monthRec = platformMonthMap.get(`${platform}|${selectedMonth}`) || makeTotals()
    const ytdRec = platformYtdMap.get(platform) || makeTotals()
    return {
      platform,
      label: investmentPlatformLabel(platform),
      monthBudget: monthRec.budget,
      monthActual: monthRec.actual,
      hasMonthBudget: monthRec.hasBudget,
      ytdBudget: ytdRec.budget,
      ytdActual: ytdRec.actual,
      hasYtdBudget: ytdRec.hasBudget,
    }
  }).filter(row => row.monthBudget || row.monthActual || row.ytdBudget || row.ytdActual || INVESTMENT_PLATFORMS.includes(row.platform))

  const monthRows = months.map(month => ({ month, ...(monthMap.get(month) || makeTotals()) }))
  const detailRows = [...detailMap.values()]
    .map(rec => ({ ...rec, pendingBudget: hasAnyBudget && rec.actual > 0 && !rec.hasBudget }))
    .filter(rec => rec.budget || rec.actual)
    .sort((a, b) => `${a.platform}|${a.bucket}|${a.objective}`.localeCompare(`${b.platform}|${b.bucket}|${b.objective}`))
  const selected = monthMap.get(selectedMonth) || makeTotals()
  const ytd = monthRows.reduce((acc, rec) => ({
    budget: acc.budget + rec.budget,
    actual: acc.actual + rec.actual,
    hasBudget: acc.hasBudget || rec.hasBudget,
  }), makeTotals())
  const hasPendingBudget = hasAnyBudget && (
    platformRows.some(row => (row.monthActual > 0 && !row.hasMonthBudget) || (row.ytdActual > 0 && !row.hasYtdBudget))
    || detailRows.some(row => row.pendingBudget)
  )

  return { hasAnyBudget, hasPendingBudget, selected, ytd, platformRows, monthRows, detailRows }
}

function setMoney(cell, value) {
  cell.value = value
  cell.numFmt = '$#,##0.00'
}

function setBalance(cell, budget, actual) {
  const balance = budget - actual
  cell.value = balance
  cell.numFmt = '$#,##0.00;-$#,##0.00;$0.00'
  cell.font = font({ bold: true, color: { argb: balance >= 0 ? '16A34A' : 'DC2626' } })
}

function setBudgetOrPending(cell, value, hasBudget, hasAnyBudget) {
  if (!hasAnyBudget || hasBudget) {
    setMoney(cell, value)
    return
  }
  cell.value = 'Pendiente capturar'
  cell.font = font({ italic: true, color: { argb: 'D97706' } })
}

function setUsageOrPending(cell, budget, actual, hasBudget, hasAnyBudget) {
  if (!hasAnyBudget || !hasBudget || budget <= 0) {
    cell.value = hasAnyBudget ? 'Pendiente capturar' : 'N/A'
    cell.font = font({ italic: true, color: { argb: '6B7280' } })
    return
  }
  cell.value = actual / budget
  cell.numFmt = '0.0%'
  cell.font = font({ bold: true, color: { argb: actual > budget ? 'DC2626' : '16A34A' } })
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// Called from Dashboard as: exportDashboardData({ brandConfig, filteredData, allData, selectedMonth })
// ─────────────────────────────────────────────────────────────────────────────
function withTimeout(promise, ms, message) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

export async function exportDashboardData({ brandConfig, filteredData, allData, selectedMonth, onProgress }) {
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

    // ─ PAID MEDIA — lógica portada 1:1 desde SocialSection.jsx ──────────────
    // Funciones idénticas al dashboard: campanaInversion, buildObjectiveInversionMap,
    // buildPlatformObjectiveInversionMap, buildPlatformCPRMeta, getGroupCPRMeta, getGroups
    // Fuente: pestaña Campañas (inversión) + pestaña Proyecciones (resultados/metas)

    const normP  = s => String(s || '').toLowerCase().trim()
    const normK  = s => String(s || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const isCPM  = m => { const k = normK(m || ''); return k.includes('alcance') || k.includes('reach') }
    const isCPV  = m => { const k = normK(m || ''); return k.includes('view') || k.includes('thruplay') }

    // -- campanaInversion: igual que SocialSection línea 82 --
    const campanaInversion = (bucket) =>
      (filteredData.campanas || [])
        .filter(c => {
          const cPlat   = getCampaignPlatform(c)
          const cBucket = c._bucket || tipoCampanaToBucket(c.tipo_campana)
          return cPlat === plat && (bucket === null || cBucket === bucket)
        })
        .reduce((a, c) => a + v(c.inversion), 0)

    // -- buildObjectiveInversionMap: igual que SocialSection línea 94 --
    const buildObjInvMap = (bucket) => {
      const map = {}
      ;(filteredData.campanas || [])
        .filter(c => {
          const cPlat   = getCampaignPlatform(c)
          const cBucket = c._bucket || tipoCampanaToBucket(c.tipo_campana)
          return cPlat === plat && cBucket === bucket
        })
        .forEach(c => {
          const key = normK(c._objective || c.objetivo_detectado || c.objetivo || '')
          if (!key) return
          map[key] = (map[key] || 0) + v(c.inversion)
        })
      return map
    }

    // -- buildPlatformObjectiveInversionMap: igual que SocialSection línea 109 --
    const platObjInvMap = (() => {
      const map = {}
      ;(filteredData.campanas || [])
        .filter(c => getCampaignPlatform(c) === plat)
        .forEach(c => {
          const key = normK(c._objective || c.objetivo_detectado || c.objetivo || '')
          if (!key) return
          map[key] = (map[key] || 0) + v(c.inversion)
        })
      return map
    })()

    // -- Proyecciones de esta plataforma y mes --
    const platProy = (filteredData.proyecciones || []).filter(p => normP(p.plataforma) === plat)
    const platformPerformance = buildCampaignPerformance(filteredData.campanas || [], plat, null)
    const findPerformance = (performanceMap, row) => {
      const keys = [...new Set([row?.objetivo, row?.metrica].map(normK).filter(Boolean))]
      for (const key of keys) if (performanceMap[key]) return performanceMap[key]
      return null
    }

    // -- Proyecciones mes anterior --
    const prevPlatProy = (Array.isArray(allData?.proyecciones) ? allData.proyecciones : [])
      .filter(p => normP(p.plataforma) === plat && p.mes === mesAnt)

    // -- inversionTotal --
    const inversionTotal = campanaInversion(null)

    // -- groups: igual que getGroups() de SocialSection --
    const groups = (() => {
      const seen = new Map()
      for (const p of platProy) {
        const tipo = p.tipo_campana || 'AON'
        const key  = tipoCampanaToBucket(tipo)
        if (!seen.has(key)) seen.set(key, tipo)
      }
      const order = ['mensual', ...[...seen.keys()].filter(k => k !== 'mensual').sort()]
      return order.filter(k => seen.has(k)).map(k => ({ key: k, label: bucketToLabel(k, seen.get(k)) }))
    })()

    // -- metricTotals: igual que SocialSection línea 183 --
    const metricTotals = (() => {
      const metaByKey = {}
      const labelByKey = {}
      for (const r of platProy) {
        const key = normK(r.metrica || r.objetivo || '')
        if (!key) continue
        metaByKey[key] = (metaByKey[key] || 0) + v(r.meta)
        labelByKey[key] = r.metrica || r.objetivo
      }
      return Object.entries(platformPerformance)
        .map(([key, actual]) => ({
          metrica: labelByKey[key] || actual.metrica || actual.objetivo,
          resultado: actual.resultado,
          meta: metaByKey[key] || 0,
        }))
        .filter(m => m.resultado > 0)
        .sort((a, b) => b.resultado - a.resultado)
    })()

    // -- prevMetricMap: igual que SocialSection línea 197 --
    const prevMetricMap = (() => {
      return {}
    })()

    // -- metricToObj / objToMetric --
    const metricToObj = {}, objToMetric = {}
    for (const r of platProy) {
      const mk = normK(r.metrica || ''); const ok = normK(r.objetivo || '')
      if (mk && ok) { metricToObj[mk] = ok; objToMetric[ok] = mk }
    }

    // -- platformCPRs: igual que SocialSection línea 211 --
    const platformCPRs = metricTotals.map(m => {
      const key    = normK(m.metrica || '')
      const altKey = metricToObj[key] || objToMetric[key]
      const inv    = platObjInvMap[key] || (altKey ? platObjInvMap[altKey] : 0) || 0
      const cpr    = m.resultado > 0
        ? isCPM(m.metrica) ? (inv / m.resultado) * 1000 : inv / m.resultado
        : 0
      return { metrica: m.metrica, key, cpr, inv }
    }).filter(c => c.cpr > 0)

    // -- buildPlatformCPRMeta: igual que SocialSection línea 120 --
    const platCPRMetaMap = (() => {
      const map = {}
      for (const r of platProy) {
        const cpr = v(r.cpr_meta); if (cpr <= 0) continue
        const key = normK(r.objetivo || r.metrica || ''); if (!key) continue
        if (!map[key]) map[key] = { sum: 0, count: 0 }
        map[key].sum += cpr; map[key].count += 1
      }
      const result = {}
      for (const [k, val] of Object.entries(map)) result[k] = val.sum / val.count
      return result
    })()

    // -- getGroupCPRMeta: igual que SocialSection línea 134 --
    const getGroupCPRMeta = (bucket, objKey) => {
      const rows = platProy.filter(r =>
        tipoCampanaToBucket(r.tipo_campana || 'AON') === bucket &&
        normK(r.objetivo || r.metrica || '') === objKey
      )
      for (const r of rows) { const c = v(r.cpr_meta); if (c > 0) return c }
      return null
    }

    const hasPaidMedia = inversionTotal > 0 || platProy.length > 0

    if (hasPaidMedia) {
      addBlank(ws)
      r = ws.addRow(['PAID MEDIA'])
      applySubtitle(ws, r, 9, accent)

      // ── A. TOTALES DEL MES ─────────────────────────────────────────────────
      addBlank(ws)
      r = ws.addRow(['TOTALES DEL MES'])
      applySubtitle(ws, r, 9, 'F59E0B')

      if (inversionTotal > 0) {
        r = ws.addRow(['Inversión Total', inversionTotal, '', '', '', '', '', '', ''])
        applyBody(r, 2, false)
        r.getCell(1).font   = font({ bold: true, color: { argb: 'B45309' } })
        r.getCell(2).numFmt = '$#,##0.00'
        r.getCell(2).font   = font({ bold: true, color: { argb: 'B45309' } })
        r.getCell(1).alignment = { indent: 1, vertical: 'middle' }
      }

      if (metricTotals.length > 0) {
        r = ws.addRow(['Métrica', 'Resultado', 'Meta', 'Cumpl.', 'vs Mes Ant.', 'Δ Abs.', 'Inversión', 'CPR/CPM', 'CPR vs Meta'])
        applyHeader(r, 9, DARK_BG)

        metricTotals.forEach((m, i) => {
          const key    = normK(m.metrica || '')
          const altKey = metricToObj[key] || objToMetric[key]
          const inv    = platObjInvMap[key] || (altKey ? platObjInvMap[altKey] : 0) || 0
          const cpr    = m.resultado > 0
            ? (isCPM(m.metrica) ? (inv / m.resultado) * 1000 : inv / m.resultado)
            : null
          const cumpl  = m.meta > 0 ? m.resultado / m.meta : null
          const prevV  = prevMetricMap[key] || 0
          const deltaAbs = prevV > 0 ? m.resultado - prevV : null
          const deltaPct = prevV > 0 ? pctDelta(m.resultado, prevV) : null
          const cprMeta  = platCPRMetaMap[key] || platCPRMetaMap[altKey] || null
          // CPR vs Meta: si CPR real < meta → bueno (positivo), igual que dashboard
          const cprVsMeta = (cpr && cprMeta) ? (cprMeta - cpr) / cprMeta : null

          const row = ws.addRow([
            m.metrica,
            m.resultado,
            m.meta > 0 ? m.meta : null,
            null,                            // cumpl → cumplCell
            deltaPct  !== null ? deltaPct  : null,
            deltaAbs  !== null ? deltaAbs  : null,
            inv > 0 ? inv : null,
            cpr || null,
            cprVsMeta !== null ? cprVsMeta : null,
          ])
          applyBody(row, 9, i % 2 === 1)
          row.getCell(2).numFmt = '#,##0'
          if (m.meta > 0) row.getCell(3).numFmt = '#,##0'
          else row.getCell(3).value = '—'
          cumplCell(row.getCell(4), cumpl)
          if (deltaPct !== null) {
            deltaCell(row.getCell(5), deltaPct)
          } else row.getCell(5).value = '—'
          if (deltaAbs !== null) {
            row.getCell(6).numFmt = '+#,##0;-#,##0;0'
            row.getCell(6).font  = font({ bold: true, color: { argb: deltaAbs >= 0 ? '16A34A' : 'DC2626' } })
          } else row.getCell(6).value = '—'
          if (inv > 0) row.getCell(7).numFmt = '$#,##0.00'
          else row.getCell(7).value = '—'
          if (cpr) {
            row.getCell(8).numFmt = isCPM(m.metrica) ? '$#,##0.000' : '$#,##0.00'
            row.getCell(8).font  = font({ bold: true, color: { argb: '92400E' } })
          } else row.getCell(8).value = '—'
          if (cprVsMeta !== null) {
            row.getCell(9).numFmt = '+0.0%;-0.0%'
            row.getCell(9).font  = font({ bold: true, color: { argb: cprVsMeta >= 0 ? '16A34A' : 'DC2626' } })
          } else row.getCell(9).value = '—'
          row.getCell(1).alignment = { indent: 1, vertical: 'middle' }
        })
      }

      // ── B. CPR POR OBJETIVO A NIVEL PLATAFORMA ─────────────────────────────
      if (platformCPRs.length > 0) {
        addBlank(ws)
        r = ws.addRow(['CPR POR OBJETIVO — PLATAFORMA'])
        applySubtitle(ws, r, 6, accent)
        r = ws.addRow(['Métrica / Objetivo', 'CPR Real', 'CPR Meta', 'vs Meta', 'Inversión', ''])
        applyHeader(r, 5, DARK_BG)

        platformCPRs.forEach((c, i) => {
          const metaV   = platCPRMetaMap[c.key] || null
          const vsM     = (metaV && metaV > 0) ? (metaV - c.cpr) / metaV : null
          const row     = ws.addRow([c.metrica, c.cpr, metaV || null, vsM !== null ? vsM : null, c.inv > 0 ? c.inv : null])
          applyBody(row, 5, i % 2 === 1)
          row.getCell(2).numFmt = isCPM(c.metrica) ? '$#,##0.000' : '$#,##0.00'
          row.getCell(2).font  = font({ bold: true, color: { argb: '92400E' } })
          if (metaV) {
            row.getCell(3).numFmt = isCPM(c.metrica) ? '$#,##0.000' : '$#,##0.00'
            row.getCell(3).font  = font({ color: { argb: '6B7280' } })
          } else row.getCell(3).value = '—'
          if (vsM !== null) {
            row.getCell(4).numFmt = '+0.0%;-0.0%'
            row.getCell(4).font  = font({ bold: true, color: { argb: vsM >= 0 ? '16A34A' : 'DC2626' } })
          } else row.getCell(4).value = '—'
          if (c.inv > 0) row.getCell(5).numFmt = '$#,##0.00'
          else row.getCell(5).value = '—'
          row.getCell(1).alignment = { indent: 1, vertical: 'middle' }
        })
      }

      // ── C. DESGLOSE POR GRUPO (bucket) ─────────────────────────────────────
      for (const { key: bKey, label: bLabel } of groups) {
        const groupPerformance = buildCampaignPerformance(filteredData.campanas || [], plat, bKey)
        const groupRows = platProy
          .filter(p => tipoCampanaToBucket(p.tipo_campana || 'AON') === bKey)
          .map(p => {
            const actual = findPerformance(groupPerformance, p)
            return {
              ...p,
              _realFromCampaign: actual?.resultado || 0,
              _invFromCampaign: actual?.inversion || 0,
            }
          })
          .sort((a, b) => v(b._realFromCampaign) - v(a._realFromCampaign))

        const groupInv  = campanaInversion(bKey)
        const objInvMap = buildObjInvMap(bKey)

        if (groupRows.length === 0 && groupInv === 0) continue

        addBlank(ws)
        r = ws.addRow([`GRUPO: ${bLabel.toUpperCase()}`])
        applySubtitle(ws, r, 9, accent)

        // Inversión del grupo
        if (groupInv > 0) {
          const invRow = ws.addRow([`Inversión — ${bLabel}`, groupInv])
          applyBody(invRow, 2, false)
          invRow.getCell(1).font   = font({ bold: true, color: { argb: 'B45309' } })
          invRow.getCell(2).numFmt = '$#,##0.00'
          invRow.getCell(2).font   = font({ bold: true, color: { argb: 'B45309' } })
          invRow.getCell(1).alignment = { indent: 1, vertical: 'middle' }
        }

        if (groupRows.length > 0) {
          // Igual que la tabla del dashboard: Objetivo | Métrica | Resultado | Meta | vs Meta | Inversión | CPR | CPR vs Meta
          r = ws.addRow(['Objetivo', 'Métrica', 'Resultado', 'Meta', 'vs Meta', 'Inversión', 'CPR', 'CPR vs Meta', ''])
          applyHeader(r, 8, DARK_BG)

          groupRows.forEach((p, i) => {
            const objKey    = normK(p.objetivo || '')
            const metricKey = normK(p.metrica  || p.objetivo || '')
            // Inversión: primero por objetivo, luego por métrica (igual que el dashboard)
            const inv    = v(p._invFromCampaign)
            const real   = v(p._realFromCampaign)
            const meta   = v(p.meta)
            const vsMeta = meta > 0 ? real / meta - 1 : null
            const cpr    = (inv > 0 && real > 0)
              ? (isCPM(p.metrica || p.objetivo) ? (inv / real) * 1000 : inv / real)
              : null
            // CPR Meta: lee cpr_meta de la fila exacta (igual que getGroupCPRMeta del dashboard)
            const cprMetaV = getGroupCPRMeta(bKey, metricKey) || getGroupCPRMeta(bKey, objKey)
            // Variación CPR: si CPR real < meta → bueno (positivo), igual que el dashboard
            const cprVsMeta = (cpr && cprMetaV) ? (cprMetaV - cpr) / cprMetaV : null

            const row = ws.addRow([
              p.objetivo || '—',
              p.metrica  || '—',
              real,
              meta > 0 ? meta : null,
              vsMeta !== null ? vsMeta : null,
              inv > 0 ? inv : null,
              cpr || null,
              cprVsMeta !== null ? cprVsMeta : null,
            ])
            applyBody(row, 8, i % 2 === 1)
            row.getCell(3).numFmt = '#,##0'
            if (meta > 0) row.getCell(4).numFmt = '#,##0'
            else row.getCell(4).value = '—'
            if (vsMeta !== null) {
              row.getCell(5).numFmt = '+0.0%;-0.0%'
              row.getCell(5).font  = font({ bold: true, color: { argb: vsMeta >= 0 ? '16A34A' : 'DC2626' } })
            } else row.getCell(5).value = '—'
            if (inv > 0) row.getCell(6).numFmt = '$#,##0.00'
            else row.getCell(6).value = '—'
            if (cpr) {
              row.getCell(7).numFmt = isCPM(p.metrica || p.objetivo) ? '$#,##0.000' : '$#,##0.00'
              row.getCell(7).font  = font({ bold: true, color: { argb: '92400E' } })
            } else row.getCell(7).value = '—'
            if (cprVsMeta !== null) {
              row.getCell(8).numFmt = '+0.0%;-0.0%'
              row.getCell(8).font  = font({ bold: true, color: { argb: cprVsMeta >= 0 ? '16A34A' : 'DC2626' } })
            } else row.getCell(8).value = '—'
            row.getCell(1).alignment = { indent: 1, vertical: 'middle' }
            row.getCell(2).alignment = { indent: 1, vertical: 'middle' }
          })
        }
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
    const realForProjection = (row) => {
      const rowPlatform = normP(row.plataforma)
      const rowBucket = tipoCampanaToBucket(row.tipo_campana || 'AON')
      const keys = [row.objetivo, row.metrica].map(normK).filter(Boolean)
      return (filteredData.campanas || [])
        .filter(c => getCampaignPlatform(c) === rowPlatform)
        .filter(c => (c._bucket || tipoCampanaToBucket(c.tipo_campana)) === rowBucket)
        .filter(c => keys.includes(normK(c._objective || c.objetivo_detectado || c.objetivo || '')))
        .reduce((sum, c) => sum + v(c.resultado), 0)
    }
    const invForProjection = (row) => {
      const rowPlatform = normP(row.plataforma)
      const rowBucket = tipoCampanaToBucket(row.tipo_campana || 'AON')
      const keys = [row.objetivo, row.metrica].map(normK).filter(Boolean)
      return (filteredData.campanas || [])
        .filter(c => getCampaignPlatform(c) === rowPlatform)
        .filter(c => (c._bucket || tipoCampanaToBucket(c.tipo_campana)) === rowBucket)
        .filter(c => keys.includes(normK(c._objective || c.objetivo_detectado || c.objetivo || '')))
        .reduce((sum, c) => sum + v(c.inversion), 0)
    }
    for (const plat of platsProy) {
      const rows = proy.filter(p => p.plataforma === plat)
      if (!rows.length) continue

      r = ws.addRow([plat.charAt(0).toUpperCase() + plat.slice(1)])
      applySubtitle(ws, r, 8, '16A34A')
      r = ws.addRow(['Métrica / Objetivo', 'Tipo Campaña', 'Meta', 'Real', 'Cumplimiento', 'Gap', 'Inversión', 'CPR'])
      applyHeader(r, 8, DARK_BG)

      rows.forEach((p, i) => {
        const meta  = v(p.meta), real = realForProjection(p)
        const inv = invForProjection(p)
        const cumpl = meta > 0 ? real / meta : null
        const gap   = meta > 0 ? real - meta : null
        const cpr   = real > 0 ? inv / real : null
        const row   = ws.addRow([
          p.metrica || p.objetivo || '—', p.tipo_campana || 'AON',
          meta, real, '', gap || 0, inv, cpr || 0,
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
  // TAB 7: INVERSION
  // ═══════════════════════════════════════════════════════════════════════════
  {
    const investment = makeInvestmentModel({ allData, selectedMonth })
    const ws = wb.addWorksheet('Inversión', { properties: { tabColor: { argb: '0F766E' } } })
    const N = investment.hasAnyBudget ? 8 : 5
    let r = ws.addRow([`Inversión - ${monthLabel}`])
    applyTitle(ws, r, N, '0F766E')
    addBlank(ws)

    r = ws.addRow(['ESTADO FINANCIERO DEL MES'])
    applySubtitle(ws, r, N, '0F766E')
    if (investment.hasAnyBudget) {
      r = ws.addRow(['Presupuesto del mes', investment.selected.budget, 'Inversión real del mes', investment.selected.actual, 'Balance', '', '% usado', ''])
      applyBody(r, N, false)
      setBudgetOrPending(r.getCell(2), investment.selected.budget, investment.selected.hasBudget, true)
      setMoney(r.getCell(4), investment.selected.actual)
      setBalance(r.getCell(6), investment.selected.budget, investment.selected.actual)
      setUsageOrPending(r.getCell(8), investment.selected.budget, investment.selected.actual, investment.selected.hasBudget, true)

      r = ws.addRow(['Presupuesto acumulado', investment.ytd.budget, 'Inversión acumulada', investment.ytd.actual, 'Balance acumulado', '', '% usado acum.', ''])
      applyBody(r, N, true)
      setMoney(r.getCell(2), investment.ytd.budget)
      setMoney(r.getCell(4), investment.ytd.actual)
      setBalance(r.getCell(6), investment.ytd.budget, investment.ytd.actual)
      setUsageOrPending(r.getCell(8), investment.ytd.budget, investment.ytd.actual, investment.ytd.hasBudget, true)

      if (investment.hasPendingBudget) {
        r = ws.addRow(['Nota', 'Balance y % usado pueden diferir de la realidad porque hay presupuestos pendientes por capturar.', '', '', '', '', '', ''])
        ws.mergeCells(r.number, 2, r.number, N)
        applyBody(r, N, false)
        r.getCell(1).font = font({ bold: true, color: { argb: 'D97706' } })
        r.getCell(2).font = font({ italic: true, color: { argb: '92400E' } })
        r.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } }
      }
    } else {
      r = ws.addRow(['Inversión real del mes', investment.selected.actual, 'Inversión acumulada', investment.ytd.actual, ''])
      applyBody(r, N, false)
      setMoney(r.getCell(2), investment.selected.actual)
      setMoney(r.getCell(4), investment.ytd.actual)
    }
    addBlank(ws)

    r = ws.addRow(['RESUMEN POR PLATAFORMA'])
    applySubtitle(ws, r, N, '0F766E')
    if (investment.hasAnyBudget) {
      r = ws.addRow(['Plataforma', 'Presupuesto Mes', 'Inversión Mes', 'Balance Mes', '% Usado', 'Presupuesto Acum.', 'Inversión Acum.', 'Balance Acum.'])
      applyHeader(r, N, DARK_BG)
      investment.platformRows.forEach((item, i) => {
        const row = ws.addRow([item.label, '', item.monthActual, '', '', '', item.ytdActual, ''])
        applyBody(row, N, i % 2 === 1)
        setBudgetOrPending(row.getCell(2), item.monthBudget, item.hasMonthBudget, true)
        setMoney(row.getCell(3), item.monthActual)
        if (item.hasMonthBudget) setBalance(row.getCell(4), item.monthBudget, item.monthActual)
        else row.getCell(4).value = 'Pendiente capturar'
        setUsageOrPending(row.getCell(5), item.monthBudget, item.monthActual, item.hasMonthBudget, true)
        setBudgetOrPending(row.getCell(6), item.ytdBudget, item.hasYtdBudget, true)
        setMoney(row.getCell(7), item.ytdActual)
        if (item.hasYtdBudget) setBalance(row.getCell(8), item.ytdBudget, item.ytdActual)
        else row.getCell(8).value = 'Pendiente capturar'
      })
    } else {
      r = ws.addRow(['Plataforma', 'Inversión Mes', '% del Total Mes', 'Inversión Acum.', ''])
      applyHeader(r, N, DARK_BG)
      investment.platformRows.forEach((item, i) => {
        const row = ws.addRow([
          item.label,
          item.monthActual,
          investment.selected.actual > 0 ? item.monthActual / investment.selected.actual : 0,
          item.ytdActual,
          '',
        ])
        applyBody(row, N, i % 2 === 1)
        row.getCell(2).numFmt = '$#,##0.00'
        row.getCell(3).numFmt = '0.0%'
        row.getCell(4).numFmt = '$#,##0.00'
      })
    }
    addBlank(ws)

    r = ws.addRow(['HISTÓRICO MENSUAL'])
    applySubtitle(ws, r, N, '0F766E')
    if (investment.hasAnyBudget) {
      r = ws.addRow(['Mes', 'Presupuesto', 'Inversión Real', 'Balance', '% Usado', '', '', ''])
      applyHeader(r, 5, DARK_BG)
      investment.monthRows.forEach((item, i) => {
        const row = ws.addRow([formatMonthShort(item.month), '', item.actual, '', '', '', '', ''])
        applyBody(row, N, i % 2 === 1)
        setBudgetOrPending(row.getCell(2), item.budget, item.hasBudget, true)
        setMoney(row.getCell(3), item.actual)
        if (item.hasBudget) setBalance(row.getCell(4), item.budget, item.actual)
        else row.getCell(4).value = 'Pendiente capturar'
        setUsageOrPending(row.getCell(5), item.budget, item.actual, item.hasBudget, true)
      })
    } else {
      r = ws.addRow(['Mes', 'Inversión Real', '', '', ''])
      applyHeader(r, 2, DARK_BG)
      investment.monthRows.forEach((item, i) => {
        const row = ws.addRow([formatMonthShort(item.month), item.actual, '', '', ''])
        applyBody(row, N, i % 2 === 1)
        row.getCell(2).numFmt = '$#,##0.00'
      })
    }
    addBlank(ws)

    r = ws.addRow(['DESGLOSE ESTRATÉGICO'])
    applySubtitle(ws, r, N, '0F766E')
    if (investment.hasAnyBudget) {
      r = ws.addRow(['Plataforma', 'Grupo', 'Objetivo / Métrica', 'Presupuesto', 'Inversión Real', 'Balance', '% Usado', ''])
      applyHeader(r, N, DARK_BG)
      investment.detailRows.forEach((item, i) => {
        const row = ws.addRow([investmentPlatformLabel(item.platform), item.bucket, item.objective, '', item.actual, '', '', ''])
        applyBody(row, N, i % 2 === 1)
        setBudgetOrPending(row.getCell(4), item.budget, item.hasBudget, true)
        setMoney(row.getCell(5), item.actual)
        if (item.hasBudget) setBalance(row.getCell(6), item.budget, item.actual)
        else row.getCell(6).value = 'Pendiente capturar'
        setUsageOrPending(row.getCell(7), item.budget, item.actual, item.hasBudget, true)
      })
    } else {
      r = ws.addRow(['Plataforma', 'Grupo', 'Objetivo / Métrica', 'Inversión Real', ''])
      applyHeader(r, 5, DARK_BG)
      investment.detailRows.forEach((item, i) => {
        const row = ws.addRow([investmentPlatformLabel(item.platform), item.bucket, item.objective, item.actual, ''])
        applyBody(row, N, i % 2 === 1)
        row.getCell(4).numFmt = '$#,##0.00'
      })
    }
    autoWidth(ws)
  }

  // TAB 8: COMPETENCIA
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
    const alertRealForProjection = (row) => {
      const rowPlatform = normP(row.plataforma)
      const rowBucket = tipoCampanaToBucket(row.tipo_campana || 'AON')
      const keys = [row.objetivo, row.metrica].map(normK).filter(Boolean)
      return (filteredData.campanas || [])
        .filter(c => getCampaignPlatform(c) === rowPlatform)
        .filter(c => (c._bucket || tipoCampanaToBucket(c.tipo_campana)) === rowBucket)
        .filter(c => keys.includes(normK(c._objective || c.objetivo_detectado || c.objetivo || '')))
        .reduce((sum, c) => sum + v(c.resultado), 0)
    }
    for (const p of (filteredData.proyecciones || [])) {
      const meta = v(p.meta), real = alertRealForProjection(p)
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
  onProgress?.('Limpiando datos del archivo...')
  cleanWorkbookValues(wb)
  onProgress?.('Preparando archivo Excel...')
  await new Promise(resolve => setTimeout(resolve, 0))
  const buffer   = await withTimeout(
    wb.xlsx.writeBuffer(),
    120000,
    'El archivo tardó demasiado en generarse. Intenta cerrar otras pestañas o exportar nuevamente.',
  )
  const safeName = nombre.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '').trim().replace(/\s+/g, '_')
  onProgress?.('Descargando Excel...')
  downloadWorkbook(buffer, `Dashboard_${safeName}_${selectedMonth}.xlsx`)
}
