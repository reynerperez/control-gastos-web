import type { BuildInfo } from '@/types/buildInfo'

// El valor pertenece al JS cargado: no cambia si se publica otra entrega.
export const BUILD_INFO: Readonly<BuildInfo> = Object.freeze(__APP_BUILD_INFO__)

export const APP_VERSION_LABEL = `v${BUILD_INFO.version} · ${BUILD_INFO.shortId}`

export const BUILD_ENVIRONMENT_LABEL = {
  development: 'Desarrollo',
  preview: 'Vista previa',
  production: 'Producción',
}[BUILD_INFO.environment]
