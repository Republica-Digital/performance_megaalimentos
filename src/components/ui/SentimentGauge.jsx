import { motion } from 'framer-motion'
import { useCountUp } from '../../hooks/useCountUp'
import { safeNumber } from '../../utils/format'

/**
 * Semi-circular sentiment gauge.
 *  - Score = positivo - negativo (-100 to +100)
 *  - Needle rotates from -90° (negative) to +90° (positive)
 */
export function SentimentGauge({ positivo = 0, neutro = 0, negativo = 0 }) {
  const pos = safeNumber(positivo)
  const neg = safeNumber(negativo)
  const score = pos - neg          // -100 to +100
  const animScore = useCountUp(score, { duration: 1500, decimals: 0 })
  const animPos = useCountUp(pos, { duration: 1500, decimals: 0 })

  // Convert score to angle: -100 → -90°, 0 → 0°, +100 → +90°
  const angle = (score / 100) * 90

  // Color of needle based on score
  const needleColor =
    score >= 30 ? '#22c55e'
    : score <= -30 ? '#ef4444'
    : '#facc15'

  // Verdict label
  const verdict =
    score >= 50 ? { label: 'Excelente', color: '#22c55e' }
    : score >= 20 ? { label: 'Positivo', color: '#86efac' }
    : score >= -20 ? { label: 'Neutral', color: '#facc15' }
    : score >= -50 ? { label: 'Negativo', color: '#fca5a5' }
    : { label: 'Crítico', color: '#ef4444' }

  // SVG dimensions
  const W = 280, H = 170
  const cx = W / 2, cy = H - 20
  const r = 110

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[300px]">
        <defs>
          <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="50%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
          <filter id="needle-glow">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background arc */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="22"
          fill="none"
          strokeLinecap="round"
        />

        {/* Colored arc */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          stroke="url(#gauge-grad)"
          strokeWidth="22"
          fill="none"
          strokeLinecap="round"
          opacity="0.9"
        />

        {/* Tick marks */}
        {[-90, -45, 0, 45, 90].map((a) => {
          const rad = (a - 90) * Math.PI / 180
          const x1 = cx + (r - 16) * Math.cos(rad)
          const y1 = cy + (r - 16) * Math.sin(rad)
          const x2 = cx + (r + 4) * Math.cos(rad)
          const y2 = cy + (r + 4) * Math.sin(rad)
          return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
        })}

        {/* Needle */}
        <motion.g
          initial={{ rotate: -90 }}
          animate={{ rotate: angle }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        >
          <line
            x1={cx} y1={cy}
            x2={cx} y2={cy - r + 10}
            stroke={needleColor}
            strokeWidth="3"
            strokeLinecap="round"
            filter="url(#needle-glow)"
          />
          <circle cx={cx} cy={cy} r="9" fill={needleColor} filter="url(#needle-glow)" />
          <circle cx={cx} cy={cy} r="4" fill="#0a0a0a" />
        </motion.g>
      </svg>

      {/* Score + verdict */}
      <div className="text-center -mt-4">
        <p className="text-[10px] uppercase tracking-widest text-white/50 font-semibold mb-1">
          Score Neto
        </p>
        <p className="text-4xl font-bold font-display text-white tabular-nums">
          {animScore > 0 ? '+' : ''}{animScore}
        </p>
        <div
          className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
          style={{
            background: `${verdict.color}22`,
            color: verdict.color,
            border: `1px solid ${verdict.color}44`,
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: verdict.color }} />
          {verdict.label}
        </div>
      </div>

      {/* Breakdown */}
      <div className="mt-6 grid grid-cols-3 gap-3 w-full">
        <SentimentChip label="Positivo" value={pos} color="#22c55e" animValue={animPos} />
        <SentimentChip label="Neutro" value={neutro} color="#facc15" />
        <SentimentChip label="Negativo" value={neg} color="#ef4444" />
      </div>
    </div>
  )
}

function SentimentChip({ label, value, color }) {
  return (
    <div
      className="rounded-xl p-3 text-center"
      style={{
        background: `${color}15`,
        border: `1px solid ${color}30`,
      }}
    >
      <p className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color }}>
        {label}
      </p>
      <p className="text-xl font-bold font-display text-white tabular-nums">
        {safeNumber(value).toFixed(0)}<span className="text-sm text-white/50">%</span>
      </p>
    </div>
  )
}
