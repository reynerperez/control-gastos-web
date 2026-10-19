/**
 * utils/text.ts — helpers de presentación de texto (solo web).
 *
 * Se usan en las listas para mostrar comercios/conceptos con una
 * capitalización consistente sin destruir marcas, siglas ni nombres propios.
 */

const SMALL_WORDS = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'o', 'u',
  'con', 'en', 'a', 'al', 'por', 'para', 'sin', 'un', 'una', 'unos', 'unas',
])

/** En español los meses y días van en minúscula, salvo al inicio del texto. */
const LOWERCASE_WORDS = new Set([
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'setiembre', 'octubre', 'noviembre', 'diciembre',
  'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo',
])

/**
 * Capitaliza comercio y concepto sin romper nombres propios ni siglas:
 *  • respeta las palabras que ya traen mayúsculas ("iPhone", "CFE", "La Comer")
 *  • capitaliza las que vienen en minúsculas ("apple store" → "Apple Store")
 *  • deja en minúsculas los conectores cortos ("cena de aniversario" → "Cena de Aniversario")
 */
export function capitalizeLabel(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return trimmed
  const words = trimmed.split(/\s+/)
  return words
    .map((word, index) => {
      if (!word || /[A-ZÁÉÍÓÚÑÜ]/.test(word)) return word
      const lower = word.toLocaleLowerCase('es-MX')
      if (index > 0 && LOWERCASE_WORDS.has(lower)) return lower
      const isEdge = index === 0 || index === words.length - 1
      if (!isEdge && SMALL_WORDS.has(lower)) return lower
      return lower.charAt(0).toLocaleUpperCase('es-MX') + lower.slice(1)
    })
    .join(' ')
}

/** Iniciales para el chip de autor en pantallas angostas ("Reiner Pérez" → "RP"). */
export function getUserInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}
