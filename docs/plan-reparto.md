# Reparto en paralelo: Mani y Alejo, por olas

> **Complemento de [`plan.md`](./plan.md), no reemplazo.** Qué se construye y cómo lo dicen el plan, los
> tickets y los ADR, y mandan ellos: si algo aquí contradice un ticket o un ADR, gana el ticket o el ADR
> y este documento se corrige. Lo único que agrega es **el orden para que dos personas trabajen en
> paralelo** sin pisarse. El estado de cada ticket sigue viviendo solo en
> [`tasks/README.md`](./tasks/README.md).
>
> Escrito el 28-sep-2026 sobre `main @ 6ad90ab`, leyendo los 53 tickets abiertos contra el plan y el
> código.
>
> 🎯 **30-sep: el norte comercial de Gerencia es la prioridad** ([`comercial.md`](./comercial.md)). Cambia
> las etapas del deal, el dinero y las metas, y pone la pauta después de la v1 comercial.
> **1-oct (paso 6 de `comercial.md` §8): §4 está reordenado.** Después de E6 vienen **NC1** (lote 1: el
> dinero), **NC2** (lote 2: las etapas de 30X, y con ellas el `--aplicar` del 078 y el corte) y **NC3** (el
> dashboard comercial, que es la v1 comercial). La pauta que espera a Meta (119, 120, 102) y lo de E7 y E8
> va después.
>
> 🌊 **1-oct (Mani): se pasa de etapas en serie con dos carriles a olas de tickets listos** (§1). Cada uno
> trabaja con varias sesiones; solo se ordenan las migraciones (una cola), los archivos calientes (un dueño
> por ola) y las decisiones. La ola vigente (O1) está al principio de §4. El código llega a `main` por push
> directo y se valida por checkpoints (§6).
>
> **Quién es quién:** "Alejo" en este documento es **Alejandro Dávila**, dev (`alejandrod-24`). El Alejo
> gerente de [`overview.md`](./overview.md) §4 es **Alejo Carvajal**, que aquí solo aparece como quien
> decide áreas y umbrales.

---

## 1. La regla: olas de tickets listos (desde el 1-oct)

Hasta el 1-oct el trabajo iba en **etapas en serie con un carril por persona**. Se cambió (Mani, 1-oct)
porque cada persona trabaja ahora con **varias sesiones a la vez** (Claude orquesta, Codex implementa, cada
sesión en su worktree: `~/.claude/CLAUDE.md` §5), y con dos carriles la mitad de esa capacidad se quedaba
quieta. Lo que de verdad choca no es la persona, son tres cosas, y **solo esas se ordenan**:

1. **Las migraciones van en una cola, una a la vez.** La aplica la sesión principal de Mani con su ok (ya era
   regla de `AGENTS.md`). Un ticket con migración espera su turno; uno sin migración no espera a nadie. Mientras
   una migración está abierta (escrita y sin aplicar), nadie más genera otra: así no se repite la 0024, que
   existía en la base y no en el repo (handoff, CIERRE 32).
2. **Los archivos calientes tienen un solo dueño por ola** (tabla de §2). Dos tickets que tocan el mismo
   archivo caliente van **en serie dentro de la misma sesión**, nunca en dos sesiones a la vez.
3. **Un ticket que espera una decisión no entra a la ola.** Se lista en §7 con quién la debe.

Lo que queda de antes:

- **La unidad es el ticket listo**: sus dependencias en `done`, sin pregunta abierta y, si lleva migración,
  con su turno en la cola. Cada ticket listo puede tener su propia sesión.
- **Una ola es la foto de los tickets listos**, repartidos entre los dos. Se rearma en cada checkpoint (§6): lo
  cerrado sale y lo que quedó listo entra. No hay que esperar a que "cierre" una ola para abrir un ticket nuevo.
- **Solo se construye sobre `main`.** Un ticket usa únicamente lo que ya está en `main`, nunca el trabajo a
  medias de otra sesión.
- **Los hitos siguen** (B: los closers operan en el CRM; v1 comercial; C: se apagan las pestañas), como destino,
  no como reja. NC1, NC2, NC3, E7, E8 y E9 de §4 quedan como **mapa de qué hay detrás de cada hito**.
- **Más sesiones no acortan el camino crítico.** Lo que frena la v1 comercial son las decisiones (§7), no las
  manos: cada ola nombra primero lo que destraba el camino crítico.

Tamaño estimado por ticket: **S** pequeño, **M** mediano, **L** grande. Es relativo, no son días.

---

## 2. Dueños de dominio y archivos calientes

Cada dominio tiene un dueño, que decide su contrato y revisa lo que entra ahí. El dueño **no** tiene que
construirlo todo: si sus sesiones están llenas, el otro toma el ticket avisando y reclamándolo en el tracker.

| Dueño | Dominio | Carpetas |
|---|---|---|
| **Mani** | motor, dinero y pantallas de trabajo | `lib/deals/`, `lib/crm/`, `lib/queries/saldo.ts`, `lib/queries/dashboard.ts`, pantallas de Deals, Inbox y Dashboard |
| **Alejo** | entradas, historia de Sheets e integraciones | `lib/ingesta/`, `lib/sheets/`, `lib/calendly/`, `app/api/webhooks/`, `lib/nav.ts`, `lib/auth/`, scripts de traslado y migración |

Mani además coordina, decide (§7), aplica las migraciones y corre los checkpoints (§6).

**Archivos calientes** (los toca una sola sesión a la vez; se reasignan al rearmar la ola):

| Archivo | Por qué | Dueño en la ola O1 |
|---|---|---|
| `lib/db/schema.ts`, `drizzle/` | migraciones | la cola (sesión principal de Mani) |
| `lib/deals/mover-etapa.ts`, `requisitos.ts`, `mapa-transiciones.ts`, `etapas.ts` | el motor | sesión del [135]; después la del [142] |
| `lib/queries/dashboard.ts` y `app/(app)/p/[programa]/dashboard/` | el dashboard | sesión del [095] |
| `lib/ingesta/regla-de-deals.ts`, `estados-llegada.ts` | la etapa de entrada | sesión del [117] |
| `lib/crm/rastro.ts`, `lib/auth/roles.ts` | contratos transversales | un cambio se pide y lo aprueba el otro |
| `docs/tasks/README.md`, `docs/agents/handoff.md`, `docs/plan.md`, este documento | coordinación | Mani, en el checkpoint |

Cada sesión escribe su estado y su nota de cierre **en el archivo de su ticket**; el tracker y el handoff los
actualiza Mani en el checkpoint, leyendo esas notas. Así ocho sesiones no chocan en dos archivos.

**Descartado, el ticket suelto a quien esté libre sin reglas:** trajo choques de archivos y de migraciones el
27-sep con E2 (handoff, CIERRE 33). Las tres reglas de §1 existen justo por eso.

---

## 3. Correcciones al grafo que este orden asume

Sin estas correcciones el paralelo no es posible o algo se rompe en silencio. **Se aplican en los
tickets en la etapa 0, con el ok de Mani**; hasta entonces mandan los tickets como están.

✅ **Aplicadas el 28-sep con el ok de Mani**, y creados 111, 112 y 113.

| Ticket | Hoy dice | Propuesta | Por qué |
|---|---|---|---|
| [069] | depende de 065 | depende de 057 y 097 | con 065 los closers no operan hasta tener la analítica, y eso contradice el orden P1 (`plan.md` §5); la revisión del 22-sep (P1) ya lo recomendaba |
| [074] | depende de 073 (→ 072 → 069) | depende de 069 y 060 | la ficha del deal es del paso 4 y colgaba de dos pantallas del paso 6 |
| [070] | depende de 069 y 085 | depende de 069 | 085 es del paso 5. El closer ya ve el origen con los UTM tal como llegaron (ADR 0044); la etiqueta de área se enciende sola cuando exista el 085 |
| [077] a [081] | 077 depende de 075 | 077 depende del traslado (111) y de las mutaciones de E4; se corren en el corte del hito B | sin lo abierto de hoy (Setteo, agendados, estudiantes con saldo) los closers llegan al CRM sin su pipeline y trabajan en dos herramientas |
| [064] | después del hito B | antes del hito B | `lib/queries/dashboard.ts` cuenta cierres con `calls.resultado = 'cerrada'` y filtra por `calls.closer_id` de texto; cuando los closers registren en el CRM saldría una cifra creíble y equivocada |
| [048], [049] | "Done cuando" habla del sync | cierran con el traslado (111) | el sync se retiró el 28-sep (108) |
| [086] | tracker: 048, 084 · archivo: 048, 084, 092 | 085 y 092 | alinear las dos fuentes |
| Typeform deja de escribir en Sheets | desde el hito B (`plan.md` §5) | después de 066 y 067 | la pestaña Urgencias, que el equipo mira a diario (066), vive en la hoja |

**Tickets que faltan** (los números son el siguiente libre; se confirman al crearlos):

