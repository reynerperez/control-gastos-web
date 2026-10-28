import { useEffect, type ReactNode } from 'react'
import { hasOpenPopovers, Text, XStack, YStack } from 'tamagui'

import { IconButton } from '@/components/ui/CategoryIcon'
import { shadow } from '@/constants/ui'

type Props = {
  open?: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  /** Acciones extra a la derecha del encabezado (antes del botón de cerrar) */
  headerActions?: ReactNode
  /** Ancho del panel en desktop (en móvil ocupa todo el ancho) */
  width?: number
}

/**
 * SidePeek — panel lateral tipo Notion.
 *
 * Se abre por encima de la pantalla actual sin perder su estado (filtros,
 * scroll…). Se cierra con Escape, con el botón X o haciendo clic fuera.
 * Si hay un modal encima (editar movimiento, desglose), Escape cierra ese
 * modal primero.
 */
export function SidePeek({
  open = true,
  onClose,
  title,
  subtitle,
  children,
  headerActions,
  width = 560,
}: Props) {
  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || hasOpenPopovers()) return
      // Hay otro diálogo modal encima (formulario, desglose…): que lo cierre él.
      const modals = document.querySelectorAll('[aria-modal="true"]')
      if (modals.length > 1) return
      onClose()
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
      zIndex={9000}
      alignItems="flex-end">
      {/* Backdrop: oscurece la pantalla actual sin bloquear el peek */}
      <YStack
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        zIndex={0}
        backgroundColor="rgba(0, 0, 0, 0.5)"
        style={{ animation: 'backdrop-in 140ms ease-out' }}
        onPress={onClose}
        aria-hidden
      />

      <YStack
        role="dialog"
        aria-modal
        aria-label={title}
        position="relative"
        zIndex={1}
        width={width}
        maxWidth="100%"
        height="100%"
        backgroundColor="$card"
        borderLeftWidth={1}
        borderLeftColor="$border"
        overflow="hidden"
        style={{ animation: 'peek-in 180ms ease-out' }}
        {...shadow.raised}>
        <XStack
          alignItems="center"
          justifyContent="space-between"
          gap="$md"
          paddingHorizontal="$lg"
          paddingVertical="$md"
          borderBottomWidth={1}
          borderBottomColor="$border"
          backgroundColor="$card">
          <YStack flex={1} minWidth={0}>
            <Text fontSize={17} fontWeight="800" color="$text" numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text fontSize={12} color="$tabIconDefault" numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </YStack>
          {headerActions ? (
            <XStack alignItems="center" gap="$xs" flexShrink={0}>
              {headerActions}
            </XStack>
          ) : null}
          <IconButton icon="close" onPress={onClose} ariaLabel="Cerrar detalle" />
        </XStack>

        <YStack
          flex={1}
          minHeight={0}
          padding="$lg"
          gap="$md"
          style={{ overflowY: 'auto' }}>
          {children}
        </YStack>
      </YStack>
    </YStack>
  )
}
