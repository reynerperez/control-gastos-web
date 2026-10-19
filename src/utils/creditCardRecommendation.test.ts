import { describe, expect, it } from 'vitest'

import type { PaymentMethod } from '@/types'
import { EMPTY_HOLIDAYS } from '@/utils/bankingDates'
import {
  getCreditCardPlans,
  getStatementPeriod,
} from '@/utils/creditCardRecommendation'
import { toISODate } from '@/utils/format'

/**
 * Caso real: tarjeta Nu con corte el día 18 y 10 días de gracia.
 * Una compra del 19 oct 2026 entra al corte del 18 nov; el pago cae el
 * 28 nov (sábado) y se recorre al lunes 30 nov.
 */
const nuCard: PaymentMethod = {
  id: 'nu',
  user_id: 'u',
  name: 'Nu',
  type: 'credit',
  closing_day: 18,
  grace_days: 10,
  grace_days_type: 'natural',
  cardholder_name: null,
  created_at: '',
}

describe('recomendación de tarjeta Nu (corte 18, gracia 10)', () => {
  it('calcula el corte y la fecha límite de una compra de hoy', () => {
    const plan = getCreditCardPlans(
      [nuCard],
      EMPTY_HOLIDAYS,
      new Date(2026, 9, 19) // 19 oct 2026
    )[0]

    expect(toISODate(plan.closingDate)).toBe('2026-11-18')
    expect(toISODate(plan.rawDueDate)).toBe('2026-11-28')
    expect(toISODate(plan.dueDate)).toBe('2026-11-30')
    expect(plan.financingDays).toBe(42)
    expect(plan.adjusted).toBe(true)
  })

  it('asigna la compra del 19 oct al ciclo que cierra el 18 nov', () => {
    const period = getStatementPeriod('2026-10-19', nuCard, EMPTY_HOLIDAYS)

    expect(period).not.toBeNull()
    expect(toISODate(period!.startDate)).toBe('2026-10-19')
    expect(toISODate(period!.closingDate)).toBe('2026-11-18')
    expect(toISODate(period!.dueDate)).toBe('2026-11-30')
  })

  it('el ciclo anterior (corte 18 oct) vence el 28 oct', () => {
    const period = getStatementPeriod('2026-10-01', nuCard, EMPTY_HOLIDAYS)

    expect(period).not.toBeNull()
    expect(toISODate(period!.closingDate)).toBe('2026-10-18')
    expect(toISODate(period!.dueDate)).toBe('2026-10-28')
  })
})
