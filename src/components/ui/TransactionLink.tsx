import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { useModals } from '@/contexts/ModalsContext'
import { isModifiedClick } from '@/utils/linkClicks'

const linkStyle: CSSProperties = {
  display: 'block',
  color: 'inherit',
  textDecoration: 'none',
}

type Props = {
  transactionId: string
  children: ReactNode
  ariaLabel?: string
  /** Ajustes de presentación (p. ej. inline-flex para un enlace dentro de una fila) */
  style?: CSSProperties
}

/**
 * Enlace real a `/movimientos/:id`.
 *
 * - Clic normal: abre el detalle en un side peek dentro de la misma pestaña.
 * - Ctrl/Cmd + clic, clic central o clic derecho → abrir en otra pestaña:
 *   el navegador navega a la ruta y se muestra la página completa.
 */
export function TransactionLink({ transactionId, children, ariaLabel, style }: Props) {
  const { openTransactionPeek } = useModals()

  return (
    <Link
      to={`/movimientos/${transactionId}`}
      aria-label={ariaLabel}
      style={{ ...linkStyle, ...style }}
      onClick={(event) => {
        if (event.defaultPrevented || isModifiedClick(event)) return
        event.preventDefault()
        openTransactionPeek(transactionId)
      }}>
      {children}
    </Link>
  )
}
