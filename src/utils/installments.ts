import { PaymentMethod, Transaction } from '@/types'

import {
  DEFAULT_GRACE_DAYS,
  EMPTY_HOLIDAYS,
  type HolidaySet,
} from '@/utils/bankingDates'
import {
  getStatementPeriod,
  nextDueDate,
  type StatementPeriod,
} from '@/utils/creditCardRecommendation'
import { toISODate } from '@/utils/format'

/**
 * installments.ts — motor de compras a Meses Sin Intereses (MSI).
 *
 * Una compra a MSI se guarda como UNA fila en `transactions` con:
 *   amount                    → monto total de la compra
 *   purchase_type             → 'installments'
 *   installments_count        → número de parcialidades
 *   installments_start_date   → corte del primer estado de cuenta
 *   installments_paid         → parcialidades cubiertas (manual/liquidación)
 *   installments_settled_at   → si se liquidó anticipadamente
 *
 * El calendario (parcialidad, monto, corte, fecha límite) SIEMPRE se deriva.
 * Así no hay filas futuras ni datos que se desincronicen.
 */

export interface Installment {
  /** Número de parcialidad, 1-based */
  number: number
  /** Monto exacto de esta parcialidad (con centavos repartidos) */
  amount: number
  /** Fecha de corte del estado de cuenta donde aparece */
  closingDate: Date
  /** Fecha límite de pago */
  dueDate: Date
  /** true si la fecha se estimó con la configuración por defecto */
  estimated: boolean
  /** Clave ISO del corte, p. ej. 2026-11-15 */
  periodKey: string
  /** Si esta parcialidad ya se considera cubierta */
  paid: boolean
}

export interface InstallmentPlan {
  transaction: Transaction
  method: PaymentMethod
  installments: Installment[]
  count: number
  /** Parcialidades cubiertas a la fecha (o todas si se liquidó) */
  paidCount: number
  /** Suma de las parcialidades aún pendientes */
  remainingAmount: number
  /** Suma de las parcialidades ya cubiertas */
  paidAmount: number
  /** Siguiente parcialidad pendiente (null si ya terminó) */
  nextInstallment: Installment | null
  /** true si el plan se cerró manualmente antes de tiempo */
  settled: boolean
}

const clampDay = (year: number, month: number, day: number) => {
  const lastDay = new Date(year, month + 1, 0).getDate()
  return Math.min(Math.max(day, 1), lastDay)
}

/** Suma meses conservando el día (ajustándolo al último día del mes). */
export function addMonthsKeepingDay(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1)
  return new Date(
    target.getFullYear(),
    target.getMonth(),
    clampDay(target.getFullYear(), target.getMonth(), date.getDate())
  )
}

/**
 * Reparte un monto en `count` parcialidades sin perder centavos.
 * Las primeras parcialidades absorben el residuo (ej. $100 / 3 →
 * 33.34, 33.33, 33.33). Es determinista: total y count siempre dan lo mismo.
 */
export function splitAmount(total: number, count: number): number[] {
  if (count <= 0) return []
  const cents = Math.round(total * 100)
  const base = Math.floor(cents / count)
  const remainder = cents - base * count
  return Array.from({ length: count }, (_, index) => (base + (index < remainder ? 1 : 0)) / 100)
}

/** ¿La transacción tiene un plan MSI válido? */
export function isInstallmentTransaction(
  transaction: Transaction | null | undefined
): transaction is Transaction & { installments_count: number } {
  return (
    !!transaction &&
    transaction.purchase_type === 'installments' &&
    typeof transaction.installments_count === 'number' &&
    transaction.installments_count > 1
  )
}

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate())

/**
 * Deriva el plan completo de una compra a MSI.
 *
 * La primera parcialidad cae en el estado de cuenta que contiene la compra
 * (`installments_start_date` si está guardado; si no, se calcula con la fecha
 * de compra). Las siguientes avanzan mes a mes sobre el día de corte.
 */
