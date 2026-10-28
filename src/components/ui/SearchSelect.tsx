import { useEffect, useMemo, useRef, useState } from 'react'
import { Input, Popover, Text, View, XStack, YStack } from 'tamagui'

import { AppIcon } from '@/components/ui/Icon'
import { CONTROL_HEIGHT, shadow, CSS_TRANSITION, focusOutline } from '@/constants/ui'
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
  /** Etiqueta destacada (p. ej. "Recomendado"); se muestra como punto */
  badge?: string
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
  /** `inline` se integra a una fila de detalle, sin caja visible. */
  variant?: 'default' | 'inline'
  /** Solo lectura: conserva el valor, pero no abre el popover. */
  readOnly?: boolean
  /** Permite ocultar el icono cuando la fila ya tiene uno propio. */
  showLeadingIcon?: boolean
  /** Notifica apertura/cierre para que la fila contenedora siga resaltada. */
  onOpenChange?: (open: boolean) => void
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
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Diferencia de una sola letra (errata, letra extra o faltante). */
function withinOneEdit(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false

  let i = 0
  let j = 0
  let edits = 0

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1
      j += 1
      continue
    }
    edits += 1
    if (edits > 1) return false
    if (a.length > b.length) {
      i += 1
    } else if (a.length < b.length) {
      j += 1
    } else {
      i += 1
      j += 1
    }
  }

  return edits + (a.length - i) + (b.length - j) <= 1
}

/** ¿Las letras de `query` aparecen en orden dentro de `text`? (abreviaturas) */
function isSubsequence(query: string, text: string) {
  let qi = 0
  for (let ti = 0; ti < text.length && qi < query.length; ti += 1) {
    if (text[ti] === query[qi]) qi += 1
  }
  return qi === query.length
}

/**
 * Búsqueda permisiva solo por nombre:
 * - sin distinguir mayúsculas, acentos ni puntuación;
 * - coincidencia parcial en cualquier posición;
 * - todas las palabras en cualquier orden;
 * - tolera una errata por palabra y abreviaturas (“bva” → “BBVA”).
 */
function matchesLabel(label: string, query: string) {
  const haystack = normalize(label)
  const needle = normalize(query)
  if (!needle) return true
  if (haystack.includes(needle)) return true

  const words = haystack.split(' ')
  const tokens = needle.split(' ')
  const everyTokenMatches = tokens.every((token) =>
    words.some(
      (word) =>
        word.includes(token) || (token.length >= 3 && withinOneEdit(token, word))
    )
  )
  if (everyTokenMatches) return true

  return (
    needle.length >= 3 &&
    isSubsequence(needle.replace(/\s/g, ''), haystack.replace(/\s/g, ''))
  )
}

function filterOptions(options: SelectOption[], query: string) {
  if (!query.trim()) return options
  return options.filter((option) => matchesLabel(option.label, query))
}

/** Punto morado que marca la opción recomendada, sin ocupar una línea extra. */
function RecommendedDot({ label }: { label: string }) {
  return (
    <View
      width={7}
      height={7}
      borderRadius="$full"
      backgroundColor={palette.primary}
      flexShrink={0}
      role="img"
      aria-label={label}
    />
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
      <Text flex={1} minWidth={0} fontSize={14} color="$text" numberOfLines={1}>
        {option.label}
      </Text>
      {option.badge ? <RecommendedDot label={option.badge} /> : null}
      {option.hint ? (
        <Text flexShrink={0} fontSize={12} color="$tabIconDefault">
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
    variant = 'default',
    readOnly = false,
    showLeadingIcon = true,
    onOpenChange,
  } = props
  const multiple = props.multiple === true
  const inline = variant === 'inline'
  const interactive = !disabled && !readOnly
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
  const openRef = useRef(false)

  const changeOpen = (next: boolean) => {
    if (openRef.current === next) return
    openRef.current = next
    setOpen(next)
    onOpenChange?.(next)
  }

  /** Al cerrar desde el propio selector, la fila recupera el foco. */
  const restoreTriggerFocus = () => {
    window.setTimeout(() => triggerRef.current?.focus?.(), 0)
  }

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
    if (!interactive) return
    if (props.multiple) {
      const next = selectedIds.includes(id)
        ? selectedIds.filter((value) => value !== id)
        : [...selectedIds, id]
      props.onChange(next)
      setQuery('')
    } else {
      props.onChange(id)
      changeOpen(false)
      restoreTriggerFocus()
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
      changeOpen(false)
      restoreTriggerFocus()
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
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!interactive) return
        changeOpen(next)
      }}
      placement="bottom-start"
      zIndex={100000}>
      <Popover.Trigger asChild disabled={!interactive}>
        <XStack
          ref={triggerRef as never}
          width={inline ? '100%' : undefined}
          role="button"
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={interactive ? open : undefined}
          aria-disabled={!interactive}
          aria-readonly={readOnly}
          alignItems="center"
          gap={inline ? 4 : '$sm'}
          height={inline ? 26 : CONTROL_HEIGHT}
          paddingHorizontal={inline ? 4 : '$md'}
          borderRadius={inline ? '$sm' : '$md'}
          borderWidth={inline ? 0 : 1}
          borderColor={inline ? 'transparent' : open ? '$textSecondary' : '$border'}
          backgroundColor={inline ? 'transparent' : '$card'}
          opacity={disabled ? 0.5 : 1}
          cursor={interactive ? 'pointer' : 'default'}
          style={{ transition: CSS_TRANSITION }}
          hoverStyle={
            interactive && !inline
              ? { borderColor: open ? '$textSecondary' : '$borderStrong' }
              : undefined
          }
          pressStyle={interactive ? { opacity: 0.9 } : undefined}
          focusVisibleStyle={
            !interactive
              ? undefined
              : inline
                ? { outlineWidth: 0, outlineStyle: 'none' }
                : focusOutline
          }
          onKeyDown={(event) => {
            if (!interactive) return
            const key = (event as unknown as { key?: string }).key
            if (key === 'Enter' || key === ' ' || key === 'ArrowDown') {
              event.preventDefault()
              changeOpen(true)
            }
          }}
          tabIndex={interactive ? 0 : -1}>
          {showLeadingIcon && selectedOptions[0]?.icon ? (
            <AppIcon
              name={selectedOptions[0].icon}
              size={inline ? 16 : 18}
              color={selectedOptions[0].color ?? palette.primary}
            />
          ) : showLeadingIcon && leadingIcon ? (
            <AppIcon
              name={leadingIcon}
              size={inline ? 16 : 18}
              color={palette.muted}
            />
          ) : null}
          <Text
            flex={1}
            minWidth={0}
            fontSize={15}
            fontWeight={inline ? '600' : undefined}
            numberOfLines={1}
            color={hasSelection ? '$text' : '$tabIconDefault'}>
            {summary}
          </Text>
          {!inline && !multiple && selectedOptions[0]?.badge ? (
            <RecommendedDot label={selectedOptions[0].badge} />
          ) : null}
          {!inline && !multiple && hasSelection && interactive ? (
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
          {inline ? (
            <XStack
              className="inline-field-affordance"
              width={16}
              height={18}
              alignItems="center"
              justifyContent="center"
              flexShrink={0}>
              <AppIcon name="chevron-down" size={14} color={palette.muted} />
            </XStack>
          ) : (
            <AppIcon name="chevron-down" size={18} color={palette.muted} />
          )}
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
                if (!open) changeOpen(true)
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
