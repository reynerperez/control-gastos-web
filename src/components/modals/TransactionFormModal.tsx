import { useEffect, useMemo, useRef, useState } from 'react'
import { Text, XStack, YStack } from 'tamagui'

import { Button } from '@/components/ui/Button'
import { DateField } from '@/components/ui/DateField'
import { FormError, FormSection, SectionLabel, TextInput } from '@/components/ui/Field'
import { AppIcon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { SearchSelect, type SelectOption } from '@/components/ui/SearchSelect'
import { palette } from '@/constants/theme'
import { CSS_TRANSITION } from '@/constants/ui'
import { useHolidays } from '@/contexts/HolidaysContext'
import { useData } from '@/hooks/useData'
import { PaymentMethodType, TransactionType } from '@/types'
import {
  getBestCreditCard,
  getCreditCardPlans,
  getStatementPeriod,
} from '@/utils/creditCardRecommendation'
import { formatCurrency, toISODate } from '@/utils/format'
import {
  getInstallmentPlan,
  isInstallmentTransaction,
  splitAmount,
} from '@/utils/installments'
import { getCurrentCoords } from '@/utils/location'
import { getPaymentMethodIcon } from '@/utils/paymentMethod'

/** Color del método de pago según su tipo (misma lógica que en la lista) */
const paymentMethodColor = (type: PaymentMethodType) =>
  type === 'credit' ? palette.warning : type === 'debit' ? palette.primary : palette.muted

const paymentMethodLabel = (type: PaymentMethodType) =>
  type === 'credit' ? 'Crédito' : type === 'debit' ? 'Débito' : 'Efectivo'

type Props = {
  open: boolean
  transactionId?: string
  onClose: () => void
  onOpenBreakdown: (id: string) => void
}

/**
 * Alta / edición de movimientos — mismo comportamiento que
 * `app/transaction-modal.tsx` del móvil:
 *   • Modo simple: todos los campos editables.
 *   • Modo desglosado: solo comercio, fecha y método de pago
 *     (los ítems se editan en el desglose).
 */
export function TransactionFormModal({ open, transactionId, onClose, onOpenBreakdown }: Props) {
  if (!open) return null
  return (
    <TransactionFormDialog
      key={transactionId ?? 'nuevo'}
      transactionId={transactionId}
      onClose={onClose}
      onOpenBreakdown={onOpenBreakdown}
    />
  )
}

function TransactionFormDialog({
  transactionId,
  onClose,
  onOpenBreakdown,
}: Omit<Props, 'open'>) {
  const {
    transactions,
    categories,
    paymentMethods,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  } = useData()
  const { holidays } = useHolidays()

  const editing = transactionId ? transactions.find((item) => item.id === transactionId) : undefined

  const [type, setType] = useState<TransactionType>(editing?.type ?? 'expense')
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '')
  const [concepto, setConcepto] = useState(editing?.details?.[0]?.description ?? '')
  const [merchant, setMerchant] = useState(editing?.merchant ?? '')
  const [categoryId, setCategoryId] = useState<string | null>(editing?.details?.[0]?.category_id ?? null)
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(() => {
    if (editing) return editing.payment_method_id ?? null
    // Preselección inteligente: la tarjeta con más días de financiamiento
    return getBestCreditCard(paymentMethods, holidays)?.method.id ?? null
  })
  const [date, setDate] = useState(editing?.date ?? toISODate(new Date()))
  const [note, setNote] = useState(editing?.note ?? '')
  const [requiresBreakdown, setRequiresBreakdown] = useState(
    editing?.breakdown_status === 'pending'
  )
  const editingPlan = isInstallmentTransaction(editing)
  const [isMSI, setIsMSI] = useState(editingPlan)
  const [installmentsInput, setInstallmentsInput] = useState(
    editingPlan ? String(editing?.installments_count ?? 3) : '3'
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isBrokenDown =
    editing?.breakdown_status === 'completed' && (editing?.details?.length ?? 0) > 1

  const selectedMethod = paymentMethods.find((method) => method.id === paymentMethodId)
  const supportsMSI =
    !editingPlan && type === 'expense' && selectedMethod?.type === 'credit'
  const installmentCount = parseInt(installmentsInput, 10)
  const parsedAmount = parseFloat(amount.replace(',', '.')) || 0
  const installmentPreview =
    isMSI && installmentCount > 1 && parsedAmount > 0
      ? splitAmount(parsedAmount, installmentCount)
      : []
  const editingPlanDetails =
    editing && editingPlan
      ? getInstallmentPlan(
          editing,
          editing.payment_method ?? selectedMethod,
          new Date(),
          holidays
        )
      : null

  const filteredCategories = useMemo(
    () => categories.filter((category) => category.type === type),
    [categories, type]
  )

  const categoryOptions = useMemo<SelectOption[]>(
    () =>
      filteredCategories.map((category) => ({
        id: category.id,
        label: category.name,
        icon: category.icon,
        color: category.color,
      })),
    [filteredCategories]
  )

  const creditCardPlans = useMemo(
    () => getCreditCardPlans(paymentMethods, holidays),
    [paymentMethods, holidays]
  )
  const bestPlan = creditCardPlans[0] ?? null

  const paymentOptions = useMemo<SelectOption[]>(
    () =>
      paymentMethods.map((method) => ({
        id: method.id,
        label: method.name,
        icon: getPaymentMethodIcon(method.type),
        color: paymentMethodColor(method.type),
        hint: paymentMethodLabel(method.type),
        badge: bestPlan?.method.id === method.id ? 'Recomendado' : undefined,
      })),
    [paymentMethods, bestPlan]
  )

  const autoSelectedRef = useRef(false)

  // Si los métodos de pago cargan después de abrir el modal, aplica la
  // recomendación una sola vez y nunca pisa una elección manual.
  useEffect(() => {
    if (editing || autoSelectedRef.current) return
    if (paymentMethodId) {
      autoSelectedRef.current = true
      return
    }
    const best = getBestCreditCard(paymentMethods, holidays)
    if (best) {
      setPaymentMethodId(best.method.id)
      autoSelectedRef.current = true
    }
  }, [editing, paymentMethodId, paymentMethods, holidays])

  const handleCategorySelect = (id: string | null) => {
    setCategoryId(id)
    if (!id) return
    const category = categories.find((item) => item.id === id)
    if (category) setRequiresBreakdown(category.requires_breakdown)
  }

  const handleTypeChange = (nextType: TransactionType) => {
    setType(nextType)
    setCategoryId(null)
    if (nextType === 'income') setIsMSI(false)
  }

  const handlePaymentMethodChange = (id: string | null) => {
    setPaymentMethodId(id)
    const method = paymentMethods.find((entry) => entry.id === id)
    if (method?.type !== 'credit') setIsMSI(false)
  }

  const onSave = async () => {
    setError(null)

    if (!date) {
      setError('Selecciona una fecha.')
      return
    }

    if (!isBrokenDown) {
      const parsed = parseFloat(amount.replace(',', '.'))
      if (!parsed || parsed <= 0) {
        setError('Monto inválido: ingresa un monto mayor a cero.')
        return
      }
      if (!concepto.trim() && !merchant.trim()) {
        setError('Llena al menos uno de los dos campos: comercio o concepto.')
        return
      }
    }

    if (!paymentMethodId) {
      setError('Selecciona un método de pago.')
      return
    }

    // Plan MSI (solo al crear o al convertir un movimiento existente)
    const applyMSI = isMSI && !editingPlan
    let installmentsStartDate: string | null = null
    if (applyMSI) {
      if (selectedMethod?.type !== 'credit') {
        setError('Los MSI solo aplican a tarjetas de crédito.')
        return
      }
      if (!installmentCount || installmentCount < 2 || installmentCount > 60) {
        setError('Elige entre 2 y 60 parcialidades.')
        return
      }
      const firstPeriod = getStatementPeriod(date, selectedMethod, holidays)
      if (!firstPeriod) {
        setError('No se pudo calcular el primer corte. Revisa la fecha y la tarjeta.')
        return
      }
      installmentsStartDate = firstPeriod.key
    }

    setSaving(true)
    try {
      if (isBrokenDown && editing) {
        await updateTransaction(editing.id, {
          merchant: merchant.trim() || null,
          payment_method_id: paymentMethodId,
          date,
        })
      } else {
        // Ubicación solo al crear (best-effort, silencioso)
        const coords = editing ? null : await getCurrentCoords()
        const payload = {
          amount: parseFloat(amount.replace(',', '.')),
          type,
          breakdown_status: requiresBreakdown ? ('pending' as const) : ('completed' as const),
          payment_method_id: paymentMethodId,
          merchant: merchant.trim() || null,
          note: note.trim() || null,
          category_id: categoryId,
          date,
          description: concepto.trim() || null,
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
          ...(applyMSI
            ? {
                purchase_type: 'installments' as const,
                installments_count: installmentCount,
                installments_start_date: installmentsStartDate,
              }
            : {}),
        }
        if (editing) {
          await updateTransaction(editing.id, payload)
        } else {
          await addTransaction(payload)
        }
      }
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    if (!editing) return
    if (!window.confirm('¿Seguro que quieres eliminar este movimiento? Esta acción no se puede deshacer.')) {
      return
    }
    setSaving(true)
    try {
      await deleteTransaction(editing.id)
      onClose()
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  const msiReady =
    !isMSI ||
    !!editingPlan ||
    (installmentCount >= 2 && installmentCount <= 60 && selectedMethod?.type === 'credit')
  const canSave =
    !!isBrokenDown ||
    ((concepto.trim().length > 0 || merchant.trim().length > 0) &&
      !!paymentMethodId &&
      msiReady)

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Editar movimiento' : 'Nuevo movimiento'}
      width={620}
      footer={
        <XStack gap="$md">
          {editing ? (
            <Button title="Eliminar" variant="ghost" onPress={() => void onDelete()} disabled={saving} />
          ) : null}
          <Button
            title={editing ? 'Guardar cambios' : 'Agregar movimiento'}
            onPress={() => void onSave()}
            loading={saving}
            disabled={!canSave}
            flex={1}
          />
        </XStack>
      }>
      {isBrokenDown && editing ? (
        <>
          <FormSection title="Importe" first>
            <YStack alignItems="center" gap="$xs" paddingVertical="$sm">
              <SectionLabel>Total del desglose</SectionLabel>
              <Text fontSize={32} fontWeight="800" color="$text">
                ${editing.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </Text>
              <Text fontSize={12} color="$tabIconDefault">
                {editing.details?.length ?? 0} ítems
              </Text>
            </YStack>

            <XStack
              alignItems="center"
              gap="$sm"
              paddingHorizontal="$lg"
              paddingVertical="$md"
              borderRadius="$md"
              borderWidth={1}
              backgroundColor={palette.primary + '12'}
              borderColor={palette.primary + '44'}
              cursor="pointer"
              pressStyle={{ opacity: 0.75 }}
              onPress={() => onOpenBreakdown(editing.id)}>
              <AppIcon name="create-outline" size={20} color={palette.primary} />
              <Text flex={1} fontSize={15} fontWeight="700" color="$primary">
                Editar lista de productos
              </Text>
              <AppIcon name="chevron-forward" size={18} color={palette.primary} />
            </XStack>
          </FormSection>

          <FormSection title="Detalles">
            <YStack gap="$sm">
              <SectionLabel>Método de pago *</SectionLabel>
              <SearchSelect
                ariaLabel="Método de pago"
                leadingIcon="card-outline"
                placeholder="Seleccionar…"
                searchPlaceholder="Buscar método…"
                emptyMessage="No hay métodos de pago."
                options={paymentOptions}
                value={paymentMethodId}
                onChange={(id) => setPaymentMethodId(id)}
              />
            </YStack>
          </FormSection>

          <FormSection title="Fecha y nota">
            <XStack gap="$md" flexWrap="wrap">
              <YStack flex={1} minWidth={160} gap="$sm">
                <SectionLabel>Fecha</SectionLabel>
                <DateField value={date} onChange={setDate} ariaLabel="Fecha" />
              </YStack>
              <YStack flex={2} minWidth={220} gap="$sm">
                <SectionLabel>Nota (opcional)</SectionLabel>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Ej. Cena con amigos"
                  aria-label="Nota"
                />
              </YStack>
            </XStack>
          </FormSection>
        </>
      ) : (
        <>
          <FormSection title="Importe" first>
            {/* Tipo */}
            <XStack gap="$xs" padding={3} borderRadius="$md" borderWidth={1} borderColor="$border" backgroundColor="$background">
              {(['expense', 'income'] as TransactionType[]).map((option) => {
                const active = type === option
                const activeColor = option === 'expense' ? palette.expense : palette.income
                return (
                  <XStack
                    key={option}
                    flex={1}
                    height={36}
                    borderRadius="$sm"
                    borderWidth={1}
                    borderColor={active ? activeColor + '66' : 'transparent'}
                    alignItems="center"
                    justifyContent="center"
                    cursor="pointer"
                    style={{ transition: CSS_TRANSITION }}
                    pressStyle={{ opacity: 0.8 }}
                    backgroundColor={active ? activeColor + '1F' : 'transparent'}
                    onPress={() => handleTypeChange(option)}>
                    <Text fontSize={13} fontWeight="700" color={active ? activeColor : '$tabIconDefault'}>
                      {option === 'expense' ? 'Gasto' : 'Ingreso'}
                    </Text>
                  </XStack>
                )
              })}
            </XStack>

            <YStack alignItems="center" gap="$xs" paddingVertical="$sm">
              <SectionLabel>Monto</SectionLabel>
              <XStack alignItems="center" gap="$xs">
                <Text fontSize={26} fontWeight="700" color="$tabIconDefault">
                  $
                </Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  inputMode="decimal"
                  autoFocus={!editing}
                  textAlign="center"
                  fontSize={34}
                  fontWeight="800"
                  height={56}
                  width={180}
                  aria-label="Monto"
                />
              </XStack>
            </YStack>
          </FormSection>

          <FormSection title="Detalles">
            <XStack gap="$md" flexWrap="wrap">
              <YStack flex={1} minWidth={220} gap="$sm">
                <SectionLabel>Categoría</SectionLabel>
                <SearchSelect
                  ariaLabel="Categoría"
                  leadingIcon="pricetag"
                  placeholder="Sin categoría"
                  searchPlaceholder="Buscar categoría…"
                  emptyMessage="No hay categorías para este tipo."
                  options={categoryOptions}
                  value={categoryId}
                  onChange={handleCategorySelect}
                />
              </YStack>
              <YStack flex={1} minWidth={220} gap="$sm">
                <SectionLabel>Método de pago *</SectionLabel>
                <SearchSelect
                  ariaLabel="Método de pago"
                  leadingIcon="card-outline"
                  placeholder="Seleccionar…"
                  searchPlaceholder="Buscar método…"
                  emptyMessage="No hay métodos de pago."
                  options={paymentOptions}
                  value={paymentMethodId}
                  onChange={handlePaymentMethodChange}
                />
              </YStack>
            </XStack>

            {/* Plan MSI: se guarda en la misma fila, sin duplicar meses */}
            {editingPlanDetails ? (
              <YStack
                gap="$sm"
                padding="$md"
                borderRadius="$md"
                borderWidth={1}
                borderColor={palette.primary + '44'}
                backgroundColor={palette.primary + '0F'}>
                <XStack alignItems="center" gap="$sm">
                  <AppIcon name="card" size={18} color={palette.primary} />
                  <Text flex={1} fontSize={14} fontWeight="800" color="$primary">
                    Compra a MSI
                  </Text>
                  <Text fontSize={12} fontWeight="800" color="$primary">
                    {editingPlanDetails.paidCount}/{editingPlanDetails.count}
                  </Text>
                </XStack>
                <XStack justifyContent="space-between" gap="$md">
                  <Text fontSize={12} color="$tabIconDefault">
                    Total de la compra
                  </Text>
                  <Text fontSize={13} fontWeight="700" color="$text">
                    {formatCurrency(editingPlanDetails.transaction.amount)}
                  </Text>
                </XStack>
                <XStack justifyContent="space-between" gap="$md">
                  <Text fontSize={12} color="$tabIconDefault">
                    Parcialidad mensual
                  </Text>
                  <Text fontSize={13} fontWeight="700" color="$text">
                    {formatCurrency(editingPlanDetails.installments[0]?.amount ?? 0)}
                  </Text>
                </XStack>
                <XStack justifyContent="space-between" gap="$md">
                  <Text fontSize={12} color="$tabIconDefault">
                    Saldo restante
                  </Text>
                  <Text fontSize={13} fontWeight="700" color="$text">
                    {formatCurrency(editingPlanDetails.remainingAmount)}
                  </Text>
                </XStack>
                {editingPlanDetails.nextInstallment ? (
                  <Text fontSize={11} color="$tabIconDefault">
                    Próximo pago: parcialidad {editingPlanDetails.nextInstallment.number} ·{' '}
                    {formatCurrency(editingPlanDetails.nextInstallment.amount)}
                  </Text>
                ) : editingPlanDetails.settled ? (
                  <Text fontSize={11} color="$tabIconDefault">
                    Plan liquidado anticipadamente. Ya no se proyectan cargos.
                  </Text>
                ) : null}
                <Text fontSize={11} color="$tabIconDefault">
                  El plan no se edita aquí: elimina el movimiento si necesitas recrearlo.
                </Text>
              </YStack>
            ) : supportsMSI ? (
              <YStack gap="$sm">
                <XStack
                  alignItems="center"
                  gap="$sm"
                  paddingVertical="$sm"
                  cursor="pointer"
                  pressStyle={{ opacity: 0.7 }}
                  onPress={() => setIsMSI((value) => !value)}
                  role="button"
                  aria-label="Comprar a meses sin intereses"
                  aria-pressed={isMSI}>
                  <AppIcon
                    name={isMSI ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={isMSI ? palette.primary : palette.muted}
                  />
                  <YStack flex={1}>
                    <Text fontSize={14} fontWeight="600" color="$text">
                      Comprar a meses sin intereses
                    </Text>
                    <Text fontSize={12} color="$tabIconDefault">
                      Divide el monto en parcialidades mensuales
                    </Text>
                  </YStack>
                </XStack>

                {isMSI ? (
                  <XStack
                    alignItems="flex-end"
                    gap="$md"
                    padding="$md"
                    borderRadius="$md"
                    borderWidth={1}
                    borderColor="$border"
                    backgroundColor="$background"
                    flexWrap="wrap">
                    <YStack width={110} gap="$xs">
                      <SectionLabel>Parcialidades</SectionLabel>
                      <TextInput
                        value={installmentsInput}
                        onChangeText={setInstallmentsInput}
                        placeholder="12"
                        inputMode="numeric"
                        aria-label="Número de parcialidades"
                      />
                    </YStack>
                    <YStack flex={1} minWidth={160} gap="$xs">
                      <SectionLabel>Pago mensual</SectionLabel>
                      <Text fontSize={20} fontWeight="800" color="$text">
                        {installmentPreview.length > 0
                          ? formatCurrency(installmentPreview[0])
                          : '—'}
                      </Text>
                      {installmentPreview.length > 1 ? (
                        <Text fontSize={11} color="$tabIconDefault">
                          {installmentPreview.length} pagos · último{' '}
                          {formatCurrency(
                            installmentPreview[installmentPreview.length - 1]
                          )}
                        </Text>
                      ) : null}
                    </YStack>
                  </XStack>
                ) : null}
              </YStack>
            ) : null}

            {type === 'expense' && categoryId ? (
              <XStack
                alignItems="center"
                gap="$sm"
                paddingVertical="$sm"
                cursor="pointer"
                pressStyle={{ opacity: 0.7 }}
                onPress={() => setRequiresBreakdown((value) => !value)}>
                <AppIcon
                  name={requiresBreakdown ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={requiresBreakdown ? palette.primary : palette.muted}
                />
                <YStack flex={1}>
                  <Text fontSize={14} fontWeight="600" color="$text">
                    Requiere desglose
                  </Text>
                  {requiresBreakdown ? (
                    <Text fontSize={12} color="$tabIconDefault">
                      Podrás agregar los detalles después
                    </Text>
                  ) : null}
                </YStack>
              </XStack>
            ) : null}

            <XStack gap="$md" flexWrap="wrap">
              <YStack flex={1} minWidth={220} gap="$sm">
                <SectionLabel>Comercio *</SectionLabel>
                <TextInput
                  value={merchant}
                  onChangeText={setMerchant}
                  placeholder="Ej. Walmart, OXXO"
                  aria-label="Comercio"
                />
              </YStack>
              <YStack flex={1} minWidth={220} gap="$sm">
                <SectionLabel>Concepto</SectionLabel>
                <TextInput
                  value={concepto}
                  onChangeText={setConcepto}
                  placeholder="Ej. Despensa, Cena"
                  aria-label="Concepto"
                />
              </YStack>
            </XStack>
          </FormSection>

          <FormSection title="Fecha y nota">
            <XStack gap="$md" flexWrap="wrap">
              <YStack flex={1} minWidth={160} gap="$sm">
                <SectionLabel>Fecha</SectionLabel>
                <DateField value={date} onChange={setDate} ariaLabel="Fecha" />
              </YStack>
              <YStack flex={2} minWidth={220} gap="$sm">
                <SectionLabel>Nota (opcional)</SectionLabel>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Ej. Cena con amigos"
                  aria-label="Nota"
                />
              </YStack>
            </XStack>
          </FormSection>
        </>
      )}

      {error ? <FormError>{error}</FormError> : null}
    </Modal>
  )
}
