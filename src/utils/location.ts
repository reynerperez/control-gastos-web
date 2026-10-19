export interface Coords {
  latitude: number
  longitude: number
}

/**
 * Obtiene la ubicación actual del navegador (best-effort).
 *
 * Equivalente web de `utils/location.ts` del móvil: si el usuario niega el
 * permiso, no hay GPS o tarda demasiado, devuelve null sin lanzar error.
 * La API de geolocalización del navegador solo está disponible en
 * contextos seguros (https o localhost).
 */
export async function getCurrentCoords(timeoutMs = 8000): Promise<Coords | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null

  return new Promise<Coords | null>((resolve) => {
    let settled = false
    const finish = (value: Coords | null) => {
      if (settled) return
      settled = true
      resolve(value)
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        finish({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
      },
      () => finish(null),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60_000 }
    )

    setTimeout(() => finish(null), timeoutMs + 500)
  })
}
