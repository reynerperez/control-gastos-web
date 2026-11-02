# Recomendación de tarjeta de crédito

Documentación del cálculo que la app usa para recomendar la tarjeta de crédito
con más días de financiamiento sin intereses.

## Objetivo

Dado el día actual y las tarjetas de crédito configuradas, elegir la tarjeta
cuya fecha límite de pago queda más lejos. La recomendación aparece en el
Resumen y en el formulario de movimientos (punto morado «Recomendado» y
preselección automática).

## Regla principal

**La recomendación siempre se calcula para HOY.** No se recalcula con la fecha
de la compra ni con la fecha de un movimiento que se está editando. Cambiar la
fecha en el formulario no modifica la tarjeta recomendada.

## Datos de entrada

### Tarjetas (`payment_methods`)

Solo se consideran métodos con `type = 'credit'` y configuración completa.
Las departamentales (`type = 'departmental'`), como Liverpool, se excluyen de
los planes, la preselección y todos los rangos del calendario. Conservan su
corte, fecha de pago y compras a MSI para el registro de gastos.

Configuración de las tarjetas elegibles:

| Campo | Uso |
| --- | --- |
| `closing_day` | Día del mes en que corta la tarjeta (1–31). |
| `due_day` | Día fijo de pago (1–31). Si existe, sustituye a los días de gracia. |
| `grace_days` | Días de gracia desde el corte hasta el pago (0–60). |
| `grace_days_type` | `natural` o `business`; define cómo se cuentan los días de gracia. |

Una tarjeta entra en la recomendación si tiene `closing_day` y una fecha de
pago configurada: **`due_day`** o **`grace_days` + `grace_days_type`**. Las
tarjetas a las que les falta esa configuración siguen disponibles en el
selector de métodos de pago para usarlas manualmente, pero no reciben el punto
de recomendada ni se auto-seleccionan.

### Festivos

Se usa el calendario bancario CNBV cargado desde la tabla `holidays` para
`country_code = 'MX'`. El conjunto contiene fechas en formato `YYYY-MM-DD` y se
consulta en O(1).

Si el calendario no se pudo cargar, el cálculo continúa solo con fines de
semana. En ese caso la fecha real podría ser posterior a la calculada.

## Algoritmo

Para cada tarjeta elegible:

### 1. Fecha de referencia

Se toma el día actual y se normaliza a medianoche local:

```ts
const reference = startOfDay(new Date())
```

Así se evitan diferencias por hora, zona horaria o cambios de horario de
verano.

### 2. Próximo corte

Sea `day` el día del mes de la referencia y `closingDay` el día de corte:

1. Se calcula el corte de este mes, ajustando `closingDay` al último día del
   mes si no existe (por ejemplo, 31 en febrero).
2. Si `day >` el día del corte ajustado, el próximo corte es el del mes
   siguiente, también ajustado.
3. Si `day <=` el día del corte ajustado, el corte es el de este mes.

El corte **no se mueve** si cae en fin de semana o festivo. Solo se ajusta la
fecha límite de pago.

### 3. Fecha teórica de pago

A partir de la fecha de corte:

- **Día fijo** (`due_day` definido): la fecha teórica es el primer día
  `due_day` **estrictamente posterior** al corte. Si el día no existe en el
  mes, se usa el último día del mes. Si coincide con el corte, se avanza al
  mes siguiente.
- **Días naturales** (`grace_days_type = 'natural'`):
  `fechaTeórica = corte + grace_days`.
- **Días hábiles** (`grace_days_type = 'business'`):
  se avanza día a día desde el corte, contando solo días hábiles (lunes a
  viernes que no sean festivos), hasta completar `grace_days`.
  El día del corte no cuenta; el primer día hábil siguiente es el día 1.

#### Día fijo: ejemplos

| Corte | Pago fijo | Compra | Próximo corte | Vence |
| ---: | ---: | --- | --- | --- |
| 9 | 9 | 10 oct 2026 | 9 nov 2026 | 9 dic 2026 |
| 20 | 10 | 21 oct 2026 | 20 nov 2026 | 10 dic 2026 |
| 5 | 20 | 6 nov 2026 | 5 dic 2026 | 20 dic 2026 |
| 31 | 31 | 10 feb 2026 | 28 feb 2026 | 31 mar 2026 |

