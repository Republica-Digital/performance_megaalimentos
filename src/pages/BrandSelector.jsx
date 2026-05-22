import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Sparkles } from 'lucide-react'
import Papa from 'papaparse'
import { normalizeImageUrl } from '../utils/urls'

const SHEET_ID = import.meta.env.VITE_SHEET_ID

function getSheetURL(sheetName) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`
}

export function BrandSelector() {
  const [brands, setBrands] = useState([])
  const [empresa, setEmpresa] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    async function loadData() {
      try {
        const [configRes, marcasRes] = await Promise.all([
          fetch(getSheetURL('_CONFIG')),
          fetch(getSheetURL('_MARCAS')),
        ])
        const configCsv = await configRes.text()
        const marcasCsv = await marcasRes.text()

        const { data: configData } = Papa.parse(configCsv, { header: true, skipEmptyLines: true })
        const empresaObj = {}
        configData.forEach(row => { if (row.campo && row.valor) empresaObj[row.campo] = row.valor })
        if (empresaObj.logo_url) empresaObj.logo_url = normalizeImageUrl(empresaObj.logo_url)
        setEmpresa(empresaObj)

        const { data: marcasData } = Papa.parse(marcasCsv, { header: true, skipEmptyLines: true })
        const normalized = marcasData
          .filter(row => row.marca_id && row.nombre)
          .map(row => ({ ...row, logo_url: normalizeImageUrl(row.logo_url) }))
        setBrands(normalized)

        setLoading(false)
      } catch (err) {
        console.error('Error loading data:', err)
        setError('No se pudieron cargar los datos. Verifica la configuración del Google Sheet.')
        setLoading(false)
      }
    }
    loadData()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
           style={{
             backgroundColor: '#1a0505',
             backgroundImage: `
               radial-gradient(ellipse 80% 60% at 50% 50%, rgba(220, 38, 38, 0.40) 0%, transparent 65%),
               radial-gradient(ellipse 60% 50% at 15% 15%, rgba(245, 158, 11, 0.20) 0%, transparent 55%)
             `,
           }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
            className="w-14 h-14 border-[3px] border-white/15 border-t-white rounded-full mx-auto mb-4"
          />
          <p className="text-white/65 text-sm">Cargando datos...</p>
        </motion.div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="glass-strong max-w-md text-center rounded-3xl p-8">
          <div className="w-14 h-14 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto mb-5">
            <span className="text-2xl">⚠</span>
          </div>
          <h1 className="text-lg font-bold text-white mb-2 font-display">Error de Conexión</h1>
          <p className="text-white/65 mb-6 text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-white text-zinc-900 hover:bg-white/90 rounded-xl font-semibold text-sm transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen relative"
      style={{
        backgroundColor: '#1a0505',
        backgroundImage: `
          radial-gradient(ellipse 85% 65% at 50% 45%, rgba(220, 38, 38, 0.42) 0%, transparent 65%),
          radial-gradient(ellipse 60% 50% at 15% 15%, rgba(245, 158, 11, 0.22) 0%, transparent 55%),
          radial-gradient(ellipse 50% 40% at 85% 90%, rgba(255, 107, 0, 0.15) 0%, transparent 55%)
        `,
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="noise-overlay" />

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12 text-center max-w-2xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 rounded-full bg-white/8 border border-white/15 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span className="text-[11px] uppercase tracking-widest text-white/70 font-semibold">
              Reportes mensuales
            </span>
          </div>

          {empresa.logo_url && (
            <img
              src={empresa.logo_url}
              alt={empresa.nombre || 'Logo'}
              className="h-20 md:h-24 mx-auto mb-6 drop-shadow-2xl"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          )}
          <h1 className="text-4xl md:text-6xl font-bold font-display text-white tracking-tight">
            {empresa.titulo || empresa.nombre || 'Dashboard'}
          </h1>
          <p className="text-white/60 text-base md:text-lg mt-3 max-w-md mx-auto">
            {empresa.subtitulo || 'Selecciona una marca para ver su análisis mensual'}
          </p>
        </motion.div>

        {/* Brand grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl w-full">
          {brands.map((brand, index) => (
            <motion.button
              key={brand.marca_id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -6 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(`/dashboard/${brand.marca_id}`)}
              className="group relative glass-card rounded-3xl p-7 text-left overflow-hidden"
            >
              {/* Color flare on hover */}
              <div
                className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-0 group-hover:opacity-50 transition-opacity duration-500"
                style={{ background: brand.color_primario }}
              />

              {/* Logo */}
              <div className="relative h-28 flex items-center justify-center mb-5 bg-white/95 rounded-2xl shadow-lg">
                {brand.logo_url ? (
                  <img
                    src={brand.logo_url}
                    alt={brand.nombre}
                    className="max-h-24 max-w-[80%] object-contain group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      e.currentTarget.nextElementSibling.style.display = 'flex'
                    }}
                  />
                ) : null}
                <div
                  className="w-20 h-20 rounded-2xl items-center justify-center text-3xl font-black text-white"
                  style={{ display: brand.logo_url ? 'none' : 'flex', backgroundColor: brand.color_primario }}
                >
                  {brand.nombre?.charAt(0)}
                </div>
              </div>

              {/* Name */}
              <h2 className="text-lg font-bold font-display text-white text-center mb-4 tracking-tight">
                {brand.nombre}
              </h2>

              {/* CTA */}
              <div
                className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider py-2.5 px-4 rounded-full transition-all duration-300"
                style={{
                  backgroundColor: `${brand.color_primario}25`,
                  color: '#ffffff',
                  border: `1px solid ${brand.color_primario}66`,
                }}
              >
                <span>Ver Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>

              {/* Bottom accent line */}
              <div
                className="absolute bottom-0 left-0 right-0 h-1 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"
                style={{ background: `linear-gradient(90deg, ${brand.color_primario}, ${brand.color_secundario || brand.color_primario})` }}
              />
            </motion.button>
          ))}
        </div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-12 text-white/35 text-xs"
        >
          © {new Date().getFullYear()} {empresa.nombre || 'Dashboard'} · Reportes de Marketing Digital
        </motion.p>
      </div>
    </div>
  )
}
