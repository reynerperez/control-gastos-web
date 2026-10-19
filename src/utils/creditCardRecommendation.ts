import { PaymentMethod } from '@/types'
import { toISODate } from '@/utils/format'

/**
 * creditCardRecommendation.ts
 *
 * Recomendador de tarjetas de crédito para maximizar los días de
 * financiamiento sin intereses. Usa los datos reales del modelo:
 *   - `closing_day`: día de corte del mes.
 *   - `due_day`: día límite de pago del mes.
 *
 * Reglas:
 *   1. Próximo corte: si hoy ya pasó el día de corte, el corte es el del mes
 *      siguiente; si no, el de este mes.
 *   2. Fecha límite: la siguiente ocurrencia de `due_day` posterior al corte
 *      (si `due_day` < `closing_day`, cae en el mes siguiente).
 *   3. Días de financiamiento: diferencia en días entre la fecha límite y hoy.
 *
 * Si una tarjeta de crédito no tiene `due_day`, se estima con
 * DEFAULT_GRACE_DAYS (20 días después del corte) y se marca `estimated`.
 */

/** Plazo por defecto cuando la tarjeta no tiene `due_day` configurado */
export const DEFAULT_GRACE_DAYS = 20

export type CreditCardPlan = {
  method: PaymentMethod
  /** Próxima fecha de corte (medianoche local) */
  closingDate: Date
  /** Fecha límite de pago calculada (medianoche local) */
  dueDate: Date
  /** Días desde hoy hasta la fecha límite */
  financingDays: number
  /** true si la fecha límite se estimó (la tarjeta no tiene `due_day`) */
  estimated: boolean
}

const clampDay = (year: number, month: number, day: number) => {
  const lastDay = new Date(year, month + 1, 0).getDate()
  return Math.min(Math.max(day, 1), lastDay)
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

/** Diferencia en días (solo fecha) entre dos instantes, evitando DST */
const daysBetween = (from: Date, to: Date) => {
  const fromUTC = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const toUTC = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((toUTC - fromUTC) / 86_400_000)
}

/** Próxima fecha de corte a partir de hoy */
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

/** Fecha límite de pago: siguiente `dueDay` posterior al corte */
export function nextDueDate(
  closingDate: Date,
  dueDay: number | null
): { dueDate: Date; estimated: boolean } {
  if (dueDay == null) {
    const dueDate = new Date(closingDate)
    dueDate.setDate(dueDate.getDate() + DEFAULT_GRACE_DAYS)
    return { dueDate, estimated: true }
  }
  const year = closingDate.getFullYear()
  const month = closingDate.getMonth()
  const sameMonth = new Date(year, month, clampDay(year, month, dueDay))
  if (sameMonth.getTime() > closingDate.getTime()) {
    return { dueDate: sameMonth, estimated: false }
  }
  const nextMonth = month + 1
  return { dueDate: new Date(year, nextMonth, clampDay(year, nextMonth, dueDay)), estimated: false }
}

/**
 * Calcula el plan de cada tarjeta de crédito y devuelve la lista ordenada
 * de mayor a menor número de días de financiamiento.
 */
export function getCreditCardPlans(
  paymentMethods: PaymentMethod[],
  today: Date = new Date()
): CreditCardPlan[] {
  const reference = startOfDay(today)
  return paymentMethods
    .filter((method) => method.type === 'credit' && method.closing_day != null)
    .map((method) => {
      const closingDate = nextClosingDate(reference, method.closing_day as number)
      const { dueDate, estimated } = nextDueDate(closingDate, method.due_day)
      return {
        method,
        closingDate,
        dueDate,
        financingDays: daysBetween(reference, dueDate),
        estimated,
      }
    })
    .sort((a, b) => b.financingDays - a.financingDays)
}

/** Tarjeta recomendada (la de mayor financiamiento) o null si no hay */
export function getBestCreditCard(
  paymentMethods: PaymentMethod[],
  today: Date = new Date()
): CreditCardPlan | null {
  return getCreditCardPlans(paymentMethods, today)[0] ?? null
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
  /** true si la fecha de pago se estimó (sin `due_day`) */
  estimated: boolean
}

export function getStatementPeriod(
  dateISO: string,
  method: PaymentMethod
): StatementPeriod | null {
  if (method.type !== 'credit' || method.closing_day == null) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(year, month, day)
  if (Number.isNaN(date.getTime())) return null

  const closingDate = nextClosingDate(date, method.closing_day)
  const { dueDate, estimated } = nextDueDate(closingDate, method.due_day)

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
    dueDate,
    estimated,
  }
}
