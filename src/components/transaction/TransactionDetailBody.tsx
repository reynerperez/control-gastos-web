import { useState } from 'react'
import { Text, XStack, YStack } from 'tamagui'

import { BorderedView } from '@/components/ui/BorderedStack'
import { Card } from '@/components/ui/Card'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { AppIcon } from '@/components/ui/Icon'
import type { SelectOption } from '@/components/ui/SearchSelect'
import { palette } from '@/constants/theme'
import { inlineFocusLine } from '@/constants/ui'
import { useAuth } from '@/contexts/AuthContext'
import { useHolidays } from '@/contexts/HolidaysContext'
import { useModals } from '@/contexts/ModalsContext'
import { useData } from '@/hooks/useData'
import type { TransactionEditController } from '@/hooks/useTransactionEdit'
import type {
  PaymentMethodType,
  Transaction,
} from '@/types'
import { formatCurrency } from '@/utils/format'
import { getInstallmentPlan } from '@/utils/installments'
import { getPaymentMethodIcon } from '@/utils/paymentMethod'
import { getTransactionAuthorName } from '@/utils/transactionAuthor'
import {
  InlineAmountField,
  InlineDateField,
  InlineNoteField,
  InlineRow,
  InlineSelectField,
  InlineTextField,
  InlineTypeField,
} from '@/components/transaction/InlineFields'
import { activateInlineField } from '@/utils/inlineFocus'

const NO_CATEGORY_ID = '__sin_categoria__'

const paymentMethodColor = (type: PaymentMethodType) =>
  type === 'credit'
    ? palette.warning
    : type === 'debit'
      ? palette.primary
      : palette.muted

const paymentMethodLabel = (type: PaymentMethodType) =>
  type === 'credit' ? 'Crédito' : type === 'debit' ? 'Débito' : 'Efectivo'

/**
 * Cuerpo del detalle, compartido por la página y el side peek.
 *
 * Los controles se renderizan siempre. En modo bloqueado son `readOnly` y no
 * muestran hover; al desbloquear siguen ocupando exactamente el mismo espacio.
 */