Con corte 9 y pago 9, el pago queda un mes después del corte, que es el
periodo sin intereses habitual de esas tarjetas.

### 4. Ajuste a día hábil

**Solo en modo de días de gracia.** Si la fecha teórica cae en sábado, domingo
o festivo, se avanza al siguiente día hábil:

```ts
dueDate = nextBusinessDay(rawDueDate, holidays)
```

Se registra `adjusted = true` cuando la fecha efectiva es distinta de la
teórica.

En modo de **día fijo** la fecha es exacta: **no se recorre** aunque caiga en
fin de semana o festivo. `dueDate = rawDueDate` y `adjusted = false`.

### 5. Días de financiamiento

```ts
financingDays = daysBetween(reference, dueDate)
```

Es la diferencia en días entre hoy y la fecha efectiva de pago. No se cuenta
el día de la compra de forma adicional.

### 6. Orden y desempate

Las tarjetas se ordenan con estos criterios, en orden:

1. `financingDays` descendente (más días primero).
2. `graceDays` descendente (a igual fecha de pago, gana la que tiene más
   gracia). En modo de día fijo, `graceDays` es la diferencia efectiva entre el
   corte y el pago.
3. `dueDate` ascendente.
4. `closingDate` ascendente.
5. Nombre de la tarjeta ascendente, para que el resultado sea determinista.

La primera tarjeta del listado es la recomendada. `getBestCreditCard` devuelve
ese primer plan o `null` si no hay tarjetas elegibles.

## Calendario de recomendaciones

Además de la recomendación de hoy, el motor calcula un calendario de 12 meses
(365 días) con los tramos en los que cada conjunto de tarjetas ofrece el mayor
financiamiento. El Resumen prioriza la tarjeta de hoy, hasta cuándo conviene y la fecha de
pago al comprar hoy. «Después» anticipa la siguiente recomendación; «Ver rangos
por tarjeta» despliega las próximas fechas de uso sin recargar la vista inicial.

- Para cada día se calculan los días de financiamiento de todas las tarjetas
  elegibles y se quedan las que empatan en el máximo.
- Los días consecutivos con el mismo conjunto de ganadoras se agrupan en un
  tramo (`RecommendationInterval`).
- El tramo **no** se corta cuando cambia el corte de la propia tarjeta; solo
  cuando cambia el conjunto de ganadoras.
- `startDate` y `endDate` son inclusivos. `maxFinancingDays` corresponde al
  primer día del tramo y `minFinancingDays` al último.
- `getTodayRecommendation` devuelve el tramo vigente y
  `getUpcomingIntervals` los siguientes tramos de una tarjeta.

En la web, `cardUsageRanges.ts` adapta estos tramos para mostrar **un rango
continuo por tarjeta** en la lista del dashboard. Si una tarjeta sigue ganando cuando cambia
el conjunto de empatadas, su rango no se corta. Para las recomendadas hoy se
busca el inicio hasta 366 días hacia atrás, con la configuración actual y el
calendario de festivos disponible; no es un historial de configuraciones antiguas.
El resumen conserva el plan calculado desde hoy para la fecha de pago y los días
de financiamiento. Si un límite no aparece dentro del horizonte consultado, no
se muestra la fecha de ese borde como si fuera el inicio o el fin real.

Como el día de corte es inclusivo (una compra en el día de corte pertenece a
ese ciclo), el mejor día para comprar suele ser **el siguiente al corte**.

Ejemplo con 6 tarjetas de crédito (Liverpool es departamental y queda excluida), hoy 30 de octubre de 2026 y sin festivos
cargados:

