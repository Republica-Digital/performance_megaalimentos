// ─────────────────────────────────────────────────────────────────────────────
// Campaign classification v3
// ─────────────────────────────────────────────────────────────────────────────
// The Google Sheet now has explicit columns (auto-filled by Apps Script):
//   • marca              (explicit)
//   • mes                (explicit)
//   • plataforma         (explicit, auto-detected from nombre_campana)
//   • objetivo_detectado (explicit, auto-detected)
//   • tipo_campana       (explicit: "AON" | "Mundial" | "Pal Norte" | custom)
//
// This module reads those columns directly and falls back to name-based
// detection only when the explicit column is missing (older sheets).
// ─────────────────────────────────────────────────────────────────────────────

const stripAccents = (s) =>
  String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

// ── Bucket detection ────────────────────────────────────────────────────────
// A "bucket" is the grouping used by the Mensual/Mundial/Pal Norte toggle.
// Maps tipo_campana → bucket key:
//   "AON"        → 'mensual' (for backwards compat with the toggle)
//   "Mundial"    → 'mundial'
//   "Pal Norte"  → 'pal_norte'
//   others       → slugified version of tipo_campana ('buen_fin', etc.)
export function tipoCampanaToBucket(tipoCampana) {
  if (!tipoCampana) return 'mensual'
  const s = stripAccents(tipoCampana)
  if (s === 'aon' || s === 'mensual') return 'mensual'
  if (s === 'mundial') return 'mundial'
  if (s.replace(/\s+/g, '') === 'palnorte') return 'pal_norte'
  // Any other value → slug
  return s.replace(/\s+/g, '_')
}

// Human-friendly label for a bucket
export function bucketToLabel(bucket, tipoCampana) {
  if (bucket === 'mensual') return 'Mensual / AON'
  if (bucket === 'mundial') return 'Mundial'
  if (bucket === 'pal_norte') return 'Pal Norte'
  // For custom buckets, use the original tipo_campana text if available
  return tipoCampana || bucket
}

// ── Fallback: detect tipo_campana from nombre_campana if column is empty ───
export function detectTipoCampanaFromName(name) {
  const s = stripAccents(name)
  if (/\bmundial\b/.test(s)) return 'Mundial'
  if (/\bpal\s*norte\b|\bpalnorte\b/.test(s)) return 'Pal Norte'
  return 'AON'
}

// ── Detect platform from name (fallback) ────────────────────────────────────
export function detectPlatformFromName(name, fallbackPlatform) {
  const s = stripAccents(name)
  if (/\bfb\b|facebook/.test(s)) return 'facebook'
  if (/\big\b|instagram/.test(s)) return 'instagram'
  if (/\btiktok\b|\btt\b|tik\s*tok/.test(s)) return 'tiktok'
  if (/\bgoogle\b|google\s*ads|video\s*ads|display\s*ads/.test(s)) return 'google'
  if (fallbackPlatform) {
    const fb = stripAccents(fallbackPlatform)
    if (fb === 'facebook') return 'facebook'
    if (fb === 'instagram') return 'instagram'
    if (fb === 'tiktok') return 'tiktok'
    if (fb === 'google') return 'google'
  }
  return fallbackPlatform || null
}

// ── Google Ads objective from tipo_objetivo / tipo_red column ──────────────
export function getGoogleObjective(tipoValue) {
  const s = stripAccents(tipoValue)
  if (/video|youtube|yt/.test(s)) return 'Video'
  if (/display|dsp|banner/.test(s)) return 'Display'
  if (!s) return null
  return String(tipoValue).charAt(0).toUpperCase() + String(tipoValue).slice(1).toLowerCase()
}

// ── Detect objective from name (fallback) ───────────────────────────────────
export function extractObjective(name, platform) {
  const s = stripAccents(name)
  if (/visit[ae]s?\s*(?:al\s*)?perfil|perfil\s*visit/.test(s)) return 'Visitas al perfil'
  if (/\blikes?\b/.test(s)) return 'Likes'
  if (/thruplay/.test(s)) return 'Thruplays'
  if (/interacc?ion/.test(s)) return 'Interacción'
  if (/alcance|reach/.test(s)) return 'Alcance'
  if (platform === 'tiktok') {
    if (/\bview|visual|play|reproduc/.test(s)) return 'Views'
  }
  if (platform === 'google') {
    if (/\bvideo\b|youtube/.test(s)) return 'Video'
    if (/\bdisplay\b|dsp|banner/.test(s)) return 'Display'
  }
  if (/views|visualizacion/.test(s)) return 'Views'
  return null
}

// ── Enrich campaign row ─────────────────────────────────────────────────────
// Reads explicit columns first, falls back to name detection only if missing.
export function enrichCampaign(row) {
  const fullName = row.nombre_campana || row.objetivo || ''

  // Use explicit tipo_campana if present, else derive from name
  const tipoCampana = row.tipo_campana || detectTipoCampanaFromName(fullName)
  const bucket = tipoCampanaToBucket(tipoCampana)

  // Use explicit plataforma if present, else detect from name
  const platform = row.plataforma
    ? stripAccents(row.plataforma)
    : detectPlatformFromName(fullName, row.plataforma)

  // Use explicit objetivo_detectado if present, else detect from name
  const objective = row.objetivo_detectado
    || row.objetivo
    || extractObjective(fullName, platform)
    || 'Sin objetivo'

  return {
    ...row,
    _bucket: bucket,
    _platform: platform,
    _objective: objective,
    _tipoCampana: tipoCampana,
    _fullName: fullName,
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────
export function filterCampaignsByBucket(campaigns, bucket) {
  if (!Array.isArray(campaigns)) return []
  return campaigns.filter(c => {
    const b = c._bucket || tipoCampanaToBucket(c.tipo_campana)
    return b === bucket
  })
}

export function aggregateCampaignMetrics(campaigns) {
  const sum = (key) => campaigns.reduce((acc, c) => {
    const n = parseFloat(c[key])
    return acc + (isNaN(n) ? 0 : n)
  }, 0)
  return {
    inversion: sum('inversion'),
    resultado: sum('resultado'),
    meta: sum('meta'),
  }
}

// Returns buckets present in the data plus labels for the toggle.
// Always includes 'mensual' first, then extras in order of appearance.
export function detectAvailableBuckets(campaigns) {
  const seen = new Map()  // bucket → label
  seen.set('mensual', 'Mensual / AON')
  for (const c of (campaigns || [])) {
    const tipo = c.tipo_campana || c._tipoCampana || detectTipoCampanaFromName(c.nombre_campana || c.objetivo)
    const bucket = tipoCampanaToBucket(tipo)
    if (!seen.has(bucket)) {
      seen.set(bucket, bucketToLabel(bucket, tipo))
    }
  }
  return Array.from(seen.entries()).map(([key, label]) => ({ key, label }))
}
