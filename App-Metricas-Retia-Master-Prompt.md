---
type: spec
project: retia
created: 2026-08-18
uso: prompt maestro para Claude Code
version: 1.0
---

Prompt maestro para construir el dashboard de metricas de Retia. Se usa en dos partes:

- **Parte A** se guarda como `PROJECT.md` en la raiz del repo. Es el contexto permanente. Cada sesion lo lee.
- **Parte B** son 7 prompts, uno por fase. Cada fase es una sesion nueva de Claude Code.

Regla de tokens: **nunca corras dos fases en la misma sesion.** Al terminar cada fase, cierra la sesion y abre una nueva. El contexto se recupera de `PROJECT.md` + `STATE.md`, no del historial.

---

# PARTE A — PROJECT.md

Copia todo lo que sigue en un archivo `PROJECT.md` en la raiz del repo, antes de la Fase 0.

````markdown
# Retia Metrics — Dashboard comercial de Tactical Investor y Comunicarte

## Que es esto

Dashboard interno para el equipo comercial de Retia, agencia de gestion de infoproductos.
Retia vende dos programas por llamada de alto ticket. Este dashboard reemplaza el
seguimiento manual en Google Sheets: lee las BBDD reales, calcula el embudo, proyecta
si la meta del corte se alcanza, y deja que los closers registren sus llamadas.

Usuario principal: Michael Castellanos, Gerente Comercial. Usuarios secundarios: 3-5 closers/BDR.

## Los dos programas

| | Comunicarte | Tactical Investor |
|---|---|---|
| Que vende | Formacion en comunicacion ejecutiva | Formacion en trading |
| Ticket | USD 797 (subio desde 697 el 13-ago-2026) | USD 1.500 |
| ICP | Gerentes y jefes de area con equipo a cargo, 30-50 anos | Personas con ingreso declarado USD 1.000+ |
| BBDD fuente | "Aplicacion Comunicarte" (Google Sheets) | "Aplicacion De Cero a Tactical Investor" (Google Sheets) |

Son independientes: BBDD distinta, Calendly distinto, meta distinta, closers distintos.
Nunca se suman ni se promedian entre si.

## Vocabulario del negocio — usar estos terminos exactos en codigo y UI

- **Corte** — cohorte. Ciclo de venta que termina el mismo dia en que arrancan clases. C1, C2, C3.
- **Lead / Registro** — fila del formulario de aplicacion. Puede haber duplicados.
- **Persona** — lead deduplicado por correo. **Toda tasa se calcula sobre personas, nunca sobre filas.**
- **Descartado** — no califica. Se filtra antes de setteo.
- **Cola de setteo** — califica pero nadie lo ha contactado.
- **Invitado** — persona que agendo llamada (Calendly).
- **Agenda** — la cita agendada.
- **Show** — se presento a la llamada.
- **Cierre** — compro.
- **Closer** — vendedor que toma la llamada de postulacion.
- **BDR** — agenda y rescata pipeline. No cierra en frio.
- **Beca** — el unico descuento autorizado. USD 100 sobre precio de lista, solo por dificultad real de pago.

## Las dos tasas que mandan

Todo el dashboard gira alrededor de dos numeros. Si una vista no ayuda a moverlos, no va.

1. **Lead a venta** = cierres / personas
2. **Invitado a venta** = cierres / personas que agendaron

**Umbral operativo: invitado a venta debe estar en 15% o mas.** Debajo de eso, el problema
es la operacion (registro, show rate, cierre), no el volumen de leads. Marcar en rojo.

## Reglas de negocio que NO se pueden violar

1. **Dedup obligatorio por correo.** La BBDD de Tactical Investor tiene 2.932 filas que son
   1.825 personas. Hay un correo con 12 aplicaciones. Si calculas tasas sobre filas, todo
   el dashboard miente. Dedup por correo normalizado (minusculas, trim). Guardar el conteo
   de aplicaciones por persona como senal de intensidad, no como personas distintas.

2. **Los montos de la columna Precio son adelantos parciales, no precios finales.**
   Caja recaudada NO es ventas x ticket. Son dos metricas separadas: `ventas_cerradas`
   (conteo) y `caja_recaudada` (suma de abonos). Nunca inferir una de la otra.

