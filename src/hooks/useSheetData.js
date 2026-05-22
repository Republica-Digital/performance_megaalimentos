import { useState, useEffect, useCallback } from 'react'
import Papa from 'papaparse'
import { normalizeImageUrl } from '../utils/urls'
import { enrichCampaign } from '../utils/campaigns'
import { processSheet } from '../utils/sheetDataParser'

const SHEET_ID = import.meta.env.VITE_SHEET_ID

function getSheetURL(sheetName) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`
}

async function fetchSheet(sheetName) {
  const response = await fetch(getSheetURL(sheetName))
  const csvText = await response.text()
  const { data } = Papa.parse(csvText, { header: true, skipEmptyLines: true })
  return data
}

function smartNormalize(rawRows) {
  if (!rawRows || rawRows.length === 0) return []
  const { rows: parsed } = processSheet(rawRows)
  return rawRows.map((original, i) => ({
    ...original,
    ...(parsed[i] || {}),
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Date normalization → "YYYY-MM-DD"
// ─────────────────────────────────────────────────────────────────────────────
function normalizeDate(val) {
  if (val === null || val === undefined || val === '') return null
  const s = String(val).trim()
  if (!s) return null

  // YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // Google Sheets gviz "Date(2026,2,1)" — month is 0-indexed
  const gviz = s.match(/^Date\((\d+),\s*(\d+)(?:,\s*(\d+))?.*\)$/)
  if (gviz) {
    const y = parseInt(gviz[1], 10)
    const m = parseInt(gviz[2], 10) + 1
    const d = parseInt(gviz[3] || '1', 10)
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  // M/D/YYYY
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (slash) {
    return `${slash[3]}-${String(parseInt(slash[1])).padStart(2, '0')}-${String(parseInt(slash[2])).padStart(2, '0')}`
  }

  // ISO string with time
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10)

  // Excel serial
  if (/^\d{4,5}(\.\d+)?$/.test(s)) {
    const d = new Date((parseFloat(s) - 25569) * 86400000)
    if (!isNaN(d)) return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  }

  const d = new Date(s)
  if (!isNaN(d)) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Month normalization → always returns "YYYY-MM"
// ─────────────────────────────────────────────────────────────────────────────
function normalizeMonth(val) {
  if (val === null || val === undefined || val === '') return null
  if (val instanceof Date && !isNaN(val)) {
    return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, '0')}`
  }
  const s = String(val).trim()
  if (!s) return null

  const gviz = s.match(/^Date\((\d+),\s*(\d+)(?:,\s*\d+)?.*\)$/)
  if (gviz) {
    const y = parseInt(gviz[1], 10)
    const m = parseInt(gviz[2], 10) + 1
    return `${y}-${String(m).padStart(2, '0')}`
  }

  if (/^\d{4}-\d{2}$/.test(s)) return s
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 7)

  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (slash) {
    const m = parseInt(slash[1], 10)
    const y = parseInt(slash[3], 10)
    if (m >= 1 && m <= 12) return `${y}-${String(m).padStart(2, '0')}`
  }

  const dash = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/)
  if (dash) {
    const m = parseInt(dash[2], 10)
    const y = parseInt(dash[3], 10)
    if (m >= 1 && m <= 12) return `${y}-${String(m).padStart(2, '0')}`
  }

  if (/^\d{4,5}(\.\d+)?$/.test(s)) {
    const d = new Date((parseFloat(s) - 25569) * 86400000)
    if (!isNaN(d)) return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  }

  const d = new Date(s)
  if (!isNaN(d)) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

  return s
}

// ─────────────────────────────────────────────────────────────────────────────
// Brand normalization
// ─────────────────────────────────────────────────────────────────────────────
const BRAND_MAP = {
  'la botanera': 'botanera',
  'botanera': 'botanera',
  'chamoy mega': 'chamoy',
  'chamoy': 'chamoy',
  'pacific mix': 'pacific',
  'pacific': 'pacific',
}
function normalizeBrand(val) {
  if (val === null || val === undefined) return val
  const key = String(val).trim().toLowerCase()
  return BRAND_MAP[key] ?? key
}

