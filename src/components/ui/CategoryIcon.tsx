import { styled, Text, View, XStack } from 'tamagui'

import { AppIcon } from '@/components/ui/Icon'
import { palette } from '@/constants/theme'

// ═══════════════════════════════════════════════════════════════
// 🎯 CategoryIcon — círculo de color con el icono de la categoría
//    Misma API que el componente de la app móvil.
// ═══════════════════════════════════════════════════════════════

const Badge = styled(View, {
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
})

type Props = {
  icon: string
  color: string
  size?: number
}

export function CategoryIcon({ icon, color, size = 44 }: Props) {
  return (
    <Badge
      width={size}
      height={size}
      borderRadius={size / 2}
      backgroundColor={color + '22'}>
      <AppIcon name={icon} size={Math.round(size * 0.5)} color={color} />
    </Badge>
  )
}

// ═══════════════════════════════════════════════════════════════
// 🔲 IconButton — botón cuadrado con icono (headers, acciones)
// ═══════════════════════════════════════════════════════════════

export function IconButton({
  icon,
  color = '$text',
  size = 20,
  onPress,
  ariaLabel,
  danger = false,
}: {
  icon: string
  color?: string
  size?: number
  onPress: () => void
  ariaLabel: string
  danger?: boolean
}) {
  return (
    <XStack
      width={38}
      height={38}
      alignItems="center"
      justifyContent="center"
      borderRadius="$md"
      cursor="pointer"
      hoverStyle={{ backgroundColor: '$background' }}
      pressStyle={{ opacity: 0.6 }}
      onPress={onPress}
      aria-label={ariaLabel}
      role="button">
      <AppIcon name={icon} size={size} color={danger ? palette.expense : color} />
    </XStack>
  )
}

// ═══════════════════════════════════════════════════════════════
// 🏷️ Pill — etiqueta/chip de solo lectura
// ═══════════════════════════════════════════════════════════════

export function Pill({
  icon,
  component,
  label,
  color,
  backgroundColor = '$background',
}: {
  icon?: string
  component?: React.ReactNode
  label: string
  color?: string
  backgroundColor?: string
}) {
  return (
    <XStack
      alignItems="center"
      gap="$xs"
      paddingHorizontal="$sm"
      paddingVertical={4}
      borderRadius="$full"
      backgroundColor={backgroundColor}>
      {component ?? (icon ? <AppIcon name={icon} size={13} color={color} /> : null)}
      <Text fontSize={12} color={color ?? '$tabIconDefault'} numberOfLines={1}>
        {label}
      </Text>
    </XStack>
  )
}
