import { useMemo } from 'react'
import { safeNumber } from '../utils/format'

// ─────────────────────────────────────────────────────────────────────────────
// Filter mode: 'month' (full month) or 'range' (custom date range)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aggregate daily rows into a single summary row for a date range.
 *
 * SUM fields: alcance, impresiones, interacciones, inversion, views, views_6s,
 *             nuevos_seguidores, publicaciones, clics, conversiones, visualizaciones
 * LAST fields: seguidores (take last day in range = highest cumulative value)
 * RECALC fields: engagement_rate = interacciones / alcance (or views for TikTok)
 */
const SUM_FIELDS = [
  'alcance', 'impresiones', 'impresiones_visibles', 'interacciones', 'inversion',
  'views', 'views_6s', 'nuevos_seguidores', 'publicaciones',
  'clics', 'conversiones', 'visualizaciones', 'resultado',
]

const LAST_FIELDS = ['seguidores']

function aggregateRows(rows, extraFields = []) {
  if (!rows || rows.length === 0) return null

  // Sort by fecha to get correct "last"
  const sorted = [...rows].sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')))

  const result = { ...sorted[sorted.length - 1] } // Start with last row as base

  // Sum fields
  for (const field of [...SUM_FIELDS, ...extraFields]) {
    let total = 0
    let hasValue = false
    for (const r of sorted) {
      const v = safeNumber(r[field], NaN)
      if (!isNaN(v)) { total += v; hasValue = true }
    }
    if (hasValue) result[field] = total
  }

  // Last fields — take last row with a valid positive value (highest cumulative)
  for (const field of LAST_FIELDS) {
    for (let i = sorted.length - 1; i >= 0; i--) {
      const v = safeNumber(sorted[i][field], NaN)
      if (!isNaN(v) && v > 0) { result[field] = v; break }
    }
  }

  // Recalculate engagement_rate
  const totalInteracciones = safeNumber(result.interacciones)
  const totalAlcance = safeNumber(result.alcance) || safeNumber(result.views)
  if (totalAlcance > 0) {
    result.engagement_rate = totalInteracciones / totalAlcance
  }

  return result
}

/**
 * When monthly data has multiple rows for the same month, pick the one with
 * the highest value for LAST_FIELDS (seguidores). This avoids showing the
 * first/lowest row when multiple rows exist for the same month.
 */
function pickBestMonthRow(rows, filterFn) {
  const matches = rows.filter(filterFn)
  if (matches.length === 0) return null
  if (matches.length === 1) return matches[0]

  // Pick the row with the maximum seguidores value
  return matches.reduce((best, r) => {
    const bestSeg = safeNumber(best.seguidores, 0)
    const rSeg = safeNumber(r.seguidores, 0)
    return rSeg > bestSeg ? r : best
  }, matches[0])
}

/**
 * Aggregate array data (GoogleAds, Campañas, etc.) — group by a key and sum within range
 */
function aggregateArrayRows(rows, groupByFields = []) {
  if (!rows || rows.length === 0) return []

  if (groupByFields.length === 0) {
    return rows
  }

  const groups = {}
  for (const r of rows) {
    const key = groupByFields.map(f => String(r[f] || '')).join('|')
    if (!groups[key]) groups[key] = []
    groups[key].push(r)
  }

  return Object.values(groups).map(group => aggregateRows(group))
}

// ─────────────────────────────────────────────────────────────────────────────
// Check if a date range falls within a single month
// ─────────────────────────────────────────────────────────────────────────────
export function rangeInSameMonth(startDate, endDate) {
  if (!startDate || !endDate) return false
  return startDate.slice(0, 7) === endDate.slice(0, 7)
}

