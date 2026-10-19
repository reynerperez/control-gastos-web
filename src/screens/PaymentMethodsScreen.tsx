import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Text, XStack, YStack } from 'tamagui'

import { PaymentMethodEditorModal } from '@/components/settings/PaymentMethodEditorModal'
import { BackLink } from '@/components/ui/BackLink'
import { Card } from '@/components/ui/Card'
import { AppIcon } from '@/components/ui/Icon'
import { palette } from '@/constants/theme'
import { CSS_TRANSITION } from '@/constants/ui'
import { useData } from '@/hooks/useData'
import { PaymentMethod, PaymentMethodType } from '@/types'

const typeColor = (type: PaymentMethodType) =>
  type === 'credit' ? palette.warning : type === 'debit' ? palette.primary : palette.muted

const typeLabel = (method: PaymentMethod) => {
  if (method.type === 'cash') return 'Efectivo'
  const holder = method.cardholder_name
    ? ` · A nombre de ${method.cardholder_name}`
    : ''
  if (method.type === 'debit') return `Débito${holder}`
  const grace = method.grace_days ?? 20
  const graceType = method.grace_days_type === 'business' ? 'hábiles' : 'naturales'
  return `Crédito · Corte ${method.closing_day ?? '—'} · Pago ${grace} días ${graceType}${holder}`
}

/**
 * Métodos de pago — pantalla propia (antes dentro de Ajustes).
 * Lista los métodos y permite crear, editar y borrar.
 */
export default function PaymentMethodsScreen() {
  const navigate = useNavigate()
  const { paymentMethods } = useData()
  const [editing, setEditing] = useState<PaymentMethod | null | undefined>(undefined)

  return (
    <YStack gap="$lg">
      <BackLink onPress={() => navigate('/ajustes')} />

      <YStack gap="$sm">
        <XStack justifyContent="space-between" alignItems="center">
          <Text fontSize={16} fontWeight="800" color="$text">
            Métodos de pago
          </Text>
          <XStack
            alignItems="center"
            gap="$xs"
            cursor="pointer"
            role="button"
            aria-label="Agregar método de pago"
            pressStyle={{ opacity: 0.7 }}
            onPress={() => setEditing(null)}>
            <AppIcon name="add" size={16} color={palette.primary} />
            <Text fontSize={14} fontWeight="700" color="$primary">
              Agregar
            </Text>
          </XStack>
        </XStack>

        <Card gap={0} noPadding>
          {paymentMethods.length === 0 ? (
            <Text fontSize={14} color="$tabIconDefault" padding="$lg">
              Sin métodos de pago todavía.
            </Text>
          ) : (
            paymentMethods.map((method) => (
              <XStack
                key={method.id}
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
                onPress={() => setEditing(method)}>
                <YStack
                  width={40}
                  height={40}
                  borderRadius="$full"
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor={method.type === 'credit' ? palette.warning + '22' : palette.primaryLight}>
                  <AppIcon
                    name={
                      method.type === 'cash' ? 'cash-outline' : method.type === 'debit' ? 'card-outline' : 'card'
                    }
                    size={20}
                    color={typeColor(method.type)}
                  />
                </YStack>
                <YStack flex={1} minWidth={0}>
                  <Text fontSize={15} fontWeight="600" color="$text">
                    {method.name}
                  </Text>
                  <Text fontSize={12} color="$tabIconDefault">
                    {typeLabel(method)}
                  </Text>
                </YStack>
                <AppIcon name="chevron-forward" size={18} color={palette.muted} />
              </XStack>
            ))
          )}
        </Card>
      </YStack>

      {editing !== undefined ? (
        <PaymentMethodEditorModal
          key={editing?.id ?? 'nuevo'}
          editing={editing}
          onClose={() => setEditing(undefined)}
        />
      ) : null}
    </YStack>
  )
}
