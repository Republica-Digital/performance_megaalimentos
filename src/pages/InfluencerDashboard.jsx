import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, BarChart3, CalendarDays, Camera, ChevronRight, Eye, Heart, Loader2,
  Megaphone, MessageSquare, RefreshCw, Search, Sparkles, Trophy, Users, Wallet,
} from 'lucide-react'
import { KPICard, KPICardSkeleton } from '../components/ui/KPICard'
import { ChartCard, ComparisonBarChart, DistributionDonut } from '../components/ui/Charts'
import { useInfluencerData } from '../hooks/useInfluencerData'
import { aggregateContent, aggregatePaid, buildInfluencerRollups, campaignInfluencerCost, platformColors } from '../utils/influencerMetrics'
import { formatCurrency, formatDecimal, formatNumber, safeNumber } from '../utils/format'

const brandThemes = {
  botanera: {
    primary: '#FF6B00', secondary: '#FFD700', bgBase: '#2A0E00',
    ambient1: 'rgba(229, 62, 0, 0.30)', ambient2: 'rgba(255, 183, 77, 0.18)',
  },
  chamoy: {
    primary: '#A855F7', secondary: '#FFD700', bgBase: '#150022',
    ambient1: 'rgba(109, 40, 217, 0.30)', ambient2: 'rgba(251, 191, 36, 0.15)',
  },
  pacific: {
    primary: '#3B82F6', secondary: '#E31E24', bgBase: '#030B1F',
    ambient1: 'rgba(10, 38, 71, 0.55)', ambient2: 'rgba(227, 30, 36, 0.15)',
  },
}

const navItems = [
  { key: 'campaigns', label: 'Campañas', icon: CalendarDays },
  { key: 'overview', label: 'Resumen', icon: BarChart3 },
  { key: 'influencers', label: 'Influencers', icon: Users },
  { key: 'content', label: 'Contenidos', icon: Camera },
  { key: 'paid', label: 'Pauta', icon: Megaphone },
  { key: 'sentiment', label: 'Sentiment', icon: MessageSquare },
  { key: 'findings', label: 'Hallazgos', icon: Sparkles },
]

