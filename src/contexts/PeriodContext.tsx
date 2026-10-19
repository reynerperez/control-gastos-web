import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import {
  addMonths,
  endOfMonth,
  formatDateLabel,
  formatMonthLabel,
  startOfMonth,
  toISODate,
} from '@/utils/format';

// ═══════════════════════════════════════════════════════════════
// 📅 Period — estado de periodo compartido entre pantallas
//
// Resumen y Movimientos comparten el mismo selector de fecha.
// Soporta: mes concreto, rango personalizado o todo el historial.
// ═══════════════════════════════════════════════════════════════

export type PeriodMode = 'month' | 'range' | 'all';

export interface PeriodBounds {
  start?: string; // ISO YYYY-MM-DD inclusive
  end?: string; // ISO YYYY-MM-DD inclusive
}

interface PeriodState {
  mode: PeriodMode;
  month: Date;
  rangeStart: string | null;
  rangeEnd: string | null;
}

interface PeriodContextValue {
  period: PeriodState;
  /** Selecciona un mes concreto (resetea rango/all). */
  setMonth: (d: Date) => void;
  /** Navega al mes anterior/siguiente. */
  shiftMonth: (delta: number) => void;
  /** Aplica un rango personalizado inclusivo. */
  setRange: (start: string, end: string) => void;
  /** Muestra todo el historial. */
  setAll: () => void;
  /** Límites efectivos para filtrar (vacío = sin límites). */
  bounds: PeriodBounds;
  /** Etiqueta legible para mostrar en el MonthSelector. */
  label: string;
}

const PeriodContext = createContext<PeriodContextValue | null>(null);

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<PeriodState>({
    mode: 'month',
    month: startOfMonth(new Date()),
    rangeStart: null,
    rangeEnd: null,
  });

  const value = useMemo<PeriodContextValue>(() => {
    const setMonth = (d: Date) =>
      setPeriod({ mode: 'month', month: startOfMonth(d), rangeStart: null, rangeEnd: null });

    const shiftMonth = (delta: number) =>
      setPeriod((p) => ({
        ...p,
        mode: 'month',
        month: addMonths(p.month, delta),
        rangeStart: null,
        rangeEnd: null,
      }));

    const setRange = (start: string, end: string) =>
      setPeriod((p) => ({ ...p, mode: 'range', rangeStart: start, rangeEnd: end }));

    const setAll = () =>
      setPeriod((p) => ({ ...p, mode: 'all', rangeStart: null, rangeEnd: null }));

    const bounds: PeriodBounds =
      period.mode === 'month'
        ? {
            start: toISODate(startOfMonth(period.month)),
            end: toISODate(endOfMonth(period.month)),
          }
        : period.mode === 'range'
          ? { start: period.rangeStart ?? undefined, end: period.rangeEnd ?? undefined }
          : {};

    let label: string;
    if (period.mode === 'month') {
      label = formatMonthLabel(period.month);
    } else if (period.mode === 'all') {
      label = 'Todo el historial';
    } else {
      label =
        period.rangeStart && period.rangeEnd
          ? `${formatDateLabel(period.rangeStart)} – ${formatDateLabel(period.rangeEnd)}`
          : 'Rango personalizado';
    }

    return { period, setMonth, shiftMonth, setRange, setAll, bounds, label };
  }, [period]);

  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>;
}

export function usePeriod(): PeriodContextValue {
  const ctx = useContext(PeriodContext);
  if (!ctx) throw new Error('usePeriod must be used within PeriodProvider');
  return ctx;
}

/** ¿La fecha ISO (YYYY-MM-DD) cae dentro del periodo? */
export function isWithinPeriod(dateISO: string, bounds: PeriodBounds): boolean {
  if (bounds.start && dateISO < bounds.start) return false;
  if (bounds.end && dateISO > bounds.end) return false;
  return true;
}
