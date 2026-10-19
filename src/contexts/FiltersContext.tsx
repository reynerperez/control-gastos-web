import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { TransactionType } from '@/types';

// ═══════════════════════════════════════════════════════════════
// 🔎 Filters — estado de filtros de movimientos compartido con el
//    modal de filtros (ruta nativa).
// ═══════════════════════════════════════════════════════════════

export type TypeFilter = 'all' | TransactionType;

interface FiltersContextValue {
  typeFilter: TypeFilter;
  setTypeFilter: (f: TypeFilter) => void;
  selectedCategories: string[];
  toggleCategory: (id: string) => void;
  /** IDs de métodos de pago seleccionados (vacío = todos) */
  selectedPaymentMethods: string[];
  togglePaymentMethod: (id: string) => void;
  /** Solo movimientos pendientes de desglosar */
  onlyPending: boolean;
  setOnlyPending: (v: boolean) => void;
  /** Limpia tipo y categorías (la búsqueda vive en la pantalla). */
  clearFilters: () => void;
}

const FiltersContext = createContext<FiltersContextValue | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>([]);
  const [onlyPending, setOnlyPending] = useState(false);

  const value = useMemo<FiltersContextValue>(
    () => ({
      typeFilter,
      setTypeFilter,
      selectedCategories,
      toggleCategory: (id: string) =>
        setSelectedCategories((prev) =>
          prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
        ),
      selectedPaymentMethods,
      togglePaymentMethod: (id: string) =>
        setSelectedPaymentMethods((prev) =>
          prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
        ),
      onlyPending,
      setOnlyPending,
      clearFilters: () => {
        setTypeFilter('all');
        setSelectedCategories([]);
        setSelectedPaymentMethods([]);
        setOnlyPending(false);
      },
    }),
    [typeFilter, selectedCategories, selectedPaymentMethods, onlyPending]
  );

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters(): FiltersContextValue {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error('useFilters must be used within FiltersProvider');
  return ctx;
}
