import { useMemo, useState } from 'react'
import { Text, XStack, YStack } from 'tamagui'

import { Button } from '@/components/ui/Button'
import { FormError, SectionLabel, TextInput } from '@/components/ui/Field'
import { AppIcon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { palette } from '@/constants/theme'
import { CSS_TRANSITION } from '@/constants/ui'
import { PAYMENT_TYPE_OPTIONS } from '@/constants/settings'
import { useHolidays } from '@/contexts/HolidaysContext'
import { useData } from '@/hooks/useData'
import { GraceDaysType, PaymentMethod, PaymentMethodType } from '@/types'
import { resolveDueDate } from '@/utils/bankingDates'
import { nextClosingDate } from '@/utils/creditCardRecommendation'
import { formatDateLabel, toISODate } from '@/utils/format'
import { getPaymentMethodIcon } from '@/utils/paymentMethod'

const typeColor = (type: PaymentMethodType) =>
  type === 'credit' ? palette.warning : type === 'debit' ? palette.primary : palette.muted

/**
 * PaymentMethodEditorModal — alta/edición/borrado de un método de pago.
 *
 * La fecha de pago no se guarda: se deriva del corte + días de gracia.
 */
export function PaymentMethodEditorModal({
  editing,
  onClose,
}: {
  editing: PaymentMethod | null
  onClose: () => void
}) {
  const { addPaymentMethod, updatePaymentMethod, deletePaymentMethod } = useData()
  const { holidays } = useHolidays()

  const [name, setName] = useState(editing?.name ?? '')
  const [type, setType] = useState<PaymentMethodType>(editing?.type ?? 'cash')
  const [cardholderName, setCardholderName] = useState(editing?.cardholder_name ?? '')
  const [closingDay, setClosingDay] = useState(
    editing?.closing_day ? String(editing.closing_day) : ''
  )
  const [graceDays, setGraceDays] = useState(
    String(editing?.grace_days ?? 20)
  )
  const [graceType, setGraceType] = useState<GraceDaysType>(
    editing?.grace_days_type === 'business' ? 'business' : 'natural'
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsedClosing = closingDay ? parseInt(closingDay, 10) : null
  const parsedGrace = graceDays ? parseInt(graceDays, 10) : null

  const preview = useMemo(() => {
    if (
      type !== 'credit' ||
      !parsedClosing ||
      parsedClosing < 1 ||
      parsedClosing > 31
    ) {
      return null
    }
    const closingDate = nextClosingDate(new Date(), parsedClosing)
    return resolveDueDate(
      closingDate,
      {
        grace_days: parsedGrace,
        grace_days_type: graceType,
      },
      holidays
    )
  }, [type, parsedClosing, parsedGrace, graceType, holidays])

  const onSave = async () => {
    if (!name.trim()) {
      setError('Escribe un nombre para el método de pago.')
      return
    }
    if (parsedClosing !== null && (parsedClosing < 1 || parsedClosing > 31)) {
      setError('El día de corte debe estar entre 1 y 31.')
      return
    }
    if (type === 'credit') {
      if (!parsedClosing) {
        setError('Configura el día de corte de la tarjeta.')
        return
      }
      if (parsedGrace === null || parsedGrace < 0 || parsedGrace > 60) {
        setError('Los días de gracia deben estar entre 0 y 60.')
        return
      }
    }

    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: name.trim(),
        type,
        cardholder_name:
          type === 'cash' ? null : cardholderName.trim() || null,
        closing_day: type === 'credit' ? parsedClosing : null,
        grace_days: type === 'credit' ? parsedGrace ?? 20 : 20,
        grace_days_type: type === 'credit' ? graceType : ('natural' as const),
      }
      if (editing) {
        await updatePaymentMethod(editing.id, payload)
      } else {
        await addPaymentMethod(payload)
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
    if (!window.confirm('Las transacciones asociadas quedarán sin método de pago. ¿Eliminar?')) return
    setSaving(true)
    try {
      await deletePaymentMethod(editing.id)
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
      title={editing ? 'Editar método de pago' : 'Nuevo método de pago'}
      width={560}
      footer={
        <XStack gap="$md">
          {editing ? (
            <Button title="Eliminar" variant="ghost" onPress={() => void onDelete()} disabled={saving} />
          ) : null}
          <Button title="Guardar" onPress={() => void onSave()} loading={saving} flex={1} />
        </XStack>
      }>
      <YStack gap="$sm">
        <SectionLabel>Nombre</SectionLabel>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Ej. Tarjeta de Crédito"
          aria-label="Nombre del método de pago"
        />
      </YStack>

      <YStack gap="$sm">
        <SectionLabel>Tipo</SectionLabel>
        <XStack gap="$sm">
          {PAYMENT_TYPE_OPTIONS.map((option) => {
            const active = type === option.key
            const color = typeColor(option.key)
            return (
              <XStack
                key={option.key}
                flex={1}
                height={44}
                alignItems="center"
                justifyContent="center"
                gap="$xs"
                borderRadius="$md"
                borderWidth={1}
                cursor="pointer"
                pressStyle={{ opacity: 0.75 }}
                borderColor={active ? color : palette.borderStrong}
                backgroundColor={active ? color + '18' : '$card'}
                onPress={() => {
                  setType(option.key)
                  if (option.key !== 'credit') {
                    setClosingDay('')
                  }
                  if (option.key === 'cash') {
                    setCardholderName('')
                  }
                }}>
                <AppIcon name={getPaymentMethodIcon(option.key)} size={16} color={active ? color : palette.muted} />
                <Text fontSize={13} fontWeight={active ? '700' : '500'} color={active ? '$text' : '$tabIconDefault'}>
                  {option.label}
                </Text>
              </XStack>
            )
          })}
        </XStack>
      </YStack>

      {type !== 'cash' ? (
        <YStack gap="$sm">
          <SectionLabel hint="Opcional">A nombre de</SectionLabel>
          <TextInput
            value={cardholderName}
            onChangeText={setCardholderName}
            placeholder="Ej. Reyner Pérez"
            aria-label="Nombre del titular de la tarjeta"
          />
        </YStack>
      ) : null}

      {type === 'credit' ? (
        <>
          <XStack gap="$md" flexWrap="wrap">
            <YStack flex={1} minWidth={140} gap="$sm">
              <SectionLabel>Día de corte</SectionLabel>
              <TextInput
                value={closingDay}
                onChangeText={setClosingDay}
                placeholder="15"
                inputMode="numeric"
                aria-label="Día de corte"
              />
            </YStack>
            <YStack flex={1} minWidth={140} gap="$sm">
              <SectionLabel>Días de gracia</SectionLabel>
              <TextInput
                value={graceDays}
                onChangeText={setGraceDays}
                placeholder="20"
                inputMode="numeric"
                aria-label="Días de gracia"
              />
            </YStack>
          </XStack>

          <YStack gap="$sm">
            <SectionLabel>Tipo de días</SectionLabel>
            <XStack gap="$sm">
              {(
                [
                  { key: 'natural' as const, label: 'Naturales' },
                  { key: 'business' as const, label: 'Hábiles' },
                ]
              ).map((option) => {
                const active = graceType === option.key
                return (
                  <XStack
                    key={option.key}
                    flex={1}
                    height={40}
                    alignItems="center"
                    justifyContent="center"
                    borderRadius="$md"
                    borderWidth={1}
                    borderColor={active ? palette.primary : palette.borderStrong}
                    backgroundColor={active ? palette.primary + '18' : '$card'}
                    cursor="pointer"
                    pressStyle={{ opacity: 0.75 }}
                    style={{ transition: CSS_TRANSITION }}
                    onPress={() => setGraceType(option.key)}
                    role="button"
                    aria-label={`Días ${option.label}`}
                    aria-pressed={active}>
                    <Text
                      fontSize={13}
                      fontWeight="700"
                      color={active ? '$primary' : '$tabIconDefault'}>
                      {option.label}
                    </Text>
                  </XStack>
                )
              })}
            </XStack>
          </YStack>

          <YStack
            gap={4}
            padding="$md"
            borderRadius="$md"
            backgroundColor={palette.primary + '0F'}
            borderWidth={1}
            borderColor={palette.primary + '33'}>
            <XStack alignItems="center" gap="$xs">
              <AppIcon name="calendar-outline" size={15} color={palette.primary} />
              <Text fontSize={12} fontWeight="800" color="$primary">
                {preview
                  ? `Próximo pago: ${formatDateLabel(toISODate(preview.dueDate))}`
                  : 'Configura el corte y los días de gracia'}
              </Text>
            </XStack>
            {preview ? (
              <Text fontSize={11} color="$tabIconDefault">
                {preview.graceDays} días {graceType === 'business' ? 'hábiles bancarios' : 'naturales'}
                {preview.adjusted
                  ? ' · ajustado al siguiente día hábil por caer en inhábil'
                  : ''}
              </Text>
            ) : null}
          </YStack>
        </>
      ) : null}

      {error ? <FormError>{error}</FormError> : null}
    </Modal>
  )
}
