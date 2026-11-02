import type { Category, PaymentMethod, Transaction } from '@/types'
import {
  EMPTY_HOLIDAYS,
  type HolidaySet,
} from '@/utils/bankingDates'
import { toISODate } from '@/utils/format'
import {
  getInstallmentPlan,
  getTransactionDisplayAmount,
  isInstallmentTransaction,
  type Installment,
  type InstallmentPlan,
} from '@/utils/installments'

/**
 * movementLedger.ts — filas efectivas para los totales mensuales.
 *
 * Una compra a MSI se guarda como UNA transacción, pero no debe contar
 * completa en el mes de la compra. El ledger separa:
 *
 *   • `msi-purchase`: fila informativa en el mes de compra. Muestra el total
 *     atenuado y NO suma al balance.
 *   • `msi-installment`: una fila por parcialidad en su mes de pago. Sí suma.
 *   • `transaction`: movimientos normales, sin cambios.
 *
 * La vista por periodos de una tarjeta sigue usando `buildCardPeriodGroups`;
 * este ledger es para las agrupaciones por mes y el Resumen.
 */

export type MovementEntry =
  | {
      kind: 'transaction'
      id: string
      transaction: Transaction
      /** Fecha que determina el mes de la fila. */
      date: string
      /** Monto visible de la fila. */
      displayAmount: number
      /** Si aporta al balance. */
      counted: boolean
      /** Si el monto se muestra atenuado. */
      muted: boolean
    }
  | {
      kind: 'msi-purchase'
      id: string
      transaction: Transaction
      plan: InstallmentPlan
      date: string
      displayAmount: number
      counted: false
      muted: true
    }
  | {
      kind: 'msi-installment'
      id: string
      transaction: Transaction
      plan: InstallmentPlan
      installment: Installment
      date: string
      displayAmount: number
      counted: true
      muted: false
    }

export interface EntryCategoryAmount {
  categoryId: string | null
  amount: number
  category: Category | null
}

export interface BuildMovementEntriesParams {
  transactions: Transaction[]
  paymentMethods: PaymentMethod[]
  holidays?: HolidaySet
  today?: Date
  /** Las filas informativas de compra solo aplican a las vistas por mes. */
  includeMsiPurchaseInfo?: boolean
}

function resolveMethod(
  transaction: Transaction,
  paymentMethods: PaymentMethod[]
): PaymentMethod | null {
  return (
    transaction.payment_method ??
    paymentMethods.find((method) => method.id === transaction.payment_method_id) ??
    null
  )
}

function sortEntries(entries: MovementEntry[]): MovementEntry[] {
  return entries.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date)
    if (a.transaction.date !== b.transaction.date) {
      return b.transaction.date.localeCompare(a.transaction.date)
    }
    return a.id.localeCompare(b.id)
  })
}

/**
 * Construye las filas mensuales efectivas.
 *
 * Los planes liquidados no proyectan parcialidades posteriores a la fecha de
 * liquidación; las que ya vencieron se conservan como historial.
 */
export function buildMovementEntries({
  transactions,
  paymentMethods,
  holidays = EMPTY_HOLIDAYS,
  today = new Date(),
  includeMsiPurchaseInfo = true,
}: BuildMovementEntriesParams): MovementEntry[] {
  const entries: MovementEntry[] = []

  for (const transaction of transactions) {
    const method = resolveMethod(transaction, paymentMethods)
    const plan = isInstallmentTransaction(transaction)
      ? getInstallmentPlan(transaction, method, today, holidays)
      : null

    if (!plan || plan.installments.length === 0) {
      entries.push({
        kind: 'transaction',
        id: `tx:${transaction.id}`,
        transaction,
        date: transaction.date,
        displayAmount: getTransactionDisplayAmount(transaction),
        counted: true,
        muted: false,
      })
      continue
    }

    if (includeMsiPurchaseInfo) {
      entries.push({
        kind: 'msi-purchase',
        id: `msi-purchase:${transaction.id}`,
        transaction,
        plan,
        date: transaction.date,
        displayAmount: transaction.amount,
        counted: false,
        muted: true,
      })
    }

    const settledAt = plan.settled
      ? transaction.installments_settled_at?.slice(0, 10) ?? null
      : null

    for (const installment of plan.installments) {
      const dueISO = toISODate(installment.dueDate)
      if (settledAt && dueISO > settledAt) continue
      entries.push({
        kind: 'msi-installment',
        id: `msi:${transaction.id}:${installment.number}`,
        transaction,
        plan,
        installment,
        date: dueISO,
        displayAmount: installment.amount,
        counted: true,
        muted: false,
      })
    }
  }

  return sortEntries(entries)
}

/** Monto con signo que aporta la fila al balance (0 si es informativa). */
export function getEntrySignedAmount(entry: MovementEntry): number {
  if (!entry.counted) return 0
  return entry.transaction.type === 'income'
    ? entry.displayAmount
    : -entry.displayAmount
}

/**
 * Reparte el monto de la fila entre las categorías del detalle.
 * En una parcialidad MSI se escala el detalle por la proporción que
 * representa esa parcialidad dentro del total de la compra.
 */
export function getEntryCategoryAmounts(
  entry: MovementEntry
): EntryCategoryAmount[] {
  if (!entry.counted) return []

  const details = entry.transaction.details ?? []
  const ratio =
    entry.kind === 'msi-installment' && entry.transaction.amount > 0
      ? entry.installment.amount / entry.transaction.amount
      : 1

  return details.map((detail) => ({
    categoryId: detail.category_id,
    amount: detail.quantity * detail.unit_price * ratio,
    category: detail.category ?? null,
  }))
}

export function sumMovementEntries(entries: MovementEntry[]): number {
  return entries.reduce((sum, entry) => sum + getEntrySignedAmount(entry), 0)
}

export function isInstallmentEntry(
  entry: MovementEntry
): entry is Extract<MovementEntry, { kind: 'msi-installment' }> {
  return entry.kind === 'msi-installment'
}

export function isMsiPurchaseEntry(
  entry: MovementEntry
): entry is Extract<MovementEntry, { kind: 'msi-purchase' }> {
  return entry.kind === 'msi-purchase'
}
