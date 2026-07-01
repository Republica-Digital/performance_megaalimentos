import { safeNumber } from './format'

export const INFLUENCER_SHEET_ID = import.meta.env.VITE_INFLUENCERS_SHEET_ID || '1tN3OamHgUFrIq2kn8XweLBrOTtcd86iC6oAIXvZgiWM'

export const INFLUENCER_BRANDS = {
  botanera: { slug: 'botanera', name: 'La Botanera', color: '#FF6B00', accent: '#FFD700' },
  'la-botanera': { slug: 'botanera', name: 'La Botanera', color: '#FF6B00', accent: '#FFD700' },
  'chamoy-mega': { slug: 'chamoy-mega', name: 'Chamoy Mega', color: '#A855F7', accent: '#FFD700' },
  chamoy: { slug: 'chamoy-mega', name: 'Chamoy Mega', color: '#A855F7', accent: '#FFD700' },
  'pacific-mix': { slug: 'pacific-mix', name: 'Pacific Mix', color: '#3B82F6', accent: '#E31E24' },
  pacific: { slug: 'pacific-mix', name: 'Pacific Mix', color: '#3B82F6', accent: '#E31E24' },
}

export const BRAND_TO_INFLUENCER_ID = {
  botanera: 'La Botanera',
  'la-botanera': 'La Botanera',
  chamoy: 'Chamoy Mega',
  'chamoy-mega': 'Chamoy Mega',
  pacific: 'Pacific Mix',
  'pacific-mix': 'Pacific Mix',
}

export const platformColors = {
  TikTok: '#00f2ea',
  Instagram: '#f97316',
  Facebook: '#3b82f6',
  YouTube: '#ef4444',
  Meta: '#8b5cf6',
  Pauta: '#f59e0b',
}

export function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, '_')
}

export function readField(row, names, fallback = '') {
  const wanted = names.map(normalizeKey)
  for (const [key, value] of Object.entries(row || {})) {
    if (wanted.includes(normalizeKey(key))) return value ?? fallback
  }
  return fallback
}

export function normalizeBrandSlug(value) {
  const raw = String(value || '').trim().toLowerCase()
  const cleaned = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
  return INFLUENCER_BRANDS[cleaned]?.slug || cleaned || 'botanera'
}

export function brandFromRoute(value) {
  const slug = normalizeBrandSlug(value)
  return INFLUENCER_BRANDS[slug] || INFLUENCER_BRANDS.botanera
}

export function influencerRouteSlug(value) {
  const slug = normalizeBrandSlug(value)
  return INFLUENCER_BRANDS[slug]?.slug || slug
}

export function isSameBrand(rowBrand, selectedBrandName) {
  const rowSlug = normalizeBrandSlug(rowBrand)
  const selectedSlug = normalizeBrandSlug(selectedBrandName)
  const rowCanonical = INFLUENCER_BRANDS[rowSlug]?.slug || rowSlug
  const selectedCanonical = INFLUENCER_BRANDS[selectedSlug]?.slug || selectedSlug
  return rowCanonical === selectedCanonical
}

export function normalizeDate(value) {
  if (!value) return ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  const raw = String(value).trim()
  if (!raw) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)

  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (slash) {
    return `${slash[3]}-${String(Number(slash[2])).padStart(2, '0')}-${String(Number(slash[1])).padStart(2, '0')}`
  }

  if (/^\d{4,5}(\.\d+)?$/.test(raw)) {
    const date = new Date((Number(raw) - 25569) * 86400000)
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10)
  }

  return raw
}

export function yes(value) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
  return ['si', 'yes', 'true', '1', 'visible'].includes(normalized)
}

export function normalizeDriveImage(url) {
  if (!url) return ''
  const raw = String(url)
  const match = raw.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) || raw.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (match) return `https://lh3.googleusercontent.com/d/${match[1]}`
  return raw
}

export function drivePreview(url) {
  const raw = String(url || '')
  const match = raw.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) || raw.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (match) return `https://drive.google.com/file/d/${match[1]}/preview`
  return raw
}

