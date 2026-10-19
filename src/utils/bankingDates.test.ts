import { describe, expect, it } from 'vitest'

import {
  addBusinessDays,
  isBusinessDay,
  nextBusinessDay,
  resolveDueDate,
} from '@/utils/bankingDates'
import { nextClosingDate } from '@/utils/creditCardRecommendation'
import { toISODate } from '@/utils/format'

/** Días inhábiles bancarios de México 2026 (CNBV). */
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

const date = (iso: string) => new Date(`${iso}T00:00:00`)

describe('isBusinessDay', () => {
  it('excluye sábados y domingos', () => {
    expect(isBusinessDay(date('2026-10-17'), holidays)).toBe(false)
    expect(isBusinessDay(date('2026-10-18'), holidays)).toBe(false)
  })

  it('excluye días inhábiles bancarios', () => {
    expect(isBusinessDay(date('2026-11-02'), holidays)).toBe(false)
    expect(isBusinessDay(date('2026-04-02'), holidays)).toBe(false)
  })

  it('acepta un día hábil normal', () => {
    expect(isBusinessDay(date('2026-10-19'), holidays)).toBe(true)
  })
})

describe('addBusinessDays', () => {
  it('cuenta desde el día siguiente al corte', () => {
    // 16 oct (1), 19 (2), 20 (3), 21 (4), 22 (5)
    const due = addBusinessDays(date('2026-10-15'), 5, holidays)
    expect(toISODate(due)).toBe('2026-10-22')
  })

  it('salta el 2 de noviembre', () => {
    // 29 oct (1), 30 oct (2), 2 nov inhábil, 3 (3), 4 (4), 5 (5)
    const due = addBusinessDays(date('2026-10-28'), 5, holidays)
    expect(toISODate(due)).toBe('2026-11-05')
  })

  it('si el corte es sábado, el lunes es el día 1', () => {
    const due = addBusinessDays(date('2026-10-17'), 1, holidays)
    expect(toISODate(due)).toBe('2026-10-19')
  })
})

describe('resolveDueDate', () => {
  it('20 días naturales sin ajuste', () => {
    const result = resolveDueDate(
      date('2026-10-15'),
      { grace_days: 20, grace_days_type: 'natural' },
      holidays
    )
    expect(toISODate(result.dueDate)).toBe('2026-11-04')
    expect(result.adjusted).toBe(false)
  })

  it('mueve al siguiente día hábil si cae domingo y luego inhábil', () => {
    // 15 oct + 17 = 1 nov (domingo) → 2 nov inhábil → 3 nov
    const result = resolveDueDate(
      date('2026-10-15'),
      { grace_days: 17, grace_days_type: 'natural' },
      holidays
    )
    expect(toISODate(result.dueDate)).toBe('2026-11-03')
    expect(result.adjusted).toBe(true)
  })

  it('mueve el 5 de diciembre (sábado) al lunes 7', () => {
    const result = resolveDueDate(
      date('2026-11-15'),
      { grace_days: 20, grace_days_type: 'natural' },
      holidays
    )
    expect(toISODate(result.dueDate)).toBe('2026-12-07')
    expect(result.adjusted).toBe(true)
  })

  it('usa 20 días naturales por defecto', () => {
    const result = resolveDueDate(date('2026-10-15'), {}, holidays)
    expect(result.graceDays).toBe(20)
    expect(result.estimated).toBe(true)
  })
})

describe('nextClosingDate', () => {
  it('ajusta el día 31 al último día de febrero', () => {
    const closing = nextClosingDate(date('2026-02-10'), 31)
    expect(toISODate(closing)).toBe('2026-02-28')
  })

  it('si hoy es el día de corte, el corte es hoy', () => {
    const closing = nextClosingDate(date('2026-10-15'), 15)
    expect(toISODate(closing)).toBe('2026-10-15')
  })
})

describe('nextBusinessDay', () => {
  it('devuelve la misma fecha si ya es hábil', () => {
    expect(toISODate(nextBusinessDay(date('2026-10-19'), holidays))).toBe(
      '2026-10-19'
    )
  })

  it('salta fin de semana y día inhábil', () => {
    expect(toISODate(nextBusinessDay(date('2026-10-31'), holidays))).toBe(
      '2026-11-03'
    )
  })
})
