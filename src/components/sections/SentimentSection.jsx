import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, ChevronLeft, ChevronRight, Image as ImageIcon, X } from 'lucide-react'
import { SectionHeader, EmptyState } from '../ui/SectionHeader'
import { ChartCard } from '../ui/Charts'
import { ObservacionesCard } from '../ui/ObservacionesCard'
import { SentimentGauge } from '../ui/SentimentGauge'
import { safeNumber } from '../../utils/format'
import { isNullishString } from '../../utils/urls'

const ACCENT = '#a78bfa'
const EMBED_MAX_H = 320

// Detect if captura is embed HTML (analyst pasted <iframe>/<blockquote>)
// or a plain image URL.
function classifyCaptura(captura) {
  const embed = captura?.embed_url ?? captura?.embed_html
  if (embed && !isNullishString(embed)) {
    const s = String(embed).trim()
    if (s.startsWith('<')) return { kind: 'embed', value: s }
  }
  if (captura?.imagen_url && !isNullishString(captura.imagen_url)) {
    return { kind: 'image', value: captura.imagen_url }
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Drive detection: extract file ID from Drive iframe embed code
// ─────────────────────────────────────────────────────────────────────────────
function extractDriveId(html) {
  const match = html.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

function DriveImage({ fileId, maxH }) {
  const [err, setErr] = useState(false)
  // Drive thumbnail endpoint — renders the image directly without the dark viewer
  const src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`

  if (err) {
    // Fallback: if thumbnail fails, use iframe but at least try
    return (
      <iframe
        src={`https://drive.google.com/file/d/${fileId}/preview`}
        title="Drive preview"
        style={{ width: '100%', height: maxH, border: 0 }}
        loading="lazy"
        scrolling="no"
        allowFullScreen
      />
    )
  }

  return (
    <img
      src={src}
      alt="Captura de comentario"
      onError={() => setErr(true)}
      className="max-w-full object-contain rounded-lg"
      style={{ maxHeight: maxH }}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EmbedSlide — handles Drive (as direct image) and social embeds (IG/FB/TT)
// ─────────────────────────────────────────────────────────────────────────────
function EmbedSlide({ html }) {
  const ref = useRef(null)
  const driveId = useMemo(() => extractDriveId(html), [html])

  useEffect(() => {
    // If it's a Drive embed, we render as <img> instead — skip innerHTML
    if (driveId || !ref.current) return
    ref.current.innerHTML = html

    const iframes = ref.current.querySelectorAll('iframe')
    iframes.forEach(iframe => {
      iframe.style.maxWidth = '100%'
      iframe.style.border = '0'
      iframe.style.display = 'block'
      iframe.setAttribute('loading', 'lazy')
      iframe.setAttribute('scrolling', 'no')
    })

    const loadScript = (id, src) => {
      if (document.getElementById(id)) return
      const s = document.createElement('script')
      s.id = id; s.src = src; s.async = true
      document.body.appendChild(s)
    }

    const lc = html.toLowerCase()
    if (lc.includes('instagram')) {
      loadScript('ig-embed', 'https://www.instagram.com/embed.js')
      setTimeout(() => { try { window.instgrm?.Embeds?.process(ref.current) } catch {} }, 200)
    } else if (lc.includes('tiktok')) {
      loadScript('tt-embed', 'https://www.tiktok.com/embed.js')
    } else if (lc.includes('facebook')) {
      loadScript('fb-sdk', 'https://connect.facebook.net/es_LA/sdk.js#xfbml=1&version=v18.0')
      setTimeout(() => { try { window.FB?.XFBML?.parse(ref.current) } catch {} }, 200)
    }
  }, [html, driveId])

  // Drive embeds → render as clean image, no dark viewer background
  if (driveId) {
    return (
      <div className="flex items-center justify-center overflow-hidden" style={{ maxHeight: EMBED_MAX_H }}>
        <DriveImage fileId={driveId} maxH={EMBED_MAX_H} />
      </div>
    )
  }

  // Other embeds (IG, FB, TT, generic iframes)
  return (
    <div
      ref={ref}
      className="flex items-start justify-center overflow-hidden"
      style={{ maxHeight: EMBED_MAX_H }}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SentimentSection
// ─────────────────────────────────────────────────────────────────────────────
export function SentimentSection({ data, capturas = [], observaciones, loading, theme }) {
  const [page, setPage] = useState(0)
  const [imgError, setImgError] = useState({})
  const [modalOpen, setModalOpen] = useState(false)
  const [modalIdx, setModalIdx] = useState(0)
  const PAGE_SIZE = 3

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl skeleton h-96" />
        <div className="rounded-2xl skeleton h-96" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <SectionHeader icon={MessageSquare} title="Sentiment" subtitle="Sin datos para este mes" accentColor={ACCENT} />
        <EmptyState icon={MessageSquare} title="Sin análisis disponible" message="No hay datos de sentiment registrados para este mes." />
      </div>
    )
  }

  const validCapturas = capturas
    .map(c => ({ ...c, _class: classifyCaptura(c) }))
    .filter(c => c._class !== null)
    .sort((a, b) => safeNumber(a.orden) - safeNumber(b.orden))

  const totalPages = Math.max(1, Math.ceil(validCapturas.length / PAGE_SIZE))
  const visibleCapturas = validCapturas.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const next = () => setPage(p => (p + 1) % totalPages)
  const prev = () => setPage(p => (p - 1 + totalPages) % totalPages)

  const renderSlide = (captura, idx, inModal = false) => {
    if (!captura?._class) return null
    if (captura._class.kind === 'embed') {
      return <EmbedSlide html={captura._class.value} />
    }
    if (imgError[idx] && !inModal) {
      return (
        <div className="flex flex-col items-center gap-3 text-white/40 py-8">
          <ImageIcon className="w-10 h-10" />
          <p className="text-xs">No se pudo cargar la imagen</p>
        </div>
      )
    }
    return (
      <img
        src={captura._class.value}
        alt={`Captura ${idx + 1}`}
        onError={() => setImgError(p => ({ ...p, [idx]: true }))}
        className={`${inModal ? 'max-w-full max-h-[80vh]' : 'max-w-full'} object-contain rounded-lg`}
        style={inModal ? {} : { maxHeight: EMBED_MAX_H }}
      />
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={MessageSquare}
        title="Sentiment"
        subtitle="Análisis de percepción de la marca"
        accentColor={ACCENT}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Termómetro de Sentiment" subtitle="Score neto del mes" allowLogScale={false} expandable={false}>
          <SentimentGauge
            positivo={data.positivo_pct}
            neutro={data.neutro_pct}
            negativo={data.negativo_pct}
          />
        </ChartCard>

        <ChartCard title="Análisis Cualitativo" subtitle="Resumen de la conversación" allowLogScale={false} expandable={false}>
          {data.descripcion ? (
            <div className="space-y-4">
              <p className="text-white/85 leading-relaxed text-[15px] whitespace-pre-line">
                {data.descripcion}
              </p>
            </div>
          ) : (
            <p className="text-white/40 text-sm">Sin descripción cualitativa disponible</p>
          )}
        </ChartCard>
      </div>

      {validCapturas.length > 0 && (
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-start justify-between mb-4 gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold font-display text-white tracking-tight">Comentarios Destacados</h3>
              <p className="text-xs text-white/50 mt-0.5">
                {validCapturas.length} {validCapturas.length === 1 ? 'captura' : 'capturas'} del mes
              </p>
            </div>
            <div className="flex items-center gap-2">
              {totalPages > 1 && (
                <>
                  <button
                    onClick={prev}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors border border-white/10"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-white/50 font-mono min-w-[3rem] text-center">
                    {page + 1} / {totalPages}
                  </span>
                  <button
                    onClick={next}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors border border-white/10"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.35 }}
              className={`grid gap-5 ${
                visibleCapturas.length === 1 ? 'grid-cols-1 max-w-md mx-auto' :
                visibleCapturas.length === 2 ? 'grid-cols-1 sm:grid-cols-2' :
                'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
              }`}
            >
              {visibleCapturas.map((captura, i) => {
                const globalIdx = page * PAGE_SIZE + i
                return (
                  <div
                    key={globalIdx}
                    className="flex justify-center overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ maxHeight: EMBED_MAX_H }}
                    onClick={() => { setModalIdx(globalIdx); setModalOpen(true) }}
                  >
                    {renderSlide(captura, globalIdx, false)}
                  </div>
                )
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {modalOpen && validCapturas[modalIdx] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setModalOpen(false)}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-4xl w-full"
            >
              <button
                onClick={() => setModalOpen(false)}
                className="absolute -top-4 -right-4 p-2 rounded-full glass-strong hover:bg-white/20 shadow-lg z-10"
              >
                <X className="w-5 h-5 text-white" />
              </button>
              <div className="flex items-center justify-center">
                {renderSlide(validCapturas[modalIdx], modalIdx, true)}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {observaciones && <ObservacionesCard observacion={observaciones} accentColor={ACCENT} />}
    </div>
  )
}