export function localInfluencerPhoto(idOrName) {
  const key = normalizeKey(idOrName).replace(/_/g, '')
  const photos = {
    aldotdenigris: '/influencers/aldotdenigris.png',
    bastiandelfin: '/influencers/bastiandelfin.png',
    guszapiain: '/influencers/guszapiain.png',
  }
  return photos[key] || ''
}

export function organicInteractions(row = {}) {
  return safeNumber(row.likes) + safeNumber(row.comments) + safeNumber(row.shares) + safeNumber(row.saves) + safeNumber(row.clicks)
}

export function paidInteractions(row = {}) {
  return safeNumber(row.likes) + safeNumber(row.comments) + safeNumber(row.shares) + safeNumber(row.saves)
}

export function aggregateOrganic(contents = []) {
  const totals = contents.reduce((acc, row) => {
    const interactions = organicInteractions(row)
    acc.views += safeNumber(row.views)
    acc.reach += safeNumber(row.reach)
    acc.likes += safeNumber(row.likes)
    acc.comments += safeNumber(row.comments)
    acc.shares += safeNumber(row.shares)
    acc.saves += safeNumber(row.saves)
    acc.clicks += safeNumber(row.clicks)
    acc.interactions += interactions
    acc.avgTimeSum += row.avgTime !== null && row.avgTime !== '' ? safeNumber(row.avgTime) : 0
    acc.avgTimeCount += row.avgTime !== null && row.avgTime !== '' ? 1 : 0
    acc.vtrSum += row.vtr !== null && row.vtr !== '' ? safeNumber(row.vtr) : 0
    acc.vtrCount += row.vtr !== null && row.vtr !== '' ? 1 : 0
    return acc
  }, {
    views: 0,
    reach: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    clicks: 0,
    interactions: 0,
    avgTimeSum: 0,
    avgTimeCount: 0,
    vtrSum: 0,
    vtrCount: 0,
  })

  totals.er = totals.views > 0 ? (totals.interactions / totals.views) * 100 : null
  totals.avgTime = totals.avgTimeCount > 0 ? totals.avgTimeSum / totals.avgTimeCount : null
  totals.vtr = totals.vtrCount > 0 ? totals.vtrSum / totals.vtrCount : null
  return totals
}

export function aggregatePaid(rows = []) {
  const totals = rows.reduce((acc, row) => {
    acc.investment += safeNumber(row.investment)
    acc.impressions += safeNumber(row.impressions)
    acc.reach += safeNumber(row.reach)
    acc.views += safeNumber(row.views)
    acc.clicks += safeNumber(row.clicks)
    acc.likes += safeNumber(row.likes)
    acc.comments += safeNumber(row.comments)
    acc.shares += safeNumber(row.shares)
    acc.saves += safeNumber(row.saves)
    acc.interactions += paidInteractions(row)
    return acc
  }, {
    investment: 0,
    impressions: 0,
    reach: 0,
    views: 0,
    clicks: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    interactions: 0,
  })

  totals.cpv = totals.views > 0 ? totals.investment / totals.views : null
  totals.cpm = totals.impressions > 0 ? (totals.investment / totals.impressions) * 1000 : null
  totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : null
  totals.cpe = totals.interactions > 0 ? totals.investment / totals.interactions : null
  return totals
}

export function aggregatePaidByNetwork(rows = []) {
  return {
    all: aggregatePaid(rows),
    tiktok: aggregatePaid(rows.filter(row => row.network === 'TikTok')),
    meta: aggregatePaid(rows.filter(row => row.network === 'Meta')),
  }
}

