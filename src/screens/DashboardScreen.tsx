import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Text, XStack, YStack } from 'tamagui'

import { Card } from '@/components/ui/Card'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { DonutChart, type DonutSlice } from '@/components/ui/DonutChart'
import { AppIcon } from '@/components/ui/Icon'
import { MonthSelector } from '@/components/ui/MonthSelector'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { TransactionLink } from '@/components/ui/TransactionLink'
import { palette } from '@/constants/theme'
import { CONTROL_HEIGHT, TYPO, CSS_TRANSITION } from '@/constants/ui'
import { useHolidays } from '@/contexts/HolidaysContext'
import { isWithinPeriod, usePeriod } from '@/contexts/PeriodContext'
import { useData } from '@/hooks/useData'
import { useModals } from '@/contexts/ModalsContext'
import { getCreditCardPlans } from '@/utils/creditCardRecommendation'
import {
  formatCompactCurrency,
  formatCurrency,
  formatDateLabel,
  toISODate,
  toMonthKey,
} from '@/utils/format'
import {
  getEffectiveDetailAmount,
  getTransactionDisplayAmount,
} from '@/utils/installments'
import { capitalizeLabel } from '@/utils/text'
import {
  getUpcomingCardPayments,
  type UpcomingCardPayment,
} from '@/utils/upcomingCardPayments'

/**
 * Resumen — equivale a `app/(tabs)/index.tsx` del móvil:
 * balance del periodo, gastos por categoría, presupuestos y (nuevo en web)
 * los últimos movimientos.
 */