export function InfluencerDashboard() {
  const { marcaId } = useParams()
  const navigate = useNavigate()
  const { data, loading, error, refresh, sheetBrandId } = useInfluencerData(marcaId)
  const [tab, setTab] = useState('overview')
  const [campaignId, setCampaignId] = useState('all')
  const [platform, setPlatform] = useState('all')
  const [query, setQuery] = useState('')
  const [selectedInfluencer, setSelectedInfluencer] = useState(null)
  const [selectedContent, setSelectedContent] = useState(null)

  const baseTheme = brandThemes[marcaId] || brandThemes.botanera
  const theme = data?.brand?.color ? { ...baseTheme, primary: data.brand.color } : baseTheme

  const filtered = useMemo(() => {
    if (!data) return null
    const byCampaign = row => campaignId === 'all' || row.campaignId === campaignId
    const byPlatform = row => platform === 'all' || row.platform === platform
    const contents = data.contents.filter(row => byCampaign(row) && byPlatform(row))
    const paid = data.paid.filter(row => byCampaign(row) && byPlatform(row))
    const projections = data.projections.filter(row => campaignId === 'all' || !row.campaignId || row.campaignId === campaignId)
    const influencers = data.influencers.filter(inf =>
      contents.some(row => row.influencerId === inf.id) ||
      paid.some(row => row.influencerId === inf.id) ||
      campaignId === 'all'
    )
    return {
      contents,
      paid,
      influencers,
      findings: data.findings.filter(row => campaignId === 'all' || !row.campaignId || row.campaignId === campaignId),
      sentiment: data.sentiment.filter(row => campaignId === 'all' || !row.campaignId || row.campaignId === campaignId),
      organicTotals: aggregateContent(contents),
      paidTotals: aggregatePaid(paid),
      influencerCost: campaignInfluencerCost({ influencers, contents, paid }),
      projections,
      rollups: buildInfluencerRollups({ influencers, contents, paid, projections }),
    }
  }, [data, campaignId, platform])

  const campaignSummaries = useMemo(() => {
    if (!data) return []
    return data.campaigns.map(campaign => {
      const contents = data.contents.filter(row => row.campaignId === campaign.id)
      const paid = data.paid.filter(row => row.campaignId === campaign.id)
      const influencerIds = new Set([
        ...contents.map(row => row.influencerId),
        ...paid.map(row => row.influencerId),
      ].filter(Boolean))
      return {
        ...campaign,
        organic: aggregateContent(contents),
        paid: aggregatePaid(paid),
        influencerCost: campaignInfluencerCost({ influencers: data.influencers, contents, paid }),
        contentCount: contents.length,
        influencerCount: influencerIds.size,
        platforms: [...new Set(contents.map(row => row.platform).filter(Boolean))],
      }
    })
  }, [data])

  const selectedCampaign = useMemo(() => {
    if (!data) return null
    if (campaignId === 'all') {
      return {
        id: 'all',
        name: 'Todas las campañas',
        startDate: minDate(data.campaigns.map(row => row.startDate)),
        endDate: maxDate(data.campaigns.map(row => row.endDate)),
        objective: 'Vista consolidada de la marca',
      }
    }
    return data.campaigns.find(row => row.id === campaignId) || null
  }, [data, campaignId])

  if (error) {
    return (
      <Shell theme={theme}>
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="glass-card rounded-2xl p-8 max-w-md text-center">
            <h1 className="text-xl font-bold text-white mb-2">No se pudo cargar influencers</h1>
            <p className="text-sm text-white/60 mb-5">{error}</p>
            <button onClick={refresh} className="px-4 py-2 rounded-xl bg-white text-zinc-950 text-sm font-semibold">Reintentar</button>
          </div>
        </div>
      </Shell>
    )
  }

  return (
    <Shell theme={theme}>
      <div className="relative flex min-h-screen">
        <aside className="fixed top-0 left-0 h-screen w-[260px] z-30 p-4 hidden md:flex flex-col border-r border-white/10 bg-black/25 backdrop-blur-2xl">
          <div className="mb-5">
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Influencers</p>
            <h1 className="font-display text-lg font-bold text-white truncate">{data?.brand?.name || sheetBrandId}</h1>
          </div>
          <button onClick={() => navigate('/')} className="mb-4 flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-white/60 hover:text-white hover:bg-white/10">
            <ArrowLeft className="w-3.5 h-3.5" /> Cambiar marca
          </button>
          <nav className="space-y-1">
            {navItems.map(item => {
              const Icon = item.icon
              const active = tab === item.key
              return (
                <button
                  key={item.key}
                  onClick={() => setTab(item.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${active ? 'text-white bg-white/10 border border-white/10' : 'text-white/55 hover:text-white hover:bg-white/5'}`}
                >
                  <Icon className="w-4 h-4" style={active ? { color: theme.primary } : undefined} />
                  {item.label}
                </button>
              )
            })}
          </nav>
        </aside>

        <main className="flex-1 md:ml-[260px]">
          <header className="sticky top-0 z-20 px-4 md:px-6 py-4 bg-black/20 backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-white/45 font-semibold">Campañas con influencers</p>
                <h2 className="text-xl font-bold font-display text-white">{data?.brand?.name || sheetBrandId}</h2>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <select value={campaignId} onChange={e => setCampaignId(e.target.value)} className="proyecciones-select min-w-[180px]">
                  <option value="all">Todas las campañas</option>
                  {(data?.campaigns || []).map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
                </select>
                <select value={platform} onChange={e => setPlatform(e.target.value)} className="proyecciones-select">
                  <option value="all">Todas</option>
                  <option value="TikTok">TikTok</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Facebook">Facebook</option>
                </select>
                <button onClick={refresh} className="glass-strong p-2.5 rounded-xl text-white/70 hover:text-white" title="Actualizar">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="md:hidden mt-4 flex gap-2 overflow-x-auto pb-1">
              {navItems.map(item => <button key={item.key} onClick={() => setTab(item.key)} className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap ${tab === item.key ? 'bg-white text-zinc-950' : 'bg-white/10 text-white/70'}`}>{item.label}</button>)}
            </div>
          </header>

          <div className="p-4 md:p-6 space-y-6">
            {loading || !filtered ? (
              <LoadingState />
            ) : (
              <>
                <CampaignRail campaigns={campaignSummaries} selectedId={campaignId} onSelect={setCampaignId} theme={theme} />
                <CampaignContext campaign={selectedCampaign} filtered={filtered} theme={theme} />
                {tab === 'campaigns' && <CampaignsView campaigns={campaignSummaries} selectedId={campaignId} onSelect={setCampaignId} theme={theme} />}
                {tab === 'overview' && <Overview filtered={filtered} campaignSummaries={campaignSummaries} theme={theme} onTab={setTab} onCampaignSelect={setCampaignId} />}
                {tab === 'influencers' && <InfluencersView rollups={filtered.rollups} theme={theme} onSelect={setSelectedInfluencer} />}
                {tab === 'content' && <ContentView contents={filtered.contents} query={query} setQuery={setQuery} onSelect={setSelectedContent} />}
                {tab === 'paid' && <PaidView paid={filtered.paid} totals={filtered.paidTotals} />}
                {tab === 'sentiment' && <SentimentView sentiment={filtered.sentiment} />}
                {tab === 'findings' && <FindingsView findings={filtered.findings} theme={theme} />}
              </>
            )}
          </div>
        </main>
      </div>

      {selectedInfluencer && <InfluencerModal influencer={selectedInfluencer} onClose={() => setSelectedInfluencer(null)} />}
      {selectedContent && <ContentModal content={selectedContent} onClose={() => setSelectedContent(null)} />}
    </Shell>
  )
}

function Shell({ theme, children }) {
  return (
    <div className="min-h-screen text-white" style={{ background: theme.bgBase }}>
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-[120px] opacity-60" style={{ background: theme.ambient1 }} />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full blur-[120px] opacity-40" style={{ background: theme.ambient2 }} />
      </div>
      {children}
    </div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => <KPICardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-80 rounded-2xl skeleton" />
        <div className="h-80 rounded-2xl skeleton" />
      </div>
    </div>
  )
}

function CampaignRail({ campaigns, selectedId, onSelect, theme }) {
  const totals = campaigns.reduce((acc, campaign) => {
    acc.views += safeNumber(campaign.organic.views)
    acc.paid += safeNumber(campaign.paid.views6s)
    acc.cost += safeNumber(campaign.influencerCost) + safeNumber(campaign.paid.investment)
    return acc
  }, { views: 0, paid: 0, cost: 0 })

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Lectura por campaña</p>
          <h3 className="text-lg font-bold text-white">Campañas activas y periodos</h3>
        </div>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        <button
          onClick={() => onSelect('all')}
          className={`min-w-[260px] rounded-2xl p-4 text-left border transition-colors ${selectedId === 'all' ? 'bg-white/14 border-white/25' : 'bg-white/6 border-white/10 hover:bg-white/10'}`}
        >
          <p className="text-xs uppercase tracking-widest text-white/45">Consolidado</p>
          <p className="mt-1 font-bold text-white">Todas las campañas</p>
          <p className="text-xs text-white/45 mt-1">{campaigns.length} campañas</p>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <MiniMetric label="Views" value={formatNumber(totals.views)} />
            <MiniMetric label="Pauta" value={formatNumber(totals.paid)} />
            <MiniMetric label="Costo" value={formatCurrency(totals.cost)} />
          </div>
        </button>
        {campaigns.map(campaign => {
          const selected = selectedId === campaign.id
          const totalCost = safeNumber(campaign.influencerCost) + safeNumber(campaign.paid.investment)
          return (
            <button
              key={campaign.id}
              onClick={() => onSelect(campaign.id)}
              className={`min-w-[300px] rounded-2xl p-4 text-left border transition-colors ${selected ? 'bg-white/14 border-white/25' : 'bg-white/6 border-white/10 hover:bg-white/10'}`}
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${theme.primary}2e`, color: theme.primary }}>
                  <CalendarDays className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-white line-clamp-2">{campaign.name}</p>
                  <p className="text-xs text-white/45 mt-1">{formatDateRange(campaign.startDate, campaign.endDate)}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4">
                <MiniMetric label="Views" value={formatNumber(campaign.organic.views)} />
                <MiniMetric label="Influencers" value={formatNumber(campaign.influencerCount)} />
                <MiniMetric label="Costo" value={totalCost ? formatCurrency(totalCost) : 'Pend.'} />
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function CampaignContext({ campaign, filtered, theme }) {
  if (!campaign) return null
  const paid = filtered.paidTotals
  const influencerCost = safeNumber(filtered.influencerCost)
  const totalCost = influencerCost + safeNumber(paid.investment)
  const organic = filtered.organicTotals
  const organicCpv = organic.views > 0 && influencerCost > 0 ? influencerCost / organic.views : 0
  const totalCpv = organic.views + paid.views6s > 0 && totalCost > 0 ? totalCost / (organic.views + paid.views6s) : 0

  return (
    <section className="rounded-2xl border border-white/10 bg-white/7 p-5">
      <div className="flex flex-col lg:flex-row lg:items-center gap-5 justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] uppercase tracking-widest text-white/45 font-semibold">Campaña seleccionada</span>
            {campaign.status && <span className="text-[10px] px-2 py-1 rounded-full bg-white/10 text-white/60">{campaign.status}</span>}
          </div>
          <h3 className="text-2xl font-bold text-white font-display">{campaign.name}</h3>
          <p className="text-sm text-white/55 mt-1">{formatDateRange(campaign.startDate, campaign.endDate)}</p>
          {campaign.objective && <p className="text-sm text-white/65 mt-3 max-w-3xl">{campaign.objective}</p>}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 min-w-0 lg:min-w-[560px]">
          <MiniMetric label="Costo influencers" value={influencerCost ? formatCurrency(influencerCost) : 'Pendiente'} />
          <MiniMetric label="Inversión pauta" value={paid.investment ? formatCurrency(paid.investment) : '$0'} />
          <MiniMetric label="Costo total" value={totalCost ? formatCurrency(totalCost) : 'Pendiente'} />
          <MiniMetric label="CPV total" value={totalCpv ? formatCurrency(totalCpv) : (organicCpv ? formatCurrency(organicCpv) : 'Pendiente')} />
        </div>
      </div>
      <div className="mt-4 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${paid.investment && totalCost ? Math.min((paid.investment / totalCost) * 100, 100) : 0}%`, background: theme.primary }} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-white/45">
        <span>CPV orgánico: {organicCpv ? formatCurrency(organicCpv) : 'Pendiente'}</span>
        <span>CPV pauta: {paid.cpv ? formatCurrency(paid.cpv) : '$0'}</span>
        <span>El costo del influencer queda editable desde la columna Fee Total.</span>
      </div>
    </section>
  )
}

function CampaignsView({ campaigns, selectedId, onSelect, theme }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {campaigns.map(campaign => {
        const selected = campaign.id === selectedId
        const influencerCost = safeNumber(campaign.influencerCost)
        const paidInvestment = safeNumber(campaign.paid.investment)
        const totalCost = influencerCost + paidInvestment
        const organicCpv = campaign.organic.views > 0 && influencerCost > 0 ? influencerCost / campaign.organic.views : 0
        return (
          <button
            key={campaign.id}
            onClick={() => onSelect(campaign.id)}
            className={`glass-card rounded-2xl p-5 text-left border ${selected ? 'border-white/30' : 'border-white/10'}`}
          >
            <div className="flex items-start gap-3 mb-5">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${theme.primary}2e`, color: theme.primary }}>
                <CalendarDays className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-white text-lg">{campaign.name}</h3>
                <p className="text-xs text-white/45 mt-1">{formatDateRange(campaign.startDate, campaign.endDate)}</p>
              </div>
              <span className="text-[10px] uppercase rounded-full px-2 py-1 bg-white/10 text-white/55">{campaign.status || 'Campaña'}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <MiniMetric label="Views org." value={formatNumber(campaign.organic.views)} />
              <MiniMetric label="Views pauta" value={formatNumber(campaign.paid.views6s)} />
              <MiniMetric label="Contenidos" value={formatNumber(campaign.contentCount)} />
              <MiniMetric label="Influencers" value={formatNumber(campaign.influencerCount)} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
              <MiniMetric label="Costo influencers" value={influencerCost ? formatCurrency(influencerCost) : 'Pendiente'} />
              <MiniMetric label="Pauta" value={paidInvestment ? formatCurrency(paidInvestment) : '$0'} />
              <MiniMetric label="Costo total" value={totalCost ? formatCurrency(totalCost) : 'Pendiente'} />
              <MiniMetric label="CPV org." value={organicCpv ? formatCurrency(organicCpv) : 'Pendiente'} />
            </div>
          </button>
        )
      })}
    </div>
  )
}

function Overview({ filtered, campaignSummaries, theme, onTab, onCampaignSelect }) {
  const organic = filtered.organicTotals
  const paid = filtered.paidTotals
  const totalInvestment = safeNumber(filtered.influencerCost) + safeNumber(paid.investment)
  const platformData = Object.entries(groupBy(filtered.contents, 'platform')).map(([name, rows]) => ({
    name,
    value: aggregateContent(rows).views,
    color: platformColors[name] || '#94a3b8',
  })).filter(row => row.value > 0)
  const rankingData = filtered.rollups.slice(0, 6).map(inf => ({
    name: inf.name.split(' ')[0],
    Views: inf.organic.views,
    Interacciones: inf.organic.interactions,
  }))
  const topCampaigns = campaignSummaries
    .map(campaign => {
      const influencerCost = safeNumber(campaign.influencerCost)
      const paidInvestment = safeNumber(campaign.paid.investment)
      const totalCost = influencerCost + paidInvestment
      const totalViews = safeNumber(campaign.organic.views) + safeNumber(campaign.paid.views6s)
      const organicCpv = influencerCost > 0 && campaign.organic.views > 0 ? influencerCost / campaign.organic.views : null
      const paidCpv = paidInvestment > 0 && campaign.paid.views6s > 0 ? paidInvestment / campaign.paid.views6s : null
      const totalCpv = totalCost > 0 && totalViews > 0 ? totalCost / totalViews : null
      return { ...campaign, totalCost, totalViews, organicCpv, paidCpv, totalCpv }
    })
    .filter(campaign => campaign.organic.views > 0 || campaign.paid.views6s > 0)
    .sort((a, b) => (a.totalCpv ?? a.organicCpv ?? Infinity) - (b.totalCpv ?? b.organicCpv ?? Infinity))
    .slice(0, 4)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Views orgánicas" value={organic.views} icon={Eye} accentColor={theme.primary} delay={0} />
        <KPICard title="Interacciones" value={organic.interactions} icon={Heart} accentColor="#ec4899" delay={1} />
        <KPICard title="Views 6s pauta" value={paid.views6s} icon={Megaphone} accentColor="#f59e0b" delay={2} />
        <KPICard title="Inversión total" value={totalInvestment} icon={Wallet} accentColor="#22c55e" formatter={formatCurrency} delay={3} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <ChartCard title="Ranking de influencers" subtitle="Top por views e interacciones" className="xl:col-span-2" allowLogScale={false}>
          <ComparisonBarChart
            data={rankingData}
            xKey="name"
            bars={[
              { key: 'Views', name: 'Views', color: theme.primary },
              { key: 'Interacciones', name: 'Interacciones', color: '#ec4899' },
            ]}
          />
        </ChartCard>
        <ChartCard title="Distribución por plataforma" subtitle="Views orgánicas" allowLogScale={false}>
          <DistributionDonut data={platformData} centerLabel="Views" centerValue={formatNumber(organic.views)} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {filtered.rollups.slice(0, 3).map((inf, index) => (
          <button key={inf.id} onClick={() => onTab('influencers')} className="glass-card rounded-2xl p-5 text-left">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold" style={{ background: `${theme.primary}33`, color: theme.primary }}>
                {index + 1}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-white truncate">{inf.name}</p>
                <p className="text-xs text-white/45">{inf.category || 'Influencer'}</p>
              </div>
              <Trophy className="w-4 h-4 ml-auto text-amber-300" />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <MiniMetric label="Views" value={formatNumber(inf.organic.views)} />
              <MiniMetric label="ETR" value={`${formatDecimal(inf.organic.etr)}%`} />
              <MiniMetric label="CPV" value={formatCurrency(inf.cpv)} />
            </div>
          </button>
        ))}
      </div>

      <div className="glass-card rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-white">Top campañas por CPV</h3>
            <p className="text-xs text-white/45 mt-1">Ranking de eficiencia con costo de influencer, pauta y costo total.</p>
          </div>
          <CalendarDays className="w-5 h-5" style={{ color: theme.primary }} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {topCampaigns.map((campaign, index) => (
            <button key={campaign.id} onClick={() => onCampaignSelect(campaign.id)} className="rounded-xl bg-white/5 border border-white/10 p-4 text-left hover:bg-white/10 transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold" style={{ background: `${theme.primary}2e`, color: theme.primary }}>
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white line-clamp-2">{campaign.name}</p>
                  <p className="text-xs text-white/45 mt-1">{formatDateRange(campaign.startDate, campaign.endDate)}</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-4">
                <MiniMetric label="CPV total" value={campaign.totalCpv !== null ? formatCurrency(campaign.totalCpv) : 'Pend.'} />
                <MiniMetric label="CPV org." value={campaign.organicCpv !== null ? formatCurrency(campaign.organicCpv) : 'Pend.'} />
                <MiniMetric label="CPV pauta" value={campaign.paidCpv !== null ? formatCurrency(campaign.paidCpv) : '$0'} />
                <MiniMetric label="Views" value={formatNumber(campaign.totalViews)} />
              </div>
            </button>
          ))}
          {!topCampaigns.length && <EmptyState title="Sin campañas rankeables" text="Agrega views y costos para calcular CPV por campaña." />}
        </div>
      </div>
    </div>
  )
}

function InfluencersView({ rollups, theme, onSelect }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {rollups.map((inf, index) => {
        const progress = inf.progress.planned > 0 ? Math.min((inf.progress.published / inf.progress.planned) * 100, 100) : 0
        return (
          <button key={inf.id} onClick={() => onSelect(inf)} className="glass-card rounded-2xl overflow-hidden text-left">
            <div className="p-5 flex gap-4" style={{ background: `linear-gradient(135deg, ${theme.primary}44, rgba(255,255,255,0.05))` }}>
              <div className="w-16 h-16 rounded-full bg-white/10 overflow-hidden flex-shrink-0">
                {inf.photo ? <img src={inf.photo} alt={inf.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl font-bold">{inf.name?.[0]}</div>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <h3 className="text-lg font-bold text-white truncate">{inf.name}</h3>
                  <span className="ml-auto text-xs rounded-full px-2 py-1 bg-black/25">#{index + 1}</span>
                </div>
                <p className="text-xs text-white/55">{inf.category || 'Sin categoría'}</p>
                <p className="text-xs text-white/70 mt-2 truncate">{[inf.tiktok, inf.instagram, inf.facebook].filter(Boolean).join(' · ')}</p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-4 gap-2">
                <MiniMetric label="Views" value={formatNumber(inf.organic.views)} />
                <MiniMetric label="ETR" value={`${formatDecimal(inf.organic.etr)}%`} />
                <MiniMetric label="CPV" value={formatCurrency(inf.cpv)} />
                <MiniMetric label="Pauta" value={formatNumber(inf.paid.views6s)} />
              </div>
              <div>
                <div className="flex justify-between text-xs text-white/55 mb-1">
                  <span>Contenidos</span>
                  <span>{inf.progress.published}/{inf.progress.planned || 'N/D'}</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${inf.progress.planned ? progress : 100}%`, background: theme.primary }} />
                </div>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function ContentView({ contents, query, setQuery, onSelect }) {
  const filtered = contents
    .filter(row => !query || `${row.influencerName} ${row.platform} ${row.format}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b.views - a.views)
  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
        <input value={query} onChange={e => setQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/8 border border-white/10 text-sm text-white outline-none" placeholder="Buscar contenido" />
      </div>
      <div className="space-y-3">
        {filtered.map((row, index) => (
          <button key={row.uid} onClick={() => onSelect(row)} className="w-full glass-card rounded-2xl p-4 flex items-center gap-4 text-left">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center font-bold">{index + 1}</div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-[10px] uppercase font-bold rounded px-2 py-1" style={{ background: `${platformColors[row.platform] || '#fff'}22`, color: platformColors[row.platform] || '#fff' }}>{row.platform}</span>
                <span className="text-xs text-white/45">{row.format}</span>
              </div>
              <p className="font-semibold text-white truncate">{row.influencerName || row.influencerId}</p>
              <p className="text-xs text-white/40">{row.publishDate || 'Sin fecha'}</p>
            </div>
            <MiniMetric label="Views" value={formatNumber(row.views)} />
            <MiniMetric label="Inter." value={formatNumber(row.reactions + row.comments + row.shares + row.saves)} />
            <ChevronRight className="w-4 h-4 text-white/30" />
          </button>
        ))}
      </div>
    </div>
  )
}

function PaidView({ paid, totals }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard title="Views 6s" value={totals.views6s} icon={Eye} accentColor="#f59e0b" />
        <KPICard title="Alcance" value={totals.reach} icon={Users} accentColor="#22d3ee" />
        <KPICard title="CPV" value={totals.cpv} icon={Wallet} accentColor="#22c55e" formatter={formatCurrency} />
        <KPICard title="Interacciones" value={totals.interactions} icon={Heart} accentColor="#ec4899" />
        <KPICard title="Inversión pauta" value={totals.investment} icon={Megaphone} accentColor="#a78bfa" formatter={formatCurrency} />
      </div>
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="grid grid-cols-7 gap-3 px-4 py-3 text-[10px] uppercase tracking-wider text-white/45 border-b border-white/10">
          <span>Influencer</span><span>Plataforma</span><span>Views 6s</span><span>Alcance</span><span>Interacciones</span><span>CPV</span><span>Inversión</span>
        </div>
        {paid.length ? paid.map(row => {
          const interactions = row.likes + row.comments + row.shares + row.saves
          return (
            <div key={row.id} className="grid grid-cols-7 gap-3 px-4 py-3 text-sm border-b border-white/5">
              <span className="text-white truncate">{row.influencerId}</span>
              <span className="text-white/60">{row.platform || '-'}</span>
              <span>{formatNumber(row.views6s)}</span>
              <span>{formatNumber(row.reach)}</span>
              <span>{formatNumber(interactions)}</span>
              <span>{formatCurrency(row.views6s > 0 ? row.investment / row.views6s : 0)}</span>
              <span>{formatCurrency(row.investment)}</span>
            </div>
          )
        }) : <EmptyState title="Sin datos de pauta" text="La pestaña Pauta_Influencers ya quedó prevista para capturar estos resultados." />}
      </div>
    </div>
  )
}

function SentimentView({ sentiment }) {
  const counts = sentiment.reduce((acc, row) => {
    const key = row.sentiment || 'Sin clasificar'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
  const total = sentiment.length || 1
  const pct = key => ((counts[key] || 0) / total) * 100
  return (
    <div className="space-y-5">
      <div className="glass-card rounded-2xl p-5">
        <h3 className="font-bold text-white mb-4">Sentiment destacado</h3>
        <div className="h-8 rounded-full overflow-hidden flex bg-white/10">
          <div style={{ width: `${pct('Positivo')}%` }} className="bg-emerald-500" />
          <div style={{ width: `${pct('Neutro')}%` }} className="bg-amber-400" />
          <div style={{ width: `${pct('Negativo')}%` }} className="bg-red-500" />
        </div>
        <div className="flex gap-5 mt-3 text-sm text-white/65">
          <span>Positivo {formatDecimal(pct('Positivo'))}%</span>
          <span>Neutro {formatDecimal(pct('Neutro'))}%</span>
          <span>Negativo {formatDecimal(pct('Negativo'))}%</span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sentiment.map(row => (
          <div key={`${row.id}-${row.screenshot}`} className="glass-card rounded-2xl overflow-hidden">
            <div className="aspect-[4/3] bg-black/30">
              {row.screenshot ? <iframe src={toDrivePreview(row.screenshot)} className="w-full h-full border-0" /> : <div className="w-full h-full flex items-center justify-center text-white/30">Sin captura</div>}
            </div>
            <div className="p-4">
              <p className="text-sm font-semibold text-white">{row.influencerName || row.influencerId}</p>
              <p className="text-xs text-white/45 mt-1">{row.platform} · {row.sentiment}</p>
              {row.text && <p className="text-xs text-white/60 mt-2 line-clamp-2">"{row.text}"</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FindingsView({ findings, theme }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {findings.length ? findings.map(row => (
        <div key={row.id || row.title} className="glass-card rounded-2xl p-5 border-l-4" style={{ borderLeftColor: row.priority === 'high' ? '#ef4444' : row.priority === 'low' ? '#22c55e' : theme.primary }}>
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 mt-0.5" style={{ color: theme.primary }} />
            <div>
              <h3 className="font-bold text-white">{row.title}</h3>
              <p className="text-xs text-white/45 mt-1">{row.category || 'Insight'} · {row.priority || 'medium'}</p>
            </div>
          </div>
          {row.insight && <p className="text-sm text-white/65 mt-4">{row.insight}</p>}
          {row.recommendation && <p className="text-sm text-white/80 mt-3 rounded-xl bg-white/5 p-3">{row.recommendation}</p>}
        </div>
      )) : <EmptyState title="Sin hallazgos" text="Agrega insights en KeyFindings para esta marca o campaña." />}
    </div>
  )
}

function InfluencerModal({ influencer, onClose }) {
  return (
    <Modal title={influencer.name} subtitle={influencer.category} onClose={onClose}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <MiniMetric label="Views" value={formatNumber(influencer.organic.views)} />
        <MiniMetric label="Interacciones" value={formatNumber(influencer.organic.interactions)} />
        <MiniMetric label="CPV orgánico" value={formatCurrency(influencer.cpv)} />
        <MiniMetric label="Views 6s pauta" value={formatNumber(influencer.paid.views6s)} />
      </div>
      <div className="space-y-2">
        {influencer.contents.map(content => (
          <div key={content.uid} className="rounded-xl bg-white/5 p-3 flex justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">{content.platform} · {content.format}</p>
              <p className="text-xs text-white/45">{content.publishDate}</p>
            </div>
            <span className="text-sm font-mono text-white">{formatNumber(content.views)}</span>
          </div>
        ))}
      </div>
    </Modal>
  )
}

function ContentModal({ content, onClose }) {
  return (
    <Modal title={`${content.influencerName || content.influencerId} · ${content.format}`} subtitle={content.publishDate} onClose={onClose}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <MiniMetric label="Views" value={formatNumber(content.views)} />
        <MiniMetric label="Reacciones" value={formatNumber(content.reactions)} />
        <MiniMetric label="Comentarios" value={formatNumber(content.comments)} />
        <MiniMetric label="Guardados" value={formatNumber(content.saves)} />
      </div>
      {content.url && !content.url.includes('<') && <a href={content.url} target="_blank" rel="noreferrer" className="inline-flex px-4 py-2 rounded-xl bg-white text-zinc-950 text-sm font-semibold">Abrir contenido</a>}
    </Modal>
  )
}

function Modal({ title, subtitle, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-strong rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-white/10 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">{title}</h2>
            {subtitle && <p className="text-sm text-white/50 mt-1">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-white/10 text-white/70">Cerrar</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-3 min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-white/40 truncate">{label}</p>
      <p className="text-sm md:text-base font-bold text-white mt-1 truncate">{value}</p>
    </div>
  )
}

function EmptyState({ title, text }) {
  return (
    <div className="p-8 text-center text-white/50 col-span-full">
      <p className="font-semibold text-white/70">{title}</p>
      <p className="text-sm mt-1">{text}</p>
    </div>
  )
}

function groupBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key] || 'Sin dato'
    if (!acc[value]) acc[value] = []
    acc[value].push(row)
    return acc
  }, {})
}

function minDate(values = []) {
  const dates = values.filter(Boolean).sort()
  return dates[0] || ''
}

function maxDate(values = []) {
  const dates = values.filter(Boolean).sort()
  return dates[dates.length - 1] || ''
}

function formatDateRange(startDate, endDate) {
  if (startDate && endDate && startDate !== endDate) return `${formatShortDate(startDate)} - ${formatShortDate(endDate)}`
  if (startDate || endDate) return formatShortDate(startDate || endDate)
  return 'Periodo pendiente'
}

function formatShortDate(value) {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function toDrivePreview(url) {
  const raw = String(url || '')
  const match = raw.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) || raw.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (match) return `https://drive.google.com/file/d/${match[1]}/preview`
  return raw
}
