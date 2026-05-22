// ─────────────────────────────────────────────────────────────────────────────
// URL normalization — DEFINITIVE version
//
// IMAGE URLs (for imagen_url column):
//   Google Drive share link   → drive.usercontent.google.com (works!)
//   GitHub blob URL           → raw.githubusercontent.com
//   Direct image URL          → as-is
//   "None"/empty              → null
//
// EMBED content (for embed_url column) — accepts ANYTHING the analyst pastes:
//   HTML embed code (<blockquote>, <iframe>)  → rendered as social embed
//   Public post URL (instagram.com/p/...)     → converted to embed iframe
//   business.facebook.com preview URL         → marked unusable, falls back
//   Empty                                     → null
// ─────────────────────────────────────────────────────────────────────────────

const NULLISH_STRINGS = new Set(['', 'none', 'null', 'undefined', 'n/a', '-', '#n/a'])

export function isNullishString(val) {
  if (val === null || val === undefined) return true
  return NULLISH_STRINGS.has(String(val).trim().toLowerCase())
}

// ─── IMAGE URL NORMALIZATION ─────────────────────────────────────────────────

export function normalizeImageUrl(val) {
  if (isNullishString(val)) return null
  let url = String(val).trim()
  url = url.replace(/^["']|["']$/g, '')
  url = url.replace(/\?raw$/, '?raw=true')
  url = url.replace(/\?$/, '')

  // GitHub blob → raw
  const blobMatch = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^?#]+)/i)
  if (blobMatch) {
    const [, user, repo, path] = blobMatch
    return `https://raw.githubusercontent.com/${user}/${repo}/${path}`
  }

  // Google Drive → drive.usercontent (the format that actually works)
  const driveFileMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/i)
  if (driveFileMatch) {
    return `https://drive.usercontent.google.com/download?id=${driveFileMatch[1]}&export=view`
  }
  const driveIdMatch = url.match(/drive\.google\.com\/(?:open|uc)\?.*id=([^&]+)/i)
  if (driveIdMatch) {
    return `https://drive.usercontent.google.com/download?id=${driveIdMatch[1]}&export=view`
  }
  if (url.includes('drive.usercontent.google.com')) return url
  if (url.includes('lh3.googleusercontent.com/d/')) {
    const m = url.match(/lh3\.googleusercontent\.com\/d\/([^/?]+)/i)
    if (m) return `https://drive.usercontent.google.com/download?id=${m[1]}&export=view`
  }

  return url
}

// ─── EMBED CLASSIFICATION ────────────────────────────────────────────────────
//
// Classifies what the analyst pasted in embed_url.
// Returns { type, value, embedHtml }
//
// Types:
//   'html_embed'   → raw HTML from "copy embed code" (blockquote/iframe)
//   'ig_url'       → Instagram post/reel URL → we build the embed
//   'fb_url'       → Facebook post URL → we build the embed
//   'tt_url'       → TikTok video URL → we build the embed
//   'unusable'     → business.facebook.com or other non-renderable URL
//   'generic_url'  → unknown URL, used as "ver original" link only
//   'empty'        → nothing

export function classifyEmbed(val) {
  if (isNullishString(val)) return { type: 'empty', value: null }
  const s = String(val).trim()

  // ── HTML embed code (from "Insertar"/"Embed" button on social networks) ──
  if (
    s.includes('<blockquote') ||
    s.includes('<iframe') ||
    s.includes('class="instagram-media"') ||
    s.includes('class="tiktok-embed"') ||
    s.includes('data-instgrm-permalink') ||
    s.includes('fb-post') ||
    s.includes('fb-video')
  ) {
    // But NOT if it's a business.facebook.com iframe
    if (s.includes('business.facebook.com/ads/api/preview_iframe')) {
      return { type: 'unusable', value: s }
    }
    return { type: 'html_embed', value: s }
  }

  // ── business.facebook.com preview (from Portermetrics) — unusable ──
  if (s.includes('business.facebook.com/ads/api/preview_iframe')) {
    return { type: 'unusable', value: s }
  }

  // ── Public post URLs — we can build embeds from these ──
  if (s.startsWith('http')) {
    // Instagram post or reel
    if (/instagram\.com\/(p|reel)\/([A-Za-z0-9_-]+)/i.test(s)) {
      return { type: 'ig_url', value: s }
    }
    // Facebook post (various URL formats)
    if (/facebook\.com.*\/(posts|photos|videos|watch|permalink|story)/i.test(s) || /fb\.watch/i.test(s)) {
      return { type: 'fb_url', value: s }
    }
    // TikTok video
    if (/tiktok\.com\/@[^/]+\/video\/\d+/i.test(s) || /vm\.tiktok\.com/i.test(s)) {
      return { type: 'tt_url', value: s }
    }
    // Unknown URL
    return { type: 'generic_url', value: s }
  }

  return { type: 'unusable', value: s }
}

// ─── EXTRACT LINK ────────────────────────────────────────────────────────────
// Gets a clickable link from whatever was pasted (for "Ver publicación original")

export function extractLinkFromEmbed(val) {
  if (isNullishString(val)) return null
  const s = String(val).trim()
  if (s.startsWith('http') && !s.includes('<')) return s
  // From HTML: try href first, then data-instgrm-permalink, then src
  const hrefMatch = s.match(/(?:href|data-instgrm-permalink)=["']([^"']+)["']/i)
  if (hrefMatch) return hrefMatch[1]
  const srcMatch = s.match(/src=["']([^"']+)["']/i)
  if (srcMatch && !srcMatch[1].includes('business.facebook.com')) return srcMatch[1]
  return null
}

// Legacy export
export function extractEmbedUrl(val) {
  const result = classifyEmbed(val)
  if (result.type === 'empty' || result.type === 'unusable') return null
  return result.value
}

export function detectPlatform(post) {
  if (post?.plataforma) return String(post.plataforma).toLowerCase()
  const url = post?.embed_url || post?.imagen_url || ''
  if (/instagram\.com/i.test(url)) return 'instagram'
  if (/tiktok\.com/i.test(url)) return 'tiktok'
  if (/facebook\.com|fb\.com/i.test(url)) return 'facebook'
  return 'unknown'
}
