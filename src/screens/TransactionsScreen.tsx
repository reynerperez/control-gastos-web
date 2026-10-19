import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Text, XStack, YStack } from 'tamagui'

import { BorderedChip } from '@/components/ui/BorderedStack'
import { CategoryIcon, Pill } from '@/components/ui/CategoryIcon'
import { TextInput } from '@/components/ui/Field'
import { AppIcon } from '@/components/ui/Icon'
import { MonthSelector } from '@/components/ui/MonthSelector'
import { palette } from '@/constants/theme'
import { CONTROL_HEIGHT, focusRing, shadow, CSS_TRANSITION, TYPO } from '@/constants/ui'
import { useAuth } from '@/contexts/AuthContext'
import { useFilters } from '@/contexts/FiltersContext'
import { useModals } from '@/contexts/ModalsContext'
import { isWithinPeriod, usePeriod } from '@/contexts/PeriodContext'
import { useData } from '@/hooks/useData'
import { Transaction } from '@/types'
import {
  getStatementPeriod,
  type StatementPeriod,
} from '@/utils/creditCardRecommendation'
import { formatCurrency, formatDateLabel, formatMonthLabel, toISODate } from '@/utils/format'
import {
  getTransactionDisplayAmount,
  isInstallmentTransaction,
} from '@/utils/installments'
import {
  buildCardProjectionGroups,
  getProjectionWindow,
  type ProjectionGroup,
} from '@/utils/paymentPeriods'
import { getPaymentMethodIcon } from '@/utils/paymentMethod'
import { getUserDisplayName } from '@/utils/user'

/** Fecha corta para rangos de ciclo: "16 oct" */
const formatShortDate = (date: Date) =>
  date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })

/**
 * Movimientos — equivale a `app/(tabs)/transactions.tsx`:
 * búsqueda, filtros (tipo / categorías / método de pago / pendientes),
 * totales del filtro y filas con desglose expandible.
 */