3. **Solo dias habiles. Los festivos cuentan como habiles.** Regla de Retia, no del calendario
   colombiano. Solo se excluyen sabados y domingos.

4. **Cada corte se vende hasta el mismo dia en que arranca clases, inclusive.**
   El ciclo del siguiente corte arranca al dia siguiente. Nunca hay pausa. Maximo dos cortes
   activos en simultaneo, uno por programa.

5. **Moneda.** Tickets en USD, pauta en COP. Los links de pago se generan manualmente segun
   la TRM del momento, asi que no hay TRM unica historica. Guardar `trm_corte` como campo
   editable por corte (default 4.000) y mostrar siempre la moneda al lado del numero.
   Nunca convertir en silencio.

6. **Privacidad y rol.** La app maneja datos personales de miles de leads (nombre, correo,
   telefono, ingreso declarado) y desempeno individual de closers.
   - Rol `gerente`: ve todo, incluido el comparativo entre closers, CAC, ROAS y caja.
   - Rol `closer`: ve solo su propia cola, sus llamadas y sus numeros. **Sin comparativo con
     otros closers, sin ranking, sin datos de caja ni de pauta.** Esto es politica de la
     empresa, no una preferencia de UI. Enforzarlo en el servidor, no escondiendo componentes.
   - Nada de la app es publico. Sin sesion no se ve ni una cifra.

7. **La fuente de verdad es Google Sheets.** La app refleja y proyecta. Cuando la app escribe
   de vuelta (registro de llamadas), escribe en Sheets y luego re-lee para confirmar.
   Ante conflicto, gana Sheets.

## Estado real al 18 de agosto de 2026 — usar como datos de validacion

Estos numeros salieron de las BBDD reales. **No los hardcodees en la app** — la app los debe
recalcular desde los datos. Sirven para verificar que el motor de calculo esta bien:
si tu codigo produce otra cosa con los mismos datos, tu codigo tiene un bug.

### Comunicarte C1 (cerrado)
```
Leads 1.100 -> Descartados 561 (51,0%) -> Con Calendly 152 (13,8%)
-> Llamadas 135 -> Shows 51 (37,8%) -> Cierres 29 (56,9% sobre show) -> 30 compradores
Lead a venta: 2,64%   |   Invitado a venta: 21,5%
Pauta: COP 10.119.796  |  CPL: COP 9.200  |  Costo por agenda: COP 74.961
Ritmo sostenido: 73 leads por dia habil (15 dias habiles, 23-jul a 12-ago)
Origen de compradores: Instagram organico 30%, Meta Ads 27%, sin atribucion 17%,
WhatsApp 13%, directo 10%, referido 3%
Calificados que nunca agendaron: 259
```

### Comunicarte C2 (activo)
```
Meta 50 cupos | Vendidos 3 | Faltan 47 | 27 dias habiles | Cierra 22-sep-2026
Ritmo actual: 22 leads/dia habil | Requerido a tasas C1: 66/dia
Costo de cada dia habil perdido: 1,16 cierres
```

### Tactical Investor C1 (cerrado)
```
Filas 2.932 -> Personas 1.825 (37,8% duplicados)
Descartados 741 (40,6%) | Cola de setteo 883 (48,4%) | Agendaron 200 (11,0%)
Llamadas registradas 140 (70,0% de las agendas) | Shows 72 (51,4%) | Cierres registrados 17 (23,6%)
Lead a venta: 0,93%   |   Invitado a venta: 8,5%  <-- POR DEBAJO DEL UMBRAL DE 15%
Matriculados finales: 31 (solo 17 pasaron por el registro de llamadas, 7 nunca pasaron por el formulario)
Campana Captacion: 2.616 registros por COP 7.434.994 = COP 2.842/registro, COP 4.566/persona
ROAS motor de llamadas: 1,97  |  ROAS lanzamiento: 9,04  (son motores distintos, no se mezclan)
```

### Tactical Investor C2 (activo)
```
Meta 50 cupos cerrados por el equipo | Vendidos 0 | 30 dias habiles | Cierra 29-sep-2026
Ritmo actual: 18 personas/dia habil | Requerido a tasas C1: 179/dia (record historico: 30/dia)
Costo de cada dia habil perdido: 1,67 cupos
```