export default function DashboardScreen() {
  const navigate = useNavigate()
  const { transactions, budgets, paymentMethods, recurringCharges, loading, refreshing, refresh } =
    useData()
  const { period, bounds } = usePeriod()
  const { openPeriodPicker } = useModals()
  const { holidays } = useHolidays()

  const monthKey = toMonthKey(period.month)

  // Recomendación de tarjeta para hoy (días de financiamiento sin intereses)
  const creditCardPlans = useMemo(
    () => getCreditCardPlans(paymentMethods, holidays),
    [paymentMethods, holidays]
  )
  const bestPlan = creditCardPlans[0] ?? null

  const hasCreditCards = useMemo(
    () => paymentMethods.some((method) => method.type === 'credit' && method.closing_day != null),
    [paymentMethods]
  )

  // Próximos pagos reales: movimientos + MSI + recurrentes por tarjeta.
  const upcomingCardPayments = useMemo(
    () =>
      getUpcomingCardPayments({
        paymentMethods,
        transactions,
        recurringCharges,
        holidays,
      }),
    [paymentMethods, transactions, recurringCharges, holidays]
  )

  const periodTransactions = useMemo(
    () => transactions.filter((transaction) => isWithinPeriod(transaction.date, bounds)),
    [transactions, bounds]
  )

  const { income, expense, balance, slices } = useMemo(() => {
    let incomeTotal = 0
    let expenseTotal = 0
    const byCategory = new Map<string, { total: number; color: string; name: string }>()

    for (const transaction of periodTransactions) {
      if (transaction.type === 'income') {
        incomeTotal += transaction.amount
        continue
      }
      // Los gastos se agregan desde los detalles (una transacción puede
      // tener varios ítems en distintas categorías). En MSI solo se cuenta
      // la parcialidad del periodo, no el total de la compra.
      for (const detail of transaction.details ?? []) {
        const detailAmount = getEffectiveDetailAmount(
          transaction,
          detail.quantity * detail.unit_price
        )
        expenseTotal += detailAmount
        const key = detail.category?.id ?? 'none'
        const existing = byCategory.get(key)
        byCategory.set(key, {
          total: (existing?.total ?? 0) + detailAmount,
          color: detail.category?.color ?? palette.muted,
          name: detail.category?.name ?? 'Sin categoría',
        })
      }
    }

    const donutSlices: DonutSlice[] = Array.from(byCategory.values())
      .sort((a, b) => b.total - a.total)
      .map((entry) => ({ label: entry.name, value: entry.total, color: entry.color }))

    return {
      income: incomeTotal,
      expense: expenseTotal,
      balance: incomeTotal - expenseTotal,
      slices: donutSlices,
    }
  }, [periodTransactions])

  const budgetProgress = useMemo(() => {
    return budgets
      .filter((budget) => budget.month === monthKey)
      .map((budget) => {
        const spent = periodTransactions
          .filter((transaction) => transaction.type === 'expense')
          .flatMap((transaction) =>
            (transaction.details ?? []).map((detail) => ({
              detail,
              amount: getEffectiveDetailAmount(
                transaction,
                detail.quantity * detail.unit_price
              ),
            }))
          )
          .filter((entry) => entry.detail.category_id === budget.category_id)
          .reduce((sum, entry) => sum + entry.amount, 0)
        return { budget, spent, progress: budget.amount > 0 ? spent / budget.amount : 0 }
      })
      .sort((a, b) => b.progress - a.progress)
  }, [budgets, monthKey, periodTransactions])

  const recentTransactions = useMemo(() => periodTransactions.slice(0, 5), [periodTransactions])

  return (
    <YStack gap="$lg">
      {/* Periodo + refrescar */}
      <XStack gap="$md" alignItems="center">
        <YStack flex={1}>
          <MonthSelector onOpenPicker={openPeriodPicker} />
        </YStack>
        <XStack
          width={CONTROL_HEIGHT}
          height={CONTROL_HEIGHT}
          alignItems="center"
          justifyContent="center"
          borderRadius="$lg"
          borderWidth={1}
          borderColor="$border"
          backgroundColor="$card"
          cursor={refreshing ? 'wait' : 'pointer'}
          hoverStyle={{ borderColor: palette.primary }}
          pressStyle={{ opacity: 0.7 }}
          onPress={() => void refresh()}
          role="button"
          aria-label="Actualizar datos">
          <AppIcon name="refresh" size={18} color={refreshing ? palette.primary : palette.muted} />
        </XStack>
      </XStack>

      {/* Balance del periodo */}
      <Card
        backgroundColor={palette.primary + '0F'}
        borderColor={palette.primary + '33'}
        gap="$md"
        shadowColor={palette.primary}
        shadowOpacity={0.1}
        shadowRadius={20}
        shadowOffset={{ width: 0, height: 8 }}>
        <Text fontSize={13} fontWeight="600" color="$textSecondary">
          {period.mode === 'month' ? 'Balance del mes' : 'Balance del periodo'}
        </Text>
        <Text fontSize={34} fontWeight="800" letterSpacing={-0.8} color="$text">
          {formatCurrency(balance)}
        </Text>
        <XStack justifyContent="space-between" marginTop="$xs">
          <XStack alignItems="center" gap="$sm">
            <YStack
              width={32}
              height={32}
              borderRadius="$full"
              alignItems="center"
              justifyContent="center"
              backgroundColor="$surfaceHover">
              <AppIcon name="arrow-down" size={16} color={palette.income} />
            </YStack>
            <YStack>
              <Text fontSize={12} fontWeight="600" color="$textSecondary">
                Ingresos
              </Text>
              <Text fontSize={16} fontWeight="800" color="$income">
                {formatCompactCurrency(income)}
              </Text>
            </YStack>
          </XStack>

          <XStack alignItems="center" gap="$sm">
            <YStack
              width={32}
              height={32}
              borderRadius="$full"
              alignItems="center"
              justifyContent="center"
              backgroundColor="$surfaceHover">
              <AppIcon name="arrow-up" size={16} color={palette.expense} />
            </YStack>
            <YStack>
              <Text fontSize={12} fontWeight="600" color="$textSecondary">
                Gastos
              </Text>
              <Text fontSize={16} fontWeight="800" color="$expense">
                {formatCompactCurrency(expense)}
              </Text>
            </YStack>
          </XStack>
        </XStack>
      </Card>

      {/* Próximos pagos de tarjetas */}
      {hasCreditCards ? <UpcomingPaymentsSection payments={upcomingCardPayments} /> : null}

      {/* Recomendación de tarjeta para hoy */}
      {bestPlan ? (
        <Card backgroundColor="$card" borderColor={palette.primary + '33'} gap="$md">
          <XStack alignItems="center" gap="$md">
            <YStack
              width={44}
              height={44}
              borderRadius="$full"
              alignItems="center"
              justifyContent="center"
              backgroundColor={palette.primary + '22'}>
              <AppIcon name="bulb-outline" size={22} color={palette.primary} />
            </YStack>
            <YStack flex={1} minWidth={0} gap={2}>
              <Text {...TYPO.label} color="$primary">
                Recomendado hoy
              </Text>
              <Text fontSize={17} fontWeight="800" color="$text" numberOfLines={1}>
                {bestPlan.method.name}
              </Text>
              <XStack alignItems="center" gap={8} flexWrap="wrap">
                <Text fontSize={12} color="$tabIconDefault">
                  Compra hoy y paga hasta el{' '}
                  {formatDateLabel(toISODate(bestPlan.dueDate))}
                  {bestPlan.estimated ? ' (estimado)' : ''}
                </Text>
                <Text fontSize={12} color="$tabIconDefault">
                  Corte {formatDateLabel(toISODate(bestPlan.closingDate))}
                </Text>
              </XStack>
              {bestPlan.adjusted ? (
                <Text fontSize={11} color="$tabIconDefault">
                  El {formatDateLabel(toISODate(bestPlan.rawDueDate))} cae en día inhábil; la
                  fecha límite se recorre al {formatDateLabel(toISODate(bestPlan.dueDate))}.
                </Text>
              ) : null}
            </YStack>
            <YStack alignItems="flex-end">
              <Text fontSize={30} fontWeight="800" color="$primary">
                {bestPlan.financingDays}
              </Text>
              <Text fontSize={11} color="$tabIconDefault">
                días de financiamiento
              </Text>
            </YStack>
          </XStack>

          {creditCardPlans.length > 1 ? (
            <YStack gap="$xs" borderTopWidth={1} borderTopColor={palette.primary + '22'} paddingTop="$sm">
              {creditCardPlans.slice(1).map((plan) => (
                <XStack key={plan.method.id} alignItems="center" justifyContent="space-between" gap="$md">
                  <Text flex={1} fontSize={12} color="$textSecondary" numberOfLines={1}>
                    {plan.method.name}
                  </Text>
                  <Text fontSize={12} fontWeight="700" color="$textSecondary">
                    {plan.financingDays} días
                  </Text>
                </XStack>
              ))}
            </YStack>
          ) : null}
        </Card>
      ) : null}

      {/* Gastos por categoría */}
      <XStack gap="$lg" alignItems="flex-start" flexWrap="wrap">
        <YStack flex={1.4} minWidth={320} gap="$md">
          <Text {...TYPO.section} color="$text">
            Gastos por categoría
          </Text>
          <Card>
            {slices.length === 0 ? (
              <EmptyState
                icon="pie-chart-outline"
                text={
                  period.mode === 'month' ? 'Sin gastos este mes' : 'Sin gastos en este periodo'
                }
              />
            ) : (
              <XStack gap="$lg" alignItems="center" flexWrap="wrap">
                <DonutChart
                  data={slices}
                  centerValue={formatCompactCurrency(expense)}
                  centerLabel="Total gastos"
                />
                <YStack flex={1} minWidth={200} gap="$sm">
                  {slices.slice(0, 7).map((slice) => (
                    <XStack key={slice.label} alignItems="center" gap="$sm">
                      <YStack width={10} height={10} borderRadius="$full" backgroundColor={slice.color} />
                      <Text flex={1} fontSize={13} color="$textSecondary" numberOfLines={1}>
                        {slice.label}
                      </Text>
                      <Text fontSize={13} fontWeight="700" color="$text">
                        {Math.round((slice.value / expense) * 100)}%
                      </Text>
                    </XStack>
                  ))}
                </YStack>
              </XStack>
            )}
          </Card>
        </YStack>

        {/* Movimientos recientes */}
        <YStack flex={1} minWidth={280} gap="$md">
          <XStack alignItems="center" justifyContent="space-between" gap="$sm">
            <Text {...TYPO.section} color="$text">
              Movimientos recientes
            </Text>
            <Text
              fontSize={13}
              fontWeight="700"
              color="$primary"
              cursor="pointer"
              style={{ transition: CSS_TRANSITION }}
              pressStyle={{ opacity: 0.7 }}
              onPress={() => navigate('/movimientos')}
              role="button"
              aria-label="Ver todos los movimientos">
              Ver todos
            </Text>
          </XStack>
          <Card noPadding overflow="hidden">
            {recentTransactions.length === 0 ? (
              <EmptyState
                icon="receipt-outline"
                text={
                  loading
                    ? 'Cargando movimientos…'
                    : 'Aún no hay movimientos en este periodo.'
                }
              />
            ) : (
              recentTransactions.map((transaction, index) => {
                const isIncome = transaction.type === 'income'
                const isPending = transaction.breakdown_status === 'pending'
                const detail = transaction.details?.[0]
                const categoryName = detail?.category?.name ?? (isIncome ? 'Ingreso' : 'Gasto')
                const categoryColor =
                  detail?.category?.color ?? (isIncome ? palette.income : palette.expense)
                const rawMerchant = transaction.merchant?.trim() || null
                const rawConcept = detail?.description?.trim() || null
                const merchant = rawMerchant ? capitalizeLabel(rawMerchant) : null
                const concept = rawConcept ? capitalizeLabel(rawConcept) : null
                const title = merchant || concept || categoryName
                const showConcept =
                  !!concept &&
                  (!merchant ||
                    concept.toLocaleLowerCase('es-MX') !==
                      merchant.toLocaleLowerCase('es-MX'))

                return (
                  <TransactionLink
                    key={transaction.id}
                    transactionId={transaction.id}
                    ariaLabel={`Abrir movimiento ${title}`}>
                    <XStack
                      alignItems="center"
                      gap="$md"
                      paddingHorizontal="$md"
                      paddingVertical={8}
                      borderTopWidth={index === 0 ? 0 : 1}
                      borderTopColor="$border"
                      cursor="pointer"
                      style={{ transition: CSS_TRANSITION }}
                      hoverStyle={{ backgroundColor: '$surfaceHover' }}
                      pressStyle={{ opacity: 0.8 }}>
                    <CategoryIcon
                      icon={detail?.category?.icon ?? (isIncome ? 'cash' : 'pricetag')}
                      color={categoryColor}
                      size={34}
                    />
                    <YStack flex={1} minWidth={0} gap={2}>
                      <XStack alignItems="baseline" gap={4} minWidth={0}>
                        <Text
                          fontSize={14}
                          fontWeight="600"
                          letterSpacing={-0.1}
                          color="$text"
                          numberOfLines={1}
                          flexShrink={1}>
                          {title}
                        </Text>
                        {showConcept ? (
                          <Text
                            fontSize={13}
                            fontWeight="600"
                            color="$textSecondary"
                            numberOfLines={1}
                            flexShrink={4}
                            minWidth={0}>
                            · {concept}
                          </Text>
                        ) : null}
                      </XStack>
                      <XStack alignItems="center" gap={6} flexWrap="wrap" minWidth={0}>
                        <XStack
                          paddingHorizontal={6}
                          paddingVertical={1}
                          borderRadius="$full"
                          backgroundColor={categoryColor + '1A'}>
                          <Text
                            fontSize={10}
                            fontWeight="600"
                            color="$textSecondary"
                            numberOfLines={1}>
                            {categoryName}
                          </Text>
                        </XStack>
                        <Text fontSize={11} color="$tabIconDefault">
                          {formatDateLabel(transaction.date)}
                        </Text>
                        {isPending ? (
                          <Text
                            fontSize={9.5}
                            fontWeight="800"
                            textTransform="uppercase"
                            letterSpacing={0.4}
                            color="$warning">
                            Pendiente
                          </Text>
                        ) : null}
                      </XStack>
                    </YStack>
                    <Text
                      fontSize={14}
                      fontWeight="800"
                      color={isIncome ? '$income' : '$expense'}
                      style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {isIncome ? '+' : '-'}
                      {formatCurrency(getTransactionDisplayAmount(transaction))}
                    </Text>
                    </XStack>
                  </TransactionLink>
                )
              })
            )}
          </Card>
        </YStack>
      </XStack>

      {/* Presupuestos del mes */}
      {period.mode === 'month' && budgetProgress.length > 0 ? (
        <YStack gap="$md">
          <XStack alignItems="center" justifyContent="space-between">
            <Text {...TYPO.section} color="$text">
              Presupuestos
            </Text>
            <Text
              fontSize={13}
              fontWeight="700"
              color="$primary"
              cursor="pointer"
              style={{ transition: CSS_TRANSITION }}
              pressStyle={{ opacity: 0.7 }}
              onPress={() => navigate('/presupuestos')}>
              Ver todos
            </Text>
          </XStack>
          <Card gap="$lg">
            {budgetProgress.slice(0, 4).map(({ budget, spent, progress }) => (
              <YStack key={budget.id} gap="$sm">
                <XStack alignItems="center" justifyContent="space-between" gap="$md">
                  <XStack alignItems="center" gap="$sm" flex={1} minWidth={0}>
                    <CategoryIcon
                      icon={budget.category?.icon ?? 'pricetag'}
                      color={budget.category?.color ?? palette.primary}
                      size={32}
                    />
                    <Text fontSize={14} fontWeight="700" color="$text" numberOfLines={1}>
                      {budget.category?.name ?? 'Categoría'}
                    </Text>
                  </XStack>
                  <Text
                    fontSize={13}
                    fontWeight="700"
                    color={progress > 1 ? '$expense' : '$textSecondary'}>
                    {formatCompactCurrency(spent)} / {formatCompactCurrency(budget.amount)}
                  </Text>
                </XStack>
                <ProgressBar progress={progress} color={budget.category?.color} />
              </YStack>
            ))}
          </Card>
        </YStack>
      ) : null}

      {!loading && transactions.length === 0 ? (
        <Card>
          <EmptyState
            icon="receipt-outline"
            text="Aún no tienes movimientos. Usa el botón «Nuevo movimiento» para registrar tu primer ingreso o gasto."
          />
        </Card>
      ) : null}
    </YStack>
  )
}