| # | Qué | Por qué |
|---|---|---|
| 111 | **Traslado de leads y envíos desde Sheets**, una vez, por `ingerirEntradas`, con el Estado como lo escribió la hoja. Incluye las 55 de Forms viejo ([079]) | `plan.md` §4.3d lo nombra sin número. Producción solo tiene los leads del webhook desde el 28-sep |
| 112 | **CI**: `npm ci`, test, typecheck, lint y build en cada push y PR; **sin** proteger `main` (Mani, 28-sep) | no existe `.github/`, y `main` despliega a producción en cada push (ficha R4 de `plan.md` §7.1) |
| 113 | **Base local para desarrollar pantallas** (si Mani la aprueba): Postgres con todas las migraciones y datos de ejemplo; la misma receta corre en el CI | la única base es producción (ADR 0047, enmienda): cada clic de prueba al construir el Kanban o el Inbox escribiría ahí. R5 pedía Playwright "contra `dev`", que ya no existe. No es otro proyecto de Supabase |

---

## 4. La ola vigente y el mapa de etapas

### 🌊 Ola O3 · menos complejidad, cada dato en su objeto · abierta y cerrada el 3-oct

**La meta (Mani, 3-oct):** bajar el sobrediseño y la complejidad de operar el CRM, y centralizar lo que va junto:
lo de un programa en Programa, lo de un usuario en su perfil (Mi espacio). La regla es el
[ADR 0077](../adr/0077-cada-dato-vive-en-la-pantalla-de-su-objeto.md); las notas, `anotaciones.md` A-52 a A-76.
Convive con O2: el frente A (Memorable el lunes 5-oct) sigue mandando, y nada de O3 lo frena.

**Tres partes.** Dentro de cada parte las sesiones corren a la vez: cada una es dueña de sus archivos y ninguna toca
los de otra. Una parte arranca cuando la anterior está en `main`.

| Parte | Sesión | Ticket | Puntos de Mani (mensaje del 3-oct) | Archivos que son suyos | Migración |
|---|---|---|---|---|---|
| 1 | **S1** | [168] La ficha del deal se entiende sola | 1, 2 (ficha), 4, 5, 7 y Próximo contacto | `components/deals/ficha/*`, `detalle-de-llamada.tsx`, `dialogo-mover.tsx`, `responder-pregunta.tsx`, `pregunta-de-etapa.ts`, `lib/queries/ficha-deal.ts`, `detalle-llamada.ts`, `lib/deals/editar-deal.ts` | no |
| 1 | **S2** | [169] La llamada siempre tiene closer | 3, 14, 10 (host sin cuenta), 12 (Calendly: solo correo, libres, guarda al elegir) | `lib/calendly/*`, `lib/deals/handoff.ts`, `components/calendly-membresias.tsx`, `app/(app)/perfil/acciones.ts`, `scripts/simular-cita.ts`, el manual | no (relleno de datos con ok de Mani) |
| 1 | **S3** | [170] Las listas | 8, 9, 10 (Calls de cada closer), 12 (Personas fuera), 13 | `components/filtros/` (nuevo), Calls, Leads, Students, `llamadas-programa.tsx`, `filtro-kanban.tsx`, `filtro-dashboard.tsx`, `selector-periodo.tsx`, `lib/queries/llamadas.ts`, `leads.ts`, `personas.ts`, `nuevo-deal.tsx`, `lib/nav.ts` (solo Personas) | no |
| 1 | **S4** | [171] Todo lo del programa en Programa | 11, 15, 16, 17 (Recursos libre), membresías → Equipo | `app/(app)/p/[programa]/programa/*`, `programas-admin.tsx`, `cohortes-admin.tsx`, `fuentes-admin.tsx`, `ajustes/programas/*`, `ajustes/fuentes/*`, `usuarios-admin.tsx`, `program-switcher.tsx`, `lib/catalogo/plataformas.ts`, `enlaces-pago.ts`, `recursos.ts`, `components/resources/*`, `app/(app)/recursos/*` | no |
| 2 | **S5** | [172] Mi espacio y "Ver como" | 12 (perfil, tabs, ver como) | `app/(app)/mi-espacio/`, `mi-dia/`, `perfil/`, `perfil-propio.tsx`, `user-menu.tsx`, `app-sidebar.tsx`, `lib/nav.ts`, `lib/auth/vista.ts` y la reja de solo lectura | no |
| 2 | **S6** | [173] Ajustes solo con lo que no es de nadie (+102) | 17 (Motivos, Áreas), 18, 19 y A-81 (lo obsoleto de Ajustes) | `app/(app)/ajustes/page.tsx`, `salud/*`, `canales/*`, `catalogos/*`, `entregas-webhook.tsx`, `canales-admin.tsx`, `catalogos-admin.tsx`, `lib/queries/entregas-webhook.ts`, `lib/auth/roles.ts` | **sí** (rol `paid_trafficker`) |
| 2 | **S9** | [176] Transición y Llamadas, segunda pasada (el pulido de la parte 1 ya está en `main`, `cp-20261003-3`: lista para abrir) | notas del 3-oct (A-77 a A-80) | la ficha: `ficha-transicion`, `ficha-alertas`, `ficha-llamadas`, `ficha-pago`, `pregunta-de-etapa`, `responder-pregunta`, `dialogo-mover`, `detalle-de-llamada`, `llamadas-programa`, `inbox-llamadas-de-hoy` | no |
| 3 | **S7** | [174] Volver a donde estaba | 6 | `page-shell.tsx`, el helper de enlaces y los enlaces de las listas | no |
| 3 | **S8** | [175] Limpieza | 17 (Orígenes), lo que el ADR 0077 punto 3 quita | lo que borra, y la migración | **sí** (quita `origenes` y categorías de recurso) |
| 3 | **S10** | [177] Pulido de la parte 2 | revisión central del 3-oct (172, 176) | `acciones-de-llamada.tsx`, `lib/auth/guards.ts` (lecturas), `deals/acciones.ts`, `inbox/acciones.ts`, `mi-espacio/page.tsx`, `perfil-de-mi-espacio.tsx`, `barra-suplantacion.tsx`, `ajustes/canales/acciones.ts` | no |
| 3 | **S11** | [178] Ajustes sin rutas viejas | A-81 (lo que el 173 no pudo borrar) | `ajustes/programas/**` y `ajustes/fuentes/**` (se van), `p/[programa]/programa/**`, los imports de `program-switcher`, `cohortes-admin`, `fuentes-admin`, `equipo-del-programa`, `editar-programa`, `ajustes/catalogos/**` | no |
| 3 | **S12** | [179] Mi espacio curado por rol | decisión de Mani del 3-oct | `app/(app)/mi-espacio/`, `components/mi-espacio/`, el registro de secciones nuevo, `rutaInicial` del paid trafficker en `lib/nav.ts` | no |

**Lo compartido en la parte 1:** `lib/queries/inbox.ts` lo tocan S1 (motivo "Próximo contacto vencido") y S2 (motivo
"host sin cuenta"): cada una agrega su motivo y no edita el de la otra; quien llegue segunda a `main` rebasa.
`lib/nav.ts` es de S3 en la parte 1 y de S5 en la parte 2 (Alejo avisado). `components/admin/entregas-webhook.tsx`:
S3 cambia solo un enlace; S6 la rehace en la parte 2.

**Cómo arranca cada sesión** (el prompt que se pega en una sesión nueva, cambiando el número):

> Toma el ticket `docs/tasks/1NN-….md` de la ola O3. Lee `AGENTS.md`, `docs/plan-reparto.md` §4 (ola O3), el
> ADR 0077, las anotaciones que cita el ticket y `docs/structure.md` §9 si toca pantallas. Trabaja en un worktree
> propio; implementa Kiro por `kiro-rescue` y tú revisas el diff contra el "Done cuando". Toca solo
> los archivos que el ticket y la tabla de la ola O3 dicen que son tuyos. Antes de empujar: typecheck, lint, los
> tests del ticket y `npm run build` si tocaste un componente cliente; recorrido en `dev:local` con la consola
> abierta, haciendo clic en todo lo que se abre, y las reglas de permiso mordidas forjando la petición. No corras
> la suite completa ni generes o apliques migraciones: entrega el cambio de `schema.ts` y avisa. No toques
> `docs/tasks/README.md`, `docs/agents/handoff.md` ni este documento: escribe tu estado y tu nota de cierre en el
> archivo del ticket. Ninguna escritura en producción sin el ok de Mani. Empuja a `main` nombrando tus archivos.

**Parte 2 cerrada en `cp-20261003-4` (3-oct, tarde):** 172 y 176 done; 173 con el código en `main` y la **0063** generada,
aplicada en producción el mismo día con el ok de Mani (173 done). La parte 3 arranca: S7, S8, S10 y S11 corren a la vez; S12 (179) después del 177, porque los dos tocan Mi espacio. **Por esta ola implementa
Kiro** (`kiro-rescue`), no Codex (Mani, 3-oct). Cruces de la parte 3: `mi-espacio/page.tsx` lo tocan S7 (enlaces) y S10
(texto del developer); `inbox/acciones.ts` y `deals/acciones.ts`, solo S10. Quien llegue segunda a `main` rebasa.

**Parte 3 cerrada en `cp-20261003-7` (3-oct, noche):** 174, 175, 177 y 178 (`cp-20261003-5`), 180 (`cp-20261003-6`) y 179,
cada uno con el recorrido de la sesión central. **La ola O3 queda cerrada**; lo que sigue vivo es el frente A de O2
(Memorable el lunes 5-oct) y el 167.

**Migraciones de la ola:** la **0062** (`recursos.categoria_id` nula, para el 171) está aplicada en producción desde el 3-oct. El rol `paid_trafficker` sale con el código del 173 y el borrado de `origenes` y `categorias_recurso` con el del 175, después de desplegar ese código (orden en cada ticket).

