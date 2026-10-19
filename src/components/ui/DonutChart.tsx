import { Text, YStack } from 'tamagui'

import { useTheme } from '@/hooks/useTheme'

export type DonutSlice = {
  label: string
  value: number
  color: string
}

type Props = {
  data: DonutSlice[]
  size?: number
  strokeWidth?: number
  centerLabel?: string
  centerValue?: string
}

/**
 * DonutChart — misma gráfica que la app móvil, ahora en SVG nativo
 * (sin react-native-svg): círculos con strokeDasharray.
 */
export function DonutChart({
  data,
  size = 190,
  strokeWidth = 26,
  centerLabel,
  centerValue,
}: Props) {
  const { colors } = useTheme()
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const total = data.reduce((sum, d) => sum + d.value, 0)

  let offset = 0
  const slices =
    total > 0
      ? data.map((d) => {
          const dash = (d.value / total) * circumference
          const slice = {
            color: d.color,
            dash,
            gap: circumference - dash,
            offset: -offset,
          }
          offset += dash
          return slice
        })
      : []

  return (
    <YStack
      width={size}
      height={size}
      alignItems="center"
      justifyContent="center"
      position="relative"
      flexShrink={0}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Gastos por categoría">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.border}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {slices.map((s, index) => (
            <circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={s.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${s.dash} ${s.gap}`}
              strokeDashoffset={s.offset}
              fill="transparent"
            />
          ))}
        </g>
      </svg>

      <YStack
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        alignItems="center"
        justifyContent="center">
        {centerValue ? (
          <Text fontSize={20} fontWeight="800" color="$text">
            {centerValue}
          </Text>
        ) : null}
        {centerLabel ? (
          <Text fontSize={12} color="$tabIconDefault">
            {centerLabel}
          </Text>
        ) : null}
      </YStack>
    </YStack>
  )
}
