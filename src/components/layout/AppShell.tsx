import { useLocation, useNavigate } from 'react-router-dom'
import { Text, XStack, YStack, ScrollView } from 'tamagui'

import { Button } from '@/components/ui/Button'
import { AppIcon } from '@/components/ui/Icon'
import { palette } from '@/constants/theme'
import { CSS_TRANSITION } from '@/constants/ui'
import { useAuth } from '@/contexts/AuthContext'
import { useModals } from '@/contexts/ModalsContext'
import { useData } from '@/hooks/useData'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import { getUserDisplayName } from '@/utils/user'

// ═══════════════════════════════════════════════════════════════
// 🧭 AppShell — layout web: sidebar de navegación + cabecera + contenido
//    Reemplaza a las NativeTabs de la app móvil.
//    Mobile-first: en pantallas chicas la navegación es una barra superior.
// ═══════════════════════════════════════════════════════════════

const NAV_ITEMS = [
  { to: '/', label: 'Resumen', icon: 'pie-chart-outline' },
  { to: '/movimientos', label: 'Movimientos', icon: 'swap-horiz' },
  { to: '/compromisos', label: 'Compromisos', icon: 'repeat' },
  { to: '/presupuestos', label: 'Presupuestos', icon: 'wallet' },
  { to: '/ajustes', label: 'Ajustes', icon: 'settings-outline' },
]

