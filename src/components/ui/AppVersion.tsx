import { Text, XStack, YStack } from 'tamagui'

import { Card } from '@/components/ui/Card'
import { APP_VERSION_LABEL, BUILD_ENVIRONMENT_LABEL, BUILD_INFO } from '@/constants/buildInfo'
import { TYPO } from '@/constants/ui'

/** Todas las etiquetas de versión usan la identidad de la misma compilación. */
export function AppVersion({ detailed = false }: { detailed?: boolean }) {
  const description = `Versión ${BUILD_INFO.version}, compilación ${BUILD_INFO.shortId}, ${BUILD_ENVIRONMENT_LABEL}`
  if (!detailed) {
    return (
      <Text
        {...TYPO.caption}
        color="$tabIconDefault"
        aria-label={description}
        data-app-version={APP_VERSION_LABEL}>
        {APP_VERSION_LABEL}
      </Text>
    )
  }

  const generatedAt = new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(BUILD_INFO.builtAt))
  const rows = [
    { label: 'Versión', value: `v${BUILD_INFO.version}` },
    { label: 'Compilación', value: BUILD_INFO.shortId },
    { label: 'Generada', value: generatedAt },
    { label: 'Entorno', value: BUILD_ENVIRONMENT_LABEL },
    { label: 'Commit', value: BUILD_INFO.commit ? `${BUILD_INFO.commit.slice(0, 7)}${BUILD_INFO.dirty ? ' · con cambios locales' : ''}` : 'No disponible' },
  ]

  return (
    <Card gap="$md" role="region" aria-label="Información de la versión">
      <XStack gap="$sm" justifyContent="space-between" alignItems="baseline" flexWrap="wrap">
        <Text {...TYPO.cardTitle} color="$text">Acerca de la app</Text>
        <AppVersion />
      </XStack>
      <YStack gap="$sm">
        {rows.map(({ label, value }) => (
          <XStack key={label} gap="$md" justifyContent="space-between" alignItems="baseline" flexWrap="wrap">
            <Text {...TYPO.caption} color="$textSecondary">{label}</Text>
            <Text {...TYPO.caption} color="$text" style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</Text>
          </XStack>
        ))}
      </YStack>
    </Card>
  )
}
