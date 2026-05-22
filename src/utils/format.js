// Number/currency/percent formatters
// ─────────────────────────────────────────────────────────────────────────────
// safeNumber — conversión ultra-defensiva para valores que vienen del Sheet.
// Maneja: null, undefined, "", "N/A", "-", "$1,234.56", "12.5%", "(1,234)" (negativos contables),
// comas decimales europeas, espacios sobrantes, booleans, Dates.
// ─────────────────────────────────────────────────────────────────────────────
export function safeNumber(value, defaultValue = 0) {
  if (value === null || value === undefined) return defaultValue
  if (typeof value === 'number') return isFinite(value) ? value : defaultValue
  if (typeof value === 'boolean') return value ? 1 : 0

  let s = String(value).trim()
  if (!s) return defaultValue

  // Placeholders comunes que el analista escribe
  const placeholders = ['n/a', 'na', '-', '--', '#n/a', '#¡valor!', '#ref!', '#div/0!', 'sin dato', 'null', 'undefined']
  if (placeholders.includes(s.toLowerCase())) return defaultValue

  // Negativos en contabilidad: "(1,234)" → -1234
  let negative = false
  if (/^\(.+\)$/.test(s)) { negative = true; s = s.slice(1, -1) }

  // Quita símbolos de moneda, %, espacios
  s = s.replace(/[$€£¥\s%]/g, '')

  // Si hay comas Y puntos, la coma es separador de miles (ej "1,234.56") → quita coma
  // Si solo hay comas (ej "1,5" estilo EU), trata coma como decimal
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/,/g, '')
  } else if (s.includes(',') && !s.includes('.')) {
    // Si hay más de una coma → separador de miles (ej "1,234")
    if ((s.match(/,/g) || []).length > 1) {
      s = s.replace(/,/g, '')
    } else {
      // Una sola coma: depende de cuántos dígitos vienen después
      const parts = s.split(',')
      if (parts[1] && parts[1].length === 3 && !parts[0].startsWith('0')) {
        // "1,234" → mil doscientos treinta y cuatro
        s = s.replace(',', '')
      } else {
        // "1,5" → uno punto cinco
        s = s.replace(',', '.')
      }
    }
  }

  const num = parseFloat(s)
  if (isNaN(num) || !isFinite(num)) return defaultValue
  return negative ? -num : num
}

export function formatNumber(value) {
  const num = safeNumber(value, NaN)
  if (isNaN(num)) return '-'
  if (Math.abs(num) >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (Math.abs(num) >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return num.toLocaleString('es-MX')
}

export function formatNumberFull(value) {
  const num = safeNumber(value, NaN)
  if (isNaN(num)) return '-'
  return num.toLocaleString('es-MX')
}

export function formatCurrency(value) {
  const num = safeNumber(value, NaN)
  if (isNaN(num)) return '-'
  return '$' + num.toLocaleString('es-MX', { maximumFractionDigits: 0 })
}

// Truncar a N decimales SIN redondear: truncTo(5.358, 2) → "5.35"
export function truncTo(num, decimals = 2) {
  const factor = Math.pow(10, decimals)
  return (Math.trunc(num * factor) / factor).toFixed(decimals)
}

export function formatPercent(value, decimals = 1) {
  const num = safeNumber(value, NaN)
  if (isNaN(num)) return null
  const sign = num >= 0 ? '+' : ''
  return sign + truncTo(num, decimals) + '%'
}

export function formatDecimal(value, decimals = 2) {
  const num = safeNumber(value, NaN)
  if (isNaN(num)) return '-'
  return truncTo(num, decimals)
}

// "2026-04" → "2026-03"
export function prevMonth(yyyymm) {
  if (!yyyymm) return null
  const [y, m] = String(yyyymm).split('-').map(Number)
  if (isNaN(y) || isNaN(m)) return null
  const pm = m - 1
  if (pm < 1) return `${y - 1}-12`
  return `${y}-${String(pm).padStart(2, '0')}`
}

// Percentage change: ((current - previous) / previous) * 100 — returns null if not computable
export function pctChange(current, previous) {
  const c = safeNumber(current, NaN)
  const p = safeNumber(previous, NaN)
  if (isNaN(c) || isNaN(p) || p === 0) return null
  return ((c - p) / Math.abs(p)) * 100
}

// "2025-12" → "Dic 2025"
const MONTH_NAMES_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
export function formatMonthShort(yyyymm) {
  if (!yyyymm) return ''
  const [y, m] = String(yyyymm).split('-')
  const idx = parseInt(m, 10) - 1
  if (isNaN(idx) || idx < 0 || idx > 11) return yyyymm
  return `${MONTH_NAMES_ES[idx]} ${y}`
}

export function formatMonthLong(yyyymm) {
  if (!yyyymm) return ''
  const [y, m] = String(yyyymm).split('-')
  const names = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const idx = parseInt(m, 10) - 1
  if (isNaN(idx) || idx < 0 || idx > 11) return yyyymm
  return `${names[idx]} ${y}`
}
