import { motion } from 'framer-motion'

export function SectionHeader({ icon: Icon, title, subtitle, accentColor = '#ffffff', actions = null }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex items-center justify-between gap-3 flex-wrap"
    >
      <div className="flex items-center gap-3">
        {Icon && (
          <div
            className="p-3 rounded-2xl relative"
            style={{
              background: `${accentColor}20`,
              boxShadow: `inset 0 0 0 1px ${accentColor}30`,
            }}
          >
            <Icon className="w-5 h-5" style={{ color: accentColor }} />
            <div
              className="absolute inset-0 rounded-2xl blur-xl opacity-40"
              style={{ background: accentColor }}
            />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight">{title}</h1>
          {subtitle && <p className="text-white/55 text-sm mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions}
    </motion.div>
  )
}

export function EmptyState({ icon: Icon, title, message }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-card rounded-2xl py-16 px-6 flex flex-col items-center text-center"
    >
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-white/8 border border-white/10 flex items-center justify-center mb-4">
          <Icon className="w-7 h-7 text-white/40" />
        </div>
      )}
      <h3 className="text-base font-semibold text-white/85 mb-1">{title}</h3>
      {message && <p className="text-sm text-white/50 max-w-md">{message}</p>}
    </motion.div>
  )
}