**La sesión central** (la del 3-oct que armó esta ola) revisa cada entrega en `main` contra su "Done cuando", genera
y aplica las migraciones de S6 y S8 con el ok de Mani, corre el checkpoint de cada parte (§6) y marca el tracker.

### 🌊 Ola O2 · la operación comercial lista en el CRM · reescrita el 2-oct (noche)

**La meta (Mani, 2-oct):** que toda la operación comercial, de la entrada del lead a student, se maneje en el CRM.
**Es la prioridad.** Métricas finas, dashboard por secciones y pauta van encima, después. Esta sección es **la lista
completa** para cerrarla: quien la tome en otra sesión no necesita nada más que esto, `AGENTS.md` y los tickets que
cita. Producción al 2-oct: la entrada funciona (174 envíos en 48 h, cada uno con su deal), pero nadie opera (0 deals
de En gestión en adelante, 0 abonos).

**Dos frentes, y el primero manda** (Mani, 2-oct):

- **Frente A · Programas que nacen en el CRM** (los que venden Nicolás y Francisco): sin hojas, sin migración. Es la
  **prioridad**: arrancan el lunes 5-oct.
- **Frente B · Programas que ya tienen hojas** (ComunicArte y Tactical): migrar lo histórico (078), el corte y
  apagar las pestañas.

Los dos se apoyan en una **base común (frente 0)**. Decidido el 2-oct y que ya no se reabre: **los parciales siguen
abriendo deal en Potencial** y las etapas se manejan como están (A-41 cerrada, así se hace en 30X).

#### Frente 0 · Base común (bloquea A y B)

| # | Qué | Quién | Ticket | Hecho cuando |
|---|---|---|---|---|
| 0.1 | ✅ `cp-20261002-5` (2-oct) y `cp-20261003-1` (3-oct). Empujar `main` y marcar el checkpoint (último CI pendiente: `52de822`) | sesión | · | tag `cp-AAAAMMDD-N` en verde: 143, 152, 156 y 157 cuentan como hechos |
| 0.2 | Recorrer la lista de pruebas como closer (`docs/pruebas-operacion-comercial.md`, 33 pruebas) | Mani | 153 | cada prueba marcada; lo que falle, en `anotaciones.md` con su id |
| 0.3 | Recorrer lo nuevo: propiedades en rojo (143), Transición y pop-up (156), Calendly propio (152), handoff del setter: link de agenda, "Ya se lo mandé", "Setteado por", suelta ajena = 403 (157) | Mani | 143, 152, 156, 157 | sin hallazgos abiertos, o cada uno con su ticket |
| 0.4 | Arreglar lo que salga de 0.2 y 0.3 | Codex → sesión | uno por hallazgo | en `main` con su nivel 1 |
| 0.5 | ✅ (160, `cp-20261003-1`) Marcar una cortesía | Codex → sesión | 160 | ver el ticket |
| 0.6 | ✅ (161, `cp-20261003-1`) La alerta "agotó intentos" | Codex → sesión | 161 | ver el ticket |
| 0.7 | 🔴 **Decidir S1: Supabase Pro.** Aplica a los dos frentes: desde el día 1 los programas nuevos también viven solo en la base | Mani con el equipo | · | Pro pagado, o el `pg_dump` diario como regla escrita en `operations.md` |
| 0.8 | Manual de operación comercial al día (incluye la versión corta de las 11 etapas) y publicado para los closers | sesión | 154 | "Lo que le falta al CRM" refleja 0.1 a 0.6 |

#### Frente A · Programas que nacen en el CRM (prioridad, antes del lunes 5-oct)

| # | Qué | Quién | Hecho cuando |
|---|---|---|---|
| A.1 | ✅ **Memorable en Instagram & TikTok** (Mani, 2-oct; deck en sus descargas): virtual, 6 semanas, 12 sesiones, **USD 1.200**, clases desde el **3-nov**, la dicta Nicolás Martínez. Lo venden **Nicolás y Francisco** (closers). **C1: ventas del lunes 5-oct al 28-oct** (Mani). Falta la meta de cupos | Mani | nombre, ticket USD y ventana de la C1 escritos aquí |
| A.2 | Crear cada programa de punta a punta, en el orden de `operations.md` §2.1: programa → token de Calendly → formulario en Dapta (`docs/dapta/`) con agenda, Lead Quality y Lead Value → fuente + secreto + activar → URL y secreto en el proveedor → "enviar prueba" → Calendly en el formulario → publicar | Mani (secretos a mano) y sesión (JSON del formulario) | el programa activo, con su fuente principal (092) |
| A.3 | La cohorte C1 de cada programa: ventana de venta, meta de cupos, ticket base | Mani | la tab Programa (`/p/<slug>/programa`) con la cohorte activa |
| A.4 | Dar de alta a Nicolás y Francisco en `/ajustes/usuarios`: rol closer, **`closer_id` (obligatorio por ahora, ver 159)**, membresía en su programa | Mani | los dos entran con su Google y ven su programa |
| A.5 | Invitarlos a la organización de Calendly del programa (round robin y su disponibilidad, que configura Michael) y que cada uno asigne su cuenta desde Mi espacio | Mani y ellos | una cita de prueba con cada uno cae en el deal correcto, no suelta |
| A.6 | Recursos del programa: brochure y enlaces de pago, con sus plataformas vinculadas | Mani o el closer | el closer los copia en un clic desde Recursos |
| A.7 | Comisión del programa (% congelado al vender) | Mani | cargada en la ficha del programa |
| A.8 | **Un envío real por camino** antes de compartir el link: parcial, completo sin agenda, completo High, con agenda, con las seis UTM. Y el recorrido completo de un deal: setteo → cita → Grain → "¿Cómo terminó?" → abono → Student. Los de prueba se anulan | Mani y sesión | cada camino revisado en la base; ningún sobre crudo con error |
| A.9 | Capacitar a los dos con el manual (0.8) y la llamada de prueba con Andrea | Mani | operan solos su primer lead |
| A.10 | Vigilar la primera semana: `/ajustes/salud`, alarma "sin calidad", sueltas en el Inbox | sesión, a diario | cero envíos perdidos, cero sueltas sin asignar al cierre del día |

#### Frente B · Programas con hojas (ComunicArte y Tactical)

| # | Qué | Quién | Ticket | Hecho cuando |
|---|---|---|---|---|
| B.1 | ComunicArte: paso 0 (barrido de hoy y tabla de destinos aprobada por Mani), `pg_dump`, `--aplicar`, conciliación | Mani (la sesión principal aplica) | 078 | conciliación en 0 y los closers revisan lo suyo |
| B.2 | Tactical: lo mismo | Mani | 078 | ídem |
| B.3 | El corte con capacitación (`operations.md` §12): los closers de CA y TI dejan las hojas | Mani | · | **hito B** |
| B.4 | A la semana hábil, apagar las pestañas de gestión | Mani | 082 | **hito C** |

#### Las decisiones que acompañan el cierre (Mani)

Ninguna frena el día 1 de operar; cada una destraba algo de la primera o segunda semana. Recomendación escrita en
cada ticket o en `plan.md` §7.

| Decisión | Destraba | Cuándo | Recomendación |
|---|---|---|---|
| Cómo se registran las objeciones (con Michael) | 158: el reporte del día sale del CRM y Michael deja de armarlo por WhatsApp | semana 1 | catálogo editable al responder "¿Cómo terminó?" |
| A-05: el hub del closer | la cola ordenada por Lead Value, días en etapa y próximo paso (075) | semana 1 | el Inbox ampliado con "lo mío" |
| QM-3 · GC-17: la próxima fecha de pago, hablando con 2 o 3 closers | 144: cartera por fecha | semana 2 | al lado de la fecha límite |
| QM-5: los pasos del onboarding | 145: rol Customer Success | semana 2 | filas por programa |
| QM-6 · QM-7: la meta del mes | 146: página de Metas | semana 2 | pareja por día hábil |
| QM-11: métricas con umbral | 147: alertas por persistencia | semana 2 | solo las del semáforo de la meta |

#### Las sesiones de código de la ola (sesión central del 2-oct noche)

Salen de las notas de Mani (A-43 a A-51) y del audit. **Ninguna de las cuatro primeras lleva migración** y cada una
toca archivos distintos (cada ticket nombra lo que toca y lo que no), así que corren a la vez, una sesión y un
worktree cada una, Codex en `medium` por `/delegate`. La sesión central revisa cada diff contra el "Done cuando".

| Sesión | Ticket | Cuándo | Archivo caliente que es suyo en la ola |
|---|---|---|---|
| S1 ✅ | [162] Transición única y botones de etapa | ya (fin de semana) | `ficha-transicion`, `ficha-actividades`, `responder-pregunta`, `pregunta-de-etapa` |
| S2 ✅ | [163] Detalle de llamada | ya | `ficha-llamadas`, `llamadas-programa` |
| S3 ✅ | [161] → [160] (en serie, misma sesión) | ya | `lib/deals/requisitos.ts` (motor), `lib/queries/inbox.ts`, alertas |
| S4 ✅ | [165] → [166] (en serie) | ya | `lib/catalogo/cohortes.ts`, `lib/deals/actividades.ts`, `opcionesDeFicha`, tab Programs |
| S5 | [164] Mi espacio → **reemplazado por el [172] de la ola O3** | · | `app/(app)/mi-dia/`, `lib/nav.ts` (avisar a Alejo) |
| S6 | [167] Quién cobró es una FK | semana 1, después del 160 | la cola de migraciones, `lib/queries/comision.ts`, `metricas-filtros.ts` |

