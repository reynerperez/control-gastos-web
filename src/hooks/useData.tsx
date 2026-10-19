import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useAuth } from '@/contexts/AuthContext';
import {
  AddTransactionInput,
  BreakdownItemInput,
  Budget,
  Category,
  PastPurchaseSuggestion,
  PaymentMethod,
  RecurringCharge,
  RecurringChargeInput,
  Transaction,
  TransactionType,
  UpdateTransactionInput,
} from '@/types';
import { toMonthKey } from '@/utils/format';
import { isInstallmentTransaction } from '@/utils/installments';
import { supabase } from '@/utils/supabase';

type DataContextValue = {
  categories: Category[];
  paymentMethods: PaymentMethod[];
  transactions: Transaction[];
  budgets: Budget[];
  /** Servicios/suscripciones recurrentes (proyecciones, no movimientos) */
  recurringCharges: RecurringCharge[];
  loading: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
  addTransaction: (input: AddTransactionInput) => Promise<void>;
  updateTransaction: (id: string, input: UpdateTransactionInput) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addCategory: (
    input: Omit<Category, 'id' | 'user_id' | 'created_at'>
  ) => Promise<void>;
  updateCategory: (
    id: string,
    input: Partial<Omit<Category, 'id' | 'user_id' | 'created_at'>>
  ) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  addPaymentMethod: (
    input: Omit<PaymentMethod, 'id' | 'user_id' | 'created_at'>
  ) => Promise<void>;
  updatePaymentMethod: (
    id: string,
    input: Partial<Omit<PaymentMethod, 'id' | 'user_id' | 'created_at'>>
  ) => Promise<void>;
  deletePaymentMethod: (id: string) => Promise<void>;
  /** Guarda los ítems de un desglose (reemplaza los details) y actualiza breakdown_status */
  saveBreakdown: (
    transactionId: string,
    items: BreakdownItemInput[],
    complete: boolean,
    fallback?: { description: string | null; category_id: string | null; amount: number },
    merchant?: string | null,
    newAmount?: number
  ) => Promise<void>;
  /** Busca compras pasadas por descripción para autocompletar el desglose */
  searchPastDetails: (
    query: string,
    excludeTransactionId?: string
  ) => Promise<PastPurchaseSuggestion[]>;
  setBudget: (categoryId: string, amount: number, month: Date) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  // ── Compromisos recurrentes ─────────────────────────────────────
  addRecurringCharge: (input: RecurringChargeInput) => Promise<void>;
  updateRecurringCharge: (
    id: string,
    input: Partial<RecurringChargeInput>
  ) => Promise<void>;
  deleteRecurringCharge: (id: string) => Promise<void>;
  /** Cierra un plan MSI: deja de proyectar las parcialidades restantes. */
  settleInstallmentPlan: (transactionId: string) => Promise<void>;
};

const DataContext = createContext<DataContextValue | undefined>(undefined);

const DEFAULT_CATEGORIES: Omit<Category, 'id' | 'user_id' | 'created_at'>[] = [
  { name: 'Comida', icon: 'fast-food', color: '#F97316', type: 'expense', requires_breakdown: true },
  { name: 'Transporte', icon: 'car', color: '#3B82F6', type: 'expense', requires_breakdown: false },
  { name: 'Hogar', icon: 'home', color: '#8B5CF6', type: 'expense', requires_breakdown: true },
  { name: 'Salud', icon: 'medkit', color: '#EF4444', type: 'expense', requires_breakdown: true },
  { name: 'Entretenimiento', icon: 'game-controller', color: '#EC4899', type: 'expense', requires_breakdown: false },
  { name: 'Compras', icon: 'cart', color: '#14B8A6', type: 'expense', requires_breakdown: true },
  { name: 'Servicios', icon: 'flash', color: '#F59E0B', type: 'expense', requires_breakdown: false },
  { name: 'Salario', icon: 'cash', color: '#16A34A', type: 'income', requires_breakdown: false },
  { name: 'Freelance', icon: 'laptop', color: '#0EA5E9', type: 'income', requires_breakdown: false },
  { name: 'Otros ingresos', icon: 'add-circle', color: '#22C55E', type: 'income', requires_breakdown: false },
];

