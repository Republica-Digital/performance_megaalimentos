import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, BarChart3, CalendarDays, Camera, ChevronRight, ExternalLink, Eye,
  Heart, Loader2, Megaphone, MessageSquare, PlayCircle, RefreshCw, Search,
  Sparkles, Trophy, Users, Wallet, X,
} from 'lucide-react'
import { useInfluencerData } from '../hooks/useInfluencerData'
import { drivePreview, platformColors, sortByMetric } from '../utils/influencerMetrics'
import { formatCurrency, formatDecimal, formatNumber, safeNumber } from '../utils/format'

const rankingOptions = [
  { key: 'organicViews', label: 'Views orgánicas' },
  { key: 'interactions', label: 'Interacciones' },
  { key: 'er', label: 'ER' },
  { key: 'organicCpv', label: 'CPV orgánico' },
  { key: 'paidViews', label: 'Views pauta' },
  { key: 'paidCpv', label: 'CPV pauta' },
  { key: 'totalImpact', label: 'Impacto total' },
]

const contentSortOptions = [
  { key: 'organicViews', label: 'Más views' },
  { key: 'interactions', label: 'Más interacciones' },
  { key: 'er', label: 'Mejor ER' },
  { key: 'organicCpv', label: 'Menor CPV' },
]

export function InfluencerDashboard() {
  const { marcaId } = useParams()
  const navigate = useNavigate()
  const { data, loading, error, refresh } = useInfluencerData(marcaId)
  const [selectedCampaignId, setSelectedCampaignId] = useState(null)
  const [rankingMetric, setRankingMetric] = useState('organicViews')
  const [selectedContent, setSelectedContent] = useState(null)
  const [selectedInfluencer, setSelectedInfluencer] = useState(null)
  const [selectedPaid, setSelectedPaid] = useState(null)

  const theme = useMemo(() => ({
    primary: data?.brand?.color || '#FF6B00',
    accent: data?.brand?.accent || '#FFD700',
    bg: data?.brand?.slug === 'chamoy-mega'
      ? '#110815'
      : data?.brand?.slug === 'pacific-mix'
        ? '#07101F'
        : '#130905',
  }), [data])

  const selectedCampaign = useMemo(
    () => data?.campaigns.find(campaign => campaign.id === selectedCampaignId) || null,
    [data, selectedCampaignId]
  )

  if (error) {
    return (
      <Shell theme={theme}>
        <div className="grid min-h-screen place-items-center p-6">
          <div className="influencer-module max-w-md p-8 text-center">
            <h1 className="mb-2 text-xl font-bold text-white">No se pudo cargar influencers</h1>
            <p className="mb-5 text-sm text-white/60">{error}</p>
            <button onClick={refresh} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950">Reintentar</button>
          </div>
        </div>
      </Shell>
    )
  }

  return (
    <Shell theme={theme}>
      <Header
        brand={data?.brand}
        loading={loading}
        onBack={() => navigate('/')}
        onRefresh={refresh}
        onHome={() => setSelectedCampaignId(null)}
        selectedCampaign={selectedCampaign}
        theme={theme}
      />

      <main className="relative mx-auto max-w-[1480px] px-4 pb-12 pt-5 md:px-6">
        {loading || !data ? (
          <LoadingState />
        ) : selectedCampaign ? (
          <CampaignDetail
            campaign={selectedCampaign}
            onBack={() => setSelectedCampaignId(null)}
            onContentSelect={setSelectedContent}
            onInfluencerSelect={setSelectedInfluencer}
            onPaidSelect={setSelectedPaid}
            theme={theme}
          />
        ) : (
          <BrandHome
            data={data}
            rankingMetric={rankingMetric}
            onRankingChange={setRankingMetric}
            onCampaignSelect={setSelectedCampaignId}
            onContentSelect={setSelectedContent}
            onInfluencerSelect={setSelectedInfluencer}
            theme={theme}
          />
        )}
      </main>

      {selectedContent && (
        <ContentModal
          content={selectedContent.content}
          campaign={selectedContent.campaign}
          influencer={selectedContent.influencer}
          evidences={selectedContent.evidences || []}
          onClose={() => setSelectedContent(null)}
        />
      )}
      {selectedInfluencer && (
        <InfluencerModal
          influencer={selectedInfluencer.influencer}
          campaign={selectedInfluencer.campaign}
          onContentSelect={content => setSelectedContent({
            content,
            campaign: selectedInfluencer.campaign,
            influencer: selectedInfluencer.influencer,
            evidences: selectedInfluencer.campaign.evidences.filter(evidence => evidence.contentId === content.id),
          })}
          onClose={() => setSelectedInfluencer(null)}
        />
      )}
      {selectedPaid && <PaidModal paid={selectedPaid} onClose={() => setSelectedPaid(null)} />}
    </Shell>
  )
}

function Shell({ theme, children }) {
  return (
    <div
      className="min-h-screen text-white"
      style={{
        background: `linear-gradient(135deg, ${theme.bg} 0%, #09090b 52%, ${theme.bg} 100%)`,
      }}
    >
      <div className="fixed inset-0 pointer-events-none opacity-70" style={{ background: `linear-gradient(180deg, ${theme.primary}18, transparent 34%)` }} />
      {children}
    </div>
  )
}

