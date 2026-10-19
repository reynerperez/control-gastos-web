import { useEffect } from 'react'
import { hasOpenPopovers, Text, XStack, YStack } from 'tamagui'

import { IconButton } from '@/components/ui/CategoryIcon'
import { shadow } from '@/constants/ui'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
  width?: number
  /** Alto máximo del panel (por defecto 92vh) */
  bodyMaxHeight?: string
}

/**
 * Modal — overlay centrado, cierre con Escape / click fuera y bloqueo
 * del scroll del documento mientras está abierto.
 *
 * Nota: reemplaza a los `<Modal>`/`formSheet` nativos de la app móvil
 * (en el móvil son pantallas/sheets; en web son diálogos centrados).
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 560,
  bodyMaxHeight,
}: Props) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      // Si hay un combobox/popover abierto, Escape lo cierra a él, no al modal
      if (event.key === 'Escape' && !hasOpenPopovers()) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <YStack
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={10000}
      alignItems="center"
      justifyContent="center"
      padding="$lg">
      {/* Backdrop */}
      <YStack
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        zIndex={0}
        backgroundColor="rgba(0, 0, 0, 0.62)"
        style={{ animation: 'backdrop-in 140ms ease-out' }}
        onPress={onClose}
      />

      {/* Panel. Es el propio contenedor de scroll: la cabecera y el pie quedan
          fijos con `position: sticky`. Así el contenido nunca se sale del panel
          (si se saliera, los clics caerían en el backdrop y el modal se cerraría
          al pulsar un chip, p. ej. el método de pago). */}
      <YStack
        role="dialog"
        aria-modal
        aria-label={title}
        position="relative"
        zIndex={1}
        width={width}
        maxWidth="100%"
        maxHeight={bodyMaxHeight ?? '92vh'}
        backgroundColor="$card"
        borderColor="$border"
        borderWidth={1}
        borderRadius="$xl"
        overflow="hidden"
        style={{ overflowY: 'auto', animation: 'modal-in 140ms ease-out' }}
        {...shadow.raised}>
        <XStack
          position="sticky"
          top={0}
          zIndex={2}
          alignItems="center"
          justifyContent="space-between"
          gap="$md"
          paddingHorizontal="$lg"
          paddingVertical="$md"
          backgroundColor="$card"
          borderBottomWidth={1}
          borderBottomColor="$border">
          <YStack flex={1}>
            <Text fontSize={17} fontWeight="800" color="$text">
              {title}
            </Text>
            {subtitle ? (
              <Text fontSize={13} color="$tabIconDefault">
                {subtitle}
              </Text>
            ) : null}
          </YStack>
          <IconButton icon="close" onPress={onClose} ariaLabel="Cerrar" />
        </XStack>

        <YStack padding="$lg" gap="$md">
          {children}
        </YStack>

        {footer ? (
          <YStack
            position="sticky"
            bottom={0}
            zIndex={2}
            paddingHorizontal="$lg"
            paddingVertical="$md"
            borderTopWidth={1}
            borderTopColor="$border"
            backgroundColor="$card">
            {footer}
          </YStack>
        ) : null}
      </YStack>
    </YStack>
  )
}