✅ S1 a S4 en `main` la misma noche (2-oct), CI verde y `cp-20261003-1`; recorrido de la sesión central hecho en `dev:local`. Sigue S6 (167); el 164 pasó al 172 (ola O3). Antes: el lunes, A.8 antes de compartir el link. Sin el 167, A.4 sigue
pidiendo `closer_id` al dar de alta a Nicolás y Francisco.

**Después de esta ola** (no es operación, es lectura): 148 dashboard por secciones, 065, 090, 159 (`closer_id` se
retira), la pauta.

**Cómo arrancar la sesión que la tome:** leer `AGENTS.md`, esta sección y `plan.md` §4.0. Empezar por 0.1 (el
checkpoint) y A.1 (la pregunta a Mani). Codex implementa 0.4 a 0.6 por `/delegate`; la sesión principal revisa,
genera y aplica migraciones con el ok de Mani, y marca aquí cada fila al cerrarla.

### 🌊 Ola O1 · abierta el 1-oct

Se llama "O" para no confundirla con las olas 0, 1 y 2 de Pauta (`analytics.md` §7). Una fila es una sesión.

**Primero, el camino crítico.** La v1 comercial cuelga del [142] (las once etapas en una migración), y el 142
espera dos cosas que no son código. Sin ellas, ninguna cantidad de sesiones adelanta el hito B:

| Qué | Quién | Destraba |
|---|---|---|
| ✅ ~~**QM-10**~~: cerrada el 1-oct por el [ADR 0070](./adr/0070-re-agenda-seguimiento-y-proxima-cohorte-son-pendientes-del-deal.md) (son **Pendientes** del deal, no etapas) | Mani | 142 → 143, 128, 118, el 117 enmendado, el `--aplicar` del 078, el corte, 148 |
| ✅ ~~**Manual de gestión comercial** (QD-8)~~: aprobado el 2-oct; dudas contestadas en el [ADR 0071](./adr/0071-como-se-mueve-un-deal-por-las-etapas-de-30x.md) (D-7 queda para el 118) | Alejo → Mani | 142 y 143 (qué es obligatorio por etapa) |

**Tickets listos, una sesión cada uno:**

| Sesión | Ticket | Dueño | Archivo caliente | Tamaño |
|---|---|---|---|---|
| O1-a | ✅ [135] Atendido sin Grain (`cp-20261001-1`) | Mani | el motor | S |
| O1-b | ✅ [139] la ficha del deal por bloques: done en `cp-20261002-1`; recorrido visual hecho; lo que salió quedó en A-15 a A-18 | Mani | · | M |
| O1-c | ✅ [140] crear un deal a mano (`cp-20261002-2`) | Alejo (propuesto, el dominio es de Mani) | · | M |
| O1-d | ✅ [095] (`cp-20261001-1`) el dashboard con "todos" solo sumable | Mani | el dashboard | M |
| O1-e | ✅ [100] la tab Programs (`cp-20261002-2`) | Alejo | · | M |
| O1-f | ✅ [073] ficha del lead → [091] (`cp-20261002-2`) | Alejo | · | M + S |
| O1-g | ✅ [066] Urgencias → [068] → [076] (lecturas) (`cp-20261002-4`) | Alejo | · | M + S + S |
| O1-h | los cabos del [117]: fase 2 y reproceso hechos el 2-oct; solo falta anotar el primer parcial real de Typeform (el [072] se cerró el 1-oct) | Alejo | la etapa de entrada | S |
| O1-i | ✅ [150] tests rápidos: base migrada una vez por corrida: en `main` el 1-oct (`0e65c15`, `4f6b63c`), CI verde (vitest 372 s → 274 s), done en `cp-20261002-1`; queda `npm run test:cambios` | Mani | `tests/helpers/`, `vitest.config` | M |

**Avance de la ola** (lo que ya está en `main` y espera el checkpoint verde para contar como hecho, §6):

- **O1-d · [095], 1-oct** (`a60601a`, `54cb540`, `d13a95e`; cierre en su archivo): `/dashboard` es "Todos los
  programas" y suma solo conteos y caja por moneda; tasas, metas y comisión van por programa. La garantía es de
  tipo (`sumarConteos`, `sumarDinero`). Integra la cifra de shows sin Grain del [135] sin reimplementarla. Lo que
  ve el paid trafficker queda para el [102]. El archivo caliente del dashboard queda libre.
- **El CI de ese push salió rojo por dos tests de otros tickets**, arreglados por la sesión del 095:
  `deal-etapas` (T7 pasó a "ambos" con el 135; lo arregló su sesión en `51f9e67`) y `origen-del-envio` (el
  [139] cambió la forma de `fichaDeDeal(...).origen` a `{ envioId, fecha, calificacion, utm }` y el test seguía
  esperando la vieja). 🩸 Los dos se colaron porque el nivel 1 de cada sesión corre **sus** tests, no los de
  quien lee lo que cambió: antes de empujar un cambio de forma en una función de `lib/`, `rg` por sus lectores
  en `tests/`.
- **Checkpoints:** `cp-20261001-1` (`e5319e2`: 095 y 135), `cp-20261002-1` (`526a105`: 139 y 150) y
  **`cp-20261002-2`** (`3f8509a`: 142, 140, 100, 073 y 091; el 117 sigue en curso con sus dos fases de código en
  `main`; producción sirve ese commit). **`cp-20261002-3`** (`e1f90ab`: 151, CI verde). **`cp-20261002-4`** (`d0b9b40`: 129, 118, 128, 066, 068 y 076; la 0059 aplicada; el 117 solo espera anotar el primer parcial real de Typeform).

**La cola de migraciones de la ola**, en este orden (una abierta a la vez):

1. ✅ ~~Aplicar la **0057**~~ (quita `cohorts.trm_cohorte`): aplicada el 1-oct. La TRM del ROAS
   queda como decisión abierta de E7 (`plan.md` §7).
2. [092] con el **ADR 0068**: `sources.url_publica` y la fuente principal por programa. Sube de E8 a esta ola
   porque ComunicArte recibe por Typeform y por Dapta y hoy el CRM solo puede repartir un link.
3. [102] el rol Paid Trafficker (valor nuevo del enum de roles).
4. ✅ El manual se aprobó el 2-oct (ADR 0071): **el [142] salta al frente**. ✅ **0058 aplicada el 2-oct (madrugada)**: la cola se descongela (092 → 102). Toca el
   enum de etapas, los requisitos y la traducción de todos los deals). El 092 y el 102 esperan detrás, aunque su
   código puede avanzar en su rama sin generar la migración.

**Desbloqueados por el 142 (`cp-20261002-2`), entran a la ola:** [143] propiedades por etapa (Mani, el motor) ·
✅ [128] alertas del deal y ✅ [118] "se perdió en el Calendly" (`cp-20261002-4`) · [148] y [065] (después del 143). La cola
de migraciones sigue con 092 → 102 (la 0059 del 117 ya se aplicó el 2-oct). ✅ **0061 del [157] aplicada el 2-oct (noche)** con el ok de Mani (`setter_user_id`, `handoff_en`); sigue el 102.

**No entran a O1** (y por qué): [129] espera dos decisiones de
Mani (están en el ticket) · [144] a [147] esperan QM-3, QM-5, QM-6, QM-7, QM-11 y GC-17 · [119], [120], [123],
[125] esperan el token de Meta · [122] y [126] parte B tienen migración y son de pauta: entran a la cola después
del 142 · [035] espera el formato del comprobante.

**Prueba de costura de la ola:** un deal creado a mano (140) entra por `abrirDeal`, se ve en la ficha nueva
(139) y cuenta en el dashboard con "todos" (095) solo en las cifras sumables.

### El mapa de etapas (lo que hay detrás de cada hito)

Desde el 1-oct estas etapas **ya no son rejas en serie**: dicen qué tickets llevan a cada hito. E0 a E6 están
cerradas o con sus cabos repartidos en la ola O1; NC1 a E9 se vacían ola por ola.

| Etapa | Nombre | Hito al cerrar |
|---|---|---|
| E0 | Terreno para dos | · |
| E1 | El deal registra llamadas y la historia entra | · |
| E2 | El dinero mueve el deal; Calendly y la navegación | · |
| E3 | El Kanban y la migración ensayada | · |
| E4 | Inbox y Students | · |
| E5 | Dashboard sobre deals, vista interina de Pauta | · (el corte pasa a NC2) |
| E6 | De dónde viene cada lead (ola 1 de Pauta) | · |
| **NC1** | El dinero del deal (lote 1 comercial) | · |
| **NC2** | Las etapas de 30X (lote 2 comercial), la migración aplicada y el corte | **Hito B**: los closers operan en el CRM |
| **NC3** | El dashboard comercial | **v1 comercial** · **Hito C** ([082]) cuando el equipo lleve una semana hábil solo en el CRM |
| E7 | Lo que cuesta y lo que vende la pauta (ola 2) | Sheets fuera: Typeform deja de escribir ahí y se borra el Apps Script |
| E8 | El dashboard completo | · |
| E9 | Revisión cruzada y manual de uso | v1 completo |

