import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { createBuildInfo, readBuildInfo } from './build-info.ts'

const commit = 'a'.repeat(40)
const now = new Date('2026-11-02T15:30:00.000Z')

describe('identidad de las compilaciones web', () => {
  it('distingue dos builds locales del mismo código y del mismo instante', () => {
    const options = { version: '1.2.0', mode: 'production', git: { commit, dirty: true }, now }
    const first = createBuildInfo(options)
    const second = createBuildInfo(options)

    expect(first.id).not.toBe(second.id)
    expect(first.commit).toBe(second.commit)
    expect(first.builtAt).toBe(second.builtAt)
    expect(first.dirty).toBe(true)
  })

  it('identifica una entrega de Cloudflare sin depender de una copia de Git', () => {
    const info = createBuildInfo({
      version: '1.2.0', mode: 'production', now,
      env: { WORKERS_CI_BUILD_UUID: 'entrega-cloudflare-42', WORKERS_CI_COMMIT_SHA: commit },
    })
    expect(info.id).toBe('entrega-cloudflare-42')
    expect(info.shortId).toMatch(/^[a-f0-9]{8}$/)
    expect(info.commit).toBe(commit)
    expect(info.dirty).toBeNull()
    expect(info.builtAt).toBe(now.toISOString())
  })

  it('permite etiquetar vistas previas y fijar el ID desde otro proveedor de CI', () => {
    const info = createBuildInfo({
      version: '1.2.0', mode: 'production',
      env: { APP_ENV: 'preview', APP_BUILD_ID: 'entrega-externa', WORKERS_CI_BUILD_UUID: 'otro-id', CF_PAGES_COMMIT_SHA: commit },
    })
    expect(info.environment).toBe('preview')
    expect(info.id).toBe('entrega-externa')
    expect(info.commit).toBe(commit)
  })

  it('no incluye credenciales ni otras variables de entorno en los metadatos públicos', () => {
    const info = createBuildInfo({
      version: '1.2.0', mode: 'development',
      env: { SUPABASE_SERVICE_ROLE_KEY: 'secreto-de-prueba', CLOUD_API_TOKEN: 'token-de-prueba' },
    })
    expect(info.environment).toBe('development')
    expect(Object.keys(info).sort()).toEqual(['version', 'id', 'shortId', 'builtAt', 'environment', 'commit', 'dirty'].sort())
    expect(JSON.stringify(info)).not.toMatch(/secreto-de-prueba|token-de-prueba|SUPABASE|CLOUD_API/)
  })

  it('no presenta un texto arbitrario del entorno como commit de la entrega', () => {
    const info = createBuildInfo({
      version: '1.2.0', mode: 'production',
      env: { WORKERS_CI_COMMIT_SHA: 'sin-commit' },
      git: { commit, dirty: false },
    })
    expect(info.commit).toBe(commit)
  })

  it('lee la versión de package.json y compila aunque no haya repositorio Git', () => {
    const root = mkdtempSync(join(tmpdir(), 'gastos-build-info-'))
    try {
      writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '2.3.4' }))
      const info = readBuildInfo(root, 'production', {})
      expect(info.version).toBe('2.3.4')
      expect(info.commit).toBeNull()
      expect(info.dirty).toBeNull()
      expect(info.id).toBeTruthy()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rechaza entornos ambiguos para no mostrar una etiqueta incorrecta', () => {
    expect(() => createBuildInfo({ version: '1.2.0', mode: 'production', env: { APP_ENV: 'prodution' } })).toThrow('APP_ENV')
  })
})
