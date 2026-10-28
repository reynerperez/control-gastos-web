import { useLayoutEffect, useRef, type ReactNode } from 'react'
import {
  Input,
  Text,
  TextArea,
  XStack,
  YStack,
} from 'tamagui'

import { AppIcon } from '@/components/ui/Icon'
import { SearchSelect, type SelectOption } from '@/components/ui/SearchSelect'
import { palette } from '@/constants/theme'
import { CSS_TRANSITION, inlineFocusLine } from '@/constants/ui'
import type { TransactionType } from '@/types'
import { formatDateLabel } from '@/utils/format'
import { activateInlineField } from '@/utils/inlineFocus'

/**
 * Campos inline del detalle.
 *
 * La regla es que el control sea el mismo en lectura y edición: sin bordes
 * visibles, con la misma tipografía y altura. El modo bloqueado usa
 * `readOnly` (no `disabled`) para conservar la selección de texto. El hover y
 * el focus resaltan la fila; los campos de texto libre no muestran iconos de
 * edición y el layout no cambia.
 */

export function InlineAffordance({
  icon = 'pencil-outline',
  size = 13,
}: {
  icon?: string
  size?: number
}) {
  return (
    <XStack
      className="inline-field-affordance"
      width={16}
      height={18}
      alignItems="center"
      justifyContent="center"
      flexShrink={0}>
      <AppIcon name={icon} size={size} color={palette.muted} />
    </XStack>
  )
}

export function InlineRow({
  icon,
  iconNode,
  label,
  editable = false,
  active = false,
  first = false,
  last = false,
  cursor = 'text',
  children,
}: {
  icon: string
  iconNode?: ReactNode
  label: string
  editable?: boolean
  /** Mantiene el resaltado mientras un selector interno está abierto. */
  active?: boolean
  /** Primera fila de una tarjeta con esquinas redondeadas. */
  first?: boolean
  last?: boolean
  cursor?: 'text' | 'pointer' | 'default'
  children: ReactNode
}) {
  return (
    <XStack
      className={`inline-field${editable ? ' is-editable' : ''}${
        active ? ' is-active' : ''
      }`}
      alignItems="center"
      gap="$md"
      minHeight={64}
      paddingHorizontal="$lg"
      paddingVertical="$sm"
      borderTopLeftRadius={first ? '$lg' : undefined}
      borderTopRightRadius={first ? '$lg' : undefined}
      borderBottomWidth={last ? 0 : 1}
      borderBottomColor="$border"
      cursor={editable ? cursor : 'default'}
      backgroundColor={active ? '$surfaceHover' : undefined}
      style={{ transition: CSS_TRANSITION }}
      hoverStyle={editable ? { backgroundColor: '$surfaceHover' } : undefined}
      focusWithinStyle={
        editable ? { backgroundColor: '$surfaceHover', ...inlineFocusLine } : undefined
      }
      {...(active ? inlineFocusLine : {})}
      onPress={editable ? activateInlineField : undefined}>
      {iconNode ?? (
        <YStack
          width={32}
          height={32}
          borderRadius="$full"
          alignItems="center"
          justifyContent="center"
          backgroundColor="$background">
          <AppIcon name={icon} size={16} color={palette.muted} />
        </YStack>
      )}
      <YStack flex={1} minWidth={0} gap={2}>
        <Text fontSize={12} color="$tabIconDefault">
          {label}
        </Text>
        {children}
      </YStack>
    </XStack>
  )
}

export function InlineTextField({
  value,
  onChange,
  placeholder,
  editable,
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  editable: boolean
  ariaLabel: string
}) {
  return (
    <XStack alignItems="center" gap="$xs" width="100%">
      <Input
        unstyled
        flex={1}
        minWidth={0}
        height={26}
        paddingVertical={0}
        paddingHorizontal={4}
        value={value}
        onChangeText={onChange}
        readOnly={!editable}
        tabIndex={editable ? 0 : -1}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-readonly={!editable}
        fontSize={15}
        fontWeight="600"
        color="$text"
        placeholderTextColor="$tabIconDefault"
        cursor={editable ? 'text' : 'default'}
        style={{
          transition: CSS_TRANSITION,
          caretColor: editable ? 'currentColor' : 'transparent',
        }}
      />
    </XStack>
  )
}

export function InlineSelectField({
  options,
  value,
  onChange,
  placeholder,
  ariaLabel,
  emptyMessage,
  leadingIcon,
  editable,
  onOpenChange,
}: {
  options: SelectOption[]
  value: string | null
  onChange: (value: string | null) => void
  placeholder: string
  ariaLabel: string
  emptyMessage: string
  leadingIcon?: string
  editable: boolean
  onOpenChange?: (open: boolean) => void
}) {
  return (
    <SearchSelect
      variant="inline"
      readOnly={!editable}
      showLeadingIcon={false}
      ariaLabel={ariaLabel}
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      emptyMessage={emptyMessage}
      leadingIcon={leadingIcon}
      onOpenChange={onOpenChange}
    />
  )
}

