/**
 * scripts/smoke.mjs — prueba de humo de la interfaz en un navegador real.
 *
 * Verifica, contra el dev server (`npm run dev`), que:
 *   • la pantalla de login renderiza y el login fallido muestra el error del servidor
 *   • el shell autenticado (sidebar, cabecera, usuario) se monta
 *   • Resumen, Movimientos, Presupuestos y Ajustes renderizan
 *   • se abren los modales (alta de movimiento, filtros, categoría, método de pago)
 *   • el layout no desborda horizontalmente en viewport de teléfono
 *
 * Para probar las pantallas privadas inyecta una SESIÓN SIMULADA en localStorage
 * (token falso): sirve para verificar render/layout, no los datos — las peticiones
 * a Supabase fallarán a propósito. Un login real (primer bloque) sí va contra
 * Supabase, con credenciales inválidas, para comprobar la red y la traducción de errores.
 *
 * Uso:
 *   npm run dev          # en otra terminal
 *   npm run smoke
 *
 * Requiere Chrome (CHROME_BIN si no está en la ruta por defecto de macOS).
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const BASE = process.env.BASE ?? 'http://localhost:5173'
const CDP_PORT = Number(process.env.CDP_PORT ?? 9333)
const CHROME_BIN =
  process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

// ── helpers ──────────────────────────────────────────────────────
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok: Boolean(ok) })
  console.log(`${ok ? '✅' : '❌'} ${name}${ok || !detail ? '' : ` → ${detail}`}`)
}

const projectRef = (() => {
  // El smoke test corre contra `npm run dev`, así que usa el env de desarrollo
  // (.env.development). Se mantiene .env como respaldo por compatibilidad.
  for (const file of ['../.env.development', '../.env']) {
    try {
      const env = readFileSync(new URL(file, import.meta.url), 'utf8')
      const url = env.match(/^VITE_SUPABASE_URL=(.+)$/m)?.[1]?.trim() ?? ''
      if (url) return new URL(url).hostname.split('.')[0]
    } catch {
      // sigue con el siguiente candidato
    }
  }
  return ''
})()

const b64url = (value) =>
  Buffer.from(JSON.stringify(value)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const now = Math.floor(Date.now() / 1000)
const userId = '11111111-2222-3333-4444-555555555555'
const fakeSession = {
  access_token: [
    b64url({ alg: 'HS256', typ: 'JWT' }),
    b64url({ sub: userId, aud: 'authenticated', role: 'authenticated', email: 'smoke@test.local', iat: now, exp: now + 3600 }),
    'c2lnbmF0dXJl',
  ].join('.'),
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: now + 3600,
  refresh_token: 'fake-refresh-token',
  user: {
    id: userId,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'smoke@test.local',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { full_name: 'Usuario de Prueba' },
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_anonymous: false,
  },
}

// ── arranque de Chrome con CDP ───────────────────────────────────
if (!existsSync(CHROME_BIN)) {
  console.error(`No se encontró Chrome en ${CHROME_BIN}. Define CHROME_BIN.`)
  process.exit(2)
}

try {
  const response = await fetch(`${BASE}/`)
  if (!response.ok) throw new Error(String(response.status))
} catch (error) {
  console.error(`El dev server no responde en ${BASE}. Ejecuta «npm run dev» primero. (${error.message})`)
  process.exit(2)
}

const profileDir = mkdtempSync(join(tmpdir(), 'cg-smoke-'))
const chrome = spawn(
  CHROME_BIN,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-first-run',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profileDir}`,
    'about:blank',
  ],
  { stdio: 'ignore' }
)

const cleanup = () => {
  chrome.kill('SIGKILL')
  // Chrome puede seguir escribiendo en el perfil; el borrado es best-effort
  try {
    rmSync(profileDir, { recursive: true, force: true })
  } catch {
    /* ignora ENOTEMPTY / EBUSY al cerrar */
  }
}

