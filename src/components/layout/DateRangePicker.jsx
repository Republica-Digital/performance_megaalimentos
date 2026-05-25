import { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatMonthLong } from '../../utils/format'

const DAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year, month) {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1 // Monday = 0
}

function toStr(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function CalendarGrid({ year, month, startDate, endDate, selecting, onDayClick, minDate, maxDate }) {
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfWeek(year, month)
  const cells = []

  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className="grid grid-cols-7 gap-0.5">
      {DAYS.map(d => (
        <div key={d} className="text-[10px] text-white/40 text-center font-semibold py-1">{d}</div>
      ))}
      {cells.map((day, i) => {
        if (!day) return <div key={`e-${i}`} />
        const dateStr = toStr(year, month, day)
        const disabled = (minDate && dateStr < minDate) || (maxDate && dateStr > maxDate)
        const isStart = dateStr === startDate
        const isEnd = dateStr === endDate
        const inRange = startDate && endDate && dateStr >= startDate && dateStr <= endDate
        const isToday = dateStr === new Date().toISOString().slice(0, 10)

        return (
          <button
            key={day}
            disabled={disabled}
            onClick={() => !disabled && onDayClick(dateStr)}
            className={`
              text-xs h-7 w-full rounded-md transition-all font-medium
              ${disabled ? 'text-white/15 cursor-not-allowed' : 'hover:bg-white/15 cursor-pointer'}
              ${isStart || isEnd ? 'bg-white/25 text-white font-bold' : ''}
              ${inRange && !isStart && !isEnd ? 'bg-white/10 text-white/80' : ''}
              ${!inRange && !disabled ? 'text-white/60' : ''}
              ${isToday && !inRange ? 'ring-1 ring-white/30' : ''}
            `}
          >
            {day}
          </button>
        )
      })}
    </div>
  )
}

export function DateRangePicker({
  mode, // 'month' | 'range'
  onModeChange,
  months = [],
  selectedMonth,
  onMonthChange,
  startDate,
  endDate,
  onRangeChange,
  minDate,
  maxDate,
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const [calYear, setCalYear] = useState(() => {
    const now = maxDate ? new Date(maxDate) : new Date()
    return now.getFullYear()
  })
  const [calMonth, setCalMonth] = useState(() => {
    const now = maxDate ? new Date(maxDate) : new Date()
    return now.getMonth()
  })
  const [selecting, setSelecting] = useState(null) // null | 'start' | 'end'
  const [tempStart, setTempStart] = useState(startDate)
  const [tempEnd, setTempEnd] = useState(endDate)

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  useEffect(() => { setTempStart(startDate); setTempEnd(endDate) }, [startDate, endDate])

  const handleDayClick = (dateStr) => {
    if (!tempStart || (tempStart && tempEnd)) {
      // Start new selection
      setTempStart(dateStr)
      setTempEnd(null)
      setSelecting('end')
    } else {
      // Finish selection
      if (dateStr < tempStart) {
        setTempEnd(tempStart)
        setTempStart(dateStr)
      } else {
        setTempEnd(dateStr)
      }
      setSelecting(null)
    }
  }

  const applyRange = () => {
    if (tempStart && tempEnd) {
      onRangeChange(tempStart, tempEnd)
      setOpen(false)
    }
  }

  const prevCal = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1) }
    else setCalMonth(calMonth - 1)
  }
  const nextCal = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1) }
    else setCalMonth(calMonth + 1)
  }

  // Display label
  const label = useMemo(() => {
    if (mode === 'month') return formatMonthLong(selectedMonth) || 'Seleccionar periodo'
    if (startDate && endDate) {
      const s = new Date(startDate + 'T12:00:00')
      const e = new Date(endDate + 'T12:00:00')
      const fmt = (d) => `${d.getDate()} ${MONTHS_ES[d.getMonth()].slice(0, 3)}`
      if (startDate.slice(0, 7) === endDate.slice(0, 7)) {
        return `${fmt(s)} – ${fmt(e)}, ${e.getFullYear()}`
      }
      return `${fmt(s)} – ${fmt(e)}, ${e.getFullYear()}`
    }
    return 'Seleccionar rango'
  }, [mode, selectedMonth, startDate, endDate])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="glass-strong flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white hover:bg-white/15 transition-colors"
      >
        <Calendar className="w-4 h-4 text-white/65" />
        <span className="max-w-[200px] truncate">{label}</span>
        <ChevronDown className={`w-4 h-4 text-white/65 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 top-full mt-2 z-50 glass-dropdown rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
            style={{ minWidth: 320 }}
          >
            {/* Tabs */}
            <div className="flex border-b border-white/10">
              <button
                onClick={() => onModeChange('month')}
                className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors
                  ${mode === 'month' ? 'text-white bg-white/10' : 'text-white/50 hover:text-white/70'}`}
              >
                Periodo
              </button>
              <button
                onClick={() => onModeChange('range')}
                className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors
                  ${mode === 'range' ? 'text-white bg-white/10' : 'text-white/50 hover:text-white/70'}`}
              >
                Rango personalizado
              </button>
            </div>

            {mode === 'month' ? (
              /* Month picker */
              <div className="p-3 max-h-[280px] overflow-y-auto space-y-1">
                {months.map(m => (
                  <button
                    key={m}
                    onClick={() => { onMonthChange(m); setOpen(false) }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors
                      ${m === selectedMonth ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/8 hover:text-white'}`}
                  >
                    {formatMonthLong(m)}
                  </button>
                ))}
              </div>
            ) : (
              /* Calendar range picker */
              <div className="p-3 space-y-3">
                {/* Calendar header */}
                <div className="flex items-center justify-between">
                  <button onClick={prevCal} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-semibold text-white">
                    {MONTHS_ES[calMonth]} {calYear}
                  </span>
                  <button onClick={nextCal} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <CalendarGrid
                  year={calYear}
                  month={calMonth}
                  startDate={tempStart}
                  endDate={tempEnd}
                  selecting={selecting}
                  onDayClick={handleDayClick}
                  minDate={minDate}
                  maxDate={maxDate}
                />

                {/* Selection summary + apply */}
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <div className="text-[11px] text-white/50">
                    {tempStart && !tempEnd && <span>Selecciona fecha fin</span>}
                    {tempStart && tempEnd && (
                      <span>{tempStart} → {tempEnd}</span>
                    )}
                    {!tempStart && <span>Selecciona fecha inicio</span>}
                  </div>
                  <button
                    onClick={applyRange}
                    disabled={!tempStart || !tempEnd}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                      ${tempStart && tempEnd ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-white/5 text-white/30 cursor-not-allowed'}`}
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
