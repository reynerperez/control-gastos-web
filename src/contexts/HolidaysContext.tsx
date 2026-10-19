import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { Holiday } from '@/types'
import { supabase } from '@/utils/supabase'

// ═══════════════════════════════════════════════════════════════
// 📅 Holidays — calendario global de días inhábiles bancarios
//
// Se carga una sola vez y se comparte con todos los cálculos de fechas.
// Es información global (no por usuario), por eso vive fuera de useData.
// ═══════════════════════════════════════════════════════════════

interface HolidaysContextValue {
  /** Fechas ISO YYYY-MM-DD para búsquedas O(1) */
  holidays: ReadonlySet<string>
  holidayList: Holiday[]
  loading: boolean
  refresh: () => Promise<void>
}

const HolidaysContext = createContext<HolidaysContextValue | null>(null)

export function HolidaysProvider({ children }: { children: ReactNode }) {
  const [holidayList, setHolidayList] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('holidays')
      .select('*')
      .eq('country_code', 'MX')
      .order('holiday_date')

    if (error) {
      // Si la migración aún no está aplicada, la app sigue funcionando
      // con fines de semana; solo no conoce los días bancarios.
      console.warn('No se pudo cargar el calendario de días inhábiles:', error.message)
      setHolidayList([])
    } else {
      setHolidayList((data as Holiday[]) ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const value = useMemo<HolidaysContextValue>(() => {
    const holidays = new Set(
      holidayList.map((holiday) => holiday.holiday_date)
    )
    return { holidays, holidayList, loading, refresh: load }
  }, [holidayList, loading, load])

  return (
    <HolidaysContext.Provider value={value}>
      {children}
    </HolidaysContext.Provider>
  )
}

export function useHolidays(): HolidaysContextValue {
  const context = useContext(HolidaysContext)
  if (!context) {
    throw new Error('useHolidays debe usarse dentro de un HolidaysProvider')
  }
  return context
}
