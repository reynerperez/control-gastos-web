/**
 * constants/theme.ts
 *
 * Capa de compatibilidad — re-exporta todos los tokens de Tamagui.
 * SI QUIERES CAMBIAR UN COLOR/SPACING/RADIUS → edita `tamagui.config.ts`.
 *
 * Este archivo existe para que los 14+ archivos que importan
 * `from '@/constants/theme'` sigan funcionando sin cambios.
 */

import tamaguiConfig from '../tamagui.config';

// ═══════════════════════════════════════════════════════════════
// 🎨 PALETA — derivada del config de Tamagui
// ═══════════════════════════════════════════════════════════════

const t = tamaguiConfig.tokens;

export const palette = {
  primary: t.color.primary.val,
  primaryDark: t.color.primaryDark.val,
  primaryLight: t.color.primaryLight.val,
  income: t.color.income.val,
  incomeLight: t.color.incomeLight.val,
  expense: t.color.expense.val,
  expenseLight: t.color.expenseLight.val,
  warning: t.color.warning.val,
  surfaceHover: t.color.surfaceHover.val,
  borderStrong: t.color.borderStrong.val,
  muted: t.color.tabIconDefault.val,
  text: t.color.text.val,
  textSecondary: t.color.textSecondary.val,
  white: t.color.white.val,
  black: t.color.black.val,
};

// ═══════════════════════════════════════════════════════════════
// 🌓 TEMAS — derivados de los themes de Tamagui
// ═══════════════════════════════════════════════════════════════

const lt = tamaguiConfig.themes.light;
const dk = tamaguiConfig.themes.dark;

const light = {
  ...palette,
  primary: lt.primary.val,
  primaryLight: lt.primaryLight.val,
  text: lt.text.val,
  textSecondary: lt.textSecondary.val,
  background: lt.background.val,
  card: lt.card.val,
  surfaceHover: lt.surfaceHover.val,
  border: lt.border.val,
  borderStrong: lt.borderStrong.val,
  tint: lt.tint.val,
  tabIconDefault: lt.tabIconDefault.val,
  tabIconSelected: lt.tabIconSelected.val,
  income: lt.income.val,
  expense: lt.expense.val,
};

const dark = {
  ...palette,
  primary: dk.primary.val,
  primaryLight: dk.primaryLight.val,
  text: dk.text.val,
  textSecondary: dk.textSecondary.val,
  background: dk.background.val,
  card: dk.card.val,
  surfaceHover: dk.surfaceHover.val,
  border: dk.border.val,
  borderStrong: dk.borderStrong.val,
  tint: dk.tint.val,
  tabIconDefault: dk.tabIconDefault.val,
  tabIconSelected: dk.tabIconSelected.val,
  income: dk.income.val,
  expense: dk.expense.val,
};

export const Colors = { light, dark };

export type ThemeColors = typeof light;

// ═══════════════════════════════════════════════════════════════
// 📐 SPACING — derivado de Tamagui tokens
// ═══════════════════════════════════════════════════════════════

export const spacing = {
  xs: t.space.xs.val,
  sm: t.space.sm.val,
  md: t.space.md.val,
  lg: t.space.lg.val,
  xl: t.space.xl.val,
  xxl: t.space.xxl.val,
};

// ═══════════════════════════════════════════════════════════════
// 🔲 RADIUS — defaults de @tamagui/config
// ═══════════════════════════════════════════════════════════════

export const radius = {
  xs: t.radius.xs.val,
  sm: t.radius.sm.val,
  md: t.radius.md.val,
  lg: t.radius.lg.val,
  xl: t.radius.xl.val,
  full: t.radius.full.val,
};

// ═══════════════════════════════════════════════════════════════
// 💱 MONEDA — configuración de la app (no es token de diseño)
// ═══════════════════════════════════════════════════════════════

export const CURRENCY = {
  code: 'MXN',
  locale: 'es-MX',
  symbol: '$',
};
