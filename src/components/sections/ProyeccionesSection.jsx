import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Target, ChevronLeft, ChevronRight, TrendingUp, CheckCircle2, AlertCircle, XCircle } from 'lucide-react'
import { SectionHeader, EmptyState } from '../ui/SectionHeader'
import { ProjectionComboChart } from '../ui/Charts'
import { safeNumber, formatNumber, formatNumberFull, formatMonthShort, truncTo } from '../../utils/format'
import { tipoCampanaToBucket, bucketToLabel } from '../../utils/campaigns'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const ACCENT = '#22c55e'

const PLATFORM_CONFIG = {
  facebook:  { label: 'Facebook Ads',  color: '#3b82f6', bg: '#1877F2' },
  instagram: { label: 'Instagram Ads', color: '#f97316', bg: '#E1306C' },
  tiktok:    { label: 'TikTok Ads',    color: '#a855f7', bg: '#000000' },
  google:    { label: 'Google Ads',    color: '#f59e0b', bg: '#4285F4' },
  total:     { label: 'Total',         color: '#22c55e', bg: '#22c55e' },
}

const PLATFORM_ORDER = ['facebook', 'instagram', 'tiktok', 'google']

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const normPlat = s => String(s || '').toLowerCase().trim()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')

// Derives agrupaciones from rows — same logic as PaidMediaSection / getGroups
function getGroups(rows) {
  const seen = new Map()
  for (const r of rows) {
    const tipo = r.tipo_campana || 'AON'
    const key  = tipoCampanaToBucket(tipo)
    if (!seen.has(key)) seen.set(key, tipo)
  }
  const order = ['mensual', ...([...seen.keys()].filter(k => k !== 'mensual').sort())]
  return order.filter(k => seen.has(k)).map(k => ({
    key: k,
    label: bucketToLabel(k, seen.get(k)),
  }))
}

function getComplianceColor(pct) {
  if (pct >= 100) return '#22c55e'
  if (pct >= 80)  return '#facc15'
  return '#ef4444'
}

function computePct(real, meta) {
  const r = safeNumber(real)
  const m = safeNumber(meta)
  if (!m) return null
  return (r / m) * 100
}

// ─────────────────────────────────────────────────────────────────────────────
// Platform SVG icons
// ─────────────────────────────────────────────────────────────────────────────
function PlatformIcon({ platform, size = 20 }) {
  const p = normPlat(platform)
  if (p === 'facebook') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  )
  if (p === 'instagram') return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <defs>
        <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f09433"/>
          <stop offset="25%" stopColor="#e6683c"/>
          <stop offset="50%" stopColor="#dc2743"/>
          <stop offset="75%" stopColor="#cc2366"/>
          <stop offset="100%" stopColor="#bc1888"/>
        </linearGradient>
      </defs>
      <path fill="url(#ig-grad)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  )
  if (p === 'tiktok') return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path fill="#ffffff" d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/>
    </svg>
  )
  if (p === 'google') return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
  return <Target size={size} color="#ffffff" />
}