function Header({ brand, loading, selectedCampaign, onBack, onRefresh, onHome, theme }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-zinc-950/78 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-[1480px] flex-col gap-3 px-4 py-4 md:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={onBack} className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/6 text-white/70 hover:bg-white/10 hover:text-white" title="Cambiar marca">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button onClick={onHome} className="min-w-0 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/45">Influencer marketing</p>
              <h1 className="font-display text-xl font-bold text-white md:text-2xl">{brand?.name || 'Influencers'}</h1>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedCampaign && (
              <button onClick={onHome} className="rounded-lg border border-white/10 bg-white/6 px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10">
                Histórico de marca
              </button>
            )}
            <button onClick={onRefresh} className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/6 text-white/70 hover:bg-white/10 hover:text-white" title="Actualizar">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {selectedCampaign && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/50">
            <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5">{selectedCampaign.name}</span>
            <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5">{formatDateRange(selectedCampaign.startDate, selectedCampaign.endDate)}</span>
            <span className="rounded-full px-3 py-1.5 font-semibold" style={{ background: `${theme.primary}22`, color: theme.primary }}>{selectedCampaign.status || 'Activa'}</span>
          </div>
        )}
      </div>
    </header>
  )
}

function LoadingState() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map(item => <div key={item} className="h-28 rounded-lg skeleton" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-96 rounded-lg skeleton" />
        <div className="h-96 rounded-lg skeleton" />
      </div>
    </div>
  )
}