**1-oct: por qué este orden** (paso 6 de [`comercial.md`](./comercial.md) §8; Mani, 30-sep: *"es la
prioridad"*; Dani: *"la versión 1 es solamente la visual de comercial"*):

- **NC1 antes que NC2** porque el lote 1 no espera a nadie y el 142 sí: espera el manual de gestión
  comercial (QD-8), que escribe Alejo **dentro** de NC1, y la decisión QM-10 (los estados dentro del deal).
  Así NC1 produce, a la vez, el dinero y lo que NC2 necesita para arrancar.
- **El corte se muda de E5 a NC2**: meter los deals de las hojas en las etapas viejas obligaría a migrarlos
  dos veces (`comercial.md` §8). El `--aplicar` del 078 va después del 142, con el mapeo de la QD-2.
- **E6 cierra con lo que queda en código del carril**: 117 (cabos). Lo de E6 que espera a afuera o que el
  ADR 0069 cambia se muda: [118] a NC2 (su disparador es la etapa de entrada que reescribe el 0069), [119],
  [120] y [102] a E7 (esperan el token de Meta y la v1 es comercial), [082] a NC3.
- **Las etapas de pauta (E7, E8) no se borran**: siguen igual, después de NC3. Si el token de Meta llega
  antes, 119 y 120 pueden correr en el carril de Alejo en NC3 siempre que no toquen etapas ni dinero (QM-8).

El hito A (los leads entran solos) se cumplió el 28-sep. El 082, que `plan.md` §1 pone como línea de
llegada, pasa a caer en E6: con la migración antes del hito B ya no espera a la analítica.

**29-sep: E6 a E8 se rehicieron con la reunión con Pauta** ([`analytics.md`](./analytics.md) §7; tickets
116 a 126). Mani: *"lo antes posible, sin fechas, estructurado"*. Dos consecuencias para el orden:

- **El corte (hito B) deja de frenar las etapas de código.** Espera decisiones de afuera (la fecha con los
  closers, S1), no código. Cuando el código de E5 está en `main`, E6 abre aunque el corte siga pendiente; el
  corte se hace en cuanto esas dos cosas estén. La ola 1 de Pauta (envíos, agendas, gasto) no depende de él.
- **Lo que no se puede reconstruir va antes que todo** (ola 0 de `analytics.md`: campo oculto `utm_id`,
  plantilla de UTM en Meta, token de Meta, columna de origen en las hojas, crear la C3). Es configuración:
  corre desde ya, fuera de los carriles.

### E0 · Terreno para dos

Que trabajar de a dos no dependa de la memoria de nadie.

| Mani | Alejo |
|---|---|
| Aplicar §3 en los tickets y el tracker; crear 111, 112 y 113 · M | ✅ 112 · CI en cada push (sin proteger `main`) · M |
| Refrescar `plan.md` §2 y `AGENTS.md` (lista abajo) · S | 113 · base local, si se aprueba · M |
| Ops: quitar `CRON_SECRET` y `SHEET_ID_*` de Vercel (108); cargar a Andrea ([007]) · S | Plantilla de PR con el checklist de contratos de `AGENTS.md` · S |
| Agendar a Michael ya; después closers, Gerencia y Pauta (§7) · S | Cerrar [105]: forjar la acción desde una sesión de closer · S |

- **Docs que hoy se contradicen:**
  - `AGENTS.md` dice que `npm ci` falla por el lock y `plan.md` §2 dice que se reparó el 27-sep. El CI
    lo resuelve midiendo.
  - `plan.md` §2 dice 867 tests y 33 migraciones (hoy son 1.068 y 36).
  - `plan.md` §5 y §6 hablan de `dev` y de una producción que "todavía no existe".
  - [068] describe corridas de sync.
  - [082] dice que el Apps Script sigue haciendo falta, y el ADR 0054 dice lo contrario.
- **Migración:** ninguna.
- **Decidir antes de E1:** §3, y si va la base local.
- **Sale cuando:** el CI corre en verde sobre `main`; este orden y §3 están en `main`. ~~Un PR real pasa
  el CI y lo aprueba el otro~~: fuera por decisión de Mani (28-sep, velocidad; ver §5).

### E1 · El deal registra llamadas y la historia entra

Backend puro.

| Mani | Alejo |
|---|---|
| [057] · M | [110] · M |
| → [058] · S | → 111 traslado (incluye [079]; cierra [048], [049] y la parte de datos del [050]) · L |
| → [059] · S | |

- **Migración de arranque:** `calls` gana dueño como usuario y link de Grain (057, 058); tabla de
  entregas del webhook (110).
  ✅ 28-sep: la parte de `calls` salió sola como **0036** (aplicada, ok de Mani) para que el carril de
  Alejo construya sobre `main`; la tabla del 110 va en la 0037.
- **Decidir antes:** nada bloquea. "Grain o sucedió" ([058]) se valida con closers sin frenar el código.
- **Prueba de costura:** un envío firmado abre el deal, se agenda, se pega el Grain y el deal queda en
  Atendido. Un lead del traslado que vuelve a llenar el formulario no se duplica.
  ✅ 28-sep: `tests/costura-e1.test.ts` (los dos casos, y el inverso: webhook primero, hoja después).
- **Sale cuando:** el traslado corrió en producción con el ok de Mani y la conciliación del 110 marca
  cero faltantes.
  ✅ **E1 cerrada el 28-sep (sesión 43).**

### E2 · El dinero mueve el deal; Calendly y la navegación

| Mani | Alejo |
|---|---|
| [060] (recrea el test de saldo centralizado) · L | [097] · M |
| → [061] · S | → [096] · L |
| → [063] · M | |

- **Migración de arranque:** cuenta de Calendly por membresía y datos de la llamada suelta (096).
- **Decidir antes:** D3 de `plan.md` §7.1 (¿un deal en Abonado ocupa el cupo del lead?) · ~~A5 (webhook o
  consulta de Calendly, Vercel Pro)~~ ✅ webhook, Mani 28-sep; falta confirmar el plan de Calendly (Standard o más) · de quién es el deal si el lead agenda con otra
  closer.
- **Prueba de costura:** una cita de Calendly cae en su deal, el Grain lo pasa a Atendido, un abono a
  Abonado, el que salda a Completo, y anular ese abono lo devuelve.
  ✅ 28-sep: `tests/costura-e2.test.ts` (webhook con cita vigente → Grain → dos abonos → cartera y estudiantes →
  onboarding → anular ambos, con el historial completo). **Estado al 29-sep:** 097 cerrado; del 096 el
  código está completo y live (webhook verificado en producción, migraciones 0038 y 0039 aplicadas). **E2
  cierra** cuando Mani vincule las cuentas de Calendly de las closers y cree a Maru en `/ajustes/usuarios`;
  K2 ya está decidida y resuelta por 071 (`plan.md` §7). El cierre de 096 pasa al carril de Mani.

### E3 · El Kanban y la migración ensayada

| Mani | Alejo |
|---|---|
| [069] · L | [077] · M |
| → [074] · L | → [078] · M |
| | ~~→ [081]~~ descartado (28-sep, Mani: solo USD) |

- **Migración de arranque:** lista de lo no clasificable (080). ~~Marca de abono convertido (081)~~: descartada, solo USD.
- **Decidir antes:** ~~A4 (cómo se prueba la UI)~~ ✅ 28-sep: usándola, Mani · ~~hasta cuántos días atrás vale migrar Setteo~~ (✅ 28-sep, Mani: lo trabajado + los últimos 30 días; parámetro para TOTAL) ·
  ~~la tasa COP→USD~~ (✅ descartada: solo USD) · ~~qué gana cuando los consolidados de C2 y la hoja difieren~~ (✅ la hoja, Mani 28-sep).
- **Prueba de costura:** los deals del ensayo aparecen en el Kanban y se mueven por el motor, con el
  requisito que falta a la vista.

### E4 · Inbox y Students

| Mani | Alejo |
|---|---|
| [070] · M | [080] · L |
| → [071] · L | → [099] · M |

- **Migración de arranque:** la pregunta de ingreso por fuente y sus bandas (070).
- **Decisiones cerradas:** el score lo calcula el formulario por programa y el CRM solo lo recibe;
  no hay lógica de ingreso ni bandas en el CRM. La alerta de deal sin actividad usa 3 días hábiles por
  defecto y es configurable. Students muestra deals en `abonado` o `completo`, con su lead, por cohorte
  y programa; el onboarding lo marca el closer dueño, gerente o developer.
- **Prueba de costura:** recorrido en celular sobre la base local: reclamar un Setteo, agendar, pegar el
  Grain, registrar el abono. Consola abierta, clic en todo lo que se abre.

### E5 · Dashboard sobre deals y corte

| Mani | Alejo |
|---|---|
| [064] · L | [062] · S |
| → [098] · M | → [072] (cierra el [050]: separar y confirmar duplicados; **también lo usa el closer**, ADR 0060) · M |
| → [115] (el origen es del envío, ADR 0060) · M | → guion del corte, capacitación y plan de reversa · M |
| → [093] vista interina de Pauta (29-sep: lo primero que se entrega a Pauta, sin migración) · S | |

- **Ola 0 de Pauta, fuera de los carriles y desde ya** ([`analytics.md`](./analytics.md) §7): O-1 campo
  oculto `utm_id` en los dos Typeform (ok de Mani), O-2 plantilla de UTM en Meta (Pauta, después de O-1),
  O-3 token de Meta (Anderson), O-4 columna "origen del deal" en las hojas (Mani o Dani con los closers),
  O-5 crear la C3 de cada programa (gerente), ~~O-6 confirmar el parche de Tactical con un envío real~~ ✅ 29-sep.

- **Migración de arranque:** la tasa de comisión del programa (062).
- **Decidir antes:** ~~precio de lista de ComunicArte~~ ✅ 797 · la fecha del corte (closers) · 🚨 **Supabase Pro
  (S1, `plan.md` §7): sin él no hay respaldos, y desde el corte la historia vive solo en esa base** (equipo).
- **Costura del 115 con el carril de Alejo (29-sep):** el 115 toca `lib/ingesta/regla-de-deals.ts`, que es
  del carril de Alejo, así que ese cambio va con su ok. Y el importador del 078 tiene que pasar
  `submissionOrigenId` al abrir cada deal histórico (el envío más reciente del lead): **antes de aplicar la
  migración en el corte**, o los deals migrados nacen sin origen.
- **El corte** (⚠️ 1-oct: **se muda a la salida de NC2**, con las etapas de 30X; los pasos no cambian) (el guion completo, la capacitación y la reversa
  viven en [`operations.md`](./operations.md) §12):
  0. S1 decidido (Supabase Pro o no, con un respaldo manual si es no).
  1. Ensayo final de la migración en la base local con las hojas del día.
  2. Los closers dejan de escribir en las pestañas de gestión por unas horas; la migración corre en
     producción con el ok de Mani.
  3. Conciliación y lista de rarezas revisadas contra la hoja.
  4. Closers con cuenta, membresía y Calendly por programa; recorrido de su día en el celular.
  5. Desde ese día se registra solo en el CRM. Las pestañas quedan de respaldo hasta el 082.

### E6 · De dónde viene cada lead (ola 1 de Pauta)

> 1-oct: E6 cierra con los cabos del [117]. Se mudan [118] a NC2, [119], [120] y [102] a E7, y [082] a
> NC3 (§4).

| Mani | Alejo |
|---|---|
| [083] · S | [116] · S |
| → [101] (con los pares medidos el 29-sep y `paid_social`) · M | → [117] (va después del [115]: los dos tocan `regla-de-deals.ts`) · M |
| → [085] (lee `utm_id`; macro sin expandir; nivel de la traza) · M | → [119] · M |
| → [087] (va con el 085, nunca después) · S | → [120] · L |
| → [121] · M | → [102] · M |
| → [118] · S | [082] cuando el equipo lleve días operando solo en el CRM (propuesta: una semana hábil) = **hito C** · S |
| → [089] · M | |

- **Migración de arranque:** una sola, aditiva: áreas, canales, `submissions.utm_id`, `estados_llegada`,
  `deals.area_declarada_id`, `meta_conexiones`, `cuentas_publicitarias`, `pauta_objetos`, `gasto_pauta` (y
  se retira `ad_spend`, vacía) y el valor `paid_trafficker`. Con DP-25 aprobado, `utm_patron` no se crea.
- **Decidir antes:** PQ1 (Pauta: cuentas, moneda y zona
  horaria) · PQ7 (Gerencia: nombre visible de cada área) · el token de Meta (Anderson) · dónde vive el token
  de Typeform ([126]).
- **Prueba de costura:** un envío `ig / paid_social` con `utm_id` resuelve a su área (Pauta), su anuncio, su
  conjunto y su campaña, con el gasto de ese anuncio; un parcial `con_calendly_sin_agenda` abre el deal en
  Setteo con prioridad alta y su completa con cita lo pasa a Agendado; "sin UTM" y "sin clasificar" salen
  separados, con conteo.
- **Después, en producción (ola 0, O-7):** punto parcial antes del Calendly, valor `con_calendly_sin_agenda`
  y evento `form_response_partial` en el webhook. **Solo cuando el 117 esté en producción.**

### NC1 · El dinero del deal (lote 1 comercial) — abre el 1-oct

> 1-oct: 132, 133, 134, 136, 137, 138 y 141 hechos. Lo que queda (135, 139, 140, el cierre del 072 y del 117 y el
> manual) se repartió en la ola O1. El 139 quedó en `main` local el 1-oct (falta el checkpoint).

| Mani | Alejo |
|---|---|
| [132] valor vendido (migración, `high`) · L | Cerrar [072] (390 px en vivo) y los cabos del [117] · S |
| → [133] comisión % congelada (migración, `high`) · M | → **Manual de gestión comercial** (QD-8): cuándo y cómo se mueve un deal entre las etapas de 30X, qué tiene que tener para entrar y quién lo mueve, desde `insumos/hubspot-30x-workflow.md` · M |
| → [134] ticket base de la cohorte, adiós `productos` (migración destructiva) · M | → [140] crear un deal a mano · M (propuesta, ver abajo) |
| → [135] Atendido sin Grain · S | |
| → [139] la ficha del deal por bloques · M | |

- **Ya hechos del lote** (Alejo, 1-oct, tomados porque estaban libres): [136], [137], [138], [141].
- **El 140 pasa al carril de Alejo, propuesta a confirmar por Mani:** el carril de Mani lleva tres
  migraciones de dinero en serie y el de Alejo se queda corto en NC1. El 140 abre el deal por `abrirDeal`
  (el escritor de la ingesta, dominio de Alejo) y reutiliza el alta manual del lead; no toca los archivos
  del 132 al 135. Si Mani prefiere tenerlo, vuelve a su carril después del 139.
- **Migración de arranque:** no hay una sola: 132, 133 y 134 llevan una cada uno, **en serie y en el mismo
  carril**, así nunca hay dos migraciones abiertas a la vez (§5). Las aplica la sesión principal con el ok
  de Mani.
- **Decidir durante NC1, para que NC2 abra:** **QM-10** (los estados dentro del deal: Pendiente Re-agenda,
  Seguimiento, Próxima Cohorte; `/grill-with-docs` con ADR) · **QM-12** (cortesías) · confirmar el destino
  de la **QD-2** (cola del setter = En gestión) · QM-3, QM-5, QM-6, QM-7 y QM-11 (sus tickets, del 144 al
  147) · **GC-17**: Mani habla con 2 o 3 closers sobre los abonos.
- **Prueba de costura:** un deal entra a Abonado con valor vendido escrito, su comisión queda congelada en
  el porcentaje del programa (10,04% ComunicArte, 6,67% Tactical) y el ticket base sale de su cohorte; un
  deal creado a mano entra por el mismo escritor y se mueve con el motor.
- **Sale cuando:** 132 a 135, 139 y 140 en `main`, y el manual de gestión comercial escrito en `docs/`.

### NC2 · Las etapas de 30X, la migración aplicada y el corte

| Mani | Alejo |
|---|---|
| ADR de QM-10 (estados dentro del deal) · S | [117] enmendado con el ADR 0069: la etapa de entrada la decide el CRM por agenda y calidad (va con la migración del 142) · M |
| → [142] las once etapas en **una** migración: enum, transiciones, requisitos y la traducción de deals, historial y estados de llegada · L | → [078] `--aplicar` con el mapeo de la QD-2 (regenerar antes el template de ComunicArte) · M |
| → [143] propiedades obligatorias por etapa (sin catálogo de etiquetas: QD-10) · M | → [147] alertas por persistencia (5 hábiles, configurable) · M |
| → [128] alertas del deal (rojo: falta algo, QD-4) · M | → [145] rol Customer Success y onboarding (`lib/auth/`) · M |
| → [118] "se perdió en el Calendly" · S | → guion del corte ([`operations.md`](./operations.md) §12) al día con las etapas nuevas · S |
| → [144] próxima fecha de pago y cartera · M | |
| → [146] meta del mes y página de Metas · M | |

- **Migración de arranque:** la del 142, una sola y en el carril de Mani. El 117 de Alejo se construye
  **sobre** ella (rama propia, se mergea después), porque los dos tocan la etapa de entrada.
- **Decidir antes:** todo lo que NC1 dejó listo (arriba) · la fecha del corte (closers) · 🚨 S1 Supabase
  Pro (equipo).
- **El corte**, que es la salida de NC2 y el hito B: los pasos 0 a 5 de E5 (abajo) siguen iguales, con las
  etapas de 30X.
- **Prueba de costura:** un parcial sin calidad nace en Potencial, un completo Low en Registrado, uno High
  en Calificado y uno con agenda en Agendado (ADR 0069); un deal migrado de la hoja cae en En gestión o en
  ganado según la QD-2; una propiedad obligatoria vacía sale en rojo en la ficha.

### NC3 · El dashboard comercial (v1 comercial)

| Mani | Alejo |
|---|---|
| [095] la tab Dashboard con "todos" solo sumable · M | [100] la tab Programs (los usuarios configuran su programa, QD-7) · M |
| → [148] las secciones Pulso, Operación comercial y Dinero · L | → [073] ficha del lead · M |
| → [129] motivos y origen vacíos (dos decisiones de Mani) · S | → [091] `otrosProgramasDelCorreo` · S |
| → hub del closer en Mi día con el **nivel de contacto** por actividad (QD-12, A-05; sale del [075]) · M | |
| [082] apagar las pestañas de gestión, a la semana hábil del corte = **hito C** · S | |

- **Migración de arranque:** ninguna prevista.
- **Prueba de costura:** cada cifra de las tres secciones abre su lista (137) y cuadra con ella; "todos"
  solo suma lo sumable.
- **Sale cuando:** Gerencia ve su dashboard comercial sobre las etapas de 30X y los closers trabajan desde su
  hub. Es la **v1 comercial**.

### E7 · Lo que cuesta y lo que vende la pauta (ola 2)

> 1-oct: entran aquí, desde E6, [119], [120] y [102] (carril de Alejo, antes del [126] parte B). Van
> después de NC3, salvo que el token de Meta llegue antes (ver §4).

| Mani | Alejo |
|---|---|
| [122] · M | [126] · M |
| → [123] · L | → [088] · M |
| | → [066] · M |
| | → [067] (captura manual del gasto de otras plataformas y ROAS por cohorte) · M |
| | → [065] · M |

- **Migración de arranque:** `objetivos` y `programs.valores_calificados`.
- **Decidir antes:** DP-23 y DP-24 (Mani) · PQ3 y PQ4 (Pauta: conversión, ritmo, desfase y objetivos) ·
  PQ5 (Gerencia: cortesías). ROAS y Juanito ya respondidos (Mani, 28-sep).
- **Prueba de costura:** una venta de un anuncio con gasto cargado sale en su área, su campaña y su anuncio,
  con su costo por venta y su ROAS a la TRM que decida A12 (`plan.md` §7; la de la cohorte se quitó el 1-oct), igual en la consulta del 123 y en el 088.
- **Al cerrar:** Typeform deja de escribir en Sheets y se borra el Apps Script.

### E8 · El dashboard completo

> 1-oct: el [092] sube a la ola O1 (cola de migraciones) por el ADR 0068: el link sale de la fuente principal.

| Mani | Alejo |
|---|---|
| [124] · L | [092] (el builder solo para orgánico y closer) · M |
| → [125] · M | → [086] · M |
| → [095] · M | → [068] (reescribir su alcance: el sync ya no existe) · S |
| → [090] · L | → [076] · S |
| | → [100] · M |
| | → [021] · M |

- **Migración de arranque:** ninguna prevista.
- **Decidir antes:** PQ6 (Pauta y Media: convención del orgánico) y los umbrales que falten (Gerencia). No
  bloquea: el 090 y el 124 muestran el supuesto que usan.
- **Prueba de costura:** "todos los programas" solo suma lo sumable (test de tipo) y cuadra con la suma de
  cada programa; el ROAS de una campaña cuadra entre la tab Campañas y el Dashboard.

### E9 · Revisión cruzada y cierre de v1

El [075] se parte en dos y cada uno revisa lo que construyó el otro.

| Mani | Alejo |
|---|---|
| [073] · M | [035] · M |
| → [091] · S | → 075: revisa las pantallas que hizo Mani · M |
| → 075: revisa las pantallas que hizo Alejo · M | |

- **Decidir antes:** cómo mandan el comprobante los closers (foto, link o PDF) · **A-18**: qué respuestas oculta el
  bloque Perfil de la ficha del deal además de los `utm_*` (correo, WhatsApp, `variable:*` de Typeform).
- **El 075 también recoge A-15, A-16 y A-17** (Facturación de la ficha del deal, del recorrido del 139).
- **Al final, sesión principal:** [149], el manual de uso del CRM por rol, enlazado dentro del CRM (QD-7).
- **Sale cuando:** criterio de UI escrito, recorrido completo en celular y escritorio, y el manual publicado.

---

## 5. Cómo se trabaja con varias sesiones

Las reglas de `AGENTS.md` siguen todas. Estas se suman:

- **Una sesión, un ticket, un worktree.** Al abrirla: `git fetch`, reclamar el ticket en **su archivo**
  (`status: en curso` y quién, en un commit que se empuja ya) y mirar que ningún archivo caliente que toque
  tenga otro dueño en la ola (§2). Los tests corren en el worktree; `next build` y `next dev` solo en el
  checkout principal (`AGENTS.md`, Conventions).
- **Lo que corre cada sesión antes de empujar (nivel 1):** `npm run typecheck`, `npm run lint` y los tests de
  su ticket (`npm test -- tests/x.test.ts ...`), más el guardián del contrato que toque (vigencia, rastro,
  identidad del closer, atribución, catálogo). La suite completa **no** se corre en local (Mani, 1-oct).
- **Push directo a `main`, sin PR obligatorio** (Mani, 28-sep y 1-oct: velocidad). Se empuja cuando el ticket, o
  una tajada coherente de él, pasó el nivel 1; no en cada commit. Antes: `git pull --rebase`. Un ticket de agente
  (Codex) no se empuja sin que la sesión que orquesta haya leído el diff contra el "Done cuando".
- **Una migración aditiva se aplica antes del push del código que la usa**, con el ok de Mani; una que quita
  columnas, después de que el código sin ellas esté desplegado (`AGENTS.md`).
- **El cadenero sigue:** quien no escribió el código lo revisa contra el "Done cuando" y los contratos, sobre el
  commit. Lo hace otra sesión, no la que lo escribió.
- **Una prueba de costura por ola:** un test que cruza tickets de la ola (en la ola de §4).
- **Si una sesión termina:** se rearma con el siguiente ticket listo de la ola; si no queda ninguno, ayuda a
  destrabar el camino crítico (§4) o baja deuda del tracker. Nunca toma un ticket bloqueado "para adelantar".
- **Pantallas y permisos:**
  - Toda pantalla se prueba en la base local haciendo clic en todo lo que se abre, con la consola abierta y en
    celular.
  - Todo permiso se prueba forjando la petición.
  - Tinta es obligatorio (`structure.md` §9).

---

## 6. Checkpoints: donde se corre la suite completa

Entre checkpoints, `main` recibe pushes de varias sesiones y el CI de cada push puede quedar cancelado por el
siguiente (`cancel-in-progress`): es **alarma, no reja**. Si alguien ve un CI terminado en rojo con un commit
suyo, lo arregla antes de seguir. La validación de verdad es el checkpoint.

**Cuándo:** dos al día (mediodía y cierre), y además antes de aplicar una migración y antes de cualquier escritura
grande en producción (el `--aplicar` del 078, el corte).

**Cómo** (lo corre Mani o quien él diga):

1. Avisar "checkpoint" a todas las sesiones: nadie empuja hasta que termine. Un push en medio cancela el CI y
   reinicia el reloj (~8 min).
2. Esperar el CI del commit de la punta de `main` (`gh run watch`).
3. **Verde:** marcar el punto con un tag, `cp-AAAAMMDD-N` (`git tag cp-20261002-1 && git push origin
   cp-20261002-1`). Después, en el mismo commit de coordinación: el tracker al día con las notas de cierre de los
   tickets, **una** entrada de handoff por checkpoint, el deploy correcto (`vercel ls` + `vercel inspect`),
   producción sana (las fuentes de la tab Programa dicen "recibiendo", sin sobres crudos con error) y la ola rearmada (§4).
4. **Rojo:** el culpable está entre el tag anterior y la punta (`git log cp-...-N..HEAD`). Como cada sesión
   empujó con su nivel 1 en verde, casi siempre es un choque entre dos tickets. Se corre en local el archivo que
   falla, se ubica el commit y lo arregla su sesión. Nadie empuja a `main` hasta el verde; las demás sesiones
   siguen trabajando en su worktree.

**Por qué así y no PR por ticket:** Mani prefirió el push directo (1-oct). El precio, dicho claro: entre dos
checkpoints producción puede servir código que la suite completa no ha validado, porque Vercel despliega cada
push. Lo mitigan el nivel 1 obligatorio, que las migraciones solo se aplican en un checkpoint, y que el
checkpoint cae como máximo medio día después. Si un rojo llega a producción y rompe algo, se pasa a PR por
ticket (el CI ya corre en cada PR sin cancelarse entre ellos).

**Lo que acelera los checkpoints:** el [150] (la base de prueba migrada una vez por corrida, no una vez por
archivo): hecho el 1-oct, `npm test` en el CI bajó de 372 s a 274 s (-26%). Sigue pendiente el CI también en ramas.

**Cerrar un ticket** (lo hace su sesión, en el archivo del ticket):

- [ ] Su "Done cuando" marcado, `status: done` y una nota de cierre (qué se hizo, qué se decidió, qué quedó).
- [ ] Nivel 1 en verde y empujado; si tuvo migración, aplicada en producción con el ok de Mani.
- [ ] Un ADR por cada decisión de arquitectura, y la decisión salió de `plan.md` §7.
- [ ] `AGENTS.md` al día si cambió un comando o una convención.

El tracker lo marca Mani en el siguiente checkpoint verde. **Un ticket no cuenta como hecho hasta ese
checkpoint.**

---

## 7. Las decisiones, por etapa y por ola

Son las de [`plan.md`](./plan.md) §7, ordenadas por cuándo frenan. Propuesta: una sola reunión con los
closers durante E1 que cubra E2 a E5; Gerencia durante E4; Pauta durante E5.

| Antes de | Qué | Quién |
|---|---|---|
| **O1 → 142** | ✅ ~~QM-10~~ (ADR 0070) · **manual de gestión comercial** (QD-8) · QM-12 (cortesías) · confirmar QD-2 | Mani · Alejo |
| O1 | Aplicar la 0057 · las dos decisiones del [129] · quién toma el [140] | Mani |
| E7 | 🆕 **El ROAS sin TRM de la cohorte** (la 0057 la quita; el ADR 0063 la usa): `plan.md` §7 | Mani |
| E1 | §3 de este documento; base local sí o no (113) | Mani |
| ~~E1~~ | ~~ROAS, Juanito, consolidados de C2~~ ✅ respondidas por Mani el 28-sep (`plan.md` §7.E) | Mani |
| E2 | ~~D3 · A5~~ ✅ · K2 (dónde se asigna la llamada suelta, `plan.md` §7) | Mani |
| ~~E2~~ | ~~De quién es el deal si agenda con otra closer~~ ✅ de esa closer (Mani, 28-sep) | Mani |
| E3 | ~~A4~~ ✅ · ~~tasa COP→USD~~ ✅ descartada, solo USD | Mani |
| E3 | ~~Hasta cuántos días atrás migrar Setteo~~ ✅ decidido por Mani · K1 ("buscar llamada" en la Ficha del Deal o se retira) | Mani |
| E4 | ~~Pregunta de ingreso y bandas~~ ✅ score del formulario; ~~X días~~ ✅ 3 días hábiles por defecto configurable; ~~estudiante desde cuándo~~ ✅ abonado o completo por cohorte/programa; ~~quién hace onboarding~~ ✅ dueño, gerente o developer | Closers / Mani |
| E5 | ~~Precio de lista de ComunicArte~~ ✅ 797 (Mani, 28-sep) · fecha del corte | Closers |
| E5 | 🚨 Supabase Pro, por los respaldos (S1) | Equipo |
| E6 | Área de cada canal y su nombre visible (PQ7) · ~~caja y comparativo para el paid trafficker~~ ✅ DP-12 · ~~P2~~ sin objeto · ~~D5~~ ✅ · ~~DP-25~~ ✅ | Gerencia · Mani |
| E6 | Cuentas publicitarias, moneda y zona horaria (PQ1) · token de Meta · ~~`utm_id` y `fbclid`~~ ✅ `utm_id` por macro (ADR 0062) | Pauta |
| E7 | Conversión, ritmo, desfase y objetivos (PQ3, PQ4) · cortesías (PQ5) · checkouts · el 26% sin UTM de Tactical | Pauta · Mani · Gerencia |
| E8 | Convención del orgánico (PQ6) · umbrales que falten (no bloquea) | Pauta y Media · Gerencia |
| E9 | Formato del comprobante | Closers |

---

## 8. Mantener este documento

- Cambia cuando cambia el reparto o la ola. El avance de cada ticket no se anota aquí: va en su archivo y, en el
  checkpoint, en el tracker.
- En cada checkpoint verde, Mani rearma la ola de §4: saca lo cerrado, mete lo que quedó listo, reasigna los
  archivos calientes y revisa que la cola de migraciones siga en orden.

[007]: ./tasks/007-onboarding-closer-id.md
[021]: ./tasks/021-snapshot-del-dashboard.md
[035]: ./tasks/035-comprobante-link-o-foto.md
[048]: ./tasks/048-una-sola-funcion-de-ingesta.md
[049]: ./tasks/049-el-envio-con-todas-las-columnas.md
[050]: ./tasks/050-identidad-del-lead.md
[057]: ./tasks/057-calls-colgadas-del-deal.md
[058]: ./tasks/058-grain-significa-que-la-llamada-sucedio.md
[059]: ./tasks/059-no-show-y-cancelada-van-a-reagenda.md
[060]: ./tasks/060-abonos-sobre-el-deal.md
[061]: ./tasks/061-cuotas-pactadas-y-cartera-vencida.md
[062]: ./tasks/062-comision-calculada.md
[063]: ./tasks/063-onboarded-at-y-cambio-de-cohorte.md
[064]: ./tasks/064-dashboard-sobre-deals.md
[065]: ./tasks/065-funnel-por-etapa.md
[066]: ./tasks/066-replica-de-urgencias.md
[067]: ./tasks/067-roas-por-cohorte-y-captura-de-pauta.md
[068]: ./tasks/068-nerd-stats-reescrito.md
[069]: ./tasks/069-kanban-por-programa.md
[070]: ./tasks/070-pendiente-setteo-y-unclaimed.md
[071]: ./tasks/071-mi-dia-del-closer.md
[072]: ./tasks/072-base-de-leads-con-filtros.md
[073]: ./tasks/073-ficha-del-lead.md
[074]: ./tasks/074-ficha-del-deal.md
[075]: ./tasks/075-revision-profunda-de-la-ui.md
[076]: ./tasks/076-bitacora-en-nerd-stats.md
[077]: ./tasks/077-barrer-las-pestanas-de-gestion.md
[078]: ./tasks/078-la-migracion-pasa-por-la-misma-ingesta.md
[079]: ./tasks/079-recuperar-las-55-de-forms-viejo.md
[080]: ./tasks/080-los-casos-raros-de-la-migracion.md
[081]: ./tasks/081-cop-a-usd-en-la-migracion.md
[082]: ./tasks/082-apagar-las-pestanas-de-gestion.md
[083]: ./tasks/083-catalogo-de-areas.md
[084]: ./tasks/084-campanas-y-el-patron-utm.md
[085]: ./tasks/085-el-emparejador-determinista.md
[086]: ./tasks/086-origen-humano-y-enlace-de-captacion.md
[087]: ./tasks/087-el-cpl-deja-de-preguntar-por-entrada.md
[088]: ./tasks/088-registros-vs-agendas-por-canal.md
[089]: ./tasks/089-series-con-dimensiones.md
[090]: ./tasks/090-rendimiento-por-area.md
[091]: ./tasks/091-otros-programas-del-correo.md
[092]: ./tasks/092-url-del-formulario-y-generador-de-links.md
[093]: ./tasks/093-filtros-utm-con-lo-que-ya-hay.md
[095]: ./tasks/095-dashboard-con-selector-y-todos-los-programas.md
[096]: ./tasks/096-calendly-cuelga-llamadas-de-deals.md
[097]: ./tasks/097-navegacion-por-objetos-y-selector-de-programa.md
[098]: ./tasks/098-tab-calls.md
[099]: ./tasks/099-tab-students-por-cohorte.md
[100]: ./tasks/100-tab-programs-ficha-del-programa.md
[101]: ./tasks/101-catalogo-de-canales.md
[102]: ./tasks/102-rol-paid-trafficker.md
[105]: ./tasks/105-la-fuente-webhook.md
[110]: ./tasks/110-la-salud-del-crm.md
[115]: ./tasks/115-el-origen-es-del-envio.md
[116]: ./tasks/116-las-utm-completas-en-el-envio.md
[117]: ./tasks/117-los-estados-de-llegada-por-tabla-y-los-parciales.md
[118]: ./tasks/118-se-perdio-en-el-calendly.md
[119]: ./tasks/119-la-conexion-con-meta.md
[120]: ./tasks/120-la-pauta-de-meta-por-anuncio-y-dia.md
[121]: ./tasks/121-el-area-declarada-por-el-closer.md
[122]: ./tasks/122-los-objetivos-de-la-cohorte.md
[123]: ./tasks/123-el-embudo-de-pauta-y-los-costos-por-etapa.md
[124]: ./tasks/124-el-cumplimiento-de-la-cohorte-por-area.md
[125]: ./tasks/125-la-tab-campanas-con-el-arbol-de-meta.md
[126]: ./tasks/126-el-embudo-del-formulario.md
[128]: ./tasks/128-alertas-del-deal.md
[129]: ./tasks/129-dashboard-motivos-y-origen-vacios.md
[132]: ./tasks/132-valor-vendido-del-deal.md
[133]: ./tasks/133-comision-por-porcentaje-congelado.md
[134]: ./tasks/134-ticket-base-de-la-cohorte-y-adios-productos.md
[135]: ./tasks/135-atendido-sin-grain.md
[136]: ./tasks/136-selector-de-periodo-y-numero-y-porcentaje.md
[137]: ./tasks/137-toda-cifra-abre-su-lista.md
[138]: ./tasks/138-deals-creados-contra-agendas.md
[139]: ./tasks/139-ficha-del-deal-por-bloques.md
[140]: ./tasks/140-crear-un-deal-a-mano.md
[141]: ./tasks/141-filtros-de-fecha-relativos-en-listas.md
[142]: ./tasks/142-las-etapas-de-30x.md
[143]: ./tasks/143-etiquetas-y-propiedades-por-etapa.md
[144]: ./tasks/144-proxima-fecha-de-pago-y-cartera.md
[145]: ./tasks/145-rol-customer-success-y-onboarding.md
[146]: ./tasks/146-meta-del-mes-y-pagina-de-metas.md
[147]: ./tasks/147-alertas-por-persistencia.md
[148]: ./tasks/148-las-secciones-del-dashboard.md
[149]: ./tasks/149-manual-de-uso-por-rol.md
[150]: ./tasks/150-tests-rapidos-base-migrada-una-vez.md
[160]: ./tasks/160-marcar-una-cortesia.md
[161]: ./tasks/161-alerta-de-tres-intentos.md
[162]: ./tasks/162-transicion-unica-y-botones-de-etapa.md
[163]: ./tasks/163-detalle-de-llamada.md
[164]: ./tasks/164-mi-espacio-el-hub-del-closer.md
[165]: ./tasks/165-la-siguiente-cohorte.md
[166]: ./tasks/166-plataformas-de-pago-visibles.md
[167]: ./tasks/167-quien-cobro-es-una-fk.md
