import { PaymentMethodType } from '@/types'

/** Colores disponibles para las categorías (selector de Ajustes) */
export const COLOR_OPTIONS = [
  '#F97316',
  '#3B82F6',
  '#8B5CF6',
  '#EF4444',
  '#EC4899',
  '#14B8A6',
  '#F59E0B',
  '#16A34A',
  '#0EA5E9',
  '#22C55E',
  '#A855F7',
  '#64748B',
]

/** Tipos de método de pago con su etiqueta */
export const PAYMENT_TYPE_OPTIONS: { key: PaymentMethodType; label: string }[] = [
  { key: 'cash', label: 'Efectivo' },
  { key: 'debit', label: 'Débito' },
  { key: 'credit', label: 'Crédito' },
]
