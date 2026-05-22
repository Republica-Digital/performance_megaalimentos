import { useMemo } from 'react'
import { Megaphone, Eye, MousePointerClick, DollarSign, TrendingUp, Film, Target } from 'lucide-react'
import { KPICard, KPICardSkeleton } from '../ui/KPICard'
import { SectionHeader, EmptyState } from '../ui/SectionHeader'
import { ChartCard, DistributionDonut } from '../ui/Charts'
import { ObservacionesButton } from '../ui/ObservacionesCard'
import { DataTable } from '../ui/DataTable'
import { safeNumber, formatNumber, formatCurrency, formatDecimal, truncTo } from '../../utils/format'
import { getGoogleObjective } from '../../utils/campaigns'

const ACCENT = '#f59e0b'

// Classify each row as 'Video' or 'Display' (accepts both tipo_red and tipo_objetivo)
function classifyRow(row) {
  const tipoValue = row.tipo_objetivo || row.tipo_red
  const obj = getGoogleObjective(tipoValue)
  return { ...row, _obj: obj || tipoValue || '—' }
}

// For Display rows the "result" metric shown is impresiones_visibles.
// For Video rows it's views (visualizaciones). CPR = inversion / resultado.
function getRowResult(row) {
  if (row._obj === 'Display') return safeNumber(row.impresiones_visibles) || safeNumber(row.impresiones)
  if (row._obj === 'Video')   return safeNumber(row.views)
  return safeNumber(row.impresiones)
}
function getResultLabel(obj) {
  if (obj === 'Display') return 'Impresiones visibles'
  if (obj === 'Video')   return 'Visualizaciones'
  return 'Resultado'
}

