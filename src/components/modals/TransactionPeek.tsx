import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

import { TransactionDetailContent } from '@/components/transaction/TransactionDetailContent'
import { IconButton } from '@/components/ui/CategoryIcon'
import { SidePeek } from '@/components/ui/SidePeek'
import { useModals } from '@/contexts/ModalsContext'
import { useData } from '@/hooks/useData'

/**
 * Side peek de movimientos, montado una sola vez para toda la app.
 * Cualquier pantalla puede abrirlo con `openTransactionPeek(id)`.
 */
export function TransactionPeek() {
  const location = useLocation()
  const { peekTransactionId, closeTransactionPeek } = useModals()
  const { transactions, loading } = useData()
  const previousPath = useRef(location.pathname)

  // Al navegar a otra pantalla el peek deja de tener sentido: se cierra.
  useEffect(() => {
    if (previousPath.current === location.pathname) return
    previousPath.current = location.pathname
    closeTransactionPeek()
  }, [location.pathname, closeTransactionPeek])

  const transaction = peekTransactionId
    ? transactions.find((item) => item.id === peekTransactionId)
    : undefined

  // Si el movimiento se elimina (desde el formulario o el propio peek),
  // cerramos el panel en lugar de dejar un detalle vacío.
  useEffect(() => {
    if (!peekTransactionId || loading) return
    if (!transaction) closeTransactionPeek()
  }, [peekTransactionId, loading, transaction, closeTransactionPeek])

  if (!peekTransactionId) return null

  const subtitle =
    transaction?.merchant?.trim() ||
    transaction?.details?.[0]?.category?.name ||
    undefined

  const openInNewTab = () => {
    window.open(
      `${window.location.origin}/movimientos/${peekTransactionId}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  return (
    <SidePeek
      open
      onClose={closeTransactionPeek}
      title="Detalle del movimiento"
      subtitle={subtitle}
      headerActions={
        <IconButton
          icon="open-outline"
          onPress={openInNewTab}
          ariaLabel="Abrir en otra pestaña"
        />
      }>
      <TransactionDetailContent
        transactionId={peekTransactionId}
        variant="peek"
        onClose={closeTransactionPeek}
      />
    </SidePeek>
  )
}
