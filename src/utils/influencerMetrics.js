import { safeNumber } from './format'

export const INFLUENCER_SHEET_ID = import.meta.env.VITE_INFLUENCERS_SHEET_ID || '1C5bMVcgvtRb-UahWX7c_UY2WoLDJWQuQ3zIvbzqMPTw'

export const BRAND_TO_INFLUENCER_ID = {
  botanera: 'BOTA',
  chamoy: 'CHAM',
  pacific: 'PACI',
}

export const platformColors = {
  TikTok: '#00f2ea',
  Instagram: '#f97316',
  Facebook: '#3b82f6',
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

export function normalizeDate(value) {
  if (!value) return ''
  const raw = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (slash) {
    return `${slash[3]}-${String(Number(slash[2])).padStart(2, '0')}-${String(Number(slash[1])).padStart(2, '0')}`
  }
  return raw
}

export function normalizeDriveImage(url) {
  if (!url) return ''
  const raw = String(url)
  const match = raw.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) || raw.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (match) return `https://lh3.googleusercontent.com/d/${match[1]}`
  return raw
}

export function defaultCampaignForBrand(brand) {
  if (!brand?.id) return null
  return {
    id: `${brand.id}-GENERAL`,
    marcaId: brand.id,
    name: `${brand.name || brand.id} - Campana general`,
    startDate: brand.startDate,
    endDate: brand.endDate,
    objective: 'Influencer marketing',
    status: 'Activa',
    isFallback: true,
  }
}

export function aggregateContent(rows = []) {
  const total = rows.reduce((acc, row) => {
    acc.views += safeNumber(row.views)
    acc.avgTimeSum += row.avgTime !== null ? safeNumber(row.avgTime) : 0
    acc.avgTimeCount += row.avgTime !== null ? 1 : 0
    acc.vtrSum += row.vtr !== null ? safeNumber(row.vtr) : 0
    acc.vtrCount += row.vtr !== null ? 1 : 0
    acc.reactions += safeNumber(row.reactions)
    acc.comments += safeNumber(row.comments)
    acc.shares += safeNumber(row.shares)
    acc.saves += safeNumber(row.saves)
    acc.clicks += safeNumber(row.clicks)
    acc.storyViews += /story/i.test(row.format) ? safeNumber(row.views) : 0
    return acc
  }, {
    views: 0, avgTimeSum: 0, avgTimeCount: 0, vtrSum: 0, vtrCount: 0,
    reactions: 0, comments: 0, shares: 0, saves: 0, clicks: 0, storyViews: 0,
  })

  total.interactions = total.reactions + total.comments + total.shares + total.saves
  total.etr = total.views > 0 ? (total.interactions / total.views) * 100 : 0
  total.ctr = total.storyViews > 0 ? (total.clicks / total.storyViews) * 100 : 0
  total.avgTime = total.avgTimeCount > 0 ? total.avgTimeSum / total.avgTimeCount : 0
  total.vtr = total.vtrCount > 0 ? total.vtrSum / total.vtrCount : 0
  return total
}

export function aggregatePaid(rows = []) {
  const total = rows.reduce((acc, row) => {
    acc.views6s += safeNumber(row.views6s)
    acc.reach += safeNumber(row.reach)
    acc.likes += safeNumber(row.likes)
    acc.comments += safeNumber(row.comments)
    acc.shares += safeNumber(row.shares)
    acc.saves += safeNumber(row.saves)
    acc.investment += safeNumber(row.investment)
    return acc
  }, { views6s: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, investment: 0 })

  total.interactions = total.likes + total.comments + total.shares + total.saves
  total.cpv = total.views6s > 0 ? total.investment / total.views6s : 0
  total.engagementRate = total.reach > 0 ? (total.interactions / total.reach) * 100 : 0
  return total
}

export function buildInfluencerRollups({ influencers = [], contents = [], paid = [], projections = [] }) {
  const projectionsByInfluencer = new Map(projections.map(p => [p.influencerId, p]))
  return influencers.map(influencer => {
    const influencerContents = contents.filter(row => row.influencerId === influencer.id)
    const influencerPaid = paid.filter(row => row.influencerId === influencer.id)
    const organic = aggregateContent(influencerContents)
    const paidTotals = aggregatePaid(influencerPaid)
    const fee = safeNumber(influencer.fee)
    const cpv = organic.views > 0 ? fee / organic.views : 0
    const cpi = organic.interactions > 0 ? fee / organic.interactions : 0
    const projection = projectionsByInfluencer.get(influencer.id) || {}
    const planned = safeNumber(projection.ttVideosPlan) + safeNumber(projection.igReelsPlan) + safeNumber(projection.fbReelsPlan) + safeNumber(projection.igStoriesPlan) + safeNumber(projection.fbStoriesPlan)
    return {
      ...influencer,
      organic,
      paid: paidTotals,
      cpv,
      cpi,
      contents: influencerContents,
      projection,
      progress: {
        published: influencerContents.length,
        planned,
      },
    }
  }).sort((a, b) => (b.organic.views || 0) - (a.organic.views || 0))
}
