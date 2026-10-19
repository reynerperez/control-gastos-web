import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Text, XStack, YStack } from 'tamagui'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { AppIcon } from '@/components/ui/Icon'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { palette } from '@/constants/theme'
import { CSS_TRANSITION, TYPO } from '@/constants/ui'
import { useModals } from '@/contexts/ModalsContext'
import { useData } from '@/hooks/useData'
import { PaymentMethod, Transaction } from '@/types'
import {
  formatCurrency,
  formatDateLabel,
  toISODate,
} from '@/utils/format'
import {
  getInstallmentPlan,
  isInstallmentTransaction,
  type InstallmentPlan,
} from '@/utils/installments'
import {
  getNextRecurringOccurrence,
  getRecurringMonthlyTotal,
} from '@/utils/recurringCharges'

type Tab = 'msi' | 'recurring'

/** Resuelve la tarjeta de una transacción usando la relación o el catálogo. */
function resolveMethod(
  transaction: Transaction,
  paymentMethods: PaymentMethod[]
): PaymentMethod | null {
  return (
    transaction.payment_method ??
    paymentMethods.find((method) => method.id === transaction.payment_method_id) ??
    null
  )
}

/**
 * Compromisos — vista global de deudas y cargos recurrentes.
 *
 * Complementa el acordeón de "Periodo de pago" de Movimientos:
 *   • Allí se ve QUÉ toca pagar en cada tarjeta.
 *   • Aquí se ve el SALDO pendiente total y se administran/pausan/liquidan.
 */
export default function CommitmentsScreen() {
  const navigate = useNavigate()
  const { transactions, recurringCharges, paymentMethods, loading } = useData()
  const { openTransactionForm, openRecurringCharge } = useModals()
  const [tab, setTab] = useState<Tab>('msi')

  const plans = useMemo<InstallmentPlan[]>(() => {
    return transactions
      .filter(isInstallmentTransaction)
      .map((transaction) =>
        getInstallmentPlan(transaction, resolveMethod(transaction, paymentMethods))
      )
      .filter((plan): plan is InstallmentPlan => !!plan)
      .sort((a, b) => {
        if (a.settled !== b.settled) return a.settled ? 1 : -1
        const aDue = a.nextInstallment?.dueDate.getTime() ?? Number.MAX_SAFE_INTEGER
        const bDue = b.nextInstallment?.dueDate.getTime() ?? Number.MAX_SAFE_INTEGER
        return aDue - bDue
      })
  }, [transactions, paymentMethods])

  const activePlans = plans.filter((plan) => !plan.settled)
  const activeRecurring = recurringCharges.filter((charge) => charge.active)

  const totalDebt = useMemo(
    () =>
      Math.round(
        activePlans.reduce((sum, plan) => sum + plan.remainingAmount, 0) * 100
      ) / 100,
    [activePlans]
  )

  const monthlyCommitment = useMemo(
    () => getRecurringMonthlyTotal(recurringCharges),
    [recurringCharges]
  )

  const nextPayment = useMemo(() => {
    const candidates: { date: Date; label: string; amount: number }[] = []
    for (const plan of activePlans) {
      if (!plan.nextInstallment) continue
      candidates.push({
        date: plan.nextInstallment.dueDate,
        label:
          plan.transaction.merchant ||
          plan.transaction.details?.[0]?.description ||
          'Compra a MSI',
        amount: plan.nextInstallment.amount,
      })
    }
    for (const charge of activeRecurring) {
      const method =
        charge.payment_method ??
        paymentMethods.find((entry) => entry.id === charge.payment_method_id) ??
        null
      const occurrence = getNextRecurringOccurrence(charge, method)
      if (!occurrence) continue
      candidates.push({
        date: occurrence.dueDate,
        label: charge.name,
        amount: occurrence.amount,
      })
    }
    candidates.sort((a, b) => a.date.getTime() - b.date.getTime())
    return candidates[0] ?? null
  }, [activePlans, activeRecurring, paymentMethods])

  return (
    <YStack gap="$lg">
      {/* Acciones */}
      <XStack gap="$sm" flexWrap="wrap" alignItems="center">
        <Button
          title="Nueva compra a MSI"
          variant="secondary"
          size="sm"
          onPress={() => openTransactionForm()}
        />
        <Button
          title="Agregar compromiso"
          size="sm"
          onPress={() => openRecurringCharge()}
        />
        <YStack flex={1} minWidth={0} />
        <XStack alignItems="center" gap="$xs">
          <AppIcon name="information-circle" size={14} color={palette.muted} />
          <Text fontSize={11} color="$tabIconDefault">
            Las proyecciones no crean movimientos reales
          </Text>
        </XStack>
      </XStack>

      {/* Resumen global */}
      <XStack gap="$md" flexWrap="wrap">
        <SummaryCard
          flex={1}
          minWidth={210}
          label="Deuda MSI pendiente"
          value={formatCurrency(totalDebt)}
          hint={`${activePlans.length} plan${activePlans.length === 1 ? '' : 'es'} activo${activePlans.length === 1 ? '' : 's'}`}
          color={palette.expense}
          icon="card"
        />
        <SummaryCard
          flex={1}
          minWidth={210}
          label="Compromisos al mes"
          value={formatCurrency(monthlyCommitment)}
          hint={`${activeRecurring.length} activo${activeRecurring.length === 1 ? '' : 's'} · anuales prorrateados`}
          color={palette.warning}
          icon="repeat"
        />
        <SummaryCard
          flex={1}
          minWidth={210}
          label="Próximo pago"
          value={nextPayment ? formatCurrency(nextPayment.amount) : '—'}
          hint={
            nextPayment
              ? `${nextPayment.label} · ${formatDateLabel(toISODate(nextPayment.date))}`
              : 'Sin pagos proyectados'
          }
          color={palette.primary}
          icon="calendar-outline"
        />
      </XStack>

      {/* Pestañas */}
      <XStack gap={2} padding={3} borderRadius="$md" borderWidth={1} borderColor="$border" backgroundColor="$background" alignSelf="flex-start">
        {(
          [
            { key: 'msi' as const, label: `MSI (${activePlans.length})` },
            { key: 'recurring' as const, label: `Recurrentes (${activeRecurring.length})` },
          ]
        ).map((option) => {
          const active = tab === option.key
          return (
            <XStack
              key={option.key}
              height={34}
              paddingHorizontal="$md"
              borderRadius="$sm"
              alignItems="center"
              justifyContent="center"
              cursor="pointer"
              style={{ transition: CSS_TRANSITION }}
              backgroundColor={active ? '$primaryLight' : 'transparent'}
              pressStyle={{ opacity: 0.8 }}
              onPress={() => setTab(option.key)}
              role="button"
              aria-pressed={active}
              aria-label={option.label}>
              <Text fontSize={12} fontWeight="700" color={active ? '$primary' : '$tabIconDefault'}>
                {option.label}
              </Text>
            </XStack>
          )
        })}
      </XStack>

      {loading ? (
        <Text fontSize={14} color="$tabIconDefault">
          Cargando compromisos…
        </Text>
      ) : tab === 'msi' ? (
        <MsiSection
          plans={plans}
          onOpenTransaction={(id) => navigate(`/movimientos/${id}`)}
          onCreate={() => openTransactionForm()}
        />
      ) : (
        <RecurringSection
          onEdit={(id) => openRecurringCharge(id)}
          onCreate={() => openRecurringCharge()}
        />
      )}
    </YStack>
  )
}

