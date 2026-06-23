import { useState, useEffect, useMemo, useCallback } from 'react'
import { Routes, Route, useParams, useNavigate, Navigate } from 'react-router-dom'
import { Sidebar } from '../components/layout/Sidebar'
import { Header } from '../components/layout/Header'
import { useSheetData } from '../hooks/useSheetData'
import { useDateFilter } from '../hooks/useDateFilter'
import { Overview } from '../components/sections/Overview'
import { SocialSection } from '../components/sections/SocialSection'
import { TikTokSection } from '../components/sections/TikTokSection'
import { GoogleAdsSection } from '../components/sections/GoogleAdsSection'
import { SentimentSection } from '../components/sections/SentimentSection'
import { CompetenciaSection } from '../components/sections/CompetenciaSection'
import { HallazgosSection } from '../components/sections/HallazgosSection'
import { ProyeccionesSection } from '../components/sections/ProyeccionesSection'
import { detectAvailableBuckets } from '../utils/campaigns'
import { exportDashboardPDF } from '../utils/exportPDF'
import { exportDashboardData } from '../utils/exportToExcel'

const brandThemes = {
  botanera: {
    primary: '#FF6B00', secondary: '#FFD700', bgBase: '#2A0E00',
    focusColor: 'rgba(255, 107, 0, 0.45)',
    ambient1: 'rgba(229, 62, 0, 0.30)', ambient2: 'rgba(255, 183, 77, 0.18)',
    sidebarBg: 'rgba(20, 8, 0, 0.55)',
  },
  chamoy: {
    primary: '#A855F7', secondary: '#FFD700', bgBase: '#150022',
    focusColor: 'rgba(168, 85, 247, 0.40)',
    ambient1: 'rgba(109, 40, 217, 0.30)', ambient2: 'rgba(251, 191, 36, 0.15)',
    sidebarBg: 'rgba(15, 0, 25, 0.55)',
  },
  pacific: {
    primary: '#3B82F6', secondary: '#E31E24', bgBase: '#030B1F',
    focusColor: 'rgba(59, 130, 246, 0.38)',
    ambient1: 'rgba(10, 38, 71, 0.55)', ambient2: 'rgba(227, 30, 36, 0.15)',
    sidebarBg: 'rgba(3, 10, 25, 0.55)',
  },
}

const defaultTheme = {
  primary: '#6366f1', secondary: '#818cf8', bgBase: '#0a0a1a',
  focusColor: 'rgba(99, 102, 241, 0.35)',
  ambient1: 'rgba(79, 70, 229, 0.25)', ambient2: 'rgba(129, 140, 248, 0.15)',
  sidebarBg: 'rgba(10, 10, 26, 0.55)',
}

