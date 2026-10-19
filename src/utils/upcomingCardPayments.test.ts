import { describe, expect, it } from 'vitest'

import type { PaymentMethod, Transaction } from '@/types'
import { getUpcomingCardPayments } from '@/utils/upcomingCardPayments'

const card = (id: string, closingDay: number): PaymentMethod => ({
  id,
  user_id: 'u',
  name: id,
  type: 'credit',
  closing_day: closingDay,
  grace_days: 20,
  grace_days_type: 'natural',
  cardholder_name: null,
  created_at: '',
})

const makeTransaction = (
  id: string,
  date: string,
  amount: number,
  paymentMethodId: string
): Transaction => ({
  id,
  user_id: 'u',
  amount,
  type: 'expense',
  breakdown_status: 'completed',
  payment_method_id: paymentMethodId,
  merchant: id,
  note: null,
  date,
  latitude: null,
  longitude: null,
  created_at: '',
  purchase_type: 'one_time',
})

describe('getUpcomingCardPayments', () => {
  it('usa el corte más reciente cuando su fecha límite aún no vence', () => {
    const cardA = card('A', 15)
    const transactions = [
      makeTransaction('oct10', '2026-10-10', 300, cardA.id),
      makeTransaction('oct20', '2026-10-20', 450, cardA.id),
    ]

    const payments = getUpcomingCardPayments({
      paymentMethods: [cardA],
      transactions,
      recurringCharges: [],
      today: new Date(2026, 9, 19), // 19 oct 2026
    })

    expect(payments).toHaveLength(1)
    expect(payments[0].period.key).toBe('2026-10-15')
    expect(payments[0].amount).toBe(300)
    expect(payments[0].daysUntilDue).toBe(16) // 4 nov 2026
    expect(payments[0].pendingClosing).toBe(false)
  })

  it('avanza al siguiente corte cuando la fecha límite ya venció', () => {
    const cardA = card('A', 15)
    const transactions = [
      makeTransaction('oct10', '2026-10-10', 300, cardA.id),
      makeTransaction('oct20', '2026-10-20', 450, cardA.id),
    ]

    const payments = getUpcomingCardPayments({
      paymentMethods: [cardA],
      transactions,
      recurringCharges: [],
      today: new Date(2026, 10, 5), // 5 nov 2026; el pago del 4 nov ya pasó
    })

    expect(payments).toHaveLength(1)
    expect(payments[0].period.key).toBe('2026-11-15')
    expect(payments[0].amount).toBe(450)
    expect(payments[0].pendingClosing).toBe(true)
    // 15 nov + 20 días = sábado 5 dic → se recorre al lunes 7 dic.
    expect(payments[0].period.dueDate).toEqual(new Date(2026, 11, 7))
  })

  it('salta un corte en $0 y muestra el siguiente con saldo', () => {
    const cardA = card('A', 15)
    const transactions = [makeTransaction('nov10', '2026-11-10', 300, cardA.id)]

    const payments = getUpcomingCardPayments({
      paymentMethods: [cardA],
      transactions,
      recurringCharges: [],
      today: new Date(2026, 10, 4), // día de pago del corte 15 oct (sin cargos)
    })

    expect(payments).toHaveLength(1)
    expect(payments[0].period.key).toBe('2026-11-15')
    expect(payments[0].amount).toBe(300)
    expect(payments[0].pendingClosing).toBe(true)
  })

  it('ordena por fecha límite y omite tarjetas sin cargos', () => {
    const cardA = card('A', 15) // paga 4 nov
    const cardB = card('B', 20) // paga 9 nov
    const cardC = card('C', 10) // sin movimientos

    const payments = getUpcomingCardPayments({
      paymentMethods: [cardB, cardC, cardA],
      transactions: [
        makeTransaction('a', '2026-10-10', 100, cardA.id),
        makeTransaction('b', '2026-10-12', 200, cardB.id),
      ],
      recurringCharges: [],
      today: new Date(2026, 9, 19),
    })

    expect(payments.map((payment) => payment.card.id)).toEqual(['A', 'B'])
    expect(payments.map((payment) => payment.amount)).toEqual([100, 200])
  })
})
