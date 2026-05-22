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
 * LAST fields: seguidores (take last day in range)
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

  const result = { ...sorted[sorted.length - 1] } // Start with last row as base (inherits marca, mes, etc.)

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

  // Last fields
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
 * Aggregate array data (GoogleAds, Campañas, etc.) — group by a key and sum within range
 */
function aggregateArrayRows(rows, groupByFields = []) {
  if (!rows || rows.length === 0) return []

  if (groupByFields.length === 0) {
    // No grouping, just return filtered rows
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
  // mode: 'month' | 'range'

  const filtered = useMemo(() => {
    if (!data) return {}

    // Helper: filter rows by date range
    const inRange = (r) => {
      if (!r.fecha) return false
      return r.fecha >= startDate && r.fecha <= endDate
    }

    // Helper: filter rows by month
    const inMonth = (r) => r.mes === selectedMonth

    // Helper: get single-row data for month (social platforms)
    const getSingleForMonth = (arr) => {
      if (!Array.isArray(arr) || arr.length === 0) return null
      const hasFecha = arr.some(r => r.fecha)

      if (mode === 'month') {
        if (hasFecha) {
          // Daily data → aggregate entire month
          const monthRows = arr.filter(inMonth)
          return aggregateRows(monthRows)
        }
        // Monthly data → find single row
        return arr.find(inMonth) || null
      }

      // Range mode
      if (hasFecha) {
        const rangeRows = arr.filter(inRange)
        return aggregateRows(rangeRows)
      }
      // Monthly data with range mode — not ideal but try to match
      return null
    }

    // Helper: get array data for month/range
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

    // Helper: monthly-only data (no daily version)
    const getMonthOnly = (arr) => {
      if (!Array.isArray(arr)) return []
      if (mode === 'month') return arr.filter(inMonth)
      return [] // Not available in range mode
    }

    const getSingleMonthOnly = (arr) => {
      if (!Array.isArray(arr)) return null
      if (mode === 'month') return arr.find(inMonth) || null
      return null
    }

    // Determine if proyecciones should show (range within same month)
    const showProyecciones = mode === 'month' ||
      (mode === 'range' && rangeInSameMonth(startDate, endDate))
    const proyMonth = mode === 'month' ? selectedMonth :
      (showProyecciones ? startDate?.slice(0, 7) : null)

    return {
      empresa: data.empresa,

      // Social platforms — aggregated
      facebook: getSingleForMonth(data.facebook),
      instagram: getSingleForMonth(data.instagram),
      tiktok: getSingleForMonth(data.tiktok),

      // Google Ads — aggregated by tipo_red
      googleAds: getArrayForPeriod(data.googleAds, ['tipo_red']),
      googleAdsCiudades: getArrayForPeriod(data.googleAdsCiudades, ['ciudad']),
      googleAdsKeywords: getArrayForPeriod(data.googleAdsKeywords, ['keyword']),

      // Campañas — aggregated by nombre_campana
      campanas: getArrayForPeriod(data.campanas, ['nombre_campana', 'plataforma']),

      // Monthly-only sections (only in month mode)
      topPosts: getMonthOnly(data.topPosts),
      sentiment: getSingleMonthOnly(data.sentiment),
      sentimentCapturas: mode === 'month'
        ? (data.sentimentCapturas || []).filter(r => r.mes === selectedMonth)
        : [],
      competencia: getMonthOnly(data.competencia),
      hallazgos: getMonthOnly(data.hallazgos),
      observaciones: getMonthOnly(data.observaciones),

      // Proyecciones — available if same month
      proyecciones: showProyecciones
        ? (data.proyecciones || []).filter(r => r.mes === proyMonth)
        : [],

      // Meta
      _mode: mode,
      _showMonthOnly: mode === 'month',
      _showProyecciones: showProyecciones,
      _proyMonth: proyMonth,
    }
  }, [data, mode, selectedMonth, startDate, endDate])

  // Historical data for variation badges — always use full dataset
  const historicalData = useMemo(() => ({
    facebook: data.facebook || [],
    instagram: data.instagram || [],
    tiktok: data.tiktok || [],
    googleAds: data.googleAds || [],
    competencia: data.competencia || [],
  }), [data])

  return { filtered, historicalData }
}
