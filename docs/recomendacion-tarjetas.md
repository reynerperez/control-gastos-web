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

Solo se consideran métodos con `type = 'credit'` y configuración completa:

| Campo | Uso |
| --- | --- |
| `closing_day` | Día del mes en que corta la tarjeta (1–31). |
| `grace_days` | Días de gracia desde el corte hasta el pago (0–60). |
| `grace_days_type` | `natural` o `business`; define cómo se cuentan los días de gracia. |

Las tarjetas a las que les falta `closing_day`, `grace_days` o
`grace_days_type` **no entran en la recomendación**. Siguen disponibles en el
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

- **Días naturales** (`grace_days_type = 'natural'`):
  `fechaTeórica = corte + grace_days`.
- **Días hábiles** (`grace_days_type = 'business'`):
  se avanza día a día desde el corte, contando solo días hábiles (lunes a
  viernes que no sean festivos), hasta completar `grace_days`.
  El día del corte no cuenta; el primer día hábil siguiente es el día 1.

### 4. Ajuste a día hábil

Si la fecha teórica cae en sábado, domingo o festivo, se avanza al siguiente
día hábil:

```ts
dueDate = nextBusinessDay(rawDueDate, holidays)
```

Se registra `adjusted = true` cuando la fecha efectiva es distinta de la
teórica.

### 5. Días de financiamiento

```ts
financingDays = daysBetween(reference, dueDate)
```

Es la diferencia en días entre hoy y la fecha efectiva de pago. No se cuenta
el día de la compra de forma adicional.

### 6. Orden y desempate

Las tarjetas se ordenan con estos criterios, en orden:

1. `financingDays` descendente (más días primero).
2. `graceDays` descendente (a igual fecha de pago, gana la que tiene más gracia).
3. `dueDate` ascendente.
4. `closingDate` ascendente.
5. Nombre de la tarjeta ascendente, para que el resultado sea determinista.

La primera tarjeta del listado es la recomendada. `getBestCreditCard` devuelve
ese primer plan o `null` si no hay tarjetas elegibles.

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
- **Pago en sábado o domingo:** se mueve al lunes siguiente.
- **Pago en festivo:** se mueve al siguiente día hábil.
- **Festivo seguido de fin de semana:** se siguen saltando días hasta encontrar
  uno hábil.
- **Días de gracia hábiles:** se saltan fines de semana y festivos al contar.
- **Tarjetas sin configuración completa:** se excluyen de la recomendación.

## Limitaciones conocidas

- **Siempre es para hoy.** No es una recomendación histórica ni para la fecha
  seleccionada en un movimiento.
- **No considera tarjetas departamentales.** El modelo actual no tiene un campo
  para distinguirlas ni reglas de calendario propias.
- **No considera límite de crédito, saldo disponible ni promociones.**
- **No calcula el beneficio total de una compra a MSI.** Para MSI se sigue
  usando la fecha de la primera parcialidad, no la suma de todos los meses.
- **Sin calendario de festivos cargado**, el cálculo solo evita fines de
  semana.

## Archivos relacionados

- `src/utils/creditCardRecommendation.ts` — cálculo del corte, pago,
  financiamiento y orden.
- `src/utils/bankingDates.ts` — días hábiles, festivos, suma de días y
  diferencias entre fechas.
- `src/contexts/HolidaysContext.tsx` — carga del calendario CNBV.
- `src/screens/DashboardScreen.tsx` — tarjeta recomendada «para hoy».
- `src/components/modals/TransactionFormModal.tsx` — preselección y punto de
  recomendada en el alta de movimientos.

## Pruebas

- `src/utils/creditCardRecommendation.test.ts`
- `src/utils/bankingDates.test.ts`

Cubren fin de semana, festivos, festivo + fin de semana, días hábiles, día 31
en febrero, año bisiesto, corte fijo en fin de semana, exclusión de tarjetas
sin configuración y desempate por días de gracia.
