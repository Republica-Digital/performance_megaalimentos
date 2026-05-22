import { motion } from 'framer-motion'

export function DataTable({ columns = [], data = [], emptyMessage = 'Sin datos disponibles' }) {
  if (!data?.length) {
    return (
      <div className="glass-card rounded-2xl py-10 text-center">
        <p className="text-white/45 text-sm">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-white/60 ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <motion.tr
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.04 }}
                className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 text-white/85 ${
                      col.align === 'right' ? 'text-right font-mono' : ''
                    } ${col.bold ? 'font-semibold' : ''}`}
                  >
                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '-')}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
