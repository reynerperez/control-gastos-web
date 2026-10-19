import { useEffect, useMemo, useState } from 'react'
import { Text, XStack, YStack } from 'tamagui'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { FormError, SectionLabel, TextInput } from '@/components/ui/Field'
import { AppIcon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { SearchSelect, type SelectOption } from '@/components/ui/SearchSelect'
import { palette } from '@/constants/theme'
import { useData } from '@/hooks/useData'
import { PastPurchaseSuggestion } from '@/types'
import { formatCurrency } from '@/utils/format'

type DraftItem = {
  key: string
  description: string
  category_id: string | null
  amount: number
}

let uid = 0
const nextKey = () => `item-${Date.now()}-${uid++}`

const MERCHANT_SUGGESTIONS = [
  { icon: 'cart', label: 'Walmart' },
  { icon: 'storefront-outline', label: 'OXXO' },
  { icon: 'cart', label: 'Tianguis' },
  { icon: 'storefront-outline', label: 'Amazon' },
  { icon: 'car', label: 'Gasolinera' },
  { icon: 'cafe', label: 'Restaurante' },
]

/**
 * Desglose de ticket — misma lógica que `app/breakdown-modal.tsx`:
 * reparte el total cobrado en ítems por categoría, con autocompletado de
 * compras pasadas y cierre rápido del saldo restante.
 */
export function BreakdownModal({
  open,
  transactionId,
  onClose,
}: {
  open: boolean
  transactionId?: string
  onClose: () => void
}) {
  if (!open || !transactionId) return null
  return <BreakdownDialog key={transactionId} transactionId={transactionId} onClose={onClose} />
}

function BreakdownDialog({ transactionId, onClose }: { transactionId: string; onClose: () => void }) {
  const { transactions, categories, saveBreakdown, searchPastDetails } = useData()
  const editing = transactions.find((item) => item.id === transactionId)

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === 'expense'),
    [categories]
  )

  const categoryOptions = useMemo<SelectOption[]>(
    () =>
      expenseCategories.map((category) => ({
        id: category.id,
        label: category.name,
        icon: category.icon,
        color: category.color,
      })),
    [expenseCategories]
  )

  const details = editing?.details ?? []
  const primaryDetail = details[0]

  /** ¿La transacción está sin desglosar? (1 detail placeholder con el total) */
  const isUnbroken =
    editing?.breakdown_status === 'pending' &&
    details.length === 1 &&
    Math.abs(details[0].unit_price * details[0].quantity - editing.amount) < 0.01

  const [items, setItems] = useState<DraftItem[]>(() =>
    isUnbroken
      ? []
      : details.map((detail) => ({
          key: nextKey(),
          description: detail.description ?? '',
          category_id: detail.category_id,
          amount: detail.unit_price * detail.quantity,
        }))
  )
  const [merchant, setMerchant] = useState(editing?.merchant ?? '')
  const [concepto, setConcepto] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(() => {
    const comida = categories.find((category) => category.name === 'Comida' && category.type === 'expense')
    return details[0]?.category_id ?? comida?.id ?? expenseCategories[0]?.id ?? null
  })
  const [amountText, setAmountText] = useState('')
  const [suggestions, setSuggestions] = useState<PastPurchaseSuggestion[]>([])
  const [quickCatId, setQuickCatId] = useState<string | null>(() => {
    const comida = categories.find((category) => category.name === 'Comida' && category.type === 'expense')
    return details[0]?.category_id ?? comida?.id ?? expenseCategories[0]?.id ?? null
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = editing?.amount ?? 0
  const assigned = useMemo(() => items.reduce((sum, item) => sum + item.amount, 0), [items])
  const remaining = total - assigned
  const pct = total > 0 ? assigned / total : 0
  const isOver = remaining < -0.01
  const isComplete = Math.abs(remaining) < 0.01

  // Autocompletado de compras pasadas (debounce 250ms)
  useEffect(() => {
    const query = concepto.trim()
    if (query.length < 2) {
      setSuggestions([])
      return
    }
    const timer = setTimeout(async () => {
      const results = await searchPastDetails(query, transactionId)
      setSuggestions(results)
    }, 250)
    return () => clearTimeout(timer)
  }, [concepto, searchPastDetails, transactionId])

  if (!editing || editing.type !== 'expense') {
    return (
      <Modal open onClose={onClose} title="Desglosar ticket">
        <Text fontSize={14} color="$textSecondary">
          El desglose solo está disponible para gastos.
        </Text>
      </Modal>
    )
  }

  const storeName = editing.merchant || primaryDetail?.description || editing.note || 'Movimiento'
  const storeIcon = primaryDetail?.category?.icon ?? 'cart'
  const storeColor = primaryDetail?.category?.color ?? palette.primary

  const addItem = () => {
    setError(null)
    const amount = parseFloat(amountText.replace(',', '.'))
    if (!amount || amount <= 0) {
      setError('Monto inválido: ingresa un monto mayor a cero.')
      return
    }
    if (!categoryId) {
      setError('Selecciona una categoría para el ítem.')
      return
    }
    const category = categories.find((item) => item.id === categoryId)
    setItems((previous) => [
      ...previous,
      {
        key: nextKey(),
        description: concepto.trim() || category?.name || 'Ítem',
        category_id: categoryId,
        amount,
      },
    ])
    setConcepto('')
    setAmountText('')
    setSuggestions([])
  }

  const removeItem = (key: string) => setItems((previous) => previous.filter((item) => item.key !== key))

  /** Cierre rápido: asigna el residuo completo a una categoría */
  const quickClose = () => {
    if (remaining <= 0.01 || !quickCatId) return
    const category = categories.find((item) => item.id === quickCatId)
    setItems((previous) => [
      ...previous,
      {
        key: nextKey(),
        description: category?.name ?? 'Resto',
        category_id: quickCatId,
        amount: Math.round(remaining * 100) / 100,
      },
    ])
  }

  const canFinalize = merchant.trim().length > 0 && items.length > 0 && assigned > 0.01

  const save = async (finalize: boolean) => {
    setError(null)
    if (finalize && !merchant.trim()) {
      setError('Indica el nombre del comercio para finalizar el desglose.')
      return
    }
    setSaving(true)
    try {
      const complete = finalize || isComplete
      const newAmount = isOver ? assigned : undefined
      await saveBreakdown(
        editing.id,
        items.map((item) => ({
          description: item.description || null,
          category_id: item.category_id,
          amount: item.amount,
        })),
        complete,
        {
          // Si el usuario borra todos los ítems, se restaura el placeholder
          description: primaryDetail?.description ?? editing.note ?? null,
          category_id: primaryDetail?.category_id ?? null,
          amount: editing.amount,
        },
        merchant.trim() || null,
        newAmount
      )
      onClose()
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Desglosar ticket"
      subtitle="Reparte el total cobrado en ítems por categoría"
      width={760}
      footer={
        <YStack gap="$sm">
          {isOver ? (
            <XStack
              alignItems="flex-start"
              gap="$sm"
              padding="$md"
              borderRadius="$md"
              borderWidth={1}
              backgroundColor={palette.warning + '18'}
              borderColor={palette.warning + '44'}>
              <AppIcon name="information-circle" size={18} color={palette.warning} />
              <Text flex={1} fontSize={13} lineHeight={18} color="$text">
                La suma de los productos ({formatCurrency(assigned)}) supera el total registrado (
                {formatCurrency(total)}). El total del movimiento se actualizará al guardar.
              </Text>
            </XStack>
          ) : !isComplete ? (
            <Text fontSize={13} textAlign="center" color="$tabIconDefault">
              Faltan {formatCurrency(remaining)} por asignar
            </Text>
          ) : null}

          <XStack gap="$md">
            <Button
              title="Guardar borrador"
              variant="secondary"
              onPress={() => void save(false)}
              disabled={saving || items.length === 0}
            />
            <Button
              title={
                isOver
                  ? `Guardar y actualizar total a ${formatCurrency(assigned)}`
                  : `Finalizar desglose (${formatCurrency(total)})`
              }
              onPress={() => void save(true)}
              disabled={!canFinalize}
              loading={saving}
              flex={1}
            />
          </XStack>
        </YStack>
      }>
      {/* Establecimiento */}
      <Card>
        <XStack alignItems="center" gap="$md">
          <CategoryIcon icon={storeIcon} color={storeColor} size={44} />
          <YStack flex={1} minWidth={0}>
            <Text fontSize={16} fontWeight="800" color="$text" numberOfLines={1}>
              {storeName}
            </Text>
            <Text fontSize={12} color="$tabIconDefault">
              {editing.payment_method?.name ?? 'Sin método de pago'} ·{' '}
              {editing.details?.length ?? 0} ítems actuales
            </Text>
          </YStack>
          <YStack alignItems="flex-end">
            <Text fontSize={12} color="$tabIconDefault">
              Total cobrado
            </Text>
            <Text fontSize={18} fontWeight="800" color="$text">
              {formatCurrency(total)}
            </Text>
          </YStack>
        </XStack>
      </Card>

      {/* Comercio (obligatorio para finalizar) */}
      <YStack gap="$sm">
        <XStack alignItems="center" justifyContent="space-between">
          <SectionLabel>Comercio / Tienda *</SectionLabel>
          {!merchant.trim() ? (
            <Text fontSize={11} fontWeight="700" color="$warning">
              Requerido para finalizar
            </Text>
          ) : null}
        </XStack>
        <TextInput
          value={merchant}
          onChangeText={setMerchant}
          placeholder="Ej. Walmart, OXXO, Amazon"
          borderColor={!merchant.trim() ? palette.warning + '66' : undefined}
          aria-label="Comercio"
        />
        <XStack flexWrap="wrap" gap="$sm">
          {MERCHANT_SUGGESTIONS.map((suggestion) => {
            const active = merchant === suggestion.label
            return (
              <XStack
                key={suggestion.label}
                alignItems="center"
                gap="$xs"
                paddingHorizontal="$md"
                paddingVertical="$sm"
                borderRadius="$full"
                borderWidth={1}
                cursor="pointer"
                pressStyle={{ opacity: 0.7 }}
                backgroundColor={active ? palette.primary + '18' : '$background'}
                borderColor={active ? palette.primary : palette.borderStrong}
                onPress={() => setMerchant(suggestion.label)}>
                <AppIcon
                  name={suggestion.icon}
                  size={14}
                  color={active ? palette.primary : '#8A8A8A'}
                />
                <Text fontSize={13} fontWeight={active ? '700' : '500'} color={active ? '$primary' : '$textSecondary'}>
                  {suggestion.label}
                </Text>
              </XStack>
            )
          })}
        </XStack>
      </YStack>

      {/* Estado del desglose */}
      <Card gap="$md">
        <XStack alignItems="center" justifyContent="space-between">
          <Text
            fontSize={14}
            fontWeight="800"
            color={isOver ? '$expense' : isComplete ? '$income' : '$warning'}>
            {isOver
              ? `Sobran ${formatCurrency(-remaining)} en el desglose`
              : isComplete
                ? 'Por asignar: $0.00 (100%)'
                : `Por asignar: ${formatCurrency(remaining)}`}
          </Text>
          <Text fontSize={14} fontWeight="800" color="$tabIconDefault">
            {Math.round(pct * 100)}%
          </Text>
        </XStack>
        <ProgressBar
          progress={Math.min(pct, 1)}
          color={isOver ? palette.warning : isComplete ? '#849e77' : palette.warning}
          height={10}
        />
      </Card>

      {/* Agregar ítem */}
      <SectionLabel>Agregar ítem específico</SectionLabel>
      <Card gap="$md">
        <YStack gap="$sm">
          <Text fontSize={13} fontWeight="600" color="$textSecondary">
            Concepto
          </Text>
          <TextInput
            value={concepto}
            onChangeText={setConcepto}
            placeholder="Ej. Colágeno hidrolizado, Arena de gato…"
            aria-label="Concepto del ítem"
          />
          {suggestions.length > 0 ? (
            <YStack borderRadius="$md" borderWidth={1} borderColor="$border" backgroundColor="$background" overflow="hidden">
              {suggestions.map((suggestion) => (
                <XStack
                  key={suggestion.description}
                  alignItems="center"
                  gap="$sm"
                  paddingHorizontal="$md"
                  paddingVertical="$sm"
                  cursor="pointer"
                  hoverStyle={{ backgroundColor: '$card' }}
                  pressStyle={{ opacity: 0.7 }}
                  onPress={() => {
                    setConcepto(suggestion.description)
                    if (suggestion.category_id) setCategoryId(suggestion.category_id)
                    if (suggestion.unit_price > 0) setAmountText(String(suggestion.unit_price))
                    setSuggestions([])
                  }}>
                  <AppIcon
                    name={suggestion.category?.icon ?? 'pricetag'}
                    size={16}
                    color={suggestion.category?.color ?? palette.muted}
                  />
                  <Text flex={1} fontSize={14} color="$text" numberOfLines={1}>
                    {suggestion.description}
                  </Text>
                  <Text fontSize={13} fontWeight="600" color="$tabIconDefault">
                    {formatCurrency(suggestion.unit_price)}
                  </Text>
                </XStack>
              ))}
            </YStack>
          ) : null}
        </YStack>

        <YStack gap="$sm">
          <Text fontSize={13} fontWeight="600" color="$textSecondary">
            Categoría
          </Text>
          <SearchSelect
            ariaLabel="Categoría del ítem"
            leadingIcon="pricetag"
            placeholder="Sin categoría"
            searchPlaceholder="Buscar categoría…"
            emptyMessage="Sin categorías."
            options={categoryOptions}
            value={categoryId}
            onChange={(id) => setCategoryId(id)}
          />
        </YStack>

        <YStack gap="$sm">
          <Text fontSize={13} fontWeight="600" color="$textSecondary">
            Monto ($)
          </Text>
          <TextInput
            value={amountText}
            onChangeText={setAmountText}
            placeholder="0.00"
            inputMode="decimal"
            aria-label="Monto del ítem"
          />
          {remaining > 0.01 ? (
            <XStack
              alignSelf="flex-start"
              alignItems="center"
              gap="$xs"
              paddingHorizontal="$md"
              paddingVertical="$sm"
              borderRadius="$full"
              borderWidth={1}
              borderColor={palette.primary + '55'}
              backgroundColor={palette.primary + '12'}
              cursor="pointer"
              pressStyle={{ opacity: 0.7 }}
              onPress={() => setAmountText(String(Math.round(remaining * 100) / 100))}>
              <AppIcon name="return-down-back" size={15} color={palette.primary} />
              <Text fontSize={13} fontWeight="700" color="$primary">
                Usar el resto: {formatCurrency(remaining)}
              </Text>
            </XStack>
          ) : null}
        </YStack>

        <Button title="Agregar ítem" variant="secondary" onPress={addItem} />
      </Card>

      {/* Ítems agregados */}
      {items.length > 0 ? (
        <>
          <SectionLabel>Ítems desglosados ({items.length})</SectionLabel>
          <YStack gap="$sm">
            {items.map((item) => {
              const category = categories.find((entry) => entry.id === item.category_id)
              return (
                <XStack
                  key={item.key}
                  alignItems="center"
                  gap="$md"
                  padding="$md"
                  borderRadius="$md"
                  borderWidth={1}
                  borderColor="$border"
                  backgroundColor="$card">
                  <CategoryIcon
                    icon={category?.icon ?? 'pricetag'}
                    color={category?.color ?? palette.muted}
                    size={36}
                  />
                  <YStack flex={1} minWidth={0}>
                    <Text fontSize={14} fontWeight="700" color="$text" numberOfLines={1}>
                      {item.description || category?.name || 'Ítem'}
                    </Text>
                    <Text fontSize={12} color="$tabIconDefault">
                      {category?.name ?? 'Sin categoría'}
                    </Text>
                  </YStack>
                  <Text fontSize={15} fontWeight="700" color="$text">
                    {formatCurrency(item.amount)}
                  </Text>
                  <XStack
                    cursor="pointer"
                    pressStyle={{ opacity: 0.6 }}
                    onPress={() => removeItem(item.key)}
                    aria-label="Quitar ítem"
                    role="button">
                    <AppIcon name="close-circle" size={22} color={palette.expense} />
                  </XStack>
                </XStack>
              )
            })}
          </YStack>
        </>
      ) : null}

      {/* Cierre rápido */}
      {remaining > 0.01 ? (
        <Card borderColor={palette.primary + '44'} gap="$sm">
          <XStack alignItems="center" gap="$xs">
            <AppIcon name="flash" size={18} color={palette.warning} />
            <Text fontSize={15} fontWeight="800" color="$text">
              Cierre rápido
            </Text>
          </XStack>
          <Text fontSize={13} color="$tabIconDefault">
            ¿El resto fue de una sola categoría?
          </Text>
          <SearchSelect
            ariaLabel="Categoría del resto"
            leadingIcon="pricetag"
            placeholder="Elige una categoría"
            searchPlaceholder="Buscar categoría…"
            emptyMessage="Sin categorías."
            options={categoryOptions}
            value={quickCatId}
            onChange={(id) => setQuickCatId(id)}
          />
          <Button
            title={`Asignar ${formatCurrency(remaining)} a "${
              categories.find((entry) => entry.id === quickCatId)?.name ?? 'categoría'
            }"`}
            onPress={quickClose}
            disabled={!quickCatId}
          />
        </Card>
      ) : null}

      {error ? <FormError>{error}</FormError> : null}
    </Modal>
  )
}
