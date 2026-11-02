import { type GraceDaysType } from '@/types'
import { toISODate } from '@/utils/format'

export type { GraceDaysType } from '@/types'

/**
 * bankingDates.ts — fechas de pago de tarjetas.
 *
 * Reglas:
 *   • El día de corte NO se mueve.
 *   • Dos modos de pago:
 *       - Días de gracia: pago = corte + `grace_days` (naturales o hábiles).
 *         Si cae en inhábil, se mueve al siguiente día hábil.
 *       - Día fijo: pago = primer día `due_day` posterior al corte. La fecha
 *         es exacta: no se recorre a día hábil.
 *   • Días naturales: calendario normal.
 *   • Días hábiles: se cuentan saltando fines de semana y días bancarios
 *     inhábiles (calendario CNBV).
 *   • Sábados, domingos y días inhábiles nunca son días hábiles.
 */

/** Cómo se determina la fecha límite de pago. */
export type DueDateMode = 'grace_days' | 'fixed_day'

export interface DueDateConfig {
  grace_days?: number | null
  grace_days_type?: GraceDaysType | null
  /** Día fijo de pago (1–31). Si existe, sustituye a los días de gracia. */
  due_day?: number | null
}

/** Nombre anterior, conservado para no romper imports existentes. */
export type GraceConfig = DueDateConfig

export interface DueDateResult {
  /** Fecha calculada antes de recorrer inhábiles (corte + gracia o día fijo) */
  rawDueDate: Date
  dueDate: Date
  /** Modo usado para calcular la fecha. */
  mode: DueDateMode
  /** Día fijo configurado, o null en modo de días de gracia. */
  dueDay: number | null
  /**
   * Días efectivos entre el corte y la fecha teórica de pago. En modo de
   * gracia es el valor configurado; en modo fijo se usa para desempates.
   */
  graceDays: number
  graceDaysType: GraceDaysType
  /** true si se usó el valor por defecto porque la tarjeta no tenía config */
  estimated: boolean
  /** true si la fecha se movió por caer en inhábil (solo modo gracia) */
  adjusted: boolean
}

/** Plazo por defecto para tarjetas sin configuración. */
export const DEFAULT_GRACE_DAYS = 20

/** Conjunto vacío: útil mientras el calendario de la BD termina de cargar. */
export const EMPTY_HOLIDAYS: ReadonlySet<string> = new Set<string>()

export type HolidaySet = ReadonlySet<string>

const MS_PER_DAY = 86_400_000

export const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate())

export const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export const lastDayOfMonth = (year: number, month: number) =>
  new Date(year, month + 1, 0).getDate()

export const clampDay = (year: number, month: number, day: number) =>
  Math.min(Math.max(day, 1), lastDayOfMonth(year, month))

export const isWeekend = (date: Date) => {
  const day = date.getDay()
  return day === 0 || day === 6
}

export const isHolidayDate = (date: Date, holidays: HolidaySet): boolean =>
  holidays.has(toISODate(date))

export const isBusinessDay = (date: Date, holidays: HolidaySet): boolean =>
  !isWeekend(date) && !isHolidayDate(date, holidays)

/** Siguiente día hábil. Si `date` ya es hábil, devuelve la misma fecha. */
export function nextBusinessDay(date: Date, holidays: HolidaySet): Date {
  let cursor = startOfDay(date)
  while (!isBusinessDay(cursor, holidays)) {
    cursor = addDays(cursor, 1)
  }
  return cursor
}

/** Suma días naturales. */
export function addNaturalDays(date: Date, days: number): Date {
  return addDays(startOfDay(date), Math.max(0, Math.trunc(days)))
}

/**
 * Suma días hábiles contando desde el día siguiente a `date`.
 * Si el corte cae en sábado, el lunes es el día hábil 1.
 */
export function addBusinessDays(
  date: Date,
  days: number,
  holidays: HolidaySet
): Date {
  let cursor = startOfDay(date)
  let remaining = Math.max(0, Math.trunc(days))
  while (remaining > 0) {
    cursor = addDays(cursor, 1)
    if (isBusinessDay(cursor, holidays)) remaining -= 1
  }
  return cursor
}

/**
 * Primer día `dueDay` estrictamente posterior al corte. Si el día no existe
 * en el mes (31 en febrero), se ajusta al último día del mes. Si el día
 * ajustado coincide con el corte, se avanza al mes siguiente.
 */
export function nextFixedDueDate(closingDate: Date, dueDay: number): Date {
  const closing = startOfDay(closingDate)
  const year = closing.getFullYear()
  const month = closing.getMonth()
  const day = clampDay(year, month, dueDay)
  const candidate = new Date(year, month, day)
  if (candidate.getTime() > closing.getTime()) return candidate
  const nextMonth = month + 1
  return new Date(year, nextMonth, clampDay(year, nextMonth, dueDay))
}

/**
 * Calcula la fecha límite de pago a partir del corte.
 *
 * - Modo de días de gracia: aplica la regla legal; si la fecha cae en
 *   inhábil, se mueve al siguiente día hábil. El corte nunca se ajusta.
 * - Modo de día fijo: la fecha es exacta y NO se recorre a día hábil.
 */
export function resolveDueDate(
  closingDate: Date,
  config: DueDateConfig,
  holidays: HolidaySet = EMPTY_HOLIDAYS
): DueDateResult {
  const fixedDay = config.due_day
  const hasFixedDay =
    fixedDay != null &&
    Number.isInteger(fixedDay) &&
    fixedDay >= 1 &&
    fixedDay <= 31

  if (hasFixedDay) {
    const rawDue = nextFixedDueDate(closingDate, fixedDay)
    return {
      rawDueDate: rawDue,
      // Fecha exacta: no se recorre por fin de semana ni por festivo.
      dueDate: rawDue,
      mode: 'fixed_day',
      dueDay: fixedDay,
      graceDays: Math.max(0, daysBetween(closingDate, rawDue)),
      graceDaysType: 'natural',
      estimated: false,
      adjusted: false,
    }
  }

  const estimated =
    config.grace_days == null || config.grace_days_type == null
  const graceDays = Math.min(
    60,
    Math.max(0, Math.trunc(config.grace_days ?? DEFAULT_GRACE_DAYS))
  )
  const graceDaysType: GraceDaysType =
    config.grace_days_type === 'business' ? 'business' : 'natural'

  const rawDue =
    graceDaysType === 'business'
      ? addBusinessDays(closingDate, graceDays, holidays)
      : addNaturalDays(closingDate, graceDays)

  const dueDate = nextBusinessDay(rawDue, holidays)
  return {
    rawDueDate: rawDue,
    dueDate,
    mode: 'grace_days',
    dueDay: null,
    graceDays,
    graceDaysType,
    estimated,
    adjusted: dueDate.getTime() !== rawDue.getTime(),
  }
}

/** Diferencia en días (solo fecha), evitando DST. */
export function daysBetween(from: Date, to: Date): number {
  const fromUTC = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const toUTC = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((toUTC - fromUTC) / MS_PER_DAY)
}

/** Parsea una fecha ISO YYYY-MM-DD a fecha local. */
export function parseISODate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}
