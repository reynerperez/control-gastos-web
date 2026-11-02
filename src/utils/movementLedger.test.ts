import { describe, expect, it } from 'vitest'

import type { Category, PaymentMethod, Transaction } from '@/types'
import { EMPTY_HOLIDAYS } from '@/utils/bankingDates'
import {
  buildMovementEntries,
  getEntryCategoryAmounts,
  getEntrySignedAmount,
  sumMovementEntries,
} from '@/utils/movementLedger'

const category: Category = {
  id: 'compras',
  user_id: 'u',
  name: 'Compras',
  icon: 'bag',
  color: '#4F46E5',
  type: 'expense',
  requires_breakdown: false,
  created_at: '',
}

const liverpool: PaymentMethod = {
  id: 'liverpool',
  user_id: 'u',
  name: 'Liverpool pao',
  type: 'departmental',
  closing_day: 9,
  grace_days: 20,
  grace_days_type: 'natural',
  due_day: 9,
  cardholder_name: 'Paola González',
  created_at: '',
}

const purchase: Transaction = {
  id: 'compra-liverpool',
  user_id: 'u',
  amount: 764.15,
  type: 'expense',
  breakdown_status: 'completed',
  payment_method_id: liverpool.id,
  merchant: 'Liverpool',
  note: null,
  date: '2026-10-24',
  latitude: null,
  longitude: null,
  created_at: '',
  purchase_type: 'installments',
  installments_count: 6,
  installments_paid: 0,
  installments_start_date: '2026-11-09',
  installments_settled_at: null,
  details: [
    {
      id: 'detalle-compra',
      transaction_id: 'compra-liverpool',
      category_id: category.id,
      description: 'Liverpool',
      quantity: 1,
      unit_price: 764.15,
      created_at: '',
      category,
    },
  ],
}

const today = new Date(2026, 9, 30)

function build(transactions: Transaction[] = [purchase]) {
  return buildMovementEntries({
    transactions,
    paymentMethods: [liverpool],
    holidays: EMPTY_HOLIDAYS,
    today,
  })
}

describe('ledger mensual de MSI', () => {
  it('muestra la compra completa en octubre sin sumarla', () => {
    const entries = build()
    const october = entries.filter((entry) => entry.date.startsWith('2026-10'))

    expect(october).toHaveLength(1)
    expect(october[0].kind).toBe('msi-purchase')
    expect(october[0].displayAmount).toBe(764.15)
    expect(october[0].counted).toBe(false)
    expect(october[0].muted).toBe(true)
    expect(sumMovementEntries(october)).toBe(0)
  })

  it('cuenta la primera parcialidad en diciembre', () => {
    const entries = build()
    const december = entries.filter((entry) => entry.date.startsWith('2026-12'))

    expect(december).toHaveLength(1)
    expect(december[0].kind).toBe('msi-installment')
    expect(december[0].date).toBe('2026-12-09')
    expect(december[0].displayAmount).toBe(127.36)
    expect(sumMovementEntries(december)).toBe(-127.36)

    if (december[0].kind === 'msi-installment') {
      expect(december[0].installment.number).toBe(1)
      expect(december[0].installment.paid).toBe(false)
    }
  })

  it('reparte las 6 parcialidades en sus meses de pago', () => {
    const installments = build().filter(
      (entry) => entry.kind === 'msi-installment'
    )

    expect(installments.map((entry) => entry.date)).toEqual([
      '2027-05-09',
      '2027-04-09',
      '2027-03-09',
      '2027-02-09',
      '2027-01-09',
      '2026-12-09',
    ])
    expect(installments.map((entry) => entry.displayAmount)).toEqual([
      127.35,
      127.36,
      127.36,
      127.36,
      127.36,
      127.36,
    ])
    expect(
      installments.reduce((sum, entry) => sum + entry.displayAmount, 0)
    ).toBeCloseTo(764.15, 2)
  })

  it('asigna la categoría de la compra a cada parcialidad', () => {
    const december = build().find(
      (entry) =>
        entry.kind === 'msi-installment' && entry.date === '2026-12-09'
    )

    expect(december).toBeDefined()
    const allocations = getEntryCategoryAmounts(december!)
    expect(allocations).toHaveLength(1)
    expect(allocations[0].categoryId).toBe('compras')
    expect(allocations[0].category?.name).toBe('Compras')
    expect(allocations[0].amount).toBeCloseTo(127.36, 2)
  })

  it('no proyecta parcialidades posteriores a la liquidación', () => {
    const settled: Transaction = {
      ...purchase,
      installments_settled_at: '2027-01-15T12:00:00Z',
    }
    const installments = build([settled]).filter(
      (entry) => entry.kind === 'msi-installment'
    )

    expect(installments.map((entry) => entry.date)).toEqual([
      '2027-01-09',
      '2026-12-09',
    ])
  })
})

describe('ledger de movimientos normales', () => {
  it('mantiene el monto y el mes de la transacción', () => {
    const normal: Transaction = {
      ...purchase,
      id: 'normal',
      amount: 100,
      date: '2026-10-02',
      purchase_type: 'one_time',
      installments_count: null,
      installments_start_date: null,
      details: [
        {
          ...purchase.details![0],
          id: 'detalle-normal',
          transaction_id: 'normal',
          unit_price: 100,
        },
      ],
    }

    const entries = build([normal])

    expect(entries).toHaveLength(1)
    expect(entries[0].kind).toBe('transaction')
    expect(entries[0].date).toBe('2026-10-02')
    expect(entries[0].displayAmount).toBe(100)
    expect(entries[0].counted).toBe(true)
    expect(entries[0].muted).toBe(false)
    expect(getEntrySignedAmount(entries[0])).toBe(-100)
  })
})
