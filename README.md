# 🍿 Dashboard Megaalimentos

Dashboard interno de métricas de redes sociales, Google Ads y sentiment para las marcas de **Grupo Megaalimentos** (La Botanera, Chamoy Mega, Pacific Mix).

Los datos se leen **en vivo** desde un Google Sheet vía CSV público.

---

## ⚡ Quick start

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar el ID del Sheet
cp .env.example .env
# → edita .env y pega tu VITE_SHEET_ID

# 3. Correr en local
npm run dev

# 4. Build de producción
npm run build
```

---

## 📊 Estructura de datos

El dashboard consume **15 pestañas** del Google Sheet. Para el detalle exacto de columnas, formatos y valores permitidos, ver:

👉 **[`GUIA_SHEETS.md`](../GUIA_SHEETS.md)** — guía completa de llenado.

Pestañas requeridas:

| Pestaña | Contenido |
|---|---|
| `_CONFIG` | Configuración general de la empresa |
| `_MARCAS` | Catálogo de marcas con sus colores y logos |
| `Facebook` · `Instagram` · `TikTok` | KPIs mensuales por plataforma |
| `GoogleAds` + `_Ciudades` + `_Keywords` | Performance Google Ads |
| `Campañas` | **Campañas AON + extras** (con `tipo_campana`) |
| `TopPosts` | Posts destacados con embeds |
| `Sentiment` + `Sentiment_Capturas` | Análisis de sentimiento |
| `Competencia` | Benchmarks de competidores |
| `Hallazgos` + `Observaciones` | Insights del analista |
| `Proyecciones` | Proyecciones por objetivo |

---

## 🚀 Deploy en Vercel

1. Sube este repo a GitHub.
2. En [vercel.com](https://vercel.com) → **Import Project** → selecciona el repo.
3. Vercel detecta Vite automáticamente.
4. En **Environment Variables** agrega:
   - `VITE_SHEET_ID` = el ID de tu Google Sheet
5. **Deploy**.

El Google Sheet debe estar **"Publicado en la web"** (Archivo → Compartir → Publicar en la web → toda la hoja → CSV).

---

## 🎨 Arquitectura

```
src/
├── pages/
│   ├── BrandSelector.jsx   ← landing con las 3 marcas
│   └── Dashboard.jsx       ← router principal por sección
├── components/
│   ├── layout/             ← Sidebar, Header
│   ├── sections/           ← una por sección del sidebar
│   └── ui/                 ← KPICard, DataTable, PostCard, etc.
├── hooks/
│   └── useSheetData.js     ← carga y normaliza los 15 sheets
└── utils/
    ├── campaigns.js        ← clasifica AON / Mundial / Pal Norte
    ├── format.js           ← números, fechas, moneda
    └── urls.js             ← detección de embeds IG/FB/TT
```

---

## 🔧 Tecnologías

- **React 18** + **React Router 6**
- **Vite** (build y dev server)
- **Tailwind CSS** + **Framer Motion** (UI)
- **Recharts** (gráficos)
- **Papaparse** (parseo CSV desde Sheets)
- **Lucide React** (iconografía)

---

## 🐛 Troubleshooting

**El dashboard dice "Error al cargar los datos"**
- Revisa que `VITE_SHEET_ID` en `.env` sea correcto.
- Revisa que el Sheet esté **publicado en la web**.
- Revisa que los nombres de pestañas coincidan con los listados arriba (mayúsculas/minúsculas importan).

**Aparece "Sin datos para este mes"**
- El mes seleccionado no tiene fila para esa marca. Llena el Sheet o cambia de mes.

**Un KPI aparece en 0 o raro**
- Revisa que la columna numérica no tenga `"N/A"`, guiones, o letras. Usa `0` si no hay dato.

**Un post embed no se ve**
- El código `embed_url` requiere sesión privada (Ads Manager). Copia el embed público desde el post original. Ver sección "Top Posts" en la guía.

---

© Grupo Megaalimentos · Dashboard v2