export function buildPlatformBreakdown(contents = [], fee = 0) {
  const groups = contents.reduce((acc, row) => {
    const key = row.platform || 'Sin plataforma'
    if (!acc[key]) acc[key] = []
    acc[key].push(row)
    return acc
  }, {})

  const totalViews = contents.reduce((sum, row) => sum + safeNumber(row.views), 0)
  return Object.entries(groups).map(([platform, rows]) => {
    const organic = aggregateOrganic(rows)
    const allocatedFee = totalViews > 0 ? safeNumber(fee) * (organic.views / totalViews) : 0
    return {
      platform,
      contents: rows.length,
      followers: 0,
      views: organic.views,
      interactions: organic.interactions,
      er: organic.er,
      cpv: organic.views > 0 && allocatedFee > 0 ? allocatedFee / organic.views : null,
    }
  }).sort((a, b) => b.views - a.views)
}

export function buildInfluencerRollups({ influencers = [], contents = [], paid = [] }) {
  return influencers.map(influencer => {
    const influencerContents = contents.filter(row => row.influencerCampaignId === influencer.id)
    const influencerPaid = paid.filter(row => row.influencerCampaignId === influencer.id)
    const organic = aggregateOrganic(influencerContents)
    const paidTotals = aggregatePaid(influencerPaid)
    const fee = safeNumber(influencer.netFee)
    const cpv = organic.views > 0 && fee > 0 ? fee / organic.views : null
    const hasProjection = safeNumber(influencer.projectedViews) > 0 || safeNumber(influencer.projectedInteractions) > 0 || safeNumber(influencer.projectedReach) > 0
    return {
      ...influencer,
      contents: influencerContents,
      paid: paidTotals,
      organic,
      cpv,
      cpe: organic.interactions > 0 && fee > 0 ? fee / organic.interactions : null,
      platformBreakdown: buildPlatformBreakdown(influencerContents, fee),
      progress: {
        published: influencerContents.length,
        planned: safeNumber(influencer.planned.total),
        hasProjection,
      },
    }
  }).sort((a, b) => safeNumber(b.organic.views) - safeNumber(a.organic.views))
}

export function attachPaidToContents(contents = [], paid = []) {
  const paidByContent = paid.reduce((acc, row) => {
    if (!row.contentId) return acc
    if (!acc[row.contentId]) acc[row.contentId] = []
    acc[row.contentId].push(row)
    return acc
  }, {})

  return contents.map(content => {
    const paidRows = paidByContent[content.id] || []
    const paidTotals = aggregatePaid(paidRows)
    const organicInteractionsTotal = organicInteractions(content)
    return {
      ...content,
      paidRows,
      paid: paidTotals,
      hasPaid: paidRows.length > 0,
      organicInteractions: organicInteractionsTotal,
      organicEr: content.views > 0 ? (organicInteractionsTotal / content.views) * 100 : null,
      totalViews: safeNumber(content.views) + safeNumber(paidTotals.views),
      totalInteractions: organicInteractionsTotal + safeNumber(paidTotals.interactions),
    }
  })
}

export function buildCampaignBundle({ campaign, influencers = [], contents = [], paid = [], sentiment = [], evidences = [], findings = [] }) {
  const campaignInfluencers = influencers.filter(row => row.campaignId === campaign.id)
  const campaignContents = attachPaidToContents(contents.filter(row => row.campaignId === campaign.id), paid.filter(row => row.campaignId === campaign.id))
  const campaignPaid = paid.filter(row => row.campaignId === campaign.id)
  const influencerCost = campaignInfluencers.reduce((sum, row) => sum + safeNumber(row.netFee), 0)
  const organic = aggregateOrganic(campaignContents)
  const paidTotals = aggregatePaidByNetwork(campaignPaid)
  const totalViews = safeNumber(organic.views) + safeNumber(paidTotals.all.views)
  const totalInvestment = influencerCost + safeNumber(paidTotals.all.investment)
  const campaignSentiment = sentiment.filter(row => row.campaignId === campaign.id)
  const campaignEvidences = evidences.filter(row => row.campaignId === campaign.id)
  const campaignFindings = findings.filter(row => row.campaignId === campaign.id && row.visible)
  const rollups = buildInfluencerRollups({ influencers: campaignInfluencers, contents: campaignContents, paid: campaignPaid })

  return {
    ...campaign,
    influencers: campaignInfluencers,
    contents: campaignContents,
    paidRows: campaignPaid,
    sentiment: campaignSentiment,
    evidences: campaignEvidences,
    findings: campaignFindings,
    rollups,
    contentCount: campaignContents.length,
    paidContentCount: new Set(campaignPaid.map(row => row.contentId).filter(Boolean)).size,
    influencerCount: campaignInfluencers.length,
    platforms: [...new Set(campaignContents.map(row => row.platform).filter(Boolean))],
    organic,
    paid: paidTotals.all,
    paidByNetwork: paidTotals,
    influencerCost,
    totalInvestment,
    totalViews,
    totalInteractions: safeNumber(organic.interactions) + safeNumber(paidTotals.all.interactions),
    organicCpv: organic.views > 0 && influencerCost > 0 ? influencerCost / organic.views : null,
    paidCpv: paidTotals.all.cpv,
    totalCpv: totalViews > 0 && totalInvestment > 0 ? totalInvestment / totalViews : null,
    er: organic.er,
  }
}

