import { PaymentMethod, RecurringCharge } from '@/types'

import { getStatementPeriod, type StatementPeriod } from '@/utils/creditCardRecommendation'
import { toISODate } from '@/utils/format'

/**
 * recurringCharges.ts — proyección de compromisos indeterminados.
 *
 * Un `RecurringCharge` (luz, internet, renta, suscripción…) no es una
 * transacción. Se proyecta:
 *   • En una tarjeta de crédito → al estado de cuenta y fecha límite de pago
 *     que le corresponde según su día de corte.
 *   • En efectivo/débito → al día del mes en que se cobra (mes natural).
 *
 * El usuario registra el pago real como movimiento; la proyección solo
 * alimenta el acordeón del periodo y la pantalla de compromisos.
 */

export interface RecurringOccurrence {
  charge: RecurringCharge
  /** Fecha en que el comercio/servicio cobra (YYYY-MM-DD) */
  occurrenceDate: string
  /** Fecha en la que impacta el pago (límite de tarjeta o día natural) */
  dueDate: Date
  /** Periodo de facturación si el método es tarjeta de crédito */
  period: StatementPeriod | null
  /** Corte ISO (tarjeta) o mes natural YYYY-MM */
  periodKey: string
  amount: number
  /** true si el monto es variable / estimado */
  estimated: boolean
}

const clampDay = (year: number, month: number, day: number) => {
  const lastDay = new Date(year, month + 1, 0).getDate()
  return Math.min(Math.max(day, 1), lastDay)
}

const parseISO = (iso: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

/** ¿La fecha ISO cae dentro del rango inclusivo? */
export function isWithinISO(dateISO: string, fromISO?: string, toISO?: string): boolean {
  if (fromISO && dateISO < fromISO) return false
  if (toISO && dateISO > toISO) return false
  return true
}

/**
 * Genera las ocurrencias de un compromiso dentro de un rango de fechas.
 * El rango se compara contra la FECHA DE PAGO (dueDate), no contra el día
 * de cobro: así un servicio cobrado el 20 de octubre con corte el 15 de
 * noviembre aparece en el periodo que se paga en diciembre.
 */
export function getRecurringOccurrences(
  charge: RecurringCharge,
  method: PaymentMethod | null | undefined,
  fromISO: string,
  toISO: string
): RecurringOccurrence[] {
  if (!charge.active) return []
  const from = parseISO(fromISO)
  const to = parseISO(toISO)
  const start = parseISO(charge.start_date)
  if (!from || !to || !start || to < from) return []

  const end = charge.end_date ? parseISO(charge.end_date) : null
  const isCredit =
    method?.type === 'credit' && method.closing_day != null

  // Se generan meses extra hacia atrás/adelante porque un cobro de fin de
  // mes puede pagarse el mes siguiente (corte + días de gracia).
  let cursor = new Date(from.getFullYear(), from.getMonth() - 2, 1)
  const limit = new Date(to.getFullYear(), to.getMonth() + 2, 1)
  const occurrences: RecurringOccurrence[] = []

  while (cursor.getTime() <= limit.getTime()) {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const applies =
      charge.frequency === 'yearly' ? month === start.getMonth() : true

    if (applies) {
      const chargeDate = new Date(year, month, clampDay(year, month, charge.charge_day))
      const chargeISO = toISODate(chargeDate)
      const afterStart = chargeDate.getTime() >= start.getTime()
      const beforeEnd = !end || chargeDate.getTime() <= end.getTime()

      if (afterStart && beforeEnd) {
        if (isCredit) {
          const period = getStatementPeriod(chargeISO, method as PaymentMethod)
          if (period) {
            const dueISO = toISODate(period.dueDate)
            if (isWithinISO(dueISO, fromISO, toISO)) {
              occurrences.push({
                charge,
                occurrenceDate: chargeISO,
                dueDate: period.dueDate,
                period,
                periodKey: period.key,
                amount: charge.amount,
                estimated: charge.is_variable_amount,
              })
            }
          }
        } else if (isWithinISO(chargeISO, fromISO, toISO)) {
          occurrences.push({
            charge,
            occurrenceDate: chargeISO,
            dueDate: chargeDate,
            period: null,
            periodKey: chargeISO.slice(0, 7),
            amount: charge.amount,
            estimated: charge.is_variable_amount,
          })
        }
      }
    }

    cursor = new Date(year, month + 1, 1)
  }

  return occurrences.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
}

/** Equivalente mensual de un compromiso (útil para totales). */
export function getRecurringMonthlyAmount(charge: RecurringCharge): number {
  return charge.frequency === 'yearly' ? charge.amount / 12 : charge.amount
}

/**
 * Próxima ocurrencia a partir de hoy (busca hasta 2 años).
 * Devuelve null si el compromiso está pausado o terminó.
 */
export function getNextRecurringOccurrence(
  charge: RecurringCharge,
  method: PaymentMethod | null | undefined,
  today: Date = new Date()
): RecurringOccurrence | null {
  if (!charge.active) return null
  const start = today
  const end = new Date(today.getFullYear() + 2, today.getMonth(), today.getDate())
  const occurrences = getRecurringOccurrences(
    charge,
    method,
    toISODate(start),
    toISODate(end)
  )
  return occurrences[0] ?? null
}

/**
 * Total mensual estimado de los compromisos activos.
 * Los anuales se prorratean entre 12.
 */
export function getRecurringMonthlyTotal(charges: RecurringCharge[]): number {
  return Math.round(
    charges
      .filter((charge) => charge.active)
      .reduce((sum, charge) => sum + getRecurringMonthlyAmount(charge), 0) * 100
  ) / 100
}