function UpcomingPaymentsSection({ payments }: { payments: UpcomingCardPayment[] }) {
  const [next, ...rest] = payments

  return (
    <YStack gap="$md">
      <Text {...TYPO.section} color="$text">
        Próximos pagos de tarjetas
      </Text>
      {!next ? (
        <Card>
          <EmptyState
            icon="card-outline"
            text="No hay pagos de tarjetas pendientes en este momento."
          />
        </Card>
      ) : (
        <Card noPadding overflow="hidden">
          <CardPaymentFeatured payment={next} />
          {rest.map((payment) => (
            <CardPaymentRow key={payment.card.id} payment={payment} />
          ))}
        </Card>
      )}
    </YStack>
  )
}

function CardPaymentFeatured({ payment }: { payment: UpcomingCardPayment }) {
  return (
    <YStack gap="$md" padding="$lg" backgroundColor={palette.primary + '0A'}>
      <XStack alignItems="flex-start" justifyContent="space-between" gap="$md">
        <XStack alignItems="center" gap="$md" flex={1} minWidth={0}>
          <YStack
            width={42}
            height={42}
            borderRadius="$md"
            alignItems="center"
            justifyContent="center"
            backgroundColor={palette.primary + '1A'}
            flexShrink={0}>
            <AppIcon name="card" size={21} color={palette.primary} />
          </YStack>
          <YStack flex={1} minWidth={0} gap={2}>
            <Text
              fontSize={10}
              fontWeight="800"
              textTransform="uppercase"
              letterSpacing={0.7}
              color="$primary">
              Próximo pago
            </Text>
            <Text
              fontSize={17}
              fontWeight="800"
              letterSpacing={-0.2}
              color="$text"
              numberOfLines={1}>
              {payment.card.name}
            </Text>
          </YStack>
        </XStack>

        <YStack alignItems="flex-end" gap={2} flexShrink={0}>
          <Text
            fontSize={22}
            $gtXs={{ fontSize: 24 }}
            fontWeight="800"
            letterSpacing={-0.4}
            color="$expense"
            style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(payment.amount)}
          </Text>
          {isEstimatedPayment(payment) ? (
            <Text
              fontSize={9}
              fontWeight="800"
              textTransform="uppercase"
              letterSpacing={0.4}
              color="$warning">
              Estimado
            </Text>
          ) : null}
        </YStack>
      </XStack>

      <XStack alignItems="center" gap="$sm" flexWrap="wrap">
        <XStack alignItems="center" gap={5}>
          <AppIcon name="calendar-outline" size={13} color={palette.primary} />
          <Text fontSize={12} fontWeight="700" color="$text">
            Vence {formatDateLabel(toISODate(payment.period.dueDate))}
          </Text>
        </XStack>
        <Text fontSize={11} color="$tabIconDefault">
          · {formatDueHint(payment.daysUntilDue)}
        </Text>
        <Text fontSize={11} color="$tabIconDefault">
          · Corte {formatDateLabel(toISODate(payment.period.closingDate))}
        </Text>
      </XStack>
    </YStack>
  )
}

