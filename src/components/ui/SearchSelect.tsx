import { useEffect, useMemo, useRef, useState } from 'react'
import { Input, Popover, Text, View, XStack, YStack } from 'tamagui'

import { AppIcon } from '@/components/ui/Icon'
import { CONTROL_HEIGHT, shadow, CSS_TRANSITION } from '@/constants/ui'
import { palette } from '@/constants/theme'

/**
 * SearchSelect — combobox web con búsqueda (escribir para filtrar).
 *
 * Sustituye a las rejillas de chips (categorías / métodos de pago) por un
 * único campo que se despliega en un popover flotante. Pensado para listas
 * largas: reduce el ruido visual del formulario.
 *
 * - Renderiza la lista en un portal (Popover), así no la recorta el modal.
 * - Filtrar es insensible a mayúsculas y acentos.
 * - Navegación con teclado: ↑/↓, Enter, Escape.
 * - `multiple` para filtros (varios); sin él, selección única.
 */

export type SelectOption = {
  id: string
  label: string
  /** Nombre de icono de Ionicons (se traduce con AppIcon) */
  icon?: string
  /** Color del icono / punto de la opción */
  color?: string
  /** Texto secundario a la derecha (p. ej. "Crédito", "Débito") */
  hint?: string
  /** Etiqueta destacada (p. ej. "Recomendado") */
  badge?: string
  /** Palabras extra para la búsqueda (no se muestran) */
  keywords?: string
}

type BaseProps = {
  options: SelectOption[]
  /** Etiqueta accesible del campo; también usada por las pruebas de humo */
  ariaLabel: string
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  /** Icono mostrado cuando no hay nada seleccionado */
  leadingIcon?: string
}

type SingleProps = BaseProps & {
  multiple?: false
  value: string | null
  onChange: (id: string | null) => void
}

type MultiProps = BaseProps & {
  multiple: true
  value: string[]
  onChange: (ids: string[]) => void
}

export type SearchSelectProps = SingleProps | MultiProps

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

function filterOptions(options: SelectOption[], query: string) {
  const q = normalize(query.trim())
  if (!q) return options
  return options.filter((option) =>
    normalize(`${option.label} ${option.keywords ?? ''}`).includes(q)
  )
}

function OptionBadge({ label }: { label: string }) {
  return (
    <XStack
      flexShrink={0}
      paddingHorizontal={6}
      paddingVertical={1}
      borderRadius="$full"
      backgroundColor={palette.primary + '22'}
      borderWidth={1}
      borderColor={palette.primary + '44'}>
      <Text
        fontSize={9}
        fontWeight="800"
        color="$primary"
        textTransform="uppercase"
        letterSpacing={0.3}>
        {label}
      </Text>
    </XStack>
  )
}

function OptionRow({
  option,
  selected,
  highlighted,
  multiple,
  index,
  onHover,
  onPress,
}: {
  option: SelectOption
  selected: boolean
  highlighted: boolean
  multiple: boolean
  index: number
  onHover: () => void
  onPress: () => void
}) {
  return (
    <XStack
      role="option"
      aria-selected={selected}
      aria-label={option.label}
      data-option-index={index}
      alignItems="center"
      gap="$sm"
      paddingHorizontal="$md"
      paddingVertical="$sm"
      cursor="pointer"
      backgroundColor={highlighted ? '$surfaceHover' : 'transparent'}
      style={{ transition: CSS_TRANSITION }}
      hoverStyle={{ backgroundColor: '$surfaceHover' }}
      onMouseEnter={onHover}
      onPress={onPress}>
      {option.icon ? (
        <AppIcon name={option.icon} size={18} color={option.color ?? palette.muted} />
      ) : option.color ? (
        <View width={10} height={10} borderRadius="$full" backgroundColor={option.color} />
      ) : null}
      <Text flex={1} fontSize={14} color="$text" numberOfLines={1}>
        {option.label}
      </Text>
      {option.badge ? <OptionBadge label={option.badge} /> : null}
      {option.hint ? (
        <Text fontSize={12} color="$tabIconDefault">
          {option.hint}
        </Text>
      ) : null}
      {multiple ? (
        <AppIcon
          name={selected ? 'checkbox' : 'square-outline'}
          size={18}
          color={selected ? palette.primary : '#64748B'}
        />
      ) : selected ? (
        <AppIcon name="checkmark" size={16} color={palette.primary} />
      ) : null}
    </XStack>
  )
}