function SummaryCard({
  label,
  value,
  hint,
  color,
  icon,
  flex,
  minWidth,
}: {
  label: string
  value: string
  hint: string
  color: string
  icon: string
  flex?: number
  minWidth?: number
}) {
  return (
    <Card flex={flex} minWidth={minWidth} gap="$sm" borderColor={color + '33'} backgroundColor={color + '0D'}>
      <XStack alignItems="center" gap="$sm">
        <YStack
          width={30}
          height={30}
          borderRadius="$full"
          alignItems="center"
          justifyContent="center"
          backgroundColor={color + '1F'}>
          <AppIcon name={icon} size={15} color={color} />
        </YStack>
        <Text {...TYPO.label} color="$tabIconDefault" flex={1} numberOfLines={1}>
          {label}
        </Text>
      </XStack>
      <Text fontSize={24} fontWeight="800" letterSpacing={-0.4} color="$text">
        {value}
      </Text>
      <Text fontSize={11} color="$tabIconDefault" numberOfLines={2}>
        {hint}
      </Text>
    </Card>
  )
}

function MsiSection({
  plans,
  onOpenTransaction,
  onCreate,
}: {
  plans: InstallmentPlan[]
  onOpenTransaction: (id: string) => void
  onCreate: () => void
}) {
  const { settleInstallmentPlan } = useData()

  if (plans.length === 0) {
    return (
      <Card>
        <YStack alignItems="center" gap="$md" padding="$xl">
          <AppIcon name="card-outline" size={40} color={palette.muted} />
          <Text fontSize={14} color="$tabIconDefault" textAlign="center">
            No hay compras a meses sin intereses. Al registrar un gasto con
            tarjeta de crédito puedes dividirlo en parcialidades.
          </Text>
          <Button title="Registrar compra a MSI" size="sm" onPress={onCreate} />
        </YStack>
      </Card>
    )
  }

  return (
    <YStack gap="$md">
      <Text {...TYPO.section} color="$text">
        Planes de Meses Sin Intereses
      </Text>
      {plans.map((plan) => {
        const detail = plan.transaction.details?.[0]
        const title =
          plan.transaction.merchant || detail?.description || 'Compra a MSI'
        const progress = plan.count > 0 ? plan.paidCount / plan.count : 0
        const status = plan.settled
          ? 'Liquidado'
          : plan.paidCount >= plan.count
            ? 'Concluido'
            : `${plan.count - plan.paidCount} restantes`
        const statusColor = plan.settled
          ? palette.income
          : plan.paidCount >= plan.count
            ? palette.income
            : palette.warning

        return (
          <Card key={plan.transaction.id} gap="$md" opacity={plan.settled ? 0.75 : 1}>
            <XStack alignItems="flex-start" gap="$md">
              <CategoryIcon
                icon={detail?.category?.icon ?? 'card'}
                color={detail?.category?.color ?? palette.primary}
                size={44}
              />
              <YStack flex={1} minWidth={0} gap={3}>
                <Text {...TYPO.cardTitle} color="$text" numberOfLines={1}>
                  {title}
                </Text>
                <Text fontSize={12} color="$tabIconDefault" numberOfLines={1}>
                  {plan.method.name} · {plan.count} parcialidades ·{' '}
                  {detail?.category?.name ?? 'Sin categoría'}
                </Text>
                <XStack alignItems="center" gap="$xs">
                  <Text fontSize={10} fontWeight="800" color={statusColor} textTransform="uppercase" letterSpacing={0.4}>
                    {status}
                  </Text>
                  <Text fontSize={11} color="$tabIconDefault">
                    · {plan.transaction.date}
                  </Text>
                </XStack>
              </YStack>
              <YStack alignItems="flex-end" gap={2}>
                <Text fontSize={11} color="$tabIconDefault">
                  Parcialidad
                </Text>
                <Text fontSize={16} fontWeight="800" color="$text">
                  {formatCurrency(plan.installments[0]?.amount ?? 0)}
                </Text>
                <Text fontSize={11} color="$tabIconDefault">
                  /mes
                </Text>
              </YStack>
            </XStack>

            <YStack gap="$xs">
              <ProgressBar progress={Math.min(1, progress)} color={statusColor} />
              <XStack justifyContent="space-between" gap="$md">
                <Text fontSize={11} color="$tabIconDefault">
                  {plan.paidCount} de {plan.count} pagadas · {Math.round(progress * 100)}%
                </Text>
                <Text fontSize={11} fontWeight="700" color={plan.remainingAmount > 0 ? '$expense' : '$income'}>
                  Saldo: {formatCurrency(plan.remainingAmount)}
                </Text>
              </XStack>
            </YStack>

            <XStack alignItems="center" gap="$sm" flexWrap="wrap">
              <XStack
                alignItems="center"
                gap={4}
                cursor="pointer"
                pressStyle={{ opacity: 0.7 }}
                onPress={() => onOpenTransaction(plan.transaction.id)}
                role="button"
                aria-label={`Ver movimiento ${title}`}>
                <AppIcon name="receipt-outline" size={14} color={palette.primary} />
                <Text fontSize={12} fontWeight="700" color="$primary">
                  Ver movimiento
                </Text>
              </XStack>
              <YStack flex={1} />
              {plan.nextInstallment ? (
                <Text fontSize={11} color="$tabIconDefault">
                  Próximo pago {formatDateLabel(toISODate(plan.nextInstallment.dueDate))}
                </Text>
              ) : null}
              {!plan.settled && plan.remainingAmount > 0 ? (
                <XStack
                  height={30}
                  alignItems="center"
                  gap="$xs"
                  paddingHorizontal="$md"
                  borderRadius="$md"
                  borderWidth={1}
                  borderColor={palette.expense + '55'}
                  backgroundColor={palette.expense + '12'}
                  cursor="pointer"
                  hoverStyle={{ borderColor: palette.expense }}
                  pressStyle={{ opacity: 0.7 }}
                  onPress={() => {
                    if (
                      window.confirm(
                        `¿Liquidar anticipadamente «${title}»? Se dejarán de proyectar las ${plan.count - plan.paidCount} parcialidades restantes. Registra el pago real como movimiento.`
                      )
                    ) {
                      void settleInstallmentPlan(plan.transaction.id)
                    }
                  }}
                  role="button"
                  aria-label={`Liquidar ${title}`}>
                  <AppIcon name="checkmark-circle" size={14} color={palette.expense} />
                  <Text fontSize={12} fontWeight="700" color="$expense">
                    Liquidar
                  </Text>
                </XStack>
              ) : null}
            </XStack>
          </Card>
        )
      })}
    </YStack>
  )
}