export function InlineAmountField({
  value,
  onChange,
  editable,
  type,
}: {
  value: string
  onChange: (value: string) => void
  editable: boolean
  type: TransactionType
}) {
  const isIncome = type === 'income'
  const color = isIncome ? palette.income : palette.expense
  const sign = isIncome ? '+' : '-'
  const width = Math.max(110, Math.min(240, value.length * 26 + 8))

  return (
    <XStack
      className={editable ? 'inline-field is-editable' : 'inline-field'}
      position="relative"
      alignItems="center"
      justifyContent="center"
      gap={2}
      minHeight={58}
      paddingHorizontal="$md"
      borderRadius="$md"
      style={{ transition: CSS_TRANSITION }}
      hoverStyle={editable ? { backgroundColor: '$surfaceHover' } : undefined}
      focusWithinStyle={
        editable ? { backgroundColor: '$surfaceHover', ...inlineFocusLine } : undefined
      }
      onPress={editable ? activateInlineField : undefined}>
      <Text fontSize={42} fontWeight="800" lineHeight={50} color={color}>
        {sign}
      </Text>
      <Text fontSize={42} fontWeight="800" lineHeight={50} color={color}>
        $
      </Text>
      <Input
        unstyled
        width={width}
        height={56}
        padding={0}
        value={value}
        onChangeText={onChange}
        readOnly={!editable}
        tabIndex={editable ? 0 : -1}
        inputMode="decimal"
        aria-label="Monto"
        aria-readonly={!editable}
        textAlign="center"
        fontSize={42}
        fontWeight="800"
        color={color}
        cursor={editable ? 'text' : 'default'}
        style={{
          transition: CSS_TRANSITION,
          caretColor: editable ? 'currentColor' : 'transparent',
        }}
      />
      <XStack
        position="absolute"
        right="$md"
        top={0}
        bottom={0}
        alignItems="center"
        pointerEvents="none">
        <InlineAffordance />
      </XStack>
    </XStack>
  )
}

export function InlineTypeField({ value }: { value: TransactionType }) {
  const isIncome = value === 'income'
  const color = isIncome ? palette.income : palette.expense

  return (
    <XStack
      alignItems="center"
      paddingHorizontal="$md"
      paddingVertical="$xs"
      borderRadius="$full"
      backgroundColor={isIncome ? '$incomeLight' : '$expenseLight'}
      aria-label={`Tipo de movimiento: ${isIncome ? 'Ingreso' : 'Gasto'}`}>
      <Text
        fontSize={12}
        fontWeight="800"
        textTransform="uppercase"
        letterSpacing={0.5}
        color={color}>
        {isIncome ? 'Ingreso' : 'Gasto'}
      </Text>
    </XStack>
  )
}

export function InlineDateField({
  value,
  onChange,
  editable,
}: {
  value: string
  onChange: (value: string) => void
  editable: boolean
}) {
  const nativeRef = useRef<HTMLInputElement | null>(null)

  const openPicker = () => {
    if (!editable) return
    const input = nativeRef.current
    if (!input) return
    try {
      ;(input as HTMLInputElement & { showPicker?: () => void }).showPicker?.()
    } catch {
      input.click()
    }
  }

  return (
    <XStack
      className={editable ? 'inline-field is-editable' : 'inline-field'}
      alignItems="center"
      gap="$xs"
      height={26}
      maxWidth={220}
      paddingHorizontal="$sm"
      borderRadius="$sm"
      cursor={editable ? 'pointer' : 'default'}
      role={editable ? 'button' : undefined}
      aria-label="Fecha"
      tabIndex={editable ? 0 : -1}
      style={{ transition: CSS_TRANSITION }}
      hoverStyle={editable ? { backgroundColor: '$surfaceHover' } : undefined}
      focusStyle={editable ? inlineFocusLine : undefined}
      focusVisibleStyle={editable ? inlineFocusLine : undefined}
      onPress={openPicker}
      onKeyDown={(event) => {
        if (!editable) return
        const key = (event as unknown as { key?: string }).key
        if (key === 'Enter' || key === ' ') {
          event.preventDefault()
          openPicker()
        }
      }}>
      <Text flex={1} fontSize={14} color="$tabIconDefault" numberOfLines={1}>
        {value ? formatDateLabel(value) : 'Sin fecha'}
      </Text>
      <InlineAffordance icon="calendar-outline" />
      <input
        ref={nativeRef}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        tabIndex={-1}
        aria-hidden
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: 'none',
          border: 0,
          padding: 0,
        }}
      />
    </XStack>
  )
}

export function InlineNoteField({
  value,
  onChange,
  editable,
}: {
  value: string
  onChange: (value: string) => void
  editable: boolean
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.max(element.scrollHeight, 24)}px`
  }, [value])

  return (
    <TextArea
      ref={ref as never}
      unstyled
      width="100%"
      minHeight={24}
      paddingVertical={0}
      paddingHorizontal={4}
      value={value}
      onChangeText={onChange}
      readOnly={!editable}
      tabIndex={editable ? 0 : -1}
      placeholder={editable ? 'Escribe una nota…' : 'Sin nota'}
      aria-label="Nota"
      aria-readonly={!editable}
      fontSize={15}
      lineHeight={22}
      color="$text"
      placeholderTextColor="$tabIconDefault"
      cursor={editable ? 'text' : 'default'}
      style={{
        overflow: 'hidden',
        resize: 'none',
        transition: CSS_TRANSITION,
        caretColor: editable ? 'currentColor' : 'transparent',
      }}
    />
  )
}