const waitForChrome = async () => {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const targets = await (await fetch(`http://localhost:${CDP_PORT}/json/list`)).json()
      const page = targets.find((target) => target.type === 'page')
      if (page) return page
    } catch {
      /* Chrome aún no escucha */
    }
    await sleep(250)
  }
  throw new Error('Chrome no expuso el puerto de depuración')
}

const page = await waitForChrome()
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  ws.onopen = resolve
  ws.onerror = reject
})

let nextId = 1
const pending = new Map()
const consoleMessages = []
const pageErrors = []

ws.onmessage = (event) => {
  const message = JSON.parse(event.data)
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) {
      reject(new Error(JSON.stringify(message.error)))
    } else {
      resolve(message.result)
    }
    return
  }
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    consoleMessages.push(message.params.args.map((arg) => arg.value ?? arg.description ?? '').join(' '))
  }
  if (message.method === 'Runtime.exceptionThrown') {
    pageErrors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text)
  }
}

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = nextId++
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })

const evaluate = async (expression) => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? 'eval error')
  return result.result.value
}

const waitFor = async (description, expression, timeoutMs = 20000) => {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      if (await evaluate(expression)) return true
    } catch {
      /* la página puede estar navegando */
    }
    await sleep(250)
  }
  throw new Error(`Timeout esperando: ${description}`)
}

const visibleText = () => evaluate('document.body.innerText')
const hasText = async (...needles) => {
  const body = (await evaluate('document.body.innerText')).toLowerCase()
  return needles.every((needle) => body.includes(needle.toLowerCase()))
}

/** Click real con eventos de ratón (Tamagui escucha eventos de puntero) */
const clickElement = async (finderExpression) => {
  const box = await evaluate(`(() => {
    const el = ${finderExpression}
    if (!el) return null
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null
    return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) }
  })()`)
  if (!box) return false
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y })
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 })
  await sleep(150)
  return true
}

const byAriaLabel = (label) =>
  `[...document.querySelectorAll('[aria-label]')].find((n) => n.getAttribute('aria-label') === ${JSON.stringify(label)})`

