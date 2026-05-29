import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Maximize2, Minimize2, FileDown, FileSpreadsheet, Loader } from 'lucide-react'
import { formatMonthLong } from '../../utils/format'
import { DateRangePicker } from './DateRangePicker'

export function Header({
  brandConfig, theme, months = [], selectedMonth, onMonthChange,
  // New date range props
  filterMode, onFilterModeChange, startDate, endDate, onRangeChange,
  minDate, maxDate,
  onRefresh, isRefreshing, presentationMode, setPresentationMode,
  onExportPDF, onExportExcel, isExporting, canExport,
}) {
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const exportRef = useRef(null)

  useEffect(() => {
    const onClick = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) setExportMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Subtitle based on mode
  const subtitle = filterMode === 'range' && startDate && endDate
    ? 'Rango personalizado'
    : 'Reporte mensual'

  return (
    <header
      className="sticky top-0 z-20 px-4 md:px-6 py-4"
      style={{
        background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 100%)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Left: title */}
        <div className="min-w-0 flex-1">
          <h2 className="text-xs uppercase tracking-widest text-white/45 font-semibold">
            {subtitle}
          </h2>
          <p className="text-lg md:text-xl font-bold font-display text-white truncate tracking-tight">
            {brandConfig?.nombre || 'Dashboard'}
            {filterMode === 'month' && selectedMonth && (
              <span className="text-white/40 font-normal"> · {formatMonthLong(selectedMonth)}</span>
            )}
          </p>
        </div>

        {/* Right: controls */}
        <div className="flex items-center gap-2">
          {/* Date picker */}
          <DateRangePicker
            mode={filterMode}
            onModeChange={onFilterModeChange}
            months={months}
            selectedMonth={selectedMonth}
            onMonthChange={onMonthChange}
            startDate={startDate}
            endDate={endDate}
            onRangeChange={onRangeChange}
            minDate={minDate}
            maxDate={maxDate}
          />

          {/* Refresh */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Actualizar datos"
            className="glass-strong p-2.5 rounded-xl text-white/60 hover:text-white hover:bg-white/15 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* Export menu — only in period/month mode */}
          {canExport && (
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              className="glass-strong p-2.5 rounded-xl text-white/60 hover:text-white hover:bg-white/15 transition-all"
              title="Exportar"
            >
              {isExporting ? <Loader className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            </button>
            <AnimatePresence>
              {exportMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.2 }}
                  className="absolute right-0 top-full mt-2 z-50 glass-dropdown rounded-xl border border-white/10 shadow-2xl overflow-hidden"
                  style={{ minWidth: 180 }}
                >
                  <button
                    onClick={() => { onExportPDF?.(); setExportMenuOpen(false) }}
                    className="w-full text-left px-4 py-2.5 text-sm text-white/70 hover:bg-white/8 hover:text-white flex items-center gap-2 transition-colors"
                  >
                    <FileDown className="w-4 h-4" /> Exportar PDF
                  </button>
                  <button
                    onClick={() => { onExportExcel?.(); setExportMenuOpen(false) }}
                    className="w-full text-left px-4 py-2.5 text-sm text-white/70 hover:bg-white/8 hover:text-white flex items-center gap-2 transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          )}

          {/* Fullscreen */}
          <button
            onClick={() => setPresentationMode(!presentationMode)}
            className="glass-strong p-2.5 rounded-xl text-white/60 hover:text-white hover:bg-white/15 transition-all"
            title={presentationMode ? 'Salir de presentación' : 'Modo presentación'}
          >
            {presentationMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  )
}
