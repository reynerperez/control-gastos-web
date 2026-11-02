import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Text, XStack, YStack } from 'tamagui'

import { Card } from '@/components/ui/Card'
import { AppIcon } from '@/components/ui/Icon'
import { palette } from '@/constants/theme'
import { CSS_TRANSITION, focusOutline, TYPO } from '@/constants/ui'
import type { PaymentMethod } from '@/types'
import type { HolidaySet } from '@/utils/bankingDates'
import { getCardUsageSchedules, type CardUsageRange } from '@/utils/cardUsageRanges'
import { toISODate } from '@/utils/format'

const shortDate = (date: Date) => date.toLocaleDateString('es-MX', {
  day: 'numeric',
  month: 'short',
  ...(date.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}),
})

const usageRange = (start: Date, end: Date) =>
  toISODate(start) === toISODate(end) ? shortDate(start) : `${shortDate(start)} – ${shortDate(end)}`

const rangeLabel = ({ startDate, endDate }: CardUsageRange) => {
  if (startDate && endDate) return usageRange(startDate, endDate)
  if (startDate) return `Desde el ${shortDate(startDate)}`
  if (endDate) return `Hasta el ${shortDate(endDate)}`
  return 'Sin cambio previsto en 12 meses'
}

const describeRange = (range: CardUsageRange) => range.startDate && range.endDate
  ? `Conviene del ${shortDate(range.startDate)} al ${shortDate(range.endDate)}`
  : range.startDate ? `Conviene desde el ${shortDate(range.startDate)}`
    : range.endDate ? `Conviene desde hace más de un año, hasta el ${shortDate(range.endDate)}`
      : 'Recomendada los próximos 12 meses'

