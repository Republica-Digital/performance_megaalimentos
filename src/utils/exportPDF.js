import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import { formatMonthLong, formatMonthShort, safeNumber } from './format'
import { tipoCampanaToBucket, bucketToLabel } from './campaigns'

const v = (val) => safeNumber(val, 0)
const fN = (val) => v(val).toLocaleString('es-MX')
const fC = (val) => `$${v(val).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`
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

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT — receives { brandConfig, filteredData, allData, selectedMonth, features }
// Dashboard calls: exportDashboardPDF({ brandConfig, filteredData, allData, selectedMonth, features })
// ─────────────────────────────────────────────────────────────────────────────
export async function exportDashboardPDF({ brandConfig, filteredData, allData, selectedMonth, features, onProgress }) {
  const marcaId   = brandConfig?.marca_id || brandConfig?.id || 'default'
  const brandName = brandConfig?.nombre   || 'Dashboard'
  const accent    = BRAND_COLORS[marcaId] || [99, 102, 241]

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W   = pdf.internal.pageSize.getWidth()   // 297
  const H   = pdf.internal.pageSize.getHeight()  // 210
  const M   = 14
  const COL = W - M * 2

  const mesAnt  = prevMes(selectedMonth)
  const label   = formatMonthLong(selectedMonth)
  const getH    = (p, m) => (Array.isArray(allData?.[p]) ? allData[p] : []).find(r => r.mes === m) || {}

  const sections = []
  let pageNum = 1

  // ── Helpers ──────────────────────────────────────────────────────────────
  const footer = () => {
    pdf.setFontSize(7); pdf.setTextColor(150)
    pdf.text(`${brandName} · ${label}`, M, H - 5)
    pdf.text(`Página ${pageNum}`, W - M, H - 5, { align: 'right' })
    pdf.setDrawColor(220)
    pdf.setLineWidth(0.3)
    pdf.line(M, H - 8, W - M, H - 8)
  }

  const np = () => { footer(); pdf.addPage(); pageNum++ }

  const sectionStart = (title, iconChar = '') => {
    np()
    sections.push({ title, page: pageNum })
    pdf.setFillColor(...accent)
    pdf.rect(0, 0, W, 16, 'F')
    pdf.setFontSize(14); pdf.setFont(undefined, 'bold'); pdf.setTextColor(255, 255, 255)
    pdf.text(title, M, 11)
    pdf.setFont(undefined, 'normal'); pdf.setTextColor(50)
    return 22
  }

  const sub = (y, t) => {
    pdf.setFontSize(9); pdf.setFont(undefined, 'bold'); pdf.setTextColor(...accent)
    pdf.text(t.toUpperCase(), M, y)
    pdf.setFont(undefined, 'normal'); pdf.setTextColor(50)
    return y + 5
  }

  const tbl = (sy, head, body, opts = {}) => {
    pdf.autoTable({
      startY: sy,
      head: [head],
      body,
      margin: { left: M, right: M },
      styles: {
        fontSize: 7.5, cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
        lineColor: [225, 225, 230], lineWidth: 0.2, textColor: [35, 35, 45],
        font: 'helvetica',
      },
      headStyles: { fillColor: accent, textColor: 255, fontStyle: 'bold', fontSize: 7.5, halign: 'center' },
      alternateRowStyles: { fillColor: [248, 248, 252] },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index > 0) {
          data.cell.styles.halign = 'center'
        }
      },
      ...opts,
    })
    return pdf.lastAutoTable.finalY + 4
  }

  const checkPB = (y, n = 45) => {
    if (y > H - n) { np(); return 24 }
    return y
  }

  const varColor = (str) => {
    if (!str || str === '—' || str === 'Nuevo') return [50, 50, 50]
    return str.startsWith('+') ? [22, 163, 74] : [220, 38, 38]
  }

  // ── PORTADA ───────────────────────────────────────────────────────────────
  onProgress?.(0, 10, 'Portada')
  pdf.setFillColor(...accent)
  pdf.rect(0, 0, W, H, 'F')

  // White overlay strip
  pdf.setFillColor(255, 255, 255)
  pdf.roundedRect(M, 40, COL, 120, 4, 4, 'F')

  pdf.setFont(undefined, 'bold')
  pdf.setFontSize(32); pdf.setTextColor(255)
  pdf.text('Reporte Mensual', M + 8, 28)

  pdf.setFontSize(11); pdf.setTextColor(255, 255, 255, 0.7)
  pdf.text('Performance Dashboard', M + 8, 36)

  pdf.setFontSize(22); pdf.setTextColor(...accent)
  pdf.text(brandName, M + 8, 60)

  pdf.setFont(undefined, 'normal')
  pdf.setFontSize(14); pdf.setTextColor(80)
  pdf.text(label, M + 8, 72)

  // Summary table on cover
  let cy = 84
  pdf.setFontSize(8.5); pdf.setFont(undefined, 'bold'); pdf.setTextColor(120)
  pdf.text('RESUMEN GENERAL', M + 8, cy); cy += 6

  const coverHead = ['Plataforma', 'Seguidores', 'Alcance / Views', 'Interacciones', 'Inversión']
  const coverBody = ['facebook', 'instagram', 'tiktok'].map(p => {
    const d = getH(p, selectedMonth)
    const reach = p === 'tiktok' ? d.views : d.alcance
    return [
      p.charAt(0).toUpperCase() + p.slice(1),
      fN(d.seguidores), fN(reach), fN(d.interacciones), fC(d.inversion),
    ]
  })

  pdf.autoTable({
    startY: cy, head: [coverHead], body: coverBody,
    margin: { left: M + 4, right: M + 4 },
    styles: { fontSize: 8, cellPadding: 3, textColor: [40, 40, 40] },
    headStyles: { fillColor: [30, 30, 50], textColor: 255, fontStyle: 'bold', fontSize: 8, halign: 'center' },
    alternateRowStyles: { fillColor: [245, 245, 252] },
    didParseCell: (d) => { if (d.section === 'body' && d.column.index > 0) d.cell.styles.halign = 'center' },
  })

  pdf.setFontSize(7.5); pdf.setFont(undefined, 'normal'); pdf.setTextColor(150)
  pdf.text(`Generado: ${new Date().toLocaleString('es-MX')}`, M + 8, H - 14)
  footer()

  // ── OVERVIEW / GENERAL ────────────────────────────────────────────────────
  onProgress?.(1, 10, 'Resumen general')
  let y = sectionStart('Resumen General')

  const allFilt = filteredData
  const totSeg = v(allFilt.facebook?.seguidores) + v(allFilt.instagram?.seguidores) + v(allFilt.tiktok?.seguidores)
  const totAlc = v(allFilt.facebook?.alcance) + v(allFilt.instagram?.alcance) + v(allFilt.tiktok?.views)
  const totInt = v(allFilt.facebook?.interacciones) + v(allFilt.instagram?.interacciones) + v(allFilt.tiktok?.interacciones)
  const campInv = (allFilt.campanas || []).reduce((s, r) => s + v(r.inversion), 0)
  const gadsInv = (allFilt.googleAds || []).reduce((s, r) => s + v(r.inversion), 0)

  const prevFb = getH('facebook', mesAnt)
  const prevIg = getH('instagram', mesAnt)
  const prevTt = getH('tiktok', mesAnt)
  const prevSeg = v(prevFb.seguidores) + v(prevIg.seguidores) + v(prevTt.seguidores)
  const prevAlc = v(prevFb.alcance)    + v(prevIg.alcance)    + v(prevTt.views)
  const prevInt = v(prevFb.interacciones) + v(prevIg.interacciones) + v(prevTt.interacciones)

  y = sub(y, 'KPIs Consolidados')
  y = tbl(y,
    ['Indicador', 'Valor Actual', 'Mes Anterior', 'Variación'],
    [
      ['Total Seguidores',    fN(totSeg),            fN(prevSeg),          vari(totSeg, prevSeg)],
      ['Alcance / Views',     fN(totAlc),            fN(prevAlc),          vari(totAlc, prevAlc)],
      ['Interacciones',       fN(totInt),            fN(prevInt),          vari(totInt, prevInt)],
      ['Inversión Campañas',  fC(campInv),           '—',                  '—'],
      ['Inversión Google Ads',fC(gadsInv),           '—',                  '—'],
      ['Inversión Total',     fC(campInv + gadsInv), '—',                  '—'],
    ],
    {
      columnStyles: { 3: { fontStyle: 'bold' } },
      didParseCell: (d) => {
        if (d.section === 'body' && d.column.index === 3 && d.cell.raw) {
          const s = String(d.cell.raw)
          if (s.startsWith('+')) d.cell.styles.textColor = [22, 163, 74]
          else if (s.startsWith('-')) d.cell.styles.textColor = [220, 38, 38]
        }
        if (d.section === 'body' && d.column.index > 0) d.cell.styles.halign = 'center'
      },
    },
  )

  y = checkPB(y, 50)
  y = sub(y, 'Comparativo por Plataforma')
  y = tbl(y,
    ['Plataforma', 'Seguidores', 'vs Ant.', 'Alcance/Views', 'vs Ant.', 'Interacciones', 'vs Ant.', 'Inversión'],
    ['facebook', 'instagram', 'tiktok'].map(p => {
      const act = allFilt[p] || {}, ant = getH(p, mesAnt)
      const alcF = p === 'tiktok' ? 'views' : 'alcance'
      return [
        p.charAt(0).toUpperCase() + p.slice(1),
        fN(act.seguidores), vari(v(act.seguidores), v(ant.seguidores)),
        fN(act[alcF]),      vari(v(act[alcF]),      v(ant[alcF])),
        fN(act.interacciones), vari(v(act.interacciones), v(ant.interacciones)),
        fC(act.inversion),
      ]
    }),
    {
      didParseCell: (d) => {
        if (d.section === 'body' && [2,4,6].includes(d.column.index)) {
          const s = String(d.cell.raw || '')
          d.cell.styles.fontStyle = 'bold'
          if (s.startsWith('+')) d.cell.styles.textColor = [22, 163, 74]
          else if (s.startsWith('-')) d.cell.styles.textColor = [220, 38, 38]
          d.cell.styles.halign = 'center'
        }
        if (d.section === 'body' && d.column.index > 0) d.cell.styles.halign = 'center'
      },
    },
  )

  // ── PLATAFORMAS ────────────────────────────────────────────────────────────
  const platConfigs = [
    { key: 'facebook',  label: 'Facebook',  reach: 'alcance' },
    { key: 'instagram', label: 'Instagram', reach: 'alcance' },
    { key: 'tiktok',    label: 'TikTok',    reach: 'views' },
  ]

  for (let i = 0; i < platConfigs.length; i++) {
    const pc  = platConfigs[i]
    onProgress?.(i + 2, 10, pc.label)
    y = sectionStart(pc.label)

    const act = allFilt[pc.key] || {}
    const ant = getH(pc.key, mesAnt)

    // KPIs table
    y = sub(y, 'Métricas Principales')
    const kpis = [
      ['Seguidores',              fN(act.seguidores),         fN(ant.seguidores),         vari(v(act.seguidores),     v(ant.seguidores))],
      ['Nuevos Seguidores',       fN(act.nuevos_seguidores),  fN(ant.nuevos_seguidores),  vari(v(act.nuevos_seguidores), v(ant.nuevos_seguidores))],
      [pc.key === 'tiktok' ? 'Views' : 'Alcance', fN(act[pc.reach]), fN(ant[pc.reach]), vari(v(act[pc.reach]), v(ant[pc.reach]))],
      ['Interacciones',           fN(act.interacciones),      fN(ant.interacciones),      vari(v(act.interacciones),  v(ant.interacciones))],
      ['Impresiones',             fN(act.impresiones),        fN(ant.impresiones),        vari(v(act.impresiones),    v(ant.impresiones))],
      ['Publicaciones',           fN(act.publicaciones),      fN(ant.publicaciones),      vari(v(act.publicaciones),  v(ant.publicaciones))],
      ['Engagement Rate',         fP(act.engagement_rate),    fP(ant.engagement_rate),    ''],
      ['Inversión',               fC(act.inversion),          fC(ant.inversion),          vari(v(act.inversion),      v(ant.inversion))],
    ]
    if (pc.key === 'tiktok') {
      kpis.splice(3, 0, ['Views 6s+', fN(act.views_6s), fN(ant.views_6s), vari(v(act.views_6s), v(ant.views_6s))])
    }

    y = tbl(y,
      ['Métrica', 'Valor Actual', 'Mes Anterior', 'Variación'],
      kpis,
      {
        columnStyles: { 0: { cellWidth: 45 } },
        didParseCell: (d) => {
          if (d.section === 'body' && d.column.index === 3) {
            const s = String(d.cell.raw || '')
            d.cell.styles.fontStyle = 'bold'
            if (s.startsWith('+')) d.cell.styles.textColor = [22, 163, 74]
            else if (s.startsWith('-')) d.cell.styles.textColor = [220, 38, 38]
          }
          if (d.section === 'body' && d.column.index > 0) d.cell.styles.halign = 'center'
        },
      },
    )

    // Campaigns
    const camps = (allFilt.campanas || []).filter(c => c.plataforma === pc.key)
    if (camps.length > 0) {
      y = checkPB(y, 55)
      y = sub(y, 'Campañas por Bucket')
      const proyP = (allFilt.proyecciones || []).filter(p => p.plataforma === pc.key)
      const bMap  = new Map()
      for (const c of camps) {
        const b = c._bucket || tipoCampanaToBucket(c.tipo_campana)
        const o = c._objective || c.objetivo_detectado || c.objetivo || 'Sin objetivo'
        const k = `${b}|${o}`
        if (!bMap.has(k)) bMap.set(k, { b, o, res: 0, inv: 0, meta: null })
        const e = bMap.get(k); e.res += v(c.resultado); e.inv += v(c.inversion)
      }
      for (const p of proyP) {
        const b = tipoCampanaToBucket(p.tipo_campana)
        const o = p.objetivo || p.metrica || 'Sin objetivo'
        const k = `${b}|${o}`
        if (!bMap.has(k)) bMap.set(k, { b, o, res: 0, inv: 0, meta: null })
        const e = bMap.get(k); e.meta = v(p.meta)
        if (e.res === 0) e.res = v(p.real)
      }
      if (bMap.size > 0) {
        y = tbl(y,
          ['Bucket', 'Objetivo', 'Resultado', 'Meta', 'Cumpl.', 'Inversión', 'CPR'],
          Array.from(bMap.values()).map(e => [
            bucketToLabel(e.b, e.b), e.o, fN(e.res),
            e.meta ? fN(e.meta) : '—',
            e.meta > 0 ? `${((e.res / e.meta) * 100).toFixed(1)}%` : '—',
            fC(e.inv), e.res > 0 ? `$${(e.inv / e.res).toFixed(2)}` : '—',
          ]),
          {
            columnStyles: { 1: { cellWidth: 45 } },
            didParseCell: (d) => {
              if (d.section === 'body' && d.column.index === 4 && d.cell.raw !== '—') {
                const pct = parseFloat(String(d.cell.raw))
                if (!isNaN(pct)) {
                  if (pct >= 100) d.cell.styles.textColor = [22, 163, 74]
                  else if (pct < 70)  d.cell.styles.textColor = [220, 38, 38]
                  else d.cell.styles.textColor = [180, 120, 0]
                  d.cell.styles.fontStyle = 'bold'
                }
              }
              if (d.section === 'body' && d.column.index > 1) d.cell.styles.halign = 'center'
            },
          },
        )
      }
    }

    // Historical
    const histRows = (Array.isArray(allData?.[pc.key]) ? allData[pc.key] : [])
    const histM = [...new Set(histRows.map(r => r.mes).filter(Boolean))].sort().slice(-6)
    if (histM.length > 1) {
      y = checkPB(y, 50)
      y = sub(y, 'Evolución Histórica (últimos 6 meses)')
      y = tbl(y,
        ['Mes', 'Seguidores', pc.key === 'tiktok' ? 'Views' : 'Alcance', 'Interacciones', 'Inversión'],
        histM.map(m => {
          const d = getH(pc.key, m)
          return [formatMonthShort(m), fN(d.seguidores), fN(d[pc.reach]), fN(d.interacciones), fC(d.inversion)]
        }),
      )
    }
  }

  // ── GOOGLE ADS ─────────────────────────────────────────────────────────────
  onProgress?.(5, 10, 'Google Ads')
  const gaD = allFilt.googleAds || []
  if (features?.googleAds !== false && gaD.length > 0) {
    y = sectionStart('Google Ads')
    const gaAnt  = (Array.isArray(allData?.googleAds) ? allData.googleAds : []).filter(r => r.mes === mesAnt)
    const tot    = gaD.reduce((a, r) => ({
      i: a.i + v(r.impresiones_visibles), c: a.c + v(r.clics),
      vw: a.vw + v(r.visualizaciones),    inv: a.inv + v(r.inversion),
    }), { i: 0, c: 0, vw: 0, inv: 0 })
    const antT   = gaAnt.reduce((a, r) => ({
      i: a.i + v(r.impresiones_visibles), c: a.c + v(r.clics),
      vw: a.vw + v(r.visualizaciones),    inv: a.inv + v(r.inversion),
    }), { i: 0, c: 0, vw: 0, inv: 0 })

    y = sub(y, 'KPIs Generales')
    y = tbl(y,
      ['Métrica', 'Valor Actual', 'Mes Anterior', 'Variación'],
      [
        ['Imp. Visibles',  fN(tot.i),   fN(antT.i),   vari(tot.i,   antT.i)],
        ['Clics',          fN(tot.c),   fN(antT.c),   vari(tot.c,   antT.c)],
        ['CTR',            tot.i > 0 ? `${((tot.c / tot.i) * 100).toFixed(2)}%` : '—', '', ''],
        ['Views (Video)',  fN(tot.vw),  fN(antT.vw),  vari(tot.vw,  antT.vw)],
        ['Inversión',      fC(tot.inv), fC(antT.inv), vari(tot.inv, antT.inv)],
      ],
      {
        didParseCell: (d) => {
          if (d.section === 'body' && d.column.index === 3) {
            const s = String(d.cell.raw || '')
            if (s.startsWith('+')) d.cell.styles.textColor = [22, 163, 74]
            else if (s.startsWith('-')) d.cell.styles.textColor = [220, 38, 38]
            d.cell.styles.fontStyle = 'bold'
          }
          if (d.section === 'body' && d.column.index > 0) d.cell.styles.halign = 'center'
        },
      },
    )

    // By type
    const byT = {}
    for (const r of gaD) {
      const tp = r.tipo_red || 'Otro'
      if (!byT[tp]) byT[tp] = { i: 0, vw: 0, c: 0, inv: 0 }
      byT[tp].i   += v(r.impresiones_visibles)
      byT[tp].vw  += v(r.visualizaciones)
      byT[tp].c   += v(r.clics)
      byT[tp].inv += v(r.inversion)
    }
    if (Object.keys(byT).length > 0) {
      y = checkPB(y, 50)
      y = sub(y, 'Desglose por Tipo')
      y = tbl(y,
        ['Tipo', 'Imp./Views', 'Clics', 'Inversión', 'CPM/CPV'],
        Object.entries(byT).map(([tp, vals]) => {
          const metric = tp.toLowerCase().includes('video') ? vals.vw : vals.i
          const cpm    = metric > 0 ? (vals.inv / metric) * 1000 : 0
          return [tp, fN(metric), fN(vals.c), fC(vals.inv), cpm > 0 ? `$${cpm.toFixed(2)}` : '—']
        }),
      )
    }
  }

  // ── SENTIMENT ──────────────────────────────────────────────────────────────
  onProgress?.(6, 10, 'Sentiment')
  const sent = allFilt.sentiment
  if (sent) {
    y = sectionStart('Análisis de Sentimiento')
    y = sub(y, 'Distribución de Sentimiento')
    y = tbl(y,
      ['Sentimiento Positivo', 'Sentimiento Neutro', 'Sentimiento Negativo'],
      [[fP(sent.positivo_pct), fP(sent.neutro_pct), fP(sent.negativo_pct)]],
      {
        didParseCell: (d) => {
          if (d.section === 'body') {
            if (d.column.index === 0) d.cell.styles.textColor = [22, 163, 74]
            if (d.column.index === 1) d.cell.styles.textColor = [100, 100, 100]
            if (d.column.index === 2) d.cell.styles.textColor = [220, 38, 38]
            d.cell.styles.fontSize = 12
            d.cell.styles.fontStyle = 'bold'
            d.cell.styles.halign = 'center'
          }
        },
      },
    )
    if (sent.descripcion) {
      y = sub(y, 'Análisis Cualitativo')
      pdf.setFontSize(8.5); pdf.setTextColor(60)
      const lines = pdf.splitTextToSize(String(sent.descripcion), COL)
      lines.forEach((line, i) => pdf.text(line, M, y + i * 4.5))
      y += lines.length * 4.5 + 6
    }
  }

  // ── COMPETENCIA ────────────────────────────────────────────────────────────
  onProgress?.(7, 10, 'Competencia')
  const comp = allFilt.competencia || []
  if (comp.length > 0) {
    y = sectionStart('Análisis de Competencia')
    const cAnt  = (Array.isArray(allData?.competencia) ? allData.competencia : []).filter(r => r.mes === mesAnt)
    const redes = [...new Set(comp.map(c => c.red))].filter(Boolean)
    for (const red of redes) {
      y = checkPB(y, 50)
      y = sub(y, red.charAt(0).toUpperCase() + red.slice(1))
      y = tbl(y,
        ['Competidor', 'Seguidores', 'vs Mes Ant.', 'Engagement %'],
        comp.filter(c => c.red === red).map(c => {
          const a = cAnt.find(x => x.competidor === c.competidor && x.red === red)
          return [c.competidor, fN(c.seguidores), a ? vari(v(c.seguidores), v(a.seguidores)) : '—', fP(c.engagement_pct)]
        }),
        {
          didParseCell: (d) => {
            if (d.section === 'body' && d.column.index === 2) {
              const s = String(d.cell.raw || '')
              if (s.startsWith('+')) d.cell.styles.textColor = [22, 163, 74]
              else if (s.startsWith('-')) d.cell.styles.textColor = [220, 38, 38]
              d.cell.styles.fontStyle = 'bold'
            }
            if (d.section === 'body' && d.column.index > 0) d.cell.styles.halign = 'center'
          },
        },
      )
    }
  }

  // ── PROYECCIONES ───────────────────────────────────────────────────────────
  onProgress?.(8, 10, 'Proyecciones')
  const proy = allFilt.proyecciones || []
  if (proy.length > 0) {
    y = sectionStart('Proyecciones y Metas')
    const platsProy = [...new Set(proy.map(p => p.plataforma).filter(Boolean))]
    for (const plat of platsProy) {
      const rows = proy.filter(p => p.plataforma === plat)
      if (rows.length === 0) continue
      y = checkPB(y, 50)
      y = sub(y, plat.charAt(0).toUpperCase() + plat.slice(1))
      y = tbl(y,
        ['Métrica / Objetivo', 'Tipo Campaña', 'Meta', 'Real', 'Cumplimiento', 'Inversión'],
        rows.map(r => {
          const meta = v(r.meta), real = v(r.real)
          const cumpl = meta > 0 ? `${((real / meta) * 100).toFixed(1)}%` : '—'
          return [
            r.metrica || r.objetivo || '—',
            r.tipo_campana || 'AON',
            fN(meta), fN(real), cumpl, fC(r.inversion),
          ]
        }),
        {
          didParseCell: (d) => {
            if (d.section === 'body' && d.column.index === 4 && d.cell.raw !== '—') {
              const pct = parseFloat(String(d.cell.raw))
              if (!isNaN(pct)) {
                if (pct >= 100) d.cell.styles.textColor = [22, 163, 74]
                else if (pct < 70) d.cell.styles.textColor = [220, 38, 38]
                else d.cell.styles.textColor = [180, 120, 0]
                d.cell.styles.fontStyle = 'bold'
              }
            }
            if (d.section === 'body' && d.column.index > 1) d.cell.styles.halign = 'center'
          },
        },
      )
    }
  }

  // ── HALLAZGOS ──────────────────────────────────────────────────────────────
  onProgress?.(9, 10, 'Hallazgos')
  const hall = allFilt.hallazgos  || []
  const obs  = allFilt.observaciones || []
  if (hall.length > 0 || obs.length > 0) {
    y = sectionStart('Hallazgos y Observaciones')
    if (hall.length > 0) {
      y = sub(y, 'Hallazgos')
      y = tbl(y,
        ['Tipo', 'Sección', 'Título', 'Descripción'],
        hall.map(h => [h.tipo || '', h.seccion || '', h.titulo || '', h.descripcion || '']),
        {
          columnStyles: { 3: { cellWidth: 100 } },
          didParseCell: (d) => {
            if (d.section === 'body' && d.column.index === 0) {
              const t = String(d.cell.raw || '').toLowerCase()
              if (t.includes('oportun')) d.cell.styles.textColor = [22, 163, 74]
              else if (t.includes('alerta') || t.includes('riesgo')) d.cell.styles.textColor = [220, 38, 38]
            }
          },
        },
      )
    }
    if (obs.length > 0) {
      y = checkPB(y, 50)
      y = sub(y, 'Observaciones')
      y = tbl(y,
        ['Sección', 'Título', 'Descripción'],
        obs.map(o => [o.seccion || '', o.titulo || '', o.descripcion || '']),
        { columnStyles: { 2: { cellWidth: 120 } } },
      )
    }
  }

  // ── ÍNDICE ─────────────────────────────────────────────────────────────────
  footer()
  pdf.addPage(); pageNum++
  pdf.setFillColor(...accent)
  pdf.rect(0, 0, W, 16, 'F')
  pdf.setFontSize(14); pdf.setFont(undefined, 'bold'); pdf.setTextColor(255)
  pdf.text('Índice de Contenido', M, 11)
  pdf.setFont(undefined, 'normal'); pdf.setTextColor(50)

  let ty = 26
  const allEntries = [{ title: 'Portada', page: 1 }, ...sections]
  for (const e of allEntries) {
    pdf.setFontSize(9.5)
    pdf.setTextColor(50); pdf.text(e.title, M + 3, ty)
    pdf.setTextColor(...accent); pdf.text(`Pág. ${e.page}`, W - M - 3, ty, { align: 'right' })
    const tw = pdf.getTextWidth(e.title)
    const pw = pdf.getTextWidth(`Pág. ${e.page}`)
    pdf.setDrawColor(200); pdf.setLineDashPattern([0.8, 0.8])
    pdf.line(M + 3 + tw + 3, ty - 0.5, W - M - 3 - pw - 3, ty - 0.5)
    pdf.setLineDashPattern([])
    ty += 7
    if (ty > H - 14) {
      footer()
      pdf.addPage(); pageNum++
      ty = 24
    }
  }
  footer()

  // ── SAVE ───────────────────────────────────────────────────────────────────
  const safe = brandName.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '').trim().replace(/\s+/g, '_')
  pdf.save(`Reporte_${safe}_${selectedMonth}.pdf`)
}
