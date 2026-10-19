import { PaymentMethodType } from '@/types';

/** Devuelve el nombre del icono (Ionicons) para un tipo de método de pago. */
export function getPaymentMethodIcon(
  type: PaymentMethodType | null | undefined
): string {
  switch (type) {
    case 'cash':
      return 'cash-outline';
    case 'credit':
      return 'card';
    case 'debit':
      return 'card-outline';
    default:
      return 'card-outline';
  }
}