| Del | Al | Tarjeta(s) |
| --- | --- | --- |
| 30 oct 2026 | 2 nov 2026 | Nu Pao · Rappi Pao |
| 3 nov 2026 | 11 nov 2026 | Banamex Pao · BBVA Pao |
| 12 nov 2026 | 15 nov 2026 | BBVA Reny |
| 16 nov 2026 | 26 nov 2026 | Rappi Pao |
| 27 nov 2026 | 2 dic 2026 | Nu Pao |
| 3 dic 2026 | 11 dic 2026 | Banamex Pao · BBVA Pao |

El patrón se repite cada mes con variaciones por la duración del mes y por los
ajustes a día hábil.

## Ejemplo

Tarjeta Nu con corte el día 18 y 10 días de gracia naturales. Hoy es
**19 de octubre de 2026**:

| Paso | Resultado |
| --- | --- |
| Referencia | 19 oct 2026 |
| Próximo corte | 18 nov 2026 (la compra ya pasó el corte de octubre) |
| Fecha teórica | 28 nov 2026 (18 nov + 10 días) |
| Ajuste | 28 nov es sábado → 30 nov 2026 |
| Financiamiento | 42 días |

## Ejemplo de desempate

Hoy es 19 de octubre de 2026:

| Tarjeta | Corte | Gracia | Corte usado | Pago teórico | Pago efectivo | Días |
| --- | --- | --- | --- | --- | --- | --- |
| A | 10 | 20 | 10 nov | 30 nov | 30 nov | 42 |
| B | 15 | 15 | 15 nov | 30 nov | 30 nov | 42 |

Ambas pagan el mismo día. Gana **A** porque tiene más días de gracia, según el
criterio de desempate.

## Casos límite contemplados

- **Meses de 28, 29, 30 y 31 días:** el corte se ajusta al último día del mes.
  En año bisiesto, febrero termina el 29.
- **Corte en fin de semana:** el corte se queda en esa fecha; no se recorre.
- **Pago con gracia en sábado o domingo:** se mueve al lunes siguiente.
- **Pago con gracia en festivo:** se mueve al siguiente día hábil.
- **Festivo seguido de fin de semana:** se siguen saltando días hasta encontrar
  uno hábil.
- **Días de gracia hábiles:** se saltan fines de semana y festivos al contar.
- **Pago fijo en fin de semana o festivo:** se queda en la fecha exacta; no se
  recorre.
- **Tarjetas sin configuración completa:** se excluyen de la recomendación.

## Limitaciones conocidas

- **La recomendación de hoy no es histórica.** El calendario proyecta 12 meses
  hacia adelante, pero no recalcula meses pasados ni usa la fecha seleccionada
  en un movimiento.
- **El día fijo se repite cada mes.** No admite fechas únicas ni promociones
  con vencimiento especial.
- **No considera límite de crédito, saldo disponible ni promociones.**
- **No calcula el beneficio total de una compra a MSI.** Para MSI se sigue
  usando la fecha de la primera parcialidad, no la suma de todos los meses.
- **Sin calendario de festivos cargado**, el cálculo solo evita fines de
  semana.

## Archivos relacionados

- `src/utils/creditCardRecommendation.ts` — cálculo del corte, pago,
  financiamiento, orden y calendario de tramos.
- `src/utils/bankingDates.ts` — días hábiles, festivos, suma de días y
  diferencias entre fechas.
- `src/contexts/HolidaysContext.tsx` — carga del calendario CNBV.
- `src/screens/DashboardScreen.tsx` — tarjeta recomendada «para hoy» y
  calendario de uso por tarjeta.
- `src/components/modals/TransactionFormModal.tsx` — preselección y punto de
  recomendada en el alta de movimientos.

## Pruebas

- `src/utils/creditCardRecommendation.test.ts`
- `src/utils/bankingDates.test.ts`

Cubren fin de semana, festivos, festivo + fin de semana, días hábiles, día 31
en febrero, año bisiesto, corte fijo en fin de semana, exclusión de tarjetas
sin configuración, desempate por días de gracia, día fijo de pago (mismo mes,
mes siguiente, día 31, fecha exacta sin ajuste) y el calendario de tramos
(empates, recurrencia mensual, horizonte de 12 meses y el patrón con 6
tarjetas de crédito y una departamental excluida).
