import type { Transaction, UpdateTransactionInput } from '@/types'

import { isInstallmentTransaction } from '@/utils/installments'

/**
 * transactionDraft.ts — borrador de edición inline del detalle.
 *
 * La edición inline no cambia el esquema: arma un objeto parcial para
 * `updateTransaction`. Aquí se concentran las reglas de qué campos se pueden
 * tocar según el tipo de movimiento, para que la UI y las pruebas compartan
 * exactamente el mismo criterio.
 */

export type TransactionDraft = {
  /** Se guarda como texto para permitir escribir comas y puntos. */
  amount: string
  merchant: string
  description: string
  categoryId: string | null
  paymentMethodId: string | null
  date: string
  note: string
}

export type EditableTransactionFields = {
  amount: boolean
  category: boolean
  description: boolean
  paymentMethod: boolean
  date: boolean
}

/**
 * Un movimiento con desglose completado (>1 ítem) toma monto, categoría y
 * concepto de sus ítems. Una compra a MSI mantiene bloqueado lo que altera
 * el calendario de parcialidades (monto, fecha y tarjeta). El tipo de
 * movimiento no se edita: cambiarlo alteraría categorías y reportes.
 */
export function getEditableTransactionFields(
  transaction: Transaction
): EditableTransactionFields {
  const hasCompletedBreakdown =
    transaction.breakdown_status === 'completed' &&
    (transaction.details?.length ?? 0) > 1
  const isMSI = isInstallmentTransaction(transaction)

  return {
    amount: !hasCompletedBreakdown && !isMSI,
    category: !hasCompletedBreakdown,
    description: !hasCompletedBreakdown,
    paymentMethod: !isMSI,
    date: !isMSI,
  }
}

export function createTransactionDraft(transaction: Transaction): TransactionDraft {
  return {
    amount: transaction.amount.toFixed(2),
    merchant: transaction.merchant ?? '',
    description: transaction.details?.[0]?.description ?? '',
    categoryId: transaction.details?.[0]?.category_id ?? null,
    paymentMethodId: transaction.payment_method_id ?? null,
    date: transaction.date,
    note: transaction.note ?? '',
  }
}

export function parseDraftAmount(value: string): number {
  const text = value.replace(/[^\d.,-]/g, '').replace(/\s/g, '')
  if (!text) return Number.NaN

  const lastComma = text.lastIndexOf(',')
  const lastDot = text.lastIndexOf('.')

  let normalized = text
  if (lastComma >= 0 && lastDot >= 0) {
    normalized =
      lastComma > lastDot
        ? text.replace(/\./g, '').replace(',', '.')
        : text.replace(/,/g, '')
  } else if (lastComma >= 0) {
    normalized = text.replace(',', '.')
  }

  return Number.parseFloat(normalized)
}

const sameText = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? '').trim() === (b ?? '').trim()

export function isTransactionDraftDirty(
  transaction: Transaction,
  draft: TransactionDraft,
  fields: EditableTransactionFields
): boolean {
  if (!sameText(draft.merchant, transaction.merchant)) return true
  if (!sameText(draft.note, transaction.note)) return true

  if (fields.amount) {
    const amount = parseDraftAmount(draft.amount)
    if (!Number.isFinite(amount) || Math.abs(amount - transaction.amount) > 0.005) {
      return true
    }
  }
  if (fields.date && draft.date !== transaction.date) return true
  if (
    fields.paymentMethod &&
    draft.paymentMethodId !== transaction.payment_method_id
  ) {
    return true
  }
  if (fields.category && draft.categoryId !== (transaction.details?.[0]?.category_id ?? null)) {
    return true
  }
  if (
    fields.description &&
    !sameText(draft.description, transaction.details?.[0]?.description)
  ) {
    return true
  }

  return false
}

export function validateTransactionDraft(
  draft: TransactionDraft,
  fields: EditableTransactionFields
): string | null {
  if (fields.date && !draft.date) {
    return 'Selecciona una fecha.'
  }

  if (fields.paymentMethod && !draft.paymentMethodId) {
    return 'Selecciona un método de pago.'
  }

  if (fields.amount) {
    const amount = parseDraftAmount(draft.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return 'Monto inválido: ingresa un monto mayor a cero.'
    }
  }

  if (
    fields.description &&
    !draft.merchant.trim() &&
    !draft.description.trim()
  ) {
    return 'Llena al menos uno de los dos campos: comercio o concepto.'
  }

  return null
}

export function buildTransactionUpdate(
  draft: TransactionDraft,
  fields: EditableTransactionFields
): UpdateTransactionInput {
  const update: UpdateTransactionInput = {
    merchant: draft.merchant.trim() || null,
    note: draft.note.trim() || null,
  }

  if (fields.paymentMethod) {
    update.payment_method_id = draft.paymentMethodId
  }
  if (fields.date) {
    update.date = draft.date
  }
  if (fields.amount) {
    update.amount = parseDraftAmount(draft.amount)
  }
  if (fields.category) {
    update.category_id = draft.categoryId
  }
  if (fields.description) {
    update.description = draft.description.trim() || null
  }

  return update
}
