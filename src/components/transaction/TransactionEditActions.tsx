import { Text, XStack, YStack } from 'tamagui'

import { Button } from '@/components/ui/Button'
import { FormError } from '@/components/ui/Field'
import type { TransactionEditController } from '@/hooks/useTransactionEdit'

/**
 * Barra de acciones del modo edición. Vive fuera del scroll (footer del peek
 * o barra sticky de la página) para que aparecer no empuje el contenido.
 */
export function TransactionEditActions({
  edit,
}: {
  edit: TransactionEditController
}) {
  return (
    <YStack width="100%" gap="$sm">
      {edit.error ? (
        <FormError>{edit.error}</FormError>
      ) : edit.dirty ? (
        <Text fontSize={12} color="$tabIconDefault">
          Tienes cambios sin guardar.
        </Text>
      ) : null}
      <XStack gap="$sm" flexWrap="wrap">
        <Button
          title="Descartar"
          variant="secondary"
          size="sm"
          onPress={edit.cancel}
          disabled={edit.saving}
          flex={1}
        />
        <Button
          title="Guardar cambios"
          size="sm"
          onPress={() => void edit.save()}
          loading={edit.saving}
          disabled={!edit.dirty || edit.saving}
          flex={1}
        />
      </XStack>
    </YStack>
  )
}