## Stack — ya esta decidido, no lo re-discutas

- **Next.js 15 App Router + TypeScript** (strict). Deploy en **Vercel**.
- **Neon Postgres + Drizzle ORM.** Migraciones versionadas en el repo.
- **Auth.js v5** con Google OAuth. Allowlist de correos en tabla `users`.
  Correo fuera de la allowlist = 403, no auto-registro.
- **Tailwind + shadcn/ui.** Modo claro y oscuro.
- **Recharts** para graficas.
- **googleapis** para Google Sheets (lectura y escritura).
- **SheetJS (xlsx)** para archivos subidos.
- **unpdf** para extraer texto de PDFs.
- **@react-pdf/renderer** para exportar reportes a PDF. No usar Chromium headless en Vercel.
- **Vercel Blob** para almacenar archivos subidos y PDFs generados.
- **Vercel Cron** para la sincronizacion programada.
- **Vitest** para tests. El motor de calculo va con tests, el resto no es obligatorio.

Idioma de la UI: **espanol**. Nombres de variables, tablas y archivos en ingles o espanol
sin acentos, consistente. Formato de numero colombiano: punto de miles, coma decimal.

## Reglas de trabajo para Claude Code

1. **Una fase por sesion.** Al terminar una fase, actualiza `STATE.md` y detente.
2. **Lee `PROJECT.md` + `STATE.md` + el spec de tu fase. Nada mas.** No explores el
   codebase completo al inicio de cada sesion; `STATE.md` te dice donde quedo todo.
3. **No adelantes trabajo de fases futuras.** Si la Fase 2 necesita algo de la 4, deja un
   TODO y sigue.
4. **Antes de cerrar la fase, corre los criterios de aceptacion del spec y reporta el
   resultado real.** Si algo falla, dilo. No declares terminado lo que no verificaste.
5. Commits pequenos, mensaje en espanol, prefijo `fase-N:`.
6. Secretos en `.env.local` y en Vercel. Nunca en el repo. Incluye `.env.example`.

## STATE.md

Crear en la Fase 0 y actualizar al cierre de cada fase. Formato:

```markdown
# Estado del proyecto
Ultima fase completada: N — <nombre>
Fecha: YYYY-MM-DD

## Que existe ya
- <archivo o modulo>: <que hace, en una linea>

## Decisiones tomadas que no estan en PROJECT.md
- <decision y por que>

## Deuda / TODOs abiertos
- <item> (lo resuelve la Fase M)

## Como correr
<comandos>
```
````

---

# PARTE B — Los 7 prompts de fase

Cada bloque es una sesion nueva. Pega el bloque completo.

---

## FASE 0 — Esqueleto, login y deploy

```
Lee PROJECT.md completo antes de escribir codigo.

Construye la Fase 0: esqueleto desplegado con autenticacion funcionando. Sin datos todavia.

Alcance:
1. Proyecto Next.js 15 (App Router, TypeScript strict, Tailwind, shadcn/ui) con estructura
   de carpetas por dominio: /app, /lib/db, /lib/sheets, /lib/metrics, /components.
2. Neon Postgres + Drizzle. Migracion inicial con solo la tabla `users`
   (id, email unico, nombre, rol enum 'gerente'|'closer', closer_id nullable, activo, created_at).
3. Auth.js v5 con Google OAuth. Callback signIn que rechaza (403) cualquier correo que no
   este en `users` con activo=true. Sin auto-registro.
4. Middleware que protege TODA ruta salvo /login y /api/auth/*. Sin sesion, redirect a /login.
5. Helper de servidor `requireRole(rol)` que se usa en cada route handler y server action.
   Escribe un test de Vitest que verifique que un closer no puede leer un endpoint de gerente.
6. Layout base: sidebar con navegacion (Comunicarte, Tactical Investor, Documentos, Ajustes),
   selector de programa, avatar con logout, toggle claro/oscuro. Los items que solo ve el
   gerente no se renderizan para closer.
7. Script `pnpm seed:users` que inserta el primer gerente desde una variable de entorno.
8. README con setup local y pasos de deploy a Vercel.
9. .env.example con todas las variables.

Criterios de aceptacion — verificalos y reportame el resultado:
- `pnpm build` pasa sin errores de tipo.
- La app corre local y el login con Google funciona.
- Un correo fuera de la allowlist recibe 403, no una cuenta nueva.
- El test de rol pasa.

Al terminar, crea STATE.md con el formato de PROJECT.md y detente.
```