// ─────────────────────────────────────────────────────────────────────────────
// Main hook: filters and aggregates data based on mode
// ─────────────────────────────────────────────────────────────────────────────
export function useDateFilter(data, { mode, selectedMonth, startDate, endDate }) {

  const filtered = useMemo(() => {
    if (!data) return {}

    const inRange = (r) => {
      if (!r.fecha) return false
      return r.fecha >= startDate && r.fecha <= endDate
    }

    const inMonth = (r) => r.mes === selectedMonth

    const getSingleForMonth = (arr) => {
      if (!Array.isArray(arr) || arr.length === 0) return null
      const hasFecha = arr.some(r => r.fecha)

      if (mode === 'month') {
        if (hasFecha) {
          // Daily data → aggregate entire month
          const monthRows = arr.filter(inMonth)
          return aggregateRows(monthRows)
        }
        // Monthly data → pick the row with the highest seguidores value
        // (avoids showing a lower/first row when multiple rows exist per month)
        return pickBestMonthRow(arr, inMonth)
      }

      // Range mode
      if (hasFecha) {
        const rangeRows = arr.filter(inRange)
        return aggregateRows(rangeRows)
      }
      return null
    }

    const getArrayForPeriod = (arr, groupBy = []) => {
      if (!Array.isArray(arr) || arr.length === 0) return []
      const hasFecha = arr.some(r => r.fecha)

      if (mode === 'month') {
        if (hasFecha) {
          const monthRows = arr.filter(inMonth)
          return groupBy.length > 0 ? aggregateArrayRows(monthRows, groupBy) : monthRows
        }
        return arr.filter(inMonth)
      }

      // Range mode
      if (hasFecha) {
        const rangeRows = arr.filter(inRange)
        return groupBy.length > 0 ? aggregateArrayRows(rangeRows, groupBy) : rangeRows
      }
      return []
    }

    const getMonthOnly = (arr) => {
      if (!Array.isArray(arr)) return []
      if (mode === 'month') return arr.filter(inMonth)
      return []
    }

    const getSingleMonthOnly = (arr) => {
      if (!Array.isArray(arr)) return null
      if (mode === 'month') return pickBestMonthRow(arr, inMonth)
      return null
    }

    const showProyecciones = mode === 'month' ||
      (mode === 'range' && rangeInSameMonth(startDate, endDate))
    const proyMonth = mode === 'month' ? selectedMonth :
      (showProyecciones ? startDate?.slice(0, 7) : null)

    return {
      empresa: data.empresa,

      facebook: getSingleForMonth(data.facebook),
      instagram: getSingleForMonth(data.instagram),
      tiktok: getSingleForMonth(data.tiktok),

      googleAds: getArrayForPeriod(data.googleAds, ['tipo_red']),
      googleAdsCiudades: getArrayForPeriod(data.googleAdsCiudades, ['ciudad']),
      googleAdsKeywords: getArrayForPeriod(data.googleAdsKeywords, ['keyword']),

      campanas: getArrayForPeriod(data.campanas, ['nombre_campana', 'plataforma']),

      topPosts: getMonthOnly(data.topPosts),
      sentiment: getSingleMonthOnly(data.sentiment),
      sentimentCapturas: mode === 'month'
        ? (data.sentimentCapturas || []).filter(r => r.mes === selectedMonth)
        : [],
      competencia: getMonthOnly(data.competencia),
      hallazgos: getMonthOnly(data.hallazgos),
      observaciones: getMonthOnly(data.observaciones),

      proyecciones: showProyecciones
        ? (data.proyecciones || []).filter(r => r.mes === proyMonth)
        : [],

      _mode: mode,
      _showMonthOnly: mode === 'month',
      _showProyecciones: showProyecciones,
      _proyMonth: proyMonth,
    }
  }, [data, mode, selectedMonth, startDate, endDate])

  // Historical data for variation badges and charts — always full dataset
  // For historical charts, also pick the best row per month per platform
  const historicalData = useMemo(() => {
    const pickBestPerMonth = (arr) => {
      if (!Array.isArray(arr)) return []
      const byMonth = {}
      for (const r of arr) {
        const m = r.mes
        if (!m) continue
        if (!byMonth[m]) { byMonth[m] = r; continue }
        // Keep the row with the highest seguidores
        if (safeNumber(r.seguidores, 0) > safeNumber(byMonth[m].seguidores, 0)) {
          byMonth[m] = r
        }
      }
      return Object.values(byMonth)
    }

    return {
      facebook: pickBestPerMonth(data.facebook || []),
      instagram: pickBestPerMonth(data.instagram || []),
      tiktok: pickBestPerMonth(data.tiktok || []),
      googleAds: data.googleAds || [],
      competencia: data.competencia || [],
    }
  }, [data])

  return { filtered, historicalData }
}
