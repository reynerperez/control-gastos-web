import { Input, TextArea, Text, XStack, YStack, styled } from 'tamagui'

import { CONTROL_HEIGHT, focusRing, CSS_TRANSITION, TYPO } from '@/constants/ui'

// ═══════════════════════════════════════════════════════════════
// 🎯 FOCO — mismo indicador para todos los campos: borde primario
//    + halo suave. Evita el outline nativo del navegador.
// ═══════════════════════════════════════════════════════════════

export const fieldFocusStyle = focusRing

// ═══════════════════════════════════════════════════════════════
// 📝 Inputs — mismos tokens para toda la app
// ═══════════════════════════════════════════════════════════════

const inputBase = {
  height: CONTROL_HEIGHT,
  borderRadius: '$md',
  borderWidth: 1,
  borderColor: '$border',
  backgroundColor: '$card',
  color: '$text',
  paddingHorizontal: '$md',
  fontSize: 14,
  fontWeight: '500',
  placeholderTextColor: '$tabIconDefault',
  style: { transition: CSS_TRANSITION },
  hoverStyle: { borderColor: '$borderStrong' },
  focusStyle: fieldFocusStyle,
  variants: {
    error: {
      true: {
        borderColor: '$expense',
        focusStyle: { ...focusRing, borderColor: '$expense', shadowColor: '$expense' },
      },
    },
  } as const,
} as const

export const TextInput = styled(Input, inputBase)

export const MultilineInput = styled(TextArea, {
  ...inputBase,
  height: 'auto',
  minHeight: 88,
  paddingVertical: '$md',
  lineHeight: 20,
})

/** Etiqueta de sección (equivalente a SectionLabel del móvil) */
export function SectionLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <XStack alignItems="center" justifyContent="space-between" gap="$sm">
      <Text {...TYPO.label} color="$tabIconDefault">
        {children}
      </Text>
      {hint ? (
        <Text fontSize={11} color="$tabIconDefault">
          {hint}
        </Text>
      ) : null}
    </XStack>
  )
}

/** Input con icono a la izquierda (buscador, login, fecha…) */
export function Field({
  icon,
  children,
}: {
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <XStack
      alignItems="center"
      gap="$sm"
      height={CONTROL_HEIGHT}
      paddingHorizontal="$md"
      borderRadius="$md"
      borderWidth={1}
      borderColor="$border"
      backgroundColor="$card"
      style={{ transition: CSS_TRANSITION }}
      hoverStyle={{ borderColor: '$borderStrong' }}
      focusWithinStyle={fieldFocusStyle}>
      {icon}
      {children}
    </XStack>
  )
}

/**
 * Form — formulario nativo (`<form>`): permite enviar con Enter y que los
 * gestores de contraseñas reconozcan los campos de acceso.
 */
export function Form({
  children,
  onSubmit,
}: {
  children: React.ReactNode
  onSubmit: () => void
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {children}
      {/* Botón de envío nativo (oculto): habilita el envío implícito con Enter */}
      <button
        type="submit"
        tabIndex={-1}
        aria-hidden
        style={{ position: 'absolute', width: 0, height: 0, opacity: 0, border: 0, padding: 0 }}
      />
    </form>
  )
}

/** Mensaje de error / aviso */
export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <YStack
      role="alert"
      paddingVertical="$sm"
      paddingHorizontal="$md"
      borderRadius="$md"
      backgroundColor="$expenseLight"
      borderWidth={1}
      borderColor="$expense">
      <Text fontSize={13} lineHeight={18} color="$expense" fontWeight="600">
        {children}
      </Text>
    </YStack>
  )
}

/**
 * FormSection — agrupa campos del formulario con un título y una línea
 * separadora, para que formularios largos se lean por bloques.
 */
export function FormSection({
  title,
  description,
  first = false,
  children,
}: {
  title: string
  description?: string
  first?: boolean
  children: React.ReactNode
}) {
  return (
    <YStack
      gap="$md"
      paddingTop={first ? 0 : '$lg'}
      borderTopWidth={first ? 0 : 1}
      borderTopColor="$border">
      <YStack gap={2}>
        <Text fontSize={13} fontWeight="800" color="$text" textTransform="uppercase" letterSpacing={0.5}>
          {title}
        </Text>
        {description ? (
          <Text fontSize={12} color="$tabIconDefault">
            {description}
          </Text>
        ) : null}
      </YStack>
      {children}
    </YStack>
  )
}
