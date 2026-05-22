import { motion } from 'framer-motion'
import { Sparkles, Trophy, AlertTriangle, Target, Lightbulb, Flag, MessageCircle } from 'lucide-react'
import { SectionHeader, EmptyState } from '../ui/SectionHeader'
import { safeNumber } from '../../utils/format'

const ACCENT = '#facc15'

const TIPO_CONFIG = {
  logro: { icon: Trophy, color: '#22c55e', label: 'Logro', bg: 'rgba(34,197,94,0.12)' },
  alerta: { icon: AlertTriangle, color: '#ef4444', label: 'Alerta', bg: 'rgba(239,68,68,0.12)' },
  oportunidad: { icon: Target, color: '#3b82f6', label: 'Oportunidad', bg: 'rgba(59,130,246,0.12)' },
  insight: { icon: Lightbulb, color: '#facc15', label: 'Insight', bg: 'rgba(250,204,21,0.12)' },
  recomendacion: { icon: MessageCircle, color: '#06b6d4', label: 'Recomendación', bg: 'rgba(6,182,212,0.12)' },
  riesgo: { icon: Flag, color: '#f97316', label: 'Riesgo', bg: 'rgba(249,115,22,0.12)' },
}

function getConfig(tipo) {
  const key = String(tipo || '').toLowerCase().trim()
  return TIPO_CONFIG[key] || { icon: Sparkles, color: ACCENT, label: tipo || 'Hallazgo', bg: 'rgba(250,204,21,0.12)' }
}

export function HallazgosSection({ data = [], loading, theme }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="rounded-2xl skeleton h-40" />)}
      </div>
    )
  }

  if (!data?.length) {
    return (
      <div className="space-y-6">
        <SectionHeader icon={Sparkles} title="Hallazgos & Conclusiones" subtitle="Sin hallazgos registrados" accentColor={ACCENT} />
        <EmptyState icon={Sparkles} title="Sin hallazgos" message="No hay hallazgos registrados para el mes seleccionado." />
      </div>
    )
  }

  // Sort by priority
  const sorted = [...data].sort((a, b) => safeNumber(a.prioridad, 99) - safeNumber(b.prioridad, 99))

  // Group by tipo
  const groups = sorted.reduce((acc, h) => {
    const key = String(h.tipo || 'otros').toLowerCase().trim()
    if (!acc[key]) acc[key] = []
    acc[key].push(h)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Sparkles}
        title="Hallazgos & Conclusiones"
        subtitle={`${sorted.length} insight${sorted.length === 1 ? '' : 's'} relevante${sorted.length === 1 ? '' : 's'} del mes`}
        accentColor={ACCENT}
      />

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(groups).map(([tipo, items]) => {
          const cfg = getConfig(tipo)
          const Icon = cfg.icon
          return (
            <div
              key={tipo}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}33` }}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{cfg.label}</span>
              <span className="opacity-70">·</span>
              <span>{items.length}</span>
            </div>
          )
        })}
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sorted.map((h, idx) => {
          const cfg = getConfig(h.tipo)
          const Icon = cfg.icon
          const priority = safeNumber(h.prioridad, 99)
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.05 }}
              className="glass-card rounded-2xl p-5 relative overflow-hidden"
            >
              {/* Side accent bar */}
              <div className="absolute left-0 top-4 bottom-4 w-1 rounded-r-full" style={{ background: cfg.color }} />

              <div className="pl-2 flex gap-4">
                <div
                  className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: cfg.bg, border: `1px solid ${cfg.color}44` }}
                >
                  <Icon className="w-5 h-5" style={{ color: cfg.color }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span
                      className="text-[10px] uppercase tracking-wider font-bold"
                      style={{ color: cfg.color }}
                    >
                      {cfg.label}
                    </span>
                    {priority < 99 && (
                      <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
                        Prioridad #{priority}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold font-display text-white mb-1.5 leading-snug">
                    {h.titulo}
                  </h3>
                  {h.descripcion && (
                    <p className="text-sm text-white/65 leading-relaxed">{h.descripcion}</p>
                  )}
                  {h.seccion && h.seccion !== 'hallazgos' && (
                    <span className="inline-block mt-3 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/8 text-white/55">
                      {h.seccion}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
