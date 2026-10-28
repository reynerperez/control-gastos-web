const INLINE_INTERACTIVE_SELECTOR =
  'input, textarea, select, button, a, [role="button"], [role="listbox"], [role="option"], [contenteditable="true"]'

const INLINE_CONTROL_SELECTOR =
  'input:not([readonly]):not([disabled]), textarea:not([readonly]):not([disabled]), [role="button"][aria-haspopup="listbox"][tabindex="0"], [role="button"][tabindex="0"]'

/**
 * Hace que toda la zona con hover sea un blanco válido: si el clic cae fuera
 * del control real, enfoca el primer campo editable (o abre el selector) en
 * lugar de obligar a apuntar al input exacto.
 */
export function activateInlineField(event: unknown) {
  const { target, currentTarget } = event as {
    target?: EventTarget | null
    currentTarget?: EventTarget | null
  }

  if (target instanceof Element && target.closest(INLINE_INTERACTIVE_SELECTOR)) {
    return
  }
  if (!(currentTarget instanceof Element)) return

  const control = currentTarget.querySelector<HTMLElement>(INLINE_CONTROL_SELECTOR)
  if (!control) return

  // Los selectores inline se abren con el mismo gesto que el resto de la fila.
  if (control.getAttribute('role') === 'button') {
    control.click()
    return
  }

  control.focus()
  if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
    const end = control.value.length
    try {
      control.setSelectionRange(end, end)
    } catch {
      // Algunos tipos de input no permiten selección programática.
    }
  }
}
