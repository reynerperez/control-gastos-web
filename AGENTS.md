# control-gastos-web — notas para agentes

App web (React + Vite + Tamagui) del proyecto **Control de Gastos**. Comparte base de
datos, tablas, RLS y **design system** con la app móvil Expo que vive en `../cotrol-gastos`.

## Antes de tocar código

1. **Design system:** los tokens y temas están en `src/tamagui.config.ts`, una copia literal
   del de la app móvil. No inventes colores ni spacing: usa los tokens (`$primary`, `$card`,
   `$text`, `$space.md`, `$radius.lg`, …) o `palette` de `src/constants/theme.ts`.
   Si el cambio también aplica al móvil, hazlo en `../cotrol-gastos/tamagui.config.ts` y
   copia el archivo aquí (ambos deben quedar idénticos).
2. **Documentación de Tamagui v2:** consulta https://tamagui.dev/docs antes de introducir
   componentes nuevos. La app usa la versión **2.7.7** (igual que el móvil), no la 3.x.
3. **Capa de datos:** todo el CRUD vive en `src/hooks/useData.tsx` y se consume con `useData()`.
   No escribas consultas a Supabase dentro de componentes. El esquema (tablas, columnas,
   políticas) es el mismo del móvil y **las migraciones viven en este repo**
   (`supabase/migrations/`): la web es la fuente principal. No agregues migraciones nuevas
   en `../cotrol-gastos`.
4. **Fechas de pago:** usa `src/utils/bankingDates.ts` con el calendario de
   `HolidaysContext`. No existe `payment_methods.due_day`; la fecha se calcula con
   `grace_days` + `grace_days_type` (`natural`/`business`) y el calendario CNBV.
5. **Código compartido:** los ficheros listados en el README («Cambios compartidos con la app
   móvil») se copian a mano. Si modificas uno aquí, replica el cambio allí cuando aplique,
   y viceversa. No agregues imports de React Native (`react-native`, `expo-*`) a esos ficheros:
   romperían la copia.
6. **Idioma:** la interfaz, los comentarios y los mensajes de error van en español.

## Convenciones de UI web

- Componentes base: `src/components/ui/` (Card, Button, Field, Modal, Icon, CategoryIcon…).
  Prefiere reutilizarlos antes de crear nuevos.
- `Modal` es propio (overlay + Escape + bloqueo de scroll); los flujos que en el móvil son
  rutas se abren aquí desde `useModals()` (`components/modals/`).
- Espaciado: usa `gap` en `XStack`/`YStack` en lugar de márgenes sueltos. `SectionLabel`
  ya aplica uppercase.
- Accesibilidad: los elementos clicables que no son botones llevan `role` y `aria-label`
  (la prueba de humo los usa como selectores).
- Iconos: **nunca** uses nombres de Ionicons directamente en un componente web; pasa el nombre
  por `AppIcon` / `ICON_MAP` (`src/components/ui/Icon.tsx`).

## Verificación obligatoria

```bash
npm run typecheck      # tsc -b (incluye noUnusedLocals)
npm run build          # typecheck + build de producción
npm run dev &          # requerido por el smoke test
npm run smoke          # navegador real: login, pantallas, modales, layout móvil
```

`npm run smoke` arranca Chrome headless con un perfil temporal e inyecta una sesión simulada
(token falso) para poder renderizar las pantallas privadas: verifica render/layout/navegación,
**no** el flujo de datos real (esas peticiones fallan a propósito contra Supabase).

Config relevante en `vite.config.ts`: el plugin de Tamagui sobreescribe `envPrefix`, por eso
el config declara `envPrefix: ['VITE_']`. No lo quites o las variables de entorno dejan de
llegar al cliente.
