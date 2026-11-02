/** Metadatos públicos incluidos en una compilación concreta de la web. */
export interface BuildInfo {
  version: string
  id: string
  shortId: string
  builtAt: string
  environment: 'development' | 'preview' | 'production'
  commit: string | null
  dirty: boolean | null
}