function CardPaymentRow({ payment }: { payment: UpcomingCardPayment }) {
  return (
    <XStack
      alignItems="center"
      gap="$md"
      paddingHorizontal="$lg"
      paddingVertical="$md"
      borderTopWidth={1}
      borderTopColor="$border">
      <YStack
        width={32}
        height={32}
        borderRadius="$full"
        alignItems="center"
        justifyContent="center"
        backgroundColor={palette.primary + '14'}
        flexShrink={0}>
        <AppIcon name="card" size={16} color={palette.primary} />
      </YStack>

      <YStack flex={1} minWidth={0} gap={2}>
        <Text fontSize={14} fontWeight="600" color="$text" numberOfLines={1}>
          {payment.card.name}
        </Text>
        <Text fontSize={11} color="$tabIconDefault" numberOfLines={1}>
          Vence {formatDateLabel(toISODate(payment.period.dueDate))} ·{' '}
          {formatDueHint(payment.daysUntilDue)}
        </Text>
      </YStack>

      <YStack alignItems="flex-end" gap={1} flexShrink={0}>
        <Text
          fontSize={14}
          fontWeight="800"
          color="$expense"
          style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatCurrency(payment.amount)}
        </Text>
        {isEstimatedPayment(payment) ? (
          <Text
            fontSize={9}
            fontWeight="800"
            textTransform="uppercase"
            letterSpacing={0.4}
            color="$warning">
            Estimado
          </Text>
        ) : null}
      </YStack>
    </XStack>
  )
}

/** true si el monto o la fecha del pago todavía son estimados. */
const isEstimatedPayment = (payment: UpcomingCardPayment) =>
  payment.pendingClosing || payment.estimatedDate

/** Texto relativo corto para la fecha límite. */
const formatDueHint = (days: number) => {
  if (days < 0) return 'vencido'
  if (days === 0) return 'hoy'
  if (days === 1) return 'mañana'
  return `en ${days} días`
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <YStack alignItems="center" justifyContent="center" padding="$xl" gap="$md">
      <AppIcon name={icon} size={40} color={palette.muted} />
      <Text fontSize={14} lineHeight={20} textAlign="center" color="$tabIconDefault">
        {text}
      </Text>
    </YStack>
  )
}
