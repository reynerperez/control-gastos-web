import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useData } from '@/hooks/useData'
import type { Transaction } from '@/types'
import {
  buildTransactionUpdate,
  createTransactionDraft,
  getEditableTransactionFields,
  isTransactionDraftDirty,
  validateTransactionDraft,
  type EditableTransactionFields,
  type TransactionDraft,
} from '@/utils/transactionDraft'

const EMPTY_FIELDS: EditableTransactionFields = {
  amount: false,
  category: false,
  description: false,
  paymentMethod: false,
  date: false,
}

const EMPTY_DRAFT: TransactionDraft = {
  amount: '',
  merchant: '',
  description: '',
  categoryId: null,
  paymentMethodId: null,
  date: '',
  note: '',
}

export type TransactionEditController = {
  unlocked: boolean
  dirty: boolean
  saving: boolean
  error: string | null
  draft: TransactionDraft
  fields: EditableTransactionFields
  unlock: () => void
  cancel: () => void
  save: () => Promise<boolean>
  setField: <K extends keyof TransactionDraft>(
    key: K,
    value: TransactionDraft[K]
  ) => void
}

/**
 * Estado de la edición inline del detalle.
 *
 * El candado no persiste: al cerrar el detalle o cambiar de movimiento vuelve
 * a bloquearse. Los cambios se guardan en lote con `updateTransaction`.
 */
export function useTransactionEdit(
  transaction: Transaction | undefined
): TransactionEditController {
  const { updateTransaction } = useData()
  const [unlocked, setUnlocked] = useState(false)
  const [draft, setDraft] = useState<TransactionDraft>(() =>
    transaction ? createTransactionDraft(transaction) : EMPTY_DRAFT
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastId = useRef(transaction?.id)

  const fields = useMemo(
    () => (transaction ? getEditableTransactionFields(transaction) : EMPTY_FIELDS),
    [transaction]
  )

  // Al cambiar de movimiento se cierra cualquier edición en curso.
  useEffect(() => {
    if (lastId.current === transaction?.id) return
    lastId.current = transaction?.id
    setUnlocked(false)
    setSaving(false)
    setError(null)
  }, [transaction?.id])

  // Mientras está bloqueado, el borrador sigue los datos del servidor.
  // Desbloqueado no se pisa lo que el usuario está escribiendo.
  useEffect(() => {
    if (!unlocked) {
      setDraft(transaction ? createTransactionDraft(transaction) : EMPTY_DRAFT)
    }
  }, [transaction, unlocked])

  const dirty = useMemo(
    () =>
      transaction
        ? isTransactionDraftDirty(transaction, draft, fields)
        : false,
    [transaction, draft, fields]
  )

  const unlock = useCallback(() => {
    if (!transaction) return
    setDraft(createTransactionDraft(transaction))
    setError(null)
    setUnlocked(true)
  }, [transaction])

  const cancel = useCallback(() => {
    setDraft(transaction ? createTransactionDraft(transaction) : EMPTY_DRAFT)
    setError(null)
    setUnlocked(false)
  }, [transaction])

  const setField = useCallback(
    <K extends keyof TransactionDraft>(
      key: K,
      value: TransactionDraft[K]
    ) => {
      setDraft((previous) => ({ ...previous, [key]: value }))
      setError(null)
    },
    []
  )

  const save = useCallback(async () => {
    if (!transaction || saving) return false

    const validation = validateTransactionDraft(draft, fields)
    if (validation) {
      setError(validation)
      return false
    }

    setSaving(true)
    setError(null)
    try {
      await updateTransaction(
        transaction.id,
        buildTransactionUpdate(draft, fields)
      )
      setUnlocked(false)
      return true
    } catch (cause) {
      setError((cause as Error).message)
      return false
    } finally {
      setSaving(false)
    }
  }, [draft, fields, saving, transaction, updateTransaction])

  return {
    unlocked,
    dirty,
    saving,
    error,
    draft,
    fields,
    unlock,
    cancel,
    save,
    setField,
  }
}
