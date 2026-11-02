import { describe, expect, it } from 'vitest'

import type { PaymentMethod } from '@/types'
import { getCardUsageSchedules } from '@/utils/cardUsageRanges'
import { getCreditCardPlans } from '@/utils/creditCardRecommendation'
import { toISODate } from '@/utils/format'

const card = (id: string, closing: number, grace: number, type: PaymentMethod['type'] = 'credit'): PaymentMethod => ({
  id, user_id: 'u', name: id, type, closing_day: closing, grace_days: grace,
  grace_days_type: 'natural', created_at: '',
})
const cards = [
  card('nu-pao', 26, 10), card('rappi-pao', 15, 20), card('bbva-reny', 11, 20),
  card('liverpool', 9, 20, 'departmental'), card('nu-reny', 18, 10),
  card('banamex-pao', 2, 20), card('bbva-pao', 2, 20),
]
const date = (value: Date | null | undefined) => value ? toISODate(value) : null

describe('rangos completos de uso por tarjeta en la web', () => {
  it('recupera el inicio anterior a hoy de cada tarjeta, aunque compartan la recomendación actual', () => {
    const { schedules } = getCardUsageSchedules(cards, new Set(), new Date(2026, 10, 1))
    const nu = schedules.find((entry) => entry.method.id === 'nu-pao')!
    const rappi = schedules.find((entry) => entry.method.id === 'rappi-pao')!
    expect(date(nu.range?.startDate)).toBe('2026-10-27')
    expect(date(rappi.range?.startDate)).toBe('2026-10-16')
    expect(date(nu.range?.endDate)).toBe('2026-11-02')
    expect(date(rappi.range?.endDate)).toBe('2026-11-02')
    expect(nu.isCurrent).toBe(true)
    expect(rappi.isCurrent).toBe(true)
  })

  it('no parte el rango de Rappi cuando Nu empieza a empatar', () => {
    const before = getCardUsageSchedules(cards, new Set(), new Date(2026, 9, 20))
    const after = getCardUsageSchedules(cards, new Set(), new Date(2026, 10, 1))
    const a = before.schedules.find((entry) => entry.method.id === 'rappi-pao')!.range!
    const b = after.schedules.find((entry) => entry.method.id === 'rappi-pao')!.range!
    expect(date(a.startDate)).toBe(date(b.startDate))
    expect(date(a.endDate)).toBe('2026-11-02')
    expect(date(b.endDate)).toBe('2026-11-02')
  })

  it('conserva el pago y los días calculados desde hoy, no desde el inicio recuperado', () => {
    const today = new Date(2026, 10, 1)
    const { current } = getCardUsageSchedules(cards, new Set(), today)
    const plan = getCreditCardPlans(cards, new Set(), today)[0]
    expect(date(current?.startDate)).toBe('2026-11-01')
    expect(current?.bestPlan.financingDays).toBe(plan.financingDays)
    expect(date(current?.bestPlan.dueDate)).toBe(date(plan.dueDate))
  })

  it('muestra solo la próxima ventana para las tarjetas que no ganan hoy', () => {
    const { schedules } = getCardUsageSchedules(cards, new Set(), new Date(2026, 10, 3))
    const rappi = schedules.find((entry) => entry.method.id === 'rappi-pao')!
    expect(rappi.isCurrent).toBe(false)
    expect(date(rappi.range?.startDate)).toBe('2026-11-16')
    expect(date(rappi.range?.endDate)).toBe('2026-11-26')
  })

  it('recupera el inicio de diciembre cuando el rango vigente cruza de año', () => {
    const { schedules } = getCardUsageSchedules(cards, new Set(), new Date(2027, 0, 1))
    const nu = schedules.find((entry) => entry.method.id === 'nu-pao')!
    expect(date(nu.range?.startDate)).toBe('2026-12-27')
    expect(date(nu.range?.endDate)).toBe('2027-01-02')
  })

  it('utiliza los festivos al calcular los planes del rango', () => {
    const { current, schedules } = getCardUsageSchedules(cards, new Set(['2026-12-07']), new Date(2026, 10, 1))
    expect(date(current?.bestPlan.dueDate)).toBe('2026-12-08')
    expect(date(schedules.find((entry) => entry.method.id === 'rappi-pao')?.range?.startDate)).toBe('2026-10-16')
  })

  it('no inventa un inicio ni un final si la única tarjeta gana todo el horizonte', () => {
    const { schedules } = getCardUsageSchedules([cards[0]], new Set(), new Date(2026, 10, 1))
    expect(schedules).toHaveLength(1)
    expect(schedules[0].isCurrent).toBe(true)
    expect(schedules[0].range).toEqual({ startDate: null, endDate: null })
  })

  it('excluye departamentales y conserva las tarjetas sin un rango preferente', () => {
    const { schedules } = getCardUsageSchedules(cards, new Set(), new Date(2026, 10, 1))
    expect(schedules.some((entry) => entry.method.id === 'liverpool')).toBe(false)
    expect(schedules.find((entry) => entry.method.id === 'nu-reny')?.range).toBeNull()
    expect(getCardUsageSchedules([cards[3]], new Set(), new Date(2026, 10, 1)).current).toBeNull()
  })
})
