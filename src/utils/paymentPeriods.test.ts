import { describe, expect, it } from 'vitest'

import type { PaymentMethod, RecurringCharge, Transaction } from '@/types'
import { toISODate } from '@/utils/format'
import { buildCardPeriodGroups } from '@/utils/paymentPeriods'

const holidays = new Set([
  '2026-01-01',
  '2026-02-02',
  '2026-03-16',
  '2026-04-02',
  '2026-04-03',
  '2026-05-01',
  '2026-09-16',
  '2026-11-02',
  '2026-11-16',
  '2026-12-12',
  '2026-12-25',
])

const card: PaymentMethod = {
  id: 'card1',
  user_id: 'u',
  name: 'BBVA',
  type: 'credit',
  closing_day: 15,
  grace_days: 20,
  grace_days_type: 'natural',
  cardholder_name: null,
  created_at: '',
}

const makeTransaction = (
  id: string,
  date: string,
  amount: number,
  extra: Partial<Transaction> = {}
): Transaction => ({
  id,
  user_id: 'u',
  amount,
  type: 'expense',
  breakdown_status: 'completed',
  payment_method_id: card.id,
  merchant: id,
  note: null,
  date,
  latitude: null,
  longitude: null,
  created_at: '',
  purchase_type: 'one_time',
  ...extra,
})

const transactions: Transaction[] = [
  makeTransaction('ago', '2026-08-20', 100),
  makeTransaction('sep', '2026-09-20', 200),
  makeTransaction('oct10', '2026-10-10', 300),
  makeTransaction('msi', '2026-10-20', 12000, {
    purchase_type: 'installments',
    installments_count: 12,
    installments_start_date: '2026-11-15',
    installments_paid: 0,
    installments_settled_at: null,
  }),
]

const recurring: RecurringCharge = {
  id: 'luz',
  user_id: 'u',
  name: 'Luz',
  category_id: null,
  payment_method_id: card.id,
  amount: 500,
  is_variable_amount: true,
  frequency: 'monthly',
  charge_day: 20,
  start_date: '2026-01-01',
  end_date: null,
  active: true,
  note: null,
  created_at: '',
  updated_at: '',
  payment_method: card,
  category: null,
}

const base = {
  card,
  transactions,
  recurringCharges: [recurring],
  paymentMethods: [card],
  holidays,
  today: new Date(2026, 9, 19),
}

describe('buildCardPeriodGroups', () => {
  it('incluye el ciclo completo de un periodo pagado en octubre', () => {
    const groups = buildCardPeriodGroups({
      ...base,
      mode: 'month',
      bounds: { start: '2026-10-01', end: '2026-10-31' },
    })

    expect(groups).toHaveLength(1)
    const group = groups[0]
    expect(toISODate(group.period.dueDate)).toBe('2026-10-05')
    expect(group.transactions.map((t) => t.id)).toEqual(['ago'])
    expect(group.recurringLines).toHaveLength(1)
    expect(group.total).toBe(-600)
  })

  it('incluye compras de septiembre y octubre en el pago de noviembre', () => {
    const groups = buildCardPeriodGroups({
      ...base,
      mode: 'month',
      bounds: { start: '2026-11-01', end: '2026-11-30' },
    })

    expect(groups).toHaveLength(1)
    const group = groups[0]
    expect(toISODate(group.period.dueDate)).toBe('2026-11-04')
    expect(group.transactions.map((t) => t.id).sort()).toEqual(['oct10', 'sep'])
    expect(group.total).toBe(-1000)
  })

  it('mueve el pago de diciembre al lunes 7 y deduplica la primera parcialidad', () => {
    const groups = buildCardPeriodGroups({
      ...base,
      mode: 'month',
      bounds: { start: '2026-12-01', end: '2026-12-31' },
    })

    expect(groups).toHaveLength(1)
    const group = groups[0]
    expect(toISODate(group.period.dueDate)).toBe('2026-12-07')
    expect(group.transactions.map((t) => t.id)).toEqual(['msi'])
    // La primera parcialidad ya está en el movimiento, no se duplica.
    expect(group.installmentLines).toHaveLength(0)
    expect(group.total).toBe(-1500)
  })

  it('en todo el historial limita los recurrentes a 12 meses', () => {
    const groups = buildCardPeriodGroups({
      ...base,
      mode: 'all',
      bounds: {},
    })

    const recurringDates = groups
      .flatMap((group) => group.recurringLines)
      .map((line) => toISODate(line.occurrence.dueDate))

    expect(recurringDates.length).toBeGreaterThan(0)
    expect(recurringDates.every((date) => date <= '2027-10-31')).toBe(true)
    expect(recurringDates.some((date) => date.startsWith('2031'))).toBe(false)
  })
})
