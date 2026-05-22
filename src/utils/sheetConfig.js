// ─────────────────────────────────────────────────────────────────────────────
// Sheet Configuration & Field Mapping
// Sistema flexible que detecta automáticamente campos, incluso si tienen
// nombres ligeramente diferentes (espacios, guiones, mayúsculas, etc.)
// ─────────────────────────────────────────────────────────────────────────────

const normalizeFieldName = (name) =>
  String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, '_')
    .replace(/[áàâäã]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[íìîï]/g, 'i')
    .replace(/[óòôöõ]/g, 'o')
    .replace(/[úùûü]/g, 'u')
    .replace(/[ñ]/g, 'n')

// ─────────────────────────────────────────────────────────────────────────────
// FIELD MATCHERS — Lógica de detección flexible
// ─────────────────────────────────────────────────────────────────────────────

const FIELD_PATTERNS = {
  // Identifiers
  marca: /^(marca|brand|brand_id|marca_id)$/,
  mes: /^(mes|month|fecha_mes)$/,
  fecha: /^(fecha|date|dia|day|fecha_dia)$/,
  
  // Social Media — General
  seguidores: /^(seguidores|followers|seguidor)$/,
  alcance: /^(alcance|reach)$/,
  impresiones: /^(impresiones|impressions|impr)$/,
  impresiones_visibles: /^(impresiones_visibles|visible_impressions|impr_visibles)$/,
  interacciones: /^(interacciones|interactions|engagement_count)$/,
  engagement_rate: /^(engagement_rate|engagement|engagement_pct|engagement_percent)$/,
  nuevos_seguidores: /^(nuevos_seguidores|new_followers|nuevos_followers)$/,
  publicaciones: /^(publicaciones|posts|post_count)$/,
  inversion: /^(inversion|investment|spend|presupuesto|budget|costo)$/,
  
  // Specific to TikTok
  views: /^(views|visualizaciones|vistas)$/,
  views_6s: /^(views_6s|views_6s_plus|video_completion_rate)$/,
  
  // Google Ads
  clics: /^(clics|clicks|clic)$/,
  ctr: /^(ctr|ctr_percent|ctr_pct)$/,
  cvr: /^(cvr|view_rate|vtr|completion_rate)$/,
  cpc: /^(cpc|cost_per_click)$/,
  conversiones: /^(conversiones|conversions|conv)$/,
  cpa: /^(cpa|cost_per_acquisition)$/,
  tipo_red: /^(tipo_red|tipo_objetivo|network|red|objetivo_type|ad_type)$/,
  
  // Campaigns
  plataforma: /^(plataforma|platform|channel)$/,
  nombre_campana: /^(nombre_campana|campaign_name|nombre|nombre_campaign|campaign|campana_nombre)$/,
  objetivo: /^(objetivo|objective|goal)$/,
  objetivo_detectado: /^(objetivo_detectado|detected_objective)$/,
  meta: /^(meta|target|goal_value|meta_value)$/,
  resultado: /^(resultado|result|performance|resultado_actual)$/,
  variacion_pct: /^(variacion_pct|variacion|variation|variation_pct|variacion_percent)$/,
  observacion: /^(observacion|observation|nota|note|comment)$/,
  
  // TopPosts
  tipo_top: /^(tipo_top|top_type|tipo|post_type)$/,
  descripcion: /^(descripcion|description|texto|text)$/,
  embed_url: /^(embed_url|embed|codigo_embed|embed_code|iframe)$/,
  imagen_url: /^(imagen_url|image_url|image|image_link)$/,
  
  // Sentiment
  positivo_pct: /^(positivo_pct|positivo|positive_pct|positive_percent)$/,
  neutro_pct: /^(neutro_pct|neutro|neutral_pct|neutral_percent)$/,
  negativo_pct: /^(negativo_pct|negativo|negative_pct|negative_percent)$/,
  
  // Sentiment Capturas
  orden: /^(orden|order|numero|number|num|posicion)$/,
  
  // Competencia
  competidor: /^(competidor|competitor|competition|competitor_name)$/,
  red: /^(red|network|platform|channel)$/,
  posts: /^(posts|post_count|num_posts)$/,
  engagement_pct: /^(engagement_pct|engagement_percent|engagement)$/,
  
  // Hallazgos
  seccion: /^(seccion|section|area)$/,
  tipo: /^(tipo|type|kind|category)$/,
  titulo: /^(titulo|title|headline|name)$/,
  prioridad: /^(prioridad|priority|orden)$/,
  
  // Projecciones
  metrica: /^(metrica|metric|medida)$/,
  proyeccion: /^(proyeccion|projection|forecast)$/,
  real: /^(real|actual|resultado_real)$/,
  cpr_meta: /^(cpr|cpr_meta|cprmeta|cost_per_result)$/,
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-detect field mappings from headers
// ─────────────────────────────────────────────────────────────────────────────

export function detectFieldMappings(headers = []) {
  if (!Array.isArray(headers) || headers.length === 0) {
    console.warn('No headers provided for field detection')
    return {}
  }

  const mapping = {}

  for (const header of headers) {
    const normalized = normalizeFieldName(header)
    
    // Find which field this header matches
    for (const [fieldName, pattern] of Object.entries(FIELD_PATTERNS)) {
      if (pattern.test(normalized)) {
        mapping[fieldName] = header  // Store the ORIGINAL header name
        break
      }
    }
  }

  return mapping
}

// ─────────────────────────────────────────────────────────────────────────────
// Row normalizer — extract values using flexible field detection
// ─────────────────────────────────────────────────────────────────────────────

export function normalizeRowWithMapping(row, fieldMapping) {
  if (!row || typeof row !== 'object') return {}
  
  const normalized = {}
  
  for (const [fieldName, originalHeader] of Object.entries(fieldMapping)) {
    const value = row[originalHeader]
    if (value !== null && value !== undefined && value !== '') {
      normalized[fieldName] = value
    }
  }
  
  return normalized
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Safe number conversion
// ─────────────────────────────────────────────────────────────────────────────

export function safeParseNumber(val, defaultVal = 0) {
  const n = parseFloat(val)
  return isNaN(n) ? defaultVal : n
}

export function safeParsePercent(val, defaultVal = 0) {
  const n = parseFloat(val)
  return isNaN(n) ? defaultVal : Math.min(Math.max(n, 0), 100)
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Detect if a value "looks like" a date
// ─────────────────────────────────────────────────────────────────────────────

export function isProbablyDate(val) {
  if (!val) return false
  const s = String(val)
  return /^\d{4}-\d{2}(-\d{2})?$/.test(s) ||  // YYYY-MM or YYYY-MM-DD
         /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s) ||  // MM/DD/YYYY
         /Date\(\d+,\s*\d+/.test(s) ||  // Date(2026,2,1)
         !isNaN(Date.parse(s))  // Anything Date.parse accepts
}

// ─────────────────────────────────────────────────────────────────────────────
// Export field patterns for use in other modules
// ─────────────────────────────────────────────────────────────────────────────

export const EXPECTED_SHEETS = {
  required: ['_CONFIG', '_MARCAS', 'Facebook', 'Instagram', 'TikTok', 'Campañas', 'TopPosts', 'Sentiment', 'Hallazgos', 'Observaciones'],
  optional: ['GoogleAds', 'GoogleAds_Ciudades', 'GoogleAds_Keywords', 'Competencia', 'Sentiment_Capturas', 'Proyecciones', '_MESES'],
}

export const SHEET_FIELD_REQUIREMENTS = {
  Facebook: ['marca', 'mes', 'seguidores', 'alcance', 'impresiones', 'interacciones', 'engagement_rate', 'inversion'],
  Instagram: ['marca', 'mes', 'seguidores', 'alcance', 'impresiones', 'interacciones', 'engagement_rate', 'inversion'],
  TikTok: ['marca', 'mes', 'seguidores', 'views', 'interacciones', 'engagement_rate', 'inversion'],
  GoogleAds: ['marca', 'mes', 'tipo_red', 'impresiones', 'clics', 'ctr', 'inversion'],
  Campañas: ['marca', 'mes', 'plataforma', 'nombre_campana', 'resultado', 'inversion'],
  TopPosts: ['marca', 'mes', 'plataforma', 'tipo_top', 'interacciones'],
  Sentiment: ['marca', 'mes', 'positivo_pct', 'neutro_pct', 'negativo_pct'],
  Hallazgos: ['marca', 'mes', 'seccion', 'tipo', 'titulo'],
}
