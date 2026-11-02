import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { BuildInfo } from '../src/types/buildInfo.ts'

interface GitInfo {
  commit: string | null
  dirty: boolean | null
}

interface BuildInfoOptions {
  version: string
  mode: string
  env?: Record<string, string | undefined>
  git?: GitInfo
  now?: Date
}

/** Cada build tiene identidad propia, aunque se compile el mismo commit. */
export function createBuildInfo({ version, mode, env = {}, git, now = new Date() }: BuildInfoOptions): BuildInfo {
  const environment = env.APP_ENV?.trim() || (mode === 'production' ? 'production' : mode === 'development' ? 'development' : 'preview')
  if (!['development', 'preview', 'production'].includes(environment)) {
    throw new Error('APP_ENV debe ser development, preview o production.')
  }
  if (!version.trim()) throw new Error('Configura la versión de la web en package.json.')

  const id = env.APP_BUILD_ID?.trim() || env.WORKERS_CI_BUILD_UUID?.trim() || randomUUID()
  const commit = [env.WORKERS_CI_COMMIT_SHA, env.CF_PAGES_COMMIT_SHA, env.GITHUB_SHA, git?.commit]
    .find((value) => value && /^[a-f0-9]{7,64}$/i.test(value)) ?? null

  // Se enumeran los campos públicos; nunca se serializa el entorno completo.
  return {
    version,
    id,
    shortId: createHash('sha256').update(id).digest('hex').slice(0, 8),
    builtAt: now.toISOString(),
    environment: environment as BuildInfo['environment'],
    commit,
    dirty: git?.dirty ?? null,
  }
}

/** Git puede faltar en una compilación empaquetada o en ciertos proveedores de CI. */
function readGitInfo(root: string): GitInfo {
  const run = (args: string[]) => execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 2000,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
  }).trim()
  try {
    const commit = run(['rev-parse', 'HEAD'])
    let dirty: boolean | null = null
    try { dirty = run(['status', '--porcelain', '--untracked-files=normal']).length > 0 } catch { /* No bloquea la compilación. */ }
    return { commit, dirty }
  } catch {
    return { commit: null, dirty: null }
  }
}

export function readBuildInfo(root: string, mode: string, env: Record<string, string | undefined>): BuildInfo {
  const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { version?: string }
  return createBuildInfo({ version: manifest.version ?? '', mode, env, git: readGitInfo(root) })
}