---

## FASE 1 — Modelo de datos, sincronizacion con Sheets y bitacora de cambios

```
Lee PROJECT.md y STATE.md. No explores el resto del codebase.

Construye la Fase 1: el motor de datos. Todavia sin UI de metricas.

Modelo de datos (Drizzle, migracion versionada):

- programs: id, slug ('comunicarte'|'tactical_investor'), nombre, ticket_usd, activo
- cohorts: id, program_id, codigo ('C1','C2','C3'), meta_cupos, precio_usd,
  fecha_inicio_clases, fecha_cierre_ventas, trm_corte (default 4000), estado
  ('cerrado'|'activo'|'futuro'), notas
- sources: id, program_id, tipo ('google_sheet'|'upload'), sheet_id, tab, rango,
  mapeo_columnas (jsonb), ultima_sync, activo
- people: id, program_id, email_normalizado (unico por programa), nombre, telefono, cargo,
  empresa, ciudad, pais, ingreso_declarado, urgencia, utm_source, utm_campaign,
  fecha_primera_aplicacion, num_aplicaciones, estado
  ('descartado'|'cola_setteo'|'invitado'|'show'|'cierre'|'perdido'),
  motivo_descarte, cohort_id nullable, raw (jsonb con la fila original)
- calls: id, person_id, cohort_id, closer_id, fecha_agenda, fecha_llamada,
  resultado ('agendada'|'show'|'no_show'|'reagendada'|'cerrada'|'perdida'),
  motivo_perdida, notas, origen ('sheets'|'app')
- sales: id, person_id, cohort_id, closer_id, fecha, precio_lista_usd, precio_aplicado_usd,
  beca_aplicada (bool), monto_abonado, moneda, es_pago_completo (bool)
- ad_spend: id, program_id, cohort_id, campana, creativo, fecha, inversion_cop,
  impresiones, clics, registros
- sync_runs: id, source_id, iniciado, terminado, estado, filas_leidas, personas_nuevas,
  personas_actualizadas, errores (jsonb)
- change_log: id, tabla, registro_id, campo, valor_anterior, valor_nuevo, detectado_en,
  origen ('sync'|'app'|'upload'), sync_run_id nullable

Motor de sincronizacion (/lib/sheets):
1. Autenticacion con service account de Google (credenciales en env como JSON base64).
2. Lectura de un tab por `sources.mapeo_columnas` — el mapeo es configurable, NO hardcodees
   nombres de columna. Si el mapeo no cuadra con los encabezados reales, falla ruidosamente
   y registra el error en sync_runs, no adivines.
3. Normalizacion y dedup por correo (minusculas + trim). Al deduplicar, conservar la fecha
   de primera aplicacion, contar num_aplicaciones, y quedarse con el valor mas reciente
   no vacio de cada campo.
4. Upsert diferencial: por cada campo que cambia respecto a lo guardado, escribir una fila
   en change_log. Esto es el corazon del "registrar cambios" — sin esto la app no cumple.
5. Endpoint POST /api/sync/[sourceId] protegido (rol gerente o CRON_SECRET).
6. Vercel Cron cada 15 minutos que sincroniza todas las fuentes activas.
7. Idempotencia: correr sync dos veces seguidas no debe generar filas en change_log.

Seed: los dos programas y sus cortes C1/C2 con las fechas y metas que estan en PROJECT.md.

UI minima de esta fase (solo gerente): pantalla /ajustes/fuentes que lista las fuentes,
muestra ultima_sync y su estado, permite editar el mapeo de columnas, y tiene un boton
"Sincronizar ahora" con feedback del resultado.

Tests de Vitest obligatorios:
- Dedup: 2.932 filas con la distribucion descrita en PROJECT.md deben producir 1.825 personas.
  Genera un fixture sintetico que reproduzca ese ratio.
- Idempotencia del sync.
- change_log captura un cambio de campo y solo uno.

Criterios de aceptacion — verificalos y reportame:
- `pnpm build` pasa.
- Sync real contra una hoja de prueba trae filas y las deduplica.
- Segundo sync consecutivo deja change_log intacto.
- Los tests pasan.

Actualiza STATE.md y detente.
```