const PAGE_TITLES: { match: (path: string) => boolean; title: string; subtitle?: string }[] = [
  { match: (p) => p === '/', title: 'Resumen', subtitle: 'Balance, gastos por categoría y presupuestos' },
  {
    match: (p) => p === '/movimientos',
    title: 'Movimientos',
    subtitle: 'Historial de ingresos y gastos',
  },
  {
    match: (p) => p.startsWith('/movimientos/'),
    title: 'Detalle del movimiento',
  },
  {
    match: (p) => p === '/compromisos',
    title: 'Compromisos',
    subtitle: 'MSI activos, servicios y suscripciones proyectadas',
  },
  { match: (p) => p === '/presupuestos', title: 'Presupuestos', subtitle: 'Límites mensuales por categoría' },
  { match: (p) => p === '/ajustes/categorias', title: 'Categorías', subtitle: 'Organiza tus categorías de gastos e ingresos' },
  { match: (p) => p === '/ajustes/metodos-de-pago', title: 'Métodos de pago', subtitle: 'Efectivo, tarjetas y sus fechas de corte' },
  { match: (p) => p === '/ajustes/espacio', title: 'Espacio compartido', subtitle: 'Invita a otra persona y compartan todos sus datos' },
  { match: (p) => p === '/ajustes', title: 'Ajustes', subtitle: 'Cuenta y configuración' },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, signOut } = useAuth()
  const { openTransactionForm } = useModals()
  const { loading } = useData()

  // Refresco al volver a la pestaña: el espacio compartido no usa realtime.
  useAutoRefresh()

  const page = PAGE_TITLES.find((item) => item.match(location.pathname)) ?? PAGE_TITLES[0]

  return (
    <YStack height="100vh" backgroundColor="$background" flexDirection="column" $gtSm={{ flexDirection: 'row' }}>
      {/* ═══════ Sidebar / barra superior en mobile ═══════ */}
      <YStack
        width="100%"
        flexShrink={0}
        backgroundColor="$card"
        borderBottomWidth={1}
        borderBottomColor="$border"
        $gtSm={{
          width: 248,
          height: '100%',
          borderBottomWidth: 0,
          borderRightWidth: 1,
          borderRightColor: '$border',
        }}>
        {/* Marca */}
        <XStack alignItems="center" gap="$md" padding="$lg">
          <YStack
            width={38}
            height={38}
            borderRadius="$md"
            alignItems="center"
            justifyContent="center"
            backgroundColor={palette.primaryLight}>
            <AppIcon name="wallet" size={20} color={palette.primary} />
          </YStack>
          <YStack flex={1}>
            <Text fontSize={15} fontWeight="800" color="$text">
              Control de Gastos
            </Text>
            <Text fontSize={12} color="$tabIconDefault">
              v1.1
            </Text>
          </YStack>
        </XStack>

        {/* Navegación */}
        <XStack gap="$xs" paddingHorizontal="$md" paddingBottom="$md" $gtSm={{ flexDirection: 'column', paddingBottom: 0 }}>
          {NAV_ITEMS.map((item) => {
            const active =
              item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
            return (
              <XStack
                key={item.to}
                alignItems="center"
                justifyContent="center"
                gap="$sm"
                height={42}
                // En mobile los ítems reparten el ancho; en desktop cada uno
                // ocupa su contenido (usar `flex` con basis 0 los colapsaba)
                flexGrow={1}
                flexBasis="auto"
                $gtSm={{ flexGrow: 0, justifyContent: 'flex-start' }}
                paddingHorizontal="$md"
                borderRadius="$md"
                cursor="pointer"
                style={{ transition: CSS_TRANSITION }}
                backgroundColor={active ? '$primaryLight' : 'transparent'}
                hoverStyle={{ backgroundColor: active ? '$primaryLight' : '$surfaceHover' }}
                pressStyle={{ opacity: 0.7 }}
                onPress={() => navigate(item.to)}
                role="link"
                aria-label={item.label}>
                <AppIcon name={item.icon} size={18} color={active ? palette.primary : '#8A8A8A'} />
                {/* En pantallas chicas la barra superior muestra solo iconos
                    (el aria-label mantiene la accesibilidad) */}
                <Text
                  display="none"
                  $gtSm={{ display: 'flex' }}
                  fontSize={14}
                  fontWeight={active ? '700' : '500'}
                  color={active ? '$primary' : '$textSecondary'}>
                  {item.label}
                </Text>
              </XStack>
            )
          })}
        </XStack>

        {/* Usuario + salir (solo desktop) */}
        <YStack flex={1} />

        <YStack
          display="none"
          $gtSm={{ display: 'flex' }}
          gap="$sm"
          padding="$md"
          borderTopWidth={1}
          borderTopColor="$border">
          <XStack alignItems="center" gap="$sm">
            <YStack
              width={34}
              height={34}
              borderRadius="$full"
              alignItems="center"
              justifyContent="center"
              backgroundColor="$primaryLight">
              <AppIcon name="person" size={17} color={palette.primary} />
            </YStack>
            <YStack flex={1} minWidth={0}>
              <Text fontSize={13} fontWeight="700" color="$text" numberOfLines={1}>
                {getUserDisplayName(user)}
              </Text>
              <Text fontSize={11} color="$tabIconDefault" numberOfLines={1}>
                {user?.email}
              </Text>
            </YStack>
            <XStack
              width={34}
              height={34}
              alignItems="center"
              justifyContent="center"
              borderRadius="$md"
              cursor="pointer"
              style={{ transition: CSS_TRANSITION }}
              hoverStyle={{ backgroundColor: '$surfaceHover' }}
              pressStyle={{ opacity: 0.6 }}
              onPress={() => {
                if (window.confirm('¿Seguro que quieres cerrar sesión?')) {
                  void signOut()
                }
              }}
              role="button"
              aria-label="Cerrar sesión">
              <AppIcon name="log-out-outline" size={18} color={palette.expense} />
            </XStack>
          </XStack>
        </YStack>
      </YStack>

      {/* ═══════ Contenido ═══════ */}
      <YStack flex={1} minWidth={0} height="100%">
        {/* Cabecera */}
        <XStack
          alignItems="center"
          justifyContent="space-between"
          gap="$md"
          paddingHorizontal="$lg"
          paddingVertical="$md"
          borderBottomWidth={1}
          borderBottomColor="$border"
          backgroundColor="$background">
          <YStack flex={1} minWidth={0}>
            <Text fontSize={20} fontWeight="800" color="$text" numberOfLines={1}>
              {page.title}
            </Text>
            {page.subtitle ? (
              <Text
                display="none"
                $gtSm={{ display: 'flex' }}
                fontSize={13}
                color="$tabIconDefault"
                numberOfLines={1}>
                {page.subtitle}
              </Text>
            ) : null}
          </YStack>

          <Button
            title={loading ? 'Cargando…' : '+ Nuevo movimiento'}
            onPress={() => openTransactionForm()}
            disabled={loading}
          />
        </XStack>

        <ScrollView flex={1} minHeight={0} backgroundColor="$background">
          <YStack padding="$lg" paddingBottom="$xxl" gap="$lg" maxWidth={1200} width="100%" alignSelf="center">
            {children}
          </YStack>
        </ScrollView>
      </YStack>
    </YStack>
  )
}