export function buildBrandTotals(campaigns = []) {
  const totals = campaigns.reduce((acc, campaign) => {
    acc.campaigns += 1
    acc.influencers += safeNumber(campaign.influencerCount)
    acc.contents += safeNumber(campaign.contentCount)
    acc.paidContents += safeNumber(campaign.paidContentCount)
    acc.organicViews += safeNumber(campaign.organic.views)
    acc.paidViews += safeNumber(campaign.paid.views)
    acc.organicInteractions += safeNumber(campaign.organic.interactions)
    acc.paidInteractions += safeNumber(campaign.paid.interactions)
    acc.influencerInvestment += safeNumber(campaign.influencerCost)
    acc.paidInvestment += safeNumber(campaign.paid.investment)
    return acc
  }, {
    campaigns: 0,
    influencers: 0,
    contents: 0,
    paidContents: 0,
    organicViews: 0,
    paidViews: 0,
    organicInteractions: 0,
    paidInteractions: 0,
    influencerInvestment: 0,
    paidInvestment: 0,
  })

  totals.totalViews = totals.organicViews + totals.paidViews
  totals.totalInteractions = totals.organicInteractions + totals.paidInteractions
  totals.totalInvestment = totals.influencerInvestment + totals.paidInvestment
  totals.organicCpv = totals.organicViews > 0 && totals.influencerInvestment > 0 ? totals.influencerInvestment / totals.organicViews : null
  totals.paidCpv = totals.paidViews > 0 && totals.paidInvestment > 0 ? totals.paidInvestment / totals.paidViews : null
  totals.totalCpv = totals.totalViews > 0 && totals.totalInvestment > 0 ? totals.totalInvestment / totals.totalViews : null
  totals.er = totals.organicViews > 0 ? (totals.organicInteractions / totals.organicViews) * 100 : null
  return totals
}

export function sortByMetric(rows = [], metric = 'organicViews') {
  const getters = {
    organicViews: row => safeNumber(row.organic?.views ?? row.views),
    interactions: row => safeNumber(row.organic?.interactions ?? row.organicInteractions ?? row.interactions),
    er: row => safeNumber(row.organic?.er ?? row.organicEr ?? row.er),
    organicCpv: row => {
      const value = row.organicCpv ?? row.cpv
      return value === null || value === undefined ? Number.POSITIVE_INFINITY : safeNumber(value)
    },
    paidViews: row => safeNumber(row.paid?.views ?? row.paidViews),
    paidCpv: row => {
      const value = row.paidCpv ?? row.paid?.cpv
      return value === null || value === undefined ? Number.POSITIVE_INFINITY : safeNumber(value)
    },
    totalImpact: row => safeNumber(row.totalViews) + safeNumber(row.totalInteractions),
  }
  const getter = getters[metric] || getters.organicViews
  const asc = metric.toLowerCase().includes('cpv')
  return [...rows].sort((a, b) => asc ? getter(a) - getter(b) : getter(b) - getter(a))
}
