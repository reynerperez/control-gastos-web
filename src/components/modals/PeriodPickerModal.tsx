import { useMemo, useState } from 'react'
import { Text, XStack, YStack } from 'tamagui'

import { BorderedChip } from '@/components/ui/BorderedStack'
import { DateField } from '@/components/ui/DateField'
import { AppIcon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { palette } from '@/constants/theme'
import { CSS_TRANSITION } from '@/constants/ui'
import { usePeriod } from '@/contexts/PeriodContext'
import { addMonths, toISODate } from '@/utils/format'

const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

/**
 * Selector de periodo — presets rápidos, grid de meses por año y
 * rango personalizado (con inputs de fecha nativos en web).
 */
export function PeriodPickerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { period, setMonth, setRange, setAll } = usePeriod()
  const now = useMemo(() => new Date(), [])
  const [year, setYear] = useState(period.month.getFullYear())
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo, setRangeTo] = useState('')

  const applyPresetMonth = (date: Date) => {
    setMonth(date)
    onClose()
  }

  const applyRange = () => {
    if (!rangeFrom || !rangeTo) return
    const [start, end] = rangeFrom <= rangeTo ? [rangeFrom, rangeTo] : [rangeTo, rangeFrom]
    setRange(start, end)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Elegir periodo"
      subtitle="Resumen, movimientos y presupuestos comparten el periodo"
      width={620}>
      {/* Presets */}
      <XStack flexWrap="wrap" gap="$sm">
        <BorderedChip size="sm" cursor="pointer" pressStyle={{ opacity: 0.7 }} onPress={() => applyPresetMonth(new Date(now.getFullYear(), now.getMonth(), 1))}>
          <Text fontSize={13} fontWeight="600" color="$text">
            Este mes
          </Text>
        </BorderedChip>
        <BorderedChip size="sm" cursor="pointer" pressStyle={{ opacity: 0.7 }} onPress={() => applyPresetMonth(addMonths(now, -1))}>
          <Text fontSize={13} fontWeight="600" color="$text">
            Mes pasado
          </Text>
        </BorderedChip>
        <BorderedChip
          size="sm"
          cursor="pointer"
          pressStyle={{ opacity: 0.7 }}
          onPress={() => {
            setRange(
              toISODate(new Date(now.getFullYear(), 0, 1)),
              toISODate(new Date(now.getFullYear(), 11, 31))
            )
            onClose()
          }}>
          <Text fontSize={13} fontWeight="600" color="$text">
            Este año
          </Text>
        </BorderedChip>
        <BorderedChip
          size="sm"
          cursor="pointer"
          pressStyle={{ opacity: 0.7 }}
          onPress={() => {
            setAll()
            onClose()
          }}>
          <Text fontSize={13} fontWeight="600" color="$text">
            Todo el historial
          </Text>
        </BorderedChip>
      </XStack>

      {/* Navegación por año */}
      <XStack alignItems="center" justifyContent="space-between" marginTop="$sm">
        <XStack
          cursor="pointer"
          padding="$xs"
          borderRadius="$sm"
          hoverStyle={{ backgroundColor: '$background' }}
          pressStyle={{ opacity: 0.6 }}
          onPress={() => setYear((value) => value - 1)}
          aria-label="Año anterior">
          <AppIcon name="chevron-back" size={20} color={palette.text} />
        </XStack>
        <Text fontSize={16} fontWeight="800" color="$text">
          {year}
        </Text>
        <XStack
          cursor="pointer"
          padding="$xs"
          borderRadius="$sm"
          hoverStyle={{ backgroundColor: '$background' }}
          pressStyle={{ opacity: 0.6 }}
          onPress={() => setYear((value) => value + 1)}
          aria-label="Año siguiente">
          <AppIcon name="chevron-forward" size={20} color={palette.text} />
        </XStack>
      </XStack>

      {/* Grid de meses */}
      <XStack flexWrap="wrap" gap="$sm">
        {MONTHS_SHORT.map((name, monthIndex) => {
          const isSelected =
            period.mode === 'month' &&
            period.month.getFullYear() === year &&
            period.month.getMonth() === monthIndex
          const isCurrent = now.getFullYear() === year && now.getMonth() === monthIndex
          return (
            <YStack
              key={name}
              width="31%"
              height={44}
              alignItems="center"
              justifyContent="center"
              borderRadius="$md"
              borderWidth={1}
              cursor="pointer"
              hoverStyle={{ borderColor: palette.primary }}
              pressStyle={{ opacity: 0.75 }}
              style={{ transition: CSS_TRANSITION }}
              backgroundColor={isSelected ? '$primaryLight' : '$card'}
              borderColor={isSelected ? '$primary' : isCurrent ? palette.primary : '$border'}
              onPress={() => applyPresetMonth(new Date(year, monthIndex, 1))}>
              <Text
                fontSize={14}
                fontWeight={isSelected || isCurrent ? '700' : '500'}
                color={isSelected ? '$primary' : '$text'}>
                {name}
              </Text>
            </YStack>
          )
        })}
      </XStack>

      {/* Rango personalizado */}
      <YStack gap="$sm" marginTop="$sm">
        <Text fontSize={14} fontWeight="700" color="$text">
          Rango personalizado
        </Text>
        <XStack alignItems="center" gap="$sm">
          <YStack flex={1}>
            <Text fontSize={12} color="$tabIconDefault" marginBottom="$xs">
              Desde
            </Text>
            <DateField
              value={rangeFrom}
              onChange={setRangeFrom}
              ariaLabel="Fecha inicial del rango"
            />
          </YStack>
          <YStack flex={1}>
            <Text fontSize={12} color="$tabIconDefault" marginBottom="$xs">
              Hasta
            </Text>
            <DateField
              value={rangeTo}
              onChange={setRangeTo}
              ariaLabel="Fecha final del rango"
            />
          </YStack>
        </XStack>

        <XStack justifyContent="flex-end">
          <BorderedChip
            size="sm"
            cursor={rangeFrom && rangeTo ? 'pointer' : 'not-allowed'}
            opacity={rangeFrom && rangeTo ? 1 : 0.5}
            backgroundColor={rangeFrom && rangeTo ? '$primary' : '$card'}
            borderColor={rangeFrom && rangeTo ? '$primary' : '$border'}
            pressStyle={{ opacity: 0.75 }}
            onPress={applyRange}>
            <Text fontSize={13} fontWeight="700" color={rangeFrom && rangeTo ? '#FFFFFF' : '$tabIconDefault'}>
              Aplicar rango
            </Text>
          </BorderedChip>
        </XStack>
      </YStack>
    </Modal>
  )
}
