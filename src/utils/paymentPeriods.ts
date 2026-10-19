import {
  PaymentMethod,
  RecurringCharge,
  Transaction,
} from '@/types'

import {
  EMPTY_HOLIDAYS,
  type HolidaySet,
} from '@/utils/bankingDates'
import {
  getStatementPeriod,
  type StatementPeriod,
} from '@/utils/creditCardRecommendation'
import { toISODate } from '@/utils/format'
import {
  getInstallmentPlan,
  getTransactionDisplayAmount,
  isInstallmentTransaction,
  statementPeriodFromClosing,
  type Installment,
} from '@/utils/installments'
import {
  getRecurringOccurrences,
  isWithinISO,
  type RecurringOccurrence,
} from '@/utils/recurringCharges'

/**
 * paymentPeriods.ts — arma los periodos de pago de UNA tarjeta de crédito.
 *
 * Regla clave:
 *   El filtro de fechas (mes/rango) selecciona periodos por su FECHA LÍMITE
 *   DE PAGO. Una vez seleccionado un periodo, se incluye su ciclo COMPLETO
 *   (aunque parte del ciclo caiga fuera del mes). Así los totales no quedan
 *   incompletos.
 *
 * Proyecciones:
 *   • MSI: todas las parcialidades del plan (deuda real, plazo finito).
 *   • Recurrentes: solo desde el mes actual y hasta 12 meses adelante. No se
 *     inventan cargos históricos ni se proyectan servicios hasta 2031.
 */

export interface InstallmentLine {
  kind: 'installment'
  /** id estable para keys de React */
  id: string
  transaction: Transaction
  installment: Installment
  amount: number
  method: PaymentMethod
  label: string
}

export interface RecurringLine {
  kind: 'recurring'
  id: string
  charge: RecurringCharge
  occurrence: RecurringOccurrence
  amount: number
  label: string
}

export type ProjectionLine = InstallmentLine | RecurringLine

export interface CardPeriodGroup {
  key: string
  period: StatementPeriod
  transactions: Transaction[]
  installmentLines: InstallmentLine[]
  recurringLines: RecurringLine[]
  /** Suma de parcialidades + recurrentes del periodo */
  projectedTotal: number
  /** Total firmado del periodo: ingresos positivos, gastos/proyecciones negativos */
  total: number
}

type PeriodMode = 'month' | 'range' | 'all'

interface BuildCardPeriodGroupsParams {
  card: PaymentMethod
  /** Todas las transacciones (se filtran internamente por tarjeta) */
  transactions: Transaction[]
  recurringCharges: RecurringCharge[]
  paymentMethods: PaymentMethod[]
  mode: PeriodMode
  bounds: { start?: string; end?: string }
  /** Filtros que NO son de fecha (tipo, categoría, búsqueda, pendientes…) */
  includeTransaction?: (transaction: Transaction) => boolean
  /** Filtros aplicados a los compromisos recurrentes */
  includeRecurring?: (charge: RecurringCharge) => boolean
  holidays?: HolidaySet
  today?: Date
  /** Meses de proyección para cargos indeterminados (por defecto 12) */
  projectionMonths?: number
}

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1)

/** Último día del mes que está `months` meses después del mes de `date`. */
const endOfMonthAfter = (date: Date, months: number) =>
  new Date(date.getFullYear(), date.getMonth() + months + 1, 0)

/**
 * Construye los grupos de periodo de una tarjeta.
 *
 * En modo `month`/`range`, un periodo entra si su fecha límite de pago cae
 * dentro del rango. Sus movimientos se incluyen completos, sin volver a
 * aplicar el filtro de fechas. En modo `all` se muestran todos los periodos
 * con movimientos y las proyecciones dentro del horizonte.
 */
