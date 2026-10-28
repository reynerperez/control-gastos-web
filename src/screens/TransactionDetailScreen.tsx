import { useParams } from 'react-router-dom'

import { TransactionDetailContent } from '@/components/transaction/TransactionDetailContent'

/**
 * Detalle del movimiento — página completa (`/movimientos/:id`).
 * En la misma pestaña se abre como side peek; esta vista se usa al abrir
 * el enlace en otra pestaña, al recargar o al entrar directamente por URL.
 */
export default function TransactionDetailScreen() {
  const { id } = useParams<{ id: string }>()

  return <TransactionDetailContent transactionId={id ?? ''} variant="page" />
}
