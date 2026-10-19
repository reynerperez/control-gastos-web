import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Text, XStack } from 'tamagui'

import { Button } from '@/components/ui/Button'
import { Form, FormError, TextInput } from '@/components/ui/Field'
import { useAuth } from '@/contexts/AuthContext'
import { AuthLayout } from '@/screens/LoginScreen'

export default function SignupScreen() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const onSubmit = async () => {
    if (!fullName || !email || !password) {
      setError('Completa todos los campos.')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    setError(null)
    setLoading(true)
    const result = await signUp(email, password, fullName)
    setLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setDone(true)
    setTimeout(() => navigate('/login', { replace: true }), 2500)
  }

  if (done) {
    return (
      <AuthLayout icon="person-add" title="Cuenta creada" subtitle="Ya puedes iniciar sesión">
        <Text fontSize={14} color="$textSecondary" textAlign="center">
          Si la confirmación de correo está activada en Supabase, revisa tu bandeja de entrada.
          Te llevamos al inicio de sesión…
        </Text>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      icon="person-add"
      title="Crea tu cuenta"
      subtitle="Empieza a controlar tus finanzas hoy">
      <Form onSubmit={() => void onSubmit()}>
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Nombre completo"
          autoComplete="name"
          aria-label="Nombre completo"
        />
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
          placeholder="Contraseña (mín. 6 caracteres)"
          type="password"
          autoComplete="new-password"
          aria-label="Contraseña"
          onSubmitEditing={onSubmit}
        />

        {error ? <FormError>{error}</FormError> : null}

        <Button title="Registrarme" onPress={onSubmit} loading={loading} />

        <XStack justifyContent="center" gap="$xs" marginTop="$sm">
          <Text fontSize={14} color="$tabIconDefault">
            ¿Ya tienes cuenta?
          </Text>
          <Link to="/login">
            <Text fontSize={14} fontWeight="700" color="$primary">
              Inicia sesión
            </Text>
          </Link>
        </XStack>
      </Form>
    </AuthLayout>
  )
}
