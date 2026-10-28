import { useEffect, useRef } from 'react'

import { useData } from '@/hooks/useData'

/** Mínimo entre refrescos automáticos para no saturar Supabase. */
const REFRESH_INTERVAL_MS = 20_000

/**
 * Refresca los datos al volver a la pestaña/ventana.
 *
 * En el espacio compartido los movimientos de la otra persona no llegan por
 * realtime: sin esto habría que recargar la página para verlos. La carga es
 * la misma que el botón de refrescar, así que reutiliza el estado `refreshing`.
 */
export function useAutoRefresh() {
  const { refresh } = useData()
  const lastRefresh = useRef(0)
  const inFlight = useRef(false)

  useEffect(() => {
    lastRefresh.current = Date.now()

    const maybeRefresh = () => {
      if (document.visibilityState === 'hidden') return
      if (inFlight.current) return
      if (Date.now() - lastRefresh.current < REFRESH_INTERVAL_MS) return

      inFlight.current = true
      lastRefresh.current = Date.now()
      void refresh().finally(() => {
        inFlight.current = false
      })
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') maybeRefresh()
    }

    window.addEventListener('focus', maybeRefresh)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('focus', maybeRefresh)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [refresh])
}
