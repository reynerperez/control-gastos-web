import { palette } from '@/constants/theme';
import { PaymentMethodType } from '@/types';

/** Devuelve el nombre del icono (Ionicons) para un tipo de método de pago. */
export function getPaymentMethodIcon(
  type: PaymentMethodType | null | undefined
): string {
  switch (type) {
    case 'cash':
      return 'cash-outline';
    case 'departmental':
    case 'credit':
      return 'card';
    case 'debit':
      return 'card-outline';
    default:
      return 'card-outline';
  }
}

/** Tarjetas con corte y pago diferido, incluidas las departamentales. */
export function isFinancedPaymentMethod(
  type: PaymentMethodType | null | undefined
): boolean {
  return type === 'credit' || type === 'departmental';
}

/** Etiqueta del tipo de método de pago para la interfaz. */
export function getPaymentMethodLabel(type: PaymentMethodType): string {
  switch (type) {
    case 'credit': return 'Crédito';
    case 'departmental': return 'Departamental';
    case 'debit': return 'Débito';
    case 'cash': return 'Efectivo';
  }
}

/** Color compartido por listas, formularios y filtros de métodos de pago. */
export function getPaymentMethodColor(type: PaymentMethodType): string {
  switch (type) {
    case 'cash': return palette.income;
    case 'departmental': return palette.expense;
    case 'credit': return palette.warning;
    case 'debit': return palette.primary;
  }
}
