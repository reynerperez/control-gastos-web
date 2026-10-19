import { useState } from 'react'
import { Text, XStack, YStack } from 'tamagui'

import { Button } from '@/components/ui/Button'
import { FormError, SectionLabel, TextInput } from '@/components/ui/Field'
import { AppIcon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { palette } from '@/constants/theme'
import { PAYMENT_TYPE_OPTIONS } from '@/constants/settings'
import { useData } from '@/hooks/useData'
import { PaymentMethod, PaymentMethodType } from '@/types'
import { getPaymentMethodIcon } from '@/utils/paymentMethod'

const typeColor = (type: PaymentMethodType) =>
  type === 'credit' ? palette.warning : type === 'debit' ? palette.primary : palette.muted

/**
 * PaymentMethodEditorModal — alta/edición/borrado de un método de pago.
 * Se monta con `key` desde la pantalla para inicializar bien el estado.
 */
export function PaymentMethodEditorModal({
  editing,
  onClose,
}: {
  editing: PaymentMethod | null
  onClose: () => void
}) {
  const { addPaymentMethod, updatePaymentMethod, deletePaymentMethod } = useData()

  const [name, setName] = useState(editing?.name ?? '')
  const [type, setType] = useState<PaymentMethodType>(editing?.type ?? 'cash')
  const [closingDay, setClosingDay] = useState(editing?.closing_day ? String(editing.closing_day) : '')
  const [dueDay, setDueDay] = useState(editing?.due_day ? String(editing.due_day) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSave = async () => {
    if (!name.trim()) {
      setError('Escribe un nombre para el método de pago.')
      return
    }
    const parsedClosing = closingDay ? parseInt(closingDay, 10) : null
    const parsedDue = dueDay ? parseInt(dueDay, 10) : null
    if (parsedClosing !== null && (parsedClosing < 1 || parsedClosing > 31)) {
      setError('El día de corte debe estar entre 1 y 31.')
      return
    }
    if (parsedDue !== null && (parsedDue < 1 || parsedDue > 31)) {
      setError('El día límite de pago debe estar entre 1 y 31.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: name.trim(),
        type,
        closing_day: type === 'credit' ? parsedClosing : null,
        due_day: type === 'credit' ? parsedDue : null,
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
      width={520}
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
                    setDueDay('')
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

      {type === 'credit' ? (
        <XStack gap="$md">
          <YStack flex={1} gap="$sm">
            <SectionLabel>Día de corte</SectionLabel>
            <TextInput
              value={closingDay}
              onChangeText={setClosingDay}
              placeholder="15"
              inputMode="numeric"
              aria-label="Día de corte"
            />
          </YStack>
          <YStack flex={1} gap="$sm">
            <SectionLabel>Día límite de pago</SectionLabel>
            <TextInput
              value={dueDay}
              onChangeText={setDueDay}
              placeholder="5"
              inputMode="numeric"
              aria-label="Día límite de pago"
            />
          </YStack>
        </XStack>
      ) : null}

      {error ? <FormError>{error}</FormError> : null}
    </Modal>
  )
}