const DEFAULT_PAYMENT_METHODS: Omit<PaymentMethod, 'id' | 'user_id' | 'created_at'>[] = [
  { name: 'Efectivo', type: 'cash', closing_day: null },
  { name: 'Tarjeta de Débito', type: 'debit', closing_day: null },
  { name: 'Tarjeta de Crédito', type: 'credit', closing_day: 15, grace_days: 20, grace_days_type: 'natural' },
];

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recurringCharges, setRecurringCharges] = useState<RecurringCharge[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Flags para evitar race conditions en el seed
  const seedingCats = useRef(false);
  const seedingPms = useRef(false);

  const seedDefaultCategories = useCallback(async () => {
    if (!user || seedingCats.current) return [];
    seedingCats.current = true;
    try {
      // Doble verificación: volver a consultar por si otro proceso ya sembró
      const { data: check } = await supabase
        .from('categories')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);
      if (check && check.length > 0) {
        return [];
      }
      const rows = DEFAULT_CATEGORIES.map((c) => ({ ...c, user_id: user.id }));
      const { data, error } = await supabase
        .from('categories')
        .insert(rows)
        .select();
      if (error) {
        console.error('Error creando categorías por defecto:', error.message);
        return [];
      }
      return (data as Category[]) ?? [];
    } finally {
      seedingCats.current = false;
    }
  }, [user]);

  const seedDefaultPaymentMethods = useCallback(async () => {
    if (!user || seedingPms.current) return [];
    seedingPms.current = true;
    try {
      // Doble verificación
      const { data: check } = await supabase
        .from('payment_methods')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);
      if (check && check.length > 0) {
        return [];
      }
      const rows = DEFAULT_PAYMENT_METHODS.map((p) => ({ ...p, user_id: user.id }));
      const { data, error } = await supabase
        .from('payment_methods')
        .insert(rows)
        .select();
      if (error) {
        console.error('Error creando métodos de pago por defecto:', error.message);
        return [];
      }
      return (data as PaymentMethod[]) ?? [];
    } finally {
      seedingPms.current = false;
    }
  }, [user]);

  const loadAll = useCallback(async () => {
    if (!user) return;

    const [catRes, pmRes, txRes, budgetRes, recurringRes] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('payment_methods').select('*').order('name'),
      supabase
        .from('transactions')
        .select('*, details:transaction_details(*, category:categories(*)), payment_method:payment_methods(*)')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('budgets').select('*, category:categories(*)'),
      supabase
        .from('recurring_charges')
        .select('*, category:categories(*), payment_method:payment_methods(*)')
        .order('active', { ascending: false })
        .order('name'),
    ]);

    if (catRes.error) console.error(catRes.error.message);
    if (pmRes.error) console.error(pmRes.error.message);
    if (txRes.error) console.error(txRes.error.message);
    if (budgetRes.error) console.error(budgetRes.error.message);
    // La tabla puede no existir si aún no se aplicó la migración: la app
    // sigue funcionando y solo se muestra el estado vacío de compromisos.
    if (recurringRes.error) console.warn(recurringRes.error.message);

    // Seed default categories for first-time users
    let cats = (catRes.data as Category[]) ?? [];
    if (cats.length === 0) {
      cats = await seedDefaultCategories();
      // Si el seed no devolvió datos (otro proceso ya sembró), recargar
      if (cats.length === 0) {
        const { data: recheck } = await supabase
          .from('categories')
          .select('*')
          .order('name');
        cats = (recheck as Category[]) ?? [];
      }
    }

    // Seed default payment methods for first-time users
    let pms = (pmRes.data as PaymentMethod[]) ?? [];
    if (pms.length === 0) {
      pms = await seedDefaultPaymentMethods();
      if (pms.length === 0) {
        const { data: recheck } = await supabase
          .from('payment_methods')
          .select('*')
          .order('name');
        pms = (recheck as PaymentMethod[]) ?? [];
      }
    }

    setCategories(cats);
    setPaymentMethods(pms);
    setTransactions((txRes.data as Transaction[]) ?? []);
    setBudgets((budgetRes.data as Budget[]) ?? []);
    setRecurringCharges((recurringRes.data as RecurringCharge[]) ?? []);
  }, [user, seedDefaultCategories, seedDefaultPaymentMethods]);

  useEffect(() => {
    let active = true;
    if (!user) {
      setCategories([]);
      setPaymentMethods([]);
      setTransactions([]);
      setBudgets([]);
      setRecurringCharges([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    loadAll().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [user, loadAll]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  const value = useMemo<DataContextValue>(
    () => ({
      categories,
      paymentMethods,
      transactions,
      budgets,
      recurringCharges,
      loading,
      refreshing,
      refresh,
      addTransaction: async (input) => {
        if (!user) return;
        const { data: tx, error: txError } = await supabase
          .from('transactions')
          .insert({
            amount: input.amount,
            type: input.type,
            breakdown_status: input.breakdown_status,
            payment_method_id: input.payment_method_id,
            merchant: input.merchant,
            note: input.note,
            date: input.date,
            latitude: input.latitude ?? null,
            longitude: input.longitude ?? null,
            // Los campos de MSI solo se envían cuando hay plan: así los
            // movimientos normales siguen funcionando aunque la migración
            // todavía no se haya aplicado en el proyecto.
            ...(input.purchase_type === 'installments'
              ? {
                  purchase_type: 'installments',
                  installments_count: input.installments_count ?? null,
                  installments_start_date: input.installments_start_date ?? null,
                }
              : {}),
            user_id: user.id,
          })
          .select()
          .single();
        if (txError) throw new Error(txError.message);

        // Crear el primer detail con la categoría y concepto seleccionados
        const { error: dtError } = await supabase
          .from('transaction_details')
          .insert({
            transaction_id: tx.id,
            category_id: input.category_id,
            description: input.description ?? input.note,
            quantity: 1,
            unit_price: input.amount,
          });
        if (dtError) throw new Error(dtError.message);

        await loadAll();
      },
      updateTransaction: async (id, input) => {
        // Verificar si la transacción tiene desglose completado
        const tx = transactions.find((t) => t.id === id);
        const hasBreakdown = tx?.breakdown_status === 'completed' && (tx?.details?.length ?? 0) > 1;

        // Actualizar campos de la transacción
        // Si tiene desglose, NO permitir sobreescribir amount ni category_id
        const updateFields: Record<string, unknown> = {};
        if (!hasBreakdown && input.amount !== undefined) updateFields.amount = input.amount;
        if (input.type !== undefined) updateFields.type = input.type;
        if (input.breakdown_status !== undefined) updateFields.breakdown_status = input.breakdown_status;
        if (input.payment_method_id !== undefined) updateFields.payment_method_id = input.payment_method_id;
        if (input.merchant !== undefined) updateFields.merchant = input.merchant;
        if (input.note !== undefined) updateFields.note = input.note;
        if (input.date !== undefined) updateFields.date = input.date;
        if (input.purchase_type !== undefined) updateFields.purchase_type = input.purchase_type;
        if (input.installments_count !== undefined) {
          updateFields.installments_count = input.installments_count;
        }
        if (input.installments_start_date !== undefined) {
          updateFields.installments_start_date = input.installments_start_date;
        }

        if (Object.keys(updateFields).length > 0) {
          const { error } = await supabase
            .from('transactions')
            .update(updateFields)
            .eq('id', id);
          if (error) throw new Error(error.message);
        }

        // Actualizar el primer detail (si existe y NO hay desglose)
        if (!hasBreakdown && (input.category_id !== undefined || input.amount !== undefined || input.description !== undefined)) {
          const { data: details, error: getError } = await supabase
            .from('transaction_details')
            .select('id, unit_price')
            .eq('transaction_id', id)
            .order('created_at')
            .limit(1);
          if (getError) throw new Error(getError.message);

          if (details && details.length > 0) {
            const detailUpdate: Record<string, unknown> = {};
            if (input.category_id !== undefined) detailUpdate.category_id = input.category_id;
            if (input.amount !== undefined) detailUpdate.unit_price = input.amount;
            if (input.description !== undefined) detailUpdate.description = input.description;

            const { error } = await supabase
              .from('transaction_details')
              .update(detailUpdate)
              .eq('id', details[0].id);
            if (error) throw new Error(error.message);
          } else if (input.category_id !== undefined && input.amount !== undefined) {
            const { error } = await supabase
              .from('transaction_details')
              .insert({
                transaction_id: id,
                category_id: input.category_id,
                quantity: 1,
                unit_price: input.amount,
              });
            if (error) throw new Error(error.message);
          }
        }

        await loadAll();
      },
      deleteTransaction: async (id) => {
        const { error } = await supabase.from('transactions').delete().eq('id', id);
        if (error) throw new Error(error.message);
        setTransactions((prev) => prev.filter((t) => t.id !== id));
      },
      addCategory: async (input) => {
        if (!user) return;
        // Validar que no exista una categoría con el mismo nombre y tipo
        const { data: existing } = await supabase
          .from('categories')
          .select('id')
          .eq('user_id', user.id)
          .eq('name', input.name.trim())
          .eq('type', input.type)
          .limit(1);
        if (existing && existing.length > 0) {
          throw new Error(`Ya existe una categoría "${input.name.trim()}" de tipo ${input.type === 'expense' ? 'gasto' : 'ingreso'}.`);
        }
        const { error } = await supabase
          .from('categories')
          .insert({ ...input, user_id: user.id, name: input.name.trim() });
        if (error) throw new Error(error.message);
        await loadAll();
      },
      updateCategory: async (id, input) => {
        // Si se está cambiando el nombre, validar que no exista otro con el mismo nombre
        if (input.name && user) {
          const cat = categories.find((c) => c.id === id);
          const { data: existing } = await supabase
            .from('categories')
            .select('id')
            .eq('user_id', user.id)
            .eq('name', input.name.trim())
            .eq('type', cat?.type ?? 'expense')
            .neq('id', id)
            .limit(1);
          if (existing && existing.length > 0) {
            throw new Error(`Ya existe otra categoría "${input.name.trim()}" con el mismo tipo.`);
          }
          input = { ...input, name: input.name.trim() };
        }
        const { error } = await supabase
          .from('categories')
          .update(input)
          .eq('id', id);
        if (error) throw new Error(error.message);
        await loadAll();
      },
      deleteCategory: async (id) => {
        const { error } = await supabase.from('categories').delete().eq('id', id);
        if (error) throw new Error(error.message);
        await loadAll();
      },
      addPaymentMethod: async (input) => {
        if (!user) return;
        // Validar que no exista un método de pago con el mismo nombre
        const { data: existing } = await supabase
          .from('payment_methods')
          .select('id')
          .eq('user_id', user.id)
          .eq('name', input.name.trim())
          .limit(1);
        if (existing && existing.length > 0) {
          throw new Error(`Ya existe un método de pago "${input.name.trim()}".`);
        }
        const { error } = await supabase
          .from('payment_methods')
          .insert({ ...input, user_id: user.id, name: input.name.trim() });
        if (error) throw new Error(error.message);
        await loadAll();
      },
      updatePaymentMethod: async (id, input) => {
        const { error } = await supabase
          .from('payment_methods')
          .update(input)
          .eq('id', id);
        if (error) throw new Error(error.message);
        await loadAll();
      },
      deletePaymentMethod: async (id) => {
        const { error } = await supabase.from('payment_methods').delete().eq('id', id);
        if (error) throw new Error(error.message);
        await loadAll();
      },
      saveBreakdown: async (transactionId, items, complete, fallback, merchant, newAmount) => {
        if (!user) return;

        // Reemplazamos los details actuales por los ítems del desglose.
        // Siempre garantizamos al menos 1 detail (regla de negocio): si items
        // está vacío, restauramos el detail placeholder con el total.
        const { error: delError } = await supabase
          .from('transaction_details')
          .delete()
          .eq('transaction_id', transactionId);
        if (delError) throw new Error(delError.message);

        let rows: Record<string, unknown>[];
        if (items.length > 0) {
          rows = items.map((i) => ({
            transaction_id: transactionId,
            category_id: i.category_id,
            description: i.description,
            quantity: 1,
            unit_price: i.amount,
          }));
        } else if (fallback) {
          rows = [
            {
              transaction_id: transactionId,
              category_id: fallback.category_id,
              description: fallback.description,
              quantity: 1,
              unit_price: fallback.amount,
            },
          ];
        } else {
          rows = [];
        }

        if (rows.length > 0) {
          const { error: insError } = await supabase
            .from('transaction_details')
            .insert(rows);
          if (insError) throw new Error(insError.message);
        }

        // Actualizar la transacción: estado, merchant y (opcionalmente) el monto
        const txUpdate: Record<string, unknown> = {
          breakdown_status: complete ? 'completed' : 'pending',
        };
        if (merchant !== undefined) txUpdate.merchant = merchant;
        // Si el desglose supera el total, sobrescribir el monto
        if (newAmount !== undefined && newAmount !== null) {
          txUpdate.amount = Math.round(newAmount * 100) / 100;
        }

        const { error: updError } = await supabase
          .from('transactions')
          .update(txUpdate)
          .eq('id', transactionId);
        if (updError) throw new Error(updError.message);

        await loadAll();
      },
      searchPastDetails: async (query, excludeTransactionId) => {
        if (!user || query.trim().length < 2) return [];
        let q = supabase
          .from('transaction_details')
          .select(
            'description, unit_price, category_id, category:categories(*)'
          )
          .ilike('description', `%${query.trim()}%`)
          .not('description', 'is', null)
          .order('created_at', { ascending: false })
          .limit(15);
        if (excludeTransactionId) {
          q = q.neq('transaction_id', excludeTransactionId);
        }
        const { data, error } = await q;
        if (error) {
          console.error('Error buscando compras pasadas:', error.message);
          return [];
        }
        // Deduplicamos por descripción
        const seen = new Set<string>();
        const out: PastPurchaseSuggestion[] = [];
        for (const d of (data ?? []) as any[]) {
          const desc = String(d.description ?? '').trim();
          if (!desc || seen.has(desc)) continue;
          seen.add(desc);
          out.push({
            description: desc,
            category_id: d.category_id,
            unit_price: Number(d.unit_price),
            category: d.category,
          });
        }
        return out.slice(0, 6);
      },
      setBudget: async (categoryId, amount, month) => {
        if (!user) return;
        const monthKey = toMonthKey(month);
        const { error } = await supabase.from('budgets').upsert(
          {
            user_id: user.id,
            category_id: categoryId,
            amount,
            month: monthKey,
          },
          { onConflict: 'user_id,category_id,month' }
        );
        if (error) throw new Error(error.message);
        await loadAll();
      },
      deleteBudget: async (id) => {
        const { error } = await supabase.from('budgets').delete().eq('id', id);
        if (error) throw new Error(error.message);
        setBudgets((prev) => prev.filter((b) => b.id !== id));
      },
      // ── Compromisos recurrentes ─────────────────────────────────
      addRecurringCharge: async (input) => {
        if (!user) return;
        if (!input.name.trim()) throw new Error('Escribe un nombre para el compromiso.');
        if (!input.amount || input.amount <= 0) {
          throw new Error('El monto debe ser mayor a cero.');
        }
        if (input.charge_day < 1 || input.charge_day > 31) {
          throw new Error('El día de cobro debe estar entre 1 y 31.');
        }
        const { error } = await supabase.from('recurring_charges').insert({
          ...input,
          user_id: user.id,
          name: input.name.trim(),
        });
        if (error) throw new Error(error.message);
        await loadAll();
      },
      updateRecurringCharge: async (id, input) => {
        if (input.name !== undefined && !input.name.trim()) {
          throw new Error('Escribe un nombre para el compromiso.');
        }
        if (input.amount !== undefined && input.amount <= 0) {
          throw new Error('El monto debe ser mayor a cero.');
        }
        if (
          input.charge_day !== undefined &&
          (input.charge_day < 1 || input.charge_day > 31)
        ) {
          throw new Error('El día de cobro debe estar entre 1 y 31.');
        }
        const payload: Record<string, unknown> = { ...input };
        if (input.name !== undefined) payload.name = input.name.trim();
        const { error } = await supabase
          .from('recurring_charges')
          .update(payload)
          .eq('id', id);
        if (error) throw new Error(error.message);
        await loadAll();
      },
      deleteRecurringCharge: async (id) => {
        const { error } = await supabase.from('recurring_charges').delete().eq('id', id);
        if (error) throw new Error(error.message);
        setRecurringCharges((prev) => prev.filter((charge) => charge.id !== id));
      },
      /**
       * Liquida anticipadamente un plan MSI. No crea el movimiento de pago:
       * solo cierra la proyección para que deje de aparecer en los periodos.
       * El usuario registra el pago real con "Nuevo movimiento".
       */
      settleInstallmentPlan: async (transactionId) => {
        const transaction = transactions.find((entry) => entry.id === transactionId);
        if (!isInstallmentTransaction(transaction)) {
          throw new Error('Este movimiento no tiene un plan de MSI activo.');
        }
        const { error } = await supabase
          .from('transactions')
          .update({
            installments_paid: transaction.installments_count,
            installments_settled_at: new Date().toISOString(),
          })
          .eq('id', transactionId);
        if (error) throw new Error(error.message);
        await loadAll();
      },
    }),
    [
      categories,
      paymentMethods,
      transactions,
      budgets,
      recurringCharges,
      loading,
      refreshing,
      refresh,
      user,
      loadAll,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error('useData debe usarse dentro de un DataProvider');
  }
  return ctx;
}

export type { TransactionType };
