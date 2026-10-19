import { useMemo, useState } from 'react'
import { Text, XStack, YStack } from 'tamagui'

import { Button } from '@/components/ui/Button'
import { DateField } from '@/components/ui/DateField'
import { FormError, FormSection, SectionLabel, TextInput } from '@/components/ui/Field'
import { AppIcon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { SearchSelect, type SelectOption } from '@/components/ui/SearchSelect'
import { palette } from '@/constants/theme'
import { CSS_TRANSITION } from '@/constants/ui'
import { useData } from '@/hooks/useData'
import { RecurringFrequency } from '@/types'
import { formatCurrency, toISODate } from '@/utils/format'
import { getPaymentMethodIcon } from '@/utils/paymentMethod'

type Props = {
  open: boolean
  chargeId?: string
  onClose: () => void
}

/**
 * RecurringChargeFormModal — alta/edición de servicios y suscripciones.
 *
 * No crea movimientos: solo guarda la plantilla que la app proyecta en el
 * periodo de pago de la tarjeta (o en el mes natural, si es débito/efectivo).
 */
export function RecurringChargeFormModal({ open, chargeId, onClose }: Props) {
  if (!open) return null
  return (
    <RecurringChargeDialog
      key={chargeId ?? 'nuevo'}
      chargeId={chargeId}
      onClose={onClose}
    />
  )
}

function RecurringChargeDialog({
  chargeId,
  onClose,
}: {
  chargeId?: string
  onClose: () => void
}) {
  const {
    recurringCharges,
    categories,
    paymentMethods,
    addRecurringCharge,
    updateRecurringCharge,
    deleteRecurringCharge,
  } = useData()

  const editing = chargeId
    ? recurringCharges.find((charge) => charge.id === chargeId)
    : undefined

  const [name, setName] = useState(editing?.name ?? '')
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '')
  const [categoryId, setCategoryId] = useState<string | null>(
    editing?.category_id ?? null
  )
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(() => {
    if (editing) return editing.payment_method_id ?? null
    return (
      paymentMethods.find((method) => method.type === 'credit')?.id ??
      paymentMethods[0]?.id ??
      null
    )
  })
  const [frequency, setFrequency] = useState<RecurringFrequency>(
    editing?.frequency ?? 'monthly'
  )
  const [chargeDay, setChargeDay] = useState(
    editing ? String(editing.charge_day) : '1'
  )
  const [startDate, setStartDate] = useState(
    editing?.start_date ?? toISODate(new Date())
  )
  const [endDate, setEndDate] = useState(editing?.end_date ?? '')
  const [variable, setVariable] = useState(editing?.is_variable_amount ?? false)
  const [active, setActive] = useState(editing?.active ?? true)
  const [note, setNote] = useState(editing?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const categoryOptions = useMemo<SelectOption[]>(
    () =>
      categories
        .filter((category) => category.type === 'expense')
        .map((category) => ({
          id: category.id,
          label: category.name,
          icon: category.icon,
          color: category.color,
        })),
    [categories]
  )

  const paymentOptions = useMemo<SelectOption[]>(
    () =>
      paymentMethods.map((method) => ({
        id: method.id,
        label: method.name,
        icon: getPaymentMethodIcon(method.type),
        color: method.type === 'credit' ? palette.warning : palette.primary,
        hint:
          method.type === 'credit'
            ? 'Crédito · se proyecta al corte'
            : method.type === 'debit'
              ? 'Débito · mes natural'
              : 'Efectivo · mes natural',
      })),
    [paymentMethods]
  )

  const selectedMethod = paymentMethods.find((method) => method.id === paymentMethodId)
  const parsedAmount = parseFloat(amount.replace(',', '.')) || 0
  const isCredit = selectedMethod?.type === 'credit'

  const onSave = async () => {
    setError(null)
    if (!name.trim()) {
      setError('Escribe un nombre para el compromiso.')
      return
    }
    if (!parsedAmount || parsedAmount <= 0) {
      setError('Ingresa un monto estimado mayor a cero.')
      return
    }
    const day = parseInt(chargeDay, 10)
    if (!day || day < 1 || day > 31) {
      setError('El día de cobro debe estar entre 1 y 31.')
      return
    }
    if (!startDate) {
      setError('Selecciona la fecha de inicio.')
      return
    }
    if (endDate && endDate < startDate) {
      setError('La fecha de fin no puede ser anterior al inicio.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        amount: Math.round(parsedAmount * 100) / 100,
        category_id: categoryId,
        payment_method_id: paymentMethodId,
        frequency,
        charge_day: day,
        start_date: startDate,
        end_date: endDate || null,
        is_variable_amount: variable,
        active,
        note: note.trim() || null,
      }
      if (editing) {
        await updateRecurringCharge(editing.id, payload)
      } else {
        await addRecurringCharge(payload)
      }
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    if (!editing) return
    if (
      !window.confirm(
        `¿Eliminar «${editing.name}»? Dejará de proyectarse en tus periodos.`
      )
    ) {
      return
    }
    setSaving(true)
    try {
      await deleteRecurringCharge(editing.id)
      onClose()
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Editar compromiso' : 'Nuevo compromiso recurrente'}
      subtitle="Servicios, renta o suscripciones que se repiten"
      width={620}
      footer={
        <XStack gap="$md">
          {editing ? (
            <Button
              title="Eliminar"
              variant="ghost"
              onPress={() => void onDelete()}
              disabled={saving}
            />
          ) : null}
          <Button
            title={editing ? 'Guardar cambios' : 'Agregar compromiso'}
            onPress={() => void onSave()}
            loading={saving}
            flex={1}
          />
        </XStack>
      }>
      <FormSection title="Compromiso" first>
        <XStack gap="$md" flexWrap="wrap">
          <YStack flex={1} minWidth={220} gap="$sm">
            <SectionLabel>Nombre *</SectionLabel>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ej. Luz CFE, Netflix"
              autoFocus={!editing}
              aria-label="Nombre del compromiso"
            />
          </YStack>
          <YStack flex={1} minWidth={180} gap="$sm">
            <SectionLabel>Monto estimado *</SectionLabel>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              inputMode="decimal"
              aria-label="Monto estimado"
            />
          </YStack>
        </XStack>

        <XStack gap="$md" flexWrap="wrap">
          <YStack flex={1} minWidth={220} gap="$sm">
            <SectionLabel>Categoría</SectionLabel>
            <SearchSelect
              ariaLabel="Categoría del compromiso"
              leadingIcon="pricetag"
              placeholder="Sin categoría"
              searchPlaceholder="Buscar categoría…"
              emptyMessage="No hay categorías de gasto."
              options={categoryOptions}
              value={categoryId}
              onChange={setCategoryId}
            />
          </YStack>
          <YStack flex={1} minWidth={220} gap="$sm">
            <SectionLabel>Método de pago</SectionLabel>
            <SearchSelect
              ariaLabel="Método de pago del compromiso"
              leadingIcon="card-outline"
              placeholder="Seleccionar…"
              searchPlaceholder="Buscar método…"
              emptyMessage="No hay métodos de pago."
              options={paymentOptions}
              value={paymentMethodId}
              onChange={setPaymentMethodId}
            />
          </YStack>
        </XStack>

        <XStack
          alignItems="center"
          gap="$sm"
          paddingVertical="$xs"
          cursor="pointer"
          pressStyle={{ opacity: 0.7 }}
          onPress={() => setVariable((value) => !value)}
          role="button"
          aria-label="Monto variable"
          aria-pressed={variable}>
          <AppIcon
            name={variable ? 'checkbox' : 'square-outline'}
            size={22}
            color={variable ? palette.primary : palette.muted}
          />
          <YStack flex={1}>
            <Text fontSize={14} fontWeight="600" color="$text">
              El monto varía cada mes
            </Text>
            <Text fontSize={12} color="$tabIconDefault">
              Se mostrará como estimado (luz, agua, gas…)
            </Text>
          </YStack>
        </XStack>
      </FormSection>

      <FormSection title="Frecuencia y fechas">
        <XStack gap="$sm">
          {(
            [
              { key: 'monthly' as const, label: 'Mensual' },
              { key: 'yearly' as const, label: 'Anual' },
            ]
          ).map((option) => {
            const isActive = frequency === option.key
            return (
              <XStack
                key={option.key}
                flex={1}
                height={40}
                alignItems="center"
                justifyContent="center"
                borderRadius="$md"
                borderWidth={1}
                borderColor={isActive ? palette.primary : palette.borderStrong}
                backgroundColor={isActive ? palette.primary + '18' : '$card'}
                cursor="pointer"
                pressStyle={{ opacity: 0.75 }}
                style={{ transition: CSS_TRANSITION }}
                onPress={() => setFrequency(option.key)}
                role="button"
                aria-label={`Frecuencia ${option.label}`}
                aria-pressed={isActive}>
                <Text
                  fontSize={13}
                  fontWeight="700"
                  color={isActive ? '$primary' : '$tabIconDefault'}>
                  {option.label}
                </Text>
              </XStack>
            )
          })}
        </XStack>

        <XStack gap="$md" flexWrap="wrap">
          <YStack width={150} gap="$sm">
            <SectionLabel>Día de cobro *</SectionLabel>
            <TextInput
              value={chargeDay}
              onChangeText={setChargeDay}
              placeholder="1"
              inputMode="numeric"
              aria-label="Día de cobro"
            />
          </YStack>
          <YStack flex={1} minWidth={160} gap="$sm">
            <SectionLabel>Inicio *</SectionLabel>
            <DateField value={startDate} onChange={setStartDate} ariaLabel="Inicio" />
          </YStack>
          <YStack flex={1} minWidth={160} gap="$sm">
            <SectionLabel>Fin (opcional)</SectionLabel>
            <DateField value={endDate} onChange={setEndDate} ariaLabel="Fin" />
          </YStack>
        </XStack>

        {isCredit ? (
          <YStack
            padding="$md"
            borderRadius="$md"
            backgroundColor={palette.warning + '12'}
            borderWidth={1}
            borderColor={palette.warning + '33'}
            gap={4}>
            <XStack alignItems="center" gap="$xs">
              <AppIcon name="information-circle" size={14} color={palette.warning} />
              <Text fontSize={12} fontWeight="800" color="$warning">
                Se proyecta en el periodo de la tarjeta
              </Text>
            </XStack>
            <Text fontSize={11} color="$tabIconDefault">
              El cobro del día {chargeDay} cae en el corte de{' '}
              {selectedMethod?.name ?? 'la tarjeta'} y se paga en su fecha límite.
              {parsedAmount > 0
                ? ` Estimado: ${formatCurrency(parsedAmount)}.`
                : ''}
            </Text>
          </YStack>
        ) : (
          <Text fontSize={11} color="$tabIconDefault">
            Sin tarjeta de crédito se proyecta en el mes natural (día {chargeDay}).
          </Text>
        )}
      </FormSection>

      <FormSection title="Estado y nota">
        <XStack
          alignItems="center"
          gap="$sm"
          cursor="pointer"
          pressStyle={{ opacity: 0.7 }}
          onPress={() => setActive((value) => !value)}
          role="button"
          aria-label="Compromiso activo"
          aria-pressed={active}>
          <AppIcon
            name={active ? 'checkbox' : 'square-outline'}
            size={22}
            color={active ? palette.income : palette.muted}
          />
          <YStack flex={1}>
            <Text fontSize={14} fontWeight="600" color="$text">
              Compromiso activo
            </Text>
            <Text fontSize={12} color="$tabIconDefault">
              Desactívalo para pausar las proyecciones sin borrarlo
            </Text>
          </YStack>
        </XStack>

        <YStack gap="$sm">
          <SectionLabel>Nota (opcional)</SectionLabel>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Ej. Se cobra vía cargo automático"
            aria-label="Nota del compromiso"
          />
        </YStack>
      </FormSection>

      {error ? <FormError>{error}</FormError> : null}
    </Modal>
  )
}