// ─────────────────────────────────────────────────────────────────────────────
// ComplianceCard — used when only 1 month of data
// ─────────────────────────────────────────────────────────────────────────────
function ComplianceCard({ metrica, real, meta, observacion }) {
  const pct = computePct(real, meta)
  const hasMeta = safeNumber(meta) > 0
  const color = pct !== null ? getComplianceColor(pct) : 'rgba(255,255,255,0.4)'

  const Icon = pct === null ? null
    : pct >= 100 ? CheckCircle2
    : pct >= 80  ? AlertCircle
    : XCircle

  return (
    <div className="flex flex-col gap-4 p-2">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs text-white/50 uppercase tracking-wider mb-1">{metrica}</p>
          <p className="text-3xl font-bold font-display text-white">{formatNumberFull(real)}</p>
          {hasMeta && (
            <p className="text-xs text-white/50 mt-1">
              Meta: <span className="text-white/70 font-semibold">{formatNumberFull(meta)}</span>
            </p>
          )}
        </div>

        {hasMeta && pct !== null && (
          <div className="flex flex-col items-center gap-1">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center border-4"
              style={{ borderColor: color, background: `${color}18` }}
            >
              <span className="text-lg font-bold" style={{ color }}>
                {truncTo(pct, 0)}%
              </span>
            </div>
            {Icon && <Icon className="w-4 h-4" style={{ color }} />}
          </div>
        )}

        {!hasMeta && (
          <span className="text-xs px-2 py-1 rounded-full text-white/40 border border-white/10">
            Solo resultados
          </span>
        )}
      </div>

      {hasMeta && pct !== null && (
        <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.min(pct, 100)}%`,
              background: color,
            }}
          />
        </div>
      )}

      {observacion && (
        <p className="text-xs text-white/50 italic border-l-2 pl-3" style={{ borderColor: color + '66' }}>
          {observacion}
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MetricSlide — adaptive: 1 month = card, 2+ months = combo chart
// ─────────────────────────────────────────────────────────────────────────────
function MetricSlide({ metricRows, color, selectedMonth }) {
  // metricRows: array of { mes, meta, real, observacion } sorted by mes, filtered by group
  // Filter out rows with no data at all
  const validRows = metricRows.filter(r => safeNumber(r.real) > 0 || safeNumber(r.meta) > 0)

  if (validRows.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-white/30 text-sm">
        Sin datos registrados
      </div>
    )
  }

  const metrica = validRows[0]?.metrica || validRows[0]?.objetivo || '—'
  const hasMeta = validRows.some(r => safeNumber(r.meta) > 0)

  // Current month row for the card summary
  const currentRow = validRows.find(r => r.mes === selectedMonth) || validRows[validRows.length - 1]

  if (validRows.length === 1) {
    return (
      <ComplianceCard
        metrica={metrica}
        real={currentRow?.real}
        meta={currentRow?.meta}
        observacion={currentRow?.observacion}
      />
    )
  }

  // 2+ months: use ProjectionComboChart
  const chartData = validRows.map(r => ({
    mes: r.mes,
    Real: safeNumber(r.real),
    Meta: safeNumber(r.meta),
  }))

  return (
    <div>
      <div className="flex items-center justify-between mb-3 px-1">
        <div>
          <p className="text-sm font-semibold text-white">{metrica}</p>
          {!hasMeta && (
            <span className="text-[10px] px-1.5 py-0.5 rounded text-white/40 border border-white/10 mt-1 inline-block">
              Solo resultados
            </span>
          )}
        </div>
        {hasMeta && currentRow && (() => {
          const pct = computePct(currentRow.real, currentRow.meta)
          if (pct === null) return null
          const c = getComplianceColor(pct)
          return (
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: `${c}22`, color: c, border: `1px solid ${c}44` }}
            >
              {truncTo(pct, 0)}% este mes
            </span>
          )
        })()}
      </div>
      <ProjectionComboChart
        data={chartData}
        color={color}
        height={240}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MetricCarousel — horizontal scroll-snap carousel
// ─────────────────────────────────────────────────────────────────────────────
function MetricCarousel({ metrics, color, selectedMonth }) {
  const [index, setIndex] = useState(0)
  const scrollRef = useRef(null)

  // Reset index when metrics change (group/objective changed)
  useEffect(() => { setIndex(0) }, [metrics])

  const scrollTo = useCallback((i) => {
    const el = scrollRef.current
    if (!el) return
    const child = el.children[i]
    if (child) child.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
    setIndex(i)
  }, [])

  const prev = () => scrollTo(Math.max(0, index - 1))
  const next = () => scrollTo(Math.min(metrics.length - 1, index + 1))

  if (metrics.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-white/30 text-sm">
        Sin métricas para esta selección
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Carousel viewport */}
      <div className="relative">
        {/* Prev arrow */}
        {metrics.length > 1 && index > 0 && (
          <button
            onClick={prev}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10
                       w-7 h-7 rounded-full glass-strong flex items-center justify-center
                       text-white/70 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}

        {/* Scroll container */}
        <div
          ref={scrollRef}
          className="proyecciones-carousel overflow-x-auto flex snap-x snap-mandatory"
          onScroll={(e) => {
            const el = e.currentTarget
            const w = el.clientWidth
            const i = Math.round(el.scrollLeft / w)
            if (i !== index) setIndex(i)
          }}
        >
          {metrics.map((m, i) => (
            <div key={i} className="proyecciones-slide snap-start flex-shrink-0 w-full px-1">
              <MetricSlide
                metricRows={m.rows}
                color={color}
                selectedMonth={selectedMonth}
              />
            </div>
          ))}
        </div>

        {/* Next arrow */}
        {metrics.length > 1 && index < metrics.length - 1 && (
          <button
            onClick={next}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10
                       w-7 h-7 rounded-full glass-strong flex items-center justify-center
                       text-white/70 hover:text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dots */}
      {metrics.length > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {metrics.map((m, i) => (
            <button
              key={i}
              onClick={() => scrollTo(i)}
              className="transition-all duration-200 rounded-full"
              style={{
                width:  i === index ? 20 : 6,
                height: 6,
                background: i === index ? color : 'rgba(255,255,255,0.2)',
              }}
              title={m.key}
            />
          ))}
        </div>
      )}

      {/* Metric name pills — quick jump */}
      {metrics.length > 1 && (
        <div className="flex flex-wrap gap-1.5 justify-center">
          {metrics.map((m, i) => (
            <button
              key={i}
              onClick={() => scrollTo(i)}
              className="text-[10px] px-2 py-0.5 rounded-full transition-all"
              style={{
                background: i === index ? `${color}22` : 'rgba(255,255,255,0.05)',
                color:      i === index ? color : 'rgba(255,255,255,0.4)',
                border:     `1px solid ${i === index ? color + '44' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              {m.key}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PlatformCard — one card per platform
// ─────────────────────────────────────────────────────────────────────────────
function PlatformCard({ platform, allRows, selectedMonth, syncedObjective, onObjectiveChange }) {
  const cfg = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.total
  const color = cfg.color

  // All rows for this platform (all months, all groups)
  const platRows = useMemo(
    () => allRows.filter(r => normPlat(r.plataforma) === platform),
    [allRows, platform]
  )

  // Groups available (same logic as PaidMediaSection)
  const groups = useMemo(() => getGroups(platRows), [platRows])

  const [selectedGroup, setSelectedGroup] = useState(() => groups[0]?.key || 'mensual')
  const [localObjective, setLocalObjective] = useState(null)

  // Keep selectedGroup valid when groups change
  useEffect(() => {
    if (groups.length > 0 && !groups.some(g => g.key === selectedGroup)) {
      setSelectedGroup(groups[0].key)
    }
  }, [groups, selectedGroup])

  // Rows for selected group (all months)
  const groupRows = useMemo(
    () => platRows.filter(r => tipoCampanaToBucket(r.tipo_campana || 'AON') === selectedGroup),
    [platRows, selectedGroup]
  )

  // Available objectives in this group
  const objectives = useMemo(() => {
    const seen = new Set()
    return groupRows
      .map(r => r.objetivo || r.metrica || '')
      .filter(o => o && !seen.has(o) && seen.add(o))
  }, [groupRows])

  // Resolve active objective: synced (if valid) > local > first available
  const activeObjective = useMemo(() => {
    if (syncedObjective && objectives.includes(syncedObjective)) return syncedObjective
    if (localObjective && objectives.includes(localObjective)) return localObjective
    return objectives[0] || null
  }, [syncedObjective, localObjective, objectives])

  const syncedButUnavailable = syncedObjective && !objectives.includes(syncedObjective)

  // Metrics for active objective
  const metrics = useMemo(() => {
    if (!activeObjective) return []
    const rows = groupRows.filter(r =>
      (r.objetivo || r.metrica || '') === activeObjective
    )
    // Group by metrica
    const map = new Map()
    for (const r of rows) {
      const key = r.metrica || r.objetivo || '—'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(r)
    }
    return Array.from(map.entries()).map(([key, rows]) => ({
      key,
      rows: rows.sort((a, b) => String(a.mes).localeCompare(String(b.mes))),
    }))
  }, [groupRows, activeObjective])

  const handleObjectiveChange = (obj) => {
    setLocalObjective(obj)
    onObjectiveChange?.(obj)
  }

  if (platRows.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-card rounded-2xl overflow-hidden"
      style={{ borderColor: `${color}33` }}
    >
      {/* Platform header */}
      <div
        className="flex items-center gap-3 px-5 py-4 border-b border-white/10"
        style={{ background: `${color}12` }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: cfg.bg + '33', border: `1px solid ${color}44` }}
        >
          <PlatformIcon platform={platform} size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-white">{cfg.label}</h3>
          {syncedButUnavailable && (
            <p className="text-[10px] text-yellow-400/80 mt-0.5">
              Objetivo "{syncedObjective}" no disponible — mostrando: {activeObjective}
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
          {/* Group dropdown */}
          {groups.length > 1 && (
            <select
              value={selectedGroup}
              onChange={e => setSelectedGroup(e.target.value)}
              className="proyecciones-select"
              style={{ '--accent': color }}
            >
              {groups.map(g => (
                <option key={g.key} value={g.key}>{g.label}</option>
              ))}
            </select>
          )}

          {/* Objective dropdown */}
          {objectives.length > 1 && (
            <select
              value={activeObjective || ''}
              onChange={e => handleObjectiveChange(e.target.value)}
              className="proyecciones-select"
              style={{ '--accent': color }}
            >
              {objectives.map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          )}

          {objectives.length === 1 && activeObjective && (
            <span
              className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
            >
              {activeObjective}
            </span>
          )}
        </div>
      </div>

      {/* Carousel */}
      <div className="p-5">
        <MetricCarousel
          metrics={metrics}
          color={color}
          selectedMonth={selectedMonth}
        />
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────
function ProyeccionesSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="glass-card rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
            <div className="w-9 h-9 rounded-xl skeleton" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-28 rounded skeleton" />
              <div className="h-2.5 w-20 rounded skeleton" />
            </div>
            <div className="h-8 w-24 rounded-lg skeleton" />
          </div>
          <div className="p-5">
            <div className="h-56 rounded-xl skeleton" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ProyeccionesSection — main export
// Props interface kept identical to Dashboard.jsx expectations, plus
// allData (all months, unfiltered) and selectedMonth added.
// ─────────────────────────────────────────────────────────────────────────────
export function ProyeccionesSection({
  data = [],        // filtered to current month (from useDateFilter)
  allData = [],     // all months unfiltered (for historical charts)
  selectedMonth,
  loading,
  theme,
  // legacy props — accepted but not used in new design
  bucket, setBucket, availableBuckets, campanas, observaciones,
}) {
  const [syncedObjective, setSyncedObjective] = useState(null)
  const [syncActive, setSyncActive] = useState(false)

  const handleObjectiveChange = useCallback((obj) => {
    if (syncActive) setSyncedObjective(obj)
  }, [syncActive])

  const toggleSync = () => {
    setSyncActive(v => !v)
    if (syncActive) setSyncedObjective(null)
  }

  // Use allData for historical charts when available, fall back to data
  const sourceRows = allData.length > 0 ? allData : data

  // Detect platforms present in data (ordered)
  const platforms = useMemo(() => {
    const present = new Set(sourceRows.map(r => normPlat(r.plataforma)).filter(Boolean))
    return PLATFORM_ORDER.filter(p => present.has(p))
  }, [sourceRows])

  if (loading) return <ProyeccionesSkeleton />

  if (!data || data.length === 0) {
    return (
      <div className="space-y-6">
        <SectionHeader
          icon={TrendingUp}
          title="Proyecciones"
          subtitle="Metas vs resultados"
          accentColor={ACCENT}
        />
        <EmptyState
          icon={Target}
          title="Sin proyecciones registradas"
          message="Agrega filas a la hoja 'Proyecciones' con marca, mes, plataforma, métrica y meta."
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <SectionHeader
          icon={TrendingUp}
          title="Proyecciones"
          subtitle={selectedMonth ? `Metas vs resultados — ${formatMonthShort(selectedMonth)}` : 'Metas vs resultados'}
          accentColor={ACCENT}
        />

        {/* Sync toggle */}
        <button
          onClick={toggleSync}
          className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl transition-all"
          style={{
            background: syncActive ? `${ACCENT}22` : 'rgba(255,255,255,0.06)',
            border: `1px solid ${syncActive ? ACCENT + '55' : 'rgba(255,255,255,0.10)'}`,
            color: syncActive ? ACCENT : 'rgba(255,255,255,0.5)',
          }}
        >
          <span
            className="w-3 h-3 rounded-sm border flex-shrink-0 flex items-center justify-center"
            style={{ borderColor: syncActive ? ACCENT : 'currentColor' }}
          >
            {syncActive && <span className="w-1.5 h-1.5 rounded-sm" style={{ background: ACCENT }} />}
          </span>
          Sincronizar objetivos
        </button>
      </div>

      {/* Platform cards stack */}
      <div className="space-y-4">
        {platforms.length > 0 ? (
          platforms.map(platform => (
            <PlatformCard
              key={platform}
              platform={platform}
              allRows={sourceRows}
              selectedMonth={selectedMonth}
              syncedObjective={syncActive ? syncedObjective : null}
              onObjectiveChange={handleObjectiveChange}
            />
          ))
        ) : (
          <div className="glass-card rounded-2xl p-8 text-center">
            <Target className="w-10 h-10 text-white/20 mx-auto mb-3" />
            <p className="text-white/50 text-sm">Sin plataformas con datos para este periodo</p>
          </div>
        )}
      </div>
    </div>
  )
}
