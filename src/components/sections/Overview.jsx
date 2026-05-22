import { motion } from 'framer-motion'
import { Users, Eye, Heart, Megaphone, TrendingUp, Sparkles, AlertTriangle, Trophy } from 'lucide-react'
import { KPICard, KPICardSkeleton } from '../ui/KPICard'
import { SectionHeader } from '../ui/SectionHeader'
import { ChartCard, TrendLineChart, DistributionDonut } from '../ui/Charts'
import { ObservacionesButton } from '../ui/ObservacionesCard'
import { SentimentGauge } from '../ui/SentimentGauge'
import { safeNumber, formatCurrency, prevMonth, pctChange } from '../../utils/format'

export function Overview({ data, historical, selectedMonth, loading, theme, features }) {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <KPICardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-80 rounded-2xl skeleton" />
          <div className="h-80 rounded-2xl skeleton" />
        </div>
      </div>
    )
  }

  const fb = data.facebook
  const ig = data.instagram
  const tt = data.tiktok
  const sentiment = data.sentiment
  const showGoogleAds = features?.googleAds !== false

  // Aggregate KPIs
  const totalSeguidores    = safeNumber(fb?.seguidores)    + safeNumber(ig?.seguidores)    + safeNumber(tt?.seguidores)
  const totalAlcance       = safeNumber(fb?.alcance)       + safeNumber(ig?.alcance)       + safeNumber(tt?.views)
  const totalInteracciones = safeNumber(fb?.interacciones) + safeNumber(ig?.interacciones) + safeNumber(tt?.interacciones)
  
  // Inversión comes from Campañas + Google Ads (not platform sheets)
  const campInversion = (data.campanas || []).reduce((s, r) => s + safeNumber(r.inversion), 0)
  const gadsInversion = showGoogleAds ? (data.googleAds || []).reduce((s, r) => s + safeNumber(r.inversion), 0) : 0
  const totalInversion = campInversion + gadsInversion

  // Previous month aggregation for variation badges
  const pm = prevMonth(selectedMonth)
  const prevFb = (historical.facebook || []).find(r => r.mes === pm)
  const prevIg = (historical.instagram || []).find(r => r.mes === pm)
  const prevTt = (historical.tiktok || []).find(r => r.mes === pm)
  const prevSeguidores    = safeNumber(prevFb?.seguidores)    + safeNumber(prevIg?.seguidores)    + safeNumber(prevTt?.seguidores)
  const prevAlcance       = safeNumber(prevFb?.alcance)       + safeNumber(prevIg?.alcance)       + safeNumber(prevTt?.views)
  const prevInteracciones = safeNumber(prevFb?.interacciones) + safeNumber(prevIg?.interacciones) + safeNumber(prevTt?.interacciones)
  const prevInversion     = 0 // Will show variation only when historical campañas data is available

  // Followers trend
  const trendMonths = new Set()
  ;[...(historical.facebook||[]), ...(historical.instagram||[]), ...(historical.tiktok||[])]
    .forEach(r => r.mes && trendMonths.add(r.mes))
  const sortedTrendMonths = Array.from(trendMonths).sort().slice(-6)

  const followerTrend = sortedTrendMonths.map(mes => ({
    mes,
    Facebook:  safeNumber((historical.facebook || []).find(r => r.mes === mes)?.seguidores),
    Instagram: safeNumber((historical.instagram || []).find(r => r.mes === mes)?.seguidores),
    TikTok:    safeNumber((historical.tiktok || []).find(r => r.mes === mes)?.seguidores),
  }))

  // Investment distribution (from Campañas grouped by platform)
  const campByPlat = {}
  for (const c of (data.campanas || [])) {
    const p = String(c.plataforma || c._platform || '').toLowerCase()
    if (!campByPlat[p]) campByPlat[p] = 0
    campByPlat[p] += safeNumber(c.inversion)
  }
  const investmentData = [
    { name: 'Facebook',  value: campByPlat['facebook'] || 0, color: '#3b82f6' },
    { name: 'Instagram', value: campByPlat['instagram'] || 0, color: '#ec4899' },
    { name: 'TikTok',    value: campByPlat['tiktok'] || 0, color: '#22d3ee' },
    ...(showGoogleAds ? [{
      name: 'Google Ads',
      value: gadsInversion,
      color: '#f59e0b',
    }] : []),
  ].filter(d => d.value > 0)

  const totalInversionAll = investmentData.reduce((s, d) => s + d.value, 0)

  const topHallazgos = (data.hallazgos || [])
    .filter(h => h.seccion === 'overview')
    .sort((a, b) => safeNumber(a.prioridad) - safeNumber(b.prioridad))
    .slice(0, 4)

  const observaciones = (data.observaciones || []).filter(o => o.seccion === 'overview')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <SectionHeader
          icon={TrendingUp}
          title="Resumen Ejecutivo"
          subtitle="Vista general del desempeño del mes"
          accentColor={theme.primary}
        />
        <ObservacionesButton observaciones={observaciones} accentColor={theme.primary} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Seguidores Totales" value={totalSeguidores}    icon={Users}     accentColor={theme.primary} variation={pctChange(totalSeguidores, prevSeguidores)} delay={0} />
        <KPICard title="Alcance / Views"    value={totalAlcance}       icon={Eye}       accentColor="#22d3ee"       variation={pctChange(totalAlcance, prevAlcance)} delay={1} />
        <KPICard title="Interacciones"      value={totalInteracciones} icon={Heart}     accentColor="#ec4899"       variation={pctChange(totalInteracciones, prevInteracciones)} delay={2} />
        <KPICard title="Inversión Total"    value={totalInversion}     icon={Megaphone} accentColor="#f59e0b"       variation={pctChange(totalInversion, prevInversion)} formatter={v => formatCurrency(v)} delay={3} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Crecimiento de Seguidores" subtitle="Últimos 6 meses por plataforma" className="lg:col-span-2">
          {({ scale, expanded }) => (
            <TrendLineChart
              data={followerTrend}
              scale={scale}
              expanded={expanded}
              lines={[
                { key: 'Facebook',  name: 'Facebook',  color: '#3b82f6' },
                { key: 'Instagram', name: 'Instagram', color: '#ec4899' },
                { key: 'TikTok',    name: 'TikTok',    color: '#22d3ee' },
              ]}
            />
          )}
        </ChartCard>

        <ChartCard title="Distribución de Inversión" subtitle="Mix por canal" allowLogScale={false}>
          {({ expanded }) => (
            investmentData.length > 0 ? (
              <DistributionDonut
                data={investmentData}
                centerLabel="Total"
                centerValue={formatCurrency(totalInversionAll)}
                expanded={expanded}
              />
            ) : (
              <div className="h-40 flex items-center justify-center text-white/40 text-sm">
                Sin inversión registrada
              </div>
            )
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {sentiment && (
          <ChartCard title="Sentiment de Marca" subtitle="Percepción del público" allowLogScale={false} expandable={false}>
            <SentimentGauge
              positivo={sentiment.positivo_pct}
              neutro={sentiment.neutro_pct}
              negativo={sentiment.negativo_pct}
            />
          </ChartCard>
        )}

        <ChartCard
          title="Hallazgos Clave"
          subtitle="Top insights del mes"
          className={sentiment ? 'lg:col-span-2' : 'lg:col-span-3'}
          allowLogScale={false}
          expandable={false}
        >
          {topHallazgos.length > 0 ? (
            <div className="space-y-3">
              {topHallazgos.map((h, i) => <HallazgoRow key={i} hallazgo={h} delay={i} />)}
            </div>
          ) : (
            <p className="text-white/40 text-sm py-8 text-center">Sin hallazgos registrados</p>
          )}
        </ChartCard>
      </div>
    </div>
  )
}

function HallazgoRow({ hallazgo, delay }) {
  const isLogro  = /logro|positivo|exito|éxito/i.test(hallazgo.tipo || '')
  const isAlerta = /alerta|riesgo|problema|negativo/i.test(hallazgo.tipo || '')
  const Icon = isLogro ? Trophy : isAlerta ? AlertTriangle : Sparkles
  const color = isLogro ? '#22c55e' : isAlerta ? '#ef4444' : '#facc15'

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: delay * 0.08 }}
      className="flex gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors"
    >
      <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}22`, border: `1px solid ${color}44` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{hallazgo.titulo}</p>
        {hallazgo.descripcion && (
          <p className="text-xs text-white/55 mt-0.5 line-clamp-2">{hallazgo.descripcion}</p>
        )}
      </div>
    </motion.div>
  )
}
