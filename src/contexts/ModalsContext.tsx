import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { BreakdownModal } from '@/components/modals/BreakdownModal'
import { FiltersModal } from '@/components/modals/FiltersModal'
import { PeriodPickerModal } from '@/components/modals/PeriodPickerModal'
import { RecurringChargeFormModal } from '@/components/modals/RecurringChargeFormModal'
import { TransactionFormModal } from '@/components/modals/TransactionFormModal'

// ═══════════════════════════════════════════════════════════════
// 🪟 Modals — en el móvil estos flujos son rutas (transaction-modal,
//    breakdown-modal, filters-modal, period-picker-modal). En web son
//    diálogos que se abren desde cualquier pantalla.
//
//    Se centralizan aquí para que cualquier componente pueda abrirlos
//    con `useModals()` sin conocer los detalles de cada diálogo.
// ═══════════════════════════════════════════════════════════════

type ModalState =
  | { kind: 'transaction'; id?: string }
  | { kind: 'breakdown'; id: string }
  | { kind: 'filters' }
  | { kind: 'period' }
  | { kind: 'recurring'; id?: string }
  | null

interface ModalsContextValue {
  /** Abre el formulario de alta (sin id) o de edición (con id) */
  openTransactionForm: (id?: string) => void
  /** Abre el desglose de ticket de un gasto */
  openBreakdown: (id: string) => void
  /** Abre los filtros de movimientos */
  openFilters: () => void
  /** Abre el selector avanzado de periodo */
  openPeriodPicker: () => void
  /** Abre el alta (sin id) o edición (con id) de un compromiso recurrente */
  openRecurringCharge: (id?: string) => void
  /** Movimiento abierto en el side peek (null = cerrado) */
  peekTransactionId: string | null
  /** Abre el detalle de un movimiento en el side peek de la misma pestaña */
  openTransactionPeek: (id: string) => void
  /** Cierra el side peek */
  closeTransactionPeek: () => void
  close: () => void
}

const ModalsContext = createContext<ModalsContextValue | null>(null)

export function ModalsProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState>(null)
  const [peekId, setPeekId] = useState<string | null>(null)

  const close = useCallback(() => setModal(null), [])
  const closeTransactionPeek = useCallback(() => setPeekId(null), [])

  const value = useMemo<ModalsContextValue>(
    () => ({
      openTransactionForm: (id?: string) => setModal({ kind: 'transaction', id }),
      openBreakdown: (id: string) => setModal({ kind: 'breakdown', id }),
      openFilters: () => setModal({ kind: 'filters' }),
      openPeriodPicker: () => setModal({ kind: 'period' }),
      openRecurringCharge: (id?: string) => setModal({ kind: 'recurring', id }),
      peekTransactionId: peekId,
      openTransactionPeek: (id: string) => setPeekId(id),
      closeTransactionPeek,
      close,
    }),
    [close, closeTransactionPeek, peekId]
  )

  return (
    <ModalsContext.Provider value={value}>
      {children}

      <TransactionFormModal
        open={modal?.kind === 'transaction'}
        transactionId={modal?.kind === 'transaction' ? modal.id : undefined}
        onClose={close}
        onOpenBreakdown={(id) => setModal({ kind: 'breakdown', id })}
      />
      <BreakdownModal
        open={modal?.kind === 'breakdown'}
        transactionId={modal?.kind === 'breakdown' ? modal.id : undefined}
        onClose={close}
      />
      <FiltersModal open={modal?.kind === 'filters'} onClose={close} />
      <PeriodPickerModal open={modal?.kind === 'period'} onClose={close} />
      <RecurringChargeFormModal
        open={modal?.kind === 'recurring'}
        chargeId={modal?.kind === 'recurring' ? modal.id : undefined}
        onClose={close}
      />
    </ModalsContext.Provider>
  )
}

export function useModals(): ModalsContextValue {
  const context = useContext(ModalsContext)
  if (!context) {
    throw new Error('useModals debe usarse dentro de un ModalsProvider')
  }
  return context
}
