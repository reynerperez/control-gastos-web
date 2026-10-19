import { Text, XStack, styled } from 'tamagui'

import { BorderedXStack } from '@/components/ui/BorderedStack'
import { AppIcon } from '@/components/ui/Icon'
import { palette } from '@/constants/theme'
import { CONTROL_HEIGHT, CSS_TRANSITION } from '@/constants/ui'
import { usePeriod } from '@/contexts/PeriodContext'

const Container = styled(BorderedXStack, {
  alignItems: 'center',
  justifyContent: 'space-between',
  borderRadius: '$md',
  paddingHorizontal: '$sm',
  height: CONTROL_HEIGHT,
  backgroundColor: '$card',
  style: { transition: CSS_TRANSITION },
})

const Arrow = styled(XStack, {
  padding: '$sm',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '$sm',
  cursor: 'pointer',
  style: { transition: CSS_TRANSITION },
  hoverStyle: { backgroundColor: '$surfaceHover' },
  pressStyle: { opacity: 0.6 },
})

const Label = styled(Text, {
  fontSize: 15,
  fontWeight: '700',
  color: '$text',
})

/**
 * Selector de periodo compartido entre Resumen, Movimientos y Presupuestos.
 * El estado vive en PeriodContext (igual que en la app móvil).
 */
export function MonthSelector({ onOpenPicker }: { onOpenPicker: () => void }) {
  const { label, shiftMonth } = usePeriod()

  return (
    <Container>
      <Arrow onPress={() => shiftMonth(-1)} aria-label="Periodo anterior">
        <AppIcon name="chevron-back" size={20} color={palette.text} />
      </Arrow>

      <XStack
        flex={1}
        alignItems="center"
        justifyContent="center"
        gap="$xs"
        cursor="pointer"
        pressStyle={{ opacity: 0.7 }}
        onPress={onOpenPicker}
        role="button"
        aria-label="Elegir periodo">
        <Label>{label}</Label>
        <AppIcon name="chevron-down" size={14} color={palette.muted} />
      </XStack>

      <Arrow onPress={() => shiftMonth(1)} aria-label="Periodo siguiente">
        <AppIcon name="chevron-forward" size={20} color={palette.text} />
      </Arrow>
    </Container>
  )
}