export function buildCardPeriodGroups({
  card,
  transactions,
  recurringCharges,
  paymentMethods,
  mode,
  bounds,
  includeTransaction,
  includeRecurring,
  holidays = EMPTY_HOLIDAYS,
  today = new Date(),
  projectionMonths = 12,
}: BuildCardPeriodGroupsParams): CardPeriodGroup[] {
  if (card.type !== 'credit' || card.closing_day == null) return []

  const periods = new Map<string, StatementPeriod>()
  const ensurePeriod = (period: StatementPeriod | null) => {
    if (period && !periods.has(period.key)) periods.set(period.key, period)
    return period
  }

  const cardTransactions = transactions.filter(
    (transaction) => transaction.payment_method_id === card.id
  )
  const visibleTransactionIds = new Set(
    cardTransactions
      .filter((transaction) => !includeTransaction || includeTransaction(transaction))
      .map((transaction) => transaction.id)
  )

  // ── 1. Periodos de movimientos reales ───────────────────────────
  for (const transaction of cardTransactions) {
    ensurePeriod(getStatementPeriod(transaction.date, card, holidays))
  }

  // ── 2. Periodos de parcialidades MSI activas ────────────────────
  const installmentLinesByPeriod = new Map<string, InstallmentLine[]>()
  for (const transaction of cardTransactions) {
    if (!isInstallmentTransaction(transaction)) continue
    const plan = getInstallmentPlan(transaction, card, today, holidays)
    if (!plan || plan.settled) continue

    for (const installment of plan.installments) {
      const period = ensurePeriod(
        statementPeriodFromClosing(installment.closingDate, card, holidays)
      )
      if (!period) continue
      const lines = installmentLinesByPeriod.get(period.key) ?? []
      lines.push({
        kind: 'installment',
        id: `${transaction.id}:${installment.number}`,
        transaction,
        installment,
        amount: installment.amount,
        method: card,
        label:
          transaction.merchant ||
          transaction.details?.[0]?.description ||
          transaction.details?.[0]?.category?.name ||
          'Compra a MSI',
      })
      installmentLinesByPeriod.set(period.key, lines)
    }
  }

  // ── 3. Periodos de recurrentes dentro del horizonte útil ───────
  // Nunca antes del mes actual: no tiene sentido "proyectar" el pasado.
  const monthStartISO = toISODate(startOfMonth(today))
  const recurringFrom =
    mode !== 'all' && bounds.start && bounds.start > monthStartISO
      ? bounds.start
      : monthStartISO
  const horizonISO = toISODate(endOfMonthAfter(today, projectionMonths))
  const recurringTo =
    mode !== 'all' && bounds.end && bounds.end < horizonISO
      ? bounds.end
      : horizonISO

  const recurringLinesByPeriod = new Map<string, RecurringLine[]>()
  if (recurringFrom <= recurringTo) {
    for (const charge of recurringCharges) {
      if (charge.payment_method_id !== card.id) continue
      if (includeRecurring && !includeRecurring(charge)) continue
      const method =
        charge.payment_method ??
        paymentMethods.find((entry) => entry.id === charge.payment_method_id) ??
        null
      if (!method) continue

      for (const occurrence of getRecurringOccurrences(
        charge,
        method,
        recurringFrom,
        recurringTo,
        holidays
      )) {
        if (!occurrence.period) continue
        const period = ensurePeriod(occurrence.period)
        if (!period) continue
        const lines = recurringLinesByPeriod.get(period.key) ?? []
        lines.push({
          kind: 'recurring',
          id: `${charge.id}:${occurrence.occurrenceDate}:${occurrence.periodKey}`,
          charge,
          occurrence,
          amount: occurrence.amount,
          label: charge.name,
        })
        recurringLinesByPeriod.set(period.key, lines)
      }
    }
  }

  // ── 4. Elegir periodos por fecha límite de pago ─────────────────
  const selectedKeys = new Set<string>()
  if (mode === 'all') {
    for (const key of periods.keys()) selectedKeys.add(key)
  } else {
    for (const [key, period] of periods) {
      if (isWithinISO(toISODate(period.dueDate), bounds.start, bounds.end)) {
        selectedKeys.add(key)
      }
    }
  }

  // ── 5. Armar grupos con ciclos completos ────────────────────────
  const groups = new Map<string, CardPeriodGroup>()
  for (const key of selectedKeys) {
    const period = periods.get(key)
    if (!period) continue
    groups.set(key, {
      key,
      period,
      transactions: [],
      installmentLines: [],
      recurringLines: [],
      projectedTotal: 0,
      total: 0,
    })
  }

  for (const transaction of cardTransactions) {
    if (!visibleTransactionIds.has(transaction.id)) continue
    const period = getStatementPeriod(transaction.date, card, holidays)
    if (!period) continue
    const group = groups.get(period.key)
    if (!group) continue
    group.transactions.push(transaction)
  }

  for (const [key, lines] of installmentLinesByPeriod) {
    const group = groups.get(key)
    if (!group) continue
    const shownTransactionIds = new Set(
      group.transactions.map((transaction) => transaction.id)
    )
    for (const line of lines) {
      if (!visibleTransactionIds.has(line.transaction.id)) continue
      // La primera parcialidad ya está representada por el movimiento real.
      if (shownTransactionIds.has(line.transaction.id)) continue
      group.installmentLines.push(line)
    }
  }

  for (const [key, lines] of recurringLinesByPeriod) {
    const group = groups.get(key)
    if (!group) continue
    group.recurringLines.push(...lines)
  }

  return [...groups.values()]
    .map((group) => {
      const base = group.transactions.reduce((sum, transaction) => {
        const amount = getTransactionDisplayAmount(transaction)
        return sum + (transaction.type === 'income' ? amount : -amount)
      }, 0)
      const projectedTotal =
        Math.round(
          (group.installmentLines.reduce((sum, line) => sum + line.amount, 0) +
            group.recurringLines.reduce((sum, line) => sum + line.amount, 0)) *
            100
        ) / 100
      return {
        ...group,
        installmentLines: group.installmentLines.sort(
          (a, b) =>
            a.installment.dueDate.getTime() - b.installment.dueDate.getTime()
        ),
        recurringLines: group.recurringLines.sort(
          (a, b) =>
            a.occurrence.dueDate.getTime() - b.occurrence.dueDate.getTime()
        ),
        projectedTotal,
        total: base - projectedTotal,
      }
    })
    .filter(
      (group) =>
        group.transactions.length > 0 ||
        group.installmentLines.length > 0 ||
        group.recurringLines.length > 0
    )
    .sort(
      (a, b) => b.period.closingDate.getTime() - a.period.closingDate.getTime()
    )
}

/** Meses de proyección de recurrentes (expuesto para notas de la UI). */
export const RECURRING_PROJECTION_MONTHS = 12
