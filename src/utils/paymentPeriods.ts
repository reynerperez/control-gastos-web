import {
  PaymentMethod,
  RecurringCharge,
  Transaction,
} from '@/types'

import { type StatementPeriod } from '@/utils/creditCardRecommendation'
import { toISODate } from '@/utils/format'
import {
  getInstallmentPlan,
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
 * paymentPeriods.ts — une las tres fuentes de un periodo de tarjeta:
 *
 *   1. Movimientos reales (compras del ciclo).
 *   2. Parcialidades MSI derivadas de compras de meses anteriores.
 *   3. Servicios/suscripciones recurrentes proyectados.
 *
 * El resultado alimenta el acordeón de "fecha límite de pago" de Movimientos.
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

export interface ProjectionGroup {
  key: string
  period: StatementPeriod
  installmentLines: InstallmentLine[]
  recurringLines: RecurringLine[]
  /** Suma de parcialidades + recurrentes del periodo */
  projectedTotal: number
}

interface BuildProjectionParams {
  card: PaymentMethod
  /** Todas las transacciones (se filtran internamente por tarjeta y MSI) */
  transactions: Transaction[]
  recurringCharges: RecurringCharge[]
  paymentMethods: PaymentMethod[]
  fromISO: string
  toISO: string
  today?: Date
}

/**
 * Construye únicamente los grupos que contienen proyecciones. La pantalla
 * los fusiona con los grupos de movimientos reales por `key` (fecha de corte).
 */
export function buildCardProjectionGroups({
  card,
  transactions,
  recurringCharges,
  paymentMethods,
  fromISO,
  toISO,
  today = new Date(),
}: BuildProjectionParams): ProjectionGroup[] {
  if (card.type !== 'credit' || card.closing_day == null) return []

  const groups = new Map<string, ProjectionGroup>()

  const ensureGroup = (period: StatementPeriod): ProjectionGroup => {
    let group = groups.get(period.key)
    if (!group) {
      group = {
        key: period.key,
        period,
        installmentLines: [],
        recurringLines: [],
        projectedTotal: 0,
      }
      groups.set(period.key, group)
    }
    return group
  }

  // ── 1. Parcialidades MSI activas ────────────────────────────────
  for (const transaction of transactions) {
    if (
      !isInstallmentTransaction(transaction) ||
      transaction.payment_method_id !== card.id
    ) {
      continue
    }
    const plan = getInstallmentPlan(transaction, card, today)
    if (!plan || plan.settled) continue

    for (const installment of plan.installments) {
      const dueISO = toISODate(installment.dueDate)
      if (!isWithinISO(dueISO, fromISO, toISO)) continue
      const period = statementPeriodFromClosing(installment.closingDate, card)
      if (!period) continue
      const group = ensureGroup(period)
      group.installmentLines.push({
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
      group.projectedTotal += installment.amount
    }
  }

  // ── 2. Compromisos recurrentes de esta tarjeta ─────────────────
  for (const charge of recurringCharges) {
    if (charge.payment_method_id !== card.id) continue
    const method =
      charge.payment_method ??
      paymentMethods.find((entry) => entry.id === charge.payment_method_id) ??
      null
    if (!method) continue

    for (const occurrence of getRecurringOccurrences(charge, method, fromISO, toISO)) {
      if (!occurrence.period) continue
      const group = ensureGroup(occurrence.period)
      group.recurringLines.push({
        kind: 'recurring',
        id: `${charge.id}:${occurrence.occurrenceDate}:${occurrence.periodKey}`,
        charge,
        occurrence,
        amount: occurrence.amount,
        label: charge.name,
      })
      group.projectedTotal += occurrence.amount
    }
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      installmentLines: group.installmentLines.sort((a, b) =>
        a.installment.dueDate.getTime() - b.installment.dueDate.getTime()
      ),
      recurringLines: group.recurringLines.sort((a, b) =>
        a.occurrence.dueDate.getTime() - b.occurrence.dueDate.getTime()
      ),
      projectedTotal:
        Math.round(
          (group.installmentLines.reduce((sum, line) => sum + line.amount, 0) +
            group.recurringLines.reduce((sum, line) => sum + line.amount, 0)) *
            100
        ) / 100,
    }))
    .sort((a, b) => b.period.closingDate.getTime() - a.period.closingDate.getTime())
}

/** Rango de proyección razonable cuando el usuario elige "todo el historial". */
export function getProjectionWindow(
  transactions: Transaction[],
  today: Date = new Date()
): { fromISO: string; toISO: string } {
  const dates = transactions
    .map((transaction) => transaction.date)
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort()
  const oldest = dates[0]
  const from = oldest ? new Date(oldest + 'T00:00:00') : new Date(today)
  const fromDate = new Date(from.getFullYear(), from.getMonth() - 1, 1)
  // Cubre el plazo máximo permitido de MSI (60 parcialidades).
  const toDate = new Date(today.getFullYear(), today.getMonth() + 60, 0)
  return { fromISO: toISODate(fromDate), toISO: toISODate(toDate) }
}
