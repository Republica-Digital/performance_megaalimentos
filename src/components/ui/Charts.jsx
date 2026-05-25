import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, ComposedChart,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList,
} from 'recharts'
import { Maximize2, X, LineChart as LineIcon, Activity } from 'lucide-react'
import { formatNumber, formatNumberFull, formatMonthShort, truncTo } from '../../utils/format'

// ─────────────────────────────────────────────────────────────────────────────
// ChartCard
// ─────────────────────────────────────────────────────────────────────────────
export function ChartCard({ title, subtitle, children, delay = 0, className = '', expandable = true, allowLogScale = true }) {
  const [expanded, setExpanded] = useState(false)
  const [scale, setScale] = useState('linear')

  const renderChildren = (isExpanded = false) => {
    if (typeof children === 'function') return children({ scale, expanded: isExpanded })
    return children
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: delay * 0.08 }}
        className={`glass-card rounded-2xl p-5 ${className}`}
      >
        <div className="flex items-start justify-between mb-4 gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold font-display text-white tracking-tight truncate">{title}</h3>
            {subtitle && <p className="text-xs text-white/50 mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {allowLogScale && (
              <button
                onClick={() => setScale(s => s === 'linear' ? 'log' : 'linear')}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1 border border-white/10"
                title="Alternar escala logarítmica"
              >
                {scale === 'log' ? <Activity className="w-3 h-3" /> : <LineIcon className="w-3 h-3" />}
                <span className="hidden md:inline">{scale === 'log' ? 'Log' : 'Lin'}</span>
              </button>
            )}
            {expandable && (
              <button
                onClick={() => setExpanded(true)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors border border-white/10"
                title="Expandir"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        {renderChildren(false)}
      </motion.div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setExpanded(false)}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 md:p-8"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong rounded-3xl p-6 md:p-8 w-full max-w-6xl max-h-[90vh] overflow-auto"
            >
              <div className="flex items-start justify-between mb-6 gap-3">
                <div>
                  <h2 className="text-2xl font-bold font-display text-white">{title}</h2>
                  {subtitle && <p className="text-sm text-white/60 mt-1">{subtitle}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {allowLogScale && (
                    <button
                      onClick={() => setScale(s => s === 'linear' ? 'log' : 'linear')}
                      className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-2 border border-white/10"
                    >
                      {scale === 'log' ? <Activity className="w-3.5 h-3.5" /> : <LineIcon className="w-3.5 h-3.5" />}
                      {scale === 'log' ? 'Logarítmica' : 'Lineal'}
                    </button>
                  )}
                  <button
                    onClick={() => setExpanded(false)}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div style={{ minHeight: 500 }}>
                {renderChildren(true)}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function sanitizeForLog(data, keys) {
  return data.map(d => {
    const out = { ...d }
    for (const k of keys) {
      const n = parseFloat(out[k])
      if (!n || n <= 0) out[k] = 1
    }
    return out
  })
}

// Cambio B: dash patterns & dot shapes
const DASH_PATTERNS = ['', '8 4', '3 3', '12 3 3 3', '6 6']
const DOT_SHAPES = [
  (color) => ({ r: 5, fill: color, strokeWidth: 0 }),
  (color) => ({ r: 5, fill: color, strokeWidth: 2, stroke: '#0a0a0a' }),
  (color) => ({ r: 4, fill: '#0a0a0a', strokeWidth: 2, stroke: color }),
]

// ─────────────────────────────────────────────────────────────────────────────
// Cambio A: Smart Y domain — 10% padding below min, 18% above max
// (extra top padding so LabelList "position=top" labels never get clipped)
// ─────────────────────────────────────────────────────────────────────────────
function computeAxisDomain(data, keys) {
  const vals = []
  for (const d of data) {
    for (const k of keys) {
      const v = parseFloat(d[k])
      if (isFinite(v) && v > 0) vals.push(v)
    }
  }
  if (vals.length === 0) return ['auto', 'auto']
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const range = max - min || max * 0.1
  // 10% padding below, 18% above (labels sit above the top dot)
  const lower = Math.max(0, Math.floor(min - range * 0.10))
  const upper = Math.ceil(max + range * 0.18)
  return [lower, upper]
}

// ─────────────────────────────────────────────────────────────────────────────
// Cambio D: Dual-axis grouping by order-of-magnitude
// ─────────────────────────────────────────────────────────────────────────────
function computeDualAxisGroups(data, keys) {
  if (keys.length < 2) return { needsDualAxis: false, primaryKeys: keys, secondaryKeys: [] }

  const avgs = keys.map(k => {
    const vals = data.map(d => parseFloat(d[k])).filter(v => isFinite(v) && v > 0)
    return { key: k, avg: vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0 }
  }).filter(a => a.avg > 0).sort((a, b) => b.avg - a.avg)

  if (avgs.length < 2) return { needsDualAxis: false, primaryKeys: keys, secondaryKeys: [] }

  const topAvg = avgs[0].avg
  const primaryKeys = []
  const secondaryKeys = []

  for (const { key, avg } of avgs) {
    if (topAvg / avg <= 5) primaryKeys.push(key)
    else secondaryKeys.push(key)
  }

  if (secondaryKeys.length === 0) return { needsDualAxis: false, primaryKeys: keys, secondaryKeys: [] }
  return { needsDualAxis: true, primaryKeys, secondaryKeys }
}

// ─────────────────────────────────────────────────────────────────────────────
// Enhanced tooltip
// ─────────────────────────────────────────────────────────────────────────────
function EnhancedTooltip({ active, payload, label, labelFormatter }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'rgba(15,15,25,0.97)',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: 12,
      padding: '12px 16px',
      boxShadow: '0 12px 40px -8px rgba(0,0,0,0.6)',
      minWidth: 160,
    }}>
      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {labelFormatter ? labelFormatter(label) : label}
      </p>
      {payload.map((entry, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: i < payload.length - 1 ? 5 : 0 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
          <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>{entry.name}:</span>
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, marginLeft: 'auto', paddingLeft: 12 }}>
            {formatNumberFull(entry.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TrendLineChart — smart domain + dual axis + patterns (Cambios A, B, D)
// ─────────────────────────────────────────────────────────────────────────────
export function TrendLineChart({ data, lines, height = 280, xKey = 'mes', scale = 'linear', expanded = false }) {
  if (!data?.length) return <NoData />
  const chartData = scale === 'log' ? sanitizeForLog(data, lines.map(l => l.key)) : data
  const h = expanded ? 500 : height
  const keys = lines.map(l => l.key)

  const { needsDualAxis, primaryKeys, secondaryKeys } = scale !== 'log'
    ? computeDualAxisGroups(chartData, keys)
    : { needsDualAxis: false, primaryKeys: keys, secondaryKeys: [] }

  const leftDomain  = scale === 'log' ? [1, 'auto'] : computeAxisDomain(chartData, primaryKeys.length ? primaryKeys : keys)
  const rightDomain = needsDualAxis ? computeAxisDomain(chartData, secondaryKeys) : undefined

  const leftLabel  = needsDualAxis ? primaryKeys.map(k => lines.find(l => l.key === k)?.name || k).join(' · ') : ''
  const rightLabel = needsDualAxis ? secondaryKeys.map(k => lines.find(l => l.key === k)?.name || k).join(' · ') : ''

  return (
    <ResponsiveContainer width="100%" height={h}>
      <LineChart data={chartData} margin={{ top: 30, right: needsDualAxis ? 70 : 24, left: needsDualAxis ? 16 : 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
        <XAxis dataKey={xKey} tickFormatter={formatMonthShort} stroke="rgba(255,255,255,0.5)" tickLine={false} axisLine={false} fontSize={11} />
        <YAxis
          yAxisId="left"
          scale={scale === 'log' ? 'log' : 'auto'}
          domain={leftDomain}
          tickFormatter={formatNumber}
          stroke="rgba(255,255,255,0.4)"
          tickLine={false} axisLine={false}
          width={58} fontSize={11}
          allowDataOverflow={scale === 'log'}
          label={needsDualAxis && leftLabel ? { value: leftLabel, angle: -90, position: 'insideLeft', offset: 10, style: { fill: 'rgba(255,255,255,0.4)', fontSize: 10 } } : undefined}
        />
        {needsDualAxis && (
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={rightDomain}
            tickFormatter={formatNumber}
            stroke="rgba(255,255,255,0.3)"
            tickLine={false} axisLine={false}
            width={58} fontSize={11}
            label={rightLabel ? { value: rightLabel, angle: 90, position: 'insideRight', offset: 10, style: { fill: 'rgba(255,255,255,0.3)', fontSize: 10 } } : undefined}
          />
        )}
        <Tooltip content={<EnhancedTooltip labelFormatter={formatMonthShort} />} cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1 }} />
        <Legend wrapperStyle={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', paddingTop: 8 }} iconType="circle" />
        {lines.map((line, idx) => {
          const isSecondary = needsDualAxis && secondaryKeys.includes(line.key)
          return (
            <Line
              key={line.key}
              yAxisId={isSecondary ? 'right' : 'left'}
              type="monotone"
              dataKey={line.key}
              name={line.name}
              stroke={line.color}
              strokeWidth={2.5}
              strokeDasharray={DASH_PATTERNS[idx % DASH_PATTERNS.length]}
              dot={DOT_SHAPES[idx % DOT_SHAPES.length](line.color)}
              activeDot={{ r: 8, strokeWidth: 2, stroke: line.color, fill: '#0a0a0a' }}
              isAnimationActive animationDuration={1000}
            >
              <LabelList
                dataKey={line.key}
                position="top"
                formatter={formatNumber}
                style={{ fill: line.color, fontSize: 10, fontWeight: 700 }}
              />
            </Line>
          )
        })}
      </LineChart>
    </ResponsiveContainer>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TrendAreaChart
// ─────────────────────────────────────────────────────────────────────────────
export function TrendAreaChart({ data, dataKey, color = '#FF6B00', height = 260, xKey = 'mes', scale = 'linear', expanded = false }) {
  if (!data?.length) return <NoData />
  const chartData = scale === 'log' ? sanitizeForLog(data, [dataKey]) : data
  const h = expanded ? 500 : height
  const domain = scale === 'log' ? [1, 'auto'] : computeAxisDomain(chartData, [dataKey])
  return (
    <ResponsiveContainer width="100%" height={h}>
      <AreaChart data={chartData} margin={{ top: 30, right: 24, left: 8, bottom: 8 }}>
        <defs>
          <linearGradient id={`area-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.55} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
        <XAxis dataKey={xKey} tickFormatter={formatMonthShort} stroke="rgba(255,255,255,0.5)" tickLine={false} axisLine={false} fontSize={11} />
        <YAxis
          scale={scale === 'log' ? 'log' : 'auto'}
          domain={domain}
          tickFormatter={formatNumber}
          stroke="rgba(255,255,255,0.5)"
          tickLine={false} axisLine={false}
          width={55} fontSize={11}
          allowDataOverflow={scale === 'log'}
        />
        <Tooltip content={<EnhancedTooltip labelFormatter={formatMonthShort} />} />
        <Area
          type="monotone" dataKey={dataKey}
          stroke={color} strokeWidth={2.5}
          fill={`url(#area-${dataKey})`}
          isAnimationActive animationDuration={1000}
        >
          <LabelList dataKey={dataKey} position="top" formatter={formatNumber} style={{ fill: '#fff', fontSize: 10, fontWeight: 600 }} />
        </Area>
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ComparisonBarChart
// ─────────────────────────────────────────────────────────────────────────────
export function ComparisonBarChart({ data, bars, height = 280, xKey = 'name', scale = 'linear', expanded = false }) {
  if (!data?.length) return <NoData />
  const chartData = scale === 'log' ? sanitizeForLog(data, bars.map(b => b.key)) : data
  const h = expanded ? 500 : height
  const domain = scale === 'log' ? [1, 'auto'] : computeAxisDomain(chartData, bars.map(b => b.key))
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={chartData} margin={{ top: 30, right: 24, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
        <XAxis dataKey={xKey} stroke="rgba(255,255,255,0.5)" tickLine={false} axisLine={false} fontSize={11} />
        <YAxis
          scale={scale === 'log' ? 'log' : 'auto'}
          domain={domain}
          tickFormatter={formatNumber}
          stroke="rgba(255,255,255,0.5)"
          tickLine={false} axisLine={false}
          width={55} fontSize={11}
          allowDataOverflow={scale === 'log'}
        />
        <Tooltip content={<EnhancedTooltip />} cursor={{ fill: 'rgba(255,255,255,0.06)' }} />
        <Legend wrapperStyle={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', paddingTop: 8 }} iconType="circle" />
        {bars.map((bar) => (
          <Bar key={bar.key} dataKey={bar.key} name={bar.name} fill={bar.color} radius={[8, 8, 0, 0]} maxBarSize={56}>
            <LabelList dataKey={bar.key} position="top" formatter={formatNumber} style={{ fill: bar.color, fontSize: 10, fontWeight: 600 }} />
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ProjectionComboChart — Cambio E
// ─────────────────────────────────────────────────────────────────────────────
function ProjectionTooltip({ active, payload, label, labelFormatter }) {
  if (!active || !payload?.length) return null
  const real = payload.find(p => p.dataKey === 'Real')
  const meta = payload.find(p => p.dataKey === 'Meta')
  const realVal = real?.value || 0
  const metaVal = meta?.value || 0
  const pct = metaVal > 0 ? (realVal / metaVal) * 100 : 0
  const pctColor = pct >= 100 ? '#22c55e' : pct >= 80 ? '#facc15' : '#ef4444'
  return (
    <div style={{ background: 'rgba(15,15,25,0.97)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '12px 16px', boxShadow: '0 12px 40px -8px rgba(0,0,0,0.6)', minWidth: 190 }}>
      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {labelFormatter ? labelFormatter(label) : label}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
        <div style={{ width: 8, height: 8, borderRadius: 2, background: pctColor, flexShrink: 0 }} />
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Real:</span>
        <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, marginLeft: 'auto', paddingLeft: 12 }}>{formatNumberFull(realVal)}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#facc15', flexShrink: 0 }} />
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Meta:</span>
        <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, marginLeft: 'auto', paddingLeft: 12 }}>{formatNumberFull(metaVal)}</span>
      </div>
      {metaVal > 0 && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 6, paddingTop: 6, textAlign: 'center' }}>
          <span style={{ color: pctColor, fontSize: 14, fontWeight: 700 }}>{truncTo(pct, 1)}% cumplimiento</span>
        </div>
      )}
    </div>
  )
}

function AchievementBar(props) {
  const { x, y, width, height: barHeight, payload } = props
  const real = parseFloat(payload?.Real) || 0
  const meta = parseFloat(payload?.Meta) || 0
  const pct = meta > 0 ? (real / meta) * 100 : 0
  const fill = pct >= 100 ? '#22c55e' : pct >= 80 ? '#facc15' : '#ef4444'
  if (barHeight <= 0) return null
  return (
    <g>
      <defs>
        <linearGradient id={`bar-grad-${x}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fill} stopOpacity={0.9} />
          <stop offset="100%" stopColor={fill} stopOpacity={0.5} />
        </linearGradient>
      </defs>
      <rect x={x} y={y} width={width} height={barHeight} fill={`url(#bar-grad-${x})`} rx={6} ry={6} />
    </g>
  )
}

function AchievementLabel(props) {
  const { x, y, width, value, index, data } = props
  if (!data || !data[index]) return null
  const real = parseFloat(data[index].Real) || 0
  const meta = parseFloat(data[index].Meta) || 0
  const pct = meta > 0 ? (real / meta) * 100 : 0
  const color = pct >= 100 ? '#22c55e' : pct >= 80 ? '#facc15' : '#ef4444'
  return (
    <g>
      <text x={x + width / 2} y={y - 18} textAnchor="middle" fill="#fff" fontSize={11} fontWeight={600}>{formatNumber(value)}</text>
      {meta > 0 && <text x={x + width / 2} y={y - 5} textAnchor="middle" fill={color} fontSize={10} fontWeight={700}>{truncTo(pct, 0)}%</text>}
    </g>
  )
}

export function ProjectionComboChart({ data, color = '#22c55e', height = 300, xKey = 'mes', scale = 'linear', expanded = false }) {
  if (!data?.length) return <NoData />
  const h = expanded ? 500 : height
  const chartData = scale === 'log' ? sanitizeForLog(data, ['Real', 'Meta']) : data
  const allVals = data.flatMap(d => [parseFloat(d.Real), parseFloat(d.Meta)]).filter(v => isFinite(v) && v > 0)
  const dataMin = allVals.length > 0 ? Math.min(...allVals) : 0
  const dataMax = allVals.length > 0 ? Math.max(...allVals) : 100
  const padding = (dataMax - dataMin) * 0.15 || dataMax * 0.1
  const domain = scale === 'log' ? [1, 'auto'] : [Math.max(0, Math.floor(dataMin - padding)), Math.ceil(dataMax + padding)]
  return (
    <ResponsiveContainer width="100%" height={h}>
      <ComposedChart data={chartData} margin={{ top: 40, right: 24, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
        <XAxis dataKey={xKey} tickFormatter={formatMonthShort} stroke="rgba(255,255,255,0.5)" tickLine={false} axisLine={false} fontSize={11} />
        <YAxis scale={scale === 'log' ? 'log' : 'auto'} domain={domain} tickFormatter={formatNumber} stroke="rgba(255,255,255,0.5)" tickLine={false} axisLine={false} width={55} fontSize={11} />
        <Tooltip content={<ProjectionTooltip labelFormatter={formatMonthShort} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Legend wrapperStyle={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', paddingTop: 8 }} payload={[{ value: 'Real', type: 'rect', color: '#22c55e' }, { value: 'Meta', type: 'line', color: '#facc15' }]} />
        <Bar dataKey="Real" name="Real" maxBarSize={52} shape={<AchievementBar />} isAnimationActive animationDuration={800}>
          <LabelList dataKey="Real" position="top" content={<AchievementLabel data={chartData} />} />
        </Bar>
        <Line type="monotone" dataKey="Meta" name="Meta" stroke="#facc15" strokeWidth={2.5} strokeDasharray="8 4" dot={{ r: 4, fill: '#facc15', strokeWidth: 0 }} activeDot={{ r: 7, strokeWidth: 2, stroke: '#facc15', fill: '#0a0a0a' }} isAnimationActive animationDuration={1000}>
          <LabelList dataKey="Meta" position="bottom" formatter={formatNumber} style={{ fill: '#facc15', fontSize: 10, fontWeight: 600 }} />
        </Line>
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DistributionDonut — colores por segmento, etiquetas siempre visibles
// ─────────────────────────────────────────────────────────────────────────────

// Custom label renderizado con el color del segmento correspondiente
function DonutLabel({ cx, cy, midAngle, innerRadius, outerRadius, name, percent, fill }) {
  const RADIAN = Math.PI / 180
  // Posiciona la etiqueta fuera del arco
  const radius = outerRadius + 28
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  if (percent < 0.04) return null // oculta segmentos muy pequeños (<4%)
  return (
    <text
      x={x} y={y}
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fill={fill}
      fontSize={11}
      fontWeight={700}
    >
      {`${name}: ${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

// Tooltip enriquecido para dona
function DonutTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  return (
    <div style={{ background: 'rgba(15,15,25,0.97)', border: `1px solid ${entry.payload.color}55`, borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 24px -4px rgba(0,0,0,0.5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: entry.payload.color }} />
        <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{entry.name}</span>
      </div>
      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4 }}>
        {formatNumberFull(entry.value)} · {(entry.payload.percent * 100).toFixed(1)}%
      </p>
    </div>
  )
}

export function DistributionDonut({ data, height = 260, centerLabel, centerValue, expanded = false }) {
  if (!data?.length) return <NoData />
  const h = expanded ? 400 : height

  // Calcular percent para cada entrada (necesario para el tooltip y label)
  const total = data.reduce((s, d) => s + d.value, 0)
  const dataWithPercent = data.map(d => ({ ...d, percent: total > 0 ? d.value / total : 0 }))

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={h}>
        <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <Pie
            data={dataWithPercent}
            innerRadius="52%"
            outerRadius="72%"
            paddingAngle={3}
            dataKey="value"
            isAnimationActive
            animationDuration={900}
            labelLine={false}
            label={<DonutLabel />}
          >
            {dataWithPercent.map((entry, idx) => (
              <Cell key={idx} fill={entry.color} stroke="rgba(0,0,0,0.3)" strokeWidth={1} />
            ))}
          </Pie>
          <Tooltip content={<DonutTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {centerValue !== undefined && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ height: h }}>
          <p className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">{centerLabel}</p>
          <p className="text-2xl font-bold font-display text-white">{centerValue}</p>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        {dataWithPercent.map((entry, idx) => (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: entry.color }} />
            <span className="text-white/65 truncate">{entry.name}</span>
            <span className="ml-auto text-white font-mono font-semibold">{formatNumber(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function NoData() {
  return (
    <div className="h-40 flex items-center justify-center">
      <p className="text-white/30 text-sm">Sin datos para graficar</p>
    </div>
  )
}