export function getInstallmentPlan(
  transaction: Transaction,
  method: PaymentMethod | null | undefined,
  today: Date = new Date(),
  holidays: HolidaySet = EMPTY_HOLIDAYS
): InstallmentPlan | null {
  if (!isInstallmentTransaction(transaction) || !method) return null
  if (method.type !== 'credit' || method.closing_day == null) return null

  const count = transaction.installments_count
  const storedStart = transaction.installments_start_date
  const startKey =
    storedStart ??
    getStatementPeriod(transaction.date, method, holidays)?.key ??
    null
  if (!startKey) return null

  const [year, month, day] = startKey.split('-').map(Number)
  if (!year || !month || !day) return null
  const firstClosing = new Date(year, month - 1, day)
  if (Number.isNaN(firstClosing.getTime())) return null

  const amounts = splitAmount(transaction.amount, count)
  const settled = transaction.installments_settled_at != null
  const reference = startOfDay(today)

  // Las parcialidades cuyo pago ya venció se consideran cubiertas, salvo
  // que el usuario haya registrado un avance manual mayor.
  let elapsed = 0
  const temp = amounts.map((_, index) => {
    const closingDate = addMonthsKeepingDay(firstClosing, index)
    const due = nextDueDate(closingDate, method, holidays)
    if (due.dueDate.getTime() < reference.getTime()) elapsed += 1
    return { closingDate, due }
  })

  const paidCount = settled
    ? count
    : Math.min(count, Math.max(transaction.installments_paid ?? 0, elapsed))

  const installments: Installment[] = amounts.map((amount, index) => {
    const { closingDate, due } = temp[index]
    return {
      number: index + 1,
      amount,
      closingDate,
      dueDate: due.dueDate,
      estimated: due.estimated,
      periodKey: toISODate(closingDate),
      paid: index < paidCount,
    }
  })

  const paidAmount = installments
    .filter((installment) => installment.paid)
    .reduce((sum, installment) => sum + installment.amount, 0)
  const remainingAmount = Math.max(
    0,
    Math.round((transaction.amount - paidAmount) * 100) / 100
  )

  return {
    transaction,
    method,
    installments,
    count,
    paidCount,
    remainingAmount,
    paidAmount,
    nextInstallment: installments.find((installment) => !installment.paid) ?? null,
    settled,
  }
}

/**
 * Monto que aporta una transacción al periodo actual.
 * Para MSI es la primera parcialidad (la compra no se cuenta completa).
 */
export function getTransactionDisplayAmount(transaction: Transaction): number {
  if (!isInstallmentTransaction(transaction)) return transaction.amount
  const amounts = splitAmount(transaction.amount, transaction.installments_count)
  return amounts[0] ?? transaction.amount
}

/**
 * Escala un importe de detalle (categoría) para reflejar solo la parcialidad
 * del mes en los totales. Mantiene la proporción entre categorías.
 */
export function getEffectiveDetailAmount(
  transaction: Transaction,
  detailAmount: number
): number {
  if (!isInstallmentTransaction(transaction) || transaction.amount <= 0) {
    return detailAmount
  }
  return detailAmount * (getTransactionDisplayAmount(transaction) / transaction.amount)
}

/** Periodo de facturación construido a partir de un corte ya conocido. */
export function statementPeriodFromClosing(
  closingDate: Date,
  method: PaymentMethod,
  holidays: HolidaySet = EMPTY_HOLIDAYS
): StatementPeriod | null {
  if (method.type !== 'credit' || method.closing_day == null) return null
  const previousMonth = new Date(
    closingDate.getFullYear(),
    closingDate.getMonth() - 1,
    1
  )
  const previousClosing = new Date(
    previousMonth.getFullYear(),
    previousMonth.getMonth(),
    clampDay(previousMonth.getFullYear(), previousMonth.getMonth(), method.closing_day)
  )
  const startDate = new Date(previousClosing)
  startDate.setDate(startDate.getDate() + 1)
  const due = nextDueDate(closingDate, method, holidays)
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

/** Etiqueta corta "3/12" para badges de la UI. */
export function formatInstallmentLabel(number: number, count: number): string {
  return `${number}/${count}`
}

/** Días de gracia por defecto (re-export para consumidores del motor). */
export { DEFAULT_GRACE_DAYS }
