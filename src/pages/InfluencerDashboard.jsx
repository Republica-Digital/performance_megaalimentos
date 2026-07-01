import { useEffect, useMemo, useRef, useState } from 'react'
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
    primary: '#FF6B00',
    secondary: '#FFD700',
    bgBase: '#120A05',
    surface: 'rgba(255, 107, 0, 0.10)',
  },
  chamoy: {
    primary: '#A855F7',
    secondary: '#FFD700',
    bgBase: '#100817',
    surface: 'rgba(168, 85, 247, 0.11)',
  },
  pacific: {
    primary: '#3B82F6',
    secondary: '#E31E24',
    bgBase: '#07101F',
    surface: 'rgba(59, 130, 246, 0.11)',
  },
}

const navItems = [
  { key: 'workspace', label: 'Mapa ejecutivo', icon: BarChart3 },
  { key: 'campaigns', label: 'Campa\u00f1as', icon: CalendarDays },
  { key: 'influencers', label: 'Colaboradores', icon: Users },
  { key: 'content', label: 'Contenido', icon: Camera },
  { key: 'paid', label: 'Pauta', icon: Megaphone },
  { key: 'sentiment', label: 'Sentiment', icon: MessageSquare },
  { key: 'findings', label: 'Hallazgos', icon: Sparkles },
]

function isVisibleCampaign(campaign) {
  const status = String(campaign.status || '').toLowerCase()
  const hasActivity = safeNumber(campaign.contentCount) > 0 ||
    safeNumber(campaign.paid?.views6s) > 0 ||
    safeNumber(campaign.paid?.investment) > 0
  return hasActivity || (status && !status.includes('archiv'))
}

export function InfluencerDashboard() {
  const { marcaId } = useParams()
  const navigate = useNavigate()
  const { data, loading, error, refresh, sheetBrandId } = useInfluencerData(marcaId)
  const [tab, setTab] = useState('workspace')
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
      const projections = data.projections.filter(row => !row.campaignId || row.campaignId === campaign.id)
      const influencerIds = new Set([
        ...contents.map(row => row.influencerId),
        ...paid.map(row => row.influencerId),
      ].filter(Boolean))
      const influencers = data.influencers.filter(inf => influencerIds.has(inf.id))
      return {
        ...campaign,
        contents,
        paidRows: paid,
        influencers,
        organic: aggregateContent(contents),
        paid: aggregatePaid(paid),
        influencerCost: campaignInfluencerCost({ influencers: data.influencers, contents, paid }),
        rollups: buildInfluencerRollups({ influencers, contents, paid, projections }),
        contentCount: contents.length,
        influencerCount: influencerIds.size,
        platforms: [...new Set(contents.map(row => row.platform).filter(Boolean))],
      }
    })
  }, [data])

  const visibleCampaignSummaries = useMemo(
    () => campaignSummaries.filter(isVisibleCampaign),
    [campaignSummaries]
  )

  const selectedCampaign = useMemo(() => {
    if (!data) return null
    const contextCampaigns = visibleCampaignSummaries.length ? visibleCampaignSummaries : campaignSummaries
    if (campaignId === 'all') {
      return {
        id: 'all',
        name: 'Todas las campa\u00f1as',
        startDate: minDate(contextCampaigns.map(row => row.startDate)),
        endDate: maxDate(contextCampaigns.map(row => row.endDate)),
        objective: 'Vista consolidada de la marca',
      }
    }
    return campaignSummaries.find(row => row.id === campaignId) || null
  }, [data, campaignId, campaignSummaries, visibleCampaignSummaries])

  if (error) {
    return (
      <Shell theme={theme}>
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="influencer-module max-w-md p-8 text-center">
            <h1 className="text-xl font-bold text-white mb-2">No se pudo cargar influencers</h1>
            <p className="text-sm text-white/60 mb-5">{error}</p>
            <button onClick={refresh} className="px-4 py-2 rounded-lg bg-white text-zinc-950 text-sm font-semibold">Reintentar</button>
          </div>
        </div>
      </Shell>
    )
  }

  return (
    <Shell theme={theme}>
      <CommandHeader
        brandName={data?.brand?.name || sheetBrandId}
        selectedCampaign={selectedCampaign}
        campaigns={visibleCampaignSummaries}
        campaignId={campaignId}
        platform={platform}
        loading={loading}
        onBack={() => navigate('/')}
        onCampaignChange={setCampaignId}
        onPlatformChange={setPlatform}
        onRefresh={refresh}
        theme={theme}
      />

      <main className="relative mx-auto max-w-[1480px] px-4 pb-10 pt-4 md:px-6">
        {loading || !filtered ? (
          <LoadingState />
        ) : (
          <div className="space-y-5">
            <WorkspaceNav active={tab} onChange={setTab} theme={theme} />
            <CampaignFocus
              campaign={selectedCampaign}
              filtered={filtered}
              campaignCount={visibleCampaignSummaries.length}
              theme={theme}
            />

            {tab === 'workspace' && (
              <ExecutiveWorkspace
                filtered={filtered}
                campaigns={visibleCampaignSummaries}
                selectedId={campaignId}
                onCampaignSelect={setCampaignId}
                onTab={setTab}
                onInfluencerSelect={setSelectedInfluencer}
                onContentSelect={setSelectedContent}
                theme={theme}
              />
            )}
            {tab === 'campaigns' && (
              <CampaignsView
                campaigns={visibleCampaignSummaries}
                selectedId={campaignId}
                onSelect={setCampaignId}
                onContentSelect={setSelectedContent}
                theme={theme}
              />
            )}
            {tab === 'influencers' && <InfluencersView rollups={filtered.rollups} theme={theme} onSelect={setSelectedInfluencer} />}
            {tab === 'content' && <ContentView contents={filtered.contents} query={query} setQuery={setQuery} onSelect={setSelectedContent} />}
            {tab === 'paid' && <PaidView paid={filtered.paid} totals={filtered.paidTotals} />}
            {tab === 'sentiment' && <SentimentView sentiment={filtered.sentiment} />}
            {tab === 'findings' && <FindingsView findings={filtered.findings} theme={theme} />}
          </div>
        )}
      </main>

      {selectedInfluencer && <InfluencerModal influencer={selectedInfluencer} onClose={() => setSelectedInfluencer(null)} />}
      {selectedContent && <ContentModal content={selectedContent} onClose={() => setSelectedContent(null)} />}
    </Shell>
  )
}

