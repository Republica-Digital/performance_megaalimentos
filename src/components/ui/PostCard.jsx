import { motion } from 'framer-motion'
import { Heart, Eye, Play, Trophy, Sparkles, ExternalLink, Image as ImageIcon, Loader, AlertCircle } from 'lucide-react'
import { useState, useEffect, useRef, useMemo } from 'react'
import { formatNumber } from '../../utils/format'
import { isNullishString, classifyEmbed, extractLinkFromEmbed } from '../../utils/urls'

const EMBED_HEIGHT = 480

const PLATFORM_STYLES = {
  facebook:  { gradient: 'from-blue-500 to-blue-700',                bg: 'rgba(59,130,246,0.15)',  border: 'rgba(59,130,246,0.35)',  label: 'Facebook' },
  instagram: { gradient: 'from-pink-500 via-purple-500 to-orange-500', bg: 'rgba(236,72,153,0.15)',  border: 'rgba(236,72,153,0.35)',  label: 'Instagram' },
  tiktok:    { gradient: 'from-cyan-400 via-pink-500 to-red-500',     bg: 'rgba(34,211,238,0.15)',  border: 'rgba(34,211,238,0.35)',  label: 'TikTok' },
}

const TYPE_LABELS = {
  alcance:     { label: 'Mayor Alcance',      icon: Eye },
  interaccion: { label: 'Mayor Interacción',  icon: Heart },
  views:       { label: 'Mayor Views',        icon: Play },
}

function getTypeInfo(type) {
  if (!type) return { label: 'Top Post', icon: Trophy }
  const key = String(type).toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return TYPE_LABELS[key] || { label: String(type), icon: Trophy }
}

// ─────────────────────────────────────────────────────────────────────────────
// Universal HTML Embed — accepts ANY embed code pasted into embed_url.
// Scales iframes to fit the container by setting width=100% and preserving
// aspect ratio. Supports Instagram, Facebook, TikTok, YouTube, plain iframes.
// ─────────────────────────────────────────────────────────────────────────────
function UniversalEmbed({ html, platform, onFail }) {
  const ref = useRef(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!html || !ref.current) return
    ref.current.innerHTML = html

    // Normalize any iframe inside the embed: fill parent & keep aspect.
    const iframes = ref.current.querySelectorAll('iframe')
    iframes.forEach(iframe => {
      iframe.style.maxWidth = '100%'
      iframe.style.width = '100%'
      iframe.style.border = '0'
      iframe.style.display = 'block'
      iframe.setAttribute('loading', 'lazy')
      // Hide scrolling artefacts
      iframe.setAttribute('scrolling', 'no')
      // If height is explicit, keep it; otherwise fill container
      if (!iframe.style.height && !iframe.getAttribute('height')) {
        iframe.style.height = '100%'
      }
      // Detect if the iframe src is a Meta business preview link (requires login)
      const src = iframe.getAttribute('src') || ''
      if (src.includes('business.facebook.com/ads/api/preview_iframe')) {
        setFailed(true)
        onFail?.()
      }
    })

    // Load platform-specific SDK when needed
    const loadScript = (id, src, cb) => {
      if (document.getElementById(id)) { cb?.(); return }
      const s = document.createElement('script')
      s.id = id; s.src = src; s.async = true
      s.onload = cb
      s.onerror = () => { setFailed(true); onFail?.() }
      document.body.appendChild(s)
    }

    const lc = html.toLowerCase()
    if (lc.includes('instagram') || platform === 'instagram') {
      loadScript('ig-embed', 'https://www.instagram.com/embed.js', () => {
        try { window.instgrm?.Embeds?.process(ref.current) } catch {}
        setLoading(false)
      })
    } else if (lc.includes('tiktok') || platform === 'tiktok') {
      loadScript('tt-embed', 'https://www.tiktok.com/embed.js', () => setLoading(false))
    } else if (lc.includes('fb-post') || lc.includes('fb-video') || lc.includes('connect.facebook.net')) {
      loadScript('fb-sdk', 'https://connect.facebook.net/es_LA/sdk.js#xfbml=1&version=v18.0', () => {
        try { window.FB?.XFBML?.parse(ref.current) } catch {}
        setLoading(false)
      })
    } else {
      setLoading(false)
    }

    const timeout = setTimeout(() => setLoading(false), 4000)
    return () => clearTimeout(timeout)
  }, [html, platform])

  if (failed) {
    return (
      <div className="relative bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-xl overflow-hidden flex items-center justify-center p-6" style={{ minHeight: EMBED_HEIGHT }}>
        <div className="text-center max-w-sm">
          <AlertCircle className="w-10 h-10 text-amber-400/80 mx-auto mb-3" />
          <p className="text-white/80 text-sm font-semibold mb-2">Embed no disponible públicamente</p>
          <p className="text-white/50 text-xs">
            El código de inserción requiere sesión privada (Ads Manager). Pega un embed público del post original en la columna <code className="px-1.5 py-0.5 rounded bg-white/10 font-mono">embed_url</code> del Excel.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex justify-center overflow-hidden" style={{ minHeight: EMBED_HEIGHT }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <Loader className="w-6 h-6 text-white/40 animate-spin" />
        </div>
      )}
      <div
        ref={ref}
        className="overflow-hidden flex items-start justify-center"
        style={{ maxHeight: EMBED_HEIGHT + 100, minHeight: EMBED_HEIGHT }}
      />
    </div>
  )
}

