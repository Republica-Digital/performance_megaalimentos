import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import { formatMonthLong, formatMonthShort, safeNumber } from './format'
import { tipoCampanaToBucket, bucketToLabel } from './campaigns'

const v = (val) => safeNumber(val, 0)
const fN = (val) => v(val).toLocaleString('es-MX')
const fC = (val) => `$${v(val).toLocaleString('es-MX', { maximumFractionDigits: 2 })}`
const fP = (val) => { const raw = v(val); return raw === 0 ? '0%' : `${raw.toFixed(2)}%` }
const vari = (act, ant) => {
  if (ant === 0) return act > 0 ? 'Nuevo' : '—'
  const p = ((act - ant) / ant) * 100
  return `${p > 0 ? '+' : ''}${p.toFixed(1)}%`
}
const prevMes = (m) => {
  if (!m?.includes('-')) return null
  const [y, mo] = m.split('-').map(Number)
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`
}

const BRAND_COLORS = {
  botanera: [255, 107, 0], chamoy: [168, 85, 247], pacific: [59, 130, 246],
}

export async function exportDashboardPDF({
  marcaId, brandName, selectedMonth, filteredData, allData, allProyecciones, features, onProgress,
}) {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W = pdf.internal.pageSize.getWidth()
  const H = pdf.internal.pageSize.getHeight()
  const M = 14
  const accent = BRAND_COLORS[marcaId] || [99, 102, 241]
  const mesAnt = prevMes(selectedMonth)
  const label = formatMonthLong(selectedMonth)
  const getH = (p, m) => (allData[p] || []).find(r => r.mes === m) || {}

  const sections = []
  let pageNum = 1

  const footer = () => {
    pdf.setFontSize(7); pdf.setTextColor(140)
    pdf.text(`${brandName} — ${label}`, M, H - 4)
    pdf.text(`Pág. ${pageNum}`, W - M, H - 4, { align: 'right' })
  }
  const np = () => { pdf.addPage(); pageNum++; footer() }
  const sectionStart = (title) => {
    np()
    sections.push({ title, page: pageNum })
    pdf.setFillColor(...accent)
    pdf.rect(M, M, W - M * 2, 9, 'F')
    pdf.setFontSize(13); pdf.setTextColor(255, 255, 255)
    pdf.text(title, M + 3, M + 6.5)
    pdf.setTextColor(50); return M + 14
  }
  const sub = (y, t) => {
    pdf.setFontSize(9.5); pdf.setTextColor(...accent); pdf.text(t, M, y)
    pdf.setTextColor(50); return y + 5
  }
  const tbl = (sy, head, body, opts = {}) => {
    pdf.autoTable({
      startY: sy, head: [head], body,
      margin: { left: M, right: M },
      styles: { fontSize: 7.5, cellPadding: 2, lineColor: [210, 210, 210], lineWidth: 0.15, textColor: [40, 40, 40] },
      headStyles: { fillColor: accent, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: [245, 245, 250] },
      ...opts,
    })
    return pdf.lastAutoTable.finalY + 5
  }
  const checkPB = (y, n = 50) => { if (y > H - n) { np(); return M + 8 } return y }

  // ── COVER ────────────────────────────────────────────────────────────
  onProgress?.(0, 9, 'Portada')
  pdf.setFillColor(...accent)
  pdf.rect(0, 0, W, 50, 'F')
  pdf.setFontSize(26); pdf.setTextColor(255)
  pdf.text('Reporte Mensual', M, 28)
  pdf.setFontSize(16)
  pdf.text(`${brandName} — ${label}`, M, 40)
  let y = 60
  pdf.setTextColor(50); pdf.setFontSize(10)
  pdf.text('Resumen por plataforma', M, y); y += 7
  y = tbl(y,
    ['Plataforma', 'Seguidores', 'Alcance/Views', 'Interacciones', 'Inversión'],
    ['facebook', 'instagram', 'tiktok'].map(p => {
      const d = getH(p, selectedMonth)
      return [p.charAt(0).toUpperCase() + p.slice(1), fN(d.seguidores), fN(p === 'tiktok' ? d.views : d.alcance), fN(d.interacciones), fC(d.inversion)]
    }),
  )
  pdf.setFontSize(8); pdf.setTextColor(130)
  pdf.text(`Generado: ${new Date().toLocaleString('es-MX')}`, M, H - 12)
  footer()

  // ── PLATFORMS ─────────────────────────────────────────────────────────
  const platConfigs = [
    { key: 'facebook', label: 'Facebook', reach: 'alcance' },
    { key: 'instagram', label: 'Instagram', reach: 'alcance' },
    { key: 'tiktok', label: 'TikTok', reach: 'views' },
  ]
  for (let i = 0; i < platConfigs.length; i++) {
    const pc = platConfigs[i]
    onProgress?.(i + 1, 9, pc.label)
    y = sectionStart(pc.label)
    const act = filteredData[pc.key] || {}, ant = getH(pc.key, mesAnt)

    y = sub(y, 'Métricas Principales')
    const kpis = [
      ['Seguidores', fN(act.seguidores), vari(v(act.seguidores), v(ant.seguidores))],
      ['Nuevos Seg.', fN(act.nuevos_seguidores), vari(v(act.nuevos_seguidores), v(ant.nuevos_seguidores))],
      [pc.key === 'tiktok' ? 'Views' : 'Alcance', fN(act[pc.reach]), vari(v(act[pc.reach]), v(ant[pc.reach]))],
      ['Interacciones', fN(act.interacciones), vari(v(act.interacciones), v(ant.interacciones))],
      ['Engagement Rate', fP(act.engagement_rate), ''],
      ['Inversión', fC(act.inversion), vari(v(act.inversion), v(ant.inversion))],
    ]
    if (pc.key === 'tiktok') kpis.splice(3, 0, ['Views 6s+', fN(act.views_6s), vari(v(act.views_6s), v(ant.views_6s))])
    y = tbl(y, ['Métrica', 'Valor', 'vs Anterior'], kpis)

    // Campaigns
    const camps = (filteredData.campanas || []).filter(c => c.plataforma === pc.key)
    if (camps.length > 0) {
      y = checkPB(y)
      y = sub(y, 'Campañas por Bucket')
      const proyP = (allProyecciones || []).filter(p => p.mes === selectedMonth && p.plataforma === pc.key)
      const bMap = new Map()
      for (const c of camps) {
        const b = c._bucket || tipoCampanaToBucket(c.tipo_campana), o = c._objective || c.objetivo_detectado || c.objetivo || 'Sin objetivo'
        const k = `${b}|${o}`; if (!bMap.has(k)) bMap.set(k, { b, o, res: 0, inv: 0, meta: null })
        const e = bMap.get(k); e.res += v(c.resultado); e.inv += v(c.inversion)
      }
      for (const p of proyP) {
        const b = tipoCampanaToBucket(p.tipo_campana), o = p.objetivo || p.metrica || 'Sin objetivo'
        const k = `${b}|${o}`; if (!bMap.has(k)) bMap.set(k, { b, o, res: 0, inv: 0, meta: null })
        const e = bMap.get(k); e.meta = v(p.meta); if (e.res === 0) e.res = v(p.real)
      }
      y = tbl(y, ['Bucket', 'Objetivo', 'Resultado', 'Meta', 'Cumpl.', 'Inversión', 'CPR'],
        Array.from(bMap.values()).map(e => [
          bucketToLabel(e.b, e.b), e.o, fN(e.res), e.meta ? fN(e.meta) : '—',
          e.meta > 0 ? `${((e.res / e.meta) * 100).toFixed(1)}%` : '—', fC(e.inv),
          e.res > 0 ? `$${(e.inv / e.res).toFixed(2)}` : '—',
        ]),
      )
    }

    // Historical
    const histM = (allData[pc.key] || []).map(r => r.mes).filter(Boolean).sort().slice(-6)
    if (histM.length > 1) {
      y = checkPB(y)
      y = sub(y, 'Evolución Histórica')
      y = tbl(y, ['Mes', 'Seguidores', pc.key === 'tiktok' ? 'Views' : 'Alcance', 'Interacciones', 'Inversión'],
        histM.map(m => { const d = getH(pc.key, m); return [formatMonthShort(m), fN(d.seguidores), fN(d[pc.reach]), fN(d.interacciones), fC(d.inversion)] }),
      )
    }
  }

  // ── GOOGLE ADS ────────────────────────────────────────────────────────
  onProgress?.(4, 9, 'Google Ads')
  const gaD = filteredData.googleAds || []
  if (features?.googleAds !== false && gaD.length > 0) {
    y = sectionStart('Google Ads')
    const gaAnt = (allData.googleAds || []).filter(r => r.mes === mesAnt)
    const tot = gaD.reduce((a, r) => ({ i: a.i + v(r.impresiones_visibles), c: a.c + v(r.clics), vw: a.vw + v(r.visualizaciones), inv: a.inv + v(r.inversion) }), { i: 0, c: 0, vw: 0, inv: 0 })
    const antT = gaAnt.reduce((a, r) => ({ i: a.i + v(r.impresiones_visibles), c: a.c + v(r.clics), vw: a.vw + v(r.visualizaciones), inv: a.inv + v(r.inversion) }), { i: 0, c: 0, vw: 0, inv: 0 })
    y = sub(y, 'KPIs Generales')
    y = tbl(y, ['Métrica', 'Valor', 'vs Anterior'], [
      ['Imp. Visibles', fN(tot.i), vari(tot.i, antT.i)],
      ['Clics', fN(tot.c), vari(tot.c, antT.c)],
      ['CTR', tot.i > 0 ? `${((tot.c / tot.i) * 100).toFixed(2)}%` : '—', ''],
      ['Views (Video)', fN(tot.vw), vari(tot.vw, antT.vw)],
      ['Inversión', fC(tot.inv), vari(tot.inv, antT.inv)],
    ])
  }

  // ── SENTIMENT ─────────────────────────────────────────────────────────
  onProgress?.(5, 9, 'Sentiment')
  const sent = filteredData.sentiment
  if (sent) {
    y = sectionStart('Sentiment')
    y = tbl(y, ['Positivo', 'Neutro', 'Negativo'], [[fP(sent.positivo_pct), fP(sent.neutro_pct), fP(sent.negativo_pct)]])
    if (sent.descripcion) {
      y = sub(y, 'Análisis Cualitativo')
      pdf.setFontSize(8.5); pdf.setTextColor(60)
      const lines = pdf.splitTextToSize(String(sent.descripcion), W - M * 2)
      pdf.text(lines, M, y); y += lines.length * 4 + 5
    }
  }

  // ── COMPETENCIA ───────────────────────────────────────────────────────
  onProgress?.(6, 9, 'Competencia')
  const comp = filteredData.competencia || []
  if (comp.length > 0) {
    y = sectionStart('Competencia')
    const cAnt = (allData.competencia || []).filter(r => r.mes === mesAnt)
    const redes = [...new Set(comp.map(c => c.red))].filter(Boolean)
    for (const red of redes) {
      y = checkPB(y)
      y = sub(y, red.charAt(0).toUpperCase() + red.slice(1))
      y = tbl(y, ['Competidor', 'Seguidores', 'vs Ant.', 'Engagement'],
        comp.filter(c => c.red === red).map(c => {
          const a = cAnt.find(x => x.competidor === c.competidor && x.red === red)
          return [c.competidor, fN(c.seguidores), a ? vari(v(c.seguidores), v(a.seguidores)) : '', fP(c.engagement_pct)]
        }),
      )
    }
  }

  // ── HALLAZGOS ─────────────────────────────────────────────────────────
  onProgress?.(7, 9, 'Hallazgos')
  const hall = filteredData.hallazgos || [], obs = filteredData.observaciones || []
  if (hall.length > 0 || obs.length > 0) {
    y = sectionStart('Hallazgos y Observaciones')
    if (hall.length > 0) {
      y = sub(y, 'Hallazgos')
      y = tbl(y, ['Tipo', 'Sección', 'Título', 'Descripción'],
        hall.map(h => [h.tipo || '', h.seccion || '', h.titulo || '', h.descripcion || '']),
        { columnStyles: { 3: { cellWidth: 80 } } },
      )
    }
    if (obs.length > 0) {
      y = checkPB(y)
      y = sub(y, 'Observaciones')
      y = tbl(y, ['Sección', 'Título', 'Descripción'],
        obs.map(o => [o.seccion || '', o.titulo || '', o.descripcion || '']),
        { columnStyles: { 2: { cellWidth: 100 } } },
      )
    }
  }

  // ── INDEX (last page) ─────────────────────────────────────────────────
  onProgress?.(8, 9, 'Índice')
  np()
  pdf.setFillColor(...accent)
  pdf.rect(M, M, W - M * 2, 9, 'F')
  pdf.setFontSize(13); pdf.setTextColor(255)
  pdf.text('Índice de Contenido', M + 3, M + 6.5)
  pdf.setTextColor(50)
  let ty = M + 18
  pdf.setFontSize(9.5)
  const allE = [{ title: 'Portada', page: 1 }, ...sections]
  for (const e of allE) {
    pdf.setTextColor(50); pdf.text(e.title, M + 3, ty)
    pdf.setTextColor(...accent); pdf.text(`Pág. ${e.page}`, W - M - 3, ty, { align: 'right' })
    pdf.setDrawColor(200); pdf.setLineDashPattern([0.8, 0.8])
    pdf.line(M + 3 + pdf.getTextWidth(e.title) + 2, ty - 0.3, W - M - 3 - pdf.getTextWidth(`Pág. ${e.page}`) - 2, ty - 0.3)
    pdf.setLineDashPattern([])
    ty += 6.5
  }

  // SAVE
  const safe = brandName.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '').trim().replace(/\s+/g, '_')
  pdf.save(`Reporte_${safe}_${selectedMonth}.pdf`)
}
