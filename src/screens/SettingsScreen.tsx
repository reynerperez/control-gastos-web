import { useNavigate } from 'react-router-dom'
import { Text, XStack, YStack } from 'tamagui'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { AppIcon } from '@/components/ui/Icon'
import { palette } from '@/constants/theme'
import { CSS_TRANSITION } from '@/constants/ui'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/hooks/useData'
import { getUserDisplayName } from '@/utils/user'

/**
 * Ajustes — resumen de configuración. Las secciones con CRUD (categorías y
 * métodos de pago) tienen su propia pantalla para no amontonar la lista.
 */
export default function SettingsScreen() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { categories, paymentMethods } = useData()

  const expenseCount = categories.filter((category) => category.type === 'expense').length
  const incomeCount = categories.filter((category) => category.type === 'income').length

  return (
    <YStack gap="$lg">
      {/* Perfil */}
      <Card>
        <XStack alignItems="center" gap="$md">
          <YStack
            width={52}
            height={52}
            borderRadius="$full"
            alignItems="center"
            justifyContent="center"
            backgroundColor={palette.primaryLight}>
            <AppIcon name="person" size={26} color={palette.primary} />
          </YStack>
          <YStack flex={1} minWidth={0}>
            <Text fontSize={17} fontWeight="800" color="$text">
              {getUserDisplayName(user)}
            </Text>
            <Text fontSize={13} color="$tabIconDefault">
              {user?.email}
            </Text>
          </YStack>
          <Button title="Cerrar sesión" variant="secondary" size="sm" onPress={() => void signOut()} />
        </XStack>
      </Card>

      {/* Secciones */}
      <YStack gap="$sm">
        <Text fontSize={16} fontWeight="800" color="$text">
          Configuración
        </Text>
        <Card gap="$xs" noPadding>
          <SettingsRow
            icon="pricetag"
            iconColor={palette.primary}
            title="Categorías"
            subtitle={`${expenseCount} de gastos · ${incomeCount} de ingresos`}
            ariaLabel="Categorías"
            onPress={() => navigate('/ajustes/categorias')}
          />
          <SettingsRow
            icon="card-outline"
            iconColor={palette.primary}
            title="Métodos de pago"
            subtitle={`${paymentMethods.length} registrados`}
            ariaLabel="Métodos de pago"
            onPress={() => navigate('/ajustes/metodos-de-pago')}
          />
        </Card>
      </YStack>

      <Text fontSize={12} textAlign="center" color="$tabIconDefault">
        Control de Gastos · Web v1.0
      </Text>
    </YStack>
  )
}

function SettingsRow({
  icon,
  iconColor,
  title,
  subtitle,
  ariaLabel,
  onPress,
}: {
  icon: string
  iconColor: string
  title: string
  subtitle: string
  ariaLabel: string
  onPress: () => void
}) {
  return (
    <XStack
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
      onPress={onPress}
      role="button"
      aria-label={ariaLabel}>
      <YStack
        width={40}
        height={40}
        borderRadius="$full"
        alignItems="center"
        justifyContent="center"
        backgroundColor={palette.primaryLight}>
        <AppIcon name={icon} size={20} color={iconColor} />
      </YStack>
      <YStack flex={1} minWidth={0}>
        <Text fontSize={15} fontWeight="600" color="$text">
          {title}
        </Text>
        <Text fontSize={12} color="$tabIconDefault">
          {subtitle}
        </Text>
      </YStack>
      <AppIcon name="chevron-forward" size={18} color={palette.muted} />
    </XStack>
  )
}