// URL → Embed (IG/FB/TT public URLs get converted to proper iframes)
function UrlEmbed({ url, type, onFail }) {
  const [loading, setLoading] = useState(true)
  const ref = useRef(null)

  const embedSrc = useMemo(() => {
    if (type === 'ig_url') {
      const clean = url.split('?')[0].replace(/\/$/, '')
      return `${clean}/embed`
    }
    if (type === 'fb_url') {
      return `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url)}&show_text=true&width=380`
    }
    return null
  }, [url, type])

  useEffect(() => {
    if (type !== 'tt_url' || !ref.current) return
    const videoId = url.match(/video\/(\d+)/)?.[1]
    if (!videoId) { onFail?.(); return }
    ref.current.innerHTML = `
      <blockquote class="tiktok-embed" cite="${url}" data-video-id="${videoId}" style="max-width:380px;min-width:280px;margin:0;">
        <section></section>
      </blockquote>
    `
    if (!document.getElementById('tt-embed')) {
      const s = document.createElement('script')
      s.id = 'tt-embed'; s.src = 'https://www.tiktok.com/embed.js'; s.async = true
      document.body.appendChild(s)
    }
    setLoading(false)
  }, [url, type])

  if (type === 'tt_url') {
    return (
      <div className="relative flex items-start justify-center overflow-hidden" style={{ minHeight: EMBED_HEIGHT }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <Loader className="w-6 h-6 text-white/40 animate-spin" />
          </div>
        )}
        <div ref={ref} className="overflow-hidden p-2 flex justify-center" style={{ maxHeight: EMBED_HEIGHT + 100 }} />
      </div>
    )
  }

  if (!embedSrc) { onFail?.(); return null }

  return (
    <div className="relative flex justify-center overflow-hidden" style={{ minHeight: EMBED_HEIGHT }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <Loader className="w-6 h-6 text-white/40 animate-spin" />
        </div>
      )}
      <iframe
        src={embedSrc}
        title="Post embed"
        className="border-0"
        style={{ height: EMBED_HEIGHT, width: type === 'fb_url' ? 380 : '100%', maxWidth: '100%' }}
        scrolling="no"
        allowFullScreen
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
        onLoad={() => setLoading(false)}
        onError={() => onFail?.()}
      />
    </div>
  )
}

// Image fallback
function ImagePreview({ src, alt, isVideo }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <div className="relative overflow-hidden bg-black/40" style={{ height: EMBED_HEIGHT }}>
      <img
        src={src}
        alt={alt || 'Top post'}
        onError={() => setFailed(true)}
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/30" />
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-white/25 backdrop-blur-md border border-white/40 flex items-center justify-center">
            <Play className="w-6 h-6 text-white fill-white" />
          </div>
        </div>
      )}
    </div>
  )
}