const escapeKey = () =>
  evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`)

try {
  await send('Runtime.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

  // ── 1. Login ───────────────────────────────────────────────────
  await send('Page.navigate', { url: `${BASE}/login` })
  await sleep(800)
  await evaluate('localStorage.clear()')
  await send('Page.navigate', { url: `${BASE}/login` })
  await waitFor('pantalla de login', `document.body.innerText.includes('Bienvenido de nuevo')`)

  const loginText = await visibleText()
  check('Login: título y enlaces', loginText.includes('Bienvenido de nuevo') && loginText.includes('Regístrate'))
  check(
    'Login: campos de acceso',
    await evaluate(`!!document.querySelector('input[placeholder="Correo electrónico"]') && !!document.querySelector('input[type="password"]')`)
  )
  check('Login: formulario nativo con submit', await evaluate(`!!document.querySelector('form button[type="submit"]')`))

  // Login real contra Supabase con credenciales inválidas
  await clickElement(`document.querySelector('input[placeholder="Correo electrónico"]')`)
  await send('Input.insertText', { text: 'smoke-test@example.com' })
  await clickElement(`document.querySelector('input[type="password"]')`)
  await send('Input.insertText', { text: 'contrasena-invalida-123' })
  await clickElement(byAriaLabel('Iniciar sesión'))
  const rejected = await waitFor(
    'error de credenciales',
    `document.body.innerText.includes('incorrectos') || document.body.innerText.includes('válido') || document.body.innerText.includes('Error')`
  )
    .then(() => true)
    .catch(() => false)
  check('Login: error del servidor mostrado', rejected)

  // ── 2. Sesión simulada + shell ─────────────────────────────────
  await evaluate(
    `localStorage.setItem(${JSON.stringify(`sb-${projectRef}-auth-token`)}, ${JSON.stringify(JSON.stringify(fakeSession))})`
  )
  await send('Page.navigate', { url: `${BASE}/` })
  await waitFor('shell autenticado', `document.body.innerText.includes('Balance del mes')`)

  const shellText = await visibleText()
  check('Shell: navegación y usuario', ['Resumen', 'Movimientos', 'Presupuestos', 'Ajustes', 'Usuario de Prueba'].every((t) => shellText.includes(t)))
  check('Resumen: balance, ingresos y gastos', await hasText('Balance del mes', 'Ingresos', 'Gastos', 'Gastos por categoría'))
  check(
    'Resumen: sidebar de escritorio',
    await evaluate(`(() => {
      const el = [...document.querySelectorAll('div')].find((n) => n.innerText?.trim().startsWith('Control de Gastos'))
      return !!el && el.getBoundingClientRect().width > 180
    })()`)
  )
  await waitFor(
    'botón nuevo movimiento listo',
    `[...document.querySelectorAll('[aria-label]')].some((el) => el.getAttribute('aria-label') === '+ Nuevo movimiento' && el.getAttribute('aria-disabled') !== 'true')`
  )

  // ── 3. Movimientos ─────────────────────────────────────────────
  check('Navegación: clic en Movimientos', await clickElement(byAriaLabel('Movimientos')))
  await waitFor('pantalla de movimientos', `!!document.querySelector('input[placeholder^="Buscar por comercio"]')`)
  check(
    'Movimientos: buscador y botón de filtros',
    await evaluate(`!!document.querySelector('input[placeholder^="Buscar por comercio"]') && !!document.querySelector('[aria-label="Filtros"]')`)
  )

  // ── 4. Modal de alta ───────────────────────────────────────────
  check('Modal alta: se abre', await clickElement(byAriaLabel('+ Nuevo movimiento')))
  await waitFor('modal de alta', `document.body.innerText.toLowerCase().includes('método de pago *')`)
  check('Modal alta: campos del formulario', await hasText('Gasto', 'Ingreso', 'Categoría', 'Comercio *', 'Concepto', 'Fecha', 'Nota (opcional)'))
  check('Modal alta: es un diálogo accesible', await evaluate(`!!document.querySelector('[role="dialog"]')`))
  check(
    'Modal alta: guardar deshabilitado sin datos',
    await evaluate(`[...document.querySelectorAll('[role="button"]')].some((el) => el.getAttribute('aria-label') === 'Agregar movimiento' && el.getAttribute('aria-disabled') === 'true')`)
  )

  // Combobox de categoría: popover con búsqueda, sin cerrar el modal
  check('Modal alta: abre el combobox de categoría', await clickElement(byAriaLabel('Categoría')))
  await waitFor('combobox abierto', `!!document.querySelector('[role="listbox"]')`)
  check(
    'Modal alta: el combobox no cierra el modal',
    await evaluate(`!!document.querySelector('[role="dialog"]') && !!document.querySelector('input[aria-label^="Buscar"]')`)
  )
  // Escape debe cerrar el combobox (no el modal)
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 })
  await sleep(400)
  check(
    'Modal alta: Escape cierra el combobox, no el modal',
    await evaluate(`!document.querySelector('[role="listbox"]') && !!document.querySelector('[role="dialog"]')`)
  )

  // Campo de fecha consistente: escribir en DD/MM/AAAA y sincronizar ISO
  await clickElement(`document.querySelector('input[aria-label="Fecha"]')`)
  await evaluate(`document.querySelector('input[aria-label="Fecha"]').select()`)
  await send('Input.insertText', { text: '25/12/2026' })
  await sleep(350)
  check(
    'Modal alta: fecha escrita en DD/MM/AAAA',
    await evaluate(`document.querySelector('input[aria-label="Fecha"]').value === '25/12/2026'`)
  )
  check(
    'Modal alta: fecha sincronizada a ISO',
    await evaluate(`document.querySelector('input[type="date"]').value === '2026-12-25'`)
  )
  check(
    'Modal alta: botón de calendario disponible',
    await evaluate(`!!document.querySelector('[aria-label="Abrir calendario de Fecha"]')`)
  )

  await escapeKey()
  await sleep(400)
  check('Modal alta: cierra con Escape', await evaluate(`!document.querySelector('[role="dialog"]')`))

  // ── 5. Filtros ─────────────────────────────────────────────────
  check('Filtros: se abre el panel', await clickElement(byAriaLabel('Filtros')))
  await waitFor('panel de filtros', `document.body.innerText.includes('Los cambios se aplican al instante')`)
  check('Filtros: opciones de tipo, estado, pago y categorías', await hasText('Tipo', 'Gastos', 'Ingresos', 'Estado', 'Método de pago', 'Categorías'))
  await escapeKey()
  await sleep(400)

  // ── 6. Presupuestos ────────────────────────────────────────────
  await send('Page.navigate', { url: `${BASE}/presupuestos` })
  await waitFor('pantalla de presupuestos', `document.body.innerText.includes('Presupuestado')`)
  check('Presupuestos: totales del mes', await hasText('Presupuestado', 'Gastado'))

  // ── 7. Ajustes ─────────────────────────────────────────────────
  await send('Page.navigate', { url: `${BASE}/ajustes` })
  await waitFor('pantalla de ajustes', `document.body.innerText.includes('Configuración')`)
  check('Ajustes: perfil y accesos a secciones', await hasText('smoke@test.local', 'Cerrar sesión', 'Categorías', 'Métodos de pago'))

  // Métodos de pago (página propia)
  check('Ajustes: navega a Métodos de pago', await clickElement(byAriaLabel('Métodos de pago')))
  await waitFor('pantalla de métodos de pago', `document.body.innerText.includes('Agregar')`)
  check('Métodos de pago: abre modal', await clickElement(byAriaLabel('Agregar método de pago')))
  await waitFor('modal de método de pago', `document.body.innerText.toLowerCase().includes('día de corte') || document.body.innerText.toLowerCase().includes('nombre')`)
  check('Modal pago: tipos y nombre', await hasText('Nombre', 'Efectivo', 'Débito', 'Crédito'))
  await escapeKey()
  await sleep(400)

  // Categorías (página propia)
  await send('Page.navigate', { url: `${BASE}/ajustes/categorias` })
  await waitFor('pantalla de categorías', `document.body.innerText.includes('Categorías de gastos')`)
  check('Categorías: secciones de gastos e ingresos', await hasText('Categorías de gastos', 'Categorías de ingresos'))
  check('Categorías: abre modal', await clickElement(byAriaLabel('Agregar categoría de gastos')))
  await waitFor('modal de categoría', `document.body.innerText.toLowerCase().includes('ícono')`)
  check('Modal categoría: nombre, color, ícono y desglose', await hasText('Nombre', 'Color', 'Ícono', 'Requiere desglose'))
  await escapeKey()
  await sleep(400)

  // ── 8. Compromisos (MSI + recurrentes) ─────────────────────────
  await send('Page.navigate', { url: `${BASE}/compromisos` })
  await waitFor(
    'pantalla de compromisos',
    `document.body.innerText.toLowerCase().includes('deuda msi pendiente')`
  )
  check(
    'Compromisos: resumen y pestañas',
    await hasText(
      'Deuda MSI pendiente',
      'Compromisos al mes',
      'Próximo pago',
      'MSI',
      'Recurrentes'
    )
  )
  check(
    'Compromisos: abre modal de compromiso recurrente',
    await clickElement(byAriaLabel('Agregar compromiso'))
  )
  await waitFor(
    'modal de compromiso',
    `document.body.innerText.toLowerCase().includes('día de cobro')`
  )
  check(
    'Compromisos: campos del compromiso',
    await hasText('Nombre *', 'Monto estimado *', 'Frecuencia', 'Inicio *', 'Compromiso activo')
  )
  await escapeKey()
  await sleep(400)
  check('Compromisos: cierra con Escape', await evaluate(`!document.querySelector('[role="dialog"]')`))

  // ── 9. Detalle inexistente ─────────────────────────────────────
  await send('Page.navigate', { url: `${BASE}/movimientos/${userId}` })
  await waitFor('detalle no encontrado', `document.body.innerText.includes('Movimiento no encontrado')`)
  check('Detalle: mensaje cuando el id no existe', true)

  // ── 9. Layout móvil ────────────────────────────────────────────
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
  for (const path of ['/', '/movimientos', '/compromisos', '/presupuestos', '/ajustes']) {
    await send('Page.navigate', { url: `${BASE}${path}` })
    await sleep(1800)
    check(`Mobile: sin desbordes en ${path}`, await evaluate('document.documentElement.scrollWidth <= 391'))
  }
  check(
    'Mobile: navegación de iconos visible',
    await evaluate(`['Resumen', 'Movimientos', 'Compromisos', 'Presupuestos', 'Ajustes'].every((label) => {
      const el = [...document.querySelectorAll('[aria-label]')].find((n) => n.getAttribute('aria-label') === label)
      return !!el && el.getBoundingClientRect().height > 20
    })`)
  )

  // ── 9b. Regresión: modal en viewport bajo ──────────────────────
  // El cuerpo del modal debe caber en el panel (si el contenido se sale, los
  // clics —p. ej. al elegir un método de pago— caen en el backdrop y lo cierran).
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 600, deviceScaleFactor: 2, mobile: true })
  await send('Page.navigate', { url: `${BASE}/movimientos` })
  await waitFor('pantalla de movimientos', `!!document.querySelector('input[placeholder^="Buscar por comercio"]')`)
  await waitFor(
    'botón de alta habilitado',
    `(() => {
      const el = [...document.querySelectorAll('[aria-label]')].find((n) => n.getAttribute('aria-label') === '+ Nuevo movimiento')
      return !!el && el.getAttribute('aria-disabled') !== 'true'
    })()`
  )
  await clickElement(byAriaLabel('+ Nuevo movimiento'))
  await waitFor('modal de alta', `!!document.querySelector('[role="dialog"]')`)
  check(
    'Modal: cabe en viewport bajo y el panel recibe los clics',
    await evaluate(`(() => {
      const dialog = document.querySelector('[role="dialog"]')
      if (!dialog) return false
      const d = dialog.getBoundingClientRect()
      const fits = d.top >= -1 && d.bottom <= window.innerHeight + 1
      const el = document.elementFromPoint(d.left + d.width / 2, d.top + d.height / 2)
      return fits && !!el && dialog.contains(el)
    })()`)
  )
  await escapeKey()
  await sleep(300)

  // ── 10. Consola sin errores propios ────────────────────────────
  // Ignorables: fallos de red esperados por la sesión simulada, el aviso de
  // tokens ausentes del tema custom y mensajes internos de Chrome.
  const ignorables =
    /401|400|Failed to load resource|missing token color|DevTools|Password field|network|No suitable key|creando (categorías|métodos de pago) por defecto/i
  const realErrors = [...consoleMessages, ...pageErrors].filter((message) => !ignorables.test(message))
  check('Consola sin errores propios', realErrors.length === 0, realErrors.slice(0, 3).join(' | '))
} catch (error) {
  console.error('ERROR EN EL SMOKE:', error)
  console.error('CONSOLA:', consoleMessages.slice(0, 8))
  console.error('PAGE ERRORS:', pageErrors.slice(0, 8))
  results.push({ name: 'Error inesperado', ok: false })
} finally {
  const failed = results.filter((result) => !result.ok)
  console.log(`\n${results.length - failed.length}/${results.length} comprobaciones OK`)
  ws.close()
  cleanup()
  process.exit(failed.length === 0 ? 0 : 1)
}
