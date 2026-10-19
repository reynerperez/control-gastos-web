import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Text, XStack, YStack } from 'tamagui'

import { Button } from '@/components/ui/Button'
import { AppIcon } from '@/components/ui/Icon'
import { Form, FormError, TextInput } from '@/components/ui/Field'
import { palette } from '@/constants/theme'
import { shadow } from '@/constants/ui'
import { useAuth } from '@/contexts/AuthContext'

export default function LoginScreen() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async () => {
    if (!email || !password) {
      setError('Ingresa tu correo y contraseña.')
      return
    }
    setError(null)
    setLoading(true)
    const result = await signIn(email, password)
    setLoading(false)
    if (result.error) setError(result.error)
  }

  return (
    <AuthLayout
      icon="wallet"
      title="Bienvenido de nuevo"
      subtitle="Inicia sesión para gestionar tus gastos">
      <Form onSubmit={() => void onSubmit()}>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Correo electrónico"
          type="email"
          autoComplete="email"
          aria-label="Correo electrónico"
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Contraseña"
          type="password"
          autoComplete="current-password"
          aria-label="Contraseña"
          onSubmitEditing={onSubmit}
        />

        {error ? <FormError>{error}</FormError> : null}

        <Button title="Iniciar sesión" onPress={onSubmit} loading={loading} />

        <XStack justifyContent="center" gap="$xs" marginTop="$sm">
          <Text fontSize={14} color="$tabIconDefault">
            ¿No tienes cuenta?
          </Text>
          <Link to="/registro">
            <Text fontSize={14} fontWeight="700" color="$primary">
              Regístrate
            </Text>
          </Link>
        </XStack>
      </Form>
    </AuthLayout>
  )
}

/** Layout compartido por login y registro */
export function AuthLayout({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: string
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <YStack flex={1} minHeight="100vh" alignItems="center" justifyContent="center" backgroundColor="$background" padding="$lg">
      <YStack
        width={420}
        maxWidth="100%"
        gap="$lg"
        padding="$xl"
        backgroundColor="$card"
        borderColor="$border"
        borderWidth={1}
        borderRadius="$xl"
        {...shadow.card}>
        <YStack alignItems="center" gap="$sm">
          <YStack
            width={64}
            height={64}
            borderRadius="$xl"
            alignItems="center"
            justifyContent="center"
            backgroundColor={palette.primaryLight}>
            <AppIcon name={icon} size={32} color={palette.primary} />
          </YStack>
          <Text fontSize={24} fontWeight="800" color="$text" textAlign="center">
            {title}
          </Text>
          <Text fontSize={14} color="$tabIconDefault" textAlign="center">
            {subtitle}
          </Text>
        </YStack>

        {children}
      </YStack>
    </YStack>
  )
}
