import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { TransactionDetailContent } from '@/components/transaction/TransactionDetailContent'
import { useModals } from '@/contexts/ModalsContext'
import { useData } from '@/hooks/useData'

/**
 * Side peek de movimientos, montado una sola vez para toda la app.
 * Cualquier pantalla puede abrirlo con `openTransactionPeek(id)`.
 *
 * El panel y sus acciones de header viven en `TransactionDetailContent` para
 * compartir el estado del candado con el contenido.
 */
export function TransactionPeek() {
  const location = useLocation()
  const { peekTransactionId, closeTransactionPeek } = useModals()
  const { transactions, loading } = useData()
  const previousPath = useRef(location.pathname)
  // Se conserva el último id para que el panel siga montado durante el slide
  // de salida; `open` es lo que le dice a SidePeek que ya debe cerrarse.
  const [displayedId, setDisplayedId] = useState<string | null>(null)

  // Se sincroniza durante el render (no en un effect) para que el contenido
  // nuevo esté listo en el mismo commit en que se abre el peek.
  if (peekTransactionId && peekTransactionId !== displayedId) {
    setDisplayedId(peekTransactionId)
  }

  // Al navegar a otra pantalla el peek deja de tener sentido: se cierra.
  useEffect(() => {
    if (previousPath.current === location.pathname) return
    previousPath.current = location.pathname
    closeTransactionPeek()
  }, [location.pathname, closeTransactionPeek])

  const transactionId = peekTransactionId ?? displayedId
  const open = Boolean(peekTransactionId)
  const transaction = transactionId
    ? transactions.find((item) => item.id === transactionId)
    : undefined

  // Si el movimiento se elimina (desde el formulario o el propio peek),
  // cerramos el panel en lugar de dejar un detalle vacío.
  useEffect(() => {
    if (!peekTransactionId || loading) return
    if (!transaction) closeTransactionPeek()
  }, [peekTransactionId, loading, transaction, closeTransactionPeek])

  if (!transactionId) return null

  return (
    <TransactionDetailContent
      transactionId={transactionId}
      variant="peek"
      open={open}
      onClose={closeTransactionPeek}
    />
  )
}