function RecurringSection({
  onEdit,
  onCreate,
}: {
  onEdit: (id: string) => void
  onCreate: () => void
}) {
  const { recurringCharges, paymentMethods, updateRecurringCharge } = useData()

  if (recurringCharges.length === 0) {
    return (
      <Card>
        <YStack alignItems="center" gap="$md" padding="$xl">
          <AppIcon name="repeat" size={40} color={palette.muted} />
          <Text fontSize={14} color="$tabIconDefault" textAlign="center">
            Agrega servicios, renta o suscripciones para proyectarlos en tus
            fechas límite de pago.
          </Text>
          <Button title="Agregar compromiso" size="sm" onPress={onCreate} />
        </YStack>
      </Card>
    )
  }

  return (
    <YStack gap="$md">
      <Text {...TYPO.section} color="$text">
        Servicios y suscripciones
      </Text>
      {recurringCharges.map((charge) => {
        const method = charge.payment_method ??
          paymentMethods.find((entry) => entry.id === charge.payment_method_id) ??
          null
        const occurrence = getNextRecurringOccurrence(charge, method)
        const isCredit = method?.type === 'credit'
        return (
          <Card key={charge.id} gap="$md" opacity={charge.active ? 1 : 0.55}>
            <XStack alignItems="flex-start" gap="$md">
              <CategoryIcon
                icon={charge.category?.icon ?? 'repeat'}
                color={charge.category?.color ?? palette.warning}
                size={42}
              />
              <YStack flex={1} minWidth={0} gap={3}>
                <XStack alignItems="center" gap="$xs">
                  <Text {...TYPO.cardTitle} color="$text" numberOfLines={1} flexShrink={1}>
                    {charge.name}
                  </Text>
                  {!charge.active ? (
                    <Text fontSize={10} fontWeight="800" textTransform="uppercase" letterSpacing={0.4} color="$tabIconDefault">
                      Pausado
                    </Text>
                  ) : null}
                  {charge.is_variable_amount ? (
                    <Text fontSize={10} fontWeight="800" textTransform="uppercase" letterSpacing={0.4} color="$warning">
                      Estimado
                    </Text>
                  ) : null}
                </XStack>
                <Text fontSize={12} color="$tabIconDefault" numberOfLines={1}>
                  {charge.category?.name ?? 'Sin categoría'} · {method?.name ?? 'Sin método'} ·
                  día {charge.charge_day}
                </Text>
                <Text fontSize={11} color="$tabIconDefault">
                  {isCredit
                    ? `Se paga con el corte de ${method?.name ?? 'la tarjeta'}`
                    : 'Se proyecta en el mes natural'}
                  {occurrence
                    ? ` · próximo ${formatDateLabel(toISODate(occurrence.dueDate))}`
                    : ''}
                </Text>
              </YStack>
              <YStack alignItems="flex-end" gap={2}>
                <Text fontSize={16} fontWeight="800" color="$text">
                  {formatCurrency(charge.amount)}
                </Text>
                <Text fontSize={11} color="$tabIconDefault">
                  /{charge.frequency === 'yearly' ? 'año' : 'mes'}
                </Text>
              </YStack>
            </XStack>

            <XStack alignItems="center" gap="$sm">
              <XStack
                alignItems="center"
                gap={4}
                cursor="pointer"
                pressStyle={{ opacity: 0.7 }}
                onPress={() =>
                  void updateRecurringCharge(charge.id, { active: !charge.active })
                }
                role="button"
                aria-label={charge.active ? `Pausar ${charge.name}` : `Activar ${charge.name}`}>
                <AppIcon
                  name={charge.active ? 'checkbox' : 'square-outline'}
                  size={18}
                  color={charge.active ? palette.income : palette.muted}
                />
                <Text fontSize={12} fontWeight="600" color="$tabIconDefault">
                  {charge.active ? 'Activo' : 'Pausado'}
                </Text>
              </XStack>
              <YStack flex={1} />
              {charge.note ? (
                <Text fontSize={11} color="$tabIconDefault" numberOfLines={1} maxWidth={260}>
                  {charge.note}
                </Text>
              ) : null}
              <XStack
                height={30}
                alignItems="center"
                gap="$xs"
                paddingHorizontal="$md"
                borderRadius="$md"
                borderWidth={1}
                borderColor="$border"
                cursor="pointer"
                hoverStyle={{ borderColor: palette.primary }}
                pressStyle={{ opacity: 0.7 }}
                onPress={() => onEdit(charge.id)}
                role="button"
                aria-label={`Editar ${charge.name}`}>
                <AppIcon name="pencil-outline" size={14} color={palette.primary} />
                <Text fontSize={12} fontWeight="700" color="$primary">
                  Editar
                </Text>
              </XStack>
            </XStack>
          </Card>
        )
      })}
    </YStack>
  )
}
