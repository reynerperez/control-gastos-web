import { useMemo, useState } from 'react'
import { Text, XStack, YStack } from 'tamagui'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { FormError, SectionLabel, TextInput } from '@/components/ui/Field'
import { AppIcon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { MonthSelector } from '@/components/ui/MonthSelector'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { palette } from '@/constants/theme'
import { useModals } from '@/contexts/ModalsContext'
import { usePeriod } from '@/contexts/PeriodContext'
import { useData } from '@/hooks/useData'
import { Category } from '@/types'
import { formatCurrency, toMonthKey } from '@/utils/format'
import { getEffectiveDetailAmount } from '@/utils/installments'

/**
 * Presupuestos — equivale a `app/(tabs)/budgets.tsx`:
 * totales del mes, una fila por categoría de gasto con su progreso y un
 * diálogo para asignar / editar / eliminar el presupuesto mensual.
 */
export default function BudgetsScreen() {
  const { categories, transactions, budgets, setBudget, deleteBudget } = useData()
  const { period } = usePeriod()
  const { openPeriodPicker } = useModals()
  const [editing, setEditing] = useState<{ category: Category; amount: number | null } | null>(null)
  const [amountInput, setAmountInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const month = period.month
  const monthKey = toMonthKey(month)

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === 'expense'),
    [categories]
  )

  const rows = useMemo(() => {
    return expenseCategories.map((category) => {
      const budget = budgets.find(
        (entry) => entry.category_id === category.id && entry.month === monthKey
      )
      const spent = transactions
        .filter((transaction) => {
          const date = new Date(transaction.date + 'T00:00:00')
          return (
            transaction.type === 'expense' &&
            date.getFullYear() === month.getFullYear() &&
            date.getMonth() === month.getMonth()
          )
        })
        .reduce((sum, transaction) => {
          const detailTotal = (transaction.details ?? [])
            .filter((detail) => detail.category_id === category.id)
            .reduce(
              (detailSum, detail) =>
                detailSum + getEffectiveDetailAmount(transaction, detail.quantity * detail.unit_price),
              0
            )
          return sum + detailTotal
        }, 0)
      return { category, budget, spent }
    })
  }, [expenseCategories, budgets, transactions, month, monthKey])

  const totals = useMemo(
    () => ({
      budgeted: rows.reduce((sum, row) => sum + (row.budget?.amount ?? 0), 0),
      spent: rows.reduce((sum, row) => sum + row.spent, 0),
    }),
    [rows]
  )

  const openEditor = (category: Category, currentAmount?: number) => {
    setEditing({ category, amount: currentAmount ?? null })
    setAmountInput(currentAmount ? String(currentAmount) : '')
    setError(null)
  }

  const onSave = async () => {
    if (!editing) return
    const parsed = parseFloat(amountInput.replace(',', '.'))
    if (!parsed || parsed <= 0) {
      setError('Ingresa un presupuesto mayor a cero.')
      return
    }
    setSaving(true)
    try {
      await setBudget(editing.category.id, parsed, month)
      setEditing(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    if (editing?.amount == null) return
    const budget = budgets.find(
      (entry) => entry.category_id === editing.category.id && entry.month === monthKey
    )
    if (!budget) return
    if (!window.confirm(`¿Quitar el presupuesto de ${editing.category.name}?`)) return
    await deleteBudget(budget.id)
    setEditing(null)
  }

  return (
    <YStack gap="$md">
      <XStack gap="$md" alignItems="center">
        <YStack flex={1}>
          <MonthSelector onOpenPicker={openPeriodPicker} />
        </YStack>
      </XStack>

      {/* Totales */}
      <Card>
        <XStack alignItems="center">
          <YStack flex={1} alignItems="center" gap="$xs">
            <Text fontSize={13} color="$tabIconDefault">
              Presupuestado
            </Text>
            <Text fontSize={20} fontWeight="800" color="$text">
              {formatCurrency(totals.budgeted)}
            </Text>
          </YStack>
          <YStack width={1} height={40} backgroundColor="$border" />
          <YStack flex={1} alignItems="center" gap="$xs">
            <Text fontSize={13} color="$tabIconDefault">
              Gastado
            </Text>
            <Text
              fontSize={20}
              fontWeight="800"
              color={totals.spent > totals.budgeted && totals.budgeted > 0 ? '$expense' : '$text'}>
              {formatCurrency(totals.spent)}
            </Text>
          </YStack>
        </XStack>
      </Card>

      {/* Filas por categoría */}
      {rows.map(({ category, budget, spent }) => {
        const hasBudget = !!budget
        const progress = budget && budget.amount > 0 ? spent / budget.amount : 0
        return (
          <Card key={category.id} gap="$md">
            <XStack alignItems="center" justifyContent="space-between" gap="$md">
              <XStack alignItems="center" gap="$md" flex={1} minWidth={0}>
                <CategoryIcon icon={category.icon} color={category.color} />
                <YStack flex={1} minWidth={0}>
                  <Text fontSize={15} fontWeight="700" color="$text" numberOfLines={1}>
                    {category.name}
                  </Text>
                  <Text fontSize={12} color="$tabIconDefault">
                    {hasBudget
                      ? `${formatCurrency(spent)} de ${formatCurrency(budget!.amount)}`
                      : 'Sin presupuesto asignado'}
                  </Text>
                </YStack>
              </XStack>

              {hasBudget ? (
                <Text fontSize={14} fontWeight="800" color={progress > 1 ? '$expense' : '$textSecondary'}>
                  {Math.round(progress * 100)}%
                </Text>
              ) : null}

              <XStack
                height={34}
                alignItems="center"
                gap="$xs"
                paddingHorizontal="$md"
                borderRadius="$md"
                borderWidth={1}
                borderColor="$border"
                cursor="pointer"
                hoverStyle={{ borderColor: palette.primary }}
                pressStyle={{ opacity: 0.7 }}
                onPress={() => openEditor(category, budget?.amount)}
                role="button"
                aria-label={`Asignar presupuesto a ${category.name}`}>
                <AppIcon name={hasBudget ? 'pencil-outline' : 'add-circle-outline'} size={15} color={palette.primary} />
                <Text fontSize={13} fontWeight="700" color="$primary">
                  {hasBudget ? 'Editar' : 'Asignar'}
                </Text>
              </XStack>
            </XStack>

            {hasBudget ? <ProgressBar progress={progress} color={category.color} /> : null}
            {hasBudget && progress > 1 ? (
              <Text fontSize={12} color="$expense">
                Excedido por {formatCurrency(spent - budget!.amount)}
              </Text>
            ) : null}
          </Card>
        )
      })}

      {expenseCategories.length === 0 ? (
        <Card>
          <Text color="$tabIconDefault" textAlign="center">
            Crea categorías de gasto en Ajustes para asignar presupuestos.
          </Text>
        </Card>
      ) : null}

      {/* Editor de presupuesto */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Presupuesto: ${editing.category.name}` : 'Presupuesto'}
        subtitle="Límite mensual para esta categoría"
        width={480}
        footer={
          <XStack gap="$md">
            {editing?.amount != null ? (
              <Button title="Eliminar" variant="ghost" onPress={() => void onDelete()} disabled={saving} />
            ) : null}
            <Button title="Guardar" onPress={() => void onSave()} loading={saving} flex={1} />
          </XStack>
        }>
        {editing ? (
          <>
            <XStack alignItems="center" gap="$md">
              <CategoryIcon icon={editing.category.icon} color={editing.category.color} size={44} />
              <YStack>
                <Text fontSize={15} fontWeight="700" color="$text">
                  {editing.category.name}
                </Text>
                <Text fontSize={12} color="$tabIconDefault">
                  Presupuesto de {month.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                </Text>
              </YStack>
            </XStack>

            <YStack gap="$sm">
              <SectionLabel>Monto mensual</SectionLabel>
              <XStack alignItems="center" gap="$xs">
                <Text fontSize={24} fontWeight="700" color="$tabIconDefault">
                  $
                </Text>
                <TextInput
                  value={amountInput}
                  onChangeText={setAmountInput}
                  placeholder="0.00"
                  inputMode="decimal"
                  autoFocus
                  fontSize={28}
                  fontWeight="800"
                  height={52}
                  flex={1}
                  aria-label="Monto del presupuesto"
                />
              </XStack>
            </YStack>

            {error ? <FormError>{error}</FormError> : null}
          </>
        ) : null}
      </Modal>
    </YStack>
  )
}
