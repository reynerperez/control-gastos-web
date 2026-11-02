import type { PaymentMethod } from '@/types'
import { addDays, EMPTY_HOLIDAYS, startOfDay, type HolidaySet } from '@/utils/bankingDates'
import {
  getCreditCardPlans,
  getRecommendableMethods,
  getRecommendationCalendar,
  getTodayRecommendation,
} from '@/utils/creditCardRecommendation'

/** Un límite null indica que no se encontró dentro del horizonte consultado. */
export interface CardUsageRange {
  startDate: Date | null
  endDate: Date | null
}

export interface CardUsageSchedule {
  method: PaymentMethod
  range: CardUsageRange | null
  isCurrent: boolean
}

const HISTORY_DAYS = 366

/**
 * Rangos continuos de cada tarjeta, incluso si cambia el conjunto de empatadas.
 * Se conserva el plan de HOY para el pago y los días de financiamiento del resumen.
 * El inicio pasado se calcula con la configuración y los festivos disponibles.
 */
export function getCardUsageSchedules(
  paymentMethods: PaymentMethod[],
  holidays: HolidaySet = EMPTY_HOLIDAYS,
  today: Date = new Date()
) {
  const reference = startOfDay(today)
  const methods = getRecommendableMethods(paymentMethods)
  const calendar = getRecommendationCalendar(methods, holidays, reference)
  const current = getTodayRecommendation(calendar)
  const starts = new Map<string, Date | null>()
  const pending = new Set(current?.methods.map((method) => method.id) ?? [])
  for (const id of pending) starts.set(id, null)

  // Buscar una pérdida real de la recomendación, no usar el borde de la búsqueda
  // como si fuera el inicio. Una tarjeta dominante puede ganar todo el año.
  for (let offset = 1; pending.size && offset <= HISTORY_DAYS; offset += 1) {
    const day = addDays(reference, -offset)
    const plans = getCreditCardPlans(methods, holidays, day)
    const maxDays = plans[0]?.financingDays
    const winners = new Set(plans.filter((plan) => plan.financingDays === maxDays).map((plan) => plan.method.id))
    for (const id of pending) {
      if (!winners.has(id)) {
        starts.set(id, addDays(day, 1))
        pending.delete(id)
      }
    }
  }

  const schedules: CardUsageSchedule[] = methods.map((method) => {
    const isCurrent = starts.has(method.id)
    let range: CardUsageRange | null = null
    for (let index = 0; index < calendar.length; index += 1) {
      const interval = calendar[index]
      if (!interval.methods.some((winner) => winner.id === method.id)) {
        if (range) break
        continue
      }
      if (!range) range = { startDate: isCurrent ? starts.get(method.id) ?? null : interval.startDate, endDate: interval.endDate }
      range.endDate = index === calendar.length - 1 ? null : interval.endDate
    }
    return { method, range, isCurrent }
  })

  schedules.sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) ||
    (a.range?.startDate?.getTime() ?? (a.isCurrent ? -Infinity : Infinity)) - (b.range?.startDate?.getTime() ?? (b.isCurrent ? -Infinity : Infinity)) ||
    a.method.name.localeCompare(b.method.name, 'es'))

  return { calendar, current, schedules }
}