// ─────────────────────────────────────────────────────────────────────────────
// Row normalizers — now with fecha
// ─────────────────────────────────────────────────────────────────────────────
function normalizeRows(rows) {
  return rows.map(r => {
    const mes = normalizeMonth(r.mes) || (r.fecha ? normalizeDate(r.fecha)?.slice(0, 7) : null)
    const fecha = normalizeDate(r.fecha) || null
    return {
      ...r,
      mes,
      fecha,
      marca: r.marca ? normalizeBrand(r.marca) : r.marca,
    }
  })
}

function normalizePostRows(rows) {
  return rows.map(r => ({
    ...r,
    mes: normalizeMonth(r.mes),
    marca: r.marca ? normalizeBrand(r.marca) : r.marca,
    embed_url: r.embed_url && String(r.embed_url).trim() !== '' ? String(r.embed_url).trim() : null,
    imagen_url: normalizeImageUrl(r.imagen_url),
  }))
}

function normalizeCapturas(rows) {
  return rows.map(r => ({
    ...r,
    mes: normalizeMonth(r.mes),
    marca: r.marca ? normalizeBrand(r.marca) : r.marca,
    imagen_url: normalizeImageUrl(r.imagen_url),
  }))
}

function normalizeMarcas(rows) {
  return rows.map(r => ({
    ...r,
    logo_url: normalizeImageUrl(r.logo_url),
  }))
}

