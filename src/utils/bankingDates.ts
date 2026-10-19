import { type GraceDaysType } from '@/types'
import { toISODate } from '@/utils/format'

export type { GraceDaysType } from '@/types'

/**
 * bankingDates.ts — fechas de pago de tarjetas.
 *
 * Reglas:
 *   • El día de corte NO se mueve.
 *   • La fecha de pago = corte + días de gracia.
 *   • Días naturales: calendario normal. Si cae en inhábil, se mueve al
 *     siguiente día hábil.
 *   • Días hábiles: se cuentan saltando fines de semana y días bancarios
 *     inhábiles (calendario CNBV).
 *   • Sábados, domingos y días inhábiles nunca son días hábiles.
 */

export interface GraceConfig {
  grace_days?: number | null
  grace_days_type?: GraceDaysType | null
}

export interface DueDateResult {
  /** Fecha calculada antes de recorrer inhábiles (corte + gracia) */
  rawDueDate: Date
  dueDate: Date
  /** Días de gracia usados */
  graceDays: number
  graceDaysType: GraceDaysType
  /** true si se usó el valor por defecto porque la tarjeta no tenía config */
  estimated: boolean
  /** true si la fecha se movió por caer en inhábil */
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
 * Calcula la fecha límite de pago a partir del corte.
 * Siempre aplica la regla legal: si la fecha cae en inhábil, se mueve al
 * siguiente día hábil. El corte nunca se ajusta.
 */
export function resolveDueDate(
  closingDate: Date,
  config: GraceConfig,
  holidays: HolidaySet = EMPTY_HOLIDAYS
): DueDateResult {
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
