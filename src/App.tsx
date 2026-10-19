import { useEffect } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { Spinner, YStack } from 'tamagui'

import { AppShell } from '@/components/layout/AppShell'
import { palette } from '@/constants/theme'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { FiltersProvider } from '@/contexts/FiltersContext'
import { HolidaysProvider } from '@/contexts/HolidaysContext'
import { ModalsProvider } from '@/contexts/ModalsContext'
import { PeriodProvider } from '@/contexts/PeriodContext'
import { DataProvider } from '@/hooks/useData'
import BudgetsScreen from '@/screens/BudgetsScreen'
import CategoriesScreen from '@/screens/CategoriesScreen'
import CommitmentsScreen from '@/screens/CommitmentsScreen'
import DashboardScreen from '@/screens/DashboardScreen'
import LoginScreen from '@/screens/LoginScreen'
import PaymentMethodsScreen from '@/screens/PaymentMethodsScreen'
import SettingsScreen from '@/screens/SettingsScreen'
import SignupScreen from '@/screens/SignupScreen'
import TransactionDetailScreen from '@/screens/TransactionDetailScreen'
import TransactionsScreen from '@/screens/TransactionsScreen'

/**
 * App — providers + rutas (equivale a app/_layout.tsx + app/(tabs)/ del móvil).
 *
 * Mismo árbol de providers que la app móvil para poder compartir
 * contextos y la capa de datos sin cambios.
 */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <HolidaysProvider>
          <PeriodProvider>
            <FiltersProvider>
              <DataProvider>
                <ModalsProvider>
                  <Routes>
                    <Route path="/login" element={<PublicOnly><LoginScreen /></PublicOnly>} />
                    <Route path="/registro" element={<PublicOnly><SignupScreen /></PublicOnly>} />
                    <Route element={<ProtectedLayout />}>
                      <Route path="/" element={<DashboardScreen />} />
                      <Route path="/movimientos" element={<TransactionsScreen />} />
                      <Route path="/movimientos/:id" element={<TransactionDetailScreen />} />
                      <Route path="/compromisos" element={<CommitmentsScreen />} />
                      <Route path="/presupuestos" element={<BudgetsScreen />} />
                      <Route path="/ajustes" element={<SettingsScreen />} />
                      <Route path="/ajustes/categorias" element={<CategoriesScreen />} />
                      <Route path="/ajustes/metodos-de-pago" element={<PaymentMethodsScreen />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </ModalsProvider>
              </DataProvider>
            </FiltersProvider>
          </PeriodProvider>
        </HolidaysProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

function FullScreenLoader() {
  return (
    <YStack flex={1} height="100vh" alignItems="center" justifyContent="center" backgroundColor="$background">
      <Spinner size="large" color={palette.primary} />
    </YStack>
  )
}

/** Rutas privadas: exige sesión y monta el layout con navegación */
function ProtectedLayout() {
  const { session, loading } = useAuth()

  if (loading) return <FullScreenLoader />
  if (!session) return <Navigate to="/login" replace />

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

/** Login/registro: si ya hay sesión, entra directo a la app */
function PublicOnly({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && session) {
      navigate('/', { replace: true })
    }
  }, [loading, session, navigate])

  if (loading) return <FullScreenLoader />
  return <>{children}</>
}