function BrandHome({ data, rankingMetric, onRankingChange, onCampaignSelect, onContentSelect, onInfluencerSelect, theme }) {
  const yearLabel = getYearLabel(data.campaigns)
  const phrase = `Durante ${yearLabel}, ${data.brand.name} ha realizado ${data.totals.campaigns} campañas con influencers, colaborando con ${data.totals.influencers} participaciones y generando ${formatNumber(data.totals.organicViews)} views orgánicas.`

  const rankedCampaigns = sortByMetric(data.campaigns, rankingMetric).slice(0, 5)
  const rankedInfluencers = sortByMetric(
    data.campaigns.flatMap(campaign => campaign.rollups.map(influencer => ({ ...influencer, campaign }))),
    rankingMetric
  ).slice(0, 5)
  const rankedContents = sortByMetric(
    data.campaigns.flatMap(campaign => campaign.contents.map(content => decorateContent(content, campaign))),
    rankingMetric
  ).slice(0, 6)

  return (
    <div className="space-y-6">
      <section className="influencer-module p-5 md:p-7">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/45">Home histórico de marca</p>
            <h2 className="font-display text-3xl font-bold text-white md:text-5xl">{data.brand.name}</h2>
            <p className="mt-4 max-w-4xl text-base leading-7 text-white/68">{phrase}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Campañas realizadas" value={formatNumber(data.totals.campaigns)} />
            <Metric label="Influencers" value={formatNumber(data.totals.influencers)} />
            <Metric label="Contenidos" value={formatNumber(data.totals.contents)} />
            <Metric label="CPV total" value={formatMaybeCurrency(data.totals.totalCpv)} />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-6">
        <MetricCard title="Views orgánicas" value={formatNumber(data.totals.organicViews)} icon={Eye} color={theme.primary} />
        <MetricCard title="Views pauta" value={data.totals.paidViews ? formatNumber(data.totals.paidViews) : 'Sin pauta'} icon={Megaphone} color="#f59e0b" />
        <MetricCard title="Interacciones" value={formatNumber(data.totals.totalInteractions)} icon={Heart} color="#ec4899" />
        <MetricCard title="Inversión influencers" value={formatMaybeCurrency(data.totals.influencerInvestment)} icon={Users} color="#22c55e" />
        <MetricCard title="Inversión pauta" value={data.totals.paidInvestment ? formatCurrency(data.totals.paidInvestment) : 'Pendiente'} icon={Wallet} color="#a78bfa" />
        <MetricCard title="ER promedio" value={formatMaybePercent(data.totals.er)} icon={BarChart3} color="#38bdf8" />
      </section>

      <Module eyebrow="Timeline" title="Campañas de influencer marketing" icon={CalendarDays} theme={theme}>
        <div className="grid gap-3 xl:grid-cols-2">
          {data.campaigns.map(campaign => (
            <CampaignTimelineCard key={campaign.id} campaign={campaign} onSelect={() => onCampaignSelect(campaign.id)} theme={theme} />
          ))}
        </div>
      </Module>

      <Module eyebrow="Rankings históricos" title="Comparativos de resultados" icon={Trophy} theme={theme}>
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {rankingOptions.map(option => (
            <Chip key={option.key} active={rankingMetric === option.key} onClick={() => onRankingChange(option.key)}>
              {option.label}
            </Chip>
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          <RankingList title="Top campañas" rows={rankedCampaigns} renderRow={(campaign, index) => (
            <CampaignRankingRow key={campaign.id} campaign={campaign} index={index} onSelect={() => onCampaignSelect(campaign.id)} theme={theme} />
          )} />
          <RankingList title="Top colaboradores" rows={rankedInfluencers} renderRow={(influencer, index) => (
            <InfluencerRankingRow key={`${influencer.campaign.id}-${influencer.id}`} influencer={influencer} index={index} onSelect={() => onInfluencerSelect({ influencer, campaign: influencer.campaign })} theme={theme} />
          )} />
          <RankingList title="Top contenidos" rows={rankedContents} renderRow={(content, index) => (
            <ContentRankingRow key={content.id} content={content} index={index} onSelect={() => onContentSelect({
              content,
              campaign: content.campaign,
              influencer: content.influencer,
              evidences: content.campaign.evidences.filter(evidence => evidence.contentId === content.id),
            })} theme={theme} />
          )} />
        </div>
      </Module>
    </div>
  )
}

function CampaignTimelineCard({ campaign, onSelect, theme }) {
  const paidLabel = campaign.paidRows.length
    ? formatNumber(campaign.paid.views)
    : campaign.includesPaid
      ? 'Pendiente'
      : 'Sin pauta'

  return (
    <button onClick={onSelect} className="w-full rounded-lg border border-white/10 bg-white/5 p-4 text-left transition-colors hover:bg-white/10">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full px-2 py-1 text-[10px] font-bold uppercase" style={{ background: `${theme.primary}22`, color: theme.primary }}>{campaign.status || 'Activa'}</span>
            <span className="text-xs text-white/45">{formatDateRange(campaign.startDate, campaign.endDate)}</span>
          </div>
          <h3 className="font-display text-lg font-bold text-white">{campaign.name}</h3>
          <p className="mt-2 line-clamp-2 text-sm text-white/55">{campaign.objective || campaign.description}</p>
        </div>
        <ChevronRight className="hidden h-5 w-5 text-white/35 md:block" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5">
        <Metric label="Influencers" value={formatNumber(campaign.influencerCount)} />
        <Metric label="Contenidos" value={formatNumber(campaign.contentCount)} />
        <Metric label="Views org." value={formatNumber(campaign.organic.views)} />
        <Metric label="Views pauta" value={paidLabel} />
        <Metric label="CPV" value={formatMaybeCurrency(campaign.totalCpv || campaign.organicCpv)} />
      </div>
      <div className="mt-4 inline-flex items-center gap-2 text-xs font-semibold" style={{ color: theme.primary }}>
        Ver campa&ntilde;a <ChevronRight className="h-3.5 w-3.5" />
      </div>
    </button>
  )
}

function CampaignDetail({ campaign, onBack, onContentSelect, onInfluencerSelect, onPaidSelect, theme }) {
  return (
    <div className="space-y-6">
      <section className="influencer-module p-5 md:p-7">
        <button onClick={onBack} className="mb-5 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/6 px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10">
          <ArrowLeft className="h-3.5 w-3.5" /> Volver al hist&oacute;rico
        </button>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/45">Detalle de campa&ntilde;a</p>
            <h2 className="font-display text-3xl font-bold text-white md:text-5xl">{campaign.name}</h2>
            <p className="mt-2 text-sm text-white/55">{formatDateRange(campaign.startDate, campaign.endDate)} - {campaign.type || 'Campaña'}</p>
            <p className="mt-4 max-w-4xl text-sm leading-6 text-white/68">{campaign.objective || campaign.description || 'Objetivo pendiente de carga.'}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Influencers" value={formatNumber(campaign.influencerCount)} />
            <Metric label="Contenidos" value={formatNumber(campaign.contentCount)} />
            <Metric label="Inversión influencers" value={formatMaybeCurrency(campaign.influencerCost)} />
            <Metric label="Inversión pauta" value={campaign.paidRows.length ? formatCurrency(campaign.paid.investment) : emptyPaidLabel(campaign)} />
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <ResultPanel title="Orgánico de influencers" icon={Users} color={theme.primary} items={[
          ['Views orgánicas', formatNumber(campaign.organic.views)],
          ['Interacciones', formatNumber(campaign.organic.interactions)],
          ['ER', formatMaybePercent(campaign.organic.er)],
          ['CPV orgánico', formatMaybeCurrency(campaign.organicCpv)],
        ]} />
        <ResultPanel title="Pauta de contenidos" icon={Megaphone} color="#f59e0b" empty={!campaign.paidRows.length} emptyText={emptyPaidLabel(campaign)} items={[
          ['Inversión pauta', formatMaybeCurrency(campaign.paid.investment)],
          ['Alcance', formatNumber(campaign.paid.reach)],
          ['Views pauta', formatNumber(campaign.paid.views)],
          ['CPV pauta', formatMaybeCurrency(campaign.paid.cpv)],
        ]} />
        <ResultPanel title="Total combinado" icon={BarChart3} color="#22c55e" items={[
          ['Inversión total', formatMaybeCurrency(campaign.totalInvestment)],
          ['Views totales', formatNumber(campaign.totalViews)],
          ['Interacciones totales', formatNumber(campaign.totalInteractions)],
          ['CPV total', formatMaybeCurrency(campaign.totalCpv)],
        ]} />
      </div>

      <InfluencerCampaignSection campaign={campaign} onInfluencerSelect={onInfluencerSelect} theme={theme} />
      <CampaignContentSection campaign={campaign} onContentSelect={onContentSelect} theme={theme} />
      <CampaignPaidSection campaign={campaign} onContentSelect={onContentSelect} onPaidSelect={onPaidSelect} theme={theme} />
      <CampaignSentimentSection campaign={campaign} onContentSelect={onContentSelect} theme={theme} />
      <CampaignFindingsSection campaign={campaign} theme={theme} />
    </div>
  )
}

function ResultPanel({ title, icon: Icon, color, items, empty, emptyText }) {
  return (
    <section className="influencer-module p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-bold text-white">{title}</h3>
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-white/8" style={{ color }}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      {empty ? (
        <p className="rounded-lg border border-dashed border-white/15 bg-white/5 p-4 text-sm text-white/55">{emptyText}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {items.map(([label, value]) => <Metric key={label} label={label} value={value} />)}
        </div>
      )}
    </section>
  )
}

function InfluencerCampaignSection({ campaign, onInfluencerSelect, theme }) {
  return (
    <Module eyebrow="Orgánico por influencer" title="Colaboradores participantes" icon={Users} theme={theme}>
      <div className="grid gap-4 xl:grid-cols-2">
        {campaign.rollups.map(influencer => (
          <button key={influencer.id} onClick={() => onInfluencerSelect({ influencer, campaign })} className="rounded-lg border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10">
            <div className="flex gap-4">
              <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-white/10">
                {influencer.photo ? <img src={influencer.photo} alt={influencer.name} className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-xl font-bold">{initials(influencer.name)}</div>}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-lg font-bold text-white">{influencer.name}</h3>
                <p className="text-xs text-white/50">{influencer.niche || 'Sin nicho'} - {influencer.platforms.join(', ') || 'Plataformas pendientes'}</p>
                <p className="mt-2 text-xs text-white/45">{Object.values(influencer.usernames).filter(Boolean).join(' - ')}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
              <Metric label="Costo neto" value={formatMaybeCurrency(influencer.netFee)} />
              <Metric label="Contenidos" value={formatNumber(influencer.contents.length)} />
              <Metric label="Views" value={formatNumber(influencer.organic.views)} />
              <Metric label="CPV" value={formatMaybeCurrency(influencer.cpv)} />
            </div>
            {influencer.progress.hasProjection && (
              <ProjectionProgress influencer={influencer} theme={theme} />
            )}
            <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
              <div className="grid grid-cols-5 gap-2 bg-white/6 px-3 py-2 text-[10px] uppercase tracking-wider text-white/40">
                <span>Plataforma</span><span>Cont.</span><span>Views</span><span>ER</span><span>CPV</span>
              </div>
              {influencer.platformBreakdown.map(row => (
                <div key={row.platform} className="grid grid-cols-5 gap-2 border-t border-white/6 px-3 py-2 text-xs text-white/70">
                  <span>{row.platform}</span>
                  <span>{formatNumber(row.contents)}</span>
                  <span>{formatNumber(row.views)}</span>
                  <span>{formatMaybePercent(row.er)}</span>
                  <span>{formatMaybeCurrency(row.cpv)}</span>
                </div>
              ))}
            </div>
          </button>
        ))}
      </div>
    </Module>
  )
}

function ProjectionProgress({ influencer, theme }) {
  const pct = influencer.projectedViews > 0 ? Math.min((safeNumber(influencer.organic.views) / influencer.projectedViews) * 100, 100) : 0
  return (
    <div className="mt-4">
      <div className="mb-1 flex justify-between text-xs text-white/55">
        <span>Proyecci&oacute;n vs real</span>
        <span>{formatNumber(influencer.organic.views)} / {formatNumber(influencer.projectedViews)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: theme.primary }} />
      </div>
    </div>
  )
}

function CampaignContentSection({ campaign, onContentSelect, theme }) {
  const [sortKey, setSortKey] = useState('organicViews')
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')

  const platforms = [...new Set(campaign.contents.map(content => content.platform).filter(Boolean))]
  const filtered = campaign.contents.filter(content => {
    if (filter === 'paid' && !content.hasPaid) return false
    if (filter === 'organic' && content.hasPaid) return false
    if (platforms.includes(filter) && content.platform !== filter) return false
    if (query && !`${content.influencerName} ${content.platform} ${content.format} ${content.caption}`.toLowerCase().includes(query.toLowerCase())) return false
    return true
  })
  const sorted = sortByMetric(filtered.map(content => decorateContent(content, campaign)), sortKey)

  return (
    <Module eyebrow="Contenidos de campaña" title="Piezas publicadas" icon={Camera} theme={theme}>
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative max-w-xl flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input value={query} onChange={event => setQuery(event.target.value)} className="w-full rounded-lg border border-white/10 bg-white/8 py-3 pl-10 pr-4 text-sm text-white outline-none" placeholder="Buscar por influencer, plataforma o caption" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {contentSortOptions.map(option => <Chip key={option.key} active={sortKey === option.key} onClick={() => setSortKey(option.key)}>{option.label}</Chip>)}
        </div>
      </div>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>Todo</Chip>
        <Chip active={filter === 'paid'} onClick={() => setFilter('paid')}>Con pauta</Chip>
        <Chip active={filter === 'organic'} onClick={() => setFilter('organic')}>Sin pauta</Chip>
        {platforms.map(platform => <Chip key={platform} active={filter === platform} onClick={() => setFilter(platform)}>{platform}</Chip>)}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sorted.map(content => (
          <ContentCard key={content.id} content={content} onSelect={() => onContentSelect({
            content,
            campaign,
            influencer: content.influencer,
            evidences: campaign.evidences.filter(evidence => evidence.contentId === content.id),
          })} theme={theme} />
        ))}
      </div>
      {!sorted.length && <EmptyState title="Sin contenidos" text="No hay piezas para esta selección." />}
    </Module>
  )
}

