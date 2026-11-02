import { describe, expect, it } from 'vitest'

import type { PaymentMethod } from '@/types'
import { EMPTY_HOLIDAYS } from '@/utils/bankingDates'
import {
  getBestCreditCard,
  getCreditCardPlans,
  getRecommendableMethods,
  getRecommendationCalendar,
  getStatementPeriod,
  getTodayRecommendation,
  getUpcomingIntervals,
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

function card(overrides: Partial<PaymentMethod>): PaymentMethod {
  return { ...nuCard, ...overrides }
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

describe('elegibilidad para recomendar', () => {
  it('excluye las departamentales de los planes, la mejor tarjeta y todo el calendario', () => {
    const storeCard = card({ id: 'liverpool', name: 'Liverpool Pao', type: 'departmental', closing_day: 9, due_day: 9 })
    const methods = [storeCard, nuCard]
    const today = new Date(2026, 10, 10)

    expect(getRecommendableMethods(methods).map((method) => method.id)).toEqual(['nu'])
    expect(getCreditCardPlans(methods, EMPTY_HOLIDAYS, today).map((plan) => plan.method.id)).toEqual(['nu'])
    expect(getBestCreditCard(methods, EMPTY_HOLIDAYS, today)?.method.id).toBe('nu')
    const calendar = getRecommendationCalendar(methods, EMPTY_HOLIDAYS, today)
    expect(calendar.length).toBeGreaterThan(0)
    expect(calendar.every((interval) => interval.methods.every((method) => method.id === 'nu'))).toBe(true)
    expect(getUpcomingIntervals(calendar, storeCard.id)).toEqual([])
    expect(getCreditCardPlans([storeCard], EMPTY_HOLIDAYS, today)).toEqual([])
    expect(getBestCreditCard([storeCard], EMPTY_HOLIDAYS, today)).toBeNull()
    expect(getRecommendationCalendar([storeCard], EMPTY_HOLIDAYS, today)).toEqual([])

    // Conservar el ciclo de pago aunque la tarjeta no sea recomendable.
    const period = getStatementPeriod('2026-11-10', storeCard, EMPTY_HOLIDAYS)
    expect(toISODate(period!.closingDate)).toBe('2026-12-09')
    expect(toISODate(period!.dueDate)).toBe('2027-01-09')
  })

  it('excluye tarjetas sin configuración completa', () => {
    const missingGrace = card({ id: 'sin-gracia', grace_days: null })
    const missingType = card({ id: 'sin-tipo', grace_days_type: undefined })
    const debit = card({ id: 'debito', type: 'debit' })

    const plans = getCreditCardPlans(
      [missingGrace, missingType, debit, nuCard],
      EMPTY_HOLIDAYS,
      new Date(2026, 9, 19)
    )

    expect(plans.map((plan) => plan.method.id)).toEqual(['nu'])
  })

  it('devuelve null si no hay tarjetas recomendables', () => {
    const best = getBestCreditCard(
      [card({ id: 'sin-gracia', grace_days: null })],
      EMPTY_HOLIDAYS,
      new Date(2026, 9, 19)
    )

    expect(best).toBeNull()
  })
})

describe('tarjetas con día fijo de pago', () => {
  const fixedCard = card({
    id: 'fija',
    name: 'Departamental',
    closing_day: 9,
    due_day: 9,
    grace_days: null,
    grace_days_type: undefined,
  })

  it('calcula el pago el día fijo del mes siguiente al corte', () => {
    const plan = getCreditCardPlans(
      [fixedCard],
      EMPTY_HOLIDAYS,
      new Date(2026, 9, 10) // 10 oct 2026
    )[0]

    expect(toISODate(plan.closingDate)).toBe('2026-11-09')
    expect(toISODate(plan.dueDate)).toBe('2026-12-09')
    expect(plan.dueDateMode).toBe('fixed_day')
    expect(plan.dueDay).toBe(9)
    expect(plan.financingDays).toBe(60)
    expect(plan.adjusted).toBe(false)
  })

  it('usa el mismo mes cuando el día fijo es posterior al corte', () => {
    const plan = getCreditCardPlans(
      [
        card({
          id: 'fija-misma-mes',
          closing_day: 5,
          due_day: 20,
          grace_days: null,
          grace_days_type: undefined,
        }),
      ],
      EMPTY_HOLIDAYS,
      new Date(2026, 9, 4) // 4 oct 2026
    )[0]

    expect(toISODate(plan.closingDate)).toBe('2026-10-05')
    expect(toISODate(plan.dueDate)).toBe('2026-10-20')
  })

  it('no se recorre a día hábil', () => {
    const plan = getCreditCardPlans(
      [
        card({
          id: 'fija-domingo',
          closing_day: 15,
          due_day: 15,
          grace_days: null,
          grace_days_type: undefined,
        }),
      ],
      EMPTY_HOLIDAYS,
      new Date(2026, 9, 15) // 15 oct 2026
    )[0]

    expect(toISODate(plan.dueDate)).toBe('2026-11-15') // domingo
    expect(plan.adjusted).toBe(false)
  })

  it('es recomendable sin días de gracia configurados', () => {
    expect(
      getCreditCardPlans(
        [fixedCard],
        EMPTY_HOLIDAYS,
        new Date(2026, 9, 19)
      ).map((plan) => plan.method.id)
    ).toEqual(['fija'])
    expect(
      getBestCreditCard([fixedCard], EMPTY_HOLIDAYS, new Date(2026, 9, 19))
        ?.method.id
    ).toBe('fija')
  })

  it('asigna el periodo y la fecha de pago fija', () => {
    const period = getStatementPeriod('2026-10-10', fixedCard, EMPTY_HOLIDAYS)

    expect(period).not.toBeNull()
    expect(toISODate(period!.closingDate)).toBe('2026-11-09')
    expect(toISODate(period!.dueDate)).toBe('2026-12-09')
    expect(period!.dueDateMode).toBe('fixed_day')
    expect(period!.dueDay).toBe(9)
  })

  it('entra al calendario de recomendaciones', () => {
    const calendar = getRecommendationCalendar(
      [fixedCard],
      EMPTY_HOLIDAYS,
      new Date(2026, 9, 30)
    )

    expect(calendar.length).toBeGreaterThan(0)
    expect(calendar[0].methods[0].id).toBe('fija')
  })
})

describe('orden y desempate', () => {
  it('desempata por días de gracia cuando la fecha de pago es la misma', () => {
    // Ambas compras del 19 oct caen al corte de noviembre y vencen el 30 nov.
    const moreGrace = card({
      id: 'mas-gracia',
      name: 'Más gracia',
      closing_day: 10,
      grace_days: 20,
    })
    const lessGrace = card({
      id: 'menos-gracia',
      name: 'Menos gracia',
      closing_day: 15,
      grace_days: 15,
    })

    const plans = getCreditCardPlans(
      [lessGrace, moreGrace],
      EMPTY_HOLIDAYS,
      new Date(2026, 9, 19)
    )

    expect(plans.map((plan) => plan.method.id)).toEqual([
      'mas-gracia',
      'menos-gracia',
    ])
    expect(plans[0].financingDays).toBe(plans[1].financingDays)
    expect(plans[0].dueDate.getTime()).toBe(plans[1].dueDate.getTime())
  })

  it('ordena todas las tarjetas de mayor a menor financiamiento', () => {
    const best = card({
      id: 'mejor',
      name: 'Mejor',
      closing_day: 5,
      grace_days: 30,
    })
    const moreGrace = card({
      id: 'mas-gracia',
      name: 'Más gracia',
      closing_day: 10,
      grace_days: 20,
    })
    const lessGrace = card({
      id: 'menos-gracia',
      name: 'Menos gracia',
      closing_day: 15,
      grace_days: 15,
    })
    const worst = card({
      id: 'peor',
      name: 'Peor',
      closing_day: 25,
      grace_days: 10,
    })

    const plans = getCreditCardPlans(
      [worst, lessGrace, best, moreGrace],
      EMPTY_HOLIDAYS,
      new Date(2026, 9, 19)
    )

    expect(plans.map((plan) => plan.method.id)).toEqual([
      'mejor',
      'mas-gracia',
      'menos-gracia',
      'peor',
    ])
  })
})

describe('calendario de recomendaciones', () => {
  const realCards: PaymentMethod[] = [
    card({ id: 'nu-pao', name: 'Nu Crédito Pao', closing_day: 26, grace_days: 10 }),
    card({ id: 'rappi-pao', name: 'Rappi Pao', closing_day: 15, grace_days: 20 }),
    card({ id: 'bbva-reny', name: 'BBVA Crédito Reny', closing_day: 11, grace_days: 20 }),
    card({ id: 'liverpool-pao', name: 'Liverpool Pao', type: 'departmental', closing_day: 9, grace_days: 20 }),
    card({ id: 'nu-reny', name: 'Nu Reny', closing_day: 18, grace_days: 10 }),
    card({ id: 'banamex-pao', name: 'Banamex Crédito Pao', closing_day: 2, grace_days: 20 }),
    card({ id: 'bbva-pao', name: 'BBVA Crédito Pao', closing_day: 2, grace_days: 20 }),
  ]

  /** "2026-10-30/2026-11-02 nu-pao+rappi-pao" */
  function label(interval: {
    startDate: Date
    endDate: Date
    methods: PaymentMethod[]
  }) {
    const ids = interval.methods.map((method) => method.id).sort().join('+')
    return `${toISODate(interval.startDate)}/${toISODate(interval.endDate)} ${ids}`
  }

  it('reproduce el patrón mensual con 6 tarjetas de crédito y una departamental', () => {
    const calendar = getRecommendationCalendar(
      realCards,
      EMPTY_HOLIDAYS,
      new Date(2026, 9, 30)
    )

    expect(calendar.slice(0, 6).map(label)).toEqual([
      '2026-10-30/2026-11-02 nu-pao+rappi-pao',
      '2026-11-03/2026-11-11 banamex-pao+bbva-pao',
      '2026-11-12/2026-11-15 bbva-reny',
      '2026-11-16/2026-11-26 rappi-pao',
      '2026-11-27/2026-12-02 nu-pao',
      '2026-12-03/2026-12-11 banamex-pao+bbva-pao',
    ])
    expect(calendar[0].maxFinancingDays).toBe(38)
  })

  it('incluye a todas las tarjetas empatadas en el mismo tramo', () => {
    const calendar = getRecommendationCalendar(
      [
        card({ id: 'first', name: 'First', closing_day: 18, grace_days: 10 }),
        card({ id: 'second', name: 'Second', closing_day: 18, grace_days: 10 }),
      ],
      EMPTY_HOLIDAYS,
      new Date(2026, 9, 19)
    )

    expect(calendar).toHaveLength(1)
    expect(calendar[0].methods).toHaveLength(2)
    expect(calendar[0].maxFinancingDays).toBe(42)
    expect(calendar[0].minFinancingDays).toBeGreaterThan(0)
  })

  it('no parte el tramo cuando cambia el corte de la propia ganadora', () => {
    const dominant = card({
      id: 'dominante',
      name: 'Dominante',
      closing_day: 5,
      grace_days: 30,
    })
    const weak = card({
      id: 'debil',
      name: 'Débil',
      closing_day: 20,
      grace_days: 0,
    })

    const calendar = getRecommendationCalendar(
      [dominant, weak],
      EMPTY_HOLIDAYS,
      new Date(2026, 9, 30)
    )

    // Gana todo el horizonte, aunque su corte cambie cada mes.
    expect(calendar).toHaveLength(1)
    expect(toISODate(calendar[0].startDate)).toBe('2026-10-30')
    expect(toISODate(calendar[0].endDate)).toBe('2027-10-29')
  })

  it('cubre 12 meses (365 días) desde hoy', () => {
    const calendar = getRecommendationCalendar(
      realCards,
      EMPTY_HOLIDAYS,
      new Date(2026, 9, 30)
    )

    expect(calendar.length).toBeGreaterThan(1)
    expect(toISODate(calendar[calendar.length - 1].endDate)).toBe('2027-10-29')
  })

  it('devuelve el tramo vigente y los dos próximos de una tarjeta', () => {
    const calendar = getRecommendationCalendar(
      realCards,
      EMPTY_HOLIDAYS,
      new Date(2026, 9, 30)
    )
    const nuRanges = getUpcomingIntervals(calendar, 'nu-pao', 2)

    expect(label(nuRanges[0])).toBe('2026-10-30/2026-11-02 nu-pao+rappi-pao')
    expect(label(nuRanges[1])).toBe('2026-11-27/2026-12-02 nu-pao')
    expect(label(getTodayRecommendation(calendar)!)).toBe(
      '2026-10-30/2026-11-02 nu-pao+rappi-pao'
    )
    expect(getUpcomingIntervals(calendar, 'nu-reny', 2)).toEqual([])
  })

  it('devuelve una lista vacía sin tarjetas recomendables', () => {
    expect(
      getRecommendationCalendar(
        [card({ id: 'sin-gracia', grace_days: null })],
        EMPTY_HOLIDAYS,
        new Date(2026, 9, 30)
      )
    ).toEqual([])
    expect(getTodayRecommendation([])).toBeNull()
  })
})
