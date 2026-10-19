# 💰 Control de Gastos — Web

Versión **web** del control de gastos personal. Se conecta a la **misma base de datos Supabase** que la app móvil (`../cotrol-gastos`), con las **mismas tablas, políticas RLS y usuario**: registras algo en el móvil y aparece aquí, y al revés.

- **Stack:** React 19 + Vite 8 + TypeScript
- **Estilos:** [Tamagui](https://tamagui.dev) v2 usando el **mismo `tamagui.config.ts`** que la app móvil (tokens y temas idénticos)
- **Datos/Auth:** `@supabase/supabase-js` (cliente de navegador, sesión en `localStorage`)
- **Navegación:** `react-router-dom` (SPA)
- **Iconos:** `react-icons/io5` (Ionicons 5, misma familia que el móvil) · **Gráficas:** SVG propio (sin dependencias)
- **Tema:** solo modo oscuro

## Funcionalidades (paridad con la app móvil)

| Móvil | Web |
| --- | --- |
| Login / registro (email + contraseña) | `/login`, `/registro` |
| Dashboard: balance, ingresos/gastos, dona por categoría, presupuestos, recomendación de tarjeta con días de financiamiento | `/` (Resumen) + movimientos recientes |
| Movimientos: búsqueda, filtros (tipo, categorías, método de pago, pendientes), totales y agrupación colapsable por mes o por periodo de facturación (con una sola tarjeta de crédito filtrada) | `/movimientos` |
| Alta / edición de movimiento (comercio, concepto, monto, categoría, requiere desglose, fecha, nota) + recomendador de tarjeta | Modal «Nuevo movimiento» |
| Compras a Meses Sin Intereses: parcialidad mensual derivada, sin duplicar filas | Check «Comprar a meses sin intereses» en el alta |
| Compromisos recurrentes (servicios, renta, suscripciones) y saldos MSI | `/compromisos` (pestañas MSI / Recurrentes) |
| Proyección de MSI y servicios en la fecha límite de pago de cada tarjeta | Acordeón de «Periodos» en Movimientos |
| Detalle del movimiento (incluye ubicación con enlace a mapas) | `/movimientos/:id` |
| Desglose de ticket (ítems, sugerencias de compras pasadas, cierre rápido) | Modal «Desglosar ticket» |
| Presupuestos mensuales por categoría con progreso | `/presupuestos` |
| Ajustes: perfil y accesos | `/ajustes` |
| Categorías (CRUD propio) | `/ajustes/categorias` |
| Métodos de pago (CRUD propio) | `/ajustes/metodos-de-pago` |
| Selector de periodo (mes, rango, todo el historial) | Modal de periodo, compartido entre pantallas |

Diferencias propias de la web: layout con barra lateral (iconos en pantallas chicas), diálogos en lugar de pantallas modales, inputs de fecha nativos, geolocalización del navegador (best-effort, solo al crear) y refresco manual de datos.

## Cargos recurrentes y MSI

La regla es **una fila por compra/servicio, nunca una fila por mes futuro**. El calendario
se deriva en el cliente (`src/utils/installments.ts`, `src/utils/recurringCharges.ts` y
`src/utils/paymentPeriods.ts`).

| Concepto | Dónde vive | Cómo se proyecta |
| --- | --- | --- |
| Compra a MSI | `transactions` con `purchase_type = 'installments'`, `installments_count`, `installments_start_date`, `installments_paid`, `installments_settled_at` | Se reparte `amount` en parcialidades exactas (sin perder centavos). La primera cae en el corte que contiene la compra y las siguientes avanzan mes a mes. |
| Servicio/suscripción | Tabla `recurring_charges` (`amount`, `frequency`, `charge_day`, `start_date`, `end_date`, `active`) | Se generan ocurrencias mensuales/anuales. Con tarjeta de crédito se mapean al corte y fecha límite de pago; con débito/efectivo, al mes natural. |

Consecuencias en los totales:

- Una compra a MSI aporta **solo su primera parcialidad** al periodo de compra; el resto se
  inyecta en los periodos siguientes como «Cargos proyectados».
- En Resumen, Movimientos y Presupuestos los importes de detalle se escalan a la parcialidad
  del mes (`getEffectiveDetailAmount`), para no contar el total de la compra de golpe.
- `installments_paid` se calcula también por fecha de vencimiento: las parcialidades cuyo pago
  ya pasó se consideran cubiertas. «Liquidar» cierra el plan (`installments_settled_at`) y
  deja de proyectar el saldo; el pago real se registra como movimiento normal.
- Las proyecciones son informativas: **no crean movimientos** ni modifican el saldo.

### Agrupación por periodos de pago

Con una sola tarjeta de crédito filtrada, la vista «Periodos» cambia el significado del
selector de fechas: selecciona periodos por su **fecha límite de pago**, no por la fecha de
compra. Así cada grupo incluye el ciclo completo (aunque parte del ciclo caiga en el mes
anterior) y los totales no quedan incompletos.

- **Mes/rango:** muestra los periodos cuya fecha límite cae en el rango y todas las compras
  de su ciclo.
- **Todo el historial:** muestra todo el historial real y las parcialidades MSI completas
  (plazo finito). Los compromisos recurrentes se proyectan **solo 12 meses** desde el mes
  actual; no se inventan cargos recurrentes del pasado ni se proyectan servicios a 2031.
- Los filtros de categoría, búsqueda, tipo y pendientes también se aplican a las
  proyecciones.

Migración: `supabase/migrations/20261019163800_msi_recurring_charges.sql`. La web es la
fuente principal del esquema; el móvil consume la misma base de datos.

```bash
supabase db push        # aplica las migraciones al proyecto vinculado
```

> `npm run dev` usa el proyecto Supabase de `.env.development`; `npm run build` usa el de
> `.env.production`. Si un cambio no aparece en desarrollo, verifica contra qué proyecto
> está vinculada la CLI con `supabase migration list`.

## Sistema de diseño

La app es **dark-first** (Tamagui). La fuente de tokens es `src/tamagui.config.ts`; los
helpers web (alturas, sombras, tipografía y foco) viven en `src/constants/ui.ts`.

| Uso | Token | Valor (dark) |
| --- | --- | --- |
| Fondo | `$background` | `#191919` |
| Superficie | `$card` | `#222222` |
| Hover | `$surfaceHover` | `#2A2A2A` |
| Bordes | `$border` / `$borderStrong` | `#313131` / `#3D3D3D` |
| Texto | `$text` / `$textSecondary` | `#EDEDED` / `#A6A6A6` |
| Marca | `$primary` | `#7C83FF` |
| Positivo / Negativo | `$income` / `$expense` | `#8FBF84` / `#F08A8A` |
| Alerta | `$warning` | `#E8C468` |

- **Radios:** `xs 4` · `sm 6` · `md 8` · `lg 12` · `xl 16` · `full 999`
  (círculos y pills usan `full`).
- **Altura de controles:** `44px` (`CONTROL_HEIGHT`) para inputs, selects y botones.
- **Tipografía:** Inter con la jerarquía `TYPO` (`screenTitle`, `section`, `cardTitle`,
  `body`, `caption`, `micro`, `label`, `amount`).
- **Foco:** borde primario + halo (`focusRing`), sin el outline nativo del navegador.
- **Fechas:** `DateField` (escritura `DD/MM/AAAA` + calendario nativo) en todos los formularios.
- **Movimiento:** transiciones CSS suaves (`CSS_TRANSITION`) y animaciones de entrada de
  modales/popovers, respetando `prefers-reduced-motion`.

> `tamagui.config.ts`, `constants/theme.ts` y `components/ui/Card.tsx` son archivos
> compartidos con la app móvil: si cambias la paleta o los radios, replica el cambio allí.

## Requisitos

- Node.js 20.19+ (recomendado 22)
- Chrome para la prueba de humo (`npm run smoke`; también acepta `CHROME_BIN`)

## Puesta en marcha

```bash
npm install
npm run dev      # http://localhost:5173
```

### Variables de entorno

Las credenciales de Supabase se leen con el prefijo `VITE_` que exige Vite
(`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`). Se usa **un archivo por modo**, que Vite
carga automáticamente según el comando:

| Archivo | Cuándo se carga | Proyecto Supabase |
| --- | --- | --- |
| `.env.development` | `npm run dev` | Desarrollo |
| `.env.production` | `npm run build` / `npm run preview` | Producción |

Ninguno se versiona (`.gitignore`); usa `.env.example` como plantilla:

```bash
cp .env.example .env.development
cp .env.example .env.production
```

Los valores de desarrollo son las **mismas credenciales** que la app móvil, solo cambia el
prefijo. Para regenerar `.env.development` desde el proyecto móvil:

```bash
sed -e 's/^EXPO_PUBLIC_SUPABASE_URL=/VITE_SUPABASE_URL=/' \
    -e 's/^EXPO_PUBLIC_SUPABASE_KEY=/VITE_SUPABASE_ANON_KEY=/' \
    ../cotrol-gastos/.env > .env.development
```

> ⚠️ **Ojo al tocar `vite.config.ts`:** el plugin de Tamagui define `envPrefix: ['TAMAGUI_']`, lo que impide que las variables `VITE_*` lleguen al cliente. Por eso el config declara `envPrefix: ['VITE_']` explícitamente. Si algún día las variables aparecen como `undefined`, revisa esa línea.

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Typecheck (`tsc -b`) + build de producción en `dist/` |
| `npm run typecheck` | Solo typecheck |
| `npm run preview` | Sirve `dist/` para probar el build |
| `npm run smoke` | Prueba de humo en Chrome real: login, shell, las 4 pantallas, modales y layout móvil |
| `npm run lint` | oxlint |

`npm run smoke` necesita el dev server corriendo. Inyecta una **sesión simulada** en `localStorage` para poder verificar las pantallas privadas (las consultas a Supabase fallan a propósito: valida render y layout, no datos).

## Estructura

```
src/
  main.tsx                 # TamaguiProvider (tema dark) + fuente Inter
  App.tsx                  # Rutas + providers (Auth, Period, Filters, Data, Modals)
  tamagui.config.ts        # ⚠️ copia del de la app móvil (design system compartido)
  components/
    layout/AppShell.tsx    # sidebar + cabecera + contenido
    ui/                    # Card, Button, Field, Modal, Icon, CategoryIcon,
                           # SearchSelect (combobox con búsqueda), DateField,
                           # MonthSelector, DonutChart, ProgressBar
    modals/                # TransactionForm, Breakdown, Filters, PeriodPicker,
                           # RecurringChargeForm
  contexts/                # AuthContext, PeriodContext, FiltersContext, ModalsContext
  hooks/useData.tsx        # CRUD contra Supabase (categorías, métodos de pago,
                           # movimientos, desglose, presupuestos, compromisos)
  screens/                 # Login, Signup, Dashboard, Transactions, Detail,
                           # Commitments, Budgets, Settings + Categories/PaymentMethods
  utils/                   # supabase, format, location, paymentMethod, user,
                           # creditCardRecommendation (días de financiamiento),
                           # installments (MSI), recurringCharges, paymentPeriods
  constants/theme.ts       # paleta derivada de tamagui.config.ts
scripts/smoke.mjs          # prueba de humo con Chrome DevTools Protocol
wrangler.jsonc             # deploy Cloudflare + fallback SPA
supabase/
  migrations/              # fuente principal del esquema (MSI, recurrentes, RLS)
  config.toml              # configuración local de Supabase CLI
```

## Cambios compartidos con la app móvil

La web reutiliza ficheros del proyecto Expo **como copias** (proyectos independientes, sin monorepo). Si tocas uno en el móvil, replícalo aquí:

| Fichero | Notas |
| --- | --- |
| `src/tamagui.config.ts` | Copia literal. Es la fuente única del diseño (colores, spacing, radius, temas) |
| `src/types/index.ts` | Copia literal (tipos del modelo de datos) |
| `src/utils/format.ts`, `src/utils/paymentMethod.ts`, `src/utils/user.ts` | Copia literal |
| `src/constants/theme.ts` | Copia literal (deriva de `tamagui.config.ts`) |
| `src/contexts/PeriodContext.tsx`, `src/contexts/FiltersContext.tsx` | Copia literal |
| `src/contexts/AuthContext.tsx`, `src/hooks/useData.tsx` | Copia, con la única diferencia del cliente Supabase |
| `src/utils/supabase.ts` | **Reescrito**: navegador (localStorage) en lugar de AsyncStorage |
| `src/components/ui/{BorderedStack,Card,ProgressBar}.tsx` | Copiados (sin imports de React Native) |
| `src/components/ui/Icon.tsx` | Nuevo en web: traduce nombres de Ionicons de la BD a `react-icons` |

Si agregas un icono nuevo en los ajustes del móvil, añádelo también a `ICON_MAP` en `src/components/ui/Icon.tsx`.

## Despliegue

`npm run build` genera un sitio estático en `dist/` (Vite usa el modo `production`, por lo que
toma los valores de `.env.production` o, en su defecto, de las variables del host).

Al ser una SPA, el runtime debe servir `index.html` para cualquier ruta de navegación. Eso se
configura en `wrangler.jsonc`:

```jsonc
{
  "name": "bills",
  "compatibility_date": "2026-10-19",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  }
}
```

> No uses `public/_redirects` con `/* /index.html 200`: el runtime nuevo de Cloudflare lo
> detecta como bucle infinito (error `100324`). El fallback de SPA va en `wrangler.jsonc`.

### Cloudflare Workers / Pages (static assets)

| Ajuste | Valor |
| --- | --- |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Output directory | `dist` |
| Node version | 22 (ver `.nvmrc`) |

Las variables **no se suben al repo**: defínelas en **Settings → Environment variables** del
proyecto, por separado para cada entorno:

- **Production:** `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (o
  `VITE_SUPABASE_PUBLISHABLE_KEY`) del proyecto Supabase de producción.
- **Preview:** los valores del proyecto de desarrollo (o de una rama/staging).

Vite expone las variables `VITE_*` que llegan por `process.env` durante el build, así que las
del panel de Cloudflare tienen prioridad sobre cualquier `.env.production` local. Si cambias
una variable, vuelve a desplegar para que se regenere el bundle.

> Alternativa: los valores de `.env.production` se pueden subir como *variables de entorno* de
> Cloudflare sin usar el archivo. Nunca uses `wrangler`/CI con credenciales en texto plano en
> el repositorio.

## Limitaciones conocidas

- Solo modo oscuro (por decisión de diseño).
- El bundle ronda 1 MB (≈300 kB gzip); se puede dividir por rutas con `React.lazy` cuando haga falta.
- El aviso de consola `missing token color ... $color` viene de que el tema personalizado no define toda la paleta que Tamagui espera; es inofensivo y también aparece en el móvil.
