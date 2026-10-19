import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Text, XStack, YStack } from 'tamagui'

import { CategoryEditorModal } from '@/components/settings/CategoryEditorModal'
import { BackLink } from '@/components/ui/BackLink'
import { Card } from '@/components/ui/Card'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { AppIcon } from '@/components/ui/Icon'
import { palette } from '@/constants/theme'
import { CSS_TRANSITION } from '@/constants/ui'
import { useData } from '@/hooks/useData'
import { Category, TransactionType } from '@/types'

/**
 * Categorías — pantalla propia (antes dentro de Ajustes).
 * Lista las categorías de gasto/ingreso y permite crear, editar y borrar.
 */
export default function CategoriesScreen() {
  const navigate = useNavigate()
  const { categories } = useData()
  const [editor, setEditor] = useState<{
    editing: Category | null
    creating: TransactionType | null
  } | null>(null)

  const expenseCategories = categories.filter((category) => category.type === 'expense')
  const incomeCategories = categories.filter((category) => category.type === 'income')

  const open = (editing: Category | null, creating: TransactionType | null) =>
    setEditor({ editing, creating })

  return (
    <YStack gap="$lg">
      <BackLink onPress={() => navigate('/ajustes')} />

      <CategorySection
        title="Categorías de gastos"
        addLabel="Agregar categoría de gastos"
        items={expenseCategories}
        onAdd={() => open(null, 'expense')}
        onEdit={(category) => open(category, null)}
      />
      <CategorySection
        title="Categorías de ingresos"
        addLabel="Agregar categoría de ingresos"
        items={incomeCategories}
        onAdd={() => open(null, 'income')}
        onEdit={(category) => open(category, null)}
      />

      {editor ? (
        <CategoryEditorModal
          key={editor.editing?.id ?? editor.creating}
          editing={editor.editing}
          creating={editor.creating}
          onClose={() => setEditor(null)}
        />
      ) : null}
    </YStack>
  )
}

function CategorySection({
  title,
  addLabel,
  items,
  onAdd,
  onEdit,
}: {
  title: string
  addLabel: string
  items: Category[]
  onAdd: () => void
  onEdit: (category: Category) => void
}) {
  return (
    <YStack gap="$sm">
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontSize={16} fontWeight="800" color="$text">
          {title}
        </Text>
        <XStack
          alignItems="center"
          gap="$xs"
          cursor="pointer"
          role="button"
          aria-label={addLabel}
          pressStyle={{ opacity: 0.7 }}
          onPress={onAdd}>
          <AppIcon name="add" size={16} color={palette.primary} />
          <Text fontSize={14} fontWeight="700" color="$primary">
            Agregar
          </Text>
        </XStack>
      </XStack>
      <Card gap="$xs" noPadding>
        {items.length === 0 ? (
          <Text fontSize={14} color="$tabIconDefault" padding="$lg">
            Sin categorías todavía.
          </Text>
        ) : (
          items.map((category) => (
            <XStack
              key={category.id}
              alignItems="center"
              gap="$md"
              marginHorizontal="$xs"
              paddingHorizontal="$md"
              paddingVertical="$md"
              borderRadius="$md"
              cursor="pointer"
              style={{ transition: CSS_TRANSITION }}
              hoverStyle={{ backgroundColor: '$surfaceHover' }}
              pressStyle={{ opacity: 0.85 }}
              onPress={() => onEdit(category)}>
              <CategoryIcon icon={category.icon} color={category.color} size={36} />
              <YStack flex={1} minWidth={0}>
                <Text fontSize={15} fontWeight="600" color="$text">
                  {category.name}
                </Text>
                {category.requires_breakdown ? (
                  <Text fontSize={11} fontWeight="700" color="$warning">
                    Desglose por defecto
                  </Text>
                ) : null}
              </YStack>
              <AppIcon name="chevron-forward" size={18} color={palette.muted} />
            </XStack>
          ))
        )}
      </Card>
    </YStack>
  )
}