export function SearchSelect(props: SearchSelectProps) {
  const {
    options,
    ariaLabel,
    placeholder = 'Seleccionar…',
    searchPlaceholder = 'Buscar…',
    emptyMessage = 'Sin resultados',
    disabled = false,
    leadingIcon,
  } = props
  const multiple = props.multiple === true
  const selectedIds = multiple
    ? props.value
    : props.value
      ? [props.value]
      : []
  const selectedOptions = options.filter((option) => selectedIds.includes(option.id))

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const [width, setWidth] = useState<number | undefined>(undefined)
  const triggerRef = useRef<HTMLElement | null>(null)
  const listRef = useRef<HTMLElement | null>(null)
  const inputRef = useRef<any>(null)

  const filtered = useMemo(() => filterOptions(options, query), [options, query])

  // Al abrir: enfocar la búsqueda y heredar el ancho del campo
  useEffect(() => {
    if (!open) {
      setQuery('')
      setHighlight(0)
      return
    }
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setWidth(rect.width)
    const timer = setTimeout(() => inputRef.current?.focus?.(), 30)
    return () => clearTimeout(timer)
  }, [open])

  useEffect(() => {
    setHighlight(0)
  }, [query])

  // Mantener visible la opción resaltada con el teclado
  useEffect(() => {
    if (!open) return
    const node = listRef.current?.querySelector?.(`[data-option-index="${highlight}"]`) as HTMLElement | null
    node?.scrollIntoView?.({ block: 'nearest' })
  }, [highlight, open])

  const choose = (id: string) => {
    if (props.multiple) {
      const next = selectedIds.includes(id)
        ? selectedIds.filter((value) => value !== id)
        : [...selectedIds, id]
      props.onChange(next)
      setQuery('')
    } else {
      props.onChange(id)
      setOpen(false)
    }
  }

  const clearSelection = () => {
    if (!props.multiple) props.onChange(null)
  }

  const onSearchKeyDown = (event: {
    key: string
    preventDefault: () => void
    stopPropagation: () => void
  }) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlight((value) => Math.min(value + 1, filtered.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlight((value) => Math.max(value - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const option = filtered[highlight]
      if (option) choose(option.id)
    } else if (event.key === 'Escape') {
      // Cierra el selector sin cerrar el modal que lo contiene
      event.stopPropagation()
      setOpen(false)
    }
  }

  const summary = multiple
    ? selectedOptions.length === 0
      ? placeholder
      : selectedOptions.length <= 2
        ? selectedOptions.map((option) => option.label).join(', ')
        : `${selectedOptions.length} seleccionados`
    : selectedOptions[0]?.label ?? placeholder

  const hasSelection = selectedOptions.length > 0

  return (
    <Popover open={open} onOpenChange={setOpen} placement="bottom-start" zIndex={100000}>
      <Popover.Trigger asChild disabled={disabled}>
        <XStack
          ref={triggerRef as never}
          role="button"
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-disabled={disabled}
          alignItems="center"
          gap="$sm"
          height={CONTROL_HEIGHT}
          paddingHorizontal="$md"
          borderRadius="$md"
          borderWidth={1}
          borderColor={open ? '$primary' : '$border'}
          backgroundColor="$card"
          opacity={disabled ? 0.5 : 1}
          cursor={disabled ? 'not-allowed' : 'pointer'}
          style={{ transition: CSS_TRANSITION }}
          hoverStyle={disabled ? undefined : { borderColor: open ? '$primary' : '$borderStrong' }}
          pressStyle={disabled ? undefined : { opacity: 0.9 }}
          focusVisibleStyle={{
            outlineWidth: 2,
            outlineColor: '$primary',
            outlineOffset: 2,
          }}
          onKeyDown={(event) => {
            if (disabled) return
            const key = (event as unknown as { key?: string }).key
            if (key === 'Enter' || key === ' ' || key === 'ArrowDown') {
              event.preventDefault()
              setOpen(true)
            }
          }}
          tabIndex={disabled ? -1 : 0}>
          {selectedOptions[0]?.icon ? (
            <AppIcon
              name={selectedOptions[0].icon}
              size={18}
              color={selectedOptions[0].color ?? palette.primary}
            />
          ) : leadingIcon ? (
            <AppIcon name={leadingIcon} size={18} color={palette.muted} />
          ) : null}
          <Text
            flex={1}
            fontSize={15}
            numberOfLines={1}
            color={hasSelection ? '$text' : '$tabIconDefault'}>
            {summary}
          </Text>
          {!multiple && selectedOptions[0]?.badge ? (
            <OptionBadge label={selectedOptions[0].badge} />
          ) : null}
          {!multiple && hasSelection && !disabled ? (
            <XStack
              cursor="pointer"
              pressStyle={{ opacity: 0.6 }}
              aria-label={`Quitar ${ariaLabel}`}
              role="button"
              onPress={(event) => {
                event.stopPropagation()
                clearSelection()
              }}>
              <AppIcon name="close-circle" size={16} color="#64748B" />
            </XStack>
          ) : null}
          <AppIcon name="chevron-down" size={18} color={palette.muted} />
        </XStack>
      </Popover.Trigger>

      <Popover.Content
        width={width}
        minWidth={240}
        padding={0}
        borderWidth={1}
        borderColor="$border"
        borderRadius="$lg"
        backgroundColor="$card"
        overflow="hidden"
        {...shadow.raised}>
        <YStack width="100%" style={{ animation: 'popover-in 120ms ease-out' }}>
          <XStack
            alignItems="center"
            gap="$sm"
            paddingHorizontal="$md"
            height={44}
            borderBottomWidth={1}
            borderBottomColor="$border">
            <AppIcon name="search" size={16} color={palette.muted} />
            <Input
              ref={inputRef}
              unstyled
              flex={1}
              height={44}
              fontSize={14}
              color="$text"
              placeholderTextColor="$tabIconDefault"
              placeholder={searchPlaceholder}
              value={query}
              onChangeText={(text) => {
                setQuery(text)
                if (!open) setOpen(true)
              }}
              onKeyDown={onSearchKeyDown as never}
              aria-label={`Buscar ${ariaLabel}`}
            />
            {query ? (
              <XStack
                cursor="pointer"
                pressStyle={{ opacity: 0.6 }}
                onPress={() => setQuery('')}
                aria-label="Limpiar búsqueda"
                role="button">
                <AppIcon name="close-circle" size={16} color="#64748B" />
              </XStack>
            ) : null}
          </XStack>

          <YStack
            ref={listRef as never}
            role={'listbox' as never}
            aria-label={ariaLabel}
            maxHeight={260}
            style={{ overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <Text padding="$md" fontSize={13} color="$tabIconDefault">
                {emptyMessage}
              </Text>
            ) : (
              filtered.map((option, index) => (
                <OptionRow
                  key={option.id}
                  option={option}
                  index={index}
                  selected={selectedIds.includes(option.id)}
                  highlighted={highlight === index}
                  multiple={multiple}
                  onHover={() => setHighlight(index)}
                  onPress={() => choose(option.id)}
                />
              ))
            )}
          </YStack>
        </YStack>
      </Popover.Content>
    </Popover>
  )
}
