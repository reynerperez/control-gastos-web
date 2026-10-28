import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Text, XStack, YStack } from 'tamagui'

import { TransactionDetailBody } from '@/components/transaction/TransactionDetailBody'
import { TransactionEditActions } from '@/components/transaction/TransactionEditActions'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { IconButton } from '@/components/ui/CategoryIcon'
import { AppIcon } from '@/components/ui/Icon'
import { SidePeek } from '@/components/ui/SidePeek'
import { palette } from '@/constants/theme'
import { useData } from '@/hooks/useData'
import { useTransactionEdit } from '@/hooks/useTransactionEdit'

type Props = {
  transactionId: string
  /** `page` = ruta completa; `peek` = panel lateral sobre la pantalla actual */
  variant: 'page' | 'peek'
  onClose?: () => void
  /** Controla la animación del peek; la página siempre está abierta. */
  open?: boolean
}

/**
 * Detalle de un movimiento, compartido por la página completa
 * (`/movimientos/:id`) y por el side peek de la misma pestaña.
 *
 * El estado de edición vive aquí para que el candado del header del peek y la
 * barra Guardar/Descartar usen el mismo borrador.
 */
export function TransactionDetailContent({
  transactionId,
  variant,
  onClose,
  open = true,
}: Props) {
  const navigate = useNavigate()
  const isPeek = variant === 'peek'
  const { transactions, deleteTransaction } = useData()
  const transaction = transactions.find((item) => item.id === transactionId)
  const edit = useTransactionEdit(transaction)
  const cancelEdit = edit.cancel

  // Al terminar la animación de cierre el peek sigue montado (para no
  // desmontarlo a mitad del slide), así que aquí se vuelve a bloquear.
  useEffect(() => {
    if (!open) cancelEdit()
  }, [open, cancelEdit])

  const close = () => {
    if (isPeek) onClose?.()
    else navigate('/movimientos')
  }

  const discardAndClose = () => {
    if (edit.saving) return
    if (edit.unlocked && edit.dirty) {
      if (!window.confirm('¿Descartar los cambios sin guardar?')) return
      edit.cancel()
    }
    close()
  }

  const toggleLock = () => {
    if (edit.saving) return

    if (!edit.unlocked) {
      edit.unlock()
      return
    }

    if (edit.dirty) {
      if (!window.confirm('¿Descartar los cambios sin guardar?')) return
      edit.cancel()
      return
    }

    edit.cancel()
  }

  const onDelete = async () => {
    if (!transaction || edit.saving) return
    if (
      !window.confirm(
        '¿Eliminar este movimiento? Esta acción no se puede deshacer.'
      )
    ) {
      return
    }
    await deleteTransaction(transaction.id)
    close()
  }

  const openInNewTab = () => {
    window.open(
      `${window.location.origin}/movimientos/${transactionId}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  if (!transaction) {
    const missing = (
      <Card>
        <YStack alignItems="center" gap="$md" padding="$xl">
          <AppIcon name="alert-circle-outline" size={44} color={palette.muted} />
          <Text color="$tabIconDefault" textAlign="center">
            Movimiento no encontrado. Puede que ya se haya eliminado.
          </Text>
          <Button
            title={isPeek ? 'Cerrar' : 'Volver a Movimientos'}
            onPress={close}
          />
        </YStack>
      </Card>
    )

    if (isPeek) {
      return (
        <SidePeek
          open={open}
          onClose={close}
          title="Detalle del movimiento">
          {missing}
        </SidePeek>
      )
    }

    return missing
  }

  const lockButton = (
    <IconButton
      icon={edit.unlocked ? 'lock-open' : 'lock-closed'}
      color={edit.unlocked ? palette.primary : '$text'}
      onPress={toggleLock}
      ariaLabel={edit.unlocked ? 'Bloquear edición' : 'Desbloquear edición'}
    />
  )

  const deleteButton = (
    <IconButton
      icon="trash-outline"
      danger
      onPress={() => void onDelete()}
      ariaLabel="Eliminar movimiento"
    />
  )

  if (isPeek) {
    return (
      <SidePeek
        open={open}
        onClose={discardAndClose}
        onEscape={() => {
          if (edit.saving) return
          if (edit.unlocked) {
            if (edit.dirty) {
              if (!window.confirm('¿Descartar los cambios sin guardar?')) return
            }
            edit.cancel()
            return
          }
          discardAndClose()
        }}
        title="Detalle del movimiento"
        headerActions={
          <>
            {lockButton}
            <IconButton
              icon="open-outline"
              onPress={openInNewTab}
              ariaLabel="Abrir en otra pestaña"
            />
            {deleteButton}
          </>
        }
        footer={
          edit.unlocked ? <TransactionEditActions edit={edit} /> : undefined
        }>
        <TransactionDetailBody transaction={transaction} edit={edit} />
      </SidePeek>
    )
  }

  return (
    <YStack gap="$lg">
      <XStack alignItems="center" justifyContent="space-between" gap="$md">
        <Button
          title="← Volver"
          variant="secondary"
          size="sm"
          onPress={discardAndClose}
        />
        <XStack gap="$xs">
          {lockButton}
          {deleteButton}
        </XStack>
      </XStack>

      <TransactionDetailBody transaction={transaction} edit={edit} />

      {edit.unlocked ? (
        <YStack
          position="sticky"
          bottom={0}
          zIndex={10}
          paddingTop="$sm"
          backgroundColor="$background">
          <TransactionEditActions edit={edit} />
        </YStack>
      ) : null}
    </YStack>
  )
}