---

## FASE 2 — Motor de metricas y dashboard del gerente

```
Lee PROJECT.md y STATE.md. No explores el resto del codebase.

Construye la Fase 2: el calculo del embudo y la vista del gerente.

1. Motor de metricas puro en /lib/metrics — funciones sin acceso a base de datos, reciben
   arrays y devuelven numeros. Esto se testea aislado.
   - diasHabiles(desde, hasta): solo excluye sabado y domingo. Los festivos cuentan.
   - embudo(personas, calls, sales): devuelve cada etapa en conteo y en % sobre la anterior
     y sobre el total.
   - tasaLeadAVenta, tasaInvitadoAVenta.
   - ritmoPorDiaHabil(items, desde, hasta).
   - cajaRecaudada(sales): suma de abonos. Separada de ventasCerradas(sales): conteo.
   - cpl, costoPorAgenda, cac, roas a partir de ad_spend.

2. Dashboard del gerente por programa (/[programa]):
   - Encabezado del corte activo: meta, vendidos, faltantes, dias habiles restantes,
     cupos por dia habil requeridos.
   - Semaforo de invitado a venta contra el umbral de 15%. Verde/rojo, sin ambiguedad.
   - Embudo visual de la etapa de aplicacion al cierre, con conteo y conversion en cada paso.
   - Serie de tiempo: leads por dia habil, con linea del ritmo requerido superpuesta.
   - Comparativo C1 vs corte activo, tasa por tasa.
   - Tarjetas: caja recaudada, ventas cerradas, ticket promedio efectivo, CPL, costo por
     agenda, CAC, ROAS. Cada una con la moneda visible.
   - Tabla de closers: agendas, shows, cierres, show rate, close rate. **Solo rol gerente.**
   - Panel "Que cambio": ultimas 50 entradas de change_log en lenguaje legible
     ("Maria Gomez paso de cola_setteo a invitado — hace 2h").

3. Alertas visibles en el encabezado cuando aplique:
   - Invitado a venta por debajo de 15%.
   - Ritmo actual por debajo del requerido.
   - Una fuente sin sincronizar hace mas de 24h.
   - **Registro de llamadas sin filas nuevas hace mas de 48h** — este es un problema real y
     recurrente del negocio, no un caso hipotetico.

4. Todo endpoint pasa por requireRole. Un closer que llame al endpoint de metricas de
   gerente recibe 403 desde el servidor.

Tests de Vitest: cada funcion del motor con los numeros de validacion de PROJECT.md.
Si tu embudo de Comunicarte C1 no da 2,64% de lead a venta y 21,5% de invitado a venta
con esos insumos, tienes un bug — arreglalo antes de cerrar la fase.

Criterios de aceptacion — verificalos y reportame:
- Los tests del motor reproducen los numeros de validacion de los dos programas.
- El dashboard carga con datos reales de la Fase 1.
- Un usuario closer no puede acceder a /[programa] de gerente ni a su API.

Actualiza STATE.md y detente.
```

---

## FASE 3 — Proyeccion, escenarios y costo de demora

