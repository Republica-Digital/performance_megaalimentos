import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lightbulb, X, ChevronRight } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Floating Observaciones Button + Modal
// Accepts an array of observaciones (each with titulo and/or descripcion).
// Shows a small pill button; clicking opens a slide-over panel with all items.
// ─────────────────────────────────────────────────────────────────────────────
export function ObservacionesButton({ observaciones = [], accentColor = '#a78bfa' }) {
  const [open, setOpen] = useState(false)

  // Normalize: accept single object (legacy) or array
  const items = Array.isArray(observaciones) ? observaciones : (observaciones ? [observaciones] : [])

  // Filter out items that have no meaningful content
  const valid = items.filter(o =>
    (o.titulo && String(o.titulo).trim()) ||
    (o.descripcion && String(o.descripcion).trim()) ||
    (o.observacion && String(o.observacion).trim())
  )

  if (valid.length === 0) return null

  return (
    <>
      {/* Floating pill button */}
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold
                   hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 cursor-pointer
                   border"
        style={{
          background: `${accentColor}15`,
          borderColor: `${accentColor}30`,
          color: accentColor,
        }}
      >
        <Lightbulb className="w-3.5 h-3.5" />
        <span>Observaciones</span>
        <span
          className="ml-0.5 min-w-[1.25rem] h-5 flex items-center justify-center rounded-full text-[10px] font-bold"
          style={{ background: `${accentColor}25`, color: accentColor }}
        >
          {valid.length}
        </span>
        <ChevronRight className="w-3 h-3 opacity-60" />
      </button>

      {/* Modal overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onClick={e => e.stopPropagation()}
              className="relative w-full max-w-lg max-h-[80vh] glass-card rounded-2xl overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div
                    className="p-2 rounded-xl"
                    style={{ background: `${accentColor}20`, border: `1px solid ${accentColor}30` }}
                  >
                    <Lightbulb className="w-4 h-4" style={{ color: accentColor }} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold font-display text-white">Observaciones</h3>
                    <p className="text-[11px] text-white/50">{valid.length} {valid.length === 1 ? 'nota' : 'notas'} del mes</p>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {valid.map((obs, i) => {
                  const title = obs.titulo || ''
                  const desc = obs.descripcion || obs.observacion || ''
                  return (
                    <div
                      key={i}
                      className="p-4 rounded-xl border border-white/10 bg-white/[0.03]"
                    >
                      {title && (
                        <p className="text-sm font-semibold text-white mb-1">{title}</p>
                      )}
                      {desc && (
                        <p className="text-sm text-white/70 leading-relaxed whitespace-pre-line">{desc}</p>
                      )}
                      {!title && !desc && (
                        <p className="text-sm text-white/40 italic">Sin contenido</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy single-observacion card (kept for Overview if needed)
// ─────────────────────────────────────────────────────────────────────────────
export function ObservacionesCard({ observacion, accentColor = '#ffffff' }) {
  // Support both old field name (observacion.observacion) and new (titulo/descripcion)
  const text = observacion?.observacion || observacion?.descripcion
  if (!text) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="glass-card rounded-2xl p-6 relative overflow-hidden"
    >
      <div
        className="absolute -top-20 -left-20 w-48 h-48 rounded-full blur-3xl opacity-20"
        style={{ background: accentColor }}
      />
      <div className="relative flex gap-4">
        <div
          className="flex-shrink-0 p-2.5 rounded-xl h-fit"
          style={{
            background: `${accentColor}22`,
            boxShadow: `inset 0 0 0 1px ${accentColor}33`,
          }}
        >
          <Lightbulb className="w-5 h-5" style={{ color: accentColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="text-sm font-bold font-display text-white uppercase tracking-wider">
              Observaciones
            </h4>
            <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent" />
          </div>
          {observacion?.titulo && (
            <p className="text-white font-semibold text-sm mb-1">{observacion.titulo}</p>
          )}
          <p className="text-white/80 leading-relaxed text-[15px] whitespace-pre-line">
            {text}
          </p>
        </div>
      </div>
    </motion.div>
  )
}
