import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Text, XStack, YStack } from 'tamagui'

import { BackLink } from '@/components/ui/BackLink'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Form, FormError, TextInput } from '@/components/ui/Field'
import { AppIcon } from '@/components/ui/Icon'
import { palette } from '@/constants/theme'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/hooks/useData'

/**
 * Espacio compartido — muestra el código de invitación, los miembros del
 * hogar y permite unirse a otro espacio con un código.
 *
 * Todos los datos (movimientos, categorías, medios de pago, presupuestos y
 * compromisos) se comparten entre los miembros del mismo hogar.
 */
export default function SharedSpaceScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    household,
    householdMembers,
    loading,
    joinHousehold,
    leaveHousehold,
    regenerateInviteCode,
  } = useData()

  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<'join' | 'leave' | 'regenerate' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const copyCode = async () => {
    if (!household) return
    setError(null)
    try {
      await navigator.clipboard.writeText(household.invite_code)
      setCopied(true)
      setNotice('Código copiado. Compártelo con otra persona.')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('No se pudo copiar el código. Cópialo manualmente.')
    }
  }

  const handleJoin = async () => {
    setError(null)
    setNotice(null)
    if (!code.trim()) {
      setError('Escribe un código de invitación.')
      return
    }
    if (
      !window.confirm(
        'Al unirte, tus movimientos, categorías, métodos de pago, presupuestos y compromisos se moverán al espacio compartido. ¿Continuar?'
      )
    ) {
      return
    }
    setBusy('join')
    try {
      await joinHousehold(code)
      setCode('')
      setNotice('Ya formas parte del espacio compartido. Ahora ven los mismos datos.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo unir al espacio.')
    } finally {
      setBusy(null)
    }
  }

  const handleRegenerate = async () => {
    setError(null)
    setNotice(null)
    if (
      !window.confirm(
        'Se generará un código nuevo y el anterior dejará de funcionar. ¿Continuar?'
      )
    ) {
      return
    }
    setBusy('regenerate')
    try {
      await regenerateInviteCode()
      setNotice('Código actualizado. Comparte el nuevo código.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el código.')
    } finally {
      setBusy(null)
    }
  }

  const handleLeave = async () => {
    setError(null)
    setNotice(null)
    if (
      !window.confirm(
        'Saldrás del espacio compartido y dejarás de ver sus datos. Los movimientos permanecerán en el espacio (son compartidos) y tú tendrás un espacio personal nuevo. ¿Continuar?'
      )
    ) {
      return
    }
    setBusy('leave')
    try {
      await leaveHousehold()
      setNotice('Saliste del espacio compartido. Tu espacio personal está listo.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo salir del espacio.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <YStack gap="$lg">
      <BackLink onPress={() => navigate('/ajustes')} />

      {!household ? (
        <Card>
          <Text fontSize={14} color="$tabIconDefault">
            {loading
              ? 'Cargando tu espacio compartido…'
              : 'No encontramos tu espacio compartido. Recarga la página.'}
          </Text>
        </Card>
      ) : (
        <>
          {/* Código de invitación */}
          <Card gap="$md">
            <XStack alignItems="center" gap="$md">
              <YStack
                width={44}
                height={44}
                borderRadius="$full"
                alignItems="center"
                justifyContent="center"
                backgroundColor={palette.primaryLight}>
                <AppIcon name="person-add" size={22} color={palette.primary} />
              </YStack>
              <YStack flex={1} minWidth={0}>
                <Text fontSize={16} fontWeight="800" color="$text">
                  {household.name}
                </Text>
                <Text fontSize={12} color="$tabIconDefault">
                  {householdMembers.length}{' '}
                  {householdMembers.length === 1 ? 'miembro' : 'miembros'} · Todo se comparte
                </Text>
              </YStack>
            </XStack>

            <YStack
              gap="$xs"
              paddingVertical="$md"
              paddingHorizontal="$md"
              borderRadius="$md"
              backgroundColor="$primaryLight"
              alignItems="center">
              <Text fontSize={11} fontWeight="700" color="$tabIconDefault" textTransform="uppercase">
                Código de invitación
              </Text>
              <Text
                fontSize={30}
                fontWeight="800"
                letterSpacing={6}
                color="$primary"
                aria-label="Código de invitación">
                {household.invite_code}
              </Text>
            </YStack>

            <XStack gap="$sm" flexWrap="wrap">
              <Button
                title={copied ? 'Copiado' : 'Copiar código'}
                variant="secondary"
                size="sm"
                onPress={() => void copyCode()}
              />
              <Button
                title="Generar código nuevo"
                variant="ghost"
                size="sm"
                loading={busy === 'regenerate'}
                onPress={() => void handleRegenerate()}
              />
            </XStack>

            <Text fontSize={12} color="$tabIconDefault" lineHeight={18}>
              Comparte este código con la otra persona. Desde su cuenta debe ir a
              Ajustes → Espacio compartido → Unirme con código.
            </Text>
          </Card>

          {/* Miembros */}
          <YStack gap="$sm">
            <Text fontSize={16} fontWeight="800" color="$text">
              Miembros
            </Text>
            <Card gap="$sm" noPadding>
              {householdMembers.map((member) => {
                const isMe = member.user_id === user?.id
                const name = isMe
                  ? 'Tú'
                  : member.profile?.full_name?.trim() || 'Miembro del espacio'
                return (
                  <XStack
                    key={member.user_id}
                    alignItems="center"
                    gap="$md"
                    paddingHorizontal="$md"
                    paddingVertical="$md"
                    borderBottomWidth={1}
                    borderBottomColor="$border">
                    <YStack
                      width={38}
                      height={38}
                      borderRadius="$full"
                      alignItems="center"
                      justifyContent="center"
                      backgroundColor={palette.primaryLight}>
                      <AppIcon name="person" size={19} color={palette.primary} />
                    </YStack>
                    <YStack flex={1} minWidth={0}>
                      <Text fontSize={14} fontWeight="700" color="$text">
                        {name}
                      </Text>
                      <Text fontSize={12} color="$tabIconDefault">
                        {member.role === 'owner' ? 'Propietario' : 'Miembro'}
                      </Text>
                    </YStack>
                  </XStack>
                )
              })}
            </Card>
          </YStack>

          {/* Unirse a otro espacio */}
          <YStack gap="$sm">
            <Text fontSize={16} fontWeight="800" color="$text">
              Unirme con código
            </Text>
            <Card gap="$md">
              <Text fontSize={13} color="$tabIconDefault" lineHeight={19}>
                Si la otra persona ya creó el espacio, escribe su código. Solo funciona si
                aún no compartes tu espacio con nadie.
              </Text>
              <Form onSubmit={() => void handleJoin()}>
                <TextInput
                  value={code}
                  onChangeText={(value) => setCode(value.toUpperCase())}
                  placeholder="Ej. ABCDEFGH"
                  autoCapitalize="characters"
                  maxLength={8}
                  aria-label="Código de invitación para unirme"
                />
              </Form>
              <Button
                title="Unirme al espacio"
                loading={busy === 'join'}
                onPress={() => void handleJoin()}
              />
            </Card>
          </YStack>

          {error ? <FormError>{error}</FormError> : null}
          {notice ? (
            <YStack
              role="status"
              paddingVertical="$sm"
              paddingHorizontal="$md"
              borderRadius="$md"
              backgroundColor="$incomeLight"
              borderWidth={1}
              borderColor="$income">
              <Text fontSize={13} fontWeight="600" color="$income">
                {notice}
              </Text>
            </YStack>
          ) : null}

          {householdMembers.length > 1 ? (
            <YStack gap="$sm">
              <Text fontSize={16} fontWeight="800" color="$text">
                Salir del espacio
              </Text>
              <Card gap="$md">
                <Text fontSize={13} color="$tabIconDefault" lineHeight={19}>
                  Al salir dejarás de ver los datos compartidos. Tus movimientos se
                  quedan en el espacio compartido.
                </Text>
                <Button
                  title="Salir del espacio compartido"
                  variant="danger"
                  loading={busy === 'leave'}
                  onPress={() => void handleLeave()}
                />
              </Card>
            </YStack>
          ) : null}
        </>
      )}
    </YStack>
  )
}