```
Lee PROJECT.md y STATE.md. No explores el resto del codebase.

Construye la Fase 3: el simulador. Esta es la pieza que convierte el dashboard en
herramienta de decision.

1. Motor de proyeccion en /lib/metrics/projection.ts, puro y testeado:
   - Dado meta, vendidos, dias habiles restantes y un set de tasas, calcula hacia atras
     cuantos leads, agendas y shows hacen falta, en total, por dia habil y por semana.
   - Dado un CPL, calcula la inversion en pauta requerida.
   - costoDeDemora(): cuantos cierres cuesta cada dia habil al ritmo actual en vez del
     requerido, y la tabla de "si arrancas en N dias, el ritmo requerido sube a X".
   - Marca cuando el ritmo requerido supera el record historico del programa — ese es el
     punto donde la meta se cae por volumen y ningun presupuesto la compra.

2. Pantalla /[programa]/proyeccion con tres escenarios precargados y editables:
   - A: tasas actuales sin cambios.
   - B: tasas operativas mejoradas (show rate y close rate). Sliders.
   - C: B mas rescate de la cola de setteo — personas calificadas que nunca agendaron,
     con tasa de agendamiento y de show configurables.
   Cada escenario muestra: leads totales, leads/dia, lead a venta, invitado a venta,
   pauta requerida en COP, y si es alcanzable contra el record historico.

3. Los escenarios se pueden guardar (tabla `scenarios`: cohort_id, nombre, supuestos jsonb,
   creado_por, created_at) y comparar lado a lado.

4. Panel de "cola muerta": personas en estado cola_setteo, ordenadas por senal de compra
   (ingreso declarado, urgencia declarada, recencia). Con el conteo arriba y el valor
   estimado en cupos segun las tasas del escenario C. Exportable a CSV.
   Este panel es el mas importante de la fase: hoy hay 883 personas sin tocar en Tactical
   Investor y 259 en Comunicarte, y ahi esta mas de la mitad de las dos metas.

Validacion — tu motor debe reproducir estos escenarios con los datos de PROJECT.md:
  Comunicarte C2: A = 1.783 leads / 66 por dia / COP 16,4M
                  B = 1.347 / 50 / COP 12,4M
                  C =   819 / 30 / COP 7,5M
  Tactical Investor C2: A = 5.368 / 179 / COP 24,5M
                        B = 2.463 /  82 / COP 11,2M
                        C = 1.061 /  35 / COP 4,8M
Tolerancia: 2%. Si no cuadra, el bug es tuyo, no de los numeros.

Criterios de aceptacion — verificalos y reportame:
- Los tests de proyeccion reproducen los seis escenarios dentro de la tolerancia.
- Mover un slider recalcula en vivo sin recargar.
- La cola muerta exporta CSV con los campos de contacto.

Actualiza STATE.md y detente.
```

---

## FASE 4 — Vista del closer y registro de llamadas con escritura a Sheets

```
Lee PROJECT.md y STATE.md. No explores el resto del codebase.

Construye la Fase 4: que el closer trabaje dentro de la app y el registro se llene solo.
Este es el problema #1 del negocio: el tab de registro de llamadas lleva dias sin llenarse
aunque las llamadas si se estan tomando.

1. Vista /mi-dia para rol closer:
   - Sus agendas de hoy y de manana, con la ficha del lead al lado: cargo, empresa,
     por que aplico (textual), ingreso declarado, ciudad, detonante detectado, num_aplicaciones.
   - Su cola de setteo asignada, ordenada por senal.
   - Sus propios numeros del corte: agendas, shows, cierres, show rate, close rate.
     **Sin comparativo con otros closers. Sin caja. Sin pauta.**

2. Registro de llamada en un formulario de menos de 30 segundos:
   - Resultado: show / no show / reagendada / cerrada / perdida.
   - Si es perdida: motivo, de una lista cerrada + campo libre.
   - Si es cerrada: precio aplicado, si se uso beca, monto abonado, moneda.
     Validacion: si el precio aplicado es menor al de lista y no hay beca marcada, o si el
     descuento supera los USD 100 autorizados, la app bloquea y pide justificacion escrita.
     Esto existe porque en C1 se vendieron cinco precios distintos en la misma cohorte.
   - Notas libres.

3. Escritura de vuelta a Google Sheets:
   - Al guardar, la app escribe la fila en el tab de registro de llamadas de la BBDD
     correspondiente, con el mapeo de columnas configurado en la Fase 1.
   - Escribe primero en Postgres con estado `pendiente_sync`, encola la escritura, y marca
     `sincronizado` solo cuando Sheets confirma. Si Sheets falla, reintenta con backoff
     y muestra el estado al usuario. Nunca se pierde un registro por un fallo de red.
   - Deja rastro en change_log con origen 'app'.
   - Ante conflicto con lo que ya esta en Sheets, gana Sheets y se notifica al gerente.

4. Vista de gerente /[programa]/equipo: quien registro que, cuando, y cuantos registros
   estan pendientes de sync.

Criterios de aceptacion — verificalos y reportame:
- Registrar una llamada desde la app aparece en Google Sheets en menos de 30 segundos.
- Cortar la conexion a Sheets y registrar: queda pendiente y se sincroniza al volver.
- Un descuento por encima de USD 100 no se puede guardar sin justificacion.
- Un closer no puede ver ni por API los datos de otro closer.

Actualiza STATE.md y detente.
```

