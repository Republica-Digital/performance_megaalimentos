import { useMemo } from 'react'
import { LineChart as LineChartIcon, Target } from 'lucide-react'
import { SectionHeader, EmptyState } from '../ui/SectionHeader'
import { ChartCard, ProjectionComboChart } from '../ui/Charts'
import { DataTable } from '../ui/DataTable'
import { CampaignToggle } from '../ui/CampaignToggle'
import { safeNumber, formatNumber, truncTo } from '../../utils/format'
import { tipoCampanaToBucket } from '../../utils/campaigns'

const ACCENT = '#22c55e'

const PLATFORM_COLORS = {
  facebook:  '#3b82f6',
  instagram: '#f97316',
  tiktok:    '#a855f7',
  google:    '#f59e0b',
  total:     '#22c55e',
}

// Expected Proyecciones schema:
//   marca | mes | plataforma | tipo_campana | metrica | meta | real | cumplimiento_pct | observacion

export function ProyeccionesSection({
  data = [], selectedMonth, loading,
  bucket = 'mensual', setBucket, availableBuckets = [],
}) {
  // Filtro según bucket:
  //   'mensual' → incluye rows con tipo_campana="AON" y rows sin tipo_campana (global)
  //   'mundial' → incluye solo rows con tipo_campana="Mundial"
  //   'pal_norte' → solo "Pal Norte"
  //   custom → el que coincida con su bucket key
  const filteredData = useMemo(() => {
    return (data || []).filter(r => {
      const tipoCampana = r.tipo_campana || ''
      if (bucket === 'mensual') {
        // Incluye: vacío (meta global) o "AON"
        return !tipoCampana || tipoCampana.toUpperCase() === 'AON'
      }
      // Para buckets específicos, mapea tipo_campana → bucket y compara
      return tipoCampanaToBucket(tipoCampana) === bucket
    })
  }, [data, bucket])

  const grouped = useMemo(() => {
    const map = new Map()
    for (const row of filteredData) {
      const key = `${row.plataforma || 'total'}__${row.metrica || 'Métrica'}`
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(row)
    }
    return Array.from(map.entries()).map(([key, rows]) => {
      const [plataforma, metrica] = key.split('__')
      const sorted = rows
        .filter(r => r.mes)
        .sort((a, b) => String(a.mes).localeCompare(String(b.mes)))
      return { plataforma, metrica, rows: sorted }
    })
  }, [filteredData])

  if (loading) {
    return <div className="space-y-6"><div className="rounded-2xl skeleton h-96" /></div>
  }

  if (!data || data.length === 0) {
    return (
      <div className="space-y-6">
        <SectionHeader
          icon={LineChartIcon} title="Proyecciones" subtitle="Metas y cumplimiento" accentColor={ACCENT}
        />
        <EmptyState
          icon={Target}
          title="Sin proyecciones registradas"
          message="Agrega filas a la hoja 'Proyecciones' con marca, mes, plataforma, métrica y meta."
        />
      </div>
    )
  }

  const currentRows = filteredData.filter(r => r.mes === selectedMonth)

  const bucketLabel = availableBuckets.find(b => b.key === bucket)?.label || 'Mensual'

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={LineChartIcon}
        title="Proyecciones"
        subtitle={`Metas vs resultados — vista: ${bucketLabel}`}
        accentColor={ACCENT}
      />

      <CampaignToggle
        buckets={availableBuckets}
        selected={bucket}
        onChange={setBucket}
        accentColor={ACCENT}
      />

      {currentRows.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center">
          <Target className="w-10 h-10 text-white/30 mx-auto mb-3" />
          <p className="text-white/60 text-sm">
            No hay metas para <strong>{bucketLabel}</strong> en este mes.
          </p>
          <p className="text-white/40 text-xs mt-2">
            Agrega filas en Proyecciones con tipo_campana = {bucket === 'mensual' ? '"AON" o vacío' : `"${bucketLabel}"`}.
          </p>
        </div>
      ) : (
        <ChartCard
          title="Metas del mes"
          subtitle={`${currentRows.length} métrica${currentRows.length === 1 ? '' : 's'} monitoreada${currentRows.length === 1 ? '' : 's'}`}
          allowLogScale={false}
        >
          <DataTable
            columns={[
              { key: 'plataforma', label: 'Plataforma', bold: true,
                render: v => {
                  const p = String(v || '').toLowerCase()
                  const color = PLATFORM_COLORS[p] || '#fff'
                  return (
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
                    >
                      {v || '—'}
                    </span>
                  )
                }
              },
              { key: 'tipo_campana', label: 'Tipo',
                render: v => v
                  ? <span className="text-xs text-white/70 font-mono">{v}</span>
                  : <span className="text-xs text-white/30">Global</span>
              },
              { key: 'metrica', label: 'Métrica' },
              { key: 'meta', label: 'Meta', align: 'right',
                render: v => (v !== null && v !== undefined && v !== '') ? formatNumber(v) : '—' },
              { key: 'real', label: 'Real', align: 'right',
                render: v => (v !== null && v !== undefined && v !== '') ? formatNumber(v) : '—' },
              { key: 'cumplimiento_pct', label: 'Cumplimiento', align: 'right',
                render: (_, r) => {
                  let pct = safeNumber(r.cumplimiento_pct)
                  if (!pct) {
                    const real = safeNumber(r.real)
                    const meta = safeNumber(r.meta)
                    if (!meta) return <span className="text-white/30">—</span>
                    pct = (real / meta) * 100
                  }
                  const color = pct >= 100 ? 'text-emerald-300' : pct >= 80 ? 'text-yellow-300' : 'text-red-300'
                  return <span className={color}>{truncTo(pct, 2)}%</span>
                }
              },
              { key: 'observacion', label: 'Obs.',
                render: v => v ? <span className="text-xs text-white/70 line-clamp-2">{v}</span> : '—' },
            ]}
            data={currentRows}
          />
        </ChartCard>
      )}

      {grouped.map((group, idx) => {
        const chartData = group.rows.map(r => ({
          mes: r.mes,
          Meta: safeNumber(r.meta),
          Real: safeNumber(r.real),
        }))
        const color = PLATFORM_COLORS[String(group.plataforma).toLowerCase()] || ACCENT
        return (
          <ChartCard
            key={idx}
            title={`${group.plataforma || 'Total'} · ${group.metrica}`}
            subtitle="Meta vs real histórico"
            delay={idx}
          >
            {({ scale, expanded }) => (
              <ProjectionComboChart
                data={chartData}
                color={color}
                scale={scale}
                expanded={expanded}
              />
            )}
          </ChartCard>
        )
      })}
    </div>
  )
}