export function TransactionDetailBody({
  transaction,
  edit,
}: {
  transaction: Transaction
  edit: TransactionEditController
}) {
  const { user } = useAuth()
  const { holidays } = useHolidays()
  const { categories, paymentMethods, householdMembers } = useData()
  const { openBreakdown } = useModals()
  const [openInlineSelect, setOpenInlineSelect] = useState<
    'category' | 'paymentMethod' | null
  >(null)

  const isPending = transaction.breakdown_status === 'pending'
  const primary = transaction.details?.[0]
  const details = transaction.details ?? []
  const hasBreakdown = !isPending && details.length > 1
  const plan = getInstallmentPlan(
    transaction,
    transaction.payment_method,
    new Date(),
    holidays
  )
  const authorName = getTransactionAuthorName(
    transaction.user_id,
    user,
    householdMembers
  )

  const type = transaction.type
  const selectedMethod =
    paymentMethods.find((method) => method.id === edit.draft.paymentMethodId) ??
    null
  const selectedCategory =
    categories.find((category) => category.id === edit.draft.categoryId) ?? null

  const categoryOptions: SelectOption[] = [
    {
      id: NO_CATEGORY_ID,
      label: 'Sin categoría',
      icon: 'pricetag',
      color: palette.muted,
    },
    ...categories
      .filter((category) => category.type === type)
      .map((category) => ({
        id: category.id,
        label: category.name,
        icon: category.icon,
        color: category.color,
      })),
  ]

  const paymentOptions: SelectOption[] = paymentMethods.map((method) => ({
    id: method.id,
    label: method.name,
    icon: getPaymentMethodIcon(method.type),
    color: paymentMethodColor(method.type),
    hint: paymentMethodLabel(method.type),
  }))

  const setCategory = (value: string | null) => {
    edit.setField('categoryId', value === NO_CATEGORY_ID ? null : value)
  }

  const openBreakdownSafely = () => {
    if (edit.saving) return
    if (edit.unlocked) {
      if (
        edit.dirty &&
        !window.confirm('¿Descartar los cambios sin guardar antes de editar el desglose?')
      ) {
        return
      }
      edit.cancel()
    }
    openBreakdown(transaction.id)
  }

  return (
    <YStack gap="$lg">
      {/* Encabezado con monto, tipo y fecha */}
      <Card gap="$sm">
        <YStack alignItems="center" gap="$sm" paddingVertical="$md">
          <InlineTypeField value={type} />

          <InlineAmountField
            value={edit.draft.amount}
            onChange={(value) => edit.setField('amount', value)}
            editable={edit.unlocked && edit.fields.amount}
            type={type}
          />

          <InlineDateField
            value={edit.draft.date}
            onChange={(value) => edit.setField('date', value)}
            editable={edit.unlocked && edit.fields.date}
          />

          {isPending ? (
            <XStack alignItems="center" gap="$xs">
              <AppIcon name="time" size={14} color="#F9CD62" />
              <Text
                fontSize={12}
                fontWeight="800"
                textTransform="uppercase"
                letterSpacing={0.5}
                color="$warning">
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
                  ? formatCurrency(plan.nextInstallment.amount) +
                    ' · ' +
                    plan.nextInstallment.dueDate.toLocaleDateString('es-MX', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : plan.settled
                    ? 'Liquidado'
                    : 'Concluido'
              }
            />
          </XStack>
          <Text fontSize={11} color="$tabIconDefault">
            Las parcialidades se proyectan automáticamente en el periodo de pago de la
            tarjeta. El total de la compra no se cuenta completo en el mes. El plan no se
            edita aquí: elimina el movimiento si necesitas recrearlo.
          </Text>
        </BorderedView>
      ) : null}

      {/* Información general */}
      <BorderedView borderRadius="$lg" backgroundColor="$card" overflow="hidden">
        <InlineRow
          icon="pricetag"
          label="Categoría"
          first
          active={edit.unlocked && openInlineSelect === 'category'}
          editable={edit.unlocked && edit.fields.category}
          cursor="pointer"
          iconNode={
            <CategoryIcon
              icon={selectedCategory?.icon ?? 'pricetag'}
              color={selectedCategory?.color ?? palette.muted}
              size={32}
            />
          }>
          <InlineSelectField
            options={categoryOptions}
            value={edit.draft.categoryId}
            onChange={setCategory}
            placeholder="Sin categoría"
            ariaLabel="Categoría"
            emptyMessage="No hay categorías para este tipo."
            leadingIcon="pricetag"
            editable={edit.unlocked && edit.fields.category}
            onOpenChange={(open) =>
              setOpenInlineSelect(open ? 'category' : null)
            }
          />
        </InlineRow>

        <InlineRow
          icon="storefront-outline"
          label="Comercio"
          editable={edit.unlocked}
          cursor="text">
          <InlineTextField
            value={edit.draft.merchant}
            onChange={(value) => edit.setField('merchant', value)}
            placeholder="Sin comercio"
            ariaLabel="Comercio"
            editable={edit.unlocked}
          />
        </InlineRow>

        {edit.fields.description || primary?.description ? (
          <InlineRow
            icon="text-outline"
            label="Concepto"
            editable={edit.unlocked && edit.fields.description}
            cursor="text">
            <InlineTextField
              value={edit.draft.description}
              onChange={(value) => edit.setField('description', value)}
              placeholder="Sin concepto"
              ariaLabel="Concepto"
              editable={edit.unlocked && edit.fields.description}
            />
          </InlineRow>
        ) : null}

        <InlineRow
          icon={getPaymentMethodIcon(selectedMethod?.type ?? 'cash')}
          label="Método de pago"
          active={edit.unlocked && openInlineSelect === 'paymentMethod'}
          editable={edit.unlocked && edit.fields.paymentMethod}
          cursor="pointer"
          iconNode={
            <CategoryIcon
              icon={getPaymentMethodIcon(selectedMethod?.type ?? 'cash')}
              color={paymentMethodColor(selectedMethod?.type ?? 'cash')}
              size={32}
            />
          }>
          <InlineSelectField
            options={paymentOptions}
            value={edit.draft.paymentMethodId}
            onChange={(value) => edit.setField('paymentMethodId', value)}
            placeholder="Sin método"
            ariaLabel="Método de pago"
            emptyMessage="No hay métodos de pago."
            leadingIcon="card-outline"
            editable={edit.unlocked && edit.fields.paymentMethod}
            onOpenChange={(open) =>
              setOpenInlineSelect(open ? 'paymentMethod' : null)
            }
          />
        </InlineRow>

        <InfoRow
          icon="person-outline"
          label="Registrado por"
          value={authorName}
          isLast
        />
      </BorderedView>

      {/* Nota: siempre visible para que desbloquear no agregue una fila */}
      <BorderedView borderRadius="$lg" backgroundColor="$card" padding="$lg">
        <YStack
          className={edit.unlocked ? 'inline-field is-editable' : 'inline-field'}
          gap="$xs"
          borderRadius="$md"
          padding="$xs"
          style={{ transition: 'background-color 160ms ease' }}
          hoverStyle={edit.unlocked ? { backgroundColor: '$surfaceHover' } : undefined}
          focusWithinStyle={
            edit.unlocked
              ? { backgroundColor: '$surfaceHover', ...inlineFocusLine }
              : undefined
          }
          onPress={edit.unlocked ? activateInlineField : undefined}>
          <XStack alignItems="center" gap="$xs">
            <AppIcon
              name="chatbubble-ellipses-outline"
              size={16}
              color={palette.muted}
            />
            <Text fontSize={13} fontWeight="700" color="$tabIconDefault">
              Nota
            </Text>
          </XStack>
          <InlineNoteField
            value={edit.draft.note}
            onChange={(value) => edit.setField('note', value)}
            editable={edit.unlocked}
          />
        </YStack>
      </BorderedView>

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
                onPress={openBreakdownSafely}>
                Desglosar
              </Text>
            ) : (
              <Text
                fontSize={13}
                fontWeight="800"
                color="$primary"
                cursor="pointer"
                pressStyle={{ opacity: 0.7 }}
                onPress={openBreakdownSafely}>
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
}: {
  icon: string
  label: string
  value: string
  isLast?: boolean
}) {
  return (
    <XStack
      alignItems="center"
      gap="$md"
      minHeight={64}
      paddingHorizontal="$lg"
      paddingVertical="$sm"
      borderBottomWidth={isLast ? 0 : 1}
      borderBottomColor="$border">
      <YStack
        width={32}
        height={32}
        borderRadius="$full"
        alignItems="center"
        justifyContent="center"
        backgroundColor="$background">
        <AppIcon name={icon} size={16} color={palette.muted} />
      </YStack>
      <YStack flex={1} minWidth={0}>
        <Text fontSize={12} color="$tabIconDefault">
          {label}
        </Text>
        <Text
          fontSize={15}
          fontWeight="600"
          color="$text"
          numberOfLines={1}
          style={{ userSelect: 'text' }}>
          {value}
        </Text>
      </YStack>
    </XStack>
  )
}
