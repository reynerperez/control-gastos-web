import { Colors, type ThemeColors } from '@/constants/theme'

/**
 * hooks/useTheme.ts — versión web.
 *
 * La app web es dark-only: `colors` siempre devuelve la paleta del tema
 * oscuro de `tamagui.config.ts` (misma firma que la app móvil, para poder
 * copiar componentes entre ambos proyectos sin cambios).
 */
export function useTheme(): { colors: ThemeColors; scheme: 'light' | 'dark' } {
  return { colors: Colors.dark, scheme: 'dark' }
}