function normalizeEmpresa(empresa) {
  const out = { ...empresa }
  if (out.logo_url) out.logo_url = normalizeImageUrl(out.logo_url)
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// Brand feature flags
// ─────────────────────────────────────────────────────────────────────────────
const BRAND_FEATURES = {
  botanera: { googleAds: true,  sentiment: true, competencia: true },
  chamoy:   { googleAds: true,  sentiment: true, competencia: true },
  pacific:  { googleAds: false, sentiment: true, competencia: true },
}
const DEFAULT_FEATURES = { googleAds: true, sentiment: true, competencia: true }

// ─────────────────────────────────────────────────────────────────────────────
// Detect if sheet has daily data (has fecha column with YYYY-MM-DD values)
// ─────────────────────────────────────────────────────────────────────────────
function hasDaily(rows) {
  return rows.some(r => r.fecha && /^\d{4}-\d{2}-\d{2}$/.test(r.fecha))
}

// ─────────────────────────────────────────────────────────────────────────────
// Main hook
// ─────────────────────────────────────────────────────────────────────────────
export function useSheetData(marcaId) {
  const [data, setData] = useState({
    empresa: {},
    facebook: [], instagram: [], tiktok: [],
    googleAds: [], googleAdsCiudades: [], googleAdsKeywords: [],
    campanas: [], topPosts: [],
    sentiment: [], sentimentCapturas: [],
    competencia: [], hallazgos: [], observaciones: [],
    proyecciones: [],
  })
  const [brandConfig, setBrandConfig] = useState(null)
  const [allBrands, setAllBrands] = useState([])
  const [availableMonths, setAvailableMonths] = useState([])
  const [dateRange, setDateRange] = useState(null) // { min: 'YYYY-MM-DD', max: 'YYYY-MM-DD' }
  const [isDailyData, setIsDailyData] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const features = BRAND_FEATURES[marcaId] || DEFAULT_FEATURES

  const loadData = useCallback(async () => {
    if (!marcaId) return
    try {
      setIsRefreshing(true)

      const [
        configData, marcasData,
        fbData, igData, ttData,
        gadsData, gadsCiudadesData, gadsKeywordsData,
        campanasData, postsData,
        sentimentData, capturasData,
        competenciaData, hallazgosData, observacionesData,
        proyeccionesData,
      ] = await Promise.all([
        fetchSheet('_CONFIG'),
        fetchSheet('_MARCAS'),
        fetchSheet('Facebook'),
        fetchSheet('Instagram'),
        fetchSheet('TikTok'),
        fetchSheet('GoogleAds').catch(() => []),
        fetchSheet('GoogleAds_Ciudades').catch(() => []),
        fetchSheet('GoogleAds_Keywords').catch(() => []),
        fetchSheet('Campañas').catch(() => fetchSheet('Campanas').catch(() => [])),
        fetchSheet('TopPosts'),
        fetchSheet('Sentiment'),
        fetchSheet('Sentiment_Capturas').catch(() => []),
        fetchSheet('Competencia').catch(() => []),
        fetchSheet('Hallazgos').catch(() => []),
        fetchSheet('Observaciones').catch(() => []),
        fetchSheet('Proyecciones').catch(() => []),
      ])

      const empresaRaw = {}
      configData.forEach(row => { if (row.campo && row.valor) empresaRaw[row.campo] = row.valor })
      const empresa = normalizeEmpresa(empresaRaw)

      const marcasNorm = normalizeMarcas(marcasData)
      setAllBrands(marcasNorm.filter(b => b.marca_id))
      const brand = marcasNorm.find(b => b.marca_id === marcaId)
      setBrandConfig(brand)

      const fbNorm   = normalizeRows(smartNormalize(fbData))
      const igNorm   = normalizeRows(smartNormalize(igData))
      const ttNorm   = normalizeRows(smartNormalize(ttData))
      const gadsNorm = normalizeRows(smartNormalize(gadsData))
      const sentNorm = normalizeRows(smartNormalize(sentimentData))
      const captNorm = normalizeCapturas(capturasData)
      const compNorm = normalizeRows(smartNormalize(competenciaData))
      const hallNorm = normalizeRows(smartNormalize(hallazgosData))
      const obsNorm  = normalizeRows(smartNormalize(observacionesData))
      const gadsCiudNorm = normalizeRows(smartNormalize(gadsCiudadesData))
      const gadsKwNorm   = normalizeRows(smartNormalize(gadsKeywordsData))
      const proyNorm     = normalizeRows(smartNormalize(proyeccionesData))
      const postNorm     = normalizePostRows(smartNormalize(postsData))

      const campBase = normalizeRows(smartNormalize(campanasData))
      const campNorm = campBase.map(enrichCampaign)

      // Detect if we have daily data
      const daily = hasDaily(fbNorm) || hasDaily(igNorm) || hasDaily(ttNorm)
      setIsDailyData(daily)

      // Collect all months
      const allMonths = new Set()
      const addMonths = (arr) => arr
        .filter(r => r.marca === marcaId && r.mes)
        .forEach(r => allMonths.add(r.mes))
      addMonths(fbNorm); addMonths(igNorm); addMonths(ttNorm); addMonths(gadsNorm); addMonths(sentNorm)
      setAvailableMonths(Array.from(allMonths).sort().reverse())

      // Collect date range if daily
      if (daily) {
        const allDates = []
        const addDates = (arr) => arr
          .filter(r => r.marca === marcaId && r.fecha)
          .forEach(r => allDates.push(r.fecha))
        addDates(fbNorm); addDates(igNorm); addDates(ttNorm); addDates(gadsNorm)
        allDates.sort()
        if (allDates.length > 0) {
          setDateRange({ min: allDates[0], max: allDates[allDates.length - 1] })
        }
      }

      setData({
        empresa,
        facebook: fbNorm.filter(r => r.marca === marcaId),
        instagram: igNorm.filter(r => r.marca === marcaId),
        tiktok: ttNorm.filter(r => r.marca === marcaId),
        googleAds: gadsNorm.filter(r => r.marca === marcaId),
        googleAdsCiudades: gadsCiudNorm.filter(r => r.marca === marcaId),
        googleAdsKeywords: gadsKwNorm.filter(r => r.marca === marcaId),
        campanas: campNorm.filter(r => r.marca === marcaId),
        topPosts: postNorm.filter(r => r.marca === marcaId),
        sentiment: sentNorm.filter(r => r.marca === marcaId),
        sentimentCapturas: captNorm.filter(r => r.marca === marcaId),
        competencia: compNorm.filter(r => r.marca === marcaId),
        hallazgos: hallNorm.filter(r => r.marca === marcaId),
        observaciones: obsNorm.filter(r => r.marca === marcaId),
        proyecciones: proyNorm.filter(r => r.marca === marcaId),
      })

      setLoading(false)
      setIsRefreshing(false)
      setError(null)
    } catch (err) {
      console.error('Error loading data:', err)
      setError('Error al cargar los datos. Verifica la conexión y el ID del Sheet.')
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [marcaId])

  useEffect(() => { loadData() }, [loadData])

  return {
    data, brandConfig, allBrands, availableMonths, dateRange, isDailyData,
    loading, error, refresh: loadData, isRefreshing,
    features,
  }
}

export { formatNumber, formatCurrency, formatPercent, formatDecimal, safeNumber } from '../utils/format'