function Shell({ theme, children }) {
  return (
    <div
      className="min-h-screen text-white"
      style={{
        background:
          `linear-gradient(135deg, ${theme.bgBase} 0%, #09090b 48%, ${theme.bgBase} 100%)`,
      }}
    >
      <div className="fixed inset-0 pointer-events-none opacity-60" style={{ background: `linear-gradient(180deg, ${theme.surface}, transparent 38%)` }} />
      {children}
    </div>
  )
}

function CommandHeader({
  brandName,
  selectedCampaign,
  campaigns,
  campaignId,
  platform,
  loading,
  onBack,
  onCampaignChange,
  onPlatformChange,
  onRefresh,
  theme,
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-zinc-950/72 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-4 py-4 md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={onBack} className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/6 text-white/70 hover:bg-white/10 hover:text-white" title="Cambiar marca">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/45">Influencer marketing</p>
              <h1 className="font-display text-xl font-bold text-white md:text-2xl">{brandName}</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select value={campaignId} onChange={event => onCampaignChange(event.target.value)} className="proyecciones-select h-10 min-w-[220px]">
              <option value="all">Todas las campa&ntilde;as</option>
              {campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
            </select>
            <select value={platform} onChange={event => onPlatformChange(event.target.value)} className="proyecciones-select h-10">
              <option value="all">Todas las plataformas</option>
              <option value="TikTok">TikTok</option>
              <option value="Instagram">Instagram</option>
              <option value="Facebook">Facebook</option>
            </select>
            <button onClick={onRefresh} className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/6 text-white/70 hover:bg-white/10 hover:text-white" title="Actualizar">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-white/50">
          <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5">{selectedCampaign?.name || 'Vista consolidada'}</span>
          <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5">{formatDateRange(selectedCampaign?.startDate, selectedCampaign?.endDate)}</span>
          <span className="rounded-full px-3 py-1.5 font-semibold" style={{ background: `${theme.primary}22`, color: theme.primary }}>
            {campaigns.length} campa&ntilde;as visibles
          </span>
        </div>
      </div>
    </header>
  )
}

function WorkspaceNav({ active, onChange, theme }) {
  return (
    <nav className="influencer-module p-2">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
        {navItems.map(item => {
          const Icon = item.icon
          const selected = active === item.key
          return (
            <button
              key={item.key}
              onClick={() => onChange(item.key)}
              className={`flex min-h-[72px] items-center gap-3 rounded-lg border px-3 text-left transition-colors ${selected ? 'border-white/25 bg-white/12 text-white' : 'border-transparent bg-transparent text-white/55 hover:bg-white/7 hover:text-white'}`}
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/8" style={selected ? { color: theme.primary } : undefined}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 text-sm font-semibold leading-tight">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

function LoadingState() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map(i => <KPICardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-80 rounded-lg skeleton" />
        <div className="h-80 rounded-lg skeleton" />
      </div>
    </div>
  )
}

function CampaignFocus({ campaign, filtered, campaignCount, theme }) {
  if (!campaign) return null
  const paid = filtered.paidTotals
  const organic = filtered.organicTotals
  const influencerCost = safeNumber(filtered.influencerCost)
  const paidInvestment = safeNumber(paid.investment)
  const totalCost = influencerCost + paidInvestment
  const totalViews = safeNumber(organic.views) + safeNumber(paid.views6s)
  const organicCpv = organic.views > 0 && influencerCost > 0 ? influencerCost / organic.views : 0
  const totalCpv = totalViews > 0 && totalCost > 0 ? totalCost / totalViews : 0

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.55fr)]">
      <div className="influencer-module p-5 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white/45">Campa&ntilde;a activa</span>
              {campaign.status && <span className="rounded-full bg-white/8 px-3 py-1 text-[11px] text-white/60">{campaign.status}</span>}
            </div>
            <h2 className="font-display text-2xl font-bold text-white md:text-4xl">{campaign.name}</h2>
            <p className="mt-2 text-sm text-white/55">{formatDateRange(campaign.startDate, campaign.endDate)}</p>
            {campaign.objective && <p className="mt-4 max-w-4xl text-sm leading-6 text-white/68">{campaign.objective}</p>}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[520px]">
            <MiniMetric label="Views org\u00e1nicas" value={formatNumber(organic.views)} />
            <MiniMetric label="Views 6s pauta" value={formatNumber(paid.views6s)} />
            <MiniMetric label="Interacciones" value={formatNumber(organic.interactions + paid.interactions)} />
            <MiniMetric label="Contenido" value={formatNumber(filtered.contents.length)} />
          </div>
        </div>
      </div>

      <div className="influencer-module p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/45">Costo y eficiencia</p>
            <p className="mt-1 text-2xl font-bold text-white">{totalCpv ? formatCurrency(totalCpv) : (organicCpv ? formatCurrency(organicCpv) : 'Pendiente')}</p>
          </div>
          <Wallet className="h-5 w-5" style={{ color: theme.primary }} />
        </div>
        <div className="mt-5 space-y-3">
          <CostSplit label="Influencers" value={influencerCost} total={totalCost} color={theme.primary} />
          <CostSplit label="Pauta" value={paidInvestment} total={totalCost} color="#f59e0b" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <MiniMetric label="CPV org." value={organicCpv ? formatCurrency(organicCpv) : 'Pend.'} />
          <MiniMetric label="CPV pauta" value={paid.cpv ? formatCurrency(paid.cpv) : '$0'} />
          <MiniMetric label="Campa\u00f1as" value={formatNumber(campaignCount)} />
        </div>
      </div>
    </section>
  )
}

function CostSplit({ label, value, total, color }) {
  const pct = total > 0 ? Math.min((safeNumber(value) / total) * 100, 100) : 0
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-white/55">
        <span>{label}</span>
        <span>{value ? formatCurrency(value) : '$0'}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

function ExecutiveWorkspace({ filtered, campaigns, selectedId, onCampaignSelect, onTab, onInfluencerSelect, onContentSelect, theme }) {
  const organic = filtered.organicTotals
  const paid = filtered.paidTotals
  const totalInvestment = safeNumber(filtered.influencerCost) + safeNumber(paid.investment)
  const totalViews = safeNumber(organic.views) + safeNumber(paid.views6s)
  const totalCpv = totalViews > 0 && totalInvestment > 0 ? totalInvestment / totalViews : 0
  const topInfluencers = filtered.rollups.filter(row => row.organic.views || row.paid.views6s).slice(0, 4)
  const topContent = [...filtered.contents].sort((a, b) => safeNumber(b.views) - safeNumber(a.views)).slice(0, 5)
  const rankedCampaigns = rankCampaignsByCpv(campaigns).slice(0, 4)
  const platformData = Object.entries(groupBy(filtered.contents, 'platform')).map(([name, rows]) => ({
    name,
    value: aggregateContent(rows).views,
    color: platformColors[name] || '#94a3b8',
  })).filter(row => row.value > 0)
  const rankingData = topInfluencers.map(inf => ({
    name: firstName(inf.name),
    Views: inf.organic.views,
    Interacciones: inf.organic.interactions,
  }))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KPICard title="Views org\u00e1nicas" value={organic.views} icon={Eye} accentColor={theme.primary} delay={0} />
        <KPICard title="Interacciones" value={organic.interactions} icon={Heart} accentColor="#ec4899" delay={1} />
        <KPICard title="Views 6s pauta" value={paid.views6s} icon={Megaphone} accentColor="#f59e0b" delay={2} />
        <KPICard title="CPV total" value={totalCpv} icon={Wallet} accentColor="#22c55e" formatter={formatCurrency} delay={3} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <Module title="Mapa de campa\u00f1as" eyebrow="Estructura" icon={CalendarDays} theme={theme}>
          <div className="space-y-3">
            {campaigns.map(campaign => (
              <CampaignMapRow
                key={campaign.id}
                campaign={campaign}
                selected={selectedId === campaign.id}
                onSelect={() => onCampaignSelect(campaign.id)}
                theme={theme}
              />
            ))}
          </div>
        </Module>

        <Module title="Ranking de eficiencia" eyebrow="CPV" icon={Trophy} theme={theme}>
          <div className="space-y-3">
            {rankedCampaigns.length ? rankedCampaigns.map((campaign, index) => (
              <button key={campaign.id} onClick={() => onCampaignSelect(campaign.id)} className="w-full rounded-lg border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10">
                <div className="flex items-start gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-lg font-bold" style={{ background: `${theme.primary}24`, color: theme.primary }}>{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white line-clamp-2">{campaign.name}</p>
                    <p className="mt-1 text-xs text-white/45">{formatDateRange(campaign.startDate, campaign.endDate)}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <MiniMetric label="CPV" value={campaign.bestCpv ? formatCurrency(campaign.bestCpv) : 'Pend.'} />
                  <MiniMetric label="Views" value={formatNumber(campaign.totalViews)} />
                  <MiniMetric label="Costo" value={campaign.totalCost ? formatCurrency(campaign.totalCost) : 'Pend.'} />
                </div>
              </button>
            )) : <EmptyState title="Sin campa\u00f1as rankeables" text="Agrega costos y views para calcular CPV." />}
          </div>
        </Module>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Module title="Top colaboradores" eyebrow="Resultado org\u00e1nico" icon={Users} theme={theme}>
          <div className="space-y-3">
            {topInfluencers.map((inf, index) => (
              <InfluencerRow key={inf.id} influencer={inf} index={index} onSelect={() => onInfluencerSelect(inf)} theme={theme} />
            ))}
            {!topInfluencers.length && <EmptyState title="Sin colaboradores" text="No hay resultados para el filtro actual." />}
          </div>
        </Module>

        <Module title="Top contenidos" eyebrow="Piezas publicadas" icon={Camera} theme={theme}>
          <div className="space-y-2">
            {topContent.map((content, index) => (
              <ContentRow key={content.uid} content={content} index={index} onSelect={() => onContentSelect(content)} compact />
            ))}
            {!topContent.length && <EmptyState title="Sin contenidos" text="No hay contenidos para el filtro actual." />}
          </div>
        </Module>

        <Module title="Lectura por plataforma" eyebrow="Distribucion" icon={BarChart3} theme={theme}>
          <div className="h-[260px]">
            {platformData.length ? (
              <DistributionDonut data={platformData} centerLabel="Views" centerValue={formatNumber(organic.views)} />
            ) : (
              <EmptyState title="Sin datos" text="Agrega views por plataforma." />
            )}
          </div>
        </Module>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <ChartCard title="Comparativo de colaboradores" subtitle="Views e interacciones org\u00e1nicas" allowLogScale={false}>
          <ComparisonBarChart
            data={rankingData}
            xKey="name"
            bars={[
              { key: 'Views', name: 'Views', color: theme.primary },
              { key: 'Interacciones', name: 'Interacciones', color: '#ec4899' },
            ]}
          />
        </ChartCard>
        <Module title="Accesos directos" eyebrow="Explorar" icon={ChevronRight} theme={theme}>
          <div className="grid gap-2">
            <JumpButton label="Ver campa\u00f1as" value={`${campaigns.length} m\u00f3dulos`} icon={CalendarDays} onClick={() => onTab('campaigns')} />
            <JumpButton label="Ver colaboradores" value={`${filtered.rollups.length} perfiles`} icon={Users} onClick={() => onTab('influencers')} />
            <JumpButton label="Ver contenidos" value={`${filtered.contents.length} piezas`} icon={Camera} onClick={() => onTab('content')} />
            <JumpButton label="Ver pauta" value={`${filtered.paid.length} registros`} icon={Megaphone} onClick={() => onTab('paid')} />
          </div>
        </Module>
      </div>
    </div>
  )
}

function Module({ eyebrow, title, icon: Icon, theme, children }) {
  return (
    <section className="influencer-module p-4 md:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">{eyebrow}</p>
          <h3 className="mt-1 text-lg font-bold text-white">{title}</h3>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-white/8" style={{ color: theme.primary }}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      {children}
    </section>
  )
}

function CampaignMapRow({ campaign, selected, onSelect, theme }) {
  const influencerCost = safeNumber(campaign.influencerCost)
  const paidInvestment = safeNumber(campaign.paid.investment)
  const totalCost = influencerCost + paidInvestment
  const totalViews = safeNumber(campaign.organic.views) + safeNumber(campaign.paid.views6s)
  const totalCpv = totalViews > 0 && totalCost > 0 ? totalCost / totalViews : 0

  return (
    <button onClick={onSelect} className={`w-full rounded-lg border p-3 text-left transition-colors ${selected ? 'border-white/25 bg-white/12' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: `${theme.primary}22`, color: theme.primary }}>{campaign.status || 'Activa'}</span>
            <span className="text-xs text-white/45">{formatDateRange(campaign.startDate, campaign.endDate)}</span>
          </div>
          <p className="font-semibold text-white line-clamp-2">{campaign.name}</p>
          <p className="mt-1 text-xs text-white/45">{campaign.influencerCount} colaboradores - {campaign.contentCount} contenidos</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <MiniMetric label="Views" value={formatNumber(totalViews)} />
          <MiniMetric label="Costo" value={totalCost ? formatCurrency(totalCost) : 'Pend.'} />
          <MiniMetric label="CPV" value={totalCpv ? formatCurrency(totalCpv) : 'Pend.'} />
        </div>
      </div>
    </button>
  )
}

function CampaignsView({ campaigns, selectedId, onSelect, onContentSelect, theme }) {
  const activeCampaigns = campaigns.filter(campaign =>
    campaign.contentCount > 0 || campaign.paid.views6s > 0 || campaign.paid.investment > 0
  )
  const visibleCampaigns = selectedId === 'all'
    ? (activeCampaigns.length ? activeCampaigns : campaigns)
    : campaigns.filter(campaign => campaign.id === selectedId)

  return (
    <div className="space-y-5">
      <section className="influencer-module p-4">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Vista por campa&ntilde;a</p>
            <h3 className="text-xl font-bold text-white">Periodos, costo, colaboradores y contenidos por campa&ntilde;a</h3>
          </div>
          <button
            onClick={() => onSelect('all')}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold ${selectedId === 'all' ? 'border-white bg-white text-zinc-950' : 'border-white/10 bg-white/6 text-white/70 hover:bg-white/10'}`}
          >
            Ver todas
          </button>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {campaigns.map(campaign => (
            <button
              key={campaign.id}
              onClick={() => onSelect(campaign.id)}
              className={`min-w-[240px] rounded-lg border p-3 text-left transition-colors ${selectedId === campaign.id ? 'border-white/30 bg-white/14' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
            >
              <p className="truncate font-bold text-white">{campaign.name}</p>
              <p className="mt-1 text-xs text-white/45">{formatDateRange(campaign.startDate, campaign.endDate)}</p>
              <p className="mt-2 text-[11px] text-white/45">{formatNumber(campaign.contentCount)} contenidos</p>
            </button>
          ))}
        </div>
      </section>

      {visibleCampaigns.map(campaign => (
        <CampaignPanel
          key={campaign.id}
          campaign={campaign}
          selected={selectedId === campaign.id}
          onSelect={onSelect}
          onContentSelect={onContentSelect}
          theme={theme}
        />
      ))}
    </div>
  )
}

function CampaignPanel({ campaign, selected, onSelect, onContentSelect, theme }) {
  const influencerCost = safeNumber(campaign.influencerCost)
  const paidInvestment = safeNumber(campaign.paid.investment)
  const totalCost = influencerCost + paidInvestment
  const totalViews = safeNumber(campaign.organic.views) + safeNumber(campaign.paid.views6s)
  const organicCpv = campaign.organic.views > 0 && influencerCost > 0 ? influencerCost / campaign.organic.views : 0
  const paidCpv = campaign.paid.views6s > 0 && paidInvestment > 0 ? paidInvestment / campaign.paid.views6s : 0
  const totalCpv = totalViews > 0 && totalCost > 0 ? totalCost / totalViews : 0
  const topContents = [...campaign.contents].sort((a, b) => safeNumber(b.views) - safeNumber(a.views)).slice(0, 6)
  const topInfluencers = campaign.rollups.filter(row => row.organic.views || row.paid.views6s).slice(0, 4)

  return (
    <section className={`influencer-module overflow-hidden ${selected ? 'ring-1 ring-white/25' : ''}`}>
      <div className="border-b border-white/10 p-5">
        <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-white/45">Campa&ntilde;a</span>
              <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] text-white/55">{campaign.status || 'Activa'}</span>
              {campaign.platforms?.map(platformName => (
                <span key={platformName} className="rounded-full bg-white/8 px-2 py-1 text-[10px] text-white/50">{platformName}</span>
              ))}
            </div>
            <button onClick={() => onSelect(campaign.id)} className="text-left">
              <h3 className="font-display text-2xl font-bold text-white">{campaign.name}</h3>
            </button>
            <p className="mt-1 text-sm text-white/55">{formatDateRange(campaign.startDate, campaign.endDate)}</p>
            {campaign.objective && <p className="mt-3 max-w-3xl text-sm text-white/65">{campaign.objective}</p>}
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:min-w-[560px]">
            <MiniMetric label="Views org." value={formatNumber(campaign.organic.views)} />
            <MiniMetric label="Views pauta" value={formatNumber(campaign.paid.views6s)} />
            <MiniMetric label="Contenidos" value={formatNumber(campaign.contentCount)} />
            <MiniMetric label="Colaboradores" value={formatNumber(campaign.influencerCount)} />
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
          <MiniMetric label="Costo influencers" value={influencerCost ? formatCurrency(influencerCost) : 'Pendiente'} />
          <MiniMetric label="Pauta" value={paidInvestment ? formatCurrency(paidInvestment) : '$0'} />
          <MiniMetric label="Costo total" value={totalCost ? formatCurrency(totalCost) : 'Pendiente'} />
          <MiniMetric label="CPV org\u00e1nico" value={organicCpv ? formatCurrency(organicCpv) : 'Pendiente'} />
          <MiniMetric label="CPV pauta" value={paidCpv ? formatCurrency(paidCpv) : '$0'} />
          <MiniMetric label="CPV total" value={totalCpv ? formatCurrency(totalCpv) : 'Pendiente'} />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 xl:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <Users className="h-4 w-4" style={{ color: theme.primary }} />
              <h4 className="font-bold text-white">Colaboradores</h4>
            </div>
            <div className="space-y-3">
              {topInfluencers.length ? topInfluencers.map((influencer, index) => (
                <InfluencerRow key={influencer.id} influencer={influencer} index={index} theme={theme} />
              )) : <EmptyState title="Sin colaboradores" text="Agrega contenidos o pauta asociados a esta campa\u00f1a." />}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-4 xl:col-span-3">
            <div className="mb-4 flex items-center gap-2">
              <Camera className="h-4 w-4" style={{ color: theme.primary }} />
              <h4 className="font-bold text-white">Contenidos</h4>
            </div>
            <div className="space-y-2">
              {topContents.length ? topContents.map((content, index) => (
                <ContentRow key={content.uid} content={content} index={index} onSelect={() => onContentSelect(content)} />
              )) : <EmptyState title="Sin contenidos" text="Esta campa\u00f1a aun no tiene contenidos org\u00e1nicos cargados." />}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function InfluencerRow({ influencer, index, onSelect, theme }) {
  const Wrapper = onSelect ? 'button' : 'div'
  return (
    <Wrapper onClick={onSelect} className="flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-left hover:bg-white/8">
      <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-full bg-white/10">
        {influencer.photo ? <img src={influencer.photo} alt={influencer.name} className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-sm font-bold">{firstName(influencer.name)?.[0] || '?'}</div>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold text-white">{influencer.name}</p>
          <span className="rounded bg-black/25 px-1.5 py-0.5 text-[10px] text-white/55">#{index + 1}</span>
        </div>
        <p className="mt-0.5 truncate text-xs text-white/45">{influencer.category || 'Sin categor\u00eda'}</p>
      </div>
      <div className="text-right">
        <p className="font-mono text-sm font-bold text-white">{formatNumber(influencer.organic.views)}</p>
        <p className="text-[10px] text-white/40" style={{ color: influencer.cpv ? theme.primary : undefined }}>{influencer.cpv ? formatCurrency(influencer.cpv) : 'CPV pend.'}</p>
      </div>
    </Wrapper>
  )
}

function ContentRow({ content, index, onSelect, compact = false }) {
  const interactions = safeNumber(content.reactions) + safeNumber(content.comments) + safeNumber(content.shares) + safeNumber(content.saves)
  return (
    <button onClick={onSelect} className="w-full rounded-lg border border-white/10 bg-white/5 p-3 text-left transition-colors hover:bg-white/10">
      <div className={`grid gap-3 ${compact ? '' : 'md:grid-cols-[minmax(0,1fr)_220px] md:items-center'}`}>
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/8 text-xs font-bold text-white/65">{index + 1}</span>
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="rounded px-2 py-1 text-[10px] font-bold uppercase" style={{ background: `${platformColors[content.platform] || '#fff'}22`, color: platformColors[content.platform] || '#fff' }}>{content.platform || '-'}</span>
              <span className="text-xs text-white/45">{content.format || 'Sin formato'}</span>
            </div>
            <p className="truncate font-semibold text-white">{content.influencerName || content.influencerId}</p>
            <p className="text-xs text-white/40">{content.publishDate || 'Sin fecha'}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MiniMetric label="Views" value={formatNumber(content.views)} />
          <MiniMetric label="Inter." value={formatNumber(interactions)} />
        </div>
      </div>
    </button>
  )
}

function InfluencersView({ rollups, theme, onSelect }) {
  const activeRollups = rollups.filter(row => row.organic.views || row.paid.views6s || row.contents.length)
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {activeRollups.map((inf, index) => {
        const progress = inf.progress.planned > 0 ? Math.min((inf.progress.published / inf.progress.planned) * 100, 100) : 0
        return (
          <button key={inf.id} onClick={() => onSelect(inf)} className="influencer-module overflow-hidden text-left">
            <div className="flex gap-4 p-5" style={{ background: `linear-gradient(135deg, ${theme.primary}2e, rgba(255,255,255,0.04))` }}>
              <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-full bg-white/10">
                {inf.photo ? <img src={inf.photo} alt={inf.name} className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-xl font-bold">{inf.name?.[0]}</div>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <h3 className="truncate text-lg font-bold text-white">{inf.name}</h3>
                  <span className="ml-auto rounded-full bg-black/25 px-2 py-1 text-xs">#{index + 1}</span>
                </div>
                <p className="text-xs text-white/55">{inf.category || 'Sin categor\u00eda'}</p>
                <p className="mt-2 truncate text-xs text-white/70">{[inf.tiktok, inf.instagram, inf.facebook].filter(Boolean).join(' - ')}</p>
              </div>
            </div>
            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <MiniMetric label="Views" value={formatNumber(inf.organic.views)} />
                <MiniMetric label="ETR" value={`${formatDecimal(inf.organic.etr)}%`} />
                <MiniMetric label="CPV" value={inf.cpv ? formatCurrency(inf.cpv) : 'Pend.'} />
                <MiniMetric label="Pauta" value={formatNumber(inf.paid.views6s)} />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs text-white/55">
                  <span>Contenidos</span>
                  <span>{inf.progress.published}/{inf.progress.planned || 'N/D'}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full" style={{ width: `${inf.progress.planned ? progress : 100}%`, background: theme.primary }} />
                </div>
              </div>
            </div>
          </button>
        )
      })}
      {!activeRollups.length && <EmptyState title="Sin colaboradores" text="No hay colaboradores para el filtro actual." />}
    </div>
  )
}

function ContentView({ contents, query, setQuery, onSelect }) {
  const filtered = contents
    .filter(row => !query || `${row.influencerName} ${row.platform} ${row.format} ${row.campaignName}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => safeNumber(b.views) - safeNumber(a.views))

  return (
    <div className="space-y-4">
      <div className="influencer-module p-4">
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input value={query} onChange={event => setQuery(event.target.value)} className="w-full rounded-lg border border-white/10 bg-white/8 py-3 pl-10 pr-4 text-sm text-white outline-none" placeholder="Buscar por influencer, campa\u00f1a o plataforma" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {filtered.map((row, index) => <ContentRow key={row.uid} content={row} index={index} onSelect={() => onSelect(row)} />)}
      </div>
      {!filtered.length && <EmptyState title="Sin contenidos" text="No hay contenidos para el filtro actual." />}
    </div>
  )
}

function PaidView({ paid, totals }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KPICard title="Views 6s" value={totals.views6s} icon={Eye} accentColor="#f59e0b" />
        <KPICard title="Alcance" value={totals.reach} icon={Users} accentColor="#22d3ee" />
        <KPICard title="CPV" value={totals.cpv} icon={Wallet} accentColor="#22c55e" formatter={formatCurrency} />
        <KPICard title="Interacciones" value={totals.interactions} icon={Heart} accentColor="#ec4899" />
        <KPICard title="Inversi\u00f3n pauta" value={totals.investment} icon={Megaphone} accentColor="#a78bfa" formatter={formatCurrency} />
      </div>
      <div className="influencer-module overflow-hidden">
        <div className="grid grid-cols-7 gap-3 border-b border-white/10 px-4 py-3 text-[10px] uppercase tracking-wider text-white/45">
          <span>Influencer</span><span>Plataforma</span><span>Views 6s</span><span>Alcance</span><span>Interacciones</span><span>CPV</span><span>Inversi&oacute;n</span>
        </div>
        {paid.length ? paid.map(row => {
          const interactions = safeNumber(row.likes) + safeNumber(row.comments) + safeNumber(row.shares) + safeNumber(row.saves)
          return (
            <div key={row.id} className="grid grid-cols-7 gap-3 border-b border-white/5 px-4 py-3 text-sm">
              <span className="truncate text-white">{row.influencerId}</span>
              <span className="text-white/60">{row.platform || '-'}</span>
              <span>{formatNumber(row.views6s)}</span>
              <span>{formatNumber(row.reach)}</span>
              <span>{formatNumber(interactions)}</span>
              <span>{formatCurrency(row.views6s > 0 ? row.investment / row.views6s : 0)}</span>
              <span>{formatCurrency(row.investment)}</span>
            </div>
          )
        }) : <EmptyState title="Sin datos de pauta" text="La pesta\u00f1a Pauta_Influencers esta lista para capturar estos resultados." />}
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
      <div className="influencer-module p-5">
        <h3 className="mb-4 font-bold text-white">Sentiment destacado</h3>
        <div className="flex h-8 overflow-hidden rounded-full bg-white/10">
          <div style={{ width: `${pct('Positivo')}%` }} className="bg-emerald-500" />
          <div style={{ width: `${pct('Neutro')}%` }} className="bg-amber-400" />
          <div style={{ width: `${pct('Negativo')}%` }} className="bg-red-500" />
        </div>
        <div className="mt-3 flex gap-5 text-sm text-white/65">
          <span>Positivo {formatDecimal(pct('Positivo'))}%</span>
          <span>Neutro {formatDecimal(pct('Neutro'))}%</span>
          <span>Negativo {formatDecimal(pct('Negativo'))}%</span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {sentiment.map(row => (
          <div key={`${row.id}-${row.screenshot}`} className="influencer-module overflow-hidden">
            <div className="aspect-[4/3] bg-black/30">
              {row.screenshot ? <iframe src={toDrivePreview(row.screenshot)} className="h-full w-full border-0" /> : <div className="grid h-full w-full place-items-center text-white/30">Sin captura</div>}
            </div>
            <div className="p-4">
              <p className="text-sm font-semibold text-white">{row.influencerName || row.influencerId}</p>
              <p className="mt-1 text-xs text-white/45">{row.platform} - {row.sentiment}</p>
              {row.text && <p className="mt-2 line-clamp-2 text-xs text-white/60">"{row.text}"</p>}
            </div>
          </div>
        ))}
        {!sentiment.length && <EmptyState title="Sin sentiment" text="No hay comentarios destacados para el filtro actual." />}
      </div>
    </div>
  )
}

function FindingsView({ findings, theme }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {findings.length ? findings.map(row => (
        <div key={row.id || row.title} className="influencer-module border-l-4 p-5" style={{ borderLeftColor: row.priority === 'high' ? '#ef4444' : row.priority === 'low' ? '#22c55e' : theme.primary }}>
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5" style={{ color: theme.primary }} />
            <div>
              <h3 className="font-bold text-white">{row.title}</h3>
              <p className="mt-1 text-xs text-white/45">{row.category || 'Insight'} - {row.priority || 'medium'}</p>
            </div>
          </div>
          {row.insight && <p className="mt-4 text-sm text-white/65">{row.insight}</p>}
          {row.recommendation && <p className="mt-3 rounded-lg bg-white/5 p-3 text-sm text-white/80">{row.recommendation}</p>}
        </div>
      )) : <EmptyState title="Sin hallazgos" text="Agrega insights en KeyFindings para esta marca o campa\u00f1a." />}
    </div>
  )
}

function InfluencerModal({ influencer, onClose }) {
  return (
    <Modal title={influencer.name} subtitle={influencer.category} onClose={onClose}>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniMetric label="Views" value={formatNumber(influencer.organic.views)} />
        <MiniMetric label="Interacciones" value={formatNumber(influencer.organic.interactions)} />
        <MiniMetric label="CPV org\u00e1nico" value={influencer.cpv ? formatCurrency(influencer.cpv) : 'Pend.'} />
        <MiniMetric label="Views 6s pauta" value={formatNumber(influencer.paid.views6s)} />
      </div>
      <div className="space-y-2">
        {influencer.contents.map(content => (
          <div key={content.uid} className="flex justify-between gap-3 rounded-lg bg-white/5 p-3">
            <div>
              <p className="text-sm font-semibold text-white">{content.platform} - {content.format}</p>
              <p className="text-xs text-white/45">{content.publishDate}</p>
            </div>
            <span className="font-mono text-sm text-white">{formatNumber(content.views)}</span>
          </div>
        ))}
      </div>
    </Modal>
  )
}

function ContentModal({ content, onClose }) {
  return (
    <Modal title={`${content.influencerName || content.influencerId} - ${content.format}`} subtitle={content.publishDate} onClose={onClose}>
      <ContentEmbedPreview content={content} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniMetric label="Views" value={formatNumber(content.views)} />
        <MiniMetric label="Reacciones" value={formatNumber(content.reactions)} />
        <MiniMetric label="Comentarios" value={formatNumber(content.comments)} />
        <MiniMetric label="Guardados" value={formatNumber(content.saves)} />
      </div>
      {content.url && !content.url.includes('<') && <a href={content.url} target="_blank" rel="noreferrer" className="inline-flex rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950">Abrir contenido</a>}
    </Modal>
  )
}

function ContentEmbedPreview({ content }) {
  const ref = useRef(null)
  const [failed, setFailed] = useState(false)
  const rawUrl = content?.url || content?.localVideoUrl || ''
  const embed = useMemo(() => buildContentEmbed(rawUrl, content?.platform), [rawUrl, content?.platform])

  useEffect(() => {
    setFailed(false)
  }, [rawUrl])

  useEffect(() => {
    if (!embed || embed.kind !== 'html' || !ref.current) return
    ref.current.innerHTML = embed.html
    normalizeEmbeddedIframes(ref.current)

    const html = embed.html.toLowerCase()
    if (html.includes('instagram')) {
      loadExternalScript('ig-embed', 'https://www.instagram.com/embed.js')
        .then(() => window.instgrm?.Embeds?.process(ref.current))
        .catch(() => setFailed(true))
    }
    if (html.includes('tiktok')) {
      loadExternalScript('tt-embed', 'https://www.tiktok.com/embed.js')
        .catch(() => setFailed(true))
    }
    if (html.includes('fb-post') || html.includes('facebook')) {
      loadExternalScript('fb-embed', 'https://connect.facebook.net/es_LA/sdk.js#xfbml=1&version=v19.0')
        .then(() => window.FB?.XFBML?.parse(ref.current))
        .catch(() => setFailed(true))
    }
  }, [embed])

  if (!rawUrl) {
    return (
      <div className="mb-5 flex aspect-video items-center justify-center rounded-lg border border-white/10 bg-black/25 text-sm text-white/40">
        Sin video embebido
      </div>
    )
  }

  if (failed || !embed) {
    return (
      <div className="mb-5 rounded-lg border border-white/10 bg-black/25 p-5 text-center">
        <p className="text-sm font-semibold text-white">No se pudo mostrar el embed</p>
        <a href={extractUrl(rawUrl)} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950">
          Abrir contenido
        </a>
      </div>
    )
  }

  if (embed.kind === 'html') {
    return (
      <div className="influencer-embed-shell mb-5 overflow-hidden rounded-lg border border-white/10 bg-black/25">
        <div ref={ref} className="influencer-embed-stage flex h-full w-full items-center justify-center p-3" />
      </div>
    )
  }

  return (
    <div className="influencer-embed-shell mb-5 overflow-hidden rounded-lg border border-white/10 bg-black/25">
      <iframe
        src={embed.src}
        title={`${content.platform || 'Contenido'} embed`}
        className="influencer-embed-iframe border-0 bg-white"
        style={{ height: `min(62vh, ${embed.height || 560}px)` }}
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
        allowFullScreen
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  )
}

function Modal({ title, subtitle, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md" onClick={onClose}>
      <div className="max-h-[94vh] w-full max-w-5xl overflow-auto rounded-lg border border-white/15 bg-zinc-950/92 shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <h2 className="text-xl font-bold text-white">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-white/50">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg bg-white/10 px-3 py-1.5 text-white/70">Cerrar</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

function MiniMetric({ label, value }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-white/5 p-3">
      <p className="truncate text-[10px] uppercase tracking-wider text-white/40">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-white md:text-base">{value}</p>
    </div>
  )
}

function JumpButton({ label, value, icon: Icon, onClick }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/8 text-white/70">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-white">{label}</span>
        <span className="block text-xs text-white/45">{value}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-white/35" />
    </button>
  )
}

function EmptyState({ title, text }) {
  return (
    <div className="col-span-full p-8 text-center text-white/50">
      <p className="font-semibold text-white/70">{title}</p>
      <p className="mt-1 text-sm">{text}</p>
    </div>
  )
}

function rankCampaignsByCpv(campaigns = []) {
  return campaigns
    .map(campaign => {
      const influencerCost = safeNumber(campaign.influencerCost)
      const paidInvestment = safeNumber(campaign.paid?.investment)
      const totalCost = influencerCost + paidInvestment
      const totalViews = safeNumber(campaign.organic?.views) + safeNumber(campaign.paid?.views6s)
      const organicCpv = influencerCost > 0 && campaign.organic?.views > 0 ? influencerCost / campaign.organic.views : null
      const paidCpv = paidInvestment > 0 && campaign.paid?.views6s > 0 ? paidInvestment / campaign.paid.views6s : null
      const totalCpv = totalCost > 0 && totalViews > 0 ? totalCost / totalViews : null
      return { ...campaign, totalCost, totalViews, organicCpv, paidCpv, totalCpv, bestCpv: totalCpv ?? organicCpv ?? paidCpv }
    })
    .filter(campaign => campaign.bestCpv !== null)
    .sort((a, b) => a.bestCpv - b.bestCpv)
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

function firstName(value) {
  return String(value || '').trim().split(/\s+/)[0] || ''
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

function buildContentEmbed(value, platform) {
  const raw = String(value || '').trim()
  if (!raw) return null
  if (raw.startsWith('<')) return { kind: 'html', html: raw }

  const url = extractUrl(raw)
  const lower = url.toLowerCase()
  if (lower.includes('tiktok.com')) {
    const videoId = url.match(/video\/(\d+)/)?.[1]
    if (videoId) {
      return {
        kind: 'html',
        html: `<blockquote class="tiktok-embed" cite="${url}" data-video-id="${videoId}" style="max-width:420px;min-width:280px;margin:0 auto;"><section></section></blockquote>`,
      }
    }
  }
  if (lower.includes('instagram.com')) {
    const clean = url.split('?')[0].replace(/\/$/, '')
    return { kind: 'iframe', src: `${clean}/embed`, height: 560 }
  }
  if (lower.includes('facebook.com')) {
    return {
      kind: 'iframe',
      src: `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url)}&show_text=true&width=500`,
      height: 540,
    }
  }
  if (lower.match(/\.(mp4|webm|mov)(\?|$)/)) {
    return { kind: 'html', html: `<video src="${url}" controls playsinline style="width:100%;max-height:620px;border-radius:12px;background:#000;"></video>` }
  }
  if (platform && /tiktok/i.test(platform)) return null
  return { kind: 'iframe', src: url, height: 560 }
}

function extractUrl(value) {
  const raw = String(value || '').trim()
  const href = raw.match(/href=["']([^"']+)["']/i)?.[1]
  const cite = raw.match(/cite=["']([^"']+)["']/i)?.[1]
  const src = raw.match(/src=["']([^"']+)["']/i)?.[1]
  return href || cite || src || raw
}

function normalizeEmbeddedIframes(container) {
  container.querySelectorAll('blockquote').forEach(blockquote => {
    blockquote.style.maxWidth = '100%'
    blockquote.style.maxHeight = '100%'
    blockquote.style.minHeight = '0'
    blockquote.style.margin = '0 auto'
    blockquote.style.overflow = 'hidden'
  })
  container.querySelectorAll('video').forEach(video => {
    video.style.maxWidth = '100%'
    video.style.maxHeight = '100%'
    video.style.width = 'auto'
    video.style.height = '100%'
    video.style.objectFit = 'contain'
  })
  container.querySelectorAll('iframe').forEach(iframe => {
    iframe.style.maxWidth = '100%'
    iframe.style.width = 'min(100%, 420px)'
    iframe.style.height = '100%'
    iframe.style.maxHeight = '100%'
    iframe.style.border = '0'
    iframe.style.display = 'block'
    iframe.style.margin = '0 auto'
    iframe.setAttribute('loading', 'lazy')
    iframe.setAttribute('scrolling', 'no')
  })
}

function loadExternalScript(id, src) {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(id)
    if (existing) {
      resolve(existing)
      return
    }
    const script = document.createElement('script')
    script.id = id
    script.src = src
    script.async = true
    script.onload = () => resolve(script)
    script.onerror = reject
    document.body.appendChild(script)
  })
}

function toDrivePreview(url) {
  const raw = String(url || '')
  const match = raw.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) || raw.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (match) return `https://drive.google.com/file/d/${match[1]}/preview`
  return raw
}
