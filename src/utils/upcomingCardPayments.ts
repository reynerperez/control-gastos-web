import { PaymentMethod, RecurringCharge, Transaction } from '@/types'
import {
  EMPTY_HOLIDAYS,
  type HolidaySet,
  clampDay,
  daysBetween,
  startOfDay,
} from '@/utils/bankingDates'
import {
  getStatementPeriod,
  nextClosingDate,
  nextDueDate,
  type StatementPeriod,
} from '@/utils/creditCardRecommendation'
import { toISODate } from '@/utils/format'
import {
  buildCardPeriodGroups,
  RECURRING_PROJECTION_MONTHS,
} from '@/utils/paymentPeriods'

/**
 * upcomingCardPayments.ts — próximos pagos de cada tarjeta de crédito.
 *
 * Para cada tarjeta se toma el corte más reciente cuya fecha límite todavía
 * no vence; si esa fecha ya pasó, se usa el siguiente corte. El monto es el
 * saldo del estado de cuenta: movimientos del ciclo + parcialidades MSI +
 * cargos recurrentes, menos abonos/ingresos.
 */

/** Periodos que se revisan hacia adelante cuando el próximo está en $0. */
const MAX_LOOKAHEAD_PERIODS = 6

export interface UpcomingCardPayment {
  card: PaymentMethod
  period: StatementPeriod
  /** Saldo del estado de cuenta (siempre positivo). */
  amount: number
  /** Días naturales desde hoy hasta la fecha límite. */
  daysUntilDue: number
  /** El corte aún no cierra: el monto todavía puede cambiar. */
  pendingClosing: boolean
  /** La fecha límite usa los días de gracia por defecto de la tarjeta. */
  estimatedDate: boolean
}

interface GetUpcomingCardPaymentsParams {
  paymentMethods: PaymentMethod[]
  transactions: Transaction[]
  recurringCharges: RecurringCharge[]
  holidays?: HolidaySet
  today?: Date
}

/**
 * Corte al que corresponde el próximo pago de la tarjeta.
 * - Si el corte más reciente aún no vence, ese es el próximo pago.
 * - Si ya venció, se avanza al siguiente corte.
 */
export function getNextPaymentPeriod(
  card: PaymentMethod,
  today: Date = new Date(),
  holidays: HolidaySet = EMPTY_HOLIDAYS
): StatementPeriod | null {
  if (card.type !== 'credit' || card.closing_day == null) return null

  const reference = startOfDay(today)
  const year = reference.getFullYear()
  const month = reference.getMonth()

  // Corte más reciente (hoy inclusive si hoy es día de corte).
  const closingThisMonth = new Date(
    year,
    month,
    clampDay(year, month, card.closing_day)
  )
  const recentClosing =
    reference.getDate() >= closingThisMonth.getDate()
      ? closingThisMonth
      : new Date(year, month - 1, clampDay(year, month - 1, card.closing_day))

  const recentDue = nextDueDate(recentClosing, card, holidays)
  const closing =
    recentDue.dueDate >= reference
      ? recentClosing
      : nextClosingDate(reference, card.closing_day)

  return getStatementPeriod(toISODate(closing), card, holidays)
}

/** Próximos pagos ordenados por fecha límite (solo tarjetas con saldo). */
export function getUpcomingCardPayments({
  paymentMethods,
  transactions,
  recurringCharges,
  holidays = EMPTY_HOLIDAYS,
  today = new Date(),
}: GetUpcomingCardPaymentsParams): UpcomingCardPayment[] {
  const reference = startOfDay(today)
  const payments: UpcomingCardPayment[] = []

  for (const card of paymentMethods) {
    if (card.type !== 'credit' || card.closing_day == null) continue

    const groups = buildCardPeriodGroups({
      card,
      transactions,
      recurringCharges,
      paymentMethods,
      mode: 'all',
      bounds: {},
      holidays,
      today: reference,
      projectionMonths: RECURRING_PROJECTION_MONTHS,
    })
    const groupByPeriod = new Map(groups.map((group) => [group.period.key, group]))

    // Busca el primer periodo con saldo. Si el próximo corte está en $0
    // (p. ej. el pago de hoy ya no tiene cargos), avanza al siguiente.
    let period = getNextPaymentPeriod(card, reference, holidays)
    let amount = 0
    for (let index = 0; period && index < MAX_LOOKAHEAD_PERIODS; index++) {
      const group = groupByPeriod.get(period.key)
      amount = group ? Math.round(-group.total * 100) / 100 : 0
      if (amount > 0) break

      const nextClosing = new Date(
        period.closingDate.getFullYear(),
        period.closingDate.getMonth() + 1,
        clampDay(
          period.closingDate.getFullYear(),
          period.closingDate.getMonth() + 1,
          card.closing_day
        )
      )
      period = getStatementPeriod(toISODate(nextClosing), card, holidays)
    }

    // Sin cargos en el horizonte: no hay pago que mostrar.
    if (!period || amount <= 0) continue

    payments.push({
      card,
      period,
      amount,
      daysUntilDue: daysBetween(reference, period.dueDate),
      pendingClosing: period.closingDate > reference,
      estimatedDate: period.estimated,
    })
  }

  return payments.sort(
    (a, b) => a.period.dueDate.getTime() - b.period.dueDate.getTime()
  )
}
