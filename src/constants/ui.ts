/**
 * constants/ui.ts — tokens visuales de la web.
 *
 * Centraliza alturas de controles, sombras, jerarquía tipográfica y la
 * transición estándar para que las pantallas se sientan coherentes y
 * fluidas sin repetir valores mágicos.
 */

/** Altura estándar de inputs, selects y botones */
export const CONTROL_HEIGHT = 44

/** Escala única de radios (coincide con los tokens de Tamagui) */
export const RADIUS = { xs: 4, sm: 6, md: 8, lg: 12, xl: 16, full: 999 } as const

/** Sombras sutiles (elevación) */
export const shadow = {
  /** Tarjetas y filas elevadas */
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  /** Superficies flotantes: modales y popovers */
  raised: {
    shadowColor: '#000000',
    shadowOpacity: 0.34,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
  },
  /** Elementos pequeños (botones, chips, inputs) */
  soft: {
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
} as const

/** Indicador de foco con caja: borde neutro claro, sin halo. */
export const focusRing = {
  borderColor: '$textSecondary',
  outlineWidth: 0,
  outlineStyle: 'none',
} as const

/** Foco para controles sin caja visible: línea neutra sólida por fuera. */
export const focusOutline = {
  outlineWidth: 2,
  outlineColor: '$textSecondary',
  outlineOffset: 2,
  outlineStyle: 'solid',
} as const

/** Foco de filas inline: línea neutra del mismo grosor que un borde. */
export const inlineFocusLine = {
  outlineWidth: 1,
  outlineColor: '$textSecondary',
  outlineOffset: -1,
  outlineStyle: 'solid',
} as const

/** Transición CSS estándar (web) */
export const CSS_TRANSITION =
  'background-color 160ms ease, border-color 160ms ease, color 160ms ease, opacity 160ms ease, box-shadow 160ms ease, transform 160ms ease'

/** Jerarquía tipográfica */
export const TYPO = {
  screenTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  section: { fontSize: 16, fontWeight: '700', letterSpacing: -0.1 },
  cardTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.1 },
  body: { fontSize: 14, fontWeight: '500' },
  bodyStrong: { fontSize: 14, fontWeight: '700' },
  caption: { fontSize: 12, fontWeight: '500' },
  micro: { fontSize: 11, fontWeight: '600' },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  amount: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  amountLarge: { fontSize: 32, fontWeight: '800', letterSpacing: -0.6 },
} as const
