import type { MouseEvent } from 'react'

/** Clic con modificador (nueva pestaña) o botón distinto del principal. */
export function isModifiedClick(event: MouseEvent<HTMLElement>): boolean {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
}

/**
 * Detiene un clic dentro de una fila-enlace: evita que navegue al detalle
 * cuando en realidad se pulsó un chip interno (desglose, expandir…).
 */
export function stopLinkActivation(event: unknown) {
  const target = event as {
    stopPropagation?: () => void
    preventDefault?: () => void
  }
  target.stopPropagation?.()
  target.preventDefault?.()
}