export default function TransactionsScreen() {
  const navigate = useNavigate()
  const { transactions, categories, paymentMethods, recurringCharges, loading } = useData()
  const { period, bounds, setAll } = usePeriod()
  const { openFilters, openPeriodPicker, openTransactionForm, openBreakdown } = useModals()
  const {
    typeFilter,
    setTypeFilter,
    selectedCategories,
    toggleCategory,
    selectedPaymentMethods,
    togglePaymentMethod,
    clearFilters,
    onlyPending,
    setOnlyPending,
  } = useFilters()
  const [search, setSearch] = useState('')
  const [groupingMode, setGroupingMode] = useState<'auto' | 'month' | 'period'>('auto')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set())

  const toggleGroup = (key: string) =>
    setCollapsedGroups((previous) => {
      const next = new Set(previous)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const query = search.trim().toLowerCase()
  const activeFilterCount =
    (typeFilter !== 'all' ? 1 : 0) +
    selectedCategories.length +
    selectedPaymentMethods.length +
    (onlyPending ? 1 : 0) +
    (query ? 1 : 0)

  const filtered = useMemo(() => {
    return transactions.filter((transaction) => {
      if (!isWithinPeriod(transaction.date, bounds)) return false
      const typeOk = typeFilter === 'all' || transaction.type === typeFilter
      const pendingOk = !onlyPending || transaction.breakdown_status === 'pending'
      const categoryOk =
        selectedCategories.length === 0 ||
        (transaction.details ?? []).some(
          (detail) => detail.category_id && selectedCategories.includes(detail.category_id)
        )
      const searchOk =
        !query ||
        [transaction.note, transaction.merchant, ...(transaction.details ?? []).map((detail) => detail.description)]
          .some((value) => value?.toLowerCase().includes(query))
      const paymentOk =
        selectedPaymentMethods.length === 0 ||
        (transaction.payment_method_id != null &&
          selectedPaymentMethods.includes(transaction.payment_method_id))
      return typeOk && categoryOk && pendingOk && searchOk && paymentOk
    })
  }, [transactions, bounds, typeFilter, onlyPending, selectedCategories, selectedPaymentMethods, query])

  const total = useMemo(
    () =>
      filtered.reduce((sum, transaction) => {
        const amount = getTransactionDisplayAmount(transaction)
        return sum + (transaction.type === 'income' ? amount : -amount)
      }, 0),
    [filtered]
  )

  // Agrupa por mes respetando el orden (la BD ya devuelve por fecha desc)
  const groups = useMemo(() => {
    const map = new Map<
      string,
      { key: string; label: string; transactions: Transaction[]; total: number }
    >()
    for (const transaction of filtered) {
      const [year, month] = transaction.date.split('-').map(Number)
      const key = `${year}-${String(month).padStart(2, '0')}`
      let group = map.get(key)
      if (!group) {
        group = {
          key,
          label: formatMonthLabel(new Date(year, month - 1, 1)),
          transactions: [],
          total: 0,
        }
        map.set(key, group)
      }
      group.transactions.push(transaction)
      const amount = getTransactionDisplayAmount(transaction)
      group.total += transaction.type === 'income' ? amount : -amount
    }
    return [...map.values()]
  }, [filtered])

  // Agrupación por periodo de facturación: solo aplica cuando el filtro tiene
  // exactamente una tarjeta de crédito (los ciclos dependen de su día de corte).
  const activeCreditCard = useMemo(() => {
    if (selectedPaymentMethods.length !== 1) return null
    const method = paymentMethods.find((entry) => entry.id === selectedPaymentMethods[0])
    return method && method.type === 'credit' && method.closing_day != null ? method : null
  }, [selectedPaymentMethods, paymentMethods])

  useEffect(() => {
    // Al cambiar de tarjeta volvemos al modo automático (periodos)
    setGroupingMode('auto')
  }, [activeCreditCard?.id])

  const usePeriodGroups = !!activeCreditCard && groupingMode !== 'month'

  // Ventana para proyectar MSI/servicios: el periodo visible o, en "todo el
  // historial", desde el movimiento más antiguo hasta 3 años a futuro.
  const projectionWindow = useMemo(
    () =>
      bounds.start && bounds.end
        ? { fromISO: bounds.start, toISO: bounds.end }
        : getProjectionWindow(transactions),
    [bounds.start, bounds.end, transactions]
  )

  const projectionGroups = useMemo(() => {
    if (!usePeriodGroups || !activeCreditCard) {
      return new Map<string, ProjectionGroup>()
    }
    const groups = buildCardProjectionGroups({
      card: activeCreditCard,
      transactions,
      recurringCharges,
      paymentMethods,
      fromISO: projectionWindow.fromISO,
      toISO: projectionWindow.toISO,
    })
    return new Map(groups.map((group) => [group.key, group]))
  }, [
    usePeriodGroups,
    activeCreditCard,
    transactions,
    recurringCharges,
    paymentMethods,
    projectionWindow,
  ])

  type PeriodBucket = {
    key: string
    period: StatementPeriod
    transactions: Transaction[]
    total: number
    installmentLines: ProjectionGroup['installmentLines']
    recurringLines: ProjectionGroup['recurringLines']
    projectedTotal: number
  }

  const periodGroups = useMemo(() => {
    if (!usePeriodGroups || !activeCreditCard) return null
    const map = new Map<string, PeriodBucket>()

    for (const transaction of filtered) {
      const statement = getStatementPeriod(transaction.date, activeCreditCard)
      if (!statement) continue
      let group = map.get(statement.key)
      if (!group) {
        group = {
          key: statement.key,
          period: statement,
          transactions: [],
          total: 0,
          installmentLines: [],
          recurringLines: [],
          projectedTotal: 0,
        }
        map.set(statement.key, group)
      }
      group.transactions.push(transaction)
      const amount = getTransactionDisplayAmount(transaction)
      group.total += transaction.type === 'income' ? amount : -amount
    }

    // Cargos proyectados que aún no tienen grupo (parcialidades de MSI de
    // compras antiguas o servicios recurrentes del periodo).
    for (const [key, projection] of projectionGroups) {
      let group = map.get(key)
      if (!group) {
        group = {
          key,
          period: projection.period,
          transactions: [],
          total: 0,
          installmentLines: [],
          recurringLines: [],
          projectedTotal: 0,
        }
        map.set(key, group)
      }
      // La primera parcialidad ya está representada por el movimiento real:
      // no se duplica en la lista de proyectados.
      const transactionIds = new Set(group.transactions.map((entry) => entry.id))
      group.installmentLines = projection.installmentLines.filter(
        (line) => !transactionIds.has(line.transaction.id)
      )
      group.recurringLines = projection.recurringLines
      group.projectedTotal = Math.round(
        (group.installmentLines.reduce((sum, line) => sum + line.amount, 0) +
          group.recurringLines.reduce((sum, line) => sum + line.amount, 0)) *
          100
      ) / 100
      // Los gastos proyectados restan del total del periodo.
      group.total -= group.projectedTotal
    }

    return [...map.values()]
      .filter(
        (group) =>
          group.transactions.length > 0 ||
          group.installmentLines.length > 0 ||
          group.recurringLines.length > 0
      )
      .sort(
        (a, b) => b.period.closingDate.getTime() - a.period.closingDate.getTime()
      )
  }, [filtered, activeCreditCard, usePeriodGroups, projectionGroups])

  return (
    <YStack gap="$md">
      {/* Periodo */}
      <MonthSelector onOpenPicker={openPeriodPicker} />

      {/* Búsqueda + filtros */}
      <XStack gap="$sm" alignItems="center">
        <XStack
          flex={1}
          alignItems="center"
          gap="$sm"
          height={CONTROL_HEIGHT}
          paddingHorizontal="$md"
          borderRadius="$md"
          borderWidth={1}
          borderColor="$border"
          backgroundColor="$card"
          style={{ transition: CSS_TRANSITION }}
          hoverStyle={{ borderColor: '$borderStrong' }}
          focusWithinStyle={focusRing}>
          <AppIcon name="search" size={17} color="#8A8A8A" />
          <YStack flex={1}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar por comercio, concepto o nota…"
              height={CONTROL_HEIGHT - 2}
              borderWidth={0}
              backgroundColor="transparent"
              paddingHorizontal={0}
              fontSize={14}
              focusStyle={{ outlineWidth: 0, shadowOpacity: 0 }}
              aria-label="Buscar movimiento"
            />
          </YStack>
          {search.length > 0 ? (
            <XStack
              cursor="pointer"
              style={{ transition: CSS_TRANSITION }}
              pressStyle={{ opacity: 0.6 }}
              hoverStyle={{ opacity: 0.8 }}
              onPress={() => setSearch('')}
              aria-label="Limpiar búsqueda"
              role="button">
              <AppIcon name="close-circle" size={16} color="#8A8A8A" />
            </XStack>
          ) : null}
        </XStack>

        <XStack
          width={CONTROL_HEIGHT}
          height={CONTROL_HEIGHT}
          alignItems="center"
          justifyContent="center"
          borderRadius="$md"
          borderWidth={1}
          position="relative"
          cursor="pointer"
          style={{ transition: CSS_TRANSITION }}
          pressStyle={{ opacity: 0.75 }}
          hoverStyle={{ borderColor: '$primary' }}
          backgroundColor={activeFilterCount > 0 ? '$primaryLight' : '$card'}
          borderColor={activeFilterCount > 0 ? '$primary' : '$border'}
          onPress={openFilters}
          role="button"
          aria-label="Filtros">
          <AppIcon
            name="options-outline"
            size={19}
            color={activeFilterCount > 0 ? palette.primary : '#8A8A8A'}
          />
          {activeFilterCount > 0 ? (
            <YStack
              position="absolute"
              top={-5}
              right={-5}
              minWidth={17}
              height={17}
              paddingHorizontal={4}
              borderRadius="$full"
              alignItems="center"
              justifyContent="center"
              backgroundColor="$primary">
              <Text fontSize={10} fontWeight="800" color="#FFFFFF">
                {activeFilterCount}
              </Text>
            </YStack>
          ) : null}
        </XStack>

        <XStack
          height={CONTROL_HEIGHT}
          alignItems="center"
          gap="$xs"
          paddingHorizontal="$md"
          borderRadius="$md"
          backgroundColor="$primary"
          cursor="pointer"
          style={{ transition: CSS_TRANSITION }}
          hoverStyle={{ opacity: 0.92 }}
          pressStyle={{ opacity: 0.8 }}
          {...shadow.soft}
          onPress={() => openTransactionForm()}
          role="button"
          aria-label="Nuevo movimiento">
          <AppIcon name="add" size={17} color="#FFFFFF" />
          <Text fontSize={13} fontWeight="700" color="#FFFFFF">
            Nuevo
          </Text>
        </XStack>
      </XStack>

      {/* Chips de filtros activos */}
      {activeFilterCount > 0 ? (
        <XStack flexWrap="wrap" gap="$sm" alignItems="center">
          {typeFilter !== 'all' ? (
            <RemovableChip
              label={typeFilter === 'expense' ? 'Gastos' : 'Ingresos'}
              icon="filter"
              color={palette.primary}
              onRemove={() => setTypeFilter('all')}
            />
          ) : null}
          {onlyPending ? (
            <RemovableChip
              label="Pendientes"
              icon="time"
              color={palette.warning}
              onRemove={() => setOnlyPending(false)}
            />
          ) : null}
          {selectedCategories.map((categoryId) => {
            const category = categories.find((entry) => entry.id === categoryId)
            if (!category) return null
            return (
              <RemovableChip
                key={categoryId}
                label={category.name}
                icon={category.icon}
                color={category.color}
                onRemove={() => toggleCategory(categoryId)}
              />
            )
          })}
          {selectedPaymentMethods.map((methodId) => {
            const method = paymentMethods.find((entry) => entry.id === methodId)
            if (!method) return null
            return (
              <RemovableChip
                key={methodId}
                label={method.name}
                icon={getPaymentMethodIcon(method.type)}
                color={palette.primary}
                onRemove={() => togglePaymentMethod(methodId)}
              />
            )
          })}
          <Text
            fontSize={12}
            fontWeight="700"
            color="$primary"
            cursor="pointer"
            style={{ transition: CSS_TRANSITION }}
            pressStyle={{ opacity: 0.7 }}
            onPress={() => {
              clearFilters()
              setSearch('')
            }}>
            Limpiar todo
          </Text>
        </XStack>
      ) : null}

      {/* Agrupación por periodos de una tarjeta de crédito */}
      {activeCreditCard ? (
        <XStack alignItems="center" justifyContent="space-between" flexWrap="wrap" gap="$sm">
          <XStack alignItems="center" gap="$sm">
            <Text fontSize={11} fontWeight="600" color="$tabIconDefault">
              Agrupar por
            </Text>
            <GroupingToggle
              value={usePeriodGroups ? 'period' : 'month'}
              onChange={(value) => setGroupingMode(value)}
            />
          </XStack>
          <XStack alignItems="center" gap={4}>
            <AppIcon name="card-outline" size={13} color={palette.muted} />
            <Text fontSize={11} color="$tabIconDefault">
              {activeCreditCard.name} · Corte {activeCreditCard.closing_day}
              {activeCreditCard.due_day ? ` · Pago ${activeCreditCard.due_day}` : ''}
            </Text>
          </XStack>
        </XStack>
      ) : null}

      {usePeriodGroups && period.mode !== 'all' ? (
        <XStack
          alignItems="center"
          gap="$sm"
          paddingHorizontal="$sm"
          paddingVertical="$xs"
          borderRadius="$sm"
          backgroundColor={palette.warning + '12'}>
          <AppIcon name="information-circle" size={14} color={palette.warning} />
          <Text flex={1} fontSize={11} color="$tabIconDefault">
            Los totales por periodo pueden estar incompletos por el filtro de fechas.
          </Text>
          <Text
            fontSize={11}
            fontWeight="700"
            color="$primary"
            cursor="pointer"
            style={{ transition: CSS_TRANSITION }}
            pressStyle={{ opacity: 0.7 }}
            onPress={setAll}
            role="button"
            aria-label="Ver todo el historial">
            Ver todo el historial
          </Text>
        </XStack>
      ) : null}

      {/* Totales del filtro */}
      <XStack justifyContent="space-between" alignItems="center" paddingHorizontal="$xs">
        <Text fontSize={12} fontWeight="500" color="$tabIconDefault">
          {filtered.length} movimiento{filtered.length === 1 ? '' : 's'}
        </Text>
        <Text fontSize={14} fontWeight="800" color={total >= 0 ? '$income' : '$expense'}>
          {total >= 0 ? '+' : ''}
          {formatCurrency(total)}
        </Text>
      </XStack>

      {/* Lista */}
      {loading ? (
        <Text fontSize={14} color="$tabIconDefault">
          Cargando movimientos…
        </Text>
      ) : filtered.length === 0 ? (
        <YStack alignItems="center" gap="$md" paddingVertical="$xxl">
          <AppIcon name="receipt-outline" size={44} color={palette.muted} />
          <Text color="$tabIconDefault" textAlign="center">
            No hay movimientos con estos filtros.
          </Text>
        </YStack>
      ) : periodGroups ? (
        <YStack gap="$lg">
          {periodGroups.map((group) => {
            const collapsed = collapsedGroups.has(group.key)
            return (
              <YStack key={group.key} gap="$sm">
                <PeriodHeader
                  period={group.period}
                  cardName={activeCreditCard?.name ?? 'Tarjeta'}
                  count={group.transactions.length}
                  projectedCount={group.installmentLines.length + group.recurringLines.length}
                  total={group.total}
                  showTotal={periodGroups.length > 1}
                  collapsed={collapsed}
                  onToggle={() => toggleGroup(group.key)}
                />
                {!collapsed ? (
                  <YStack gap="$sm">
                    {group.transactions.map((transaction) => (
                      <TransactionRow
                        key={transaction.id}
                        transaction={transaction}
                        onOpen={() => navigate(`/movimientos/${transaction.id}`)}
                        onBreakdown={() => openBreakdown(transaction.id)}
                      />
                    ))}
                    <ProjectedCharges
                      installmentLines={group.installmentLines}
                      recurringLines={group.recurringLines}
                      total={group.projectedTotal}
                      onOpenTransaction={(id) => navigate(`/movimientos/${id}`)}
                    />
                  </YStack>
                ) : null}
              </YStack>
            )
          })}
        </YStack>
      ) : (
        <YStack gap="$lg">
          {groups.map((group) => {
            const collapsed = collapsedGroups.has(group.key)
            return (
              <YStack key={group.key} gap="$sm">
                {/* Cabecera de mes — discreta y colapsable */}
                <XStack
                  alignItems="center"
                  justifyContent="space-between"
                  paddingHorizontal="$sm"
                  paddingVertical="$xs"
                  borderRadius="$sm"
                  cursor="pointer"
                  style={{ transition: CSS_TRANSITION }}
                  hoverStyle={{ backgroundColor: '$surfaceHover' }}
                  pressStyle={{ opacity: 0.7 }}
                  onPress={() => toggleGroup(group.key)}
                  role="button"
                  aria-expanded={!collapsed}
                  aria-label={`${collapsed ? 'Expandir' : 'Contraer'} ${group.label}`}>
                  <XStack alignItems="center" gap="$sm">
                    <AppIcon
                      name={collapsed ? 'chevron-forward' : 'chevron-down'}
                      size={14}
                      color={palette.muted}
                    />
                    <Text {...TYPO.label} color="$tabIconDefault">
                      {group.label}
                    </Text>
                    <Text fontSize={11} fontWeight="600" color="$tabIconDefault">
                      · {group.transactions.length}
                    </Text>
                  </XStack>
                  {groups.length > 1 ? (
                    <Text fontSize={12} fontWeight="700" color="$tabIconDefault">
                      {group.total >= 0 ? '+' : ''}
                      {formatCurrency(group.total)}
                    </Text>
                  ) : null}
                </XStack>

                {!collapsed ? (
                  <YStack gap="$sm">
                    {group.transactions.map((transaction) => (
                      <TransactionRow
                        key={transaction.id}
                        transaction={transaction}
                        onOpen={() => navigate(`/movimientos/${transaction.id}`)}
                        onBreakdown={() => openBreakdown(transaction.id)}
                      />
                    ))}
                  </YStack>
                ) : null}
              </YStack>
            )
          })}
        </YStack>
      )}
    </YStack>
  )
}

// ═══════════════════════════════════════════════════════════════
// 🧩 Subcomponentes
// ═══════════════════════════════════════════════════════════════

function RemovableChip({
  label,
  icon,
  color,
  onRemove,
}: {
  label: string
  icon: string
  color: string
  onRemove: () => void
}) {
  return (
    <BorderedChip
      size="sm"
      cursor="pointer"
      style={{ transition: CSS_TRANSITION }}
      pressStyle={{ opacity: 0.7 }}
      hoverStyle={{ opacity: 0.9 }}
      backgroundColor={color + '18'}
      borderColor={color + '55'}
      onPress={onRemove}>
      <AppIcon name={icon} size={12} color={color} />
      <Text fontSize={12} fontWeight="600" color="$text">
        {label}
      </Text>
      <AppIcon name="close" size={12} color={color} />
    </BorderedChip>
  )
}

function GroupingToggle({
  value,
  onChange,
}: {
  value: 'month' | 'period'
  onChange: (value: 'month' | 'period') => void
}) {
  const options: { key: 'month' | 'period'; label: string }[] = [
    { key: 'month', label: 'Meses' },
    { key: 'period', label: 'Periodos' },
  ]

  return (
    <XStack
      gap={2}
      padding={2}
      borderRadius="$md"
      borderWidth={1}
      borderColor="$border"
      backgroundColor="$background">
      {options.map((option) => {
        const active = value === option.key
        return (
          <XStack
            key={option.key}
            height={26}
            paddingHorizontal="$sm"
            borderRadius="$sm"
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            style={{ transition: CSS_TRANSITION }}
            backgroundColor={active ? '$primaryLight' : 'transparent'}
            pressStyle={{ opacity: 0.8 }}
            onPress={() => onChange(option.key)}
            role="button"
            aria-pressed={active}
            aria-label={option.label}>
            <Text fontSize={11} fontWeight="700" color={active ? '$primary' : '$tabIconDefault'}>
              {option.label}
            </Text>
          </XStack>
        )
      })}
    </XStack>
  )
}

function PeriodHeader({
  period,
  cardName,
  count,
  projectedCount = 0,
  total,
  showTotal,
  collapsed,
  onToggle,
}: {
  period: StatementPeriod
  cardName: string
  count: number
  projectedCount?: number
  total: number
  showTotal: boolean
  collapsed: boolean
  onToggle: () => void
}) {
  const closingLabel = formatDateLabel(toISODate(period.closingDate))

  return (
    <XStack
      alignItems="flex-start"
      justifyContent="space-between"
      gap="$md"
      paddingHorizontal="$sm"
      paddingVertical="$xs"
      borderRadius="$sm"
      cursor="pointer"
      style={{ transition: CSS_TRANSITION }}
      hoverStyle={{ backgroundColor: '$surfaceHover' }}
      pressStyle={{ opacity: 0.7 }}
      onPress={onToggle}
      role="button"
      aria-expanded={!collapsed}
      aria-label={`${collapsed ? 'Expandir' : 'Contraer'} periodo con corte ${closingLabel}`}>
      <XStack flex={1} minWidth={0} alignItems="flex-start" gap="$sm">
        <AppIcon
          name={collapsed ? 'chevron-forward' : 'chevron-down'}
          size={14}
          color={palette.muted}
        />
        <YStack flex={1} minWidth={0} gap={2}>
          <Text {...TYPO.label} color="$tabIconDefault" numberOfLines={1}>
            {cardName} · Corte {closingLabel}
          </Text>
          <Text fontSize={11} color="$tabIconDefault" numberOfLines={1}>
            Ciclo {formatShortDate(period.startDate)} – {formatShortDate(period.closingDate)} ·{' '}
            {count} movimiento{count === 1 ? '' : 's'}
            {projectedCount > 0
              ? ` + ${projectedCount} proyectado${projectedCount === 1 ? '' : 's'}`
              : ''}
            {period.estimated ? ' · Pago estimado' : ` · Pago ${formatShortDate(period.dueDate)}`}
          </Text>
        </YStack>
      </XStack>
      {showTotal ? (
        <Text fontSize={12} fontWeight="700" color="$tabIconDefault">
          {total >= 0 ? '+' : ''}
          {formatCurrency(total)}
        </Text>
      ) : null}
    </XStack>
  )
}

function TransactionRow({
  transaction,
  onOpen,
  onBreakdown,
}: {
  transaction: Transaction
  onOpen: () => void
  onBreakdown: () => void
}) {
  const { user } = useAuth()
  const [expanded, setExpanded] = useState(false)

  const isIncome = transaction.type === 'income'
  const isPending = transaction.breakdown_status === 'pending'
  const paymentMethod = transaction.payment_method
  const isMSI = isInstallmentTransaction(transaction)
  const displayAmount = getTransactionDisplayAmount(transaction)

  const primaryDetail = transaction.details?.[0]
  const categoryIcon = primaryDetail?.category?.icon ?? (isIncome ? 'cash' : 'pricetag')
  const categoryColor = primaryDetail?.category?.color ?? (isIncome ? palette.income : palette.expense)
  const categoryName = primaryDetail?.category?.name ?? (isIncome ? 'Ingreso' : 'Gasto')
  const detailDescription = primaryDetail?.description
  const merchantName = transaction.merchant
  const title = merchantName || detailDescription || categoryName

  const details = transaction.details ?? []
  const hasMultipleDetails = details.length > 1

  return (
    <YStack
      borderRadius="$xl"
      overflow="hidden"
      backgroundColor="$card"
      borderWidth={1}
      borderColor={isPending ? palette.warning + '38' : '$border'}
      style={{ transition: CSS_TRANSITION }}
      {...shadow.soft}>
      {/* Fila principal: lo importante salta a la vista */}
      <XStack
        alignItems="center"
        gap="$md"
        padding="$md"
        cursor="pointer"
        style={{ transition: CSS_TRANSITION }}
        hoverStyle={{ backgroundColor: '$surfaceHover' }}
        pressStyle={{ opacity: 0.9 }}
        onPress={onOpen}
        role="button"
        aria-label={`Abrir movimiento ${title}`}>
        <CategoryIcon icon={categoryIcon} color={categoryColor} size={42} />

        <YStack flex={1} minWidth={0} gap={4}>
          <XStack alignItems="center" gap="$xs" minWidth={0}>
            <Text {...TYPO.cardTitle} color="$text" numberOfLines={1} flexShrink={1}>
              {title}
            </Text>
            {hasMultipleDetails ? (
              <Text fontSize={11} fontWeight="600" color="$tabIconDefault">
                +{details.length - 1}
              </Text>
            ) : null}
          </XStack>

          <XStack alignItems="center" gap="$xs" flexWrap="wrap">
            <CategoryTag icon={categoryIcon} color={categoryColor} label={categoryName} />
            <Text fontSize={11} color="$tabIconDefault">
              {formatDateLabel(transaction.date)}
            </Text>
            {isPending ? (
              <Text
                fontSize={10}
                fontWeight="800"
                textTransform="uppercase"
                letterSpacing={0.5}
                color="$warning">
                Pendiente
              </Text>
            ) : null}
            {isMSI ? (
              <Text
                fontSize={10}
                fontWeight="800"
                textTransform="uppercase"
                letterSpacing={0.4}
                color="$primary">
                MSI 1/{transaction.installments_count} · de {formatCurrency(transaction.amount)}
              </Text>
            ) : null}
          </XStack>
        </YStack>

        <YStack alignItems="flex-end" gap={3}>
          <Text {...TYPO.amount} color={isIncome ? '$income' : '$expense'}>
            {isIncome ? '+' : '-'}
            {formatCurrency(displayAmount)}
          </Text>
          {paymentMethod ? (
            <Text fontSize={11} color="$tabIconDefault" numberOfLines={1}>
              {paymentMethod.name}
            </Text>
          ) : null}
        </YStack>
      </XStack>

      {/* Meta: usuario que registró + acceso al desglose */}
      <XStack alignItems="center" flexWrap="wrap" gap="$sm" paddingHorizontal="$md" paddingBottom="$md">
        <Pill
          component={<AppIcon name="person-outline" size={12} color="#8A8A8A" />}
          label={getUserDisplayName(user)}
        />
        {hasMultipleDetails ? (
          <XStack
            alignItems="center"
            gap={4}
            cursor="pointer"
            style={{ transition: CSS_TRANSITION }}
            hoverStyle={{ opacity: 0.8 }}
            pressStyle={{ opacity: 0.7 }}
            onPress={() => setExpanded((value) => !value)}
            role="button"
            aria-expanded={expanded}
            aria-label={expanded ? 'Ocultar desglose' : 'Ver desglose'}>
            <AppIcon name={expanded ? 'chevron-up' : 'chevron-down'} size={13} color="#8A8A8A" />
            <Text fontSize={12} fontWeight="600" color="$tabIconDefault">
              {expanded ? 'Ocultar desglose' : `Ver desglose (${details.length})`}
            </Text>
          </XStack>
        ) : null}
      </XStack>

      {/* Desglose expandible con transición de altura */}
      {hasMultipleDetails ? (
        <YStack
          aria-hidden={!expanded}
          style={{
            display: 'grid',
            gridTemplateRows: expanded ? '1fr' : '0fr',
            transition: 'grid-template-rows 200ms ease',
          }}>
          <YStack style={{ overflow: 'hidden', minHeight: 0 }}>
            <YStack paddingHorizontal="$md" paddingBottom="$md">
              <YStack
                gap={2}
                padding="$sm"
                borderRadius="$md"
                borderWidth={1}
                borderColor="$border"
                backgroundColor="$background">
                {details.map((detail, index) => (
                  <XStack
                    key={detail.id}
                    alignItems="center"
                    gap="$sm"
                    paddingVertical="$xs"
                    borderTopWidth={index === 0 ? 0 : 1}
                    borderTopColor="$border">
                    <CategoryIcon
                      icon={detail.category?.icon ?? 'pricetag'}
                      color={detail.category?.color ?? '#8A8A8A'}
                      size={26}
                    />
                    <YStack flex={1} minWidth={0} gap={1}>
                      <Text fontSize={13} fontWeight="600" color="$text" numberOfLines={1}>
                        {detail.description || detail.category?.name || 'Ítem'}
                      </Text>
                      {detail.description &&
                      detail.category?.name &&
                      detail.description !== detail.category.name ? (
                        <Text fontSize={11} color="$tabIconDefault" numberOfLines={1}>
                          {detail.category.name}
                        </Text>
                      ) : null}
                    </YStack>
                    <Text fontSize={13} fontWeight="700" color="$text">
                      {formatCurrency(detail.quantity * detail.unit_price)}
                    </Text>
                  </XStack>
                ))}
              </YStack>
            </YStack>
          </YStack>
        </YStack>
      ) : null}

      {/* Acción clara para tickets pendientes de desglosar */}
      {isPending && !isIncome ? (
        <XStack
          alignItems="center"
          gap="$sm"
          marginHorizontal="$md"
          marginBottom="$md"
          paddingHorizontal="$md"
          paddingVertical="$sm"
          borderRadius="$md"
          backgroundColor="$warning12"
          cursor="pointer"
          style={{ transition: CSS_TRANSITION }}
          hoverStyle={{ opacity: 0.9 }}
          pressStyle={{ opacity: 0.8 }}
          onPress={onBreakdown}
          role="button"
          aria-label="Desglosar ticket">
          <AppIcon name="create-outline" size={16} color={palette.warning} />
          <Text fontSize={12} fontWeight="700" color="$warning">
            Desglosar ticket
          </Text>
          <YStack flex={1} />
          <Text fontSize={11} color="$tabIconDefault">
            {details.length > 1 ? `${details.length} ítems` : 'Pendiente'}
          </Text>
        </XStack>
      ) : null}
    </YStack>
  )
}

function ProjectedCharges({
  installmentLines,
  recurringLines,
  total,
  onOpenTransaction,
}: {
  installmentLines: ProjectionGroup['installmentLines']
  recurringLines: ProjectionGroup['recurringLines']
  total: number
  onOpenTransaction: (id: string) => void
}) {
  if (installmentLines.length === 0 && recurringLines.length === 0) return null

  return (
    <YStack
      gap="$sm"
      padding="$md"
      borderRadius="$lg"
      borderWidth={1}
      borderColor={palette.primary + '2E'}
      backgroundColor={palette.primary + '08'}>
      <XStack alignItems="center" justifyContent="space-between" gap="$md">
        <XStack alignItems="center" gap="$xs">
          <AppIcon name="time" size={14} color={palette.primary} />
          <Text fontSize={11} fontWeight="800" textTransform="uppercase" letterSpacing={0.5} color="$primary">
            Cargos proyectados
          </Text>
        </XStack>
        <Text fontSize={12} fontWeight="800" color="$primary">
          {formatCurrency(total)}
        </Text>
      </XStack>

      {installmentLines.map((line) => {
        const detail = line.transaction.details?.[0]
        return (
          <XStack
            key={line.id}
            alignItems="center"
            gap="$sm"
            paddingVertical="$xs"
            cursor="pointer"
            hoverStyle={{ opacity: 0.82 }}
            pressStyle={{ opacity: 0.7 }}
            onPress={() => onOpenTransaction(line.transaction.id)}
            role="button"
            aria-label={`Abrir compra a MSI ${line.label}`}>
            <CategoryIcon
              icon={detail?.category?.icon ?? 'card'}
              color={detail?.category?.color ?? palette.primary}
              size={28}
            />
            <YStack flex={1} minWidth={0} gap={1}>
              <Text fontSize={13} fontWeight="600" color="$text" numberOfLines={1}>
                {line.label}
              </Text>
              <Text fontSize={11} color="$tabIconDefault" numberOfLines={1}>
                MSI {line.installment.number}/{line.transaction.installments_count}
                {line.installment.paid ? ' · cubierta' : ''} · Pago{' '}
                {formatDateLabel(toISODate(line.installment.dueDate))}
              </Text>
            </YStack>
            <Text fontSize={13} fontWeight="700" color={line.installment.paid ? '$tabIconDefault' : '$text'}>
              {formatCurrency(line.amount)}
            </Text>
          </XStack>
        )
      })}

      {recurringLines.map((line) => (
        <XStack key={line.id} alignItems="center" gap="$sm" paddingVertical="$xs">
          <CategoryIcon
            icon={line.charge.category?.icon ?? 'repeat'}
            color={line.charge.category?.color ?? palette.warning}
            size={28}
          />
          <YStack flex={1} minWidth={0} gap={1}>
            <XStack alignItems="center" gap="$xs">
              <Text fontSize={13} fontWeight="600" color="$text" numberOfLines={1}>
                {line.label}
              </Text>
              {line.occurrence.estimated ? (
                <Text fontSize={9} fontWeight="800" textTransform="uppercase" color="$warning">
                  Est.
                </Text>
              ) : null}
            </XStack>
            <Text fontSize={11} color="$tabIconDefault" numberOfLines={1}>
              Recurrente · día {line.charge.charge_day} · Pago{' '}
              {formatDateLabel(toISODate(line.occurrence.dueDate))}
            </Text>
          </YStack>
          <Text fontSize={13} fontWeight="700" color="$text">
            {formatCurrency(line.amount)}
          </Text>
        </XStack>
      ))}

      <Text fontSize={10} color="$tabIconDefault">
        Proyección informativa. El pago real se registra como movimiento.
      </Text>
    </YStack>
  )
}

function CategoryTag({ icon, color, label }: { icon: string; color: string; label: string }) {
  return (
    <XStack
      alignItems="center"
      gap={4}
      paddingHorizontal={8}
      paddingVertical={2}
      borderRadius="$full"
      backgroundColor={color + '1A'}>
      <AppIcon name={icon} size={11} color={color} />
      <Text fontSize={11} fontWeight="600" color="$textSecondary" numberOfLines={1}>
        {label}
      </Text>
    </XStack>
  )
}