export function Dashboard() {
  const { marcaId } = useParams()
  const navigate = useNavigate()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [filterMode, setFilterMode] = useState('month') // 'month' | 'range'
  const [startDate, setStartDate] = useState(null)
  const [endDate, setEndDate] = useState(null)
  const [presentationMode, setPresentationMode] = useState(false)
  const [bucket, setBucket] = useState('mensual')
  const [exportStatus, setExportStatus] = useState(null)

  const {
    data, loading, error, refresh, isRefreshing,
    availableMonths, dateRange, isDailyData, brandConfig, features,
  } = useSheetData(marcaId)

  const baseTheme = brandThemes[marcaId] || defaultTheme
  const theme = brandConfig?.color_primario
    ? { ...baseTheme, primary: brandConfig.color_primario }
    : baseTheme

  // Auto-select first month
  useEffect(() => {
    if (availableMonths.length > 0 && !selectedMonth) {
      setSelectedMonth(availableMonths[0])
    }
  }, [availableMonths, selectedMonth])

  // Auto-set date range when switching to range mode
  useEffect(() => {
    if (filterMode === 'range' && !startDate && dateRange) {
      // Default to last month's range
      const lastMonth = availableMonths[0]
      if (lastMonth) {
        const [y, m] = lastMonth.split('-').map(Number)
        const daysInMonth = new Date(y, m, 0).getDate()
        setStartDate(`${lastMonth}-01`)
        setEndDate(`${lastMonth}-${String(daysInMonth).padStart(2, '0')}`)
      }
    }
  }, [filterMode, startDate, dateRange, availableMonths])

  // Use date filter hook
  const { filtered: filteredData, historicalData } = useDateFilter(data, {
    mode: filterMode,
    selectedMonth,
    startDate,
    endDate,
  })

  const showMonthOnly = filteredData._showMonthOnly
  const showProyecciones = filteredData._showProyecciones

  // Available campaign buckets
  const availableBuckets = useMemo(
    () => detectAvailableBuckets(filteredData.campanas || []),
    [filteredData.campanas]
  )

  // PDF & Excel export — only available in month/period mode
  const canExport = filterMode === 'month'

  const handleExportPDF = useCallback(async () => {
    if (!canExport) return
    setExportStatus('Generando PDF…')
    try {
      await exportDashboardPDF({
        brandConfig,
        filteredData,
        allData: data,
        selectedMonth,
        features,
        onProgress: (step, total, label) => {
          setExportStatus(`Generando PDF… ${label} (${step}/${total})`)
        },
      })
      setExportStatus(null)
    } catch (err) {
      console.error('PDF export error:', err)
      setExportStatus('Error al exportar PDF')
      setTimeout(() => setExportStatus(null), 3000)
    }
  }, [canExport, brandConfig, filteredData, data, selectedMonth, features])

  const handleExportExcel = useCallback(async () => {
    if (!canExport) return
    setExportStatus('Generando Excel…')
    try {
      await exportDashboardData({
        brandConfig,
        filteredData,
        allData: data,
        selectedMonth,
      })
      setExportStatus(null)
    } catch (err) {
      console.error('Excel export error:', err)
      const message = err?.message ? `Error al exportar Excel: ${err.message}` : 'Error al exportar Excel'
      setExportStatus(message)
      setTimeout(() => setExportStatus(null), 6000)
    }
  }, [canExport, brandConfig, filteredData, data, selectedMonth])

  const handleRangeChange = useCallback((s, e) => {
    setStartDate(s)
    setEndDate(e)
  }, [])

  const handleFilterModeChange = useCallback((mode) => {
    setFilterMode(mode)
    if (mode === 'month') {
      // Reset range
      setStartDate(null)
      setEndDate(null)
    }
  }, [])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <div className="glass-card p-8 rounded-2xl text-center max-w-md">
          <h2 className="text-xl font-bold mb-2">Error</h2>
          <p className="text-white/60 text-sm">{error}</p>
          <button onClick={refresh} className="mt-4 px-4 py-2 rounded-lg glass-strong text-sm">
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  // Determine the "effective month" for sections that need it
  const effectiveMonth = filterMode === 'month'
    ? selectedMonth
    : (startDate ? startDate.slice(0, 7) : selectedMonth)

  return (
    <div className="min-h-screen text-white" style={{ background: theme.bgBase }}>
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-[120px] opacity-60" style={{ background: theme.ambient1 }} />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full blur-[120px] opacity-40" style={{ background: theme.ambient2 }} />
      </div>

      <div className="relative flex min-h-screen">
        <Sidebar
          marcaId={marcaId}
          brandConfig={brandConfig}
          theme={theme}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
          features={features}
          showMonthOnly={showMonthOnly}
          bucket={bucket}
          setBucket={setBucket}
          availableBuckets={availableBuckets}
          presentationMode={presentationMode}
        />

        <main className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-56'}`}>
          <Header
            brandConfig={brandConfig}
            theme={theme}
            months={availableMonths}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            filterMode={filterMode}
            onFilterModeChange={handleFilterModeChange}
            startDate={startDate}
            endDate={endDate}
            onRangeChange={handleRangeChange}
            minDate={dateRange?.min}
            maxDate={dateRange?.max}
            onRefresh={refresh}
            isRefreshing={isRefreshing}
            presentationMode={presentationMode}
            setPresentationMode={setPresentationMode}
            onExportPDF={handleExportPDF}
            onExportExcel={handleExportExcel}
            isExporting={!!exportStatus}
            exportStatus={exportStatus}
            canExport={canExport}
          />

          {/* Range mode indicator */}
          {filterMode === 'range' && (
            <div className="px-4 md:px-6 pb-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/50">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Modo rango personalizado
                {!showMonthOnly && <span>· Secciones de análisis mensual ocultas</span>}
                {showProyecciones && <span>· Proyecciones visibles</span>}
              </div>
            </div>
          )}

          <div className="p-4 md:p-6 space-y-6">
            <Routes>
              <Route path="overview" element={
                <Overview
                  data={filteredData}
                  historical={historicalData}
                  selectedMonth={effectiveMonth}
                  loading={loading}
                  theme={theme}
                  features={features}
                />
              } />

              <Route path="facebook" element={
                <SocialSection
                  platform="facebook"
                  data={filteredData.facebook}
                  campanas={filteredData.campanas}
                  proyecciones={showProyecciones ? (data.proyecciones || []) : []}
                  topPosts={filteredData.topPosts}
                  observaciones={filteredData.observaciones?.filter(o => o.seccion === 'facebook')}
                  historical={historicalData.facebook}
                  loading={loading}
                  theme={theme}
                />
              } />

              <Route path="instagram" element={
                <SocialSection
                  platform="instagram"
                  data={filteredData.instagram}
                  campanas={filteredData.campanas}
                  proyecciones={showProyecciones ? (data.proyecciones || []) : []}
                  topPosts={filteredData.topPosts}
                  observaciones={filteredData.observaciones?.filter(o => o.seccion === 'instagram')}
                  historical={historicalData.instagram}
                  loading={loading}
                  theme={theme}
                />
              } />

              <Route path="tiktok" element={
                <TikTokSection
                  data={filteredData.tiktok}
                  campanas={filteredData.campanas}
                  proyecciones={showProyecciones ? (data.proyecciones || []) : []}
                  topPosts={filteredData.topPosts}
                  observaciones={filteredData.observaciones?.filter(o => o.seccion === 'tiktok')}
                  historical={historicalData.tiktok}
                  loading={loading}
                  theme={theme}
                />
              } />

              <Route path="google-ads" element={
                <GoogleAdsSection
                  data={filteredData.googleAds}
                  ciudades={filteredData.googleAdsCiudades}
                  keywords={filteredData.googleAdsKeywords}
                  proyecciones={showProyecciones ? (data.proyecciones || []) : []}
                  selectedMonth={effectiveMonth}
                  observaciones={filteredData.observaciones?.filter(o => o.seccion === 'google-ads')}
                  loading={loading}
                />
              } />

              {showMonthOnly && (
                <>
                  <Route path="sentiment" element={
                    <SentimentSection
                      data={filteredData.sentiment}
                      capturas={filteredData.sentimentCapturas}
                      observaciones={filteredData.observaciones?.filter(o => o.seccion === 'sentiment')}
                      loading={loading}
                      theme={theme}
                    />
                  } />

                  <Route path="competencia" element={
                    <CompetenciaSection
                      data={filteredData.competencia}
                      allData={data.competencia || []}
                      selectedMonth={effectiveMonth}
                      observaciones={filteredData.observaciones?.filter(o => o.seccion === 'competencia')}
                      loading={loading}
                      theme={theme}
                    />
                  } />

                  <Route path="hallazgos" element={
                    <HallazgosSection
                      data={filteredData.hallazgos?.filter(h => h.seccion === 'hallazgos' || h.seccion === 'overview')}
                      loading={loading}
                      theme={theme}
                    />
                  } />
                </>
              )}

              <Route path="proyecciones" element={
                showProyecciones ? (
                  <ProyeccionesSection
                    data={filteredData.proyecciones || []}
                    allData={(data && data.proyecciones) || []}
                    selectedMonth={effectiveMonth}
                    campanas={filteredData.campanas}
                    observaciones={filteredData.observaciones?.filter(o => o.seccion === 'proyecciones')}
                    loading={loading}
                    theme={theme}
                    bucket={bucket}
                  />
                ) : (
                  <div className="glass-card rounded-2xl p-8 text-center">
                    <p className="text-white/50 text-sm">
                      Las proyecciones solo están disponibles al filtrar un periodo completo
                      o un rango dentro del mismo mes.
                    </p>
                  </div>
                )
              } />

              <Route path="*" element={<Navigate to="overview" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  )
}