function ContentCard({ content, onSelect, theme }) {
  return (
    <button onClick={onSelect} className="group overflow-hidden rounded-lg border border-white/10 bg-white/5 text-left transition-colors hover:bg-white/10">
      <div className="relative aspect-video bg-black/35">
        {content.thumbnail ? (
          <img src={content.thumbnail} alt={content.caption || content.id} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-white/35">
            <PlayCircle className="h-10 w-10" />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded px-2 py-1 text-[10px] font-bold uppercase" style={{ background: `${platformColors[content.platform] || theme.primary}22`, color: platformColors[content.platform] || theme.primary }}>
          {content.platform || 'Contenido'}
        </span>
        {content.hasPaid && <span className="absolute right-3 top-3 rounded bg-amber-400/20 px-2 py-1 text-[10px] font-bold uppercase text-amber-200">Con pauta</span>}
      </div>
      <div className="p-4">
        <p className="font-semibold text-white">{content.influencerName}</p>
        <p className="mt-1 text-xs text-white/45">{content.format || 'Formato pendiente'} - {formatShortDate(content.publishDate)}</p>
        <p className="mt-3 line-clamp-2 min-h-[34px] text-xs text-white/55">{content.caption || content.originType || 'Sin caption capturado.'}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Metric label="Views" value={formatNumber(content.views)} />
          <Metric label="ER" value={formatMaybePercent(content.organicEr)} />
          <Metric label="CPV" value={formatMaybeCurrency(content.organicCpv)} />
        </div>
      </div>
    </button>
  )
}

function CampaignPaidSection({ campaign, onContentSelect, onPaidSelect, theme }) {
  if (!campaign.paidRows.length) {
    return (
      <Module eyebrow="Pauta de contenido" title="Resultados pagados" icon={Megaphone} theme={theme}>
        <EmptyState title={emptyPaidLabel(campaign)} text="Cuando se carguen resultados en 04_Pauta_TikTok o 05_Pauta_Meta, aparecerán aquí ligados a contenido, influencer y campaña." />
      </Module>
    )
  }

  const bestPaid = [...campaign.paidRows].sort((a, b) => safeNumber(b.views) - safeNumber(a.views))[0]
  const bestPlatform = bestNetwork(campaign.paidRows)

  return (
    <Module eyebrow="Pauta de contenido" title="Resultados pagados" icon={Megaphone} theme={theme}>
      <div className="mb-4 grid grid-cols-2 gap-2 xl:grid-cols-5">
        <Metric label="Inversión" value={formatCurrency(campaign.paid.investment)} />
        <Metric label="Alcance" value={formatNumber(campaign.paid.reach)} />
        <Metric label="Impresiones" value={formatNumber(campaign.paid.impressions)} />
        <Metric label="Views pauta" value={formatNumber(campaign.paid.views)} />
        <Metric label="CPV" value={formatMaybeCurrency(campaign.paid.cpv)} />
        <Metric label="CTR" value={formatMaybePercent(campaign.paid.ctr)} />
        <Metric label="CPM" value={formatMaybeCurrency(campaign.paid.cpm)} />
        <Metric label="Clics" value={formatNumber(campaign.paid.clicks)} />
        <Metric label="Mejor contenido" value={bestPaid?.influencerName || '-'} />
        <Metric label="Mejor eficiencia" value={bestPlatform || '-'} />
      </div>
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-9 gap-3 bg-white/6 px-4 py-3 text-[10px] uppercase tracking-wider text-white/40">
            <span>Contenido</span><span>Influencer</span><span>Red</span><span>Pautado desde</span><span>Inversión</span><span>Views</span><span>Alcance</span><span>CPV</span><span>CTR</span>
          </div>
          {campaign.paidRows.map(row => {
            const content = campaign.contents.find(item => item.id === row.contentId)
            return (
              <button key={row.id} onClick={() => content ? onContentSelect({
                content: decorateContent(content, campaign),
                campaign,
                influencer: campaign.rollups.find(item => item.id === content.influencerCampaignId),
                evidences: campaign.evidences.filter(evidence => evidence.contentId === content.id),
              }) : onPaidSelect(row)} className="grid w-full min-w-[980px] grid-cols-9 gap-3 border-t border-white/6 px-4 py-3 text-left text-xs text-white/70 hover:bg-white/5">
                <span className="truncate">{row.contentId || '-'}</span>
                <span className="truncate">{row.influencerName}</span>
                <span>{row.network}</span>
                <span className="truncate">{row.paidFrom || '-'}</span>
                <span>{formatCurrency(row.investment)}</span>
                <span>{formatNumber(row.views)}</span>
                <span>{formatNumber(row.reach)}</span>
                <span>{formatMaybeCurrency(row.cpv || (row.views > 0 ? row.investment / row.views : null))}</span>
                <span>{formatMaybePercent(row.ctr)}</span>
              </button>
            )
          })}
        </div>
      </div>
    </Module>
  )
}

function CampaignSentimentSection({ campaign, onContentSelect, theme }) {
  const latest = campaign.sentiment[0]
  return (
    <Module eyebrow="Sentiment" title="Lectura cualitativa de campaña" icon={MessageSquare} theme={theme}>
      {!latest ? (
        <EmptyState title="Sentiment pendiente de carga" text="No hay registros válidos ligados a este campaign_id." />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="space-y-4">
            <div className="flex h-4 overflow-hidden rounded-full bg-white/10">
              <div className="bg-emerald-500" style={{ width: `${latest.positivePct}%` }} />
              <div className="bg-amber-400" style={{ width: `${latest.neutralPct}%` }} />
              <div className="bg-red-500" style={{ width: `${latest.negativePct}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Metric label="Positivo" value={`${formatDecimal(latest.positivePct)}%`} />
              <Metric label="Neutro" value={`${formatDecimal(latest.neutralPct)}%`} />
              <Metric label="Negativo" value={`${formatDecimal(latest.negativePct)}%`} />
            </div>
            <p className="text-sm leading-6 text-white/68">{latest.summary}</p>
            <Qualitative label="Temas recurrentes" value={latest.themes} />
            <Qualitative label="Dudas/fricciones" value={latest.frictions} />
            <Qualitative label="Oportunidades" value={latest.opportunities} />
          </div>
          <EvidenceCarousel campaign={campaign} onContentSelect={onContentSelect} />
        </div>
      )}
    </Module>
  )
}

function EvidenceCarousel({ campaign, onContentSelect }) {
  if (!campaign.evidences.length) {
    return <EmptyState title="Sin evidencias visibles" text="No hay comentarios destacados válidos para esta campaña." />
  }
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {campaign.evidences.map(evidence => {
        const content = campaign.contents.find(item => item.id === evidence.contentId)
        return (
          <div key={evidence.id} className="min-w-[260px] overflow-hidden rounded-lg border border-white/10 bg-white/5">
            <div className="aspect-[4/3] bg-black/30">
              {evidence.screenshot ? <iframe src={evidence.screenshot} className="h-full w-full border-0" title={evidence.id} /> : <div className="grid h-full place-items-center text-white/30">Sin screenshot</div>}
            </div>
            <div className="p-3">
              <p className="text-sm font-semibold text-white">{evidence.influencerName || evidence.platform}</p>
              <p className="mt-1 text-xs text-white/45">{evidence.sentiment} - {evidence.topic || evidence.commentType}</p>
              {evidence.text && <p className="mt-2 line-clamp-2 text-xs text-white/60">{evidence.text}</p>}
              {content && (
                <button onClick={() => onContentSelect({
                  content: decorateContent(content, campaign),
                  campaign,
                  influencer: campaign.rollups.find(item => item.id === content.influencerCampaignId),
                  evidences: campaign.evidences.filter(item => item.contentId === content.id),
                })} className="mt-3 text-xs font-semibold text-white/75 hover:text-white">
                  Ver contenido asociado
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CampaignFindingsSection({ campaign, theme }) {
  return (
    <Module eyebrow="Cierre narrativo" title="Hallazgos y recomendaciones" icon={Sparkles} theme={theme}>
      {!campaign.findings.length ? (
        <EmptyState title="Hallazgos pendientes" text="No hay hallazgos visibles para dashboard ligados a esta campaña." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {campaign.findings.map(finding => (
            <article key={finding.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">{finding.category || 'Hallazgo'} - {finding.priority || 'Media'}</p>
                  <h3 className="mt-1 font-bold text-white">{finding.title}</h3>
                </div>
              </div>
              {finding.insight && <p className="text-sm leading-6 text-white/65">{finding.insight}</p>}
              {finding.recommendation && <p className="mt-3 rounded-lg bg-white/6 p-3 text-sm text-white/80">{finding.recommendation}</p>}
              {finding.nextAction && <p className="mt-3 text-xs text-white/45">Acci&oacute;n siguiente: {finding.nextAction}</p>}
            </article>
          ))}
        </div>
      )}
    </Module>
  )
}

function ContentModal({ content, campaign, influencer, evidences, onClose }) {
  return (
    <Modal title={content.id} subtitle={`${campaign.name} - ${content.influencerName}`} onClose={onClose}>
      <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.75fr)_minmax(0,1fr)]">
        <div>
          <ContentEmbedPreview content={content} />
          <div className="mt-3 flex flex-wrap gap-2">
            {content.url && <a href={content.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-zinc-950">Abrir original <ExternalLink className="h-3.5 w-3.5" /></a>}
          </div>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Metric label="Views org." value={formatNumber(content.views)} />
            <Metric label="Interacciones org." value={formatNumber(content.organicInteractions)} />
            <Metric label="ER org." value={formatMaybePercent(content.organicEr)} />
            <Metric label="CPV org." value={formatMaybeCurrency(content.organicCpv)} />
            <Metric label="Views pauta" value={content.hasPaid ? formatNumber(content.paid.views) : 'Sin pauta'} />
            <Metric label="Inversión pauta" value={content.hasPaid ? formatCurrency(content.paid.investment) : 'Sin pauta'} />
            <Metric label="Views totales" value={formatNumber(content.totalViews)} />
            <Metric label="Interacciones totales" value={formatNumber(content.totalInteractions)} />
          </div>
          <Qualitative label="Caption" value={content.caption || 'Sin caption capturado.'} />
          <Qualitative label="Tipo de publicación" value={content.originType || 'Pendiente'} />
          <Qualitative label="Fuente de dato" value={content.dataSource || 'Pendiente'} />
          {influencer && <Qualitative label="Inversión influencer atribuida" value={formatMaybeCurrency(influencer.netFee)} />}
          <EvidenceList evidences={evidences} />
        </div>
      </div>
    </Modal>
  )
}

function InfluencerModal({ influencer, campaign, onContentSelect, onClose }) {
  return (
    <Modal title={influencer.name} subtitle={`${campaign.name} - ${influencer.niche || 'Colaborador'}`} onClose={onClose}>
      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="influencer-module overflow-hidden">
          <div className="aspect-square bg-white/8">
            {influencer.photo ? <img src={influencer.photo} alt={influencer.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-4xl font-bold">{initials(influencer.name)}</div>}
          </div>
          <div className="space-y-2 p-4 text-sm text-white/65">
            {Object.entries(influencer.usernames).filter(([, value]) => value).map(([platform, value]) => <p key={platform}>{platform}: {value}</p>)}
          </div>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Metric label="Costo neto" value={formatMaybeCurrency(influencer.netFee)} />
            <Metric label="Views org." value={formatNumber(influencer.organic.views)} />
            <Metric label="ER" value={formatMaybePercent(influencer.organic.er)} />
            <Metric label="CPV" value={formatMaybeCurrency(influencer.cpv)} />
          </div>
          <div className="overflow-hidden rounded-lg border border-white/10">
            <div className="grid grid-cols-5 gap-2 bg-white/6 px-3 py-2 text-[10px] uppercase tracking-wider text-white/40">
              <span>Plataforma</span><span>Contenidos</span><span>Views</span><span>ER</span><span>CPV</span>
            </div>
            {influencer.platformBreakdown.map(row => (
              <div key={row.platform} className="grid grid-cols-5 gap-2 border-t border-white/6 px-3 py-2 text-sm text-white/70">
                <span>{row.platform}</span>
                <span>{formatNumber(row.contents)}</span>
                <span>{formatNumber(row.views)}</span>
                <span>{formatMaybePercent(row.er)}</span>
                <span>{formatMaybeCurrency(row.cpv)}</span>
              </div>
            ))}
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {influencer.contents.map(content => (
              <button key={content.id} onClick={() => onContentSelect(content)} className="rounded-lg border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10">
                <p className="font-semibold text-white">{content.platform} - {content.format}</p>
                <p className="mt-1 text-xs text-white/45">{formatShortDate(content.publishDate)} - {formatNumber(content.views)} views</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

function PaidModal({ paid, onClose }) {
  return (
    <Modal title={paid.id} subtitle={`${paid.network} - ${paid.influencerName}`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Metric label="Inversión" value={formatMaybeCurrency(paid.investment)} />
        <Metric label="Views pauta" value={formatNumber(paid.views)} />
        <Metric label="Alcance" value={formatNumber(paid.reach)} />
        <Metric label="Impresiones" value={formatNumber(paid.impressions)} />
        <Metric label="Interacciones" value={formatNumber(safeNumber(paid.likes) + safeNumber(paid.comments) + safeNumber(paid.shares) + safeNumber(paid.saves))} />
        <Metric label="Clics" value={formatNumber(paid.clicks)} />
        <Metric label="CPV" value={formatMaybeCurrency(paid.cpv || (paid.views > 0 ? paid.investment / paid.views : null))} />
        <Metric label="CTR" value={formatMaybePercent(paid.ctr)} />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Qualitative label="Pautado desde" value={paid.paidFrom || 'Pendiente'} />
        <Qualitative label="Objetivo" value={paid.objective || 'Pendiente'} />
        <Qualitative label="Cuenta ads" value={paid.adAccount || 'Pendiente'} />
        <Qualitative label="Fuente" value={paid.dataSource || 'Pendiente'} />
      </div>
    </Modal>
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

function RankingList({ title, rows, renderRow }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <h4 className="mb-3 font-bold text-white">{title}</h4>
      <div className="space-y-2">
        {rows.length ? rows.map(renderRow) : <EmptyState title="Sin datos" text="Aún no hay registros rankeables." />}
      </div>
    </div>
  )
}

function CampaignRankingRow({ campaign, index, onSelect, theme }) {
  return (
    <button onClick={onSelect} className="w-full rounded-lg border border-white/10 bg-black/10 p-3 text-left hover:bg-white/7">
      <div className="flex items-start gap-3">
        <Rank index={index} color={theme.primary} />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-semibold text-white">{campaign.name}</p>
          <p className="mt-1 text-xs text-white/45">{formatMaybeCurrency(campaign.totalCpv || campaign.organicCpv)} CPV - {formatNumber(campaign.totalViews)} views</p>
        </div>
      </div>
    </button>
  )
}

function InfluencerRankingRow({ influencer, index, onSelect, theme }) {
  return (
    <button onClick={onSelect} className="w-full rounded-lg border border-white/10 bg-black/10 p-3 text-left hover:bg-white/7">
      <div className="flex items-center gap-3">
        <Rank index={index} color={theme.primary} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-white">{influencer.name}</p>
          <p className="truncate text-xs text-white/45">{influencer.campaign.name}</p>
        </div>
        <span className="text-xs font-semibold text-white/70">{formatNumber(influencer.organic.views)}</span>
      </div>
    </button>
  )
}

function ContentRankingRow({ content, index, onSelect, theme }) {
  return (
    <button onClick={onSelect} className="w-full rounded-lg border border-white/10 bg-black/10 p-3 text-left hover:bg-white/7">
      <div className="flex items-center gap-3">
        <Rank index={index} color={theme.primary} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-white">{content.influencerName}</p>
          <p className="truncate text-xs text-white/45">{content.campaign.name} - {content.platform} - orgánico{content.hasPaid ? ' + pauta' : ''}</p>
        </div>
        <span className="text-xs font-semibold text-white/70">{formatNumber(content.views)}</span>
      </div>
    </button>
  )
}

function Rank({ index, color }) {
  return (
    <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg text-xs font-bold" style={{ background: `${color}24`, color }}>
      {index + 1}
    </span>
  )
}

function MetricCard({ title, value, icon: Icon, color }) {
  return (
    <div className="influencer-module p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">{title}</p>
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  )
}

function Metric({ label, value }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-white/5 p-3">
      <p className="truncate text-[10px] uppercase tracking-wider text-white/40">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-white md:text-base">{value}</p>
    </div>
  )
}

function Chip({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${active ? 'border-white bg-white text-zinc-950' : 'border-white/10 bg-white/6 text-white/65 hover:bg-white/10 hover:text-white'}`}>
      {children}
    </button>
  )
}

function Qualitative({ label, value }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">{label}</p>
      <p className="mt-2 text-sm leading-6 text-white/68">{value || 'Pendiente de carga.'}</p>
    </div>
  )
}

function EvidenceList({ evidences }) {
  if (!evidences.length) return <Qualitative label="Comentarios destacados" value="Sin comentarios destacados ligados a este contenido." />
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/40">Comentarios destacados</p>
      <div className="space-y-2">
        {evidences.map(evidence => (
          <div key={evidence.id} className="rounded-lg bg-white/5 p-3">
            <p className="text-xs font-semibold text-white">{evidence.sentiment} - {evidence.topic || evidence.commentType}</p>
            <p className="mt-1 text-sm text-white/65">{evidence.text || evidence.analysisNote || 'Evidencia visual sin texto capturado.'}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyState({ title, text }) {
  return (
    <div className="col-span-full rounded-lg border border-dashed border-white/15 bg-white/5 p-8 text-center">
      <p className="font-semibold text-white/70">{title}</p>
      <p className="mt-1 text-sm text-white/45">{text}</p>
    </div>
  )
}

function Modal({ title, subtitle, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md" onClick={onClose}>
      <div className="max-h-[94vh] w-full max-w-6xl overflow-auto rounded-lg border border-white/15 bg-zinc-950/94 shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold text-white">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-white/50">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-white/70">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

function ContentEmbedPreview({ content }) {
  const ref = useRef(null)
  const [failed, setFailed] = useState(false)
  const rawValue = content.embedCode || content.url || ''
  const embed = useMemo(() => buildContentEmbed(rawValue, content.platform), [rawValue, content.platform])

  useEffect(() => setFailed(false), [rawValue])

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
    if (html.includes('facebook')) {
      loadExternalScript('fb-embed', 'https://connect.facebook.net/es_LA/sdk.js#xfbml=1&version=v19.0')
        .then(() => window.FB?.XFBML?.parse(ref.current))
        .catch(() => setFailed(true))
    }
  }, [embed])

  if (!rawValue) {
    return <div className="grid aspect-video place-items-center rounded-lg border border-white/10 bg-black/25 text-sm text-white/40">Sin video embebido</div>
  }

  if (failed || !embed) {
    return (
      <div className="rounded-lg border border-white/10 bg-black/25 p-5 text-center">
        <p className="text-sm font-semibold text-white">No se pudo mostrar el embed</p>
        {content.url && <a href={content.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950">Abrir contenido</a>}
      </div>
    )
  }

  if (embed.kind === 'html') {
    return (
      <div className="influencer-embed-shell overflow-hidden rounded-lg border border-white/10 bg-black/25">
        <div ref={ref} className="influencer-embed-stage flex h-full w-full items-center justify-center p-3" />
      </div>
    )
  }

  return (
    <div className="influencer-embed-shell overflow-hidden rounded-lg border border-white/10 bg-black/25">
      <iframe
        src={embed.src}
        title={`${content.platform || 'Contenido'} embed`}
        className="influencer-embed-iframe border-0 bg-white"
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
        allowFullScreen
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  )
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
    return { kind: 'iframe', src: `${clean}/embed` }
  }
  if (lower.includes('facebook.com')) {
    return { kind: 'iframe', src: `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url)}&show_text=true&width=500` }
  }
  if (lower.includes('drive.google.com')) return { kind: 'iframe', src: drivePreview(url) }
  if (lower.match(/\.(mp4|webm|mov)(\?|$)/)) {
    return { kind: 'html', html: `<video src="${url}" controls playsinline style="width:100%;max-height:620px;border-radius:12px;background:#000;"></video>` }
  }
  if (platform && /tiktok/i.test(platform)) return null
  return { kind: 'iframe', src: url }
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

function decorateContent(content, campaign) {
  const influencer = campaign.rollups.find(row => row.id === content.influencerCampaignId)
  return {
    ...content,
    campaign,
    influencer,
    organicCpv: influencer?.cpv ?? null,
  }
}

function getYearLabel(campaigns = []) {
  const years = [...new Set(campaigns.flatMap(campaign => [campaign.startDate, campaign.endDate])
    .filter(Boolean)
    .map(date => String(date).slice(0, 4)))]
    .sort()
  if (!years.length) return 'este periodo'
  if (years.length === 1) return years[0]
  return `${years[0]}-${years[years.length - 1]}`
}

function bestNetwork(rows = []) {
  const scored = ['TikTok', 'Meta'].map(network => {
    const networkRows = rows.filter(row => row.network === network)
    const investment = networkRows.reduce((sum, row) => sum + safeNumber(row.investment), 0)
    const views = networkRows.reduce((sum, row) => sum + safeNumber(row.views), 0)
    return { network, cpv: views > 0 && investment > 0 ? investment / views : null }
  }).filter(row => row.cpv !== null)
  return scored.sort((a, b) => a.cpv - b.cpv)[0]?.network || ''
}

function emptyPaidLabel(campaign) {
  if (!campaign.includesPaid) return 'Esta campaña no tiene pauta registrada'
  return 'Resultados de pauta pendientes de carga'
}

function formatMaybeCurrency(value) {
  if (value === null || value === undefined || value === '') return 'Pendiente'
  const num = safeNumber(value, NaN)
  if (Number.isNaN(num) || num === 0) return num === 0 ? '$0' : 'Pendiente'
  return formatCurrency(num)
}

function formatMaybePercent(value) {
  if (value === null || value === undefined || value === '') return 'Pendiente'
  const num = safeNumber(value, NaN)
  if (Number.isNaN(num)) return 'Pendiente'
  return `${formatDecimal(num)}%`
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

function initials(value) {
  return String(value || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase()
}
