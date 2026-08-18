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

- **Next.js 16 App Router + TypeScript** (strict). Deploy en **Vercel**.
  (El plan original decia 15; `create-next-app@latest` entrega 16.3.1 y ahi se quedo.)
- **Neon Postgres + Drizzle ORM.** Migraciones versionadas en `drizzle/`.
- **Auth.js v5** con Google OAuth. Allowlist de correos en tabla `users`.
  Correo fuera de la allowlist = 403, no auto-registro.
- **Tailwind v4 + shadcn/ui** (sobre `@base-ui/react`). Modo claro y oscuro.
- **Recharts** para graficas (se instala en la Fase 2).
- **googleapis** para Google Sheets (lectura y escritura) — Fase 1.
- **SheetJS (xlsx)** para archivos subidos — Fase 5.
- **unpdf** para extraer texto de PDFs — Fase 5.
- **@react-pdf/renderer** para exportar reportes a PDF. No usar Chromium headless en Vercel.
- **Vercel Blob** para almacenar archivos subidos y PDFs generados.
- **Vercel Cron** para la sincronizacion programada.
- **Vitest** para tests. El motor de calculo va con tests, el resto no es obligatorio.

Idioma de la UI: **espanol**. Nombres de variables, tablas y archivos en ingles o espanol
sin acentos, consistente. Formato de numero colombiano: punto de miles, coma decimal
(ver `lib/format.ts`).

### Detalles del entorno que cuestan tiempo si se olvidan

- **El gestor de paquetes es `npm`, no `pnpm`.** En esta maquina npm apunta a `/usr/local` y
  no se puede instalar pnpm global sin sudo. Donde el plan diga `pnpm X`, corre `npm run X`.
- **Next 16 renombro `middleware.ts` a `proxy.ts`.** El archivo se llama `proxy.ts` en la raiz.
- **shadcn/ui ahora corre sobre `@base-ui/react`**: se usa `render={<Componente />}` en vez de
  `asChild`, y `onClick` en vez de `onSelect` en los items de menu.
- **`next-auth/jwt` solo re-exporta `@auth/core/jwt`.** La augmentacion de la interfaz `JWT`
  tiene que declararse sobre `@auth/core/jwt` o no aplica (ver `types/next-auth.d.ts`).
- **`LayoutProps` / `PageProps` son tipos que genera `next build`.** No dependas de ellos:
  tipa las props a mano para que `tsc --noEmit` corra en limpio sin build previo.

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
