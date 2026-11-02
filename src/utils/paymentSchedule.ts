import type { PaymentMethod } from '@/types'

/**
 * Texto corto de la configuración de pago de una tarjeta de crédito.
 *
 * Ejemplos:
 *   • `Corte 9 · Pago fijo día 9`
 *   • `Corte 15 · Pago 20 días naturales`
 */
export function formatCreditPaymentSchedule(method: PaymentMethod): string {
  const closing = method.closing_day ?? '—'

  if (method.due_day != null) {
    return `Corte ${closing} · Pago fijo día ${method.due_day}`
  }

  const grace = method.grace_days ?? 20
  const graceType = method.grace_days_type === 'business' ? 'hábiles' : 'naturales'
  return `Corte ${closing} · Pago ${grace} días ${graceType}`
}
