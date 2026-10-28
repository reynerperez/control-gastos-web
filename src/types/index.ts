export type TransactionType = 'income' | 'expense';
export type BreakdownStatus = 'pending' | 'completed';
export type PaymentMethodType = 'debit' | 'credit' | 'cash';
/** Cómo se cuentan los días de gracia de una tarjeta. */
export type GraceDaysType = 'natural' | 'business';

/**
 * Cómo se liquidó una compra:
 *   • `one_time`     — cargo único (efectivo, débito o crédito a una exhibición).
 *   • `installments` — compra a Meses Sin Intereses. Se guarda UNA sola fila;
 *                      el calendario de parcialidades se deriva en la app.
 *
 * Los servicios/suscripciones no entran aquí: viven en `RecurringCharge`.
 */
export type PurchaseType = 'one_time' | 'installments';

/**
 * Espacio compartido (hogar). Todos los miembros ven y editan los
 * mismos datos. El código de invitación se comparte para unirse.
 */
export interface Household {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
}

export type HouseholdRole = 'owner' | 'member';

export interface HouseholdMember {
  household_id: string;
  user_id: string;
  role: HouseholdRole;
  joined_at: string;
  /** Perfil del miembro (puede faltar si la RLS aún no lo expone) */
  profile?: Profile | null;
}

export interface Category {
  id: string;
  user_id: string;
  /** Hogar al que pertenece; desde la migración de espacios compartidos. */
  household_id?: string;
  name: string;
  icon: string; // Ionicons name
  color: string;
  type: TransactionType;
  requires_breakdown: boolean;
  created_at: string;
}

export interface PaymentMethod {
  id: string;
  user_id: string;
  household_id?: string;
  name: string;
  type: PaymentMethodType;
  closing_day: number | null;
  /** A nombre de quién está la tarjeta */
  cardholder_name?: string | null;
  /** Días de gracia desde el corte */
  grace_days?: number | null;
  grace_days_type?: GraceDaysType;
  created_at: string;
}

/** Día inhábil bancario global (calendario CNBV). */
export interface Holiday {
  id: string;
  country_code: string;
  holiday_date: string; // YYYY-MM-DD
  name: string;
  source: string;
  created_at: string;
}

export interface TransactionDetail {
  id: string;
  transaction_id: string;
  category_id: string | null;
  description: string | null;
  quantity: number;
  unit_price: number;
  created_at: string;
  // Joined data (optional)
  category?: Category | null;
}

export interface Transaction {
  id: string;
  user_id: string;
  household_id?: string;
  amount: number;
  type: TransactionType;
  breakdown_status: BreakdownStatus;
  payment_method_id: string | null;
  merchant: string | null; // Comercio/tienda (obligatorio al desglosar)
  note: string | null;
  date: string; // ISO date (YYYY-MM-DD)
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  // ── Plan de Meses Sin Intereses (opcional) ──────────────────────
  purchase_type?: PurchaseType;
  /** Número total de parcialidades (2–60). null si no es MSI. */
  installments_count?: number | null;
  /** Parcialidades ya cubiertas (avance manual o liquidación). */
  installments_paid?: number;
  /** Fecha de corte del primer estado de cuenta del plan (YYYY-MM-DD). */
  installments_start_date?: string | null;
  /** Si existe, el plan se liquidó anticipadamente y no se proyecta más. */
  installments_settled_at?: string | null;
  // Joined data (optional)
  details?: TransactionDetail[];
  payment_method?: PaymentMethod | null;
}

export type RecurringFrequency = 'monthly' | 'yearly';

/**
 * Compromiso recurrente indeterminado (renta, luz, internet, suscripciones).
 * No es una transacción: es una plantilla que se proyecta en el periodo de
 * pago de la tarjeta o en el mes natural, según el método elegido.
 */
export interface RecurringCharge {
  id: string;
  user_id: string;
  household_id?: string;
  name: string;
  category_id: string | null;
  payment_method_id: string | null;
  /** Monto estimado del cargo */
  amount: number;
  /** true = el monto puede variar cada mes (luz, agua…) */
  is_variable_amount: boolean;
  frequency: RecurringFrequency;
  /** Día del mes en que se cobra (1–31; se ajusta al último día si no existe) */
  charge_day: number;
  start_date: string; // YYYY-MM-DD
  end_date: string | null;
  active: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
  // Joined data (optional)
  category?: Category | null;
  payment_method?: PaymentMethod | null;
}

export type RecurringChargeInput = Omit<
  RecurringCharge,
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'category' | 'payment_method'
>;

export interface Budget {
  id: string;
  user_id: string;
  household_id?: string;
  category_id: string;
  amount: number;
  month: string; // First day of month: YYYY-MM-01
  created_at: string;
  category?: Category | null;
}

export interface Profile {
  id: string;
  full_name: string | null;
  currency: string;
  created_at: string;
}

export interface MonthlySummary {
  income: number;
  expense: number;
  balance: number;
  byCategory: {
    category: Category | null;
    total: number;
  }[];
}

/** Input for creating/updating a transaction with its details */
export interface AddTransactionInput {
  amount: number;
  type: TransactionType;
  breakdown_status: BreakdownStatus;
  payment_method_id: string | null;
  merchant: string | null; // Comercio/tienda (opcional en rápido, obligatorio al desglosar)
  note: string | null;
  date: string;
  /** Ubicación opcional donde se registró el movimiento */
  latitude?: number | null;
  longitude?: number | null;
  /** Category is now at the detail level. Internally creates one detail. */
  category_id: string | null;
  /** Description for the default detail (concepto) */
  description: string | null;
  // ── Plan MSI opcional ────────────────────────────────────────────
  purchase_type?: PurchaseType;
  installments_count?: number | null;
  installments_start_date?: string | null;
}

/** Input for updating details of an existing transaction */
export interface UpdateTransactionInput {
  amount?: number;
  type?: TransactionType;
  breakdown_status?: BreakdownStatus;
  payment_method_id?: string | null;
  merchant?: string | null;
  note?: string | null;
  date?: string;
  /** Category for the primary detail */
  category_id?: string | null;
  /** Description to update on the first detail */
  description?: string | null;
  // ── Plan MSI opcional ────────────────────────────────────────────
  purchase_type?: PurchaseType;
  installments_count?: number | null;
  installments_start_date?: string | null;
}

/** Un ítem del desglose de un ticket (uno o más por transacción). */
export interface BreakdownItemInput {
  description: string | null; // obligatorio para cada ítem
  category_id: string | null;
  amount: number;
}

/** Sugerencia de compras pasadas para autocompletar el desglose. */
export interface PastPurchaseSuggestion {
  description: string;
  category_id: string | null;
  unit_price: number;
  category?: Category | null;
}