---

## FASE 5 — Carga de archivos, lectura de PDFs y repositorio de documentos

```
Lee PROJECT.md y STATE.md. No explores el resto del codebase.

Construye la Fase 5: todo lo que entra a la app sin ser Google Sheets.

1. Carga de .xlsx y .csv (/ajustes/importar, solo gerente):
   - Drag and drop, parseo con SheetJS.
   - Pantalla de mapeo de columnas: la app propone el mapeo por similitud de encabezados,
     el usuario confirma o corrige. El mapeo se guarda como `sources` tipo 'upload' para
     reutilizarlo en la siguiente carga del mismo formato.
   - **Vista previa del diff antes de aplicar:** cuantas personas nuevas, cuantas
     actualizadas, que campos cambian, con una muestra. El usuario aprueba y ahi si se
     escribe. Nunca aplicar una importacion sin que el gerente vea el diff.
   - Mismo dedup y mismo change_log que el sync de Sheets. El archivo original va a Vercel Blob.

2. Ingesta de PDFs (/ajustes/importar, pestana PDF):
   - Extraccion de texto con unpdf.
   - Un parser especifico para reportes de Meta Ads (campana, creativo, inversion,
     impresiones, clics, resultados) que alimenta `ad_spend`.
   - Para cualquier otro PDF: extraer texto, mostrarlo, y dejar que el gerente mapee valores
     a campos manualmente. No inventes parsers genericos.
   - Regla dura: **si la extraccion no es confiable, dilo y no escribas nada.** Un numero de
     pauta mal parseado corrompe el CAC de todo el corte. Ante duda, pedir confirmacion
     humana con el texto crudo a la vista.

3. Repositorio de documentos (/documentos):
   - Subir, versionar y consultar PDFs y .docx: playbook de ventas, guia rapida de llamada,
     guia de agendamiento, brief de pauta, pipelines.
   - Metadata: programa, corte, tipo, version, fecha, quien subio.
   - Visor en linea y descarga. Visible para closer y gerente; el gerente controla que se sube.
   - Marca "vigente" vs "historico" por documento, porque hay material entregado al equipo
     que cita precios viejos.

Criterios de aceptacion — verificalos y reportame:
- Un .xlsx real se carga, muestra diff correcto, y solo escribe tras aprobacion.
- Cargar el mismo archivo dos veces produce un diff vacio la segunda vez.
- Un PDF de Meta Ads alimenta ad_spend con las cifras correctas, verificadas a mano.
- Un closer puede leer documentos pero no subirlos ni borrarlos.

Actualiza STATE.md y detente.
```

---

## FASE 6 — Exportacion a PDF, reportes y alertas

```
Lee PROJECT.md y STATE.md. No explores el resto del codebase.

Construye la Fase 6: que la informacion salga de la app.

1. Exportacion a PDF con @react-pdf/renderer (no Chromium):
   - Reporte de estado del corte: encabezado con meta y avance, embudo, tasas contra C1,
     escenarios, costo de demora.
   - Reporte semanal: que cambio en los ultimos 7 dias, ritmo, alertas activas.
   - Ambos respetan el rol de quien exporta: un closer nunca exporta datos de caja, pauta
     ni de otros closers.
   - Estilo: sobrio, tablas limpias, sin decoracion. Prosa directa, sin explicar por que
     funciona cada cosa. Es material de referencia para un equipo capaz, no un curso.
   - Nombre de archivo con guiones y ASCII puro, con fecha:
     `Estado-Corte-Comunicarte-C2-2026-08-25.pdf`. Sin espacios, sin acentos, sin emojis.
   - Cada export se guarda en Vercel Blob y queda en el repositorio de documentos.

2. Reporte programado: Vercel Cron los lunes a las 7am que genera el reporte semanal de los
   dos programas y lo deja en /documentos. Sin envio de correo en esta fase.

3. Centro de alertas (/alertas, gerente):
   - Reglas configurables con umbral editable: invitado a venta bajo el minimo, ritmo por
     debajo del requerido, fuente sin sincronizar, registro de llamadas estancado,
     ventana de reactivacion de pauta por vencerse.
   - Historial de alertas disparadas, con marcar como vista.
   - Preparado para notificar por correo o WhatsApp mas adelante, pero **no lo implementes
     todavia** — enviar mensajes en nombre de la empresa se decide aparte.

4. Exportacion a CSV desde cualquier tabla del dashboard, respetando rol.

Criterios de aceptacion — verificalos y reportame:
- Los PDFs generados abren correctamente. Verificalo renderizando el archivo real, no
  revisando el codigo que lo genera.
- Un closer que exporta no obtiene ningun campo restringido.
- El cron semanal corre en preview y deja el archivo.

Actualiza STATE.md y detente.
```