/** La decisión de hoy se muestra primero; los demás rangos se consultan al desplegar. */
export function CardRecommendation({ paymentMethods, holidays, loading }: {
  paymentMethods: PaymentMethod[]
  holidays: HolidaySet
  loading: boolean
}) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const { calendar, current, schedules } = useMemo(
    () => getCardUsageSchedules(paymentMethods, holidays),
    [paymentMethods, holidays]
  )
  const next = calendar[1]
  const currentRanges = current?.methods.map((method) => schedules.find((schedule) => schedule.method.id === method.id)?.range ?? null) ?? []
  const commonRange = currentRanges[0]
  const hasCommonRange = !!commonRange && currentRanges.every((range) => range?.startDate?.getTime() === commonRange.startDate?.getTime() && range?.endDate?.getTime() === commonRange.endDate?.getTime())

  return (
    <Card gap="$lg" borderColor={palette.primary + '44'} role="region" aria-label="Tarjeta recomendada">
      <XStack alignItems="center" gap="$sm">
        <AppIcon name="card-outline" size={18} color={palette.primary} />
        <Text {...TYPO.bodyStrong} color="$text">Tarjeta recomendada</Text>
      </XStack>

      {!current ? (
        <YStack gap="$md" alignItems="flex-start">
          <Text {...TYPO.body} color="$textSecondary">
            {loading ? 'Cargando tus tarjetas…' : 'Configura el corte y la fecha de pago de una tarjeta de crédito.'}
          </Text>
          {!loading ? (
            <XStack
              minHeight={44}
              alignItems="center"
              gap="$xs"
              cursor="pointer"
              role="button"
              aria-label="Configurar tarjetas"
              tabIndex={0}
              focusVisibleStyle={focusOutline}
              onPress={() => navigate('/ajustes/metodos-de-pago')}
              onKeyDown={(event) => {
                const key = (event as unknown as { key?: string }).key
                if (key === 'Enter' || key === ' ') {
                  event.preventDefault()
                  navigate('/ajustes/metodos-de-pago')
                }
              }}>
              <Text {...TYPO.bodyStrong} color="$primary">Configurar tarjetas</Text>
              <AppIcon name="chevron-forward" size={14} color={palette.primary} />
            </XStack>
          ) : null}
        </YStack>
      ) : (
        <>
          <XStack gap="$xl" alignItems="center" flexWrap="wrap">
            <YStack flexGrow={1} flexShrink={1} flexBasis={260} minWidth={0} gap="$sm">
              <Text {...TYPO.caption} color="$textSecondary">
                {current.methods.length > 1 ? 'Hoy puedes usar cualquiera' : 'Usa hoy'}
              </Text>
              {current.methods.map((method, index) => (
                <YStack key={method.id} gap="$xs">
                  <Text fontSize={24} fontWeight="800" letterSpacing={-0.5} color="$text">
                    {method.name}
                  </Text>
                  {!hasCommonRange && currentRanges[index] ? <Text {...TYPO.caption} color="$textSecondary">{describeRange(currentRanges[index])}</Text> : null}
                </YStack>
              ))}
              {hasCommonRange ? (
                <XStack alignItems="center" gap="$xs" alignSelf="flex-start" flexWrap="wrap">
                  <AppIcon name="checkmark-circle" size={14} color={palette.income} />
                  <Text {...TYPO.caption} color="$textSecondary">{describeRange(commonRange)}</Text>
                </XStack>
              ) : null}
            </YStack>

            <YStack flexGrow={0} flexShrink={1} flexBasis={240} minWidth={0} gap="$sm">
              <Text {...TYPO.caption} color="$textSecondary">Si compras hoy</Text>
              <XStack gap="$xl" alignItems="center" flexWrap="wrap">
                <YStack gap="$xs">
                  <XStack gap="$xs" alignItems="baseline">
                    <Text {...TYPO.amountLarge} color="$primary">{current.bestPlan.financingDays}</Text>
                    <Text {...TYPO.body} color="$primary">días</Text>
                  </XStack>
                  <Text {...TYPO.caption} color="$textSecondary">para pagar</Text>
                </YStack>
                <YStack gap="$xs" borderLeftWidth={1} borderLeftColor="$border" paddingLeft="$xl">
                  <Text {...TYPO.caption} color="$textSecondary">
                    {current.bestPlan.estimated ? 'Pago estimado' : 'Pagarías el'}
                  </Text>
                  <Text fontSize={20} fontWeight="700" letterSpacing={-0.3} color="$text">
                    {shortDate(current.bestPlan.dueDate)}
                  </Text>
                </YStack>
              </XStack>
            </YStack>
          </XStack>

          {next ? (
            <XStack gap="$md" alignItems="flex-start" borderTopWidth={1} borderTopColor="$border" paddingTop="$md">
              <Text {...TYPO.caption} color="$textSecondary" paddingTop="$xs">Después</Text>
              <YStack flex={1} minWidth={0} gap="$xs">
                <Text {...TYPO.bodyStrong} color="$text">{next.methods.map((method) => method.name).join(' · ')}</Text>
                <Text {...TYPO.caption} color="$textSecondary">{usageRange(next.startDate, next.endDate)}</Text>
              </YStack>
            </XStack>
          ) : null}

          <YStack gap="$md" borderTopWidth={1} borderTopColor="$border" paddingTop="$xs">
            <XStack
              minHeight={44}
              justifyContent="space-between"
              alignItems="center"
              gap="$md"
              cursor="pointer"
              role="button"
              aria-label={expanded ? 'Ocultar rangos por tarjeta' : 'Ver rangos por tarjeta'}
              aria-expanded={expanded}
              aria-controls="card-usage-ranges"
              tabIndex={0}
              focusVisibleStyle={focusOutline}
              hoverStyle={{ opacity: 0.8 }}
              style={{ transition: CSS_TRANSITION }}
              onPress={() => setExpanded((value) => !value)}
              onKeyDown={(event) => {
                const key = (event as unknown as { key?: string }).key
                if (key === 'Enter' || key === ' ') {
                  event.preventDefault()
                  setExpanded((value) => !value)
                }
              }}>
              <Text {...TYPO.bodyStrong} color="$primary">{expanded ? 'Ocultar rangos' : 'Ver rangos por tarjeta'}</Text>
              <AppIcon name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={palette.primary} />
            </XStack>
            {expanded ? (
              <YStack id="card-usage-ranges" role="list" aria-label="Rangos de uso por tarjeta" borderTopWidth={1} borderTopColor="$border">
                {schedules.map(({ method, range }) => (
                  <XStack
                    key={method.id}
                    role="listitem"
                    gap="$sm"
                    flexWrap="wrap"
                    alignItems="baseline"
                    paddingVertical="$md"
                    borderBottomWidth={1}
                    borderBottomColor="$border">
                    <Text {...TYPO.bodyStrong} color="$text" flexGrow={1} flexShrink={1} flexBasis={220} minWidth={0}>
                      {method.name}
                    </Text>
                    <Text {...TYPO.caption} color="$textSecondary" flexGrow={1} flexShrink={1} flexBasis={220} minWidth={0}>
                      {range ? rangeLabel(range) : 'Sin rango preferente en 12 meses'}
                    </Text>
                  </XStack>
                ))}
              </YStack>
            ) : null}
          </YStack>
        </>
      )}
    </Card>
  )
}
