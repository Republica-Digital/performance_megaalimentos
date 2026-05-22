import { motion } from 'framer-motion'
import { Calendar, Trophy, Flag, Sparkles } from 'lucide-react'

const BUCKET_ICONS = {
  mensual:   Calendar,
  mundial:   Trophy,
  pal_norte: Flag,
}

export function CampaignToggle({ buckets = [], selected, onChange, accentColor = '#ffffff' }) {
  // buckets es [{key, label}, ...]
  if (!buckets || buckets.length <= 1) return null

  return (
    <div className="glass-card rounded-2xl p-3 flex items-center gap-2 flex-wrap">
      <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold px-2">
        Vista
      </span>
      <div className="flex gap-1.5 flex-wrap">
        {buckets.map(({ key, label }) => {
          const Icon = BUCKET_ICONS[key] || Sparkles
          const isActive = selected === key
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className="relative px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
              style={{
                background: isActive ? `${accentColor}26` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isActive ? `${accentColor}66` : 'rgba(255,255,255,0.08)'}`,
                color: isActive ? '#fff' : 'rgba(255,255,255,0.65)',
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="active-bucket"
                  className="absolute inset-0 rounded-xl"
                  style={{ boxShadow: `0 4px 20px -4px ${accentColor}66` }}
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                />
              )}
              <Icon className="w-3.5 h-3.5 relative" />
              <span className="relative">{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
