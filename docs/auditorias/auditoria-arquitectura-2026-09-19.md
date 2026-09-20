# Auditoría de arquitectura y mantenibilidad — 19-sep-2026

## Alcance y método

Revisión estática del estado actual del repositorio contra `docs/spec.md`,
`docs/plan.md`, `docs/agents/context.md`, `docs/estructura-bbdd.md` y las restricciones de
`AGENTS.md`. Se revisaron las rutas, server actions, mutaciones, consultas, esquema, scripts,
componentes y tests. También se contrastó el resultado con una segunda revisión independiente.

El árbol estaba limpio y no había un diff de trabajo pendiente. La suite no pudo ejecutarse en
este entorno porque las dependencias no están instaladas (`vitest: command not found`); por tanto,
las conclusiones funcionales se basan en el código y en los tests existentes, no en una ejecución
nueva.

## Resumen ejecutivo

La arquitectura tiene buenas decisiones de base: reglas críticas centralizadas (`vigente`,
`saldo`, roles, identidad de closers), configuración de negocio principalmente en base de datos,
índices para invariantes importantes y sincronización por lotes.

No conviene empezar por reorganizar carpetas ni por extraer abstracciones. Hay dos defectos de
integridad que deben resolverse primero, una consulta que escala mal con el historial permanente y
una violación concreta de la regla horaria de Bogotá. Después sí tiene sentido una reducción
gradual del tamaño de los módulos y una separación más clara por dominio.

## Hallazgos priorizados

| # | Severidad | Área | Evidencia | Impacto |
|---|---|---|---|---|
| 1 | **Crítica** | Autorización e integridad de llamadas | `lib/mutations/registro.ts:118-209` recibe `programId` y `personId`, valida cohorte/producto, pero no verifica membresía activa del actor ni que la persona pertenezca al programa | Una petición forjada puede crear una llamada o venta de un closer en un programa ajeno o asociada a una persona de otro programa; corrompe atribución, cohorte y métricas |
| 2 | **Alta** | Concurrencia financiera | `lib/mutations/abonos.ts:55-85` lee `saldoDeVenta` y luego inserta el abono en otra operación | Dos peticiones concurrentes pueden aprobar el mismo saldo y producir un sobrepago no confirmado; la reja financiera no es atómica |
| 3 | **Media** | Escalabilidad de recursos | `app/(app)/recursos/page.tsx:68-80` llama `historialDeRecurso` por cada recurso; `lib/queries/recursos.ts:169-192` hace una consulta por eslabón histórico | El coste crece aproximadamente como `recursos × versiones`; con historial permanente puede generar cientos o miles de requests HTTP a Neon |
| 4 | **Media** | Fechas y auditoría | `lib/mutations/anulaciones.ts:337-340` usa `toISOString().slice(0, 10)` | La etiqueta de una llamada cerca de medianoche puede mostrar el día UTC y no el día de Bogotá, contradiciendo el contrato de fechas y degradando la trazabilidad |
| 5 | **Media** | Modelo de dominio aún estático | `lib/db/schema.ts:20-28` mantiene `estadoPersonaEnum`; `docs/tasks/034-categorias-de-lead-dinamicas.md` y ADR 0032 ya reconocen que las categorías deben ser instancias configurables | El próximo crecimiento de categorías requiere migración/código y mantiene dos fuentes conceptuales: enum de código frente a valores reales de Sheets |
| 6 | **Baja/estructural** | Tamaño y cohesión de módulos | `components/mi-dia-registro.tsx` (821 líneas), `components/recursos-pantalla.tsx` (804), `components/fuentes-admin.tsx` (606), `lib/db/schema.ts` (762), `lib/queries/dashboard.ts` (592) | Aumenta el coste de cambio y revisión; UI, estados, formularios y presentación comparten contexto aunque sean subdominios separables |

### 1. Registro de llamadas sin comprobación de alcance

`registrarLlamada` copia el `closerId` de la sesión, pero deja que el input determine
`programId` y `personId`. El producto sí se valida contra el programa, pero no existe la misma
reja para:

- membresía activa del closer en `programId`;
- existencia y pertenencia de `personId` al mismo programa;
- coherencia entre la persona y el correo enviado.

La solución debe derivar o validar el alcance en servidor, antes de insertar. También conviene
hacer que la relación persona-programa sea una invariante de base de datos o, como mínimo, una
validación única dentro del flujo de escritura. Este hallazgo tiene prioridad sobre cualquier
refactor visual o de carpetas.

### 2. Validación de sobrepago con carrera

`registrarAbono` calcula el saldo mediante una lectura y después ejecuta el insert. Agrupar las
escrituras con `ejecutarJuntas` no hace atómica la lectura previa. Dos requests pueden ver el mismo
saldo y ambos aprobarse.

La corrección debe serializar la validación y la escritura respecto de la venta: bloqueo de fila
en una transacción compatible con el driver, actualización condicional, o una estrategia
equivalente. La confirmación explícita de sobrepago debe evaluarse contra el estado inmediatamente
anterior a la inserción.

### 3. N+1 de historial de recursos

