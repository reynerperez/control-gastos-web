import { isFinancedPaymentMethod } from '@/utils/paymentMethod'
import { PaymentMethod } from '@/types'

import {
  DEFAULT_GRACE_DAYS,
  EMPTY_HOLIDAYS,
  addDays,
  clampDay,
  daysBetween,
  parseISODate,
  resolveDueDate,
  startOfDay,
  type DueDateMode,
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
 *   - `due_day`: día fijo de pago (1–31). Si existe, sustituye a la gracia.
 *   - `grace_days` + `grace_days_type`: días naturales o hábiles hasta el pago.
 *
 * La recomendación de hoy y el calendario de uso se calculan desde HOY. Solo
 * entran las tarjetas con corte y con una fecha de pago configurada (día fijo
 * o gracia completa); las demás siguen disponibles para usarse manualmente
 * pero no se recomiendan ni se auto-seleccionan.
 *
 * La fecha límite se calcula con `resolveDueDate`. En modo de gracia, si cae
 * en sábado, domingo o día bancario inhábil, se mueve al siguiente día hábil.
 * En modo de día fijo la fecha es exacta y no se recorre.
 *
 * El calendario agrupa días consecutivos en los que el mismo conjunto de
 * tarjetas ofrece el mayor financiamiento. Una compra en el día de corte
 * pertenece a ese mismo ciclo (regla inclusiva).
 */

export { DEFAULT_GRACE_DAYS }

export type CreditCardPlan = {
  method: PaymentMethod
  /** Próxima fecha de corte (medianoche local) */
  closingDate: Date
  /** Fecha límite antes de recorrer inhábiles (corte + gracia o día fijo) */
  rawDueDate: Date
  /** Fecha límite de pago calculada (medianoche local) */
  dueDate: Date
  /** Días desde la fecha de compra hasta la fecha límite */
  financingDays: number
  /** true si la fecha límite usó la configuración por defecto */
  estimated: boolean
  /** Cómo se calculó la fecha límite. */
  dueDateMode: DueDateMode
  /** Día fijo de pago, o null en modo de gracia. */
  dueDay: number | null
  /** Días efectivos entre el corte y el pago (configurados o calculados). */
  graceDays: number
  graceDaysType: GraceDaysType
  /** true si la fecha se movió por caer en inhábil (solo modo gracia) */
  adjusted: boolean
}

/**
 * Tramo del calendario de recomendaciones: días consecutivos en los que el
 * mismo conjunto de tarjetas ofrece el mayor financiamiento. No es el ciclo de
 * facturación, aunque se apoya en él. Los empates se mantienen juntos.
 */
export type RecommendationInterval = {
  /** Primer día del tramo. */
  startDate: Date
  /** Último día consecutivo del tramo. */
  endDate: Date
  /** Tarjetas empatadas en el máximo del tramo, ordenadas por `comparePlans`. */
  methods: PaymentMethod[]
  /** Plan de la primera tarjeta al inicio del tramo (máximo del tramo). */
  bestPlan: CreditCardPlan
  /** Días de financiamiento en el primer día del tramo. */
  maxFinancingDays: number
  /** Días de financiamiento en el último día del tramo. */
  minFinancingDays: number
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
 * Fecha límite de pago: día fijo posterior al corte o corte + días de gracia.
 * En modo de gracia el ajuste a día hábil está incluido; en modo fijo no.
 */
export function nextDueDate(
  closingDate: Date,
  method: Pick<PaymentMethod, 'grace_days' | 'grace_days_type' | 'due_day'>,
  holidays: HolidaySet = EMPTY_HOLIDAYS
) {
  return resolveDueDate(closingDate, method, holidays)
}

/** true si la tarjeta tiene un día fijo válido configurado. */
function hasFixedDueDay(method: PaymentMethod): boolean {
  return (
    method.due_day != null &&
    Number.isInteger(method.due_day) &&
    method.due_day >= 1 &&
    method.due_day <= 31
  )
}

/**
 * Tarjetas con corte y fecha de pago completos: las únicas recomendables.
 * La fecha de pago puede ser un día fijo o los días de gracia.
 */
function isRecommendable(method: PaymentMethod) {
  const hasGrace =
    method.grace_days != null && method.grace_days_type != null
  return (
    method.type === 'credit' &&
    method.closing_day != null &&
    (hasFixedDueDay(method) || hasGrace)
  )
}

/** Tarjetas que entran al recomendador y al calendario. */
export function getRecommendableMethods(
  paymentMethods: PaymentMethod[]
): PaymentMethod[] {
  return paymentMethods.filter(isRecommendable)
}

/** Plan de una tarjeta para una fecha de compra concreta. */
function buildPlan(
  method: PaymentMethod,
  reference: Date,
  holidays: HolidaySet
): CreditCardPlan {
  const closingDate = nextClosingDate(reference, method.closing_day as number)
  const due = nextDueDate(closingDate, method, holidays)
  return {
    method,
    closingDate,
    rawDueDate: due.rawDueDate,
    dueDate: due.dueDate,
    financingDays: daysBetween(reference, due.dueDate),
    estimated: due.estimated,
    dueDateMode: due.mode,
    dueDay: due.dueDay,
    graceDays: due.graceDays,
    graceDaysType: due.graceDaysType,
    adjusted: due.adjusted,
  }
}

/** Criterio único para elegir la mejor tarjeta en una fecha. */
function comparePlans(a: CreditCardPlan, b: CreditCardPlan) {
  return (
    b.financingDays - a.financingDays ||
    b.graceDays - a.graceDays ||
    a.dueDate.getTime() - b.dueDate.getTime() ||
    a.closingDate.getTime() - b.closingDate.getTime() ||
    a.method.name.localeCompare(b.method.name, 'es')
  )
}

/**
 * Calcula el plan de cada tarjeta de crédito recomendable y devuelve la lista
 * ordenada de mayor a menor número de días de financiamiento.
 *
 * Solo se consideran tarjetas con `closing_day` y una fecha de pago
 * configurada (`due_day` o `grace_days` + `grace_days_type`). El desempate
 * sigue este orden: días de financiamiento → días de gracia → fecha de pago →
 * corte → nombre. En modo fijo, `graceDays` es la diferencia efectiva entre el
 * corte y el pago.
 */
export function getCreditCardPlans(
  paymentMethods: PaymentMethod[],
  holidays: HolidaySet = EMPTY_HOLIDAYS,
  today: Date = new Date()
): CreditCardPlan[] {
  const reference = startOfDay(today)
  return paymentMethods
    .filter(isRecommendable)
    .map((method) => buildPlan(method, reference, holidays))
    .sort(comparePlans)
}

/** Horizonte del calendario: un año natural desde hoy. */
export const CALENDAR_HORIZON_DAYS = 365

type IntervalDraft = {
  startDate: Date
  endDate: Date
  methods: PaymentMethod[]
  bestPlan: CreditCardPlan
  maxFinancingDays: number
  minFinancingDays: number
  /** Firma del conjunto de ganadoras para detectar cambios. */
  key: string
}

function toInterval(draft: IntervalDraft): RecommendationInterval {
  return {
    startDate: draft.startDate,
    endDate: draft.endDate,
    methods: draft.methods,
    bestPlan: draft.bestPlan,
    maxFinancingDays: draft.maxFinancingDays,
    minFinancingDays: draft.minFinancingDays,
  }
}

/**
 * Calendario de recomendaciones: barrido día a día que devuelve los tramos en
 * los que cada conjunto de tarjetas es la mejor opción.
 *
 * - Un tramo se extiende mientras el conjunto de ganadoras no cambie; que una
 *   tarjeta cambie su propio corte no lo parte.
 * - Los empates se devuelven juntos en `methods`: Banamex y BBVA Pao, por
 *   ejemplo, siempre comparten tramo.
 * - El horizonte por defecto es de 365 días (de hoy al mismo día del año
 *   siguiente, exclusive).
 */
export function getRecommendationCalendar(
  paymentMethods: PaymentMethod[],
  holidays: HolidaySet = EMPTY_HOLIDAYS,
  today: Date = new Date(),
  horizonDays: number = CALENDAR_HORIZON_DAYS
): RecommendationInterval[] {
  const reference = startOfDay(today)
  const methods = getRecommendableMethods(paymentMethods)
  if (methods.length === 0) return []

  const days = Math.max(1, Math.trunc(horizonDays))
  const intervals: RecommendationInterval[] = []
  let current: IntervalDraft | null = null

  for (let offset = 0; offset < days; offset += 1) {
    const day = addDays(reference, offset)
    const plans = methods.map((method) => buildPlan(method, day, holidays))
    const maxFinancingDays = Math.max(
      ...plans.map((plan) => plan.financingDays)
    )
    const winners = plans
      .filter((plan) => plan.financingDays === maxFinancingDays)
      .sort(comparePlans)
    const key = winners.map((plan) => plan.method.id).join('|')

    if (current && current.key === key) {
      current.endDate = day
      current.minFinancingDays = maxFinancingDays
      continue
    }

    if (current) intervals.push(toInterval(current))

    current = {
      startDate: day,
      endDate: day,
      methods: winners.map((plan) => plan.method),
      bestPlan: winners[0],
      maxFinancingDays,
      minFinancingDays: maxFinancingDays,
      key,
    }
  }

  if (current) intervals.push(toInterval(current))
  return intervals
}

/** Primer tramo del calendario: el que está vigente hoy. */
export function getTodayRecommendation(
  calendar: RecommendationInterval[]
): RecommendationInterval | null {
  return calendar[0] ?? null
}

/**
 * Hasta `count` tramos de una tarjeta, empezando por el vigente o el próximo.
 * Si la tarjeta no gana en el horizonte devuelve una lista vacía.
 */
export function getUpcomingIntervals(
  calendar: RecommendationInterval[],
  methodId: string,
  count = 2
): RecommendationInterval[] {
  return calendar
    .filter((interval) =>
      interval.methods.some((method) => method.id === methodId)
    )
    .slice(0, Math.max(0, Math.trunc(count)))
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
  dueDateMode?: DueDateMode
  dueDay?: number | null
  graceDays?: number
  graceDaysType?: GraceDaysType
  adjusted?: boolean
}

export function getStatementPeriod(
  dateISO: string,
  method: PaymentMethod,
  holidays: HolidaySet = EMPTY_HOLIDAYS
): StatementPeriod | null {
  if (!isFinancedPaymentMethod(method.type) || method.closing_day == null) return null
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
    dueDateMode: due.mode,
    dueDay: due.dueDay,
    graceDays: due.graceDays,
    graceDaysType: due.graceDaysType,
    adjusted: due.adjusted,
  }
}
