import { Spinner, Text, XStack } from 'tamagui'

import { CONTROL_HEIGHT, shadow, CSS_TRANSITION } from '@/constants/ui'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

type Props = {
  title: string
  onPress: () => void
  variant?: Variant
  loading?: boolean
  disabled?: boolean
  size?: 'md' | 'sm'
  flex?: number
}

/**
 * Button — botón web con estados consistentes (hover, press, loading,
 * disabled) y una sombra sutil en las acciones principales.
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  size = 'md',
  flex,
}: Props) {
  const isDisabled = disabled || loading

  const backgroundColor =
    variant === 'primary'
      ? '$primary'
      : variant === 'danger'
        ? '$expense'
        : variant === 'secondary'
          ? '$card'
          : 'transparent'

  const borderColor =
    variant === 'secondary' ? '$border' : variant === 'ghost' ? 'transparent' : 'transparent'

  const textColor = variant === 'primary' || variant === 'danger' ? '#FFFFFF' : '$text'

  const elevated = variant === 'primary' || variant === 'danger'

  return (
    <XStack
      flex={flex}
      flexShrink={0}
      alignItems="center"
      justifyContent="center"
      gap="$sm"
      height={size === 'md' ? CONTROL_HEIGHT : 36}
      paddingHorizontal={size === 'md' ? '$lg' : '$md'}
      borderRadius="$md"
      borderWidth={variant === 'secondary' ? 1 : 0}
      borderColor={borderColor}
      backgroundColor={backgroundColor}
      opacity={isDisabled ? 0.48 : 1}
      cursor={isDisabled ? 'not-allowed' : 'pointer'}
      style={{ transition: CSS_TRANSITION }}
      hoverStyle={
        isDisabled
          ? undefined
          : { opacity: 0.92, backgroundColor: variant === 'secondary' ? '$surfaceHover' : backgroundColor }
      }
      pressStyle={isDisabled ? undefined : { opacity: 0.8 }}
      focusVisibleStyle={{
        outlineWidth: 2,
        outlineColor: '$primary',
        outlineOffset: 2,
      }}
      {...(elevated && !isDisabled ? shadow.soft : {})}
      onPress={() => {
        if (!isDisabled) onPress()
      }}
      onKeyDown={(event) => {
        if (isDisabled) return
        const key = (event as unknown as { key?: string }).key
        if (key === 'Enter' || key === ' ') {
          event.preventDefault()
          onPress()
        }
      }}
      tabIndex={isDisabled ? -1 : 0}
      role="button"
      aria-disabled={isDisabled}
      aria-label={title}>
      {loading ? (
        <Spinner
          size="small"
          color={variant === 'primary' || variant === 'danger' ? '#FFFFFF' : '$text'}
        />
      ) : (
        <Text fontSize={size === 'md' ? 14 : 13} fontWeight="700" color={textColor}>
          {title}
        </Text>
      )}
    </XStack>
  )
}
