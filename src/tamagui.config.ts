import { config as tamaguiDefaultConfig } from '@tamagui/config'
import { createTamagui, createTokens } from 'tamagui'

// ═══════════════════════════════════════════════════════════════
// 🎨 TOKENS — Custom tokens (no spread from @tamagui/config)
// ═══════════════════════════════════════════════════════════════

const tokens = createTokens({
  color: {
    // Default palette
    color1: '#ffffff',
    color2: '#f5f5f5',
    color3: '#e8e8e8',
    color4: '#d8d8d8',
    color5: '#cbcbcb',
    color6: '#b8b8b8',
    color7: '#8d8d8d',
    color8: '#646464',
    color9: '#484848',
    color10: '#333333',
    color11: '#222222',
    color12: '#111111',

    // Marca
    primary: '#7C83FF',
    primaryDark: '#6B72F0',
    primaryLight: '#262744',

    // Semánticos
    income: '#8FBF84',
    incomeLight: '#22301F',
    expense: '#F08A8A',
    expenseLight: '#3A2222',
    warning: '#E8C468',

    // Superficies y texto (la app es dark-first)
    text: '#EDEDED',
    textSecondary: '#A6A6A6',
    background: '#191919',
    card: '#222222',
    surfaceHover: '#2A2A2A',
    border: '#313131',
    borderStrong: '#3D3D3D',
    tint: '#9AA0FF',
    tabIconDefault: '#8A8A8A',
    tabIconSelected: '#9AA0FF',

    // Util
    white: '#FFFFFF',
    black: '#111111',
  },

  space: {
    0: 0,
    0.5: 2,
    1: 4,
    1.5: 6,
    2: 8,
    2.5: 10,
    3: 12,
    3.5: 14,
    4: 16,
    4.5: 18,
    5: 20,
    5.5: 22,
    6: 24,
    6.5: 26,
    7: 28,
    7.5: 30,
    8: 32,
    8.5: 34,
    9: 36,
    9.5: 38,
    10: 40,
    11: 44,
    12: 48,
    13: 52,
    14: 56,
    15: 60,
    16: 64,

    // Custom aliases
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    true: 16,
  },

  size: {
    0: 0,
    0.5: 2,
    1: 4,
    1.5: 6,
    2: 8,
    2.5: 10,
    3: 12,
    3.5: 14,
    4: 16,
    4.5: 18,
    5: 20,
    5.5: 22,
    6: 24,
    6.5: 26,
    7: 28,
    7.5: 30,
    8: 32,
    8.5: 34,
    9: 36,
    9.5: 38,
    10: 40,
    11: 44,
    12: 48,
    13: 52,
    14: 56,
    15: 60,
    16: 64,

    // Custom aliases
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    true: 16,
    button: 52,
  },

  radius: {
    0: 0,
    1: 2,
    2: 4,
    3: 6,
    4: 8,
    true: 6,

    // Escala única de la app (radios consistentes en toda la UI)
    xs: 4,
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
    full: 999,
  },

  zIndex: {
    0: 0,
    1: 100,
    2: 1000,
    3: 10000,
    toast: 10000,
  },
})

// ═══════════════════════════════════════════════════════════════
// 🌓 TEMAS — Light y Dark mode
// ═══════════════════════════════════════════════════════════════

const lightTheme = {
  ...tokens.color,
  primary: '#5B63E8',
  primaryDark: '#4F57D6',
  primaryLight: '#E9EAFE',
  income: '#3F7A4E',
  incomeLight: '#E6F2E8',
  expense: '#C0392B',
  expenseLight: '#FBE9E7',
  warning: '#A7791A',
  text: '#37352F',
  textSecondary: '#787774',
  background: '#F7F6F3',
  card: '#FFFFFF',
  surfaceHover: '#F1EFEA',
  border: '#E6E3DE',
  borderStrong: '#D3CFC8',
  tint: '#5B63E8',
  tabIconDefault: '#8C8C8C',
  tabIconSelected: '#5B63E8',
}

const darkTheme = {
  ...tokens.color,
}

// ═══════════════════════════════════════════════════════════════
// ⚙️ CONFIGURACIÓN FINAL
// ═══════════════════════════════════════════════════════════════

const appConfig = createTamagui({
  tokens,
  shorthands: tamaguiDefaultConfig.shorthands,
  themes: {
    light: lightTheme,
    dark: darkTheme,
  },
  fonts: tamaguiDefaultConfig.fonts,
  animations: tamaguiDefaultConfig.animations,
  media: tamaguiDefaultConfig.media,
  defaultFont: 'body',
})

export type AppConfig = typeof appConfig

// Habilita autocompletado de TypeScript para Tamagui
declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig { }
}

export default appConfig
