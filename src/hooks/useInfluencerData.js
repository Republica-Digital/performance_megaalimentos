import { useCallback, useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import { safeNumber } from '../utils/format'
import {
  INFLUENCER_SHEET_ID,
  aggregatePaid,
  brandFromRoute,
  buildBrandTotals,
  buildCampaignBundle,
  drivePreview,
  isSameBrand,
  localInfluencerPhoto,
  normalizeDate,
  normalizeDriveImage,
  readField,
  yes,
} from '../utils/influencerMetrics'

const SHEETS = {
  campaigns: '01_Campañas',
  influencers: '02_Influencers_Campaña',
  contents: '03_Contenidos',
  paidTikTok: '04_Pauta_TikTok',
  paidMeta: '05_Pauta_Meta',
  sentiment: '06_Sentiment_Campaña',
  evidences: '07_Sentiment_Evidencias',
  findings: '08_Hallazgos',
}

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

function normalizeCampaign(row) {
  const id = String(readField(row, ['campaign_id'])).trim()
  if (!id) return null
  return {
    id,
    campaignId: id,
    brandName: String(readField(row, ['marca'])).trim(),
    name: String(readField(row, ['nombre_campaña', 'nombre_campana'], id)).trim(),
    startDate: normalizeDate(readField(row, ['fecha_inicio'])),
    endDate: normalizeDate(readField(row, ['fecha_fin'])),
    objective: String(readField(row, ['objetivo'])).trim(),
    type: String(readField(row, ['tipo_campaña', 'tipo_campana'])).trim(),
    status: String(readField(row, ['estatus'])).trim(),
    description: String(readField(row, ['descripcion_campaña', 'descripcion_campana'])).trim(),
    includesPaid: yes(readField(row, ['incluye_pauta'])),
    dashboardVisible: yes(readField(row, ['dashboard_visible'])),
    internalNotes: String(readField(row, ['notas_internas'])).trim(),
  }
}

function normalizeInfluencer(row) {
  const id = String(readField(row, ['influencer_campaign_id'])).trim()
  if (!id) return null
  const photo = normalizeDriveImage(readField(row, ['photo_url'])) || localInfluencerPhoto(id) || localInfluencerPhoto(readField(row, ['influencer_name']))
  return {
    id,
    influencerCampaignId: id,
    campaignId: String(readField(row, ['campaign_id'])).trim(),
    campaignName: String(readField(row, ['campaign_name'])).trim(),
    brandName: String(readField(row, ['marca'])).trim(),
    name: String(readField(row, ['influencer_name'])).trim(),
    niche: String(readField(row, ['niche'])).trim(),
    photo,
    usernames: {
      TikTok: String(readField(row, ['username_tiktok'])).trim(),
      Instagram: String(readField(row, ['username_instagram'])).trim(),
      Facebook: String(readField(row, ['username_facebook'])).trim(),
      YouTube: String(readField(row, ['username_youtube'])).trim(),
    },
    followers: {
      TikTok: safeNumber(readField(row, ['followers_tiktok_at_campaign'])),
      Instagram: safeNumber(readField(row, ['followers_instagram_at_campaign'])),
      Facebook: safeNumber(readField(row, ['followers_facebook_at_campaign'])),
      YouTube: safeNumber(readField(row, ['followers_youtube_at_campaign'])),
    },
    netFee: safeNumber(readField(row, ['net_fee'])),
    currency: String(readField(row, ['currency'], 'MXN')).trim() || 'MXN',
    platforms: String(readField(row, ['participation_platforms'])).split(',').map(item => item.trim()).filter(Boolean),
    planned: {
      TikTok: safeNumber(readField(row, ['planned_tiktok_contents'])),
      Instagram: safeNumber(readField(row, ['planned_instagram_contents'])),
      Facebook: safeNumber(readField(row, ['planned_facebook_contents'])),
      YouTube: safeNumber(readField(row, ['planned_youtube_contents'])),
      total: safeNumber(readField(row, ['planned_total_contents'])),
    },
    collaborationType: String(readField(row, ['collaboration_type'])).trim(),
    deliveryStatus: String(readField(row, ['delivery_status'])).trim(),
    projectedViews: safeNumber(readField(row, ['projected_views'])),
    projectedInteractions: safeNumber(readField(row, ['projected_interactions'])),
    projectedEr: safeNumber(readField(row, ['projected_er'])),
    projectedCpv: safeNumber(readField(row, ['projected_cpv'])),
    projectedReach: safeNumber(readField(row, ['projected_reach'])),
    projectionNotes: String(readField(row, ['projection_notes'])).trim(),
    internalNotes: String(readField(row, ['internal_notes'])).trim(),
  }
}

function normalizeContent(row) {
  const id = String(readField(row, ['contenido_id'])).trim()
  if (!id) return null
  return {
    id,
    uid: id,
    campaignId: String(readField(row, ['campaign_id'])).trim(),
    campaignName: String(readField(row, ['campaign_name'])).trim(),
    influencerCampaignId: String(readField(row, ['influencer_campaign_id'])).trim(),
    influencerName: String(readField(row, ['influencer_name'])).trim(),
    platform: String(readField(row, ['plataforma'])).trim(),
    format: String(readField(row, ['formato'])).trim(),
    publishDate: normalizeDate(readField(row, ['fecha_publicacion'])),
    originType: String(readField(row, ['tipo_publicacion_origen'])).trim(),
    publishingProfile: String(readField(row, ['perfil_publicacion'])).trim(),
    url: String(readField(row, ['url_contenido'])).trim(),
    embedCode: String(readField(row, ['embed_code'])).trim(),
    thumbnail: normalizeDriveImage(readField(row, ['thumbnail_url'])) || String(readField(row, ['thumbnail_url'])).trim(),
    caption: String(readField(row, ['caption'])).trim(),
    views: safeNumber(readField(row, ['views_organicas'])),
    reach: safeNumber(readField(row, ['alcance_organico'])),
    likes: safeNumber(readField(row, ['likes_reacciones_organicas'])),
    comments: safeNumber(readField(row, ['comentarios_organicos'])),
    shares: safeNumber(readField(row, ['compartidos_organicos'])),
    saves: safeNumber(readField(row, ['guardados_organicos'])),
    clicks: safeNumber(readField(row, ['clics_organicos'])),
    avgTime: readField(row, ['tiempo_promedio_seg'], '') === '' ? null : safeNumber(readField(row, ['tiempo_promedio_seg'])),
    vtr: readField(row, ['vtr_pct'], '') === '' ? null : safeNumber(readField(row, ['vtr_pct'])),
    dataSource: String(readField(row, ['fuente_dato'])).trim(),
    status: String(readField(row, ['estatus_contenido'])).trim(),
    notes: String(readField(row, ['notas'])).trim(),
  }
}

function normalizePaidTikTok(row) {
  const id = String(readField(row, ['paid_tiktok_id'])).trim()
  if (!id) return null
  const views6s = safeNumber(readField(row, ['views_6s']))
  const videoViews = safeNumber(readField(row, ['video_views']))
  const views2s = safeNumber(readField(row, ['views_2s']))
  return {
    id,
    network: 'TikTok',
    campaignId: String(readField(row, ['campaign_id'])).trim(),
    campaignName: String(readField(row, ['campaign_name'])).trim(),
    influencerCampaignId: String(readField(row, ['influencer_campaign_id'])).trim(),
    influencerName: String(readField(row, ['influencer_name'])).trim(),
    contentId: String(readField(row, ['contenido_id'])).trim(),
    contentUrl: String(readField(row, ['contenido_url'])).trim(),
    startDate: normalizeDate(readField(row, ['fecha_inicio_pauta'])),
    endDate: normalizeDate(readField(row, ['fecha_fin_pauta'])),
    paidFrom: String(readField(row, ['pautado_desde'])).trim(),
    adAccount: String(readField(row, ['cuenta_ads'])).trim(),
    objective: String(readField(row, ['objetivo_pauta'])).trim(),
    investment: safeNumber(readField(row, ['inversion_pauta'])),
    currency: String(readField(row, ['moneda'], 'MXN')).trim() || 'MXN',
    impressions: safeNumber(readField(row, ['impresiones'])),
    reach: safeNumber(readField(row, ['alcance'])),
    views2s,
    views6s,
    videoViews,
    views: views6s || videoViews || views2s,
    completions: safeNumber(readField(row, ['reproducciones_completas'])),
    likes: safeNumber(readField(row, ['likes'])),
    comments: safeNumber(readField(row, ['comentarios'])),
    shares: safeNumber(readField(row, ['compartidos'])),
    saves: safeNumber(readField(row, ['guardados'])),
    clicks: safeNumber(readField(row, ['clics'])),
    ctr: safeNumber(readField(row, ['ctr_pct'])),
    cpm: safeNumber(readField(row, ['cpm'])),
    cpv: safeNumber(readField(row, ['cpv'])),
    dataSource: String(readField(row, ['fuente_dato'])).trim(),
    notes: String(readField(row, ['notas'])).trim(),
  }
}

function normalizePaidMeta(row) {
  const id = String(readField(row, ['paid_meta_id'])).trim()
  if (!id) return null
  const thruplays = safeNumber(readField(row, ['thruplays']))
  const videoPlays = safeNumber(readField(row, ['video_plays']))
  const views3s = safeNumber(readField(row, ['reproducciones_3s']))
  return {
    id,
    network: 'Meta',
    paidPlatform: String(readField(row, ['plataforma_pauta'])).trim() || 'Meta',
    placement: String(readField(row, ['placement'])).trim(),
    campaignId: String(readField(row, ['campaign_id'])).trim(),
    campaignName: String(readField(row, ['campaign_name'])).trim(),
    influencerCampaignId: String(readField(row, ['influencer_campaign_id'])).trim(),
    influencerName: String(readField(row, ['influencer_name'])).trim(),
    contentId: String(readField(row, ['contenido_id'])).trim(),
    contentUrl: String(readField(row, ['contenido_url'])).trim(),
    startDate: normalizeDate(readField(row, ['fecha_inicio_pauta'])),
    endDate: normalizeDate(readField(row, ['fecha_fin_pauta'])),
    paidFrom: String(readField(row, ['pautado_desde'])).trim(),
    adAccount: String(readField(row, ['cuenta_ads'])).trim(),
    objective: String(readField(row, ['objetivo_pauta'])).trim(),
    investment: safeNumber(readField(row, ['inversion_pauta'])),
    currency: String(readField(row, ['moneda'], 'MXN')).trim() || 'MXN',
    impressions: safeNumber(readField(row, ['impresiones'])),
    reach: safeNumber(readField(row, ['alcance'])),
    views3s,
    thruplays,
    videoPlays,
    views: thruplays || videoPlays || views3s,
    likes: safeNumber(readField(row, ['reacciones'])),
    comments: safeNumber(readField(row, ['comentarios'])),
    shares: safeNumber(readField(row, ['compartidos'])),
    saves: safeNumber(readField(row, ['guardados'])),
    clicks: safeNumber(readField(row, ['clics_link'])),
    ctr: safeNumber(readField(row, ['ctr_pct'])),
    cpm: safeNumber(readField(row, ['cpm'])),
    cpv: safeNumber(readField(row, ['cpv'])),
    dataSource: String(readField(row, ['fuente_dato'])).trim(),
    notes: String(readField(row, ['notas'])).trim(),
  }
}

function normalizeSentiment(row) {
  const id = String(readField(row, ['sentiment_id'])).trim()
  if (!id) return null
  return {
    id,
    campaignId: String(readField(row, ['campaign_id'])).trim(),
    campaignName: String(readField(row, ['campaign_name'])).trim(),
    cutDate: normalizeDate(readField(row, ['fecha_corte'])),
    general: String(readField(row, ['sentimiento_general'])).trim(),
    positivePct: safeNumber(readField(row, ['positivo_pct'])),
    neutralPct: safeNumber(readField(row, ['neutro_pct'])),
    negativePct: safeNumber(readField(row, ['negativo_pct'])),
    summary: String(readField(row, ['resumen_general'])).trim(),
    positiveRead: String(readField(row, ['lectura_positiva'])).trim(),
    neutralRead: String(readField(row, ['lectura_neutra'])).trim(),
    negativeRead: String(readField(row, ['lectura_negativa'])).trim(),
    themes: String(readField(row, ['temas_recurrentes'])).trim(),
    frictions: String(readField(row, ['dudas_fricciones'])).trim(),
    opportunities: String(readField(row, ['oportunidades'])).trim(),
    notes: String(readField(row, ['notas'])).trim(),
  }
}

function normalizeEvidence(row) {
  const id = String(readField(row, ['evidencia_id'])).trim()
  if (!id) return null
  return {
    id,
    campaignId: String(readField(row, ['campaign_id'])).trim(),
    campaignName: String(readField(row, ['campaign_name'])).trim(),
    influencerCampaignId: String(readField(row, ['influencer_campaign_id'])).trim(),
    influencerName: String(readField(row, ['influencer_name'])).trim(),
    contentId: String(readField(row, ['contenido_id'])).trim(),
    platform: String(readField(row, ['plataforma'])).trim(),
    date: normalizeDate(readField(row, ['fecha'])),
    commentType: String(readField(row, ['tipo_comentario'])).trim(),
    sentiment: String(readField(row, ['sentimiento'])).trim(),
    text: String(readField(row, ['texto_comentario'])).trim(),
    screenshot: String(readField(row, ['embed_screenshot'])).trim() || drivePreview(readField(row, ['screenshot_url'])),
    highlighted: yes(readField(row, ['destacado'])),
    analysisNote: String(readField(row, ['nota_analisis'])).trim(),
    topic: String(readField(row, ['etiqueta_tema'])).trim(),
    notes: String(readField(row, ['notas'])).trim(),
  }
}

function normalizeFinding(row) {
  const id = String(readField(row, ['finding_id'])).trim()
  if (!id) return null
  return {
    id,
    campaignId: String(readField(row, ['campaign_id'])).trim(),
    campaignName: String(readField(row, ['campaign_name'])).trim(),
    date: normalizeDate(readField(row, ['fecha'])),
    category: String(readField(row, ['categoria'])).trim(),
    priority: String(readField(row, ['prioridad'])).trim(),
    title: String(readField(row, ['titulo'])).trim(),
    insight: String(readField(row, ['hallazgo'])).trim(),
    relatedEvidence: String(readField(row, ['evidencia_relacionada'])).trim(),
    recommendation: String(readField(row, ['recomendacion'])).trim(),
    nextAction: String(readField(row, ['accion_siguiente'])).trim(),
    status: String(readField(row, ['estatus'])).trim(),
    visible: yes(readField(row, ['visible_dashboard'])),
    order: safeNumber(readField(row, ['orden'])),
    notes: String(readField(row, ['notas'])).trim(),
  }
}

export function useInfluencerData(marcaId) {
  const [state, setState] = useState({ loading: true, error: null, raw: null })
  const selectedBrand = useMemo(() => brandFromRoute(marcaId), [marcaId])

  const loadData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      const [
        campaignRows,
        influencerRows,
        contentRows,
        paidTikTokRows,
        paidMetaRows,
        sentimentRows,
        evidenceRows,
        findingRows,
      ] = await Promise.all([
        fetchSheet(SHEETS.campaigns),
        fetchSheet(SHEETS.influencers),
        fetchSheet(SHEETS.contents),
        fetchSheet(SHEETS.paidTikTok, true),
        fetchSheet(SHEETS.paidMeta, true),
        fetchSheet(SHEETS.sentiment, true),
        fetchSheet(SHEETS.evidences, true),
        fetchSheet(SHEETS.findings, true),
      ])

      setState({
        loading: false,
        error: null,
        raw: { campaignRows, influencerRows, contentRows, paidTikTokRows, paidMetaRows, sentimentRows, evidenceRows, findingRows },
      })
    } catch (error) {
      setState({ loading: false, error: error.message || 'No se pudieron cargar los datos de influencers', raw: null })
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const data = useMemo(() => {
    if (!state.raw) return null

    const campaigns = state.raw.campaignRows
      .map(normalizeCampaign)
      .filter(Boolean)
      .filter(row => isSameBrand(row.brandName, selectedBrand.name))

    const visibleCampaigns = campaigns.filter(row => row.dashboardVisible)
    const visibleCampaignIds = new Set(visibleCampaigns.map(row => row.id))

    const influencers = state.raw.influencerRows
      .map(normalizeInfluencer)
      .filter(Boolean)
      .filter(row => visibleCampaignIds.has(row.campaignId))

    const contents = state.raw.contentRows
      .map(normalizeContent)
      .filter(Boolean)
      .filter(row => visibleCampaignIds.has(row.campaignId))

    const paidTikTok = state.raw.paidTikTokRows
      .map(normalizePaidTikTok)
      .filter(Boolean)
      .filter(row => visibleCampaignIds.has(row.campaignId))

    const paidMeta = state.raw.paidMetaRows
      .map(normalizePaidMeta)
      .filter(Boolean)
      .filter(row => visibleCampaignIds.has(row.campaignId))

    const paid = [...paidTikTok, ...paidMeta]

    const validCampaignIds = new Set(visibleCampaigns.map(row => row.id))
    const sentiment = state.raw.sentimentRows
      .map(normalizeSentiment)
      .filter(Boolean)
      .filter(row => validCampaignIds.has(row.campaignId))

    const evidences = state.raw.evidenceRows
      .map(normalizeEvidence)
      .filter(Boolean)
      .filter(row => validCampaignIds.has(row.campaignId) && row.highlighted)

    const findings = state.raw.findingRows
      .map(normalizeFinding)
      .filter(Boolean)
      .filter(row => validCampaignIds.has(row.campaignId))
      .sort((a, b) => safeNumber(a.order) - safeNumber(b.order))

    const campaignBundles = visibleCampaigns
      .map(campaign => buildCampaignBundle({ campaign, influencers, contents, paid, sentiment, evidences, findings }))
      .sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)))

    return {
      brand: selectedBrand,
      campaigns: campaignBundles,
      allCampaigns: campaigns,
      influencers,
      contents,
      paid,
      paidTikTok,
      paidMeta,
      sentiment,
      evidences,
      findings,
      totals: buildBrandTotals(campaignBundles),
      paidTotals: aggregatePaid(paid),
      source: {
        spreadsheetId: INFLUENCER_SHEET_ID,
        tabs: SHEETS,
      },
    }
  }, [state.raw, selectedBrand])

  return { ...state, data, refresh: loadData, sheetBrandId: selectedBrand.name }
}