---

## FASE 7 — Endurecimiento y entrega al equipo

```
Lee PROJECT.md y STATE.md. No explores el resto del codebase.

Construye la Fase 7: dejarlo listo para que lo use gente que no eres tu.

1. Auditoria de permisos: recorre TODOS los route handlers y server actions y confirma que
   cada uno llama a requireRole. Escribe un test que falle si aparece un endpoint sin
   verificacion de rol. Reportame la lista de lo que revisaste.

2. Auditoria de datos personales: ningun dato personal en URLs ni en query strings. Los
   identificadores en rutas son ids opacos, no correos. Revisa y corrige.

3. Manejo de errores: pantallas de error y estados vacios en toda vista. Nada de pantalla en
   blanco cuando una fuente falla — decir que fallo y que hacer.

4. Rendimiento: indices en people(program_id, email_normalizado), calls(cohort_id, closer_id),
   change_log(detectado_en). Paginacion en toda tabla de mas de 100 filas.

5. Onboarding en la app: primera vez que entra un usuario, un recorrido de 4 pantallas segun
   su rol. Corto. Sin instrucciones obvias.

6. Respaldo: cron diario que exporta un snapshot de las tablas a Vercel Blob, retencion 30 dias.

7. Documentacion final en README: como agregar un usuario, como conectar una hoja nueva,
   como cambiar el mapeo de columnas, como corregir un corte mal configurado, que hacer
   cuando el sync falla.

Criterios de aceptacion — verificalos y reportame:
- El test de cobertura de permisos pasa y no hay endpoints sin proteger.
- La app en produccion carga el dashboard completo en menos de 3 segundos.
- Un usuario nuevo agregado a la allowlist entra y ve lo que le corresponde.

Actualiza STATE.md, escribe un resumen de todo lo construido, y detente.
```

---

# Lo que hay que tener listo antes de la Fase 1

Sin esto la Fase 1 se bloquea:

1. **Service account de Google** con la API de Sheets y Drive habilitadas, y el JSON de
   credenciales. Compartir las dos BBDD con el correo de la service account, con permiso
   de **editor** (la Fase 4 escribe).
2. **Los IDs de las dos hojas** y el nombre exacto de cada tab que se va a leer.
3. **Cuenta de Neon** (free tier sirve) con la connection string.
4. **Cuenta de Vercel** conectada al repo de GitHub.
5. **Credenciales de Google OAuth** (client id y secret) con los callbacks de local y produccion.
6. **La lista de correos del equipo** con su rol.

---

# Lo que este documento decide y por que

- **Sheets es la fuente de verdad, no la app.** El equipo ya trabaja ahi. Una app que exige
  abandonar Sheets no se adopta.
- **El dedup por correo es innegociable.** Sin el, las tasas de Tactical Investor se inflan
  un 60% y toda decision de presupuesto sale mal.
- **Adelantos parciales separados de ventas cerradas.** Es el error mas facil de cometer y
  el que mas caro sale al reportar caja.
- **Rol de closer sin comparativo.** Politica de Retia: nada de nombres ni juicios de
  desempeno en material que ve el equipo.
- **Escritura a Sheets con cola y reintento.** El registro de llamadas es el hueco #1 del
  negocio; si la app pierde un registro por un fallo de red, no arregla nada.
- **Sin envio de mensajes en nombre de la empresa.** Queda fuera del alcance a proposito.

Ver [[Pipeline-Proyectado-Comunicarte-C2]], [[Pipeline-Proyectado-Tactical-Investor-C2]] y
[[Onboarding-BDR-Tactical-Investor]].