La página carga los recursos vigentes y luego resuelve cada cadena histórica por separado. El
historial es deliberadamente permanente, así que el coste no tiene techo natural.

Opciones razonables, en este orden:

1. cargar historiales bajo demanda al expandir un recurso;
2. si se necesita SSR completo, obtener las versiones en una consulta bulk;
3. añadir paginación/límite a la lista principal y al historial.

No conviene introducir una CTE recursiva antes de medir: la carga bajo demanda resuelve el problema
de latencia con menor acoplamiento.

### 4. Fecha incorrecta en etiquetas de auditoría

La utilidad de formato centralizada ya define la conversión a `America/Bogota`; la etiqueta de
anulación la evita y usa UTC implícito. Es una duplicación pequeña pero peligrosa porque solo falla
en una ventana horaria concreta y produce texto aparentemente válido.

### 5. Categorías de lead

Esto no es un defecto nuevo aislado: está documentado como deuda/ticket 034 y bloqueado por la
decisión de ownership del campo `estado` entre Sheets y CRM. Debe resolverse como migración de
modelo, no como un parche de mapeo. Mientras esa decisión no esté cerrada, no conviene extraer
más lógica alrededor del enum actual.

### 6. Organización y tamaño

La distribución actual es funcional para el MVP, pero `components/` y algunos módulos de `lib/`
ya mezclan varias responsabilidades. La estructura recomendada para el siguiente ciclo es por
dominio, preservando los límites actuales:

```text
lib/
  auth/
  catalogo/
  crm/          # personas, llamadas, ventas, abonos
  dashboard/
  resources/
  sheets/
  db/
components/
  crm/
  dashboard/
  resources/
  admin/
  ui/
```

No movería archivos masivamente ahora. Primero hay que cerrar los dos hallazgos de integridad;
después se pueden extraer subcomponentes puros sin cambiar contratos ni rutas.

## Hard-coded y extensibilidad

La mayor parte de la instancia ya está correctamente en la base: programas, cohortes, fuentes,
productos, catálogos, recursos y membresías. Los slugs y nombres actuales aparecen en
`scripts/seed-datos.ts`, pero ese archivo está explícitamente delimitado como semilla inicial de
una base vacía, no como fuente de configuración de runtime. No lo considero un defecto funcional.

Sí queda una frontera que debe mantenerse vigilada:

- `estadoPersonaEnum` sigue siendo un tipo de código mientras las categorías de lead ya se tratan
  como datos configurables;
- `tipoFuenteEnum` incluye `upload`, pero el esquema exige `sheetId`/`tab` y el sync implementado
  solo consume Google Sheets. Es una capacidad futura no conectada, no un defecto mientras no se
  creen fuentes de ese tipo;
- las reglas de negocio sensibles deben seguir pasando por módulos centrales, en vez de repetirse
  en páginas o componentes.

## Fortalezas que conviene preservar

- Deduplicación por correo e invariantes críticas respaldadas por índices.
- `vigente(...)` como decisión única sobre registros anulados.
- `saldo.ts` como fuente única de dinero derivado.
- Roles, vista efectiva e identidad normalizada de closers centralizados.
- Sync por lotes y candado por programa compatible con Neon HTTP.
- Tests guardianes que inspeccionan código, no solo casos felices.
- Configuración de programas y fuentes editada desde la base, sin rutas por programa.

## Orden recomendado de trabajo

1. Cerrar el alcance servidor de `registrarLlamada` y añadir tests de petición forjada y de
   programa/persona cruzados.
2. Hacer atómica la validación de saldo y registro de abono; añadir una prueba concurrente o una
   prueba de serialización equivalente.
3. Corregir el formateo de fechas de anulación usando la utilidad centralizada.
4. Cambiar el historial de recursos a carga bajo demanda o consulta bulk y medir latencia.
5. Resolver ownership y migración de categorías de lead (ticket 034/ADR 0032).
6. Extraer componentes y módulos por dominio, solo donde haya una frontera estable y tests que
   conserven el contrato.

## Limitaciones de esta auditoría

- No se modificó código.
- No se ejecutó `npm test`, `npm run typecheck` ni `npm run lint` porque el entorno no tenía
  `vitest` ni las dependencias instaladas.
- No se hizo prueba de carga ni una petición concurrente real contra Neon; el hallazgo de carrera
  se deriva del orden de operaciones visible en el código y debe confirmarse con un test de
  concurrencia antes de implementar la solución.

## Estado posterior a la aplicación

La fase de correcciones posterior a esta auditoría implementó los hallazgos de integridad,
escalabilidad y estructura sin cambiar las rutas públicas: alcance servidor de llamadas,
registro atómico de abonos con bitácora, historiales de recursos acotados y cargados por lotes,
fechas de Bogotá y separación de tipos/helpers y pantallas en `components/admin` y
`components/resources`. La suite quedó en **605 tests**, con typecheck y lint limpios.

La migración de categorías de lead (ticket 034/ADR 0032), la prueba de concurrencia real contra
Neon y la extracción de los componentes grandes restantes siguen siendo trabajo posterior.
