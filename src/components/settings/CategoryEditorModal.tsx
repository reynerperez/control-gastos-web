import { useState } from 'react'
import { Text, XStack, YStack } from 'tamagui'

import { Button } from '@/components/ui/Button'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { FormError, SectionLabel, TextInput } from '@/components/ui/Field'
import { AppIcon, ICON_OPTIONS } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { palette } from '@/constants/theme'
import { COLOR_OPTIONS } from '@/constants/settings'
import { useData } from '@/hooks/useData'
import { Category, TransactionType } from '@/types'

type Props = {
  /** Categoría a editar (null si se está creando) */
  editing: Category | null
  /** Tipo de la categoría nueva (null si se está editando) */
  creating: TransactionType | null
  onClose: () => void
}

/**
 * CategoryEditorModal — alta/edición/borrado de una categoría.
 * Se monta con `key` desde la pantalla, así el estado inicial es correcto.
 */
export function CategoryEditorModal({ editing, creating, onClose }: Props) {
  const { addCategory, updateCategory, deleteCategory } = useData()

  const [name, setName] = useState(editing?.name ?? '')
  const [icon, setIcon] = useState(editing?.icon ?? ICON_OPTIONS[0])
  const [color, setColor] = useState(editing?.color ?? COLOR_OPTIONS[0])
  const [requiresBreakdown, setRequiresBreakdown] = useState(editing?.requires_breakdown ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const type: TransactionType = editing?.type ?? creating ?? 'expense'

  const onSave = async () => {
    if (!name.trim()) {
      setError('Escribe un nombre para la categoría.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (editing) {
        await updateCategory(editing.id, {
          name: name.trim(),
          icon,
          color,
          requires_breakdown: requiresBreakdown,
        })
      } else {
        await addCategory({
          name: name.trim(),
          icon,
          color,
          type,
          requires_breakdown: requiresBreakdown,
        })
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
      !window.confirm('Los movimientos asociados quedarán sin categoría. ¿Eliminar la categoría?')
    ) {
      return
    }
    setSaving(true)
    try {
      await deleteCategory(editing.id)
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
      title={editing ? 'Editar categoría' : 'Nueva categoría'}
      subtitle={type === 'expense' ? 'Categoría de gastos' : 'Categoría de ingresos'}
      width={560}
      footer={
        <XStack gap="$md">
          {editing ? (
            <Button title="Eliminar" variant="ghost" onPress={() => void onDelete()} disabled={saving} />
          ) : null}
          <Button title="Guardar" onPress={() => void onSave()} loading={saving} flex={1} />
        </XStack>
      }>
      <YStack alignItems="center" paddingVertical="$sm">
        <CategoryIcon icon={icon} color={color} size={56} />
      </YStack>

      <YStack gap="$sm">
        <SectionLabel>Nombre</SectionLabel>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Nombre de la categoría"
          aria-label="Nombre de la categoría"
        />
      </YStack>

      <YStack gap="$sm">
        <SectionLabel>Color</SectionLabel>
        <XStack flexWrap="wrap" gap="$sm">
          {COLOR_OPTIONS.map((option) => (
            <YStack
              key={option}
              width={34}
              height={34}
              borderRadius="$full"
              backgroundColor={option}
              borderWidth={color === option ? 3 : 0}
              borderColor={palette.text}
              cursor="pointer"
              pressStyle={{ opacity: 0.7 }}
              onPress={() => setColor(option)}
              aria-label={`Color ${option}`}
            />
          ))}
        </XStack>
      </YStack>

      <YStack gap="$sm">
        <SectionLabel>Ícono</SectionLabel>
        <XStack flexWrap="wrap" gap="$sm">
          {ICON_OPTIONS.map((option) => {
            const active = icon === option
            return (
              <XStack
                key={option}
                width={44}
                height={44}
                alignItems="center"
                justifyContent="center"
                borderRadius="$md"
                borderWidth={1}
                cursor="pointer"
                pressStyle={{ opacity: 0.7 }}
                backgroundColor={active ? color + '22' : '$background'}
                borderColor={active ? color : palette.borderStrong}
                onPress={() => setIcon(option)}
                aria-label={`Ícono ${option}`}>
                <AppIcon name={option} size={22} color={active ? color : palette.muted} />
              </XStack>
            )
          })}
        </XStack>
      </YStack>

      {type === 'expense' ? (
        <XStack
          alignItems="center"
          gap="$md"
          paddingVertical="$sm"
          cursor="pointer"
          pressStyle={{ opacity: 0.7 }}
          onPress={() => setRequiresBreakdown((value) => !value)}>
          <AppIcon
            name={requiresBreakdown ? 'checkbox' : 'square-outline'}
            size={22}
            color={requiresBreakdown ? palette.primary : palette.muted}
          />
          <YStack flex={1}>
            <Text fontSize={15} fontWeight="600" color="$text">
              Requiere desglose
            </Text>
            <Text fontSize={12} color="$tabIconDefault">
              Preselecciona el desglose al elegir esta categoría
            </Text>
          </YStack>
        </XStack>
      ) : null}

      {error ? <FormError>{error}</FormError> : null}
    </Modal>
  )
}