// Placeholder branded
function Placeholder({ platform, isVideo, descripcion }) {
  const style = PLATFORM_STYLES[platform] || PLATFORM_STYLES.facebook
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${style.gradient}`} style={{ height: EMBED_HEIGHT }}>
      <div className="absolute inset-0 opacity-30">
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-56 h-56 rounded-full bg-black/20 blur-3xl" />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center mb-4 shadow-lg">
          {isVideo ? <Play className="w-8 h-8 text-white fill-white" /> : <ImageIcon className="w-7 h-7 text-white" />}
        </div>
        {descripcion && !isNullishString(descripcion) && (
          <p className="text-white/95 text-sm font-medium line-clamp-3 max-w-[80%] drop-shadow-md">{descripcion}</p>
        )}
        <div className="absolute bottom-3 right-3 text-[10px] uppercase tracking-widest text-white/60 font-semibold">
          {style.label}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PostPreview — smart fallback chain
// ─────────────────────────────────────────────────────────────────────────────
function PostPreview({ post, platform, isVideo, embedInfo }) {
  const [embedFailed, setEmbedFailed] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)
  const hasImage = !isNullishString(post.imagen_url) && !imgFailed

  if (!embedFailed && embedInfo.type === 'html_embed') {
    return <UniversalEmbed html={embedInfo.value} platform={platform} onFail={() => setEmbedFailed(true)} />
  }
  if (!embedFailed && ['ig_url', 'fb_url', 'tt_url'].includes(embedInfo.type)) {
    return <UrlEmbed url={embedInfo.value} type={embedInfo.type} onFail={() => setEmbedFailed(true)} />
  }
  if (hasImage) {
    return <ImagePreview src={post.imagen_url} alt={post.descripcion} isVideo={isVideo} />
  }
  return <Placeholder platform={platform} isVideo={isVideo} descripcion={post.descripcion} />
}

// ─────────────────────────────────────────────────────────────────────────────
// Top Post Card
// ─────────────────────────────────────────────────────────────────────────────
export function TopPostCard({ post, type = 'alcance', platform = 'facebook', delay = 0 }) {
  if (!post) return null
  const isVideo = platform === 'tiktok' || /video|reel/i.test(post.tipo || '')
  const typeInfo = getTypeInfo(post.tipo_top || type)
  const TypeIcon = typeInfo.icon
  const style = PLATFORM_STYLES[platform] || PLATFORM_STYLES.facebook
  const embedInfo = classifyEmbed(post.embed_url)
  const linkUrl = extractLinkFromEmbed(post.embed_url)

  // Show all available metrics
  const metrics = [
    post.alcance > 0 && { label: 'Alcance', value: post.alcance, icon: Eye },
    post.interacciones > 0 && { label: 'Interacciones', value: post.interacciones, icon: Heart },
    post.views > 0 && { label: 'Views', value: post.views, icon: Play },
  ].filter(Boolean)

  // Fallback: at least show primary/secondary
  const primaryMetric = metrics[0] || { label: 'Alcance', value: post.alcance, icon: Eye }
  const secondaryMetric = metrics[1] || null

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: delay * 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="glass-card rounded-2xl overflow-hidden group flex flex-col"
      style={{ minWidth: 0 }}
    >
      <div className="relative px-4 py-3 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ background: style.bg, border: `1px solid ${style.border}` }}>
            <TypeIcon className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-xs font-semibold text-white/85 uppercase tracking-wider">{typeInfo.label}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/30">
          <Sparkles className="w-3 h-3 text-amber-300" />
          <span className="text-[10px] font-bold text-amber-200 uppercase tracking-wider">Top</span>
        </div>
      </div>

      <div style={{ height: EMBED_HEIGHT, overflow: 'hidden' }}>
        <PostPreview post={post} platform={platform} isVideo={isVideo} embedInfo={embedInfo} />
      </div>

      {/* Descripción siempre visible si existe */}
      {post.descripcion && !isNullishString(post.descripcion) && (
        <div className="px-4 pt-3">
          <p className="text-sm text-white/75 line-clamp-3 leading-relaxed">{post.descripcion}</p>
        </div>
      )}

      <div className={`p-4 grid gap-3 ${secondaryMetric ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <MetricBox label={primaryMetric.label} value={primaryMetric.value} icon={primaryMetric.icon} accent={style.bg} />
        {secondaryMetric && <MetricBox label={secondaryMetric.label} value={secondaryMetric.value} icon={secondaryMetric.icon} muted />}
      </div>

      {linkUrl && (
        <a
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 border-t border-white/10 text-[11px] font-medium text-white/50 hover:text-white/90 hover:bg-white/5 transition-colors uppercase tracking-wider"
        >
          <span>Ver publicación original</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </motion.div>
  )
}

function MetricBox({ label, value, icon: Icon, accent, muted }) {
  return (
    <div className="rounded-xl p-3" style={{ background: muted ? 'rgba(255,255,255,0.05)' : (accent || 'rgba(255,255,255,0.08)') }}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-3.5 h-3.5 ${muted ? 'text-white/55' : 'text-white/80'}`} />
        <p className={`text-[10px] uppercase tracking-wider font-semibold ${muted ? 'text-white/55' : 'text-white/70'}`}>{label}</p>
      </div>
      <p className={`text-xl font-bold font-display tracking-tight ${muted ? 'text-white/85' : 'text-white'}`}>{formatNumber(value)}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Section wrapper — carousel: max 3 visible, arrows to navigate
// ─────────────────────────────────────────────────────────────────────────────
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function TopPostsSection({ posts = [], platform = 'facebook' }) {
  const [page, setPage] = useState(0)
  if (!posts?.length) return null

  const PAGE_SIZE = 3
  const totalPages = Math.ceil(posts.length / PAGE_SIZE)
  const visiblePosts = posts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const showArrows = posts.length > PAGE_SIZE

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          <h3 className="text-base font-bold font-display text-white">Top Posts del Mes</h3>
          {posts.length > PAGE_SIZE && (
            <span className="text-xs text-white/40 ml-1">({posts.length} posts)</span>
          )}
        </div>
        {showArrows && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-white/70" />
            </button>
            <span className="text-xs text-white/50 font-mono min-w-[3rem] text-center">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-white/70" />
            </button>
          </div>
        )}
      </div>
      <div className={`grid gap-5 ${
        visiblePosts.length === 1 ? 'grid-cols-1 max-w-md' :
        visiblePosts.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
        'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
      }`}>
        {visiblePosts.map((post, i) => (
          <TopPostCard
            key={`${post.tipo_top || ''}-${i}-${page}`}
            post={post}
            type={post.tipo_top || 'alcance'}
            platform={platform}
            delay={i}
          />
        ))}
      </div>
    </div>
  )
}
