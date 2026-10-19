import { Text, XStack } from 'tamagui'

import { AppIcon } from '@/components/ui/Icon'
import { palette } from '@/constants/theme'

/** Enlace «volver» usado en las subpáginas de Ajustes */
export function BackLink({ label = 'Ajustes', onPress }: { label?: string; onPress: () => void }) {
  return (
    <XStack
      alignSelf="flex-start"
      alignItems="center"
      gap="$xs"
      paddingVertical="$xs"
      cursor="pointer"
      pressStyle={{ opacity: 0.7 }}
      onPress={onPress}
      role="button"
      aria-label={`Volver a ${label}`}>
      <AppIcon name="chevron-back" size={16} color={palette.primary} />
      <Text fontSize={14} fontWeight="700" color="$primary">
        {label}
      </Text>
    </XStack>
  )
}
