import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList,
} from 'recharts'
import { Maximize2, X, LineChart as LineIcon, Activity } from 'lucide-react'
import { formatNumber, formatMonthShort } from '../../utils/format'

// ─────────────────────────────────────────────────────────────────────────────
// Chart card — wraps any chart with title/subtitle + optional expand-to-modal
// and a linear/log scale toggle. Children get (scale) as a render prop.
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
// Recharts complains if log scale receives zero — sanitize to 1
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

// ─────────────────────────────────────────────────────────────────────────────
// Multi-line trend (seguidores, etc.) — labels ALWAYS visible
// ─────────────────────────────────────────────────────────────────────────────
export function TrendLineChart({ data, lines, height = 280, xKey = 'mes', scale = 'linear', expanded = false }) {
  if (!data?.length) return <NoData />
  const chartData = scale === 'log' ? sanitizeForLog(data, lines.map(l => l.key)) : data
  const h = expanded ? 500 : height

  return (
    <ResponsiveContainer width="100%" height={h}>
      <LineChart data={chartData} margin={{ top: 30, right: 24, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
        <XAxis dataKey={xKey} tickFormatter={formatMonthShort} stroke="rgba(255,255,255,0.5)" tickLine={false} axisLine={false} fontSize={11} />
        <YAxis
          scale={scale === 'log' ? 'log' : 'auto'}
          domain={scale === 'log' ? [1, 'auto'] : ['auto', 'auto']}
          tickFormatter={formatNumber}
          stroke="rgba(255,255,255,0.5)"
          tickLine={false}
          axisLine={false}
          width={55}
          fontSize={11}
          allowDataOverflow={scale === 'log'}
        />
        <Tooltip
          contentStyle={{ background: 'rgba(15,15,25,0.95)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, fontSize: 12 }}
          formatter={(v) => formatNumber(v)}
          labelFormatter={formatMonthShort}
          cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1 }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', paddingTop: 8 }} iconType="circle" />
        {lines.map((line) => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            name={line.name}
            stroke={line.color}
            strokeWidth={2.5}
            dot={{ r: 4, fill: line.color, strokeWidth: 0 }}
            activeDot={{ r: 7, strokeWidth: 2, stroke: line.color, fill: '#0a0a0a' }}
            isAnimationActive
            animationDuration={1000}
          >
            <LabelList
              dataKey={line.key}
              position="top"
              formatter={formatNumber}
              style={{ fill: line.color, fontSize: 10, fontWeight: 600 }}
            />
          </Line>
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Area chart
// ─────────────────────────────────────────────────────────────────────────────
export function TrendAreaChart({ data, dataKey, color = '#FF6B00', height = 260, xKey = 'mes', scale = 'linear', expanded = false }) {
  if (!data?.length) return <NoData />
  const chartData = scale === 'log' ? sanitizeForLog(data, [dataKey]) : data
  const h = expanded ? 500 : height
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
          domain={scale === 'log' ? [1, 'auto'] : ['auto', 'auto']}
          tickFormatter={formatNumber}
          stroke="rgba(255,255,255,0.5)"
          tickLine={false}
          axisLine={false}
          width={55}
          fontSize={11}
          allowDataOverflow={scale === 'log'}
        />
        <Tooltip
          contentStyle={{ background: 'rgba(15,15,25,0.95)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, fontSize: 12 }}
          formatter={(v) => formatNumber(v)}
          labelFormatter={formatMonthShort}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2.5}
          fill={`url(#area-${dataKey})`}
          isAnimationActive
          animationDuration={1000}
        >
          <LabelList dataKey={dataKey} position="top" formatter={formatNumber} style={{ fill: '#fff', fontSize: 10, fontWeight: 600 }} />
        </Area>
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Comparison bar chart
// ─────────────────────────────────────────────────────────────────────────────
export function ComparisonBarChart({ data, bars, height = 280, xKey = 'name', scale = 'linear', expanded = false }) {
  if (!data?.length) return <NoData />
  const chartData = scale === 'log' ? sanitizeForLog(data, bars.map(b => b.key)) : data
  const h = expanded ? 500 : height
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={chartData} margin={{ top: 30, right: 24, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
        <XAxis dataKey={xKey} stroke="rgba(255,255,255,0.5)" tickLine={false} axisLine={false} fontSize={11} />
        <YAxis
          scale={scale === 'log' ? 'log' : 'auto'}
          domain={scale === 'log' ? [1, 'auto'] : ['auto', 'auto']}
          tickFormatter={formatNumber}
          stroke="rgba(255,255,255,0.5)"
          tickLine={false}
          axisLine={false}
          width={55}
          fontSize={11}
          allowDataOverflow={scale === 'log'}
        />
        <Tooltip
          contentStyle={{ background: 'rgba(15,15,25,0.95)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, fontSize: 12 }}
          formatter={(v) => formatNumber(v)}
          cursor={{ fill: 'rgba(255,255,255,0.06)' }}
        />
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
// Donut (distribution — log scale not applicable)
// ─────────────────────────────────────────────────────────────────────────────
export function DistributionDonut({ data, height = 260, centerLabel, centerValue, expanded = false }) {
  if (!data?.length) return <NoData />
  const h = expanded ? 400 : height
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={h}>
        <PieChart>
          <Pie
            data={data}
            innerRadius="58%"
            outerRadius="88%"
            paddingAngle={3}
            dataKey="value"
            isAnimationActive
            animationDuration={900}
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
            style={{ fontSize: 11, fontWeight: 600, fill: '#fff' }}
          >
            {data.map((entry, idx) => (
              <Cell key={idx} fill={entry.color} stroke="none" />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: 'rgba(15,15,25,0.95)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, fontSize: 12 }}
            formatter={(v) => formatNumber(v)}
          />
        </PieChart>
      </ResponsiveContainer>
      {centerValue !== undefined && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ height: h }}>
          <p className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">{centerLabel}</p>
          <p className="text-2xl font-bold font-display text-white">{centerValue}</p>
        </div>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {data.map((entry, idx) => (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: entry.color }} />
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