export function GoogleAdsSection({ data = [], ciudades = [], keywords = [], proyecciones = [], selectedMonth, observaciones, loading }) {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <KPICardSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  if (!data?.length) {
    return (
      <div className="space-y-6">
        <SectionHeader icon={Megaphone} title="Google Ads" subtitle="Sin datos para este mes" accentColor={ACCENT} />
        <EmptyState icon={Megaphone} title="Sin datos disponibles" message="No hay campañas de Google Ads en este mes." />
      </div>
    )
  }

  const rows = data.map(classifyRow)

  // ── Aggregate KPIs (totals across all campaigns for the month) ─────────────
  const displayRows = rows.filter(r => r._obj === 'Display')
  const videoRows = rows.filter(r => r._obj === 'Video')

  const totals = rows.reduce((acc, r) => ({
    views:                acc.views               + safeNumber(r.views) + safeNumber(r.visualizaciones),
    clics:                acc.clics               + safeNumber(r.clics),
    impresiones_visibles: acc.impresiones_visibles + safeNumber(r.impresiones_visibles),
    inversion:            acc.inversion           + safeNumber(r.inversion),
  }), { views: 0, clics: 0, impresiones_visibles: 0, inversion: 0 })

  // CTR = clics / impresiones_visibles — only for Display
  const displayImpr = displayRows.reduce((s, r) => s + safeNumber(r.impresiones_visibles), 0)
  const displayClics = displayRows.reduce((s, r) => s + safeNumber(r.clics), 0)
  const ctr = displayImpr > 0 ? (displayClics / displayImpr) * 100 : 0

  // CVR (View Rate) = visualizaciones / impresiones_visibles — only for Video
  const videoImpr = videoRows.reduce((s, r) => s + safeNumber(r.impresiones_visibles), 0)
  const videoViews = videoRows.reduce((s, r) => s + safeNumber(r.views) + safeNumber(r.visualizaciones), 0)
  const cvr = videoImpr > 0 ? (videoViews / videoImpr) * 100 : 0

  // Donut distribution by objective
  const byObjective = {}
  rows.forEach(r => {
    byObjective[r._obj] = (byObjective[r._obj] || 0) + safeNumber(r.inversion)
  })
  const OBJ_COLORS = { Video: '#ef4444', Display: '#3b82f6', Search: '#22c55e' }
  const distribution = Object.entries(byObjective)
    .filter(([, v]) => v > 0)
    .map(([name, value], i) => ({
      name, value,
      color: OBJ_COLORS[name] || ['#a78bfa', '#22d3ee', '#f59e0b'][i % 3],
    }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <SectionHeader icon={Megaphone} title="Google Ads" subtitle="Performance de campañas pagadas" accentColor={ACCENT} />
        <ObservacionesButton observaciones={observaciones} accentColor={ACCENT} />
      </div>

      {/* KPI overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Imp. Visibles"  value={totals.impresiones_visibles} icon={Eye}              accentColor="#a78bfa" delay={0} />
        <KPICard title="Clics Totales"  value={totals.clics}                icon={MousePointerClick} accentColor="#3b82f6" delay={1} />
        <KPICard title="CTR% (Display)" value={truncTo(ctr, 2)} suffix="%"  icon={TrendingUp}       accentColor="#22c55e" formatter={v => v} delay={2} />
        <KPICard title="CVR% (Video)"   value={truncTo(cvr, 2)} suffix="%"  icon={Film}             accentColor="#ef4444" formatter={v => v} delay={3} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {distribution.length > 0 && (
          <ChartCard title="Inversión por Objetivo" subtitle="Distribución del presupuesto" allowLogScale={false}>
            {({ expanded }) => (
              <DistributionDonut
                data={distribution}
                centerLabel="Total"
                centerValue={formatCurrency(totals.inversion)}
                expanded={expanded}
              />
            )}
          </ChartCard>
        )}

        <ChartCard
          title="Desglose por Objetivo"
          subtitle="Una fila por objetivo (Video / Display)"
          className={distribution.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}
          allowLogScale={false}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-white/10">
                  <th className="py-2 px-3 text-[11px] uppercase tracking-wider text-white/55 font-semibold">Objetivo</th>
                  <th className="py-2 px-3 text-[11px] uppercase tracking-wider text-white/55 font-semibold text-right">Resultado</th>
                  <th className="py-2 px-3 text-[11px] uppercase tracking-wider text-white/55 font-semibold text-right">CPR</th>
                  <th className="py-2 px-3 text-[11px] uppercase tracking-wider text-white/55 font-semibold text-right">CTR / CVR</th>
                  <th className="py-2 px-3 text-[11px] uppercase tracking-wider text-white/55 font-semibold text-right">Inversión</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const result = getRowResult(r)
                  const cpr = result > 0 ? safeNumber(r.inversion) / result : 0
                  const isVideo = r._obj === 'Video'
                  const rateValue = isVideo ? safeNumber(r.cvr) : safeNumber(r.ctr)
                  const rateLabel = isVideo ? 'CVR' : 'CTR'
                  const resultLabel = getResultLabel(r._obj)
                  return (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          {r._obj === 'Video' ? (
                            <Film className="w-4 h-4 text-red-400" />
                          ) : (
                            <Eye className="w-4 h-4 text-blue-400" />
                          )}
                          <span className="text-sm font-semibold text-white">{r._obj}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="text-sm font-mono font-semibold text-white">{formatNumber(result)}</div>
                        <div className="text-[10px] text-white/45 mt-0.5">{resultLabel}</div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="text-sm font-mono text-white/90">${formatDecimal(cpr, 2)}</div>
                        <div className="text-[10px] text-white/45 mt-0.5">por resultado</div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {rateValue > 0 ? (
                          <>
                            <div className="text-sm font-mono text-emerald-300">{truncTo(rateValue, 2)}%</div>
                            <div className="text-[10px] text-white/45 mt-0.5">{rateLabel}</div>
                          </>
                        ) : (
                          <span className="text-white/30 text-sm">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="text-sm font-mono text-amber-300 font-semibold">{formatCurrency(r.inversion)}</div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>

      {/* Top cities (kept for completeness) */}
      {ciudades.length > 0 && (
        <ChartCard title="Top Ciudades" subtitle="Concentración geográfica" allowLogScale={false}>
          <DataTable
            columns={[
              { key: 'ciudad',      label: 'Ciudad',      bold: true },
              { key: 'tipo_red',    label: 'Objetivo' },
              { key: 'impresiones', label: 'Impresiones', align: 'right', render: v => formatNumber(v) },
              { key: 'clics',       label: 'Clics',       align: 'right', render: v => formatNumber(v) },
              { key: 'inversion',   label: 'Inversión',   align: 'right', render: v => formatCurrency(v) },
            ]}
            data={ciudades}
          />
        </ChartCard>
      )}

      {keywords.length > 0 && (
        <ChartCard title="Top Keywords" subtitle="Términos de mayor performance" allowLogScale={false}>
          <DataTable
            columns={[
              { key: 'keyword',     label: 'Keyword',     bold: true },
              { key: 'impresiones', label: 'Impresiones', align: 'right', render: v => formatNumber(v) },
              { key: 'clics',       label: 'Clics',       align: 'right', render: v => formatNumber(v) },
              { key: 'ctr',         label: 'CTR',         align: 'right', render: v => v ? `${formatDecimal(v, 2)}%` : '-' },
              { key: 'cpc',         label: 'CPC',         align: 'right', render: v => v ? `$${formatDecimal(v, 2)}` : '-' },
              { key: 'inversion',   label: 'Inversión',   align: 'right', render: v => formatCurrency(v) },
            ]}
            data={keywords}
          />
        </ChartCard>
      )}

      <GoogleAdsProyecciones
        rows={rows}
        proyecciones={proyecciones}
        selectedMonth={selectedMonth}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Proyecciones vs Real — Google Ads by tipo_red (Display / Video)
// ─────────────────────────────────────────────────────────────────────────────
const normPlat = v => String(v || '').toLowerCase().trim()

function GoogleAdsProyecciones({ rows, proyecciones = [], selectedMonth }) {
  // Filter proyecciones for google ads platform and current month
  const gadsProyecciones = useMemo(() => {
    return proyecciones.filter(p => {
      const plat = normPlat(p.plataforma)
      return (plat === 'google ads' || plat === 'google' || plat === 'googleads')
        && p.mes === selectedMonth
    })
  }, [proyecciones, selectedMonth])

  if (gadsProyecciones.length === 0) return null

  // Build real values from actual google ads data (rows) grouped by tipo_red
  const realByType = useMemo(() => {
    const map = {}
    for (const r of rows) {
      const tipo = r._obj // 'Display' or 'Video'
      if (!map[tipo]) map[tipo] = { impresiones_visibles: 0, views: 0, inversion: 0 }
      map[tipo].impresiones_visibles += safeNumber(r.impresiones_visibles)
      map[tipo].views += safeNumber(r.views) || safeNumber(r.visualizaciones)
      map[tipo].inversion += safeNumber(r.inversion)
    }
    return map
  }, [rows])

  // Match each proyeccion row with real data
  const tableRows = useMemo(() => {
    return gadsProyecciones.map(p => {
      const objetivo = String(p.objetivo || '').trim()
      const metrica = String(p.metrica || '').trim()
      const meta = safeNumber(p.meta)
      const proyeccion = safeNumber(p.proyeccion)
      const realFromSheet = safeNumber(p.real)

      // Try to get real from actual data if sheet is empty
      let real = realFromSheet
      if (!real) {
        const objLower = objetivo.toLowerCase()
        if (objLower === 'display' || metrica.toLowerCase().includes('impresiones')) {
          real = realByType['Display']?.impresiones_visibles || 0
        } else if (objLower === 'video' || metrica.toLowerCase().includes('visualizaciones') || metrica.toLowerCase().includes('views')) {
          real = realByType['Video']?.views || 0
        }
      }

      const cumplimiento = meta > 0 && real > 0 ? (real / meta) * 100 : 0

      return {
        objetivo,
        metrica,
        meta,
        proyeccion,
        real,
        cumplimiento,
      }
    })
  }, [gadsProyecciones, realByType])

  return (
    <ChartCard
      title="Proyecciones vs Real"
      subtitle="Comparativo por tipo de red"
      allowLogScale={false}
    >
      <DataTable
        columns={[
          { key: 'objetivo', label: 'Tipo de Red', bold: true },
          { key: 'metrica', label: 'Métrica',
            render: v => <span className="text-white/60 text-xs capitalize">{v || '—'}</span> },
          { key: 'meta', label: 'Meta', align: 'right',
            render: v => safeNumber(v) > 0 ? formatNumber(v) : <span className="text-white/30">—</span> },
          { key: 'proyeccion', label: 'Proyección', align: 'right',
            render: v => safeNumber(v) > 0 ? formatNumber(v) : <span className="text-white/30">—</span> },
          { key: 'real', label: 'Real', align: 'right',
            render: v => safeNumber(v) > 0 ? formatNumber(v) : <span className="text-white/30">—</span> },
          { key: 'cumplimiento', label: 'Cumplimiento', align: 'right',
            render: (_, r) => {
              if (!r.meta || !r.real) return <span className="text-white/30">—</span>
              const pct = r.cumplimiento
              const color = pct >= 100 ? 'text-emerald-300' : pct >= 80 ? 'text-yellow-300' : 'text-red-300'
              return <span className={color}>{truncTo(pct, 2)}%</span>
            }
          },
        ]}
        data={tableRows}
      />
    </ChartCard>
  )
}
