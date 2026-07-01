import { useCallback, useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import { safeNumber } from '../utils/format'
import {
  BRAND_TO_INFLUENCER_ID,
  INFLUENCER_SHEET_ID,
  aggregateContent,
  aggregatePaid,
  buildInfluencerRollups,
  defaultCampaignForBrand,
  normalizeDate,
  normalizeDriveImage,
  readField,
} from '../utils/influencerMetrics'

function getSheetURL(sheetName) {
  return `https://docs.google.com/spreadsheets/d/${INFLUENCER_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`
}

async function fetchSheet(sheetName, optional = false) {
  try {
    const response = await fetch(getSheetURL(sheetName))
    const text = await response.text()
    if (!response.ok || text.includes('google.visualization.Query.setResponse')) {
      if (optional) return []
      throw new Error(`No se pudo leer ${sheetName}`)
    }
    const { data } = Papa.parse(text, { header: true, skipEmptyLines: true })
    return data.filter(row => Object.values(row).some(value => value !== null && value !== undefined && String(value).trim() !== ''))
  } catch (error) {
    if (optional) return []
    throw error
  }
}

function normalizeBrand(row) {
  return {
    id: String(readField(row, ['ID', 'marca_id'])).trim().toUpperCase(),
    name: String(readField(row, ['Nombre', 'marca'])).trim(),
    startDate: normalizeDate(readField(row, ['Fecha Inicio', 'fecha_inicio'])),
    endDate: normalizeDate(readField(row, ['Fecha Fin', 'fecha_fin'])),
    color: readField(row, ['Color', 'color_primario'], ''),
  }
}

function normalizeCampaign(row, brand) {
  const id = String(readField(row, ['campana_id', 'campaña_id', 'ID', 'Campaña ID'], '')).trim()
  if (!id) return null
  return {
    id,
    marcaId: String(readField(row, ['marca_id', 'Marca ID'], brand?.id || '')).trim().toUpperCase(),
    name: String(readField(row, ['nombre_campana', 'nombre_campaña', 'Campaña', 'Nombre'], id)).trim(),
    startDate: normalizeDate(readField(row, ['fecha_inicio', 'Fecha Inicio'])),
    endDate: normalizeDate(readField(row, ['fecha_fin', 'Fecha Fin'])),
    objective: String(readField(row, ['objetivo', 'Objective'], '')).trim(),
    status: String(readField(row, ['estatus', 'Estado'], '')).trim(),
  }
}

function normalizeInfluencer(row) {
  const id = String(readField(row, ['ID', 'influencer_id'])).trim()
  const sheetPhoto = normalizeDriveImage(readField(row, ['Foto URL', 'foto_url']))
  return {
    id,
    marcaId: String(readField(row, ['Marca ID', 'marca_id'])).trim().toUpperCase(),
    name: String(readField(row, ['Nombre', 'Influencer'])).trim(),
    tiktok: String(readField(row, ['Handle TikTok', 'handle_tiktok'])).trim(),
    instagram: String(readField(row, ['Handle Instagram', 'handle_instagram'])).trim(),
    facebook: String(readField(row, ['Handle Facebook', 'handle_facebook'])).trim(),
    followersTikTok: safeNumber(readField(row, ['Seguidores TikTok'])),
    followersInstagram: safeNumber(readField(row, ['Seguidores Instagram'])),
    followersFacebook: safeNumber(readField(row, ['Seguidores Facebook'])),
    category: String(readField(row, ['Categoría', 'Categoria', 'category'])).trim(),
    photo: sheetPhoto || localInfluencerPhoto(id),
    fee: safeNumber(readField(row, ['Fee Total', 'fee_total', 'fee'])),
    notes: String(readField(row, ['Notas', 'notes'])).trim(),
  }
}

function localInfluencerPhoto(id) {
  const photos = {
    aldotdenigris: '/influencers/aldotdenigris.png',
    bastiandelfin: '/influencers/bastiandelfin.png',
    guszapiain: '/influencers/guszapiain.png',
  }
  return photos[id] || ''
}

function normalizeContent(row, fallbackCampaignId) {
  const nomenclature = String(readField(row, ['Nomenclatura', 'contenido_uid'])).trim()
  const contentId = String(readField(row, ['contenido_id', 'ID Contenido'], nomenclature)).trim()
  return {
    uid: nomenclature || contentId,
    id: contentId || nomenclature,
    campaignId: String(readField(row, ['campana_id', 'campaña_id', 'Campaña ID'], fallbackCampaignId)).trim(),
    campaignName: String(readField(row, ['campana', 'campaña', 'Campaña', 'Campaña Nombre'], '')).trim(),
    marcaId: String(readField(row, ['Marca ID', 'marca_id'])).trim().toUpperCase(),
    influencerId: String(readField(row, ['Influencer ID', 'influencer_id'])).trim(),
    influencerName: String(readField(row, ['Influencer'])).trim(),
    platform: String(readField(row, ['Plataforma', 'platform'])).trim(),
    format: String(readField(row, ['Formato', 'format'])).trim(),
    publishDate: normalizeDate(readField(row, ['Fecha Publicación', 'Fecha Publicacion', 'fecha_publicacion'])),
    url: String(readField(row, ['URL o Embed', 'url', 'embed_url'])).trim(),
    localVideoUrl: String(readField(row, ['URL Video Local', 'url_video_local'])).trim(),
    views: safeNumber(readField(row, ['Views', 'views'])),
    avgTime: readField(row, ['Tiempo Promedio (seg)'], '') === '' ? null : safeNumber(readField(row, ['Tiempo Promedio (seg)'])),
    vtr: readField(row, ['VTR %'], '') === '' ? null : safeNumber(readField(row, ['VTR %'])),
    reactions: safeNumber(readField(row, ['Reacciones', 'likes'])),
    comments: safeNumber(readField(row, ['Comentarios', 'comments'])),
    shares: safeNumber(readField(row, ['Compartidos', 'shares'])),
    saves: safeNumber(readField(row, ['Guardados', 'saves'])),
    clicks: safeNumber(readField(row, ['Clics al Enlace', 'clicks'])),
    status: String(readField(row, ['Estado', 'status'])).trim(),
    notes: String(readField(row, ['Notas', 'notes'])).trim(),
  }
}

function normalizePaid(row, fallbackCampaignId) {
  const contentId = String(readField(row, ['contenido_id', 'ID Contenido', 'Contenido ID'])).trim()
  return {
    id: String(readField(row, ['paid_id', 'ID'], `${contentId}-PAID`)).trim(),
    campaignId: String(readField(row, ['campana_id', 'campaña_id', 'Campaña ID'], fallbackCampaignId)).trim(),
    contentId,
    marcaId: String(readField(row, ['marca_id', 'Marca ID'])).trim().toUpperCase(),
    influencerId: String(readField(row, ['influencer_id', 'Influencer ID'])).trim(),
    platform: String(readField(row, ['plataforma', 'Plataforma'])).trim(),
    views6s: safeNumber(readField(row, ['views_6s', 'Views de 6 segundos', 'Views 6s'])),
    reach: safeNumber(readField(row, ['alcance', 'Alcance'])),
    likes: safeNumber(readField(row, ['likes', 'me gusta', 'Reacciones'])),
    comments: safeNumber(readField(row, ['comentarios', 'Comentarios'])),
    shares: safeNumber(readField(row, ['compartidos', 'Compartidos'])),
    saves: safeNumber(readField(row, ['guardados', 'Guardados'])),
    investment: safeNumber(readField(row, ['inversion_pauta', 'inversión_pauta', 'Inversión de pauta', 'Inversion de pauta'])),
  }
}

function normalizeProjection(row, fallbackCampaignId) {
  return {
    campaignId: String(readField(row, ['campana_id', 'campaña_id', 'Campaña ID'], fallbackCampaignId)).trim(),
    marcaId: String(readField(row, ['Marca ID', 'marca_id'])).trim().toUpperCase(),
    influencerId: String(readField(row, ['Influencer ID', 'influencer_id'])).trim(),
    ttVideosPlan: safeNumber(readField(row, ['TT Videos Plan'])),
    igReelsPlan: safeNumber(readField(row, ['IG Reels Plan'])),
    fbReelsPlan: safeNumber(readField(row, ['FB Reels Plan'])),
    igStoriesPlan: safeNumber(readField(row, ['IG Stories Plan'])),
    fbStoriesPlan: safeNumber(readField(row, ['FB Stories Plan'])),
  }
}

function normalizeFinding(row, fallbackCampaignId) {
  return {
    id: readField(row, ['ID']),
    campaignId: String(readField(row, ['campana_id', 'campaña_id', 'Campaña ID'], fallbackCampaignId)).trim(),
    marcaId: String(readField(row, ['Marca ID', 'marca_id'])).trim().toUpperCase(),
    title: String(readField(row, ['Título', 'Titulo', 'title'])).trim(),
    category: String(readField(row, ['Categoría', 'Categoria', 'category'])).trim(),
    priority: String(readField(row, ['Prioridad', 'priority'], 'medium')).trim().toLowerCase(),
    insight: String(readField(row, ['Insight'])).trim(),
    recommendation: String(readField(row, ['Recomendación', 'Recomendacion'])).trim(),
  }
}

function normalizeSentiment(row, fallbackCampaignId) {
  const contentId = String(readField(row, ['Contenido ID', 'contenido_id'])).trim()
  const marcaId = String(readField(row, ['Marca ID', 'marca_id'], contentId.split('_')[0] || '')).trim().toUpperCase()
  return {
    id: readField(row, ['ID']),
    campaignId: String(readField(row, ['campana_id', 'campaña_id', 'Campaña ID'], fallbackCampaignId)).trim(),
    contentId,
    marcaId,
    influencerId: String(readField(row, ['Influencer ID', 'influencer_id'])).trim(),
    influencerName: String(readField(row, ['Influencer'])).trim(),
    platform: String(readField(row, ['Plataforma'])).trim(),
    screenshot: String(readField(row, ['URL Screenshot', 'screenshot_url'])).trim(),
    text: String(readField(row, ['Texto Comentario', 'comentario'])).trim(),
    sentiment: String(readField(row, ['Sentimiento', 'sentiment'])).trim(),
    highlighted: String(readField(row, ['Destacado', 'highlighted'])).toLowerCase().replace('í', 'i') === 'si',
  }
}

export function useInfluencerData(marcaId) {
  const [state, setState] = useState({ loading: true, error: null, raw: null })
  const sheetBrandId = BRAND_TO_INFLUENCER_ID[marcaId] || String(marcaId || '').toUpperCase()

  const loadData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      const [configRows, brandRows, influencerRows, contentRows, projectionRows, findingRows, commentRows, campaignRows, paidRows] = await Promise.all([
        fetchSheet('⚙️ Config', true),
        fetchSheet('📅 Marca'),
        fetchSheet('👤 Influencers'),
        fetchSheet('📊 Contenidos'),
        fetchSheet('🎯 Proyecciones', true),
        fetchSheet('💡 KeyFindings', true),
        fetchSheet('💬 Comentarios', true),
        fetchSheet('Campañas', true).catch(() => fetchSheet('Campanas', true)),
        fetchSheet('Pauta_Influencers', true),
      ])
      setState({
        loading: false,
        error: null,
        raw: { configRows, brandRows, influencerRows, contentRows, projectionRows, findingRows, commentRows, campaignRows, paidRows },
      })
    } catch (error) {
      setState({ loading: false, error: error.message || 'No se pudieron cargar los datos de influencers', raw: null })
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const data = useMemo(() => {
    if (!state.raw) return null
    const brands = state.raw.brandRows.map(normalizeBrand).filter(row => row.id)
    const brand = brands.find(row => row.id === sheetBrandId) || brands[0]
    const fallbackCampaign = defaultCampaignForBrand(brand)
    const campaigns = state.raw.campaignRows.map(row => normalizeCampaign(row, brand)).filter(row => row && row.marcaId === sheetBrandId)
    const usableCampaigns = campaigns.length ? campaigns : (fallbackCampaign ? [fallbackCampaign] : [])
    const fallbackCampaignId = usableCampaigns[0]?.id || ''

    const influencers = state.raw.influencerRows.map(normalizeInfluencer).filter(row => row.marcaId === sheetBrandId && row.id)
    const contents = state.raw.contentRows.map(row => normalizeContent(row, fallbackCampaignId)).filter(row => row.marcaId === sheetBrandId && row.uid)
    const paid = state.raw.paidRows.map(row => normalizePaid(row, fallbackCampaignId)).filter(row => row.marcaId === sheetBrandId || influencers.some(inf => inf.id === row.influencerId))
    const projections = state.raw.projectionRows.map(row => normalizeProjection(row, fallbackCampaignId)).filter(row => row.marcaId === sheetBrandId || influencers.some(inf => inf.id === row.influencerId))
    const findings = state.raw.findingRows.map(row => normalizeFinding(row, fallbackCampaignId)).filter(row => !row.marcaId || row.marcaId === sheetBrandId)
    const sentimentRows = state.raw.commentRows.map(row => normalizeSentiment(row, fallbackCampaignId)).filter(row => !row.marcaId || row.marcaId === sheetBrandId)

    const config = {}
    state.raw.configRows.forEach(row => {
      const key = readField(row, ['Clave', 'campo'])
      const value = readField(row, ['Valor', 'valor'])
      if (key) config[key] = value
    })

    return {
      config,
      brand,
      campaigns: usableCampaigns,
      influencers,
      contents,
      paid,
      projections,
      findings,
      sentiment: sentimentRows.filter(row => row.highlighted),
      totals: {
        organic: aggregateContent(contents),
        paid: aggregatePaid(paid),
        investmentOrganic: influencers.reduce((sum, row) => sum + safeNumber(row.fee), 0),
      },
      rollups: buildInfluencerRollups({ influencers, contents, paid, projections }),
    }
  }, [state.raw, sheetBrandId])

  return { ...state, data, refresh: loadData, sheetBrandId }
}
