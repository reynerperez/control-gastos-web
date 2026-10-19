import { PaymentMethod } from '@/types'

import {
  DEFAULT_GRACE_DAYS,
  EMPTY_HOLIDAYS,
  clampDay,
  daysBetween,
  parseISODate,
  resolveDueDate,
  startOfDay,
  type GraceDaysType,
  type HolidaySet,
} from '@/utils/bankingDates'
import { toISODate } from '@/utils/format'

/**
 * creditCardRecommendation.ts
 *
 * Recomendador de tarjetas de crédito para maximizar los días de
 * financiamiento sin intereses.
 *
 * Modelo:
 *   - `closing_day`: día de corte del mes (no se mueve).
 *   - `grace_days` + `grace_days_type`: días naturales o hábiles hasta el pago.
 *
 * La fecha límite se calcula con `resolveDueDate`. Si cae en sábado, domingo
 * o día bancario inhábil, se mueve al siguiente día hábil.
 */

export { DEFAULT_GRACE_DAYS }

export type CreditCardPlan = {
  method: PaymentMethod
  /** Próxima fecha de corte (medianoche local) */
  closingDate: Date
  /** Fecha límite de pago calculada (medianoche local) */
  dueDate: Date
  /** Días desde hoy hasta la fecha límite */
  financingDays: number
  /** true si la fecha límite usó la configuración por defecto */
  estimated: boolean
  /** Días de gracia configurados */
  graceDays: number
  graceDaysType: GraceDaysType
  /** true si la fecha se movió por caer en inhábil */
  adjusted: boolean
}

/** Próxima fecha de corte a partir de hoy. */
export function nextClosingDate(today: Date, closingDay: number): Date {
  const year = today.getFullYear()
  const month = today.getMonth()
  const thisMonth = new Date(year, month, clampDay(year, month, closingDay))
  if (today.getDate() > thisMonth.getDate()) {
    const nextMonth = month + 1
    return new Date(year, nextMonth, clampDay(year, nextMonth, closingDay))
  }
  return thisMonth
}

/**
 * Fecha límite de pago: corte + días de gracia.
 * El ajuste a día hábil está incluido.
 */
export function nextDueDate(
  closingDate: Date,
  method: Pick<PaymentMethod, 'grace_days' | 'grace_days_type'>,
  holidays: HolidaySet = EMPTY_HOLIDAYS
) {
  return resolveDueDate(closingDate, method, holidays)
}

/**
 * Calcula el plan de cada tarjeta de crédito y devuelve la lista ordenada
 * de mayor a menor número de días de financiamiento.
 */
export function getCreditCardPlans(
  paymentMethods: PaymentMethod[],
  holidays: HolidaySet = EMPTY_HOLIDAYS,
  today: Date = new Date()
): CreditCardPlan[] {
  const reference = startOfDay(today)
  return paymentMethods
    .filter((method) => method.type === 'credit' && method.closing_day != null)
    .map((method) => {
      const closingDate = nextClosingDate(reference, method.closing_day as number)
      const due = nextDueDate(closingDate, method, holidays)
      return {
        method,
        closingDate,
        dueDate: due.dueDate,
        financingDays: daysBetween(reference, due.dueDate),
        estimated: due.estimated,
        graceDays: due.graceDays,
        graceDaysType: due.graceDaysType,
        adjusted: due.adjusted,
      }
    })
    .sort((a, b) => b.financingDays - a.financingDays)
}

/** Tarjeta recomendada (la de mayor financiamiento) o null si no hay. */
export function getBestCreditCard(
  paymentMethods: PaymentMethod[],
  holidays: HolidaySet = EMPTY_HOLIDAYS,
  today: Date = new Date()
): CreditCardPlan | null {
  return getCreditCardPlans(paymentMethods, holidays, today)[0] ?? null
}

/**
 * Periodo de facturación al que pertenece una compra.
 *
 * Para una tarjeta con corte día 15, una compra del 20 de octubre cae en el
 * ciclo que cierra el 15 de noviembre (inicio: 16 de octubre). Una compra
 * exactamente el día de corte se asigna a ese mismo ciclo (inclusive).
 */
export type StatementPeriod = {
  /** Clave estable: fecha de corte ISO (YYYY-MM-DD) */
  key: string
  /** Primer día del ciclo (día siguiente al corte anterior) */
  startDate: Date
  /** Fecha de corte del ciclo */
  closingDate: Date
  /** Fecha límite de pago */
  dueDate: Date
  /** true si la fecha de pago usó la configuración por defecto */
  estimated: boolean
  graceDays?: number
  graceDaysType?: GraceDaysType
  adjusted?: boolean
}

export function getStatementPeriod(
  dateISO: string,
  method: PaymentMethod,
  holidays: HolidaySet = EMPTY_HOLIDAYS
): StatementPeriod | null {
  if (method.type !== 'credit' || method.closing_day == null) return null
  const date = parseISODate(dateISO)
  if (!date) return null

  const closingDate = nextClosingDate(date, method.closing_day)
  const due = nextDueDate(closingDate, method, holidays)

  // Inicio del ciclo: día siguiente al corte del mes anterior
  const previousYear = closingDate.getFullYear()
  const previousMonth = closingDate.getMonth() - 1
  const previousClosing = new Date(
    previousYear,
    previousMonth,
    clampDay(previousYear, previousMonth, method.closing_day)
  )
  const startDate = new Date(previousClosing)
  startDate.setDate(startDate.getDate() + 1)

  return {
    key: toISODate(closingDate),
    startDate,
    closingDate,
    dueDate: due.dueDate,
    estimated: due.estimated,
    graceDays: due.graceDays,
    graceDaysType: due.graceDaysType,
    adjusted: due.adjusted,
  }
}
