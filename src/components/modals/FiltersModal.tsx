import { useMemo } from 'react'
import { Text, XStack, YStack } from 'tamagui'

import { BorderedChip } from '@/components/ui/BorderedStack'
import { AppIcon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { SearchSelect, type SelectOption } from '@/components/ui/SearchSelect'
import { palette } from '@/constants/theme'
import { CSS_TRANSITION } from '@/constants/ui'
import { useFilters, type TypeFilter } from '@/contexts/FiltersContext'
import { useData } from '@/hooks/useData'
import { PaymentMethodType } from '@/types'
import { getPaymentMethodIcon } from '@/utils/paymentMethod'

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'expense', label: 'Gastos' },
  { value: 'income', label: 'Ingresos' },
]

const paymentMethodColor = (type: PaymentMethodType) =>
  type === 'credit' ? palette.warning : type === 'debit' ? palette.primary : palette.muted

const paymentMethodLabel = (type: PaymentMethodType) =>
  type === 'credit' ? 'Crédito' : type === 'debit' ? 'Débito' : 'Efectivo'

/**
 * Filtros de movimientos — igual que el sheet del móvil, aplicando los
 * cambios en vivo sobre la lista (estado compartido en FiltersContext).
 */
export function FiltersModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { categories, paymentMethods } = useData()
  const {
    typeFilter,
    setTypeFilter,
    selectedCategories,
    toggleCategory,
    selectedPaymentMethods,
    togglePaymentMethod,
    clearFilters,
    onlyPending,
    setOnlyPending,
  } = useFilters()

  const visibleCategories = categories.filter(
    (category) => typeFilter === 'all' || category.type === typeFilter
  )

  const categoryOptions = useMemo<SelectOption[]>(
    () =>
      visibleCategories.map((category) => ({
        id: category.id,
        label: category.name,
        icon: category.icon,
        color: category.color,
      })),
    [visibleCategories]
  )

  const paymentOptions = useMemo<SelectOption[]>(
    () =>
      paymentMethods.map((method) => ({
        id: method.id,
        label: method.name,
        icon: getPaymentMethodIcon(method.type),
        color: paymentMethodColor(method.type),
        hint: paymentMethodLabel(method.type),
      })),
    [paymentMethods]
  )

  /** El contexto solo expone toggle; aplicamos la diferencia del multi-select */
  const syncSelection = (
    next: string[],
    current: string[],
    toggle: (id: string) => void
  ) => {
    current.filter((id) => !next.includes(id)).forEach(toggle)
    next.filter((id) => !current.includes(id)).forEach(toggle)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Filtros"
      subtitle="Los cambios se aplican al instante"
      width={640}
      footer={
        <XStack gap="$md" alignItems="center">
          <XStack
            flex={1}
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            pressStyle={{ opacity: 0.7 }}
            onPress={clearFilters}
            role="button"
            aria-label="Limpiar filtros">
            <Text fontSize={14} fontWeight="700" color="$primary">
              Limpiar filtros
            </Text>
          </XStack>
        </XStack>
      }>
      {/* Tipo */}
      <YStack gap="$sm">
        <Text fontSize={14} fontWeight="700" color="$text">
          Tipo
        </Text>
        <XStack gap="$sm">
          {TYPE_OPTIONS.map((option) => {
            const active = typeFilter === option.value
            return (
              <BorderedChip
                key={option.value}
                flex={1}
                size="sm"
                cursor="pointer"
                pressStyle={{ opacity: 0.75 }}
                onPress={() => setTypeFilter(option.value)}
                backgroundColor={active ? '$primaryLight' : '$card'}
                borderColor={active ? '$primary' : '$border'}
                style={{ transition: CSS_TRANSITION }}>
                <Text fontSize={13} fontWeight="700" color={active ? '$primary' : '$tabIconDefault'}>
                  {option.label}
                </Text>
              </BorderedChip>
            )
          })}
        </XStack>
      </YStack>

      {/* Estado del desglose */}
      {typeFilter !== 'income' && (
        <YStack gap="$sm">
          <Text fontSize={14} fontWeight="700" color="$text">
            Estado
          </Text>
          <XStack gap="$sm">
            <BorderedChip
              flex={1}
              size="sm"
              cursor="pointer"
              pressStyle={{ opacity: 0.75 }}
              onPress={() => setOnlyPending(false)}
              backgroundColor={!onlyPending ? '$primaryLight' : '$card'}
              borderColor={!onlyPending ? '$primary' : '$border'}
              style={{ transition: CSS_TRANSITION }}>
              <Text fontSize={13} fontWeight="700" color={!onlyPending ? '$primary' : '$tabIconDefault'}>
                Todos
              </Text>
            </BorderedChip>
            <BorderedChip
              flex={1}
              size="sm"
              cursor="pointer"
              pressStyle={{ opacity: 0.75 }}
              onPress={() => setOnlyPending(true)}
              backgroundColor={onlyPending ? palette.warning + '1F' : '$card'}
              borderColor={onlyPending ? '$warning' : '$border'}
              style={{ transition: CSS_TRANSITION }}>
              <AppIcon name="time" size={14} color={onlyPending ? palette.warning : '#8A8A8A'} />
              <Text fontSize={13} fontWeight="700" color={onlyPending ? '$warning' : '$tabIconDefault'}>
                Pendientes
              </Text>
            </BorderedChip>
          </XStack>
        </YStack>
      )}

      {/* Métodos de pago */}
      <YStack gap="$sm">
        <Text fontSize={14} fontWeight="700" color="$text">
          Método de pago
        </Text>
        <SearchSelect
          multiple
          ariaLabel="Método de pago"
          leadingIcon="card-outline"
          placeholder="Todos"
          searchPlaceholder="Buscar método…"
          emptyMessage="Sin métodos de pago todavía."
          options={paymentOptions}
          value={selectedPaymentMethods}
          onChange={(next) => syncSelection(next, selectedPaymentMethods, togglePaymentMethod)}
        />
      </YStack>

      {/* Categorías */}
      <YStack gap="$sm">
        <Text fontSize={14} fontWeight="700" color="$text">
          Categorías
        </Text>
        <SearchSelect
          multiple
          ariaLabel="Categorías"
          leadingIcon="pricetag"
          placeholder="Todas"
          searchPlaceholder="Buscar categoría…"
          emptyMessage="Sin categorías para este tipo."
          options={categoryOptions}
          value={selectedCategories}
          onChange={(next) => syncSelection(next, selectedCategories, toggleCategory)}
        />
      </YStack>
    </Modal>
  )
}
