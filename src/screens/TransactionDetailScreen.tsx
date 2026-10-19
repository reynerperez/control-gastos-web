import { useNavigate, useParams } from 'react-router-dom'
import { Text, XStack, YStack } from 'tamagui'

import { Button } from '@/components/ui/Button'
import { BorderedView } from '@/components/ui/BorderedStack'
import { Card } from '@/components/ui/Card'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { AppIcon } from '@/components/ui/Icon'
import { palette } from '@/constants/theme'
import { useAuth } from '@/contexts/AuthContext'
import { useHolidays } from '@/contexts/HolidaysContext'
import { useModals } from '@/contexts/ModalsContext'
import { useData } from '@/hooks/useData'
import { formatCurrency, formatDateLabel, toISODate } from '@/utils/format'
import { getInstallmentPlan } from '@/utils/installments'
import { getPaymentMethodIcon } from '@/utils/paymentMethod'
import { getUserDisplayName } from '@/utils/user'

/**
 * Detalle del movimiento — equivale a `app/transaction-detail.tsx`:
 * toda la información del registro (incluida la ubicación) y acciones
 * de editar / eliminar.
 */
export default function TransactionDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { holidays } = useHolidays()
  const { transactions, deleteTransaction } = useData()
  const { openTransactionForm, openBreakdown } = useModals()

  const transaction = id ? transactions.find((item) => item.id === id) : undefined

  if (!transaction) {
    return (
      <Card>
        <YStack alignItems="center" gap="$md" padding="$xl">
          <AppIcon name="alert-circle-outline" size={44} color={palette.muted} />
          <Text color="$tabIconDefault" textAlign="center">
            Movimiento no encontrado. Puede que ya se haya eliminado.
          </Text>
          <Button title="Volver a Movimientos" onPress={() => navigate('/movimientos')} />
        </YStack>
      </Card>
    )
  }

  const isIncome = transaction.type === 'income'
  const isPending = transaction.breakdown_status === 'pending'
  const paymentMethod = transaction.payment_method
  const details = transaction.details ?? []
  const primary = details[0]
  const hasBreakdown = !isPending && details.length > 1
  const plan = getInstallmentPlan(transaction, paymentMethod, new Date(), holidays)

  const onDelete = async () => {
    if (!window.confirm('¿Eliminar este movimiento? Esta acción no se puede deshacer.')) return
    await deleteTransaction(transaction.id)
    navigate('/movimientos')
  }

  return (
    <YStack gap="$lg">
      {/* Encabezado con monto */}
      <Card gap="$sm">
        <XStack justifyContent="space-between" alignItems="flex-start">
          <Button title="← Volver" variant="secondary" size="sm" onPress={() => navigate('/movimientos')} />
          <XStack gap="$sm">
            <Button title="Editar" variant="secondary" size="sm" onPress={() => openTransactionForm(transaction.id)} />
            <Button title="Eliminar" variant="danger" size="sm" onPress={() => void onDelete()} />
          </XStack>
        </XStack>

        <YStack alignItems="center" gap="$sm" paddingVertical="$md">
          <XStack
            paddingHorizontal="$md"
            paddingVertical="$xs"
            borderRadius="$full"
            backgroundColor={isIncome ? '$incomeLight' : '$expenseLight'}>
            <Text
              fontSize={12}
              fontWeight="800"
              textTransform="uppercase"
              letterSpacing={0.5}
              color={isIncome ? '$income' : '$expense'}>
              {isIncome ? 'Ingreso' : 'Gasto'}
            </Text>
          </XStack>
          <Text fontSize={42} fontWeight="800" color={isIncome ? '$income' : '$expense'}>
            {isIncome ? '+' : '-'}
            {formatCurrency(transaction.amount)}
          </Text>
          <Text fontSize={14} color="$tabIconDefault">
            {formatDateLabel(transaction.date)}
          </Text>
          {isPending ? (
            <XStack alignItems="center" gap="$xs">
              <AppIcon name="time" size={14} color="#F9CD62" />
              <Text fontSize={12} fontWeight="800" textTransform="uppercase" letterSpacing={0.5} color="$warning">
                Pendiente de desglosar
              </Text>
            </XStack>
          ) : null}
          {plan ? (
            <XStack
              alignItems="center"
              gap="$xs"
              paddingHorizontal="$md"
              paddingVertical="$xs"
              borderRadius="$full"
              backgroundColor={palette.primary + '18'}
              borderWidth={1}
              borderColor={palette.primary + '44'}>
              <AppIcon name="card" size={13} color={palette.primary} />
              <Text fontSize={11} fontWeight="800" color="$primary">
                Compra a {plan.count} MSI · {plan.paidCount}/{plan.count} pagadas
              </Text>
            </XStack>
          ) : null}
        </YStack>
      </Card>

      {/* Plan de Meses Sin Intereses */}
      {plan ? (
        <BorderedView borderRadius="$lg" backgroundColor="$card" padding="$lg" gap="$md">
          <XStack alignItems="center" gap="$xs">
            <AppIcon name="card" size={16} color={palette.primary} />
            <Text fontSize={13} fontWeight="700" color="$tabIconDefault">
              Plan de Meses Sin Intereses
            </Text>
          </XStack>
          <XStack flexWrap="wrap" gap="$lg">
            <SummaryStat
              label="Parcialidad mensual"
              value={formatCurrency(plan.installments[0]?.amount ?? 0)}
            />
            <SummaryStat
              label="Saldo restante"
              value={formatCurrency(plan.remainingAmount)}
              color={plan.remainingAmount > 0 ? palette.expense : palette.income}
            />
            <SummaryStat
              label="Próximo pago"
              value={
                plan.nextInstallment
                  ? formatDateLabel(toISODate(plan.nextInstallment.dueDate))
                  : plan.settled
                    ? 'Liquidado'
                    : 'Concluido'
              }
            />
          </XStack>
          <Text fontSize={11} color="$tabIconDefault">
            Las parcialidades se proyectan automáticamente en el periodo de pago de la
            tarjeta. El total de la compra no se cuenta completo en el mes.
          </Text>
        </BorderedView>
      ) : null}

      {/* Información general */}
      <BorderedView borderRadius="$lg" backgroundColor="$card" overflow="hidden">
        <InfoRow
          icon={primary?.category?.icon ?? (isIncome ? 'cash' : 'pricetag')}
          label="Categoría"
          value={primary?.category?.name ?? (isIncome ? 'Ingreso' : 'Gasto')}
          iconNode={
            primary?.category ? (
              <CategoryIcon icon={primary.category.icon} color={primary.category.color} size={32} />
            ) : undefined
          }
        />
        {transaction.merchant ? (
          <InfoRow icon="storefront-outline" label="Comercio" value={transaction.merchant} />
        ) : null}
        {primary?.description ? (
          <InfoRow icon="text-outline" label="Concepto" value={primary.description} />
        ) : null}
        {paymentMethod ? (
          <InfoRow
            icon={getPaymentMethodIcon(paymentMethod.type)}
            label="Método de pago"
            value={paymentMethod.name}
          />
        ) : null}
        <InfoRow icon="person-outline" label="Registrado por" value={getUserDisplayName(user)} isLast />
      </BorderedView>

      {/* Nota */}
      {transaction.note ? (
        <BorderedView borderRadius="$lg" backgroundColor="$card" padding="$lg" gap="$xs">
          <XStack alignItems="center" gap="$xs">
            <AppIcon name="chatbubble-ellipses-outline" size={16} color={palette.muted} />
            <Text fontSize={13} fontWeight="700" color="$tabIconDefault">
              Nota
            </Text>
          </XStack>
          <Text fontSize={15} color="$text">
            {transaction.note}
          </Text>
        </BorderedView>
      ) : null}

      {/* Desglose */}
      {hasBreakdown || isPending ? (
        <BorderedView borderRadius="$lg" backgroundColor="$card" padding="$lg" gap="$md">
          <XStack alignItems="center" justifyContent="space-between">
            <XStack alignItems="center" gap="$xs">
              <AppIcon name="receipt-outline" size={16} color={palette.muted} />
              <Text fontSize={13} fontWeight="700" color="$tabIconDefault">
                Desglose ({details.length} {details.length === 1 ? 'ítem' : 'ítems'})
              </Text>
            </XStack>
            {isPending ? (
              <Text
                fontSize={13}
                fontWeight="800"
                color="$warning"
                cursor="pointer"
                pressStyle={{ opacity: 0.7 }}
                onPress={() => openBreakdown(transaction.id)}>
                Desglosar
              </Text>
            ) : (
              <Text
                fontSize={13}
                fontWeight="800"
                color="$primary"
                cursor="pointer"
                pressStyle={{ opacity: 0.7 }}
                onPress={() => openBreakdown(transaction.id)}>
                Editar ítems
              </Text>
            )}
          </XStack>

          {hasBreakdown
            ? details.map((detail) => (
                <XStack key={detail.id} alignItems="center" gap="$md">
                  <CategoryIcon
                    icon={detail.category?.icon ?? 'pricetag'}
                    color={detail.category?.color ?? palette.muted}
                    size={28}
                  />
                  <YStack flex={1} minWidth={0}>
                    <Text fontSize={14} fontWeight="600" color="$text" numberOfLines={1}>
                      {detail.description || detail.category?.name || 'Ítem'}
                    </Text>
                    <Text fontSize={12} color="$tabIconDefault">
                      {detail.quantity} × {formatCurrency(detail.unit_price)}
                    </Text>
                  </YStack>
                  <Text fontSize={14} fontWeight="700" color="$text">
                    {formatCurrency(detail.quantity * detail.unit_price)}
                  </Text>
                </XStack>
              ))
            : null}
        </BorderedView>
      ) : null}

      {/* Ubicación */}
      {transaction.latitude != null && transaction.longitude != null ? (
        <BorderedView borderRadius="$lg" backgroundColor="$card" padding="$lg" gap="$sm">
          <XStack alignItems="center" gap="$xs">
            <AppIcon name="location-outline" size={16} color={palette.muted} />
            <Text fontSize={13} fontWeight="700" color="$tabIconDefault">
              Ubicación
            </Text>
          </XStack>
          <XStack alignItems="center" justifyContent="space-between" gap="$md">
            <YStack flex={1}>
              <Text fontSize={14} color="$text">
                {transaction.latitude.toFixed(5)}, {transaction.longitude.toFixed(5)}
              </Text>
              <Text fontSize={12} color="$tabIconDefault">
                Dónde se registró el movimiento
              </Text>
            </YStack>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${transaction.latitude},${transaction.longitude}`}
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: 'none' }}>
              <XStack
                alignItems="center"
                gap="$xs"
                paddingHorizontal="$md"
                paddingVertical="$sm"
                borderRadius="$full"
                borderWidth={1}
                borderColor="$border"
                backgroundColor="$background"
                cursor="pointer"
                hoverStyle={{ borderColor: palette.primary }}>
                <AppIcon name="map-outline" size={16} color={palette.primary} />
                <Text fontSize={13} fontWeight="700" color="$primary">
                  Ver en mapa
                </Text>
              </XStack>
            </a>
          </XStack>
        </BorderedView>
      ) : null}
    </YStack>
  )
}

function SummaryStat({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <YStack flex={1} minWidth={130} gap={2}>
      <Text fontSize={11} color="$tabIconDefault">
        {label}
      </Text>
      <Text fontSize={15} fontWeight="800" color={color ?? '$text'}>
        {value}
      </Text>
    </YStack>
  )
}

function InfoRow({
  icon,
  label,
  value,
  isLast = false,
  iconNode,
}: {
  icon: string
  label: string
  value: string
  isLast?: boolean
  iconNode?: React.ReactNode
}) {
  return (
    <XStack
      alignItems="center"
      gap="$md"
      padding="$lg"
      borderBottomWidth={isLast ? 0 : 1}
      borderBottomColor="$border">
      {iconNode ?? (
        <YStack
          width={32}
          height={32}
          borderRadius="$full"
          alignItems="center"
          justifyContent="center"
          backgroundColor="$background">
          <AppIcon name={icon} size={16} color={palette.muted} />
        </YStack>
      )}
      <YStack flex={1} minWidth={0}>
        <Text fontSize={12} color="$tabIconDefault">
          {label}
        </Text>
        <Text fontSize={15} fontWeight="600" color="$text" numberOfLines={1}>
          {value}
        </Text>
      </YStack>
    </XStack>
  )
}
