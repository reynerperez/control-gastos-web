import { useEffect, useRef, useState } from 'react'
import { Input, XStack } from 'tamagui'

import { AppIcon } from '@/components/ui/Icon'
import { CONTROL_HEIGHT, focusRing, CSS_TRANSITION } from '@/constants/ui'
import { toISODate } from '@/utils/format'

/**
 * DateField — entrada de fecha consistente para toda la app.
 *
 * - Se puede escribir directamente en formato DD/MM/AAAA (el usuario teclea
 *   solo números y las barras se insertan solas).
 * - El botón de calendario abre el selector nativo (`showPicker`) para quien
 *   prefiera el ratón.
 * - Devuelve siempre una fecha ISO (YYYY-MM-DD) o '' si está vacía.
 */

type Props = {
  value: string
  onChange: (iso: string) => void
  ariaLabel: string
  disabled?: boolean
  error?: boolean
  min?: string
  max?: string
}

const formatDisplay = (iso: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : ''
}

const maskDisplay = (raw: string) => {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

const parseDisplay = (text: string): string | null => {
  const digits = text.replace(/\D/g, '')
  if (digits.length !== 8) return null
  const day = Number(digits.slice(0, 2))
  const month = Number(digits.slice(2, 4))
  const year = Number(digits.slice(4, 8))
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return toISODate(date)
}

export function DateField({
  value,
  onChange,
  ariaLabel,
  disabled = false,
  error = false,
  min,
  max,
}: Props) {
  const [text, setText] = useState(() => formatDisplay(value))
  const [invalid, setInvalid] = useState(false)
  const nativeRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setText(formatDisplay(value))
    setInvalid(false)
  }, [value])

  const commit = (nextText: string) => {
    setText(nextText)
    setInvalid(false)
    const digits = nextText.replace(/\D/g, '')
    if (digits.length === 0) {
      onChange('')
      return
    }
    if (digits.length < 8) return
    const iso = parseDisplay(nextText)
    if (iso) {
      onChange(iso)
    } else {
      setInvalid(true)
    }
  }

  const openNativePicker = () => {
    if (disabled) return
    const input = nativeRef.current
    if (!input) return
    try {
      ;(input as HTMLInputElement & { showPicker?: () => void }).showPicker?.()
    } catch {
      input.click()
    }
  }

  const hasError = error || invalid

  return (
    <XStack
      alignItems="center"
      gap="$sm"
      height={CONTROL_HEIGHT}
      paddingHorizontal="$md"
      borderRadius="$md"
      borderWidth={1}
      borderColor={hasError ? '$expense' : '$border'}
      backgroundColor="$card"
      opacity={disabled ? 0.55 : 1}
      cursor={disabled ? 'not-allowed' : 'text'}
      style={{ transition: CSS_TRANSITION }}
      hoverStyle={disabled ? undefined : { borderColor: hasError ? '$expense' : '$borderStrong' }}
      focusWithinStyle={
        hasError
          ? { ...focusRing, borderColor: '$expense' }
          : focusRing
      }>
      <Input
        unstyled
        flex={1}
        height={CONTROL_HEIGHT - 2}
        padding={0}
        fontSize={14}
        fontWeight="500"
        color="$text"
        placeholderTextColor="$tabIconDefault"
        placeholder="DD/MM/AAAA"
        value={text}
        onChangeText={(raw) => {
          // Pegar una fecha ISO directamente
          if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            const iso = raw
            setText(formatDisplay(iso))
            setInvalid(false)
            onChange(iso)
            return
          }
          commit(maskDisplay(raw))
        }}
        onBlur={() => {
          if (text.replace(/\D/g, '').length > 0 && !parseDisplay(text)) setInvalid(true)
        }}
        disabled={disabled}
        aria-label={ariaLabel}
        inputMode="numeric"
        autoComplete="off"
      />

      <XStack
        width={28}
        height={28}
        alignItems="center"
        justifyContent="center"
        borderRadius="$sm"
        cursor={disabled ? 'not-allowed' : 'pointer'}
        style={{ transition: CSS_TRANSITION }}
        hoverStyle={disabled ? undefined : { backgroundColor: '$surfaceHover' }}
        pressStyle={disabled ? undefined : { opacity: 0.6 }}
        onPress={openNativePicker}
        onKeyDown={(event) => {
          const key = (event as unknown as { key?: string }).key
          if (key === 'Enter' || key === ' ') {
            event.preventDefault()
            openNativePicker()
          }
        }}
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-label={`Abrir calendario de ${ariaLabel}`}>
        <AppIcon name="calendar-outline" size={18} color="#8A8A8A" />
      </XStack>

      {/* Input nativo oculto: abre el calendario del navegador */}
      <input
        ref={nativeRef}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(event) => {
          const iso = event.target.value
          setText(formatDisplay(iso))
          setInvalid(false)
          onChange(iso)
        }}
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
