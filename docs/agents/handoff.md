# Handoff — Retia Metrics

> Session memory + roadmap. Read at session start, update at session end.
> The roadmap is a DAG: a task is only **ready** when its dependencies are done.

## Prompt para arrancar la próxima sesión

> Copiar y pegar tal cual. **Reescrito corto el 1-oct (sesión de Mani: olas y checkpoints).** El largo, que
> acumulaba las sesiones 53 a 68: `git show df6b1be:docs/agents/handoff.md`. Lo de cada sesión sigue en Memory.

```
Seguimos con el CRM de Retia. Lee AGENTS.md y despues docs/plan-reparto.md §1, §4, §5 y §6: desde el 1-oct
se trabaja por OLAS de tickets listos, cada uno con varias sesiones (una sesion = un ticket = un worktree).
Solo se ordenan tres cosas: la COLA de migraciones (una a la vez, la aplica la sesion principal de Mani con
su ok), los ARCHIVOS CALIENTES (un dueño por ola: motor, dashboard, regla-de-deals, schema) y las
DECISIONES (un ticket bloqueado no entra). El estado vive en el archivo de cada ticket y, tras cada
checkpoint verde, en docs/tasks/README.md.

Tests: nivel 1 antes de cada push (typecheck, lint y los tests del ticket; nunca la suite completa en local).
Push directo a main. La suite completa la valida un CHECKPOINT dos veces al dia (plan-reparto §6): nadie
empuja mientras corre; verde = tag cp-AAAAMMDD-N; rojo = el culpable esta entre el ultimo tag y la punta.

Ola vigente: O1 (plan-reparto §4). Camino critico de la v1 comercial: el 142, DESBLOQUEADO el 2-oct (ADR 0070 y
0071; el metodo es el ciclo de vida de 30X, docs/manual-gestion-comercial.md §0, con M-1 a M-6 por contestar antes), y del 142 cuelgan 143, 128,
118, el 117 enmendado (ADR 0069), el --aplicar del 078, el corte y el 148. Cola de migraciones: 0057 aplicada;
sigue el 142 al frente, despues 092 (ADR 0068) -> 102. Abierta para E7: A12, el ROAS sin la TRM de la
cohorte (plan.md §7).

Antes de una pantalla: docs/structure.md §9 (Tinta) y docs/anotaciones.md. Produccion es la unica base:
leer es libre, escribir pide el ok de Mani.
```

## Memory

- **2026-10-01 (Mani, sesión 69): 132 en producción; el closer escribirá el descuento (enmienda del ADR 0065).**
  - **Hecho:** 132 en `main` (`27583bb`). Migración 0053 (`deals.valor_vendido_usd`, CHECK >= 0) aplicada en
    producción con ok de Mani. `saldo.ts` lee el valor vendido (siempre USD; `sin_valor_vendido`); el motor lo
    exige en toda flecha a Abonado/Completo (históricos exentos); el abono se rechaza sin valor; Editar deal no
    lo baja de lo abonado (mensaje con las dos cifras) ni lo toca en Completo; un 0 se guarda `null`.
    **Compromiso Verbal (T4, T12, T25) ya no pide producto** (Mani) y el requisito `producto` desapareció del motor.
    Codex implementó; suite 1.857 en verde, build limpia, recorrido en `dev:local` (Compromiso Verbal sin producto,
    abono bloqueado sin valor, 797 − 500 = 297 y paso solo a Abonado, bajar a 400 rechazado; consola limpia).
  - **Decidido (Mani):** valor vendido = precio al que se cerró; lo pagado = suma de abonos (ya son actividad).
    Pero el closer no teclea el valor: teclea el **descuento** y el motor congela `valor = precio de la cohorte −
    descuento`. Enmienda en el ADR 0065; se construye en el **134**. Confirmado por Mani: sin cohorte o cohorte
    sin precio, no se vende.
  - 🩸 **Codex corre solo los tests que toca:** 12 fallaron en 6 archivos que armaban el saldo con producto. La
    suite completa la corre siempre la sesión principal antes del merge.
  - **Abierto:** un deal en Abonado cuyo valor se edita hasta igualar lo abonado queda con saldo 0 sin pasar a
    Completo (solo un abono lo dispara). Cortesía (QM-12). `docs/insumos/reu-danieltovar.md` recortado (`fe7b026`),
    sigue en el historial de git.
  - **133 hecho el mismo día** (`3101c80`): 0054 en producción (`comision_porcentaje` en programs y deals,
    CHECK 0-100). `moverEtapa` copia el % del programa al entrar a venta si el deal no tenía; `comisionesPorCloser`
    suma los mismos deals que la columna de cierres; ventas sin % o sin valor van aparte ("N sin % o sin valor").
    Recorrido local: 10,04 guardado; venta nueva de 1.000 = USD 100,40; programa a 5% y la venta sigue en 100,40.
    **Falta:** cargar 10,04 (ComunicArte) y 6,67 (Tactical) en producción desde `/ajustes/programas`, y la
    migración que quita `programs.comision_por_venta_usd` (el código ya no la lee). Un closer cuyas ventas son
    todas sin % muestra "USD 0,00 · N sin %": se lee bien con la nota, pero se puede pulir a "—".
  - **0055 aplicada** (código primero, después la migración): `comision_por_venta_usd` ya no existe. Un closer
    sin ninguna venta con % muestra "—", no USD 0. Mani cargó 10,04 y 6,67.
  - **134 hecho** (`295cdaa`, 0056 en producción): el ticket sale de la cohorte, el closer teclea el descuento y
    el motor congela `valor_vendido_usd`; el primer abono congela con descuento 0; todo deal nace en la cohorte
    activa; `cambiarCohorte` sirve para cualquier deal; cambiar el descuento de una venta (también Completo) exige
    motivo, deja nota y reconcilia Abonado/Completo; `productos` fuera del código y de la base. 🩸 El SQL de
    drizzle borraba la tabla con CASCADE y después sus FK (habría fallado): reescrito, columnas primero.
  - **Datos (con ok de Mani):** 208 deals sin cohorte → C2 (script con rastro y nota); Mani creó las C3 y 214
    deals vivos (ninguno con abonos) pasaron a la C3 por `cambiarCohorte` con motivo. Ojo: la C3 de ComunicArte
    tiene inicio de ventas el 22-oct estando activa el 1-oct; confirmar con Mani.
  - **TRM retirada (Mani):** fuera del formulario, del catálogo y del esquema de cohortes; las tarjetas de
    cohorte muestran "ventas inicio → fin · clases". **La migración 0057 (DROP `cohorts.trm_cohorte`) está
    commiteada pero NO aplicada:** aplicarla cuando Vercel sirva este commit (la columna tiene default 4000, así
    que dejarla un rato no rompe nada). Lint, typecheck y build limpios; la suite local no terminó (ver abajo) y
    la valida el CI de este push. Mani corrigió la fecha de inicio de ventas de la C3 de ComunicArte.
  - 🩸 **La suite completa local ya no es sostenible:** se cortó 3 veces a los 480 s. Causa medida: la Mac con
    16,5 GB de swap de 17,4 (7 días sin reiniciar) más ~92 archivos que levantan PGlite y aplican las 57
    migraciones cada uno. Mani: *"NO SE PUEDEN CORRER MÁS FULL SUITES"*. Desde ahora: local solo los archivos
    del cambio; la suite completa la corre el CI. Propuesta abierta (ticket por crear): volcado migrado UNA vez
    por corrida en `globalSetup` (hoy es una vez por archivo, ~850 ms × 92), `vitest --changed` como bucle local
    y CI también en ramas.
  - **Arreglo del CI empujado** (`3fd1340`): el fixture del test de concurrencia ahora le da al deal su valor
    vendido (1.000); la reja del sobrepago no se tocó. Lo verifica el CI (en local no hay Postgres prendido).
    Si sale rojo, es la primera tarea. La regla nueva de tests quedó en `AGENTS.md` (Feedback loops).
  - 🔴 **CI EN ROJO desde el 132** (todo `main` desde las 18:47 del 1-oct): falla SOLO
    `tests/abonos-concurrencia-postgres.test.ts` ("dos conexiones abonan 600 sobre un saldo de 600", espera un
    abono y entran 0). Ese test corre solo con `DATABASE_URL_PRUEBA_POSTGRES` (en local se salta, por eso nadie lo
    vio): su fixture no le da valor vendido ni cohorte con precio al deal, y desde el 132/134 el abono se
    rechaza. Casi seguro es el fixture, no la reja; arreglarlo PRIMERO y correr ese archivo contra la base de
    Docker (`DATABASE_URL_PRUEBA_POSTGRES` apuntando a ella), no la suite.
  - **Siguiente (NC1):** CI en verde (arriba); aplicar la 0057; 135 (Atendido sin Grain) y 139 (ficha por bloques).

- **2026-10-01 (Alejo, sesión 68): recorridos de 072 y 117, plantilla de PR, 126 parte A y 088.**
  - **072:** recorrido con clics en la base local: los filtros cuadran con la base, separar y confirmar, selector de
    fecha, claro/oscuro, consola, ningún correo en una URL. Falta 390 px en vivo (la ventana maximizada no se achica y
    los popups están bloqueados). Dos duplicados sembrados SOLO en la base local (tokens `recorrido-072-*`).
  - **117, recorrido de Estados de llegada** (`bdaa392`): un valor con fila INACTIVA ofrecía "Crear Estado" y chocaba
    con el índice; ahora la consulta trae `inactivoId` (misma llave) y la pantalla ofrece Reactivar. El formulario
    quedaba bajo el encabezado fijo: `md:scroll-mt-28`, también en Canales.
  - **Plantilla de PR** al día con la tabla de Contratos del 1-oct (`06aead6`).
  - **126 parte A** (`66e4472`): `embudoDelFormulario` y su tarjeta en el dashboard. Llegó al Calendly = agendó o
    `lead_quality` High (ADR 0069), NO la variable `estado`; `analytics.md` §6 actualizado. La parte B espera la
    migración del token de Typeform.
  - **088 done** (`4ff4f79`): reagrupa la serie de `pautaInterina` por canal, con área y tasa; no puede discrepar de
    la tarjeta del 093.
  - 🩸 Con la pestaña de Chrome oculta, el scroll suave no corre y las capturas se cuelgan: medir con `javascript`,
    no es un bug. Y la suite con `dev:local` y Chrome abiertos pasa de 480 s: cerrarlos antes de `npm test`.
  - ⚠️ 126A y 088 son de pauta y se hicieron antes de ver el orden nuevo de Mani (NC1-NC3 primero). No tocan etapas
    ni dinero.
  - **Siguiente:** la lista de Alejo de arriba (NC1): 072 a 390 px, reproceso del 117 con ok de Mani, manual de
    gestión comercial (QD-8).
- **2026-10-01 (Mani, sesión 67): QD contestadas y paso 6 hecho; el orden pasa a NC1, NC2 y NC3.**
  - **Contestado (Mani, en nombre del equipo comercial):** QD-1 a QD-12, tabla en `comercial.md` §7.0. Lo
    que cambia el plan: las etapas se definen como en `insumos/hubspot-30x-workflow.md` §3; Pendiente
    Re-agenda, Seguimiento y Próxima Cohorte son **estados dentro del deal**, no etapas (Dani); las
    etiquetas de 30X no se usan, solo Lead Value y Lead Quality (el 143 se encoge); toda obligatoria vacía
    es alerta roja (un nivel); comisión 10,04% ComunicArte y 6,67% Tactical (dato del 133); alertas a 5
    hábiles configurables; "corte" es Cohorte (el vocabulario ya decía evitar "corte"); el manual de
    gestión comercial lo escribe **Alejo**; la configuración de la app (programas, precios, cohortes) la
    hacen los usuarios por rol, y al final va un **manual de uso por rol** enlazado en el CRM (ticket **149**,
    nuevo, E9); el nivel de contacto sale de la actividad y vive en el hub del closer (071, 075).
  - **Paso 6 hecho:** `plan-reparto.md` §4 con las etapas **NC1** (dinero), **NC2** (etapas de 30X, 078 y el
    corte, que se muda de E5) y **NC3** (dashboard comercial = v1 comercial); E6 cierra con los cabos del
    117; 118 pasa a NC2, 119/120/102 a E7, 082 a NC3. `plan.md` §5 apunta ahí. Tracker: paso 6 done, paso 3
    en curso, 142/143/147 con sus bloqueos nuevos (QM-10, QD-8, QM-11), 149 agregado.
  - **Abierto (de Mani):** QM-10 (cómo se modela un estado dentro del deal; bloquea el 142), QM-12
    (cortesía: deal al 100% de descuento o estudiante sin deal; las dos chocan con el ADR 0065 y el 0037;
    recomendado: deal con valor 0 y marca de cortesía), QM-11 (qué métricas llevan alerta), confirmar el
    destino de la QD-2 (propuesta: descartados y setteo a En gestión, cerrados a Ganado según saldo; los
    descartados se intentan recuperar con un masivo de Kapso, fuera del CRM), si el 140 pasa a Alejo, y
    GC-17 con 2 o 3 closers.
  - ⚠️ **Sin revisar:** el commit `32ce4d1` metió `docs/insumos/reu-danieltovar.md`, que según la sesión 62
    traía otra reunión con datos personales (salario, inversiones). Revisarlo y recortarlo; si es sensible,
    un commit nuevo no lo saca del historial.
  - **Siguiente:** `/delegate` del 132 (`high`, migración).

- **2026-10-01 (Alejo, sesión 66): 138 y 141 en producción; el 140 es de Mani.**
  - **Hecho:** 138 (gráfica deals creados contra agendas, acumulado por hábil A contra B; métricas
    `deals_creados` y `agendas_creadas` en el 137) y 141 (filtros de fecha en Deals y Leads con el selector en modo
    solo A). Sin migraciones. Empujados: `335ef79` y `45cb2b0`. Revisó un subagente de Claude (Codex sin cuota) y
    sus hallazgos se aplicaron; recorrido con clics reales en `dev:local`.
  - **Definiciones nuevas, una sola vez:** deal creado = fecha del envío de origen o su alta
    (`fechaAnclaDealCreado`); agenda creada = `calls.created_at` (`fechaAnclaAgendaCreada`, también Pauta); cierre
    = primera entrada a Abonado/Completo/Cierre Perdido tras la última reapertura (`cerradosEn`, en memoria: el
    guardián de vigencia no lee subconsultas con alias); última actividad en `lib/queries/ultima-actividad.ts`
    (Inbox y lista; la lista ignora citas futuras).
  - 🩸 **Dos bugs que solo salieron en el navegador:** la tabla `sr-only` de `SeriesLineales` desbordaba la página
    (una `<table>` no respeta `width:1px`; va dentro de un `div`) y un `<title>` de SVG con varios nodos rompía la
    hidratación de React 19 (un solo string).
  - **Herramientas:** `TaskStop` sobre `npm run dev:local` deja huérfano a `next` (matar el árbol con
    `taskkill /T`); el computer tool de Chrome mide en el marco de la captura, no del viewport.
  - **Siguiente:** la lista "LO QUE LE FALTA A ALEJO" en el carril de arriba; empezar por el 072.
- **2026-10-01 (Mani, sesión 65): Dapta de punta a punta; 130 cerrado; ADR 0068 y 0069.**
  - **Hecho:** la "migración ajena" ya la había resuelto Alejo (0051 y 0052 cuadran por hash y `created_at`). 130
    cerrado con seis envíos reales en ComunicArte (tabla en el ticket). 🩸 **Las UTM de Dapta se perdían todas**: el
    adaptador leía `utm.source` y Dapta manda `utm.utm_source` (y `utm.utm_id` nativo); el fixture sintético tenía la
    forma inventada y el contrato pasaba. Arreglado (`7d6c04d`), verificado en producción, y el contrato de
    proveedores ahora pasa un **cuerpo REAL** de cada proveedor por la ruta real y exige en la base todas las UTM y
    todos los campos intactos (`f435a66`, muerde). Firma falsa contra producción: 401 y la base quieta. Deals de
    prueba anulados por `anularDeal` con motivo.
  - **Typeform de ComunicArte (con ok de Mani):** la única regla que aún mandaba `descartado` (inversión "No") manda
    `setteo_no_calificado`. `descartado` apagado en `estados_llegada` de los tres programas (por el molde, con rastro).
  - **Decidido (Mani):** **ADR 0068** (A11): el link de captación sale de la fuente, una principal por programa;
    `programs.form_url` se retira en dos pasos; se construye en el 092 (enmendado). **ADR 0069:** el formulario deja de
    mandar `estado`; manda agenda, calidad y valor, y el CRM enruta con la regla de 30X (parcial sin calidad →
    Potencial, Low/Mid → Registrado, High → Calificado, agendó → Agendado); el puntaje es UN estándar para todo
    formulario (`docs/dapta/README.md`). Se construye con las etapas de 30X (lote 2), no antes.
  - 🧪 **Dapta:** el `label` del outcome es a la vez el título de la pantalla final y lo que manda el webhook; por eso
    los redirects. `data.agenda` llega como `"booked"`. La completa puede llegar antes que la parcial.
  - **Pendiente:** (1) Mani manda el mensaje a Dapta (token de solo lectura, `inviteeUri` y el `id` del outcome); con
    el `id`, cambiar el generador para que el título sea texto normal y quitar los redirects; hasta entonces no se
    reparte el link de Dapta. (2) Memorable sin Calendly: recomendado despublicar hasta configurarlo (link en el
    generador, token en `/ajustes/programas`, Calendly en Dapta, webhook 096, activar). (3) Construir el ADR 0069 con
    el lote 2. (4) El 092 con el ADR 0068.

- **2026-10-01 (Alejo, sesión 64): el 117 en producción y dos 0050 a la vez; después 136 y 137.**
  - **Qué pasó:** Mani aplicó su 0050 (130/131) minutos antes que la del 117, que también se llamaba 0050. Las dos
    quedaron aplicadas (filas 51 y 52) y no se pisan. La del 117 se renumeró a **0051** con el SQL byte a byte (mismo
    hash) y un `when` nuevo; la fila 52 de `drizzle.__drizzle_migrations` se alineó a ese `when` con el ok de Alejo.
    Es la "migración ajena" que anotó Mani en la sesión 61: resuelta.
  - 🩸 **Choque de lógica entre 117 y 130, cazado por la matriz del webhook:** la plantilla del programa (títulos de
    Typeform, la siembra del 117) vale para TODAS sus fuentes y pisaba la llave fija `email` de Dapta: ningún envío
    de Dapta de ComunicArte habría tenido lead, sin error. Ahora el adaptador de Dapta busca lo configurado y cae a
    sus llaves fijas; exigir el correo configurado es por proveedor (`correoPorDefecto` en `proveedores.ts`). El
    guardián B4 nombra a `adaptador-dapta.ts` como excepción. Test en `tests/adaptador-dapta.test.ts`.
  - **Ventana revisada:** entre la plantilla (04:42 UTC) y el deploy (14:05 UTC) no llegó ningún envío real de Dapta
    (solo las 4 pruebas, anteriores) y Typeform ingirió 19 sobres sin error.
  - 🧪 **Antes de `db:migrate`, `git fetch` y mirar el journal de `origin/main`**, no solo el local: el choque pasó
    porque los dos aplicamos con minutos de diferencia. Y el migrador de drizzle decide por `created_at` (el
    `when` del journal), no por nombre ni hash: una migración con `when` menor que la última aplicada se salta
    sin avisar.
  - **136 hecho** (`562fa09`, `9577160`): implementó Codex en un worktree y revisó Claude. El recorrido visual
    destapó que el disparador del atajo pintaba el valor crudo (`hoy`): Base UI necesita `items` en el `Select`.
  - **137 hecho** (`3bdb2ae`, `cbbd1fb`): Codex se quedó sin cuota a mitad (vuelve el 1-oct 2:28 pm); terminó
    Claude. 🩸 El test de los desgloses mordió un closer partido en dos por mayúsculas (`Ana` / `  ANA  `,
    ADR 0030): agrupar en memoria por el texto crudo repite el bug aunque el SQL agrupe bien. El recorrido destapó
    leads sin conectar, el aviso `nativeButton` de Base UI en botones-enlace, columnas desalineadas y etiquetas
    cortadas a 390 px. Pendientes nombrados en el ticket: la pantalla "todos" (095) y medir con 3.000 filas reales.
  - 🧪 **Worktree con `node_modules` enlazado (junction): los tests corren, Turbopack NO** (`build` y `dev`
    fallan con "Symlink ... points out of the filesystem root"). El recorrido y la build se hacen en el checkout
    principal tras hacer commit en la rama. Y **Next 16 deja UN solo `next dev` por carpeta**: había un
    `dev:local` huérfano del 30-sep en el 3000 (cadena `cmd /c "npx next dev"`); una `next build` en la misma
    carpeta le rompe la caché a un `dev` vivo.
  - **Base local recreada** (`docker compose down -v` + `npm run db:local`): tenía la del 117 con su número viejo y
    quería re-aplicarla. Quien tenga una base de Docker de antes del 1-oct, igual.

- **2026-10-01 (Mani, sesión 63): pasos 4 y 5 del lote 1 del norte comercial hechos.**
  - **Decidido (Mani, `/grill-with-docs`):** ADR **0065**: valor vendido por deal en USD, `null` en la base y 0
    en la pantalla, obligatorio (> 0) al entrar a Abonado o Completo, editable con rastro y nunca por debajo de
    lo abonado; **ticket base = `cohorts.precio_usd`** (QM-2 cerrada: la C1 de ComunicArte fue 697 y la C2
    797); `productos` se retira (0 de 157 deals lo usan); comisión = % del valor vendido, **congelado en el
    deal** al entrar a venta. ADR **0066**: Atendido sin Grain se acepta, cuenta como show, alarma derivada
    sin excepción. ADR **0067**: número y % siempre, periodo A contra B al mismo día hábil con atajos, toda
    cifra abre primero un resumen y, si se confirma, la lista paginada; en "todos", partida por programa.
  - **Abierto:** los deals históricos del 078 en venta se llenan con el ticket de su cohorte; si quedan
    marcados como estimados se decide con el equipo comercial al aplicar la migración.
  - **Tickets:** enmendados 017, 044, 058, 060, 062, 072, 074, 089, 095, 128; nuevos 132 a 141 (lote 1, orden
    en el tracker) y 142 a 148 (lote 2, `bloqueado`). Vocabulario en `overview.md` §11.
  - **Siguiente:** implementar desde otras sesiones, una por ticket, empezando por el 132 (Mani, 1-oct: no se
    implementa en esta sesión; un intento con Codex se canceló sin escribir nada).
    `docs/insumos/*.md` sigue sin commitear a propósito (recortar el de Dani antes).

- **2026-10-01 (Mani, sesión 62): paso 2 del norte comercial hecho; los pasos 3 a 5 se parten en dos lotes.**
  - **Hecho:** HubSpot de 30X leído con 11 pantallazos de Mani (Claude in Chrome no respondió en ninguno de los
    dos Chrome). `comercial.md` §4 lleno (11 etapas, probabilidad, conteos, la nuestra más cercana) y §9 nuevo:
    tablero de Deals, etiquetas, ficha del deal, filtros relativos, Leads, Productos, el inventario de las 18
    gráficas de "Gestión comercial" con su mejora y la propuesta de 4 secciones (Pulso, Operación comercial,
    Dinero, Pauta y origen). Preguntas nuevas QD-8 a QD-12 y QM-9. Tracker y tarea de Notion marcados.
  - **Decidido (Mani):** QM-1, un ticket base por programa; descuentos y pagos en cada deal. Se pueden crear deals
    a mano. Los pasos 3 a 5 van en dos **lotes** por dependencia (`comercial.md` §8): el lote 1 no espera a Dani;
    el lote 2 (las etapas y lo que espera otra respuesta) va cuando lleguen. **"Lote" y no "carril" a propósito:**
    carril es por persona (`plan-reparto.md` §2) y cada lote se reparte con esos carriles.
  - **Pendiente:** mandarle a Dani QD-1 a QD-12 en un solo mensaje (lo manda Mani). Arrancar el lote 1: ADR de
    valor vendido y comisión, Atendido sin Grain y reglas de pantalla; tickets; implementa Codex. Los 11
    pantallazos NO van al repo (datos personales de clientes de 30X); viven en el scratchpad de la sesión y se
    pierden si Mani no los guarda. `docs/insumos/reu-danieltovar.md` y `reu-pauta.md` quedaron sin commitear: el
    de Dani trae otra reunión (entrevista con salario, inversiones personales); recortarlo antes de commitear.

- **2026-09-30 (Mani, sesión 61): Dapta Forms entra al CRM por un contrato estándar; 131 cerrado, 130 en código.**
  - **Hecho:** `lib/ingesta/proveedores.ts`, el registro de proveedores (firma + adaptador; la ruta y el reproceso
    lo consultan), `lib/ingesta/adaptador-dapta.ts` y `tests/contrato-proveedores.test.ts` (mismas reglas para todo
    proveedor; muerde, comprobado). Migración 0050 (`dapta` en el enum, sin el índice de una fuente activa)
    aplicada; código en producción (`9374bc8`). Implementó Codex; dos bugs suyos los cazaron los tests reales:
    el defecto de la HOJA en `mapeoWebhookDesdeFuente` pisaba el `email` de Dapta (ningún lead se creaba) y
    `visit` con página `null` botaba el envío. Memorable creado (inactivo) y fuentes Dapta inactivas en
    ComunicArte y Memorable (ids en `docs/dapta/README.md`). Los dos borradores de Dapta re-subidos.
  - **Decidido (Mani):** `lead_quality` en el outcome; la cita la cuelga el webhook de Calendly, no se busca por
    hora; value = texto; varios formularios activos son permanentes (el link de captación queda como A11); A9
    cerrada: el webhook alcanza, se le pide a Dapta un token de servicio de solo lectura y el `inviteeUri`
    (borrador del mensaje en la sesión; lo manda Mani). **No se publica Dapta antes del 117.**
  - 🩸 **Alguien aplicó en producción una migración que no está en ningún repo** (fila 52, hash `28fc7b38…`,
    `when` 1790790430487, entre la 0049 y la 0050). Casi seguro es la del 117 (Alejo): su archivo también se
    llamará `0050_…` y chocará con la nuestra en el journal al integrar. Renumerarla a 0051 sin re-aplicarla.
  - **Después (misma sesión):** el botón "enviar prueba" de Dapta manda un parcial real firmado con
    `sample@example.com`; habría creado un lead falso en producción. `esEntregaDePrueba` lo rechaza (200, sobre
    con error, sin lead) y `tests/webhook-matriz.test.ts` lo cubre (muerde). Mani genera el secreto en
    `/ajustes/fuentes` el 30-sep, deja las dos fuentes Dapta activas con mapeo vacío y manda las dos pruebas:
    firma buena y 200, sobre con el error de prueba, cero envíos y cero leads. Es el primer payload real de
    Dapta (`tests/fixtures/dapta-prueba-real.json`) y pasó el schema del adaptador.
  - ⚠️ **Mani publicó los dos formularios el 30-sep con los placeholders puestos** (Calendly y redirects; ver
    `docs/dapta/README.md`). Las pruebas con el form publicado también se rechazaron bien. No compartir los
    links hasta reemplazarlos y tener el 117.
  - **Cierre de la sesión (30-sep, tarde):** Mani conectó Calendly en Dapta y publicó ComunicArte con el Calendly
    real (`eventoscomunicarte-info/postulacion-comunicarte`, verificado en vivo). El CRM no guarda el link de
    Calendly: usa el token y el webhook (`docs/operations.md` §2.1, la guía nueva de configurar un programa).
  - **Pendiente, en orden:** (1) **117** (sin él, un calificado de Dapta entra sin deal); (2) los redirects finales
    de los dos formularios siguen en `example.com/REEMPLAZAR-*` (decisión de Mani: páginas de gracias propias o
    pedirle a Dapta mostrar el mensaje sin la etiqueta del outcome); (3) **Memorable publicado sin Calendly**:
    despublicar o conseguir su Calendly y token; (4) mandar el mensaje a Dapta (token de solo lectura e
    `inviteeUri`); (5) avisar a Alejo de la migración ajena en producción; (6) después del 117, los 7 envíos reales
    del ticket 130; (7) A11 (de dónde sale el link de captación con varios formularios).


- **2026-09-30 (Mani, sesión 60): reunión con Gerencia; el norte comercial pasa a ser la prioridad.**
  - **Qué pasó:** Dani y Michael pidieron llevar la operación al modelo de 30X (etapas, etiquetas y propiedades
    del HubSpot de 30X) y tomar el dashboard "Gestión Comercial" de 30X como referencia, más flexible. Mani: es
    **fuente de verdad** y es la **prioridad**. Granola `d0eae6e8-64fd-4a87-83f4-57770f03b64f`; su resumen se
    equivoca en dos cosas (dice "HubSpot" por el CRM de Retia, y que el valor *base* es 0 cuando es el valor
    *vendido*). Fuente principal: el transcript que pegó Mani.
  - **Hecho:** `docs/comercial.md`, el inventario punto por punto (GC-01 a GC-53), lo que reabre (R-1 a R-12),
    las metas como las explicó Dani con las cuentas (§5) y las preguntas QD-1 a QD-7 (Dani) y QM-1 a QM-8
    (Mani). Punteros en `AGENTS.md`, `plan.md` §4.5, §5 y §7 (bloque G), `plan-reparto.md` y el tracker
    (sección "Norte comercial", arriba de todo). Tarea en Notion con prioridad 1. Ningún ADR ni ticket tocado.
  - **Decidido (Mani):** prioridad del norte comercial; el `--aplicar` del 078 espera a las etapas nuevas (el 117
    sigue, porque corrige el bug vivo de Tactical y su columna de etapa se traduce con `deals.etapa`).
  - 🧪 **Tres precios conviven** y la reunión pide uno solo como "ticket base": `programs.ticket_usd`,
    `cohorts.precio_usd` y `productos.precio_usd` (QM-2). Y la comisión de hoy son montos fijos (80 CA, 100 TI):
    en porcentaje son 10,04% y 6,67% (QD-5).
  - **Pendiente:** el paso 2 (leer el HubSpot de 30X, solo lectura) y avisarle a Alejo lo del 078.

- **2026-09-30 (Mani, sesión 59): los formularios pasan a Dapta Forms; tickets 130 y 131, ADR 0064.**
  - **Hecho:** se leyeron por API los dos Typeform y se replicó su lógica en Dapta: el formulario de **ComunicArte**
    (workspace "Eventos ComunicArte SAS") y el de **Memorable en Instagram & TikTok**, programa nuevo (ticket USD
    1.200, rangos de ingreso de Tactical). Los dos quedaron en borrador. Los genera `docs/dapta/generar-base.mjs`
    y se verificaron contra el motor de Dapta: 216 combinaciones por programa, cero diferencias con su Typeform.
    Cómo está armado y cómo se sube: `docs/dapta/README.md`.
  - **Decidido (Mani):** un programa puede tener varios formularios activos a la vez (ADR 0064, enmienda el 0039
    punto 2), para migrar de proveedor sin perder envíos. Se construye en el **131**. El adaptador es el **130**.
  - **Hoy no se rompe nada:** un POST de Dapta recibe 404 (la ruta solo acepta `proveedor = 'typeform'`). El
    riesgo es perder envíos si alguien publica un formulario de Dapta y conecta su webhook antes del 130.
  - 🧪 **La API de Dapta no acepta API key**, solo la sesión del usuario logueado (el token vive en una cookie
    httpOnly del lado de su servidor). Para subir un formulario: crearlo vacío en la interfaz y hacer POST desde
    esa misma pestaña a `/admin/forms/<id>/flush` (la ruta con la que guarda su editor). El CRM no puede llamar
    esa API: A9 en `docs/plan.md` §7.
  - 🧪 **Diferencias del payload que ya están en el 130:** la firma va en hex y no en base64; las respuestas
    llegan por key del paso y no por título; el estado viene en `submission.outcome` como
    `estado|lead_value`; la agenda trae la **hora** de la cita y no el link (la regla del 052 no aplica
    tal cual); con el anti-spam prendido Dapta no manda el parcial.
  - **Pendiente:** las decisiones del 130 y del 131 (A10); el Calendly y las URLs de gracias de cada formulario;
    y las pruebas con envíos reales cuando el 130 esté en producción. Memorable todavía no existe como programa
    en el CRM.

- **2026-09-30 (Mani, sesión 58): 089 cerrado.** Implementó Codex y revisó Claude; detalle en la nota de cierre del
  ticket. 🧪 El guardián de vigencia marca cualquier subconsulta (`.as(...)`) como tabla desconocida: una consulta
  nueva sobre `deals`, `calls` o `abonos` no lee desde una subconsulta; se piden por separado y se unen en memoria
  (así quedó `ventasConDiaEn` al lado de `vendidosEn`). `tests/paginas.test.ts` simula cada consulta que llama una
  página: una consulta nueva en una página necesita su `vi.mock` ahí, o esos tests piden `DATABASE_URL`.

- **2026-09-30 (Mani, sesión 57): 121 cerrado y 089 acotado.**
  - **121:** lo implementó Codex en segundo plano; Claude revisó y corrigió tres cosas que el brief no cubría:
    (1) la validación del área estaba copiada en tres lugares y quedó en `exigirAreaActiva`; (2) el catálogo de
    áreas no contaba `deals.area_declarada_id` como referencia, así que borrar un área usada solo por deals
    habría chocado con la FK en vez de desactivarla; (3) la burbuja filtraba por `deals.created_at` y ahora usa
    `vendidosEn`, la misma venta del dashboard. Detalle en la nota de cierre del ticket.
  - 🩸 **Choque de número de migración:** mientras Codex trabajaba, el 116 de Alejo tomó y aplicó la 0048. La
    del 121 se regeneró como 0049 sobre `origin/main` (rama nueva, cherry-pick del código, `db:generate` de
    nuevo). Dos 0048 distintas en journals distintos no se reconcilian: el merge rompe el journal y el
    snapshot. **Antes de aplicar una migración, `git fetch` y comparar el conteo de
    `drizzle.__drizzle_migrations` con el journal.**
  - **Transacción colgada:** a las 11:26 había una `idle in transaction` de 33+ min con escrituras en `deals`,
    `calls`, `abonos` y `change_log`: el ensayo del 078 (40 min en una sola transacción, ver la entrada de
    abajo). Se esperó a que cerrara antes de aplicar la 0049.
  - 🧪 **El guardián de vigencia marca una tabla importada con alias** (`areas as tablaAreas`) dentro de un
    `.from()`: no la reconoce como tabla del esquema y la trata como posible anulable. Salida: leer por el molde
    del catálogo (lo que hace `exigirAreaActiva`) o usar el nombre del esquema sin alias.
  - **089 acotado con Mani:** la ventana "gratis" se cerró a medias porque el 064 ya escribió `dashboard.ts` con
    escalares. Queda el contrato de la serie y una consulta de hechos del embudo para que el 123, 124, 125 y 095
    se escriban encima; `dashboard.ts` migra cuando ellos lo toquen. Pasa a E6 y depende también del 085.

- **2026-09-30 (Alejo, sesión del 078): ensayo del 078 contra producción, solo ComunicArte; tres hallazgos antes
  de aplicar.** Sesión del 29-sep que armó el 078 de punta a punta (0042, escritor, extractor, importador) y lo
  mergeó; el detalle está en el ticket 078.
  - **Ensayo CA (se deshizo entero, templates del 29-sep):** 696 deals creados, 23 ganados por el deal vivo, 13
    sin lead; 72 abonos (5 sin deal); 69 llamadas colgadas y **235 sueltas**; 466 rarezas. **Tardó 40 minutos en
    UNA transacción.** Tactical no terminó: Claude Code cortó el proceso por falta de memoria de la máquina (no
    es un fallo del script). Verificado después: nada migrado en producción y ninguna transacción colgada.
  - **Tres cosas que resolver ANTES de `--aplicar`:**
    1. **Las sueltas llenarían el Inbox:** `lib/queries/inbox.ts:203` lista toda llamada sin deal sin mirar el
       origen, así que ~235 llamadas de la hoja de CA (más las de TI) saldrían como sueltas por asignar.
       Propuesta: el Inbox muestra solo las de `origen = 'calendly'` (ADR 0049) y las de la hoja se ven como
       rareza. Es del carril de Mani (071): decidirlo con él.
    2. **43 de 77 estudiantes de CA sin producto:** no hay producto USD con su precio exacto (697, 397…); sin
       producto el deal no tiene saldo. Crear esos productos antes de aplicar (depende del precio de lista 797 o
       697, decisión pendiente de Gerencia en E5).
    3. **Rendimiento:** 40 min para CA y TI es casi el doble; `--aplicar` en una sola transacción dejaría bloqueos
       más de una hora con el webhook escribiendo. Como el importador es idempotente, `--aplicar` puede confirmar
       fila por fila (si se corta, se vuelve a correr); el ensayo sí necesita la transacción, pero hay que bajar
       las consultas por fila. Detalle menor: el reporte muestra la fecha del template en UTC (`generadoEn` con
       `slice(0,10)`), no la de Bogotá.
  - `SCRIPT_ACTOR_EMAIL` de Alejo quedó lleno en su `.env.local` (tenía una errata: `davola` → `davila`).

- **2026-09-30 (sesión 56, Alejo): 127, 116, "cohorte pasada" del 080 y los huérfanos de `test.mjs`.**
  - **127 (`87625fe`):** `lib/migracion/deshacer.ts` y `npm run migracion:deshacer`. Se niega si hay trabajo encima;
    lo detecta, entre otras cosas, por una fila de `change_log` de un registro migrado con otra hora que su alta (el
    alta escribe todo en una transacción). Guardián nuevo: solo ese módulo hace `.delete(` sobre deals, llamadas,
    abonos, actividades o historial. Probado en Docker con el template real de Tactical.
  - **080 (`9202161`):** el bloque "Cohorte pasada" es una celda combinada en la `x` de `Estudiantes Septiembre` de
    CA (filas 2 a 13); el extractor lo lee (`cohortePasadaDesde` en `scripts/migrar-gestion.ts`).
  - **`scripts/test.mjs` (`ffe5d6c`):** en Windows el corte mataba solo la shell y dejaba vivos los workers
    (31 procesos de ~500 MB). Ahora `taskkill /T` y barrido de huérfanos al arrancar, filtrado a `node.exe`
    (la PowerShell del barrido se mataba a sí misma).
  - **116 (`1b6186b`, `d12ba57`):** 0048 aplicada con el ok de Mani; relleno verificado (4.612/4.612 y 22/22).
    Costura con el 085: `utmsDelEnvio` leía `id` solo de `respuestas`. El guardián del 085 lleva como excepciones
    nombradas a los cuatro escritores de la ingesta.
  - 🩸 Ruido conocido de la suite: timeouts de ~20 s y fallos internos de PGlite ("invalid page", "relation does
    not exist" en un `beforeEach`); se re-corre el archivo solo. `change_log.campo` guarda el nombre de JS
    (`ownerUserId`). Un error de drizzle imprime los parámetros (correos): filtrar como `mensajeSinDatos`.

- **2026-09-30 (sesión 55, Mani): 085, el emparejador; 084 reemplazado y 087 cerrado.**
  - **084 reemplazado (Mani):** DP-25 lo dejó sin contenido. Sus dependientes se recolgaron: 085 y 092 de 101, 067
    de 120.
  - **Decisión de Mani:** el árbol de Meta (campaña, conjunto, anuncio) entra al emparejador como **dato**
    (`ArbolDePauta`), así el 085 no espera el token de Meta; el 120 solo conecta el cargador. Hasta entonces nada
    llega a N3 y todo `utm_id` sale como `anuncio_desconocido`.
  - **Código:** `lib/atribucion/emparejar.ts` (`emparejar` → `Traza`: canal, campaña, anuncio, contenido por
    formato, macros, avisos, nivel), `lib/atribucion/utm-del-envio.ts` (`utmsDelEnvio`, `columnasUtmDelEnvio`,
    `esMacro`). La vista interina de Pauta pasa por ahí sin cambiar su salida. Guardián en
    `tests/atribucion-emparejador.test.ts`. El comentario de `submissions.utmContent` en el esquema ya no dice
    "sin leer". Sin migración. 1.645 tests (con los de Alejo).
  - Implementó Codex en un worktree; su sandbox no deja correr `npm test` (`spawnSync ps EPERM` en el candado) y
    `next build` falla en un worktree con `node_modules` enlazado (Turbopack rechaza el symlink): la suite y el
    build se corren en el checkout principal.
  - **Medido en producción (lectura):** 21 envíos de ComunicArte traen `utm_id` en `respuestas`, los recientes con
    el mismo id y como `facebook / cpc`; Tactical, 0. O-1 (campo oculto en Tactical) y O-2 (plantilla de Pauta)
    siguen pendientes; preguntar a Pauta si ese id es de anuncio o de campaña.
  - **Queda:** un envío que solo trae `utm_id` cae en N0 aunque su anuncio exista (revisar con el 123).
  - **087 cerrado sin código (Mani):** al tomarlo no había ningún CPL calculado ni gasto (`ad_spend` vacía). Se
    corrigieron los dos comentarios que decían "el CPL cuenta las del formulario", se enmendó el ADR 0044 punto
    5 y los dos tests del ticket pasan al 123 (anotado en su archivo). `leadsDelRango` sigue contando
    `entrada = 'formulario'` para la meta de leads por día: es cumplimiento, no costo (decisión de Mani).

- **2026-09-30 (sesión 54, Mani): 101, el catálogo de Canales, en producción.**
  - **Decisiones de Mani (ADR 0051 enmendado, ticket 101):** catálogo **global** (la convención UTM es la misma en
    todos los programas); `utm_source` nulo = **comodín** del medium (para `paid_social`, que Meta llena con
    `{{site_source_name}}`), el par exacto gana; medium obligatorio; comparación `lower(trim())` sin tocar el crudo;
    **formato** de content/term fijo en el código (`plantilla_pauta`, `meta_historico`, `closer`): dice en qué campo
    viene cada cosa, los valores se agrupan como llegan. El área se deriva al leer, así que corregir un canal
    reclasifica la historia. **Mapear canales es trabajo de Pauta:** con el 102 pasa a `manejaPauta` (enmienda en el
    ticket). PQ9: que Pauta mande por escrito cómo agrupa.
  - **Código:** `lib/catalogo/canales.ts`, `lib/atribucion/canal.ts` (`resolverCanal`),
    `lib/atribucion/pares-sin-clasificar.ts` (`clasificacionDeEnvios`: envíos por canal y pares sin canal),
    `/ajustes/canales`, `scripts/cargar-canales.ts`. Implementó Codex; Claude corrigió un test con `rejects` sin
    `await` (pasaba sin verificar) y las columnas pegadas de la tabla, y agregó el conteo por canal.
  - **Producción (ok de Mani):** 0047 aplicada (ref verificado, sin transacciones largas); 26 canales por el molde
    (130 filas de `change_log`). **5.140 envíos clasificados**; en 0 solo `paid_social` y `closer / referido`
    (esperado); sin canal, 5 de prueba de Tactical.
  - Recorrido en la base local (escritorio, 375 px, claro y oscuro, consola limpia): un closer rebota a su Inbox;
    crear desde un par, duplicado con otras mayúsculas (409), editar y desactivar funcionan.
  - 🩸 La base local de Docker era anterior a la 0045 (0 áreas): `db:local` no resiembra una base con datos. Se
    rehízo con `docker compose down -v && npm run db:local`.
  - Codex no puede escribir en `.git` desde su sandbox: el commit lo hace la sesión principal.
  - **Después del cierre:** áreas administrables en `/ajustes/canales` (crear, renombrar, desactivar), a pedido de
    Mani; 127 de Alejo marcado done en el tracker. Los niveles bajo el canal (campaña, anuncio, placement) no se
    descartan: son del 085 (emparejador), 120 (árbol y gasto de Meta), 123 (embudo y costos) y 125 (tab Campañas).

- **2026-09-29/30 (sesión 53, Alejo): costura 078/115, 080, 099, 062, 072 y el guion del corte.**
  - **078 (`8898ff1`):** el importador pasa `submissionOrigenId` (el envío más reciente del lead, o nulo) a
    `abrirDealHistorico`, que rechaza un envío de otro lead. La pregunta vive en `lib/ingesta/envio-de-origen.ts`.
    Ok de Alejo a Mani para tocar `regla-de-deals.ts` en el 115.
  - **080 (`2c0809f`):** decisiones caso por caso escritas en el ticket. La última llamada decide la etapa de un deal
    del Setteo (Show no → Pendiente Re-agenda; Show sí → Atendido; nunca Cierre Perdido: una categoría de pérdida
    queda como rareza `perdida_por_decidir`). `movidoDesde` a mano en el template para los "cohorte pasada".
    `/ajustes/migracion` lista las rarezas. `scripts/dev-local.ts` ahora usa `shell` en Windows (el spawn de `npx`
    fallaba con ENOENT); efecto secundario: al detenerlo, el `next dev` hijo sobrevive y hay que matarlo por puerto.
  - **099 (`2d7212c`):** tab Students; saldo de `saldosDeDeals` y vencido de `carteraVencida`, nada recalculado.
  - **062 (done):** decisión de Alejo, **monto fijo por venta** (no porcentaje). Migración renumerada a **0044**
    porque la 0043 de `main` era la del 115 de Mani; lleva `SET lock_timeout`. Aplicada con el ok de Mani; montos
    cargados por `editarPrograma` con actor `a.davila0423@gmail.com` (no el `SCRIPT_ACTOR_EMAIL` del `.env`
    compartido). 🩸 **Doble conteo de cierres corregido** (con el ok de Mani, código del 064): un deal que pasaba a
    Abonado un mes y a Completo el siguiente salía como venta en los dos, y la comisión se habría pagado dos veces.
  - **072 (`a0c9850`):** tab Leads y separar/confirmar. Decisiones: se mueven los envíos que traen ese correo exacto;
    409 si uno abrió un deal vigente; lo hace quien trabaja el programa. "Combinar redacciones" quedó fuera (ADR 0032
    retirado); canal/área/campaña/traído por, cuando exista su dato. Medido: 68 correos por revisar en producción.
  - **Guion del corte (`968532a`):** `operations.md` §12. Salió el **127** (deshacer por huella) como hueco.
  - 🩸 **La suite se colgó dos veces** (más de 17 min, el corte de 480 s de `scripts/test.mjs` no la cortó). Se
    mataron los workers de este repo y la tercera corrida terminó (5 timeouts que pasan solos). Si se repite, revisar
    `scripts/test.mjs`.
  - Pendiente: recorridos visuales de 080, 099 y 072 (la extensión de Chrome no estaba conectada); ensayo del 078
    contra producción; 127.

- **2026-09-29 (sesión 52, Mani): mapeo de la reunión con Pauta y parche del Typeform de Tactical.**
  - **Nuevo documento: `docs/analytics.md`** (complemento del plan): lo pedido y lo medido, decisiones DP-1 a
    DP-25, grid de 66 requisitos, modelo de datos, fórmulas y orden (ola 0 de configuración, ola 1 y ola 2).
    ADR **0061** (estados de llegada por tabla; **retira el 0054**), **0062** (el anuncio es la llave: plantilla
    de Pauta con macros, `utm_id`, gasto por la API de Meta, área declarada por el closer) y **0063** (métricas
    y objetivos). Tickets **116 a 126**; 25 tickets enmendados; `plan-reparto.md` E5 a E8 rehechas (el corte
    deja de frenar las etapas de código; Mani: *"lo antes posible, sin fechas"*).
  - 🩸 **Bug vivo encontrado midiendo:** el Typeform de Tactical perdió sus reglas de `estado` el 29-sep entre
    11:26 y 11:40 (Bogotá), en la edición que metió el scoring. El CRM solo sube a `con_calendly` desde
    `setteo_no_calificado`, así que **ningún envío de Tactical abrió deal entre las 11:40 y el parche** (23
    envíos hasta las 20:11, 9 con cita, que quedaron como llamadas sueltas). La hoja no se rompió: su Estado lo escribe el Apps Script.
  - ✅ **Parche en producción (ok de Mani), 29-sep ~20:19:** una regla en la lógica de "¿Estás dispuesto...?"
    del Typeform de Tactical (`GmPGBOf9`) pone `estado = setteo_no_calificado` a todos (`op: always`). PUT del
    form completo con respaldo previo en el scratchpad de la sesión; verificado que el form quedó idéntico más
    esa regla, webhook intacto y form público. **Confirmado con dos envíos reales** (20:30 y 20:35: abrieron
    su deal en Agendado). **Falta:** reprocesar los 23 envíos con el 117.
  - Medido (solo lectura): `utm_content` y `utm_term` viven en `respuestas`, no en sus columnas; Pauta de Retia
    manda hoy `facebook / cpc` con conjunto en content y anuncio en term; 20 envíos con `{{campaign.name}}`
    sin expandir; no hay `utm_id`; los Typeform no tienen ese campo oculto; el webhook no recibe parciales;
    Insights de Typeform: 43% (Tactical) y 51% (ComunicArte) de quienes ven el Calendly no agenda. **La C3 no
    existe en la base** y Tactical vende C3 desde el 30-sep (O-5 en `plan.md` §7).

- **2026-09-29 (sesión 51, Mani): 0041 en producción, mapeo Typeform y fix del resumen del lead.**
  - **0041 aplicada en producción** con `npm run db:migrate` (ref `hfqmiyiuyqapdsbywrag`, conexión directa 5432,
    SQL leído antes). Las cuatro columnas (`lead_quality`, `lead_value` en `submissions` y `leads`) existen, nullable.
  - **Mapeo puesto** en las dos fuentes webhook activas con `editarFuente` (queda en `change_log`):
    `{ puntaje: "score", leadQuality: "tag_lead_quality", leadValue: "lead_value" }`, más la `agenda` que ya tenían.
    Tactical `e3007c99-…`, ComunicArte `f919d215-…`.
  - 🩸 **Se perdían envíos por el orden del deploy:** el código nuevo llegó a Vercel antes que la migración y 2 envíos
    reales de Tactical (19:30 y 19:42 UTC) fallaron al insertar. Estaban íntegros en `sobres_crudos`; se
    reprocesaron con `reprocesarSobre` (ok de Mani) y quedaron `procesado`. Pendientes de reproceso: 0.
    **Regla para el futuro: una migración aditiva se aplica ANTES de mergear el código que la usa.**
  - 🩸 **Bug: los valores no llegaban a `leads.*`.** `resumirEnvios` sacaba `puntaje`, `leadQuality` y `leadValue`
    del envío con `calificacion`; un High que aún no agenda trae `estado` vacío, y el lead quedaba en NULL aunque
    el submission tuviera el valor. Ahora salen de `decideValores` (misma precedencia, filtrando envíos con al
    menos un valor); `calificacion` no cambia. 4 tests en `tests/ingesta-escritura.test.ts`. Implementó Kiro.
  - **Auditoría (agregados, desde 29-sep 17:20 UTC):** Tactical 6 submissions con `score`, `tag_lead_quality`,
    `hvm_points`, `hvm_tier` y `lead_value` en `respuestas` (6/6); ComunicArte 3 con `score` y 2 con las otras cuatro
    (el tercero es anterior a que Alejandro editara ese form, 17:58 UTC). Ningún envío es posterior al mapeo todavía:
    los 7 anteriores tienen `lead_quality`/`lead_value` en NULL en `submissions`, y los 2 reprocesados los traen.
  - **Leads anteriores recalculados (29-sep, con ok de Mani):** los 9 sobres crudos desde 17:20 UTC se pasaron por
    `ingerirEntradas` SIN la regla de deals (upsert por fuente y token, y resumen del lead recalculado). Resultado:
    Tactical 6/6 submissions y 6/6 leads con `lead_quality`, `lead_value` y `puntaje`; ComunicArte 3 leads con
    `puntaje` y 2 con calidad y valor (el tercero es anterior a la edición del form: queda sin valor, no Low).
    Distribución en leads: MUY ALTO VALOR 3 (High), ALTO VALOR 2, VALOR MEDIO 1, BAJO VALOR 2 (Low).
  - **Falta:** verificar con un envío NUEVO (posterior al mapeo) que promueva de punta a punta, y ver los tags en Deals.
  - Validación: typecheck, lint y build limpios; `npm test` 1.486 pasando y 1 omitido, sin timeouts.
  - `.env.example` ahora nombra los tokens de dev: un solo `TYPEFORM_TOKEN` (por cuenta; ve los dos forms, verificado solo con lecturas el 29-sep) y `CALENDLY_ACCESS_TOKEN_COMUNICARTE/TACTICAL` (uno por programa, los reales; las `CALENDLY_PAT_LOCAL_*` no se usan).
    Solo local; ningún código los lee. Cada dev los pega en su `.env.local`.

- **2026-09-29 (sesión 50, Mani): valores de Typeform en Deals.**
  - Se añadió la migración 0041 con `lead_quality` y `lead_value` en `submissions` y `leads`.
  - El adaptador acepta las llaves configurables `leadQuality` y `leadValue` del mapeo de cada fuente;
    guarda los textos que llegan de Typeform sin interpretar ni limitar sus valores.
  - El Kanban muestra ambos como tags y ofrece filtros dinámicos por programa, derivados de los valores
    existentes en deals vigentes. Un valor nuevo aparece sin cambio de código.
  - Pasaron typecheck, lint, build y las pruebas focalizadas de ingesta/Kanban (57 tests). La suite
    completa pasó 1.481 tests y 1 skipped; un hook de `tests/acciones-programas.test.ts` agotó 20s al
    crear la base, fallo de timeout/entorno no relacionado con estos cambios.
  - Los nombres exactos confirmados por Typeform son `score`, `tag_lead_quality` y `lead_value`.
    En cada fuente, el mapeo debe quedar como `{ puntaje: "score", leadQuality: "tag_lead_quality",
    leadValue: "lead_value" }`. `hvm_points` y `hvm_tier` no se promueven.
  - La migración 0041 todavía no pudo aplicarse a producción desde la sesión: `DATABASE_URL` está
    oculto como secreto en Vercel y `vercel env pull/run` bloquea secretos para agentes. El proyecto
    correcto fue verificado como `agencia-dani/retia-metrics`; no se simuló la aplicación.
  - 071 y 098 quedan cerrados: recorrido visual funcional a 390 px realizado con consola, filtros,
    menús, diálogos, enlaces, estados vacíos y llamadas sueltas revisados.

_Estado actual del trabajo. Lo mas reciente arriba._

- **2026-09-29 (sesión 49, Mani): 096 cerrado y login local corregido.**
  - En producción, desde `/ajustes/usuarios`, se creó Maru Marquez (`soymarumarquez@gmail.com`) como closer
    con membresía en ComunicArte y Tactical. Se vinculó `soymarumarquez@gmail.com` para ComunicArte y
    `equipo@ttrading.co` para Tactical; la pantalla confirmó ambos guardados.
  - El proveedor local de Auth.js se invocaba como `local`, aunque Credentials registra la ruta como
    `credentials`; `LOGIN_LOCAL_ID` ahora usa el id correcto. `dev-local.ts` aporta un `AUTH_SECRET` efímero
    cuando no hay uno configurado.
  - Recorrido local de Calls/Inbox: se abrió el resultado, se pegó Grain, se buscó y asignó una llamada
    suelta; el Inbox dejó de mostrarla como suelta y apareció ligada al deal.

- **2026-09-29 (sesión 48, Mani): 098 implementado, aún no cerrado.**
  - Nueva tab `/p/<programa>/calls` con filtros por closer, resultado y fecha, enlaces al deal/Calendly/Grain,
    pegar Grain, resultados del motor y llamadas sueltas con asignación a un deal.
  - La consulta mantiene las llamadas sueltas con `vigente(deals)` en el `LEFT JOIN`, y el selector de
    closer incluye usuarios que solo aparecen en llamadas sueltas.
  - Verificado: `npm test` (1.482 tests, 1 omitido), `npm run typecheck`, `npm run lint` y `npm run build`.
  - El recorrido quedó bloqueado inicialmente por `InvalidProvider`; el problema se corrigió en la sesión 49.
  - **096 pasó al carril de Mani** y quedó cerrado en la sesión 49; K1 y K2 quedaron resueltas.

- **2026-09-29 (sesión 46, Alejo): 096 en pausa, mapeo del 077, ADR 0059 propuesto para el 078.**
  - 096: sin acceso a Calendly, todo lo que queda pasa para después. Anotado en el ticket: las cuentas
    dueñas de cada organización (TI `jvieira@ttrading.co`, CA `info@eventoscomunicarte.com`), que no se
    vinculan a ninguna closer, y que Maru usa `soymarumarquez@gmail.com`. Por confirmar: el correo de
    Calendly de cada closer parece distinto del de su usuario.
  - 077: las 7 pestañas de gestión leídas (solo encabezados y conteos, nada personal) y su mapeo escrito en
    el ticket. Lo que salió: los encabezados corridos de CA confirmados (col J), 75 llamadas de TI sin
    correo, estudiantes de Julio/Agosto sin fecha, 10 Parcial sin monto, plataformas fuera del catálogo
    (Binance, `Bootcamp`). Lectura de producción: **solo Andrea es closer con cuenta**, y hay 48 deals vivos.
  - ADR 0059 (propuesta, grill con Alejo): el deal histórico nace en su etapa (actor `migracion`), huella con
    índice único, gana el deal vivo, extractor → template (fuera de git, lleva datos personales) →
    importador con ensayo. El orden para construirlo está en el ticket 078.

- **2026-09-29 (Alejandro, sesión aparte fuera del repo): los dos Typeform ya mandan score, calidad y VALOR
  del lead. PARA MANI: esto tiene que llegar al CRM y verse en cada lead.** Nada de esto tocó código del
  repo; todo se cambió en Typeform por la API (PUT del form completo) y se probó con envíos reales.
  - **Forms tocados** (ambos ya con webhook a producción, sin cambios en el webhook):
    - Tactical: "De Cero a Tactical Investor", form `GmPGBOf9`
      (https://postulacioness.typeform.com/to/GmPGBOf9), webhook
      `/api/webhooks/formularios/e3007c99-35cc-4f27-889e-1b07d6c720d1`. Última edición 2026-09-29 17:20 UTC.
    - Comunicarte: "Postulación Evento Comunicarte", form `nkMLdeh8`
      (https://metodocomunicarte.typeform.com/to/nkMLdeh8), webhook
      `/api/webhooks/formularios/f919d215-9212-4f1b-9719-fdb957ac7747`. Última edición 2026-09-29 17:58 UTC.
    - **Los envíos ANTERIORES a esas horas no traen las variables nuevas** (`tag_lead_quality`, `hvm_*`,
      `lead_value`; Comunicarte tampoco traía `score`). El CRM debe mostrarlos como "sin valor", NUNCA como
      BAJO VALOR ni Low por defecto.
  - **Variables que ahora llegan en `form_response.variables`** (las mismas 6 en los dos forms):

    | Variable | Tipo | Valores | Qué es |
    |---|---|---|---|
    | `score` | number | 0, -100, -200, -300… | Calidad. Arranca en 0; -100 por cada respuesta descalificadora. |
    | `tag_lead_quality` | text | `High` / `Low` | High = llegó a la llamada (Calendly). Low = descalificado. Ya NO existe `Medium`. |
    | `hvm_points` | number | 0 a 50 | Puntos de capacidad (ingreso + situación profesional). Base del valor. |
    | `hvm_tier` | text | `A+` / `A` / `B` / `C` | Tier por `hvm_points`: A+ ≥45, A 30–44, B 15–29, C <15. |
    | `lead_value` | text | `MUY ALTO VALOR` / `ALTO VALOR` / `VALOR MEDIO` / `BAJO VALOR` | **La etiqueta a mostrar en el lead.** Matriz tier × calidad (abajo). |
    | `estado` | text | `descartado` / `setteo_no_calificado` / `""` | Ya existía; NO se tocó (ver problemas abajo). |

    Ejemplo real de lo que manda Typeform (envío de prueba, Tactical, lead A+ calificado):
    `[{key:"score",type:"number",number:0},{key:"tag_lead_quality",type:"text",text:"High"},
    {key:"hvm_points",type:"number",number:50},{key:"hvm_tier",type:"text",text:"A+"},
    {key:"lead_value",type:"text",text:"MUY ALTO VALOR"},{key:"estado",type:"text",text:""}]`
  - **Reglas exactas (para que el CRM no tenga que adivinar nada; el CRM NO recalcula, decisión A8):**
    - **Calidad (`score` → `tag_lead_quality`)**: -100 por cada descalificador. Los mismos descalificadores
      mandan al ending "¡Perfecto! Estamos analizando tu aplicación" y los demás pasan a Calendly. El tag
      `High` se asigna al pasar por el bloque de Calendly (`score >= 0`); el default es `Low`. En la práctica:
      **High ⇔ agendó/llegó a Calendly, Low ⇔ descalificado.** Todo lead en Setteo que llegó por Calendly
      tiene score 0: el score es binario a propósito (decisión de Alejandro: "todos los que llegan a llamada
      son High").
      - Tactical descalifica: ingreso "Menos de $1.000 USD"; urgencia "No es prioridad"; inversión 1.500 USD
        "No, en este momento no cuento con los recursos".
      - Comunicarte descalifica: ingreso "Menos de $700 USD" o "$700 - $1.500 USD"; urgencia "No es
        prioridad"; inversión 797 USD "No…". **Antes descalificaba también "Estudiante"; Alejandro pidió
        quitarlo el 29-sep**: la situación profesional ya no descalifica en ningún form.
    - **Puntos de valor (`hvm_points`)** = ingreso + situación profesional (NO afecta la calidad):
      - Ingreso Tactical: <$1k 0 · $1k–3k 10 · $3k–10k 20 · >$10k 30.
      - Ingreso Comunicarte (mismas posiciones, otros rangos): <$700 0 · $700–1.500 10 · $1.500–3.000 20 · >$3.000 30.
      - Situación profesional (igual en los dos): Estudiante 0 · Desempleado 0 · Pensionado 10 ·
        0–5 años 10 · 5–15 años 20 · +15 años 20.
    - **Matriz `lead_value`** (tier × calidad). "ALTO VALOR" es la regla que Alejandro trajo de una captura
      del CRM (con Medium pasado a Low); los otros tres nombres los confirmó él:

      | Tier | High (llamada) | Low (descalificado) |
      |---|---|---|
      | A+ | MUY ALTO VALOR | ALTO VALOR |
      | A | MUY ALTO VALOR | ALTO VALOR |
      | B | ALTO VALOR | VALOR MEDIO |
      | C | VALOR MEDIO | BAJO VALOR |

      Ojo: un descalificado puede ser ALTO VALOR (p. ej. gana >$10k pero "No es prioridad"). Es a propósito:
      el valor es un eje distinto de la calidad; ese lead vale la pena recuperarlo aunque no haya agendado.
      El tier y el valor se calculan ANTES del salto de descarte, así que los descalificados también los traen.
      En Comunicarte no existe C+High (todo C tiene ingreso descalificador).
  - **Cómo se verificó**: simulación de las 216 combinaciones de respuestas contra la lógica publicada (0
    casos donde calidad y ending no coincidan) y envíos reales desde Chrome a COPIAS temporales de cada form
    (sin webhook y con una pantalla en lugar de Calendly, ya borradas; no entró nada al CRM). Resultados leídos
    por la API de Typeform, todos como se esperaba: Tactical A+/High/MUY ALTO VALOR, A+/Low/ALTO VALOR,
    C/High/VALOR MEDIO; Comunicarte A+/High/MUY ALTO VALOR, (Estudiante) A/Low/ALTO VALOR, B/High/ALTO VALOR.
    **No se probó el camino webhook → CRM**: el primer lead real es la prueba.
  - **Qué hace HOY el CRM con esto, sin tocar código** (leído en `lib/ingesta/adaptador-typeform.ts`):
    - Todas las variables entran como columnas `variable:<key>` en `submissions.respuestas` (jsonb). O sea,
      desde ya se guardan `variable:score`, `variable:tag_lead_quality`, `variable:hvm_points`,
      `variable:hvm_tier` y `variable:lead_value`, pero **nada las muestra**.
    - `puntaje` (ticket 070, orden del Pendiente Setteo) sigue en null porque ninguna fuente tiene la llave
      `puntaje` en `sources.mapeoColumnas`. Es el "falta configurarlo en los forms" del 070: **ya está del lado
      de Typeform; falta el mapeo del lado del CRM.**
  - **Qué falta en el CRM (propuesta; decide Mani):**
    1. **Configuración, sin código:** en las dos fuentes, poner `puntaje` en `sources.mapeoColumnas`.
       **Recomendación: `"puntaje": "hvm_points"`, no `score`.** El Setteo solo tiene leads que llegaron a
       Calendly, y todos tienen `score` 0, así que ordenar por `score` no ordena nada. `hvm_points` (0–50) sí
       ordena por valor. Si prefieren un número que junte calidad y valor, se puede agregar en Typeform una
       variable más; pedírselo a Alejandro.
    2. **Mostrar el valor en cada lead (código, ticket nuevo):** badge con `lead_value` en la tarjeta del
       Kanban, la Ficha del Deal (074) y las filas del Inbox (070/071), como la captura que trajo Alejandro
       (badge azul "ALTO VALOR" con tooltip de la regla). Sugerencia de colores: MUY ALTO VALOR la más
       fuerte, luego ALTO, MEDIO y BAJO en gris; "sin valor" para envíos viejos. En el tooltip, `hvm_tier` +
       `tag_lead_quality` (p. ej. "Tier A+ · Low"). Dos caminos:
       - (a) Leerlo de `submissions.respuestas->>'variable:lead_value'` del "envío que decide" (misma regla
         que `puntaje`/`calificacion`). Sin migración, pero es un string dentro del jsonb.
       - (b) **Recomendado:** promoverlo como `puntaje`: una llave en el mapeo (p. ej. `valor` →
         `lead_value`, y si se quiere `tier` → `hvm_tier`), columna en `submissions` y resumen en `leads`
         por la regla del envío que decide. Así se puede filtrar y ordenar ("solo ALTO VALOR y más"). Necesita
         migración (la genera la sesión principal con el ok de Mani). Mismo molde que `variablePuntaje`:
         sin defecto, el mapeo nombra la variable. Si el texto no es uno de los 4 valores, null (no se adivina).
    3. Filtro por valor en el Inbox y en el Kanban: el caso de uso es que setteo priorice MUY ALTO/ALTO, y
       recuperar los descalificados ALTO VALOR (Low) que hoy se pierden en "descartado".
  - 🩸 **Problemas de `estado` que existían antes y NO se tocaron** (el Estado del CRM sale de esta variable):
    - **Tactical nunca asigna `estado`**: la variable existe con valor `""` y ninguna regla la cambia. Sus
      descalificados entran SIN Estado (los que agendan solo suben a `con_calendly` si la fuente tiene
      `campoAgenda` en su mapeo; no lo revisé en la base).
    - **Comunicarte** pone `descartado` solo cuando no puede invertir. Ingreso <$1.500 o "No es prioridad"
      también descalifican, pero quedan en `setteo_no_calificado`.
    - Arreglo posible en Typeform (Alejandro lo puede hacer por la API en minutos): en los dos forms,
      `estado = descartado` si `score < 0` y `setteo_no_calificado` si no. **Antes, Mani confirma qué
      significa cada Estado en el CRM**, porque cambia conteos del embudo.
  - Respaldos del JSON original de los forms: solo en el scratchpad de la sesión de Alejandro (temporal). Si
    hay que revertir, la lógica de arriba basta para reconstruirla.

- **2026-09-29 (sesión 46, Mani, tercera parte): 114-A1 y 071 (el Inbox) hechos por Kiro.**
  - 114-A1: `ETAPAS_QUE_UNA_CITA_MUEVE_A_AGENDADO` en `lib/deals/etapas.ts` (1, 2, 3, 9, 11) y
    `RESULTADOS_FALLIDOS` en `mover-etapa.ts`, cada una en un solo lugar, con guardián.
  - 071: `lib/queries/inbox.ts` (`inboxDelPrograma`): llamadas de hoy sin resultado (arriba), sin dueño
    (070), llamadas sueltas con "Asignar a un deal" (K2) y "lo mío" en cinco cajas excluyentes (re-agenda sin
    fecha, compromiso vencido, pago vencido, re-envío sin atender DERIVADO, estancado por días hábiles). El
    closer aterriza en el Inbox de su primer programa VISIBLE (`destinoInicial` usa `programasVisibles`).
    `/mi-dia` sigue vivo: retirarlo va al 075.
  - Kiro corre en segundo plano y el agente que lo lanza regresa antes: esperar el pid de `kiro-cli chat` con
    un Bash en background, no el reporte del agente.

- **2026-09-29 (sesión 46, Mani, segunda parte): 070 hecho por Kiro; 0040 aplicada; auditoría 114.**
  - Inbox del programa en `/p/<programa>/inbox` (secciones sin dueño). El score lo manda Typeform: la fuente
    nombra la variable en la llave `puntaje` del mapeo; sin ella, null. **Falta configurarlo en los forms.**
  - 🩸 `duenosPosibles` exigía membresía también al developer: lo cazó un test de Kiro. El developer es dueño
    posible en todo programa (ADR 0025 punto 5).
  - Kiro trabajó en el worktree `../retia-metrics-070` (rama `kiro/070`) sin correr nada; la sesión trajo el
    cambio con `cherry-pick --no-commit` y verificó. Sigue: 114-A1 (la regla de Agendado copiada en tres
    archivos, la de la ingesta desactualizada), con el ok de Mani para tocar `lib/ingesta/`.
  - **Medido:** 1.440 tests, typecheck, lint y build limpios.

- **2026-09-29 (sesión 46, Mani): 074 hecho, la Ficha del Deal. E3 del carril de Mani cerrada.**
  - Implementó un subagente; la sesión principal revisó, corrigió y probó. **Desde aquí implementa Kiro y
    NO corre suites ni pruebas** (Mani, 29-sep): la verificación es de la sesión principal.
  - 🩸 **Dos defectos que la revisión cazó y los tests del implementador no:** (1) `editarDeal` dejaba poner
    de dueño a un closer de OTRO programa (solo pedía `trabajaLeads`); ahora la pregunta vive en
    `lib/deals/duenos.ts` y la usan la lista y la reja. (2) Anular un deal dejaba sus llamadas contando en el
    embudo (`vigente(calls)` no mira el deal); `anularDeal` las anula en cascada, con rastro.
  - Decisiones: K1 (se retira `buscarLlamadaDelDeal`, lo hace Alejo con el 096), K2 (la suelta se asigna en
    el Inbox), 079 cerrado por el traslado. 070: el Setteo se ordena por un SCORE que calcula Typeform
    y el CRM solo lee (A8; las bandas en el CRM se descartaron); falta configurarlo en los forms. 071: X = 3
    días hábiles por programa, migración 0040 (`programs.dias_sin_actividad`).
  - UI: dentro de un `DialogContent` (grid), el envoltorio del formulario necesita `min-w-0` o un Select
    con texto largo empuja el diálogo fuera de pantalla en celular.
  - **Medido:** 1.415 tests, typecheck, lint y build limpios.

- **2026-09-29 (sesión 45, Mani, cierre): docs consolidados contra el código.**
  - `plan.md` §2 reescrito con el estado de hoy; §4.3b y §7.1 decían abiertas D3, D4, R4, R5 y las
    preguntas del Estado, ya decididas; `AGENTS.md` daba el alcance del 094 como "por construir".
  - Calendly: el webhook ya está vivo, así que **no hay botón que apretar para traer llamadas**; lo que
    falta del 096 es configuración (cuentas de las closers, Maru) y la decisión K2.
  - Decisiones nuevas en `plan.md` §7: K1, K2, K3 (Calendly) y K4 (tono de Seguimiento, cerrada).

- **2026-09-29 (sesión 45, Alejo): el webhook de Calendly (A5) en producción, 0039 aplicada, 097 cerrado.**
  - **Webhook** (`086ba9a`): ruta `app/api/webhooks/calendly/[programa]/route.ts`; lo puro en
    `lib/calendly/evento-webhook.ts` (firma `t=,v1=` HMAC hex sobre `<t>.<cuerpo>`, lectura del evento); el efecto
    en `lib/calendly/eventos-de-cita.ts`; la caja negra compartida con el de formularios en
    `lib/ingesta/caja-negra.ts`; "Conectar Calendly" en `lib/calendly/suscripcion.ts` (único escritor de la clave,
    con guardián; la URL sale de `AUTH_URL`).
  - **0039** (ok de Mani, aplicada): `sobres_crudos.source_id` nulo + `program_id` (37 rellenados) + `origen`
    con CHECK. `entregasHuerfanas` ahora filtra por `program_id` nulo.
  - 🩸 **Fuga tapada:** `sinToken` no quitaba `calendly_signing_key` de la lectura de programas.
  - **Verificado en producción:** los dos programas conectados; una cita de prueba entró como suelta y su
    cancelación (por la API) la pasó a `cancelada`. Queda esa llamada de prueba (sin deal, no cuenta).
  - **Decisión (Mani):** el administrador vincula la cuenta de Calendly de cada closer, compartida o personal.
    En Calendly, Andrea no tiene cuenta propia y Maru no tiene usuario en el CRM.
  - **097 cerrado:** celular revisado en producción (a 658 px y con el contenido a 390).
  - **Medido:** 1.335 tests, typecheck, lint, build y CI limpios.
- **2026-09-29 (sesión 45, Mani): 069 hecho, el Kanban de Deals. Primer ticket de E3 del carril de Mani.**
  - **Login local** (`lib/auth/login-local.ts`, `lib/db/es-local.ts`): "Entrar como (local)" solo con
    `AUTH_LOGIN_LOCAL=1` (lo pone `dev:local`) y una `DATABASE_URL` local; en producción no existe. Decisión
    de Mani: la UI se prueba contra la base de Docker, no contra producción.
  - **Kanban** en `/p/<programa>/deals` (`components/deals/`, `lib/queries/kanban.ts`, acción en
    `app/(app)/p/[programa]/deals/acciones.ts`). Decisión de Mani: arrastre nativo estilo HubSpot (todo el
    tablero reacciona al levantar una tarjeta) más menú "Mover a…" para celular; sin dependencia nueva.
    `ETAPAS_EN_ORDEN` en `lib/deals/etapas.ts` es el orden de pantalla (no el del enum).
  - **Recorrido hecho usándolo** (detalle en el cierre del ticket 069): requisito faltante, motivo, producto y
    fecha, arrastre permitido y prohibido, deal ajeno rechazado por el servidor, 390 px. Seis bugs de UI
    salieron ahí y no en los tests (Select con valor crudo y no controlado, orden de columnas, precio sin
    formato, T9 en el menú, menú en deals ajenos).
  - **Base local:** `docker-compose.yml` con `name: retia-metrics` (cada worktree chocaba por el contenedor).
    Turbopack no acepta un `node_modules` enlazado: un worktree con symlink no corre `next dev`.
  - **Kiro** implementó en un worktree a mano; la sesión principal revisó, corrigió y corrió la suite.
  - **Medido:** 1.365 tests, typecheck, lint y build limpios.
  - **Sigue en el carril de Mani de E3: el 074 (Ficha del Deal)**, que además debe prellenar la fecha
    límite con el inicio de clases en el diálogo de Compromiso Verbal. E3 no cierra sin él ni sin el 077/078
    de Alejo.

- **2026-09-28 (sesión 44, Alejo): el 096 sin el webhook, en `main` sobre la 0038 de Mani.**
  - **Migración:** propuse una 0038 propia (con el CHECK ya aflojado por la misma razón que Mani); al empujar,
    Mani ya había aplicado la suya (`0038_calendly-por-membresia-y-webhook.sql`, con `calendly_signing_key`). Al
    rebasar se descartó la mía: mismos nombres de columna, el código calzó sin cambios.
  - **Escritor** `lib/calendly/colgar-llamada.ts`: `registrarLlamadaDeCalendly` y `asignarLlamadaSuelta`.
    Empareja también por la llave del lead (`leads.email_normalizado`), que cuenta como confirmado.
    `huellaDeCita` es la única forma de armar `calendly:<uuid>`. Guardián nuevo con helper
    `tests/helpers/codigo-fuente.ts` (los guardianes viejos siguen con su copia de `sinComentarios`).
    Excepción nombrada en `tests/alcance-de-sesion.test.ts`: leer membresías para saber quién es la host no
    es acotar una sesión.
  - **Decisión de Alejo:** la cuenta de Calendly de cada closer la vincula un administrador, eligiéndola de
    la lista que devuelve el PAT (`GET /organization_memberships`); el servidor la vuelve a comprobar. El PAT
    no sabe qué closer es cada cuenta: la que tiene el mismo correo del login sale **sugerida**, sin
    guardarse sola. El campo global "Correo de Calendly" salió del formulario.
  - **PATs:** en producción los dos están en la base (verificado sin leer valores). Placeholders
    `CALENDLY_PAT_LOCAL_COMUNICARTE` / `_TACTICAL` para la base local (`.env.example`, `.env.local` vacíos);
    el seed lee de `.env.local` solo esas dos llaves.
  - **No se vio en navegador todavía:** falta el recorrido de `/ajustes/usuarios` contra producción.
  - **Medido:** 1.291 tests, typecheck, lint y build limpios.
- **2026-09-28 (sesión 43, sexta parte): migración 0038 aplicada, desbloquea el 096 de Alejo.**
  - Columnas `miembros_programa.calendly_email`, `calls.calendly_host_email` y `programs.calendly_signing_key`, el
    índice único parcial por programa y correo, y el CHECK `calls_crm_con_deal`. Validada contra los datos reales
    (las 15 llamadas tienen deal), leída entera y aplicada con el ok de Mani; producción quedó en 39 migraciones.
  - 🩸 **El CHECK propuesto ("la suelta es la única Call sin deal") se aflojó** a "una llamada del CRM siempre tiene
    deal": rompía 15 tests viejos del dashboard y chocaba con E7. Se aprieta al terminar E7. Está en el ticket 096.
  - **Alejo ya puede hacer pull y empujar el 096.**
  - **Medido:** 1.268 tests, typecheck, lint y build limpios.

- **2026-09-28 (sesión 43, quinta parte): costura de E2, borrar el onboarding y revisión de Alejo.** Sin migración.
  - **Revisión de Alejo a mi 060/061 (`7598185`):** T18 exige comprobante; producto en otra moneda se rechaza;
    `anularAbono` relee el abono tras bloquear el deal; `fechaEfectivaDePago` única; test de concurrencia contra
    Postgres real (el de PGlite no probaba el `for update`) y un servicio de Postgres en el CI. Bien hecho.
  - **`desmarcarOnboarded`** (pedido de Mani): borra la marca con su rastro; la hacen el closer dueño, el gerente
    y el developer; funciona aunque el deal ya no sea estudiante.
  - **`tests/costura-e2.test.ts`:** webhook con cita vigente → Agendado con llamada `calendly:<uuid>` → Grain →
    Atendido → abono → Abonado con cohorte asignada → acuerdo de pago con tope → cartera vencida → abono que
    salda → Completo → onboarding → anular ambos (A2 y A1), con historial, saldo, cartera y estudiantes
    coherentes en cada paso.
  - 🩸 **Hueco de Alejo resuelto (D3):** anular el abono de un Completo con OTRO deal abierto del lead reventaba
    con un error crudo de la base; ahora es un 409 claro y no escribe nada.
  - **Medido:** 1.259 tests, typecheck, lint y build limpios.

- **2026-09-28 (sesión 43, cuarta parte): 063 hecho, cierra el carril de Mani de E2.** Sin migración.
  - `lib/deals/estudiante.ts`, `lib/queries/estudiantes.ts`. Marca el onboarding el closer dueño o un
    administrador; el cambio de cohorte lleva motivo en texto y la venta cuenta donde asiste.
  - 🩸 **Nadie asignaba la cohorte al cerrar:** `registrarAbono` la asigna en el primer abono (la activa).
  - **Medido:** 1.231 tests, typecheck, lint y build limpios. El guardián del ADR 0012 cazó el nombre de un
    programa en un comentario: sin nombres de programa ni en comentarios de `lib/`.
  - **Carril de Mani de E2 terminado (060, 061, 063).** Falta lo de Alejo (097 hecho, 096 en curso) y la
    prueba de costura de E2 (una cita cae en su deal, el Grain lo pasa a Atendido, un abono a Abonado, el que
    salda a Completo, anular lo devuelve), que necesita el 096 de Alejo.

- **2026-09-28 (sesión 43, tercera parte): 061 hecho, acuerdo de pago y cartera vencida.** Sin migración.
  - `lib/deals/pago.ts` y `lib/queries/cartera.ts`. Decisión de Mani: el inicio de clases de la cohorte es
    SIEMPRE el tope del plazo de pago (prellena y limita); rige en la edición, en `moverEtapa` y en `abrirDeal`.
  - **Medido:** 1.215 tests, typecheck, lint y build limpios. Sigue el 063 (`onboarded_at` y cambio de cohorte).

- **2026-09-28 (sesión 43, segunda parte): 060 hecho, el dinero mueve el deal.** Sesión de Mani, sin migración.
  - `lib/deals/abonos.ts`: `registrarAbono` (reja de sobrepago con la cifra de `saldosDeDeals`, deal bloqueado
    `for update`, Abonado o Completo por el motor) y `anularAbono` (A2 y A1). `saldo-centralizado.test.ts`
    recreado. Decisiones de Mani en el ticket 060 (cierre).
  - 🩸 **Dos huecos del motor que solo salieron al usarlo:** (1) A1 y A2 exigían un motivo del catálogo que ninguna
    de las cuatro listas describe: Mani decidió quitarlo (la razón es la anulación del abono); (2) A1 no
    encontraba a dónde volver si el deal fue directo a Completo con un solo abono: `etapaALaQueVuelve` mira
    Abonado y Completo, con respaldo Compromiso Verbal.
  - **Ojo, Alejo está trabajando su carril (097, 096) sin haber empujado nada al cierre:** este commit toca
    `lib/deals/mover-etapa.ts`, `lib/deals/etapas.ts` y sus tests. Antes de tomar algo, `git fetch`.
  - **Medido:** 1.178 tests, typecheck, lint y build limpios. Sigue el 061 (prellenado de la fecha con el inicio
    de clases + cartera vencida) y el 063.

- **2026-09-28 (sesión 43): E1 cerrada, el traslado corrió en producción.** Sesión de Mani.
  - 🩸 **Causa de los 12 min:** `recalcularResumen` hacía un `UPDATE` y un `INSERT` de bitácora por lead a
    través del pooler. Ahora `actualizarResumenes` escribe un `UPDATE ... FROM (VALUES)` por lote de 200
    (casts explícitos, fechas en ISO: un `Date` crudo en `sql` lo rechaza postgres-js). Ensayo completo en
    ~2 min; el script imprime avance por fuente y desglosa los posibles duplicados.
  - **Cotejo antes de aplicar:** los leads nuevos del ensayo cuadran al lead con la hoja deduplicada por
    (programa, correo) menos las uniones por teléfono (ComunicArte 23, Tactical 46 menos 4).
  - **Aplicado con el ok de Mani:** ComunicArte 2.478 leads / 2.739 envíos / 4.986 contactos; Tactical
    2.891 / 4.199 / 5.843. Segundo ensayo: 0 nuevos. Conciliación 0 en los dos (2.739 y 3.304 tokens).
  - **Cerrados:** 048, 049, 050, 110, 111 (y la parte de datos del 079). Commit `9da3080` + docs.
  - **Medido:** 1.148 tests, typecheck y lint limpios. No se abrió `/ajustes/salud` en navegador: la
    conciliación se corrió con la misma función que usa la pantalla.

- **2026-09-28 (sesión 42): carril de Alejo en E0 y E1, hecho por la sesión de Mani con agentes.**
  - **112:** `.github/workflows/ci.yml` (npm ci, typecheck, lint, test, build en cada push y PR) y
    plantilla de PR con el checklist de contratos. La primera corrida **midió el lock roto en Linux**
    (faltaban `@emnapi/core` y `@emnapi/runtime` 1.11.3); se resincronizó (`649bf2c`). **Decisión de
    Mani: sin protección de `main` ni PR obligatorio, "necesitamos velocidad"**; el CI es alarma.
  - **113:** `npm run db:local` y `npm run dev:local` (Antigravity; revisado y corregido: `db-local.ts`
    corría su `main()` al importarse, así que `dev:local` no arrancaba la app y el seed se relanzaba en
    bucle). Probado de punta a punta con Docker. Falta un login local (Auth.js solo tiene Google).
  - 🩸 **Bug de producción que PGlite escondía:** `leerHechos` de `moverEtapa` pasaba un `Date` en una
    plantilla `sql` y postgres-js lo rechaza contra un Postgres real. Salió al sembrar la base local.
    Arreglado con `gte()` (`48ea5d3`) y anotado en AGENTS.md. En producción no había fallado nada (11
    sobres, 0 con error).
  - **110:** migración **0037** (`entregas_webhook` + enum `motivo_entrega`, con RLS) aplicada en
    producción con el ok de Mani. Kiro hizo la ruta (cada entrega con código y motivo, firma ausente vs
    inválida, purga de rechazos a 90 días), `procesarSobre` compartido con el reproceso, y la pantalla
    `/ajustes/salud`. Revisión: faltaba RLS en la 0037, la ruta había cambiado el contrato del sobre con
    error (vuelve a `{ ok: false, guardado: true }`) y la acción no usaba `normalizando`.
  - **111:** `npm run trasladar` (Kiro). Revisión: 🩸 **la hoja y el webhook traen el mismo token de
    Typeform**, pero la ingesta es idempotente por `(fuente, token)`: sin filtro, los 20 envíos que ya
    entraron por webhook se habrían duplicado como envíos de la hoja. Ahora se apartan y se reportan.
  - **105:** los ids de las acciones se sacaron del bundle sin ejecutar nada. La invocación forjada la
    bloquea el modo automático de Claude Code (escritura sobre secretos) aunque Mani dio permiso por
    chat. El snippet quedó en el ticket 105 para que lo corra Mani.
  - **Segunda parte (misma noche):** Mani forjó el 105 como closer (cerrado). Bug de la conciliación:
    tomaba UNA hoja con `.limit(1)` sin orden y en ComunicArte le tocó `Forms viejo`; ahora junta todas
    (`tests/conciliacion-sheets.test.ts`). Prueba de costura de E1 escrita por Kiro y en verde. El
    ensayo real del traslado se cortó a los 12 min sin escribir nada (ver ticket 111). Mani propuso un
    template de importación para la gestión: anotado en el 077 para E7. Sus observaciones de UI, en el 075.
  - **Agentes:** Codex sin cuota hasta el 12-oct. Con `isolation: worktree` el guard bloquea `kiro-cli`,
    y el worktree se borra al salir el subagente aunque Codex siga corriendo (quedaron procesos
    huérfanos, ya muertos). Lo que funcionó: `git worktree add` a mano + `kiro-rescue` sin aislamiento.

- **2026-09-28 (sesión 41): E0 del reparto y el carril de Mani de E1 (057, 058, 059).** Sesión de Mani.
  - **E0, carril de Mani:** §3 del reparto aplicado con el ok de Mani (069, 070, 074, 077, 079, 086
    cambian de dependencias; enmiendas en 048, 049, 064). Tickets nuevos 111 (traslado), 112 (CI), 113
    (base local, aprobada). `CRON_SECRET` y `SHEET_ID_*` fuera de Vercel. Andrea dada de alta por Mani
    en `/ajustes/usuarios`.
  - **Decisiones de Mani:** el deal es de la closer con quien agenda el lead (096); precio de lista de
    ComunicArte 797; respuestas a Michael en `plan.md` §7.E (ROAS vuelve; Juanito es el bot de
    recordatorios y no toca UTM; nadie edita el Estado a mano; un deal no se cierra sin el pago
    completo; la hoja manda sobre los consolidados de C2). La comisión se verifica en E5. Reunión con
    Pauta, Alejo Carvajal y Michael el 29-sep 8pm (UTM, checkouts, 26% sin UTM, áreas).
  - **E1, carril de Mani:** `lib/deals/llamadas.ts` con `agregarLlamada`, `completarAgendada`,
    `pegarGrain` y `marcarFallida`, todo en transacción con `moverEtapa()`. Implementado por Kiro; la
    sesión principal agregó la transacción de `agregarLlamada`. Migración **0036** (`calls.closer_user_id`,
    `link_calendly`, `link_grain`) aplicada en producción con el ok de Mani. **Desviación del reparto:**
    salió sola, sin la tabla del 110, para que la otra sesión construya sobre `main`; el 110 lleva la 0037.
  - 🩸 **La suite "se colgaba" 55+ min y no era el código.** El subagente del 057 seguía vivo y relanzaba
    Kiro y `npm test` cada vez que se mataban sus procesos; con tres suites a la vez y workers de vitest
    huérfanos (sobreviven a su padre) nada terminaba. Con la máquina limpia la suite tarda 45-66 s.
    Arreglo: `npm test` = `scripts/test.mjs` (candado por máquina, barre huérfanos, corte a 480 s),
    probado en los tres casos; convención en `AGENTS.md`. Probablemente explica también el cuelgue de la
    sesión 40.
  - ⚠️ `npm run build` falla en un worktree con `node_modules` enlazado (Turbopack no acepta el symlink):
    es entorno. Se construye en el repo principal.
  - **Medido:** 1.116 tests, typecheck, lint y build limpios; deploy de `fa648cc`.

- **2026-09-28 (sesión 40): 107 cerrado, la app avisa cuando una fuente deja de recibir.** Sesión de Mani.
  - **Chequeo inicial:** 11 leads en producción (8 ComunicArte, 3 Tactical), cero sobres con error.
  - **Migración 0035** (sesión principal, aplicada en producción con el ok de Mani):
    `sources.umbral_sin_respuesta_horas` (48) y `umbral_muerta_horas` (120), en horas, con el CHECK
    `sources_umbrales_en_orden`. Aditiva: las cinco fuentes quedaron en 48/120.
  - **`lib/queries/salud-fuentes.ts`:** `saludDeFuente` (pura) y `saludDeFuentes`. Calculado desde
    `submissions.created_at` y `sobres_crudos`, nada guardado. Estados: `al_dia`, `volvio`,
    `sin_respuestas`, `muerta`, `sin_envios`. "Volvió" = el hueco entre los dos últimos envíos superó el
    umbral. Una fuente activa que nunca recibió se marca. El 110 reusa el módulo.
  - **Decisión de diseño:** los umbrales son OPCIONALES en zod. Al crear los pone la base; al editar se
    conserva el valor actual. Con `.default()` una edición que no los mandara los resetearía sin error.
  - 🩸 **El guardián de vigencia cazó una subconsulta** (`.from(alias)`): trata cualquier identificador
    desconocido como tabla posible. No se aflojó: el penúltimo envío se lee con una consulta simple por
    fuente activa (una por programa, ADR 0039).
  - **Pantalla vista** con datos reales: "recibiendo · último hace 36 min" y el formulario con los dos
    umbrales. No se guardó ninguna edición desde el navegador.
  - ⚠️ La primera corrida de `npm test` se colgó más de 20 min con un worker al 92% de CPU; las dos
    siguientes pasaron en ~130 s. Sin causa encontrada. Si se repite, correr con `--reporter=verbose`
    para ver qué archivo se queda.
  - **Medido:** 1.068 tests, typecheck, lint y build limpios.
  - **Overview dado a Mani:** 20 tickets v2 hechos + 107, 4 en curso, 47 por hacer (~29%); ritmo de ~3
    por día desde el 21-sep; lo que más frena son las decisiones (Pauta, closers, A4, A5, D3).

- **2026-09-28 (sesión 39): 108 cerrado, el sync de Sheets retirado.** Sin migración.
  - Fuera: cron, `POST /api/sync/[programa]`, botón, `lib/sheets/sync.ts`, `plan-sync.ts`,
    `lib/auth/origen.ts` (sin llamadores), scripts `sincronizar`/`backfill-fechas`/`cron-secret` y 4 tests.
    `sync_runs` queda como historial. Detalle en el ticket 108 y `docs/operations.md` §7.
  - ⚠️ `GOOGLE_SERVICE_ACCOUNT_JSON_B64` **no** se quita de Vercel: probar/activar una fuente de hoja la
    usa en vivo. Falta quitar `CRON_SECRET` y `SHEET_ID_*` (pedir ok a Mani).
  - `eslint.config.mjs` ignora `.claude/**` (los worktrees dejaban lint sin memoria).
  - Medido: 1.053 tests, typecheck, lint y build limpios. `/ajustes/fuentes` no se abrió en navegador.
  - El tracker marcaba el 110 como hecho por el nombre de un commit: solo existe el ticket, sigue `todo`.

> Las entradas anteriores al 27-sep citan documentos que se fundieron ese día (spec, plan v2, propuesta,
> revisión, glosario, insumos): `docs/plan.md` §8 dice dónde quedó cada uno.

- **2026-09-28 (sesión 38, noche): `npm test` de 409 s a 130 s** (commit `9e7d79e`, ya en `main`).
  Sesión de Mani, sin ticket: es infraestructura de tests, no cambia ninguna regla ni ningún test.
  - **Lo que se midió, y la causa no era la que se creía:** por cada base de prueba, `new PGlite()`
    (initdb) cuesta ~700 ms y las 35 migraciones solo ~150 ms. Arrancar desde un volcado cuesta ~150 ms
    en total porque se salta las dos cosas.
  - **El cambio, solo en `tests/helpers/base-de-prueba.ts`:** migra una vez por ARCHIVO de test (vitest
    aísla los módulos por archivo), vuelca con `dumpDataDir("none")` y cada base nace con
    `new PGlite({ loadDataDir })`. La firma `{ db, cerrar }` no cambió; ningún test se tocó. Sin gzip a
    propósito (volcado ~15x más lento, cada carga ~100 ms más).
  - **La garantía sigue:** una migración con SQL inválido tumba todos los tests de base del archivo.
    Probado con una copia rota de la 0034 fuera de `drizzle/` (34 rojos con `syntax error`).
  - **Descartado por ahora:** volcar una sola vez por corrida con un `globalSetup`. Ahorraría <10 s de
    reloj a cambio de un archivo temporal y más configuración.
  - Suite, typecheck, lint y build limpios antes del push. El worktree no traía `node_modules`: se
    instaló con `npm install --no-package-lock` (el lock sigue desincronizado, ver AGENTS.md).
  - Siguiente sesión: nada nuevo de aquí; sigue el prompt de arriba (106 ya cerrado). `/tdd` para el
    108/107.

- **2026-09-28 (CIERRE 37, tarde): los leads entran solos por Typeform; el 106 cerrado (ADR 0058).**
  Sesión de Mani; Kiro implementó el cierre, revisado por la sesión principal.
  - **Envío real:** Mani creó las dos fuentes webhook en producción (`/ajustes/fuentes`, mapeo
    `{"agenda": "agenda aqui tu entrevista"}`), desactivó las de Sheets y pegó URL y secret en Typeform.
    🩸 Las primeras entregas dieron **401**: el secret no estaba pegado en Typeform (sin él Typeform no
    firma). Ya entran leads reales de los dos programas (11 envíos al cierre, 3 de prueba).
  - **Lo que destapó el envío real, cerrado (ADR 0058):** el lead quedaba **sin nombre** (migración
    **0033**, rellenó lo ya entrado); el mapeo webhook ignoraba en silencio las llaves de producción y no
    heredaba la plantilla (ahora uno solo, `lib/ingesta/mapeo-webhook.ts`); solo se leía la variable
    `estado` (ahora todas entran como `variable:<nombre>` y el Estado es configuración); el cuerpo crudo
    solo se guardaba al fallar (**0034**: caja negra de cada envío); `xxxxx` del Forms Link entraba como
    UTM (ahora es sin UTM).
  - **Decisiones de Mani:** una re-agenda con cita vigente sobre un deal en 4-7 **crea su llamada** en el
    mismo deal (`agregar_llamada`; antes la fecha nueva se perdía). Agendó y después `descartado`: el deal
    **sigue en Agendado**, decide el closer.
  - **Matriz de casos** contra la ruta real (`tests/webhook-matriz.test.ts`), pedido de Mani: "testear
    todos los casos posibles para que en producción no se pierdan leads".
  - **Aclarado con Mani:** Typeform siempre dice `setteo_no_calificado` para quien agenda (no puede
    condicionar sobre Calendly); el CRM lo sube a `con_calendly` al ver el link. No es un bug.
  - La entrega de ComunicArte de las 12:24 que dio 401 no era un lead: no hay respuesta a esa hora en
    ningún Typeform (Mani). No se perdió ninguno.
  - **Pruebas borradas** con el ok de Mani (1 lead, 2 envíos, 3 contactos, 1 deal, 1 llamada, 1 historial y
    13 filas de `change_log`), en una transacción que verificó cada conteo. Quedan solo leads reales.
  - ⚠️ **Pendientes:** el
    Partial Submit Point lo decide el equipo; cancelar una cita en Calendly no toca la llamada (096).
  - **Medido:** 1.097 tests, typecheck, lint y build limpios. Migraciones 0033 y 0034 aplicadas en
    producción antes del deploy (son compatibles con el código anterior).

- **2026-09-28 (CIERRE 36, mañana): 109 y 052 hechos; el cron de Sheets metió 5.343 leads y se apagó.**
  Sesión de Mani; Kiro implementó 109 y 052, revisados por la sesión principal.
  - **109 hecho** (`29da582`, migración **0030**): `programs.form_url` y `programs.calendly_token`. El
    token lo escribe solo `guardarTokenCalendly` (bitácora "(oculto)") y ninguna lectura lo devuelve
    (`sinToken`). **Pedido de Mani:** el formulario dice **Forms Link** y **Calendly Token**,
    obligatorios, el token con puntos y pegable; salieron del formulario `web_url` y `calendly_url`
    (vacías, sin lector; las columnas siguen). Mani cargó los dos tokens desde la app y se borraron de
    `.env.local`. La revisión agregó la paginación de Calendly (un uuid en la página 2 salía `null` en
    silencio) y tapó `editarPlantillaLead`, que devolvía el token.
  - **Migración 0031** (`313efc4`): `programs.activo` nace en `false` y el CHECK
    `programs_activo_con_formulario_y_token` exige los dos valores. 34 archivos de tests pasaron a
    `PROGRAMA_DE_PRUEBA`.
  - 🩸 **Los "39 leads" eran 5.343.** El cron diario de Vercel (`/api/cron/sync`, 7:00 Bogotá) seguía
    vivo; su primera corrida contra Supabase (7:52) copió las dos hojas **sin un solo envío detrás**. Un
    webhook posterior habría recalculado el resumen de esos leads solo con el envío nuevo, sin error.
    **Apagado** (`9410442`, quitado de `vercel.json`, deploy verificado) y **borrados** los 5.343 leads y
    las 2 corridas, con el ok de Mani, en una transacción que verificó los conteos. **Lección:** cambiar
    el `DATABASE_URL` de producción también redirige a los crons; revisar `vercel.json` cuando se cambia
    la base.
  - **052 hecho** (con la migración 0032 aplicada en producción; publicado al cierre): la ruta del webhook resuelve la cita
    **antes** de la transacción (`lib/calendly/resolver-cita.ts`, `citaDeCalendly` ahora dice si está
    cancelada). Vigente: Agendado, creando antes la llamada `agendada` sin closer, `origen calendly`,
    huella `calendly:<uuid>`; el motor pasa sin aflojarse y abrir directo en Agendado ya no queda sin
    llamada. Cancelada, no encontrada o error: **Pendiente Setteo con nota** (Mani). **Migración 0032**
    (sesión principal): `deal_actividades.user_id` nulo = el sistema, y un CHECK impide que el sistema
    registre un contacto. Probado contra Calendly real: vigente con fecha exacta, cancelada, no
    encontrada y error.
  - **Pedido de Mani, anotado en el 096:** que un lead sin cita no se quede así para siempre. Dropdown de
    llamadas de Calendly y botón "buscar llamada" en el deal; además, la llamada que llegue después se
    cuelga sola.
  - **Medido:** 1.017 tests, typecheck, lint y build limpios.
  - ⚠️ `.kiro/settings/lsp.json` es configuración local de Kiro: no va al repo.

- **2026-09-28 (CIERRE 35, madrugada): producción armada en la única base; 052 y 106 con código.**
  Sesión de Mani; Kiro implementó 052, 106 y bitácora + T2 en paralelo (repartidos por archivos),
  revisados por la sesión principal.
  - **Una sola base (Mani):** *"no necesitamos 2 proyectos, todo el backend dentro de ese"*. "CRM Retia"
    es producción: estaba limpio (solo configuración, cero leads, deals o abonos). El `DATABASE_URL` de
    Vercel Production **seguía apuntando a Neon** (13 días, de antes de Supabase): se cambió a CRM Retia y
    se redesplegó; Mani entró y el dashboard carga. El de Preview (también Neon) se borró: se trabaja en
    `main`. Regla nueva en AGENTS.md y enmienda del ADR 0047. El plan gratis permite 2 proyectos y el
    otro cupo es de `pipeline-creacion-contenido`.
  - **Decisiones cerradas:** A3 (producción), A6 (el sync de Sheets se descarta: 053-056 reemplazados,
    ticket **108** para retirar el código), A8 (el CRM no calcula nada: T2 borrado, ADR 0054).
  - **Migración 0029** (`sobres_crudos`, con RLS), aplicada. `.gitattributes` fuerza LF en las
    migraciones.
  - **Hashes (pendiente del cierre 34), resuelto:** las filas 0000-0020 se aplicaron desde un checkout de
    Windows (CRLF). Con CRLF casan todas; el contenido es idéntico. Nada que arreglar en la base.
  - **Bug de la bitácora, arreglado:** dos copias de `aTexto` con `String(valor)`. Además de escribir
    `[object Object]`, **editar solo el mapeo de una fuente no se guardaba**: el diff comparaba la cadena
    contra sí misma y cortaba antes del update. Ahora es una función, `textoDeBitacora`.
  - **052 (en curso):** la regla abre y mueve por el motor. 🔴 Setteo → Agendado lo rechaza el motor
    (exige llamada con fecha), pero abrir directo en Agendado sí se permite: asimetría. **El link de
    Calendly no trae la fecha** (leído en la hoja de Tactical): hay que pedírsela a la API de Calendly
    con un token (A5). Mani eligió usar la fecha de Calendly; falta el token.
  - **106 (en curso):** ruta, adaptador y sobres crudos. La revisión arregló un id no-UUID que daba 500 y
    un comentario que contradecía al código. El payload de los tests es inventado: falta el envío real.
  - 🩸 **Lección:** Kiro reportó "todo limpio" corriendo solo sus tests, y el guardián de vigencia cazaba
    una lectura de `deals` sin `vigente()`. La revisión corre `npm test` completo, siempre.
  - **Medido:** 973 tests, typecheck, lint y build limpios.
  - **Más tarde, con Mani:** los tokens de Calendly de los dos programas están en `.env.local` y funcionan
    (rol owner; los 10 ids de invitado probados de la hoja de Tactical salen con fecha). **ADR 0057:** el
    programa guarda su link de formulario y su token de Calendly en la base (segunda excepción de
    secretos), y no se activa sin los dos; **ticket 109**. El 107 tiene umbrales (48 h marca, 5 días
    muerta, un envío en medio la revive) y el aviso va **solo en la app**; revisar el correo después
    (plan §7 A2). Los programas se crean en `/ajustes/programas` (gerente y developer).
  - **Publicado:** `aa89e98` en `main`, desplegado en producción el 28-sep con los cuatro chequeos
    limpios. La ruta `POST /api/webhooks/formularios/<id>` está viva: con un id falso o no-UUID responde
    404 en JSON (no redirige a `/login`). Todavía **no existe ninguna fuente webhook** en la base:
    crearlas es el primer paso del envío real del 106.
  - **Pendientes de Mani:** el JSON de enlaces de pago
    (`ENLACES_PAGO_JSON`) y dar de alta a los closers reales en producción (007). Las 2 filas de prueba
    en las hojas NO se borran (son pestañas sincronizadas; Mani, 28-sep).
- **2026-09-27 (CIERRE 34, noche): el Estado lo manda el formulario; 051 y 105 hechos.** Sesión de Mani.
  - **Mani:** *"el CRM NO se encarga de calcular ni calificar ningún lead; se confía en los valores que
    vienen del forms"*, con los nombres de la hoja. Son tres: `descartado` (sin recursos e incompleto
    caen aquí), `setteo_no_calificado`, `con_calendly`. El form sabe si agendó porque el Calendly está
    embebido en él. **ADR 0054 enmendado**; T2 queda en el repo desconectado mientras se decide **A8**
    (¿form o función del CRM por programa?, Mani lo duda). **D4 cerrada:** el 052 lee `leads.calificacion`.
  - **ADR 0055:** sus dos puntos cerrados (sobre crudo + 200; aviso en la app). Tickets **105** (fuente
    webhook), **106** (ruta + adaptador de Typeform, hito A) y **107** (aviso de fuente sin envíos; 🔴 el
    umbral por defecto es de Mani). 051 reescrito y 052 enmendado (solo abre deals desde el webhook).
  - **Migración 0027** (enum de tres valores), aplicada en `dev`. 🩸 El borrador de drizzle-kit casteaba
    los valores viejos sin traducirlos: reescrita con el `UPDATE` en medio. En `dev` no había filas
    calificadas.
  - ⚠️ **Los hashes de `drizzle.__drizzle_migrations` no casan con los archivos 0000-0011, 0013, 0014 y
    0016-0020** (sí con 0012, 0015 y 0021-0026). drizzle solo mira la última, así que no bloquea; lo más
    probable es que esos archivos se editaran después de aplicarse (comentarios o finales de línea). Sin
    investigar.
  - **105 casi hecho** (`1e00020`): migración **0028** en `dev` (`tipo_fuente` webhook, `sources.proveedor`,
    `sources.secreto_webhook`, CHECK de proveedor). El secreto lo escribe solo `rotarSecretoDeFuente` y
    nunca pasa por el molde (el molde escribe cada campo en `change_log`). El sync de Sheets ahora solo lee
    fuentes de hoja. **Recorrido visual hecho** con la sesión de Mani: crear webhook, URL, activar sin
    secreto (422), generar secreto (se ve una vez), activar con otra fuente activa (409), editar con el tipo
    bloqueado; el secreto no aparece en el HTML al recargar (comparado por hash) ni en `change_log`. La fuente de
    prueba "Typeform prueba (105)" se borró de `dev` con su rastro (Mani, 27-sep); "Formulario anterior"
    sigue inactiva a propósito (ADR 0039: sus envíos apuntan a ella). Falta forjar la acción como closer.
  - 🩸 **Bug viejo visto en el recorrido:** el molde escribe los campos jsonb en `change_log` como
    `[object Object]` (`aTexto` = `String`). Tarea aparte propuesta; puede que además esconda ediciones del
    mapeo en el diff.
  - **051 hecho** (Kiro, revisado): `estadoDesdeTexto` en `lib/ingesta/estado.ts` acepta los tres valores y
    las cuatro etiquetas exactas del Apps Script; lo demás entra sin Estado y, si es un envío completo, se
    reporta en `sinCalificar`. ⚠️ Para el 106: `Envio.estado` sale de `estadoHoja`, así que el adaptador de
    Typeform pone la variable `estado` en ese campo (o se generaliza el nombre).
  - **Medido:** 922 tests, typecheck y lint limpios con el 051 y el 105 juntos.
  - **Typeform configurado (Mani, 27-sep noche):** los dos formularios tienen la variable `estado` (texto,
    SIN valor base) y dos cálculos en la pregunta de pago (`descartado` / `setteo_no_calificado`),
    publicados. Typeform no deja condicionar sobre la pregunta de Calendly, así que "agendó" lo lee el CRM
    del link (ADR 0054, segunda enmienda; se construye en el 106). La pregunta de Calendly es obligatoria y
    ahora autocompleta nombre y correo del form (sirve al emparejador del 096). La variable `estado` NO
    llega a la hoja (solo al webhook), y 🚫 **nunca se reconecta la integración con Sheets**: reordena las
    columnas. El Partial Submit Point y el webhook se configuran con el 106, no antes.
  - 🩸 **Incidente (27-sep, ~23:25 a ~00:03):** el cálculo activó el `score` de Typeform, que **insertó la
    columna "Score" en la O** de las dos hojas y corrió todo un lugar (Submitted = P, Token = Q, **Estado =
    R**). Los Apps Script leen por posición: el enrutador leía el Token como Estado, **saltaba cada lead
    nuevo sin error** y avanzaba su contador; KPIs y tableros leían mal. Lo detecté leyendo la hoja (no
    Mani) porque las pruebas no se procesaban. Mani aplicó el arreglo en vivo (constantes +1, `panel.gs` de
    Tactical, `lastProcessedRow` = 2639 / 4204 y `procesarLeadsNuevos`). Verificado: las 3 filas afectadas
    quedaron clasificadas (1 lead real de ComunicArte, Con Calendly; 2 pruebas, Descartado). Detalle y
    reglas en `work/retia/apps-script-sheets/README.md` (la copia de los scripts quedó al día) y en
    `docs/operations.md` §9. **Lección: "no llega a la hoja" no era lo mismo que "no cambia la hoja".**
  - **Pendiente de Mani:** borrar las 2 filas de prueba ("PRUEBA CRM - BORRAR") de la hoja principal y de
    Descartados en las dos hojas.
  - **Siguiente:** el 052 (ya desbloqueado) y el 106.
- **2026-09-27 (CIERRE 33): merge de las dos sesiones y el 103.** Sesión de Mani, noche.
  - **Merge** (`17d279d`): quedó el E2 de Alejandro (está en `dev`); se descartaron el 043 y el 044
    duplicados de la sesión de Mani; se conservaron el 094 y los ADR 0054/0055. Subido.
  - **103** (Kiro, revisado): migración **0026** (`deals.cohorte_destino_id`, `motivos.tipo` con cuatro
    listas; los 8 motivos de `dev` quedaron `perdida`), aplicada en `dev`. El motor: cohorte destino
    aparte (la de origen no se muda), motivo de la lista de la flecha (P perdida, T29 reagenda, T15
    retroceso, R recuperación; A1/A2 aceptan cualquiera), solo el dueño o un administrador mueven (el
    administrador también los sin dueño, confirmado por Mani), "la llamada sucedió" mira la más
    reciente (bug de la segunda llamada), `deals.motivo_id` al perder, y `datos` escritos en la misma
    transacción que el movimiento (si se rechaza, no queda nada).
  - 🩸 **Lección:** dos personas tomaron E2 el mismo día sobre el mismo `main`, sin saberlo. Antes de
    tomar un ticket: `git fetch` y mirar el tracker de `origin/main`.
  - **Medido:** 880 tests, typecheck y lint limpios.
  - **ADR 0056** escribe las decisiones del 103 (cohorte destino, cuatro listas, quién mueve, datos en el
    mismo movimiento, la llamada más reciente, motivo al perder).
  - **Motivos (ticket 104, bloqueado por los closers):** Mani preguntó en qué se fundamentaban. Las cuatro
    LISTAS salen de la tabla de transiciones; los 8 motivos de `dev` **no**: se sembraron el 16-sep (ticket
    012) sin leer las hojas. Se leyeron todas las pestañas fuente de las DOS hojas: el equipo ya tiene
    una taxonomía idéntica en ambas (`_ListasDropdown`: FIN-1/2, FIT-1/2/3, FU-1..5, RD-1, PRA), llenada
    solo en el 27% de las llamadas de Tactical y el 5% de las de ComunicArte, con el resto del porqué en
    texto libre. Criterio de Mani: **basarse en lo que ya usan, estandarizarlo y mejorarlo solo donde haga
    falta.** La propuesta y las preguntas están en el ticket; su tabla sirve además de mapa para la migración.
  - **104 hecho, por decisión de Mani** (*"las que usan, estandarizadas, agreguemos las necesarias,
    descriptivas; reduce si se puede"*): son 13 motivos en frases completas (6 de perdida, 2 de reagenda, 3
    de retroceso y 2 de recuperación), cargados en `dev` por el molde con `scripts/cargar-motivos.ts`
    (idempotente). Las 8 semillas viejas se borraron porque ninguna tenía uso. El mapa de las subcategorías
    de la hoja para la migración quedó en el ticket.
  - **Bug arreglado:** `lib/catalogo/motivos.ts` no declaraba quién lo referencia (`calls`, `deals`,
    `deal_etapa_historial`), así que borrar un motivo usado reventaba con la FK en vez de desactivarlo.
    Hay un test.
  - **Usuario nuevo en `dev`:** `manuelmejiaarana@gmail.com` como developer, que es el actor de los scripts
    (`SCRIPT_ACTOR_EMAIL` en `.env.local`, que estaba vacío).
  - ⚠️ Las pestañas `Cartera` de las dos hojas no tienen encabezado: un script que filtre datos personales
    por nombre de columna los deja pasar. Leerlas con cuidado.

- **2026-09-27 (CIERRE 32): E2 cerrada, el motor de etapas existe.** Alejandro, sesión de la tarde.
  Commits `134d293` a `5087b6a`, todos en `main`.
  - **Lock** resincronizado (`134d293`). No se reprodujo la falla de `npm ci` en Windows con npm 11;
    el lock nuevo solo agrega entradas opcionales de `@emnapi` y pasa `npm ci` limpio.
  - **043:** Seguimiento entra al enum (migración **0024**). 🩸 **`dev` ya tenía una 0024 que no estaba
    en el repo** (`ADD VALUE 'seguimiento'`, aplicada ~12:28 del 27-sep, casi seguro por Mani): la fila de
    `drizzle.__drizzle_migrations` no casaba con ningún archivo. Se alineó el repo **byte a byte** con lo
    aplicado (mismo SQL, mismo hash `8fefdd19578a`, mismo `when`), por eso `seguimiento` queda al final del
    enum. **Si Mani sube su 0024, se conserva una de las dos**: el contenido es idéntico. La tabla de
    transiciones es dato en `lib/deals/etapas.ts`; su test recorre las 121 combinaciones contra una matriz
    escrita a mano desde `structure.md` §3.1.
  - **044:** `queLeFalta(de, a, hechos)` en `lib/deals/requisitos.ts`. El requisito es de la **flecha**, no
    de la etapa destino (volver a En Contacto por A1 no pide contacto). El motivo es el id del catálogo.
  - **045:** `moverEtapa()` en `lib/deals/mover-etapa.ts` (no en `etapas.ts`, que se queda pura; ADR 0037
    corregida). Transacción real; el rastro es `deal_etapa_historial` y **no** `change_log` (lo decía
    `lib/crm/rastro.ts`), así que el motor es la excepción nombrada del guardián de rastro. Los hechos los
    lee el motor, nunca el llamador; un `Actor` sistema o usuario (403 si toma una flecha ajena); reja de
    concurrencia `where etapa = de` (409). Migración **0025**: `deals.acuerdo_pago` y
    `deals.fecha_limite_pago` (ADR 0053, adelantadas del 061) y `deals.fecha_seguimiento`.
    `lib/queries/saldo.ts` vuelve (ADR 0024): con monedas mezcladas el saldo es `null`.
  - **Tres decisiones de la sesión, para que Mani las revise:** (1) cohorte destino **sin columna**:
    Próxima Cohorte exige que `deals.cohort_id` sea una cohorte `futuro`; (2) "la llamada sucedió" = una
    llamada vigente con resultado `show`, `compromiso_pago`, `cerrada` o `perdida` mientras `calls` no
    tenga Grain (058); (3) crear un deal **también** vive en el motor (`abrirDeal`, 047).
  - **046:** `tests/motor-etapas-guardian.test.ts` caza `update(deals)` con etapa, SQL crudo,
    `editarConRastro` con etapa y la llave `desdeElMotor: true` fuera del motor; y `lib/crm/rastro.ts`
    rechaza la etapa de un deal en tiempo de ejecución si no viene del motor. Mordido en los dos sentidos.
  - **047:** `abrirDeal()`: a mano nace en 1, 2 o 6 con quien lo crea de dueño (6 exige producto + fecha
    límite); el sistema abre en 1 o 4. Primera fila de historial (`de` nulo) + rastro en una transacción;
    el lead tiene que ser del mismo programa; un segundo abierto es 409.
  - **Queda para quien llame al motor:** el 052 (abrir y mover desde el sync), `deals.motivo_id` al perder
    (hoy el motivo vive solo en el historial) y la reja de permisos por rol en la acción (quién puede mover
    qué deal).
  - **Siguiente:** A1 y A2 (Mani) desbloquean E3; sin ellas, el 094.
- **2026-09-27 (CIERRE 32, sesión de Mani en paralelo): 043, 094 y A1/A2 cerradas.** El 043 y el 044 de esta sesión se descartaron al fusionar (CIERRE 33): quedaron los de Alejandro.
  - **043 hecho (Kiro, revisado):** `lib/deals/etapas.ts` con la tabla de `structure.md` §3.1 como dato
    (55 flechas de 121; T11 fuera; P desde las nueve abiertas; R solo a 2, 4 o 9; Completo solo sale
    por A2). Test de las 121 combinaciones contra una lista escrita a mano
    (`tests/etapas-transiciones.test.ts`). Corregido a mano: el comentario decía "ocho" abiertas y son
    nueve (el ticket se escribió antes de Seguimiento). **A1 quedó como cuatro flechas** (de Abonado a
    las cuatro etapas que llegan a él): el 045 tiene que elegir la correcta mirando el historial.
  - **Migración 0024** (`ALTER TYPE etapa_deal ADD VALUE 'seguimiento'`), generada y aplicada en `dev`
    por la sesión principal. Producción no existe todavía.
  - **094 hecho (Kiro, revisado):** `lib/auth/alcance.ts` (`programasVisibles` y derivados, con
    `esAdministrador` y el rol de vista). Lo usan el dashboard, el selector, el sidebar,
    `buscarPersonas` y `historialDePersona`; un programa ajeno es 404. Guardián en
    `tests/alcance-de-sesion.test.ts`. **Fuera a propósito:** `programasGestionablesPorUsuario` (otra
    pregunta: dónde se edita) y `/recursos`, que sigue mostrando recursos de todos los programas a un
    closer (si Mani lo quiere acotar, es ticket aparte).
  - **Medido:** 710 tests, typecheck y lint limpios, con los dos juntos.
  - **A1 → ADR 0054.** Leído el Apps Script de las dos hojas (`work/retia/apps-script-sheets/`): las
    mismas cuatro reglas, no un puntaje. Typeform puede mandar una variable de texto en el webhook
    (verificado en el payload de ejemplo). Mani: T2 se queda como validador.
  - **A2 → ADR 0055.** Mani: el programa sale de la URL ("cada programa tiene su forms URL asignado");
    los parciales llegan con un partial submission point.
  - **Quedaron abiertos:** los dos puntos recomendados del ADR 0055; la carpeta `.claude/sdd-cache/`
    (dejada por Kiro, sin tocar).

- **2026-09-27 (CIERRE 31): plan consolidado y documentación centralizada.** Solo documentos (y
  comentarios del código que citaban rutas borradas); sin lógica ni migraciones.
  - **Por qué:** Comercial dio luz verde. Mani pidió el plan completo en un solo lugar, sin inventar
    nada, y después toda la documentación de `docs/` centralizada, sin perder lo valioso y sin ruido.
    Granola no tiene reuniones del CRM después del 24-sep; la de ese día ya estaba en el repo.
  - **Quedó así:** `docs/plan.md` (plan de implementación: tracks, orden §5, criterios §6, decisiones
    abiertas §7 con las fichas técnicas en §7.1, mapa y equivalencias de referencias viejas §8),
    `docs/overview.md` (la herramienta de principio a fin, los programas, roles e historias de usuario,
    métricas, alcance, criterios, historia, vocabulario), `docs/structure.md` (operación de hoy, flujos,
    motor de etapas con la tabla de transiciones, arquitectura, modelo de datos, ingesta, atribución,
    pantallas, sistema de diseño Tinta, mapa de las hojas, migración) y `docs/operations.md` (entornos,
    **URLs de cada programa**, variables, base, scripts, despliegue, secretos, incidentes, deuda, datos
    de validación). Se fundieron y se borraron: spec, plan v2, diseño, sistema de diseño, mapa de las
    hojas, glosario, auditorías e insumos (siguen en `git show da68cdf:<ruta>`).
  - **ADR:** 38 vigentes, reescritos para decir la decisión actual sin capas de enmiendas (0004 y 0037
    cambiaron de nombre de archivo). 16 retirados; `docs/adr/README.md` es el índice y dice dónde quedó
    lo vivo de cada uno, porque el código los cita. Mani decidió no empezar de cero: se conservan los
    números.
  - 🆕 **Decisiones nuevas de Mani:** el `Estado` lo asigna el formulario con su scoring (A1, choca con
    T2); el webhook es nuestro y estándar para cualquier formulario (A2); **las URLs de cada programa se
    guardan completas en el repo** (revierte S-13; las hojas se siguen compartiendo solo con cuentas
    concretas).
  - **Medido:** 681 tests en verde, typecheck y lint limpios. 🩸 **`npm ci` falla** (lock sin
    `@emnapi/*`); un `node_modules` viejo tira 46 tests por falta del driver `postgres`. `DB_PROD` sigue
    vacía: producción en Supabase no existe.
  - **Tracker:** solo estado; 048, 049, 050, 051 y 053 pasan a `en curso`. Sus secciones narrativas se
    movieron a plan, ADR, overview y operations.
  - ⚠️ **Quedó sin tocar `docs/insumos/notas-segundo-cerebro/retia-crm-reunion-closers-2026-09-24.md`:**
    no está en git ni en el vault (apareció el 27-sep a las 11:42) y es una versión previa de la
    propuesta del 24-sep, sin contenido propio. Borrarlo sería irreversible: lo decide Mani.
  - **Siguiente:** que Mani cierre A1 y A2 (van a ADR con `/grill-with-docs`); con eso se crean los
    tickets del webhook y del Estado. Sin esperar: el 043 y el 094.

- **2026-09-24 (CIERRE 30): reunión con los closers; el track de implementación queda desbloqueado.**
  Solo documentos, sin código ni migraciones.
  - **Reunión:** Mani con Andrea, Maru y Jero, 24-sep 3:35 pm. Transcript (pegado por Mani; el
    conector de Granola no lo sirve en el plan gratuito) con quién dijo qué en
    `docs/insumos/fleeting/2026-09-24-reunion-closers-crm.md`.
  - **Resultado:** propuesta §0. Validado: las 11 etapas, Grain para Atendido, Calendly por closer y
    programa, Setteo por reclamo, onboarding con `onboarded_at`. Nuevo: el Setteo viene ordenado por
    ingreso declarado (más de 10.000, más de 3.000...) y recencia; el dolor número uno es registrar
    después de varias llamadas seguidas; acuerdos de pago conversacionales, pagar todo antes del inicio
    del programa (máximo a la mitad), piden nota + fecha límite; los closers no traen leads propios.
  - **Pendientes con personas:** Jero consigue la reunión con Pauta (UTM, prioridad altísima). Mani
    arregla los push de Juanito (fuera del repo).
  - **Actualizados:** propuesta (§0 nueva, §2.1, §2.5, §3.7, §5 puntos 17-22, §6), tracker (banner y
    decisiones pendientes), AGENTS.md, tickets 043, 061, 070, 071, 086, 096 y 099.
  - **Mani adoptó las tres recomendaciones** el mismo día: tabla de transiciones completa (D2), ADR 0053
    (acuerdo de pago = nota + fecha límite, enmienda el 0041, ticket 061 reescrito) y P1.
  - **Siguiente:** arrancar E2 por el 043.

- **2026-09-24 (CIERRE 29): dirección de producto y UI, solo documentos.** Sin código ni migraciones.
  Preparación de la reunión con Comercial (closers). Lo que quedó escrito:
  - **Documento de referencia y guía del desarrollo:**
    `docs/auditorias/propuesta-crm-y-reunion-comercial-2026-09-24.md` (copia de trabajo de Mani en
    `~/Downloads`). Está sujeto a cambios después de la reunión.
  - **ADR 0048 a 0052:**
    - 0048: un closer ve solo los programas de su membresía, y "todos los programas" en el Dashboard
      suma solo lo sumable.
    - 0049: Calendly cuelga cada llamada de su deal; si hay duda, la llamada queda suelta.
    - 0050: navegación por objetos, con Inbox y una tab Dashboard.
    - 0051: convención de UTM (tres se leen, dos se capturan, el closer va en `utm_content`) y el
      builder de links.
    - 0052: el rol Paid Trafficker.
    - Enmiendas anotadas en los ADR 0009, 0015, 0021, 0025, 0037, 0039, 0043, 0044, 0045 y 0046.
  - **Tickets 094 a 102** nuevos, y enmiendas en unos 25 existentes.
  - **Decisión de Mani del mismo día:** Seguimiento es la etapa 11; un deal tiene muchas llamadas y nunca
    se duplica; la conversión cuenta deals distintos.
  - La tabla de transiciones (ticket 043) y el Inbox quedan 🟡 hasta validarlos con los closers.
  - Actualizados también: spec, plan v2 §13, glosario, tracker, AGENTS.md, la revisión del 22-sep §5c,
    `design.md`, `design-system.md` y `estructura-bbdd.md`.
  - **Siguiente:** bajar lo que digan los closers en la reunión (preguntas en el documento §6).

- **2026-09-23 (CIERRE 28): decisiones pendientes enviadas a Mani por WhatsApp.** Sin cambios de
  codigo. Se le pidio cerrar D2 (transiciones: 1->4, 3->5, 5->9, 6->9, 8->10, retrocesos como
  segunda lista, donde vive la "fecha prometida"), los deals historicos (~2.400), D3, D4, D5, y un
  si/no rapido a R2-R5, R7, P1, T4 y `tz_fechas='UTC'` en `dev`. Se le dijo que con D2 + historicos
  arranca la etapa 2.
  - **Al llegar la respuesta:** volcarla en las secciones `Respuesta` de
    `docs/auditorias/revision-modelo-hubspot-2026-09-22.md` y ajustar los tickets 043, 044, 047,
    052 y 058.
  - R1/R11 quedaron resueltas de hecho por la mudanza a Supabase (ADR 0047); falta marcarlas asi
    en el documento.
  - El tracker va atrasado: 048-050 y T2 estan en codigo pero siguen como `todo`.
  - Sin esperar a Mani se puede tomar el 093 (filtros UTM) o el CI (R4).

- **2026-09-23 (CIERRE 27): paleta de la agencia.** Daniel Tovar pidio blanco, negro y morado:
  el morado de Nubank (`#820AD1`) sobre blanco y un lila (`#B57BFF`) sobre negro.
  - Tokens en `app/globals.css`, contrato en `docs/design-system.md`.
  - El morado es el unico acento, **incluido el boton principal**: antes era verde y los botones
    iban en tinta.
  - La tinta azulada paso a negro neutro.
  - El verde queda solo como tono `exito`.
  - Se intensifico un poco a pedido de Alejandro: fondo de trabajo `#f6f4f9`; `secondary` y
    `accent` en lila suave; el item activo del marco con fondo lila.
  - **No hubo recorrido visual con clics:** la extension de Chrome no estaba conectada. Alejandro
    lo reviso en su navegador.
  - 🩸 El `next dev` de Alejandro, con horas corriendo, murio con "Jest worker encountered 2 child
    process exceptions" en `/programas/[slug]`, probablemente despues de que se intento levantar
    un segundo `next dev` sobre la misma `.next`. **Antes de arrancar un servidor, mira si ya hay
    uno en el 3000.** Si aparece ese error, se reinicia el servidor: no es un error del codigo.

- **2026-09-23 (CIERRE 26): calificacion (T2) y motor de scoring (T4).** Sin commit.
  1. **`lib/ingesta/calificacion.ts`** aplica las cuatro reglas del Apps Script con la
     configuracion de `sources.calificacion` (por fuente). `ingerirEntradas` califica cada envio y
     el lead toma la calificacion de su envio completo mas reciente.
  2. **Validado contra el historico real:** 6.397 de 6.400 envios coinciden con el Estado de la
     hoja. Las 3 diferencias, todas de Tactical, estan en la ficha T4.
  3. **Migracion 0023, aplicada en `dev`:** solo agrega columnas.
     - `sources.calificacion`;
     - `submissions.calificacion / puntaje / version_puntaje`;
     - `leads.calificacion / puntaje`;
     - enum `calificacion_envio`.

     `leads.estado` **no se toca** (D4 sigue abierta).
  4. **El puntaje no tiene pesos a proposito.** No hay datos de venta con que calibrar; la ficha
     **T4** en el documento de revision lleva opciones, recomendacion y preguntas para Mani.
  5. La configuracion real esta en `scripts/seed-datos.ts`. **En `dev` las fuentes siguen sin
     `calificacion`**, y `esquemaFuente` (`lib/catalogo/fuentes.ts`) todavia no la edita: cargarla
     por el molde del ADR 0029 es parte del traslado (T3).
  6. 681 tests en verde; typecheck y lint limpios.

- **2026-09-23 (CIERRE 25): la ingesta ya escribe.** Sin commit.
  1. **`ingerirEntradas`** en `lib/ingesta/ingerir.ts` hace esto, en una transaccion, por lotes
     e idempotente:
     - construye los envios;
     - resuelve la identidad;
     - crea los leads;
     - hace upsert de los envios;
     - escribe los contactos con su envio de origen;
     - **recalcula** el resumen del lead desde sus envios (`change_log` solo para leads que ya
       existian).

     La frontera de programa se enforza con un 422 y no se escribe nada. Tests:
     `tests/ingesta-escritura.test.ts` (11). Suite en **666** verdes; typecheck y lint limpios.
  2. 🩸 **Migracion 0022, aplicada en `dev`.** `submissions_fuente_token_idx` pasa a
     `(source_id, token, es_parcial)`. Con el indice viejo, la parcial y la completa del mismo
     token (ADR 0036 punto 4) no podian convivir. Se comprobo el test contra el indice viejo:
     falla. Produccion todavia no existe; cuando exista, la 0022 entra con las demas.
  3. **Decisiones tomadas en el codigo, a revisar:**
     - dos versiones de una misma parcial se funden (gana la ultima posicion);
     - un reintento no reasigna el lead de un envio que ya tenia uno;
     - `numAplicaciones` cuenta tokens distintos;
     - los campos de perfil (nombre, cargo, etc.) **no** se llenan todavia: quedan en `respuestas`.
  4. **Siguiente:**
     - T2, la regla del `Estado` por fuente, encima de `ingerirEntradas`;
     - T1, el webhook: falta el payload real de Typeform;
     - T3, el script de traslado con `entradasDesdeMatriz` → `ingerirEntradas`.

- **2026-09-23 (CIERRE 24): la base se mudo a Supabase y la app tiene sistema de diseno.**
  Commits `11c563a`, `a95e25a` y `1a45a1f`, sin push. Decisiones del chat con Mani del 22-sep en
  `docs/auditorias/revision-modelo-hubspot-2026-09-22.md` §5b (S1-S2, T1-T3).
  1. **Supabase (ADR 0047, reemplaza al 0018).**
     - Driver: `drizzle-orm/postgres-js` con `prepare: false`. `ejecutarJuntas` es una
       transaccion real y corre en orden. Sale `@neondatabase/serverless`.
     - Guardian nuevo `tests/base-portable.test.ts`: nada fuera de `lib/db/` importa el driver.
     - Proyecto `dev`: ref `hfqmiyiuyqapdsbywrag`, region `us-east-2`, org de Retia en plan
       gratis.
       - `DATABASE_URL` va por el pooler en modo transaction (6543).
       - `DATABASE_URL_DIRECTA` va por el pooler en modo session (5432): la conexion directa es
         solo IPv6 y no resuelve desde la red de Alejandro.
       - `.env.local` arma las dos URLs desde `SUPABASE_DB_PASSWORD`.
     - **Todavia no existe el proyecto de produccion** (`DB_PROD` vacia).
     - Base VACIA por decision de Mani: 22 migraciones aplicadas; sembrado con `seed:datos` y
       `seed:users`.
     - Usuarios: `administrativa@retiagrowth.com` (gerente) y `a.davila0423@gmail.com`
       (developer). `fdavilaceron@gmail.com` quedo inactivo.
     - **Faltan los enlaces de pago:** el JSON lo tiene Mani.
     - 🩸 **Recien migrada, las 25 tablas eran legibles por `anon`** con la llave publica. La 0021
       las cierra con RLS sin politicas + REVOKE, y `tests/rls-en-todas-las-tablas.test.ts` exige
       RLS en cualquier tabla futura.
     - Data API **apagada** en el dashboard de `dev` (confirmado por Alejandro el 23-sep): segunda cerradura sobre la 0021. Repetir en produccion cuando exista.
     - 🩸 Al cambiar de driver se cayo el build: `recursos-pantalla.tsx` (cliente) importaba
       `MONEDAS` de un modulo que arrastra `lib/db`. Con Neon (`fetch`) el cliente de la base
       se empaquetaba en el navegador sin error. `MONEDAS` quedo en `lib/monedas.ts` y dejo de
       estar escrita dos veces.
     - Probado de punta a punta: login con Google y dashboards contra Supabase, sin errores de base.
  2. **Sistema de diseno "Tinta"** (elegido entre Pizarra, Tinta y Cabina; comparacion en
     https://claude.ai/artifact/KRmpzsKbSk7ry8PuT92rCh).
     - Contrato en **`docs/design-system.md`**, lectura obligatoria desde AGENTS.md antes de
       tocar una pantalla.
     - Tokens en `app/globals.css`.
     - 🩸 **La app nunca uso Geist:** `--font-sans: var(--font-sans)` era circular y todo caia a
       la fuente del navegador. Arreglado.
     - Marco oscuro con `data-zona="marco"`, que redefine los tokens dentro de la barra.
     - Hoja clara en `PageShell`, tarjeta con `shadow-tarjeta`, `Badge` con cinco tonos de
       estado, utilidad `cifra`, y la tabla etapa -> tono para el Kanban.
     - **Las pantallas de administracion no se repasaron una por una:** heredan los tokens.
  3. **Siguiente (parte 2, T1-T3):**
     - escritura de la ingesta sobre `lib/ingesta/`;
     - regla del `Estado` por fuente;
     - webhook de Typeform (firma, `form_id` -> fuente, excepcion en `proxy.ts`);
     - traslado desde Sheets.
     
     Para el webhook falta **un payload real de Typeform** y confirmar si Typeform manda los
     envios parciales.

- **2026-09-22 (CIERRE 23) — Lo que se pudo adelantar sin decisiones: verificacion, zona
  horaria, limpieza e ingesta pura.** Commits `a12c43e`, `3331f03`, `b7b18bd`, `b9c99a9`, sin
  push.
  1. **Verificacion.** `npm ci` fallaba: al lock le faltaban los esbuild 0.28.2 opcionales.
     Reparado con `npm install`, sin cambiar versiones directas. Typecheck y lint limpios. **650
     tests en verde** (611 + 39 nuevos). En la corrida completa 4 tests dan timeout por carga, pero
     pasan solos.
  2. **053, zona horaria por fuente.** `parsearFecha(celda, zona)`; el sync pasa
     `sources.tz_fechas` fila por fila; una zona inexistente es 422 antes de escribir. 🩸 **El
     desfase de 5 h esta CONFIRMADO por evidencia documentada**
     (`flujo-de-leads-y-closers-retia.md:251-256`: `Submitted At` 23:05 sellado a las 18:08 de
     Bogota), no medido aqui porque **este checkout no tiene `.env.local`**. El codigo es
     **inerte** hasta poner `tz_fechas='UTC'` en las dos fuentes reales. Eso es escritura en
     `production` y pide el ok de Mani; despues el sync repara solo, con bitacora, ~4.800 fechas.
  3. **Limpieza.**
     - `esquemaAbono` valida `dealId`.
     - Comentarios que citaban archivos borrados.
     - El byte NUL de `lib/closers/identidad.ts` pasa a escape: ya no es "binario" para `grep`.
     - 🩸 **`lib/queries/saldo.ts` y `tests/saldo-centralizado.test.ts` NO EXISTEN desde el corte
       0020**, aunque AGENTS.md y el ticket 060 hablaban de ellos como vivos. Anotado en los dos:
       el 060 los **recrea** desde `git show 722a47f^:lib/queries/saldo.ts`.
  4. **Ingesta pura (048-050), en `lib/ingesta/`.** Todo pasa por `construirEnvio`, que convierte
     una entrada en un Envio (una fila de hoja y un webhook dan lo mismo);
     `entradasDesdeMatriz` es el adaptador de Sheets y `resolverIdentidad` decide a que lead va
     cada envio. **Nada escribe en la base**, y los tres tickets siguen en `todo` con su avance
     anotado. Decisiones a revisar, escritas en los tickets:
     - correo y telefono no se promueven y quedan en `respuestas`;
     - "parcial" = fecha nula;
     - un telefono con menos de 7 digitos es un centinela;
     - hay que pasar los contactos que hoy viven en `leads` como `conocidos`.

- **2026-09-22 (CIERRE 22) — Revision del modelo HubSpot, la arquitectura y el plan; D1
  decidida.** Sesion sin codigo. Entregable:
  **`docs/auditorias/revision-modelo-hubspot-2026-09-22.md`**, con una ficha por decision
  (contexto, opciones, recomendacion, que toca, esfuerzo, `Estado`, `Decide`). El tracker lleva un
  aviso arriba: no tomar el 043 ni abrir E1b hasta cerrar las fichas. Commits `4a86bde`, `9283e0f`,
  `6e31a61` y el de este cierre, **sin push**.

  **Metodo.** Se leyeron los 46 ADR, la spec, el plan v2, los tickets 036-093 y el codigo. Se leyo
  **por API y solo en lectura el HubSpot de 30X** (portal 50929115), de donde salieron las 10
  etapas. La Personal Access Key se canjea en `POST /localdevauth/v1/auth/refresh`, y el token de
  usuario **no puede** leer pipelines, flows ni forms: las etapas se reconstruyeron de las
  propiedades `hs_v2_date_entered_*`. Codex no participo porque no tenia cuota. Tests y typecheck
  **no se corrieron**: este checkout no tiene `node_modules`.
  ⚠️ La respuesta del canje devolvio la llave y quedo en el log de la sesion: **conviene rotarla**.

  **Lo que ensena 30X.** Tiene 15 pipelines, uno por programa, con ~11 etapas copiadas en cada
  uno; ~190 propiedades custom con duplicados; el dinero en campos del deal mas un pipeline de
  Cobranza; cuatro juegos de UTM mas `fbclid` y Ad IDs; y Calendly integrado. Retia acierta con
  las etapas globales, el dinero en tablas y el `jsonb`.

  ✅ **D1 decidida por Mani: el setteo VIVE EN EL DEAL.** Se conservan las 10 etapas del ADR 0037,
  sin enmienda. Consecuencias que quedan abiertas:
  1. El primer sync v2 crearia **~2.400 deals** en Pendiente Setteo (1.532 Tactical + 901
     ComunicArte). Hay que decidir si solo para leads nuevos desde el corte o tambien historicos.
  2. El Kanban lleva la etapa 1 como tabla para reclamar, no como columna (070). El embudo reporta
     la conversion desde Setteo **y** desde Agendado: asi el 0,9% contra 2,6% son dos metricas
     correctas y no una disputa (065).
  3. Setteos que nadie toca: decidir si caen solos a Perdido ("sin contacto") despues de X dias.
  4. Reportar lo Perdido segun **de que etapa venia** (sale de `deal_etapa_historial`, sin etapa
     nueva).

  **Opinion sobre las etapas (22-sep), para sumar a D2 antes de congelar el pgEnum:**
  a) **Atendido** no puede depender solo del link de Grain: una llamada por WhatsApp o sin grabar
     deja el deal trabado. Debe entrar con Grain **o** con el closer marcando "sucedio".
  b) **Proxima Cohorte** sin cohorte destino (o fecha de retomar) se vuelve un cementerio.
     Exigirla al entrar, y que el deal reaparezca cuando esa cohorte abra ventas.
  c) El numero de etapa **no es el orden del embudo** (Re-agenda es la 3 y viene despues de
     Agendado, la 4). El 052 dice "deal en 4 o mas": comparar numeros da resultados raros sin
     error. Toda regla nombra la lista explicita de etapas.

  **Sigue por decidir (fichas del documento):**
  - D2: la tabla del 043 tiene huecos. Falta 1->4, nada lleva a 9, falta 3->5, 8 "terminal" choca
    con Perdido, el retroceso del 047 choca con la lista blanca, y la "fecha prometida" no tiene
    columna.
  - D3: Abonado cuenta como deal "abierto" y bloquea un upsell. La clausula `anulado_en IS NULL`
    del indice no esta en el ADR 0037.
  - D4: tabla `estado_hoja -> accion` por programa.
  - D5: UTM duplicado entre `leads` y `submissions`.
  - R1 + R11: `node-postgres` con Pool (transacciones reales). Hoy los tests corren
    `db.transaction` y produccion `db.batch`: el camino de produccion no lo prueba nadie. De paso
    la base queda portable a Supabase. **Supabase se evaluo y hoy no compensa migrar**; la
    decision es no cerrarse la puerta.
  - R2: rastro por triggers. Ojo: `lib/closers/identidad.ts:80` tiene un byte NUL literal que hace
    que `grep` lo trate como binario.
  - R3: Vercel Pro. Hobby es de uso no comercial y el cron es diario.
  - R4: CI. R5: Playwright. R6: capturar `utm_content`/`fbclid` en el formulario aunque no se lean.
  - R7: webhook de Calendly en E4. R8: la ingesta pensada para el webhook.
  - P1: operacion antes que analitica. P2: correcciones a E1b (el indice unico **no** impide
    empates por los NULL). P3: reducir `AGENTS.md` y este handoff.

  🩸 **Posible bug de hoy, sin medir:** `parsearFecha` fija `-05:00` (`lib/sheets/mapeo.ts:147`)
  y `sources.tz_fechas` no lo lee nadie. Si las hojas de Typeform vienen en UTC (scaffold §5.2),
  **todas las fechas tienen 5 h de desfase**. Medir contra una fila con hora conocida.

- **2026-09-21 (CIERRE 21) — `docs/insumos/notas-segundo-cerebro/`: el second brain entra al repo
  como material crudo, sin tocar codigo.** Sesion de documentacion pura, pedida por Mani para que su
  companero de trabajo tenga el mismo contexto del refactor sin acceso al vault.

  **Que se copio (verbatim, con una nota de procedencia arriba de cada uno):**
  `crm-retia-modelo-hubspot-scaffold.md` (el diseno consolidado), `crm-explicado-simple.md` (la
  version para explicarlo sin abrir codigo) y `reunion-alejo-2026-09-21.md` (la nota reconciliada de
  Mani sobre esa reunion — distinta del insumo crudo de Granola que ya vivia en
  `docs/insumos/fleeting/2026-09-21-reunion-alejo-areas-y-utms.md`, un nivel menos procesada; no son
  el mismo archivo).

  **Que se fusiono:** `flujo-de-leads-retia.md` y `flujo-closers-retia-sheets.md` del vault
  reconstruian lo mismo el mismo dia (2026-09-20, leyendo los dos Sheets y los `.gs` de Apps
  Script) y se solapaban tanto que Mani pidio juntarlos en uno. Veredicto sobre cual era mas
  *accurate*: no eran contradictorios, sino de distinta profundidad — donde se solapan,
  `flujo-closers-retia-sheets` es la mas confiable porque cada afirmacion cita su prueba en el
  codigo o en los datos (timestamps, conteos, el incidente real de los 462 leads perdidos), y el
  propio `flujo-de-leads-retia` ya remitia a ella para esa parte. Resultado en
  `flujo-de-leads-y-closers-retia.md`: la primera nota como columna vertebral (cubre todo el viaje,
  de anuncio a cartera y atribucion), con la evidencia de la segunda inyectada donde correspondia,
  sin repetir cifras. **Los originales del vault quedaron intactos** — la fusion vive solo en el
  repo; si mas adelante Mani quiere que tambien reemplace las dos notas sueltas alla, queda
  pendiente de que lo pida.

  **Por que en `docs/insumos/` y no una carpeta nueva:** el repo ya tenia esa convencion para
  material crudo sin reconciliar (`fleeting/`, `historico-c2/`); `notas-segundo-cerebro/` es
  el mismo patron para las notas de analisis de Mani. `AGENTS.md` gano un sexto documento de
  referencia explicandolo, para que una sesion futura sepa que existe sin tener que encontrarlo por
  casualidad.

  Sin cambios de esquema, codigo ni tickets.

- **2026-09-21 (CIERRE 20) — La reunion con Alejo Carvajal abre la etapa E1b: el origen y la
  atribucion.** Sesion sin una linea de codigo: extraccion, medicion, tres ADR y nueve tickets.

  **De donde salio.** Primera reunion de stakeholder del rol de Ops. ⚠️ **Sin transcript** (el plan
  de Granola es gratuito y no los sirve), asi que se trabajo sobre las notas privadas de Mani —que
  se cortan a mitad de frase— y el resumen automatico. De las siete preguntas preparadas, solo dos
  dejaron rastro; cuatro mas las contesto Mani despues por chat. Insumo crudo en
  `docs/insumos/fleeting/2026-09-21-reunion-alejo-areas-y-utms.md`.

  🩸 **El hallazgo que ordeno todo.** Retia se organiza en cuatro areas (Gerencial, Comercial,
  Pauta, Media) y el dolor de Gerencia es *"cantidad de leads por area"*. `grep` sobre `docs/`
  devolvia **cero** para "area". Y el numero pedido, calculado hoy, **mostraria Comercial en cero**:
  un lead que trae un closer no deja rastro en ningun UTM. **No falla: miente**, que es la clase de
  bug de la que este repo ya sangro tres veces.

  🩸 **El segundo hallazgo, medido contra el esquema.** `ad_spend` guarda la campana en **texto
  libre** y el lead trae `submissions.utm_*`. **No se pueden cortar con la misma llave**, asi que no
  hay CPL rebanado sin comparar cadenas entre dos sistemas que no se hablan — el ADR 0030 otra vez.

  🩸 **El tercero, medido contra los consolidados C2 de Michael.** `utm_content` significa
  **anuncio** en ComunicArte y **conjunto** en Tactical. Cualquier codigo que escriba "utm_content
  es el anuncio" esta bien en un programa y mal en el otro, **sin lanzar un error**.

  **Lo que se midio en vez de opinar.** Mani pregunto si convenia normalizar `(correo, programa)`
  con una tabla `personas`. Consulta de solo lectura contra `production` (rama
  `br-withered-mud-b4cvvg80`, verificada por `neon.branch_id`): **4.823 filas, 4.818 correos
  distintos, y solo 5 correos en los dos programas (0,1%)**. Se descarto: normalizar costaria una
  junta en cada consulta, reabriria la identidad a escala de empresa —la regla del telefono del
  ADR 0035 empezaria a cruzar programas— y **construiria el puente por el que un `join` cruza la
  frontera**, todo para modelar cinco filas. La visibilidad cruzada se da con una **proyeccion**
  (`otrosProgramasDelCorreo`, ticket 091) que **ninguna metrica usa**.

  **Decisiones de Mani, todas del 21-sep:** el area entra al CRM y agrupa leads **y** deals; el
  origen acepta que un lead llegue por humano; a los closers se les ensena el CRM completo **sobre
  el modelo, no sobre la app** (la UI que corre es la del MVP, sobre el modelo que se reemplaza); el
  enlace de captacion es por closer **y programa**; el lead traido **no se auto-asigna**; y el
  significado de cada campo UTM **se estandariza**, igual para todos los programas.

  **Lo que se escribio:** **ADR 0043** (el area agrupa, el programa es frontera, y por que no se
  normaliza), **ADR 0044** (el origen humano, el enlace, y el CPL deja de preguntar por `entrada`),
  **ADR 0045** (la campana, el patron con su nivel, y el emparejamiento determinista). Tickets
  **083 a 091** y la etapa **E1b** en el tracker. `AGENTS.md` gana dos restricciones no-negociables
  y tres filas de Contratos. `docs/agents/context.md` gana la seccion *El origen y la atribucion*
  y marca como **superadas** las definiciones v1 de Lead y Persona, que contradecian al modelo v2.

  ⚠️ **Enmiendas a tickets vivos:** el **067** ya no decide el grano de `ad_spend` (lo fija el 084) y
  el **070** gana el origen a la vista, sin lo cual la regla de "el closer revisa el UTM antes de
  reclamar" es inaplicable.

  ⏳ **La ventana que hay que respetar:** los tickets **086 y 087 son de la etapa 3**, no de la 5. El
  origen lo escribe la ingesta (ticket 048) y **lo que entre antes no se puede reconstruir**, porque
  *"este lead lo trajo Maru"* no esta escrito hoy en ninguna parte. No es que este mal guardado: no
  existe.

  🟡 **Queda abierto, y es de negocio, no de codigo:** ¿un lead que trae un closer cuenta distinto
  para su comision o su meta? Y le faltan a Alejo los **success floors** (sin umbral, el tablero de
  Gerencia no puede pasar de tabla a estado) y el **mapeo UTM → area**.

  🩸 **Apendice del mismo dia: Mani encontro un hueco en el ADR 0044 preguntando por otra cosa.** Al
  proponer que el CRM cree campanas, conjuntos y anuncios para generar links, salio que **la URL
  publica del formulario no existe en el esquema**: `programs` tiene `calendly_url` y `web_url`, y
  `sources` tiene `sheet_id` y `tab` — o sea **donde CAEN las respuestas, no donde la gente LLENA**.
  `grep` de `typeform|formUrl|form_url` sobre `lib/`, `app/` y el esquema: **cero**. El enlace de
  captacion del ADR 0044 **no se puede calcular hoy**: el diseno era correcto y le faltaba el dato.

  🎯 **Y la propuesta arregla el agujero que el 0045 habia dejado abierto.** Ahi se escribio que el CRM
  **no puede** imponer el estandar de UTM porque las macros se configuran en Meta. Si el CRM **genera
  el link** y el trafficker lo pega, **si puede**. El beneficio de fondo es mayor que el estandar: con
  macros hay **dos actos independientes que tienen que coincidir** (configurar Meta, escribir el
  patron); con el link generado hay **uno solo**, porque crear el anuncio produce el link **y** su
  patron de la misma fila. **No pueden discrepar por construccion**, que es el molde de
  `crearConRastro`.

  **Y obligo a corregir el 0045 otra vez:** `ad_spend` cuelga de la **pieza**, no de la campana. Meta
  reporta gasto por anuncio; con el gasto en la campana y los leads en el anuncio, **las dos mitades
  del CPL vuelven a cortarse a distinto nivel**. Nunca se prorratea: con gasto solo de campana, el CPL
  por anuncio dice **"sin desglose"**.

  **Y la respuesta a "¿va en recursos?" es no:** un recurso es material que un closer le manda a **un
  lead**; un link de campana es **infraestructura que existe para ser rastreada**. Dos dominios, dos
  pantallas (ADR 0033). Lo que si se comparte es **el generador**, que es una sola funcion para el link
  del anuncio y el del closer. → **ADR 0046**, ticket **092**, y el **086** gana la dependencia.

  📊 **Segundo apendice: se midio que se puede hacer HOY y salio un hallazgo que nadie buscaba.** Mani
  pidio *"analizar los Leads que ya tienen UTM, es solo filtros"*. Medido contra `production`: **si
  para `utm_source/medium/campaign`**, que ya son columnas de `leads` con **4.097 de 4.823 (85%)** —de
  ahi el ticket **093, sin dependencias**—; **no para conjunto ni anuncio**, porque `utm_term` y
  `utm_content` **no existen ni en columna ni en `raw`** (cero filas) y hay que promoverlos en la
  ingesta (ticket 049). Y el limite duro: **`deals`, `calls`, `abonos`, `submissions` y `ad_spend`
  estan TODOS en cero**, asi que filtrar hoy contesta *cuantos registros trae cada canal* y nada mas:
  **ninguna tasa tiene numerador**.

  🎯 **El hallazgo suelto:** la brecha de atribucion es **muy desigual entre programas** — Tactical
  tiene **703 leads sin UTM de 2.690 (26%)** contra **23 de 2.133 (1%)** en ComunicArte. Uno de cada
  cuatro leads de Tactical no tiene origen. **No es un bug del dashboard: es una pregunta para Pauta**,
  de las que valen plata.

  ✂️ **Tercer apendice, y encogio el diseno: Mani quito `utm_term` y `utm_content`.** Textual:
  *"no es necesario, usemos los otros 3 que tienen mas sentido."* El estandar queda en **source,
  medium y campaign**, y con eso **se borran tres piezas de maquinaria escritas horas antes**: el
  `pgEnum nivel_utm`, la tabla `piezas` (conjuntos y anuncios) del ADR 0046, y la regla *"el codigo
  nunca pregunta que significa `utm_content`"*, que existia solo para reconciliar dos convenciones.
  Tambien **se revierte** la correccion que bajaba `ad_spend` al anuncio: sin ese nivel, el gasto y
  los leads cortan igual por campana. **La inconsistencia medida se disolvio en vez de resolverse.**

  **Lo que cuesta, y se dijo una sola vez:** *"que anuncio esta vendiendo"* —que Alejo nombro como
  metrica de Pauta— **deja de ser contestable**. No es un aplazamiento, es una salida de alcance.
  Las dos columnas **se quedan vacias y sin leer** en `submissions`, marcadas en el comentario del
  esquema: borrarlas costaria una migracion sobre una tabla ya en `production` y el dato sigue en la
  hoja. **Cablearlas no tapa ningun hueco porque no hay hueco.**

  🎯 **Y su ultima frase afino algo que estaba mal planteado:** pidio que *"sin utm"* fuera una
  categoria propia *"para no perder visibilidad de los que no tuvieron nunca"*. Al escribirlo aparecio
  que **son DOS huerfanos distintos y fundirlos era el error**: **sin UTM** es un problema de
  **captacion** —el link no estaba parametrizado, **irrecuperable** para lo que ya entro, hoy 726 de
  4.823— y **(sin clasificar)** es un problema de **configuracion** —trae UTM pero falta el patron, se
  arregla con una fila y **repara hacia atras**—. Un tablero que diga *"800 sin atribucion"* no dice
  cual de los dos problemas tiene el negocio. Las dos van **siempre visibles y separadas**, y **"sin
  UTM" no es un estado de error**: es un hecho del lead.

  🎯 **El dato mas util de toda la reunion, y cambia un diseno:** Alejo dijo que lo tedioso de su dia
  es *"no saber que decisiones tomar"*. El dolor **no es recolectar el numero ni leerlo: es que el
  numero no dice que hacer.** Por eso el ticket 090 es un tablero de **estados con accion**, no una
  tabla de cifras — y por eso los filtros libres del 089 son la **salida de emergencia** y no la
  puerta de entrada: un lienzo en blanco le devuelve justo el trabajo que dijo que no sabe hacer.

- **2026-09-22 (CIERRE 19) — Etapa 1 CERRADA y fusionada a `main`: el esquema del modelo HubSpot,
  de un solo corte.** Siete tickets (036 a 042) en 8 commits, una sola migracion, aplicada y
  verificada en `dev` (2.059 leads) y en `production` (4.823 leads, el mismo numero que antes
  porque `people` se RENOMBRA y no se re-crea). 611 tests en 54 archivos.

  ⚠️ **La ventana que el ticket 042 no nombraba, y que la proxima migracion de este tipo va a
  volver a abrir:** migrar `production` ANTES de desplegar deja la app viva consultando tablas que
  ya no existen, o sea **rota entre el `migrate` y el deploy**. No es evitable en el otro orden —el
  codigo nuevo necesita `leads`, que no existe hasta migrar—, asi que lo unico que se puede hacer
  es acortarla: migrar y desplegar seguido. Medida el 22-sep: se migro con el ok de Mani y se
  fusiono/desplego en la misma sesion.

  Lo que se decidio sobre la marcha, que no estaba escrito en los tickets:
  - **Mani, 21-sep:** amputar todo camino de escritura de ventas en vez de reapuntarlo. Razon:
    crear una venta hoy es crear o mover un DEAL, y mover una etapa solo puede pasar por
    `moverEtapa()`, que nace en la etapa 2. Escribir `deals.etapa` a mano habria sentado el
    precedente que el guardian de la etapa 2 existe para prohibir.
  - **Mani, 22-sep:** las filas que hay hoy en `dev` y `production` no importan; al final se hace
    la migracion y el sync arranca como paso final. Eso NO cambio la migracion a un
    drop-and-create: una migracion que borra la tabla de leads queda como archivo permanente, y
    que hoy los datos no importen es comodidad, no razon para dejar un explosivo en el historial.
  - `submissions.lead_id` es NULLABLE: un parcial de Typeform abandonado antes del correo no
    tiene lead al que colgarse, y con `notNull` el sync tendria que tirarlo en silencio.
  - `leadsDelRango` filtrado por closer devuelve `null`, no un numero: sin `responsableCloserId`
    no hay con que atribuir un lead, y el conteo del programa bajo el nombre de un closer habria
    sido una cifra creible y equivocada.
  - El rastro de un `update` guarda **los campos tocados**, uno por fila (ADR 0042, anotado).

  🩸 **Lo que se aprendio midiendo, y que ya esta en AGENTS.md:**
  - **El SQL de `drizzle-kit generate` es un borrador.** La 0020 salio con cuatro defectos: dos
    destructivos (expresaba el rename `people`->`leads` como DROP+CREATE, que habria borrado
    2.059 leads en dev y 4.791 en production; y dejaba 271 filas de `change_log` hablando de una
    tabla inexistente) y dos que la hacian reventar (DROP CONSTRAINT despues del DROP TABLE
    CASCADE que ya se los llevo; el indice unico de `sources` antes de desactivar la fuente
    vieja). Se reescribio a mano. El snapshot describe el esquema FINAL, no el camino, asi que
    reescribir el SQL no lo rompe.
  - **`generate` necesita un TTY** y falla explicito sin el. Se le dio un pty propio; la opcion
    por defecto de cada prompt es `create`, que es la segura.
  - **El guardian de vigencia cazo TRES lecturas de `deals` sin predicado escritas esa misma
    sesion**, y una de ellas era una pregunta que me habia saltado (¿las llamadas de un deal
    anulado salen en la ficha? Si, `incluyendoAnulados`). Es la prueba de por que va en la etapa 1
    y no despues. **Ojo con izar el predicado a una variable**: el guardian lee cadena por cadena.
  - **El indice de `deals` necesitaba `AND anulado_en IS NULL`**, que el ticket no pedia. Sin eso,
    quien registra un deal sobre el lead equivocado y lo anula no puede crear el correcto.
  - `dev` tenia 4 calls, 3 sales y 5 abonos del recorrido visual (production: 0). Se borraron
    ANTES de migrar, con guardia de rama, y fuera del archivo de migracion.

- **2026-09-21 (CIERRE 18) — Etapa 0 del plan v2 CERRADA. Sigue sin haber una linea de codigo:
  677 tests intactos, esquema sin tocar.**

  **PARA QUIEN ABRA LA PROXIMA SESION:** arranca la etapa 1 (tickets 036 a 042). Todo lo que
  necesitas esta en el repo; **ya no hace falta abrir el insumo del vault** para reconstruir el
  modelo, que era el "done cuando" de esta etapa.

  - **E0-1 · Ocho ADR nuevos, 0035 a 0042.** Promueven D1 a D6 del plan a decisiones registradas:
    0035 el Lead y sus contactos (`people` → `leads`, el telefono **une y marca**, nunca fusiona);
    0036 el Envio con todas las columnas y el `jsonb` que **no repite** las promovidas;
    0037 el Deal, las diez etapas como tipo y el **motor unico** (`sales` se disuelve);
    0038 anular ≠ Cierre Perdido; 0039 un programa, una fuente de leads; 0040 el sync por capas;
    0041 las cuotas pactadas son filas; 0042 todo movimiento deja rastro **desde el dia uno**.

  - **E0-2 · `docs/spec.md` enmendada** con las cinco del insumo §11 + dos: el kanban ENTRA, del
    onboarding entra solo `onboarded_at`, la comision entra, la cedula no, el Calendly se cierra
    en **PAT por programa** (era un supuesto abierto), y el "historico de C2" crece hasta ser la
    migracion one-time. La cabecera dice que secciones quedaron desactualizadas y que **mandan los
    ADR 0035-0042** donde discrepen: una spec a medias que no avisa es peor que una vieja.

  - **E0-3 · Siete ADR vigentes anotados** (0004, 0007, 0015, 0019, 0021, 0027, 0032), cada uno
    con su seccion `## Enmienda 2026-09-21` diciendo **que se conserva** y que cambia. Ninguno
    queda `superseded`: el 0007, por ejemplo, no se reemplaza, **se rodea**.

  - **E0-6 · 47 tickets nuevos, 036 a 082**, uno por cada tarea E1-1 a E7-6 del plan, mas los dos
    que ya existian y aterrizan en sus etapas (035 en E4, 021 en E5). El tracker se reorganizo en
    dos epocas: **E1 a E7 es el trabajo vivo**, F0 a F4 queda como historia.

  - 🎯 **Mani cerro E1-4, la unica decision abierta** (textual): *"Borrar todas. Porque eso era
    solo para la migracion inicial ya que todo se manejaba manual en Sheets... cuando el CRM se
    vuelva el centro, las llamadas solo van a vivir aqui. Lo unico que va a entrar de afuera son
    Leads crudos que llenan un forms de un programa."* Y la asimetria de la pauta: *"el costo de
    una campana... si toca indicarlo manualmente o traerlo de los Paid Traffickers; las pautas
    deben poderse asignar un costo."* O sea: `sources` = solo intake, la columna `destino`
    desaparece, y **`ad_spend` sobrevive pero deja de entrar por Sheets: se captura en el CRM**
    (ADR 0039, tickets 039 y 067).

  - ⚠️ **Y una correccion medida al propio plan:** el plan v2 §10 dice "las 5 filas de `sources`
    con destino != people". **Son 7**, verificado contra `dev` con una consulta de solo lectura
    (el plan conto las 5 filas de ComunicArte, que incluyen 2 de leads). No cambia la decision,
    pero la migracion del ticket 039 borra 7 y no 5. Es la regla de siempre: **antes de trabajar
    un dato heredado, verificalo; cuesta un comando.**

  - ⚠️ **Lo que la etapa 1 no puede olvidar**, escrito en los tickets: `Forms viejo` **se desactiva
    pero NO se borra** (sus 55 personas y sus envios de la etapa 7 necesitan una fuente a la que
    apuntar), y el indice unico parcial de `sources` se crea **despues** de desactivarlo, en la
    misma migracion. Al reves falla: hoy ComunicArte tiene dos fuentes de leads activas.

- **2026-09-21 (CIERRE 17) — Se abrio la epoca v2: el CRM pasa al modelo HubSpot. Sesion de
  planeacion, cero codigo. 677 tests intactos.**

  **PARA QUIEN ABRA LA PROXIMA SESION:** el plan completo esta en `docs/plan-crm-v2.md` y esta
  **aprobado**. No lo re-discutas: ejecuta la etapa 0.

  - 🎯 **EL HALLAZGO QUE ORDENA TODO EL PLAN: `calls`, `sales` y `abonos` tienen CERO filas en
    `production`.** El CRM lleva 4.791 leads sincronizados y **ni un solo registro operativo**;
    ningun closer lo ha usado nunca. Eso convierte disolver `sales`, colgar `calls` del deal y
    mover `abonos` en **cambios de esquema sobre tablas vacias**, no en migraciones de datos. El
    costo esta entero en el codigo (27 archivos mencionan `sales`). Y significa que **esta es la
    ventana mas barata que va a existir**: con 300 llamadas encima, el mismo corte es un
    strangler de semanas. Salio de abrir la tabla, que es la leccion del CIERRE 16 aplicada.

  - 🎯 **Mas cosas muertas que nadie habia mirado, todas medidas el 21-sep:** `people.estado` esta
    en el default `cola_setteo` en **4.791 de 4.791** filas (el `pgEnum` no carga un bit, confirma
    F-01); **0** personas tienen responsable; **0** entraron por `crm`. Y **Vercel es plan
    `hobby`** (team `agencia-dani`, verificado por API), asi que el cron solo puede correr **una
    vez al dia**: los 15 minutos del insumo no existen sin pagar Pro.

  - 🩸 **Una contradiccion del insumo, cazada midiendo.** El insumo §2.10 pide un indice unico
    sobre `sources.program_id` ("un programa, una hoja"). **Ese indice no se puede crear hoy:**
    ComunicArte tiene 5 filas con el mismo `program_id`, dos de ellas fuentes ACTIVAS de leads
    sobre el mismo archivo de Sheets. Mani decidio una sola fuente por programa (D2) y se midio
    lo que cuesta leyendo las dos pestanas: `New form` 2.258 filas / 2.070 personas, VIVA;
    `Forms viejo` 67 filas / 65 personas, **muerta desde el 22/7**; de esas 65, **55 no estan en
    New form**. No se pierden (el CRM nunca borra un lead): se recuperan en la etapa 7, que es
    donde el insumo ya pone las pestanas viejas.

  - **Seis decisiones de Mani, argumentadas en `plan-crm-v2.md` §3 (D1 a D6).** Todavia NO son
    ADRs: la etapa 0 las promueve. En corto:
    1. **D1** `people` → `leads`. Se hace ahora porque con las tablas operativas vacias cuesta
       casi cero y despues es caro.
    2. **D2** un programa, una fuente de leads. Enmienda medida al insumo §2.10.
    3. **D3** **anular NO es Cierre Perdido.** Cierre Perdido es un resultado del negocio y
       cuenta en el embudo; anular es una correccion de tecleo y no cuenta en ninguna metrica.
       Fundirlos haria que un error de dedo se vuelva una venta perdida y **la conversion
       mentiria sin lanzar un error**. `anulado` es marca ortogonal a la etapa, no una etapa 11.
    4. **D4** el sync se dispara por capas: `onChange` de Apps Script como mecanismo principal,
       perezoso, manual, y el cron diario de red. Webhook propio despues.
    5. **D5** cuotas en tabla, no dos campos en el deal. `valor_cuota = saldo / num_cuotas`
       **asume cuotas iguales**, y el dia que un plan real no lo sea el numero es falso y no falla.
    6. **D6** un deal se edita cuando haga falta, y todo movimiento del CRM deja rastro.
       ⚠️ **Con una correccion a lo que pidio Mani:** lo que va de ultimo es la PANTALLA en Nerd
       Stats, **no el rastro**. El rastro se escribe desde la etapa 1, por la razon del ADR 0029.
       Retrofitearlo al final deja sin historia todo lo escrito antes, y **un historial de
       auditoria fabricado se ve identico al de verdad** (los 5 enlaces de PayPal con
       `change_log` en 0 siguen ahi de testigo).

  - **Los cuatro tickets abiertos se reordenaron:** **034 reemplazado** (absorbido por el plan;
    su backfill desde `people.raw` ya no aplica porque `submissions` lo reconstruye el sync v2),
    **021 congelado** hasta la etapa 5, **007 partido** (cargar a Andrea sigue vivo; probar
    `registrarLlamada` queda obsoleto), **035 mudado** a la etapa 4.

  - **Lo que Mani debe decidir y no bloquea:** E1-4, las 5 filas de `sources` con
    `destino != people`. El caso incomodo es `ad_spend`, que el reporting va a necesitar.

  - **Pendiente transversal nuevo: la REVISION PROFUNDA DE LA UI** (Mani, 21-sep), `plan-crm-v2`
    §11. No es la etapa 6: es una pasada completa sobre la app entera, **despues** de la etapa 5.
    Razon: la UI de hoy se construyo ticket por ticket sobre el modelo viejo, asi que tras la
    etapa 5 va a estar corriendo sobre deals **con la forma de la epoca anterior**. Y nunca ha
    existido un criterio de UI escrito en este repo: hay ADRs para el dinero, los roles y el
    catalogo, para la interfaz ninguno. Cubre navegacion, primera vez, estados vacios, errores,
    el dia completo de un closer, **el celular**, y consistencia entre pantallas.

  - **Notion al dia (21-sep):** se cerro *"Disenar el pipeline de etapas del lead en el CRM
    (modelo HubSpot)"* (el diseno quedo consolidado, lo que sigue es construir) y se abrieron
    tres: **CRM v2 etapa 0** (p1, next), **CRM v2 etapa 1** (p2, next) y **Revision profunda de
    la UI** (p3, someday).

- **2026-09-20 (CIERRE 16) — Barrida de pendientes: 4 cerrados, 3 de ellos por VERIFICACION y no
  por codigo. 637 tests. `production` al dia.**

  **PARA QUIEN ABRA LA PROXIMA SESION, leer esto primero:**

  - 🎯 **DE SEIS DEUDAS QUE EL TRACKER DABA POR PENDIENTES, TRES YA ESTABAN RESUELTAS.** Es el
    hallazgo de la sesion y se repitio tres veces el mismo dia:
    1. **La prueba de concurrencia contra Neon** la listaba el CIERRE 14 como pendiente y el
       CIERRE 13 del MISMO dia la reportaba hecha, con numeros. Dos entradas del mismo dia
       contradiciendose.
    2. **`/api/cron/sync`** decia "falta probarlo de punta a punta" y llevaba **tres dias
       corriendo solo y bien** a las 07:52 de Bogota, seis corridas, las seis `ok`. Lo unico que
       faltaba era abrir la tabla.
    3. **S-02** decia *"el callback `jwt` no es testeable sin extraerlo de Auth.js"*. Esa frase
       **describia el arreglo** y se leyo dos semanas como un impedimento.
    **Una deuda fantasma cuesta lo mismo que una real.** Verificar antes de trabajar.

  - ✅ **S-12 (CSRF) cerrado, y resulto ser DIEZ LINEAS.** La deuda decia "migrar las mutaciones a
    Server Actions" y esa migracion ya habia pasado: se conto y queda **UN** handler que muta,
    `POST /api/sync/[programa]`. `exigirMismoOrigen` en `lib/auth/origen.ts`, 4 tests.
    **Una deuda descrita mas grande de lo que es no se ataca nunca.**

  - ✅ **S-02 cerrado en sus dos mitades.** La operativa contra `dev` (usuario desechable:
    `activo` → `quitar` → `INACTIVO`, la fila NO se borra) y la de codigo extrayendo el callback a
    `lib/auth/revalidacion.ts`, 11 tests, **mordidos quitando el arreglo para verlos caerse**.

  - ✅ **`/api/cron/sync` disparado de verdad contra produccion.** 401 sin secreto; con secreto,
    2 programas sincronizados en 3,18s. Personas 4.765 → 4.791, 0 corridas colgadas. **Y la
    corrida de Comunicarte guardo LAS DOS fuentes con sus conteos** (67 + 2.238): F-07 / ADR 0031
    visto en produccion, no en un test.

  - ⚠️ **TICKET 030: entregado como `done` y lo devolvi a `en curso`.** Kiro implemento bien y
    declaro el pendiente en su reporte, pero marco el ticket cerrado con **las seis casillas de
    "Done cuando" en `[x]`, y las seis eran CIERTAS**. El problema eran los criterios: los seis
    dicen *"un producto"* cuando el **Objetivo** dice *"un producto, categoria, motivo, origen,
    plataforma o recurso"*. El backend sirve a los seis; la UI solo esta en productos.
    🎯 **Unos criterios mas estrechos que el objetivo dejan pasar un ticket a medias sin que nadie
    mienta en ningun paso.** Se agrego el criterio que faltaba en vez de solo destildar casillas.
    (Y la UI faltante fue decision MIA: le prohibi tocar `/ajustes/catalogos` por el rediseno de
    plataformas.)

  - 🩸 **EL GUARDIAN DEL MOLDE ERA DECORACION, Y SE COMPROBO INYECTANDO EL BUG.** La conversion
    del test "el molde nunca borra" → "solo borra por `borrarSiNoSeUso`" dejo la rama de
    `molde.ts` comprobando unicamente que el archivo **contuviera** la cadena `borrarsinoseuso`.
    El archivo la contiene siempre: ahi se define la funcion. Se le metio un `db.delete()`
    clandestino en otro metodo del molde y **el guardian paso en verde**.
    Ahora exige UN solo `.delete(` en el archivo y que caiga DESPUES del inicio de
    `borrarSiNoSeUso`. Mordido en tres sentidos: no marca el codigo bueno, caza el DELETE
    clandestino, y caza un catalogo borrando a mano.
    **Un guardian que no se puede hacer fallar es decoracion, y se ve identico a uno que funciona.**

  - ✅ **Extraido `exigirAccesoAlPrograma` a `lib/catalogo/acceso-programa.ts`.** Estaba privado
    dentro de `productos.ts` y recursos lo necesitaba. Lo importan productos, recursos y
    enlaces-pago, con el mensaje de 403 parametrizado (a un brochure no se le dice "un programa
    donde no vendes").

  - **Decisiones de Mani del 20-sep, todas ya escritas donde corresponde:**
    1. **Plataformas de pago por TABLA PUENTE** (ADR 0034, migracion 0019). Y ojo con el camino
       descartado: meterle `program_id` a `plataformas_pago` obligaba a aflojar el indice unico
       sobre `lower(nombre)`, o sea **PayPal pasaba a ser dos filas** y una consulta de caja por
       plataforma mostraria dos medios de pago donde hay uno, sin lanzar un error.
    2. **Una plataforma SI puede existir sin programa** (queda invisible). Lo que no puede existir
       sin programa es el METODO de pago, o sea el ENLACE, **y eso ya se cumplia** desde el 022.
       Mani corrigio mi mala lectura el mismo dia; el ADR 0034 lleva la correccion escrita.
    3. **La tabla puente se gana su lugar por los abonos SIN enlace** (transferencia, Zelle). Si
       todo cobro pasara por un link, el vinculo se derivaria de `enlaces_pago` y la tabla
       sobraria.
    4. **`/ajustes` deja de ser exclusivo de gerente**; la guarda baja a cada subpagina.
    5. **`estado` y `etapa` son DOS campos** (ver el ticket 034). Desarma la tension de "dos
       escritores sobre el mismo campo" sin negociar nada.
    6. **Comprobante por link Y por foto** → ticket 035, con el analisis de crecimiento y de
       control de acceso ANTES de codear.
    7. Andrea y la prueba de llamada real se posponen a la salida a produccion full.

  - **La migracion 0019 se aplico a `production` con el ok de Mani** y el backfill va DENTRO de la
    misma migracion: una plataforma sin vinculos es invisible, asi que entre crear la tabla y
    llenarla **los selectores de plataforma saldrian vacios en toda la app**. Y asocia todas con
    todas a proposito: derivar de `enlaces_pago` habria dejado PayPal solo en `comunicarte` y
    **Tactical Investor perderia PayPal sin que nadie lo decidiera**. Una migracion preserva el
    comportamiento de hoy; la decision de negocio la toma un humano en la pantalla.


- **2026-09-19 (CIERRE 15) — Documentacion de arquitectura sincronizada.** El PR #3 fue fusionado
  en `main` (commit `3887a8e`) y dejo **605 tests**, typecheck y lint limpios. Se agrego ADR 0033 y
  la regla durable en `AGENTS.md`: la estructura se organiza por dominio, no por tipo tecnico ni
  por cantidad de lineas; los tipos/helpers puros viven junto al dominio; las extracciones son
  incrementales, conservan contratos y requieren tests. El primer paso ya aplicado agrupa
  `components/admin/` y `components/resources/`. Quedan como deuda separada las fronteras de
  `mi-dia-registro`, dashboard y schema, que no deben moverse sin una frontera verificable.

- **2026-09-19 (CIERRE 14) — Cambios de auditoria aplicados y validados.** Se cerro el alcance
  servidor de `registrarLlamada`: usuario activo, membresia activa y `personId` perteneciente al
  programa. `/recursos` dejo de hacer N+1 al cargar historiales, y las etiquetas de anulacion de
  llamadas usan el dia de Bogota. `registrarAbono` ahora bloquea la venta y calcula/valida/inserta
  el abono en una sola sentencia SQL, con la bitacora del sobrepago dentro de la misma operacion;
  se corrigieron los valores nulos opcionales para que se emitan como `NULL` valido. Se agregaron
  fixtures y pruebas de regresion. **603 tests pasan, typecheck y lint limpios.** El cierre 15
  actualiza el conteo y documenta la reorganizacion inicial aplicada después.
  Sigue pendiente el ticket 034/ADR 0032 (ownership y categorias dinamicas del pipeline), las
  enmiendas de permisos de 013/023 y el snapshot 021.
  ⚠️ **Corregido el 20-sep:** esta entrada listaba tambien "una prueba de concurrencia contra
  Neon" como pendiente, y **estaba vieja**: el CIERRE 13 del MISMO dia ya la reporta hecha, con
  numeros (dos `sincronizarPersonas` en paralelo sobre el mismo programa, una devolvio 2.053
  personas y la otra un 409, UNA sola fila en `sync_runs`, y el zombi de 30 minutos cerrado por
  el reaper). Dos entradas del mismo dia se contradecian. **Una deuda fantasma cuesta lo mismo
  que una real**, asi que se verifica antes de re-trabajarla.

- **2026-09-19 (CIERRE 13) — El 016 cerrado, F-04 y F-05 tachadas, y siete decisiones de Mani
  que convierten F-01 en el ticket 034. 598 tests.**

  **PARA QUIEN ABRA LA PROXIMA SESION, leer esto primero:**

  - ✅ **016 CERRADO** (Kiro implemento, esta sesion reviso y completo). `/ajustes/fuentes` deja de
    ser de solo lectura: se crean, editan, prueban y activan fuentes desde la pantalla, y el mapeo
    efectivo se combina **campo por campo** —fuente gana sobre la plantilla del programa, la
    plantilla sobre el defecto del codigo— en `lib/sheets/plantilla-lead.ts` (ADR 0019).
    Migracion **0018** (`programs.plantilla_lead`) aplicada en `dev`, **falta en `production`**.
    **Es lo que sostiene el criterio 4 de la spec**, el unico de los 6 que nunca se ha ejercido.

  - 🎯 **El hueco que dejo mi propio diseno, y lo encontro Kiro.** Yo decidi "probar al activar, sin
    bandera" justo para evitar estado rancio... y el estado rancio volvio por la otra puerta:
    **editarle el mapeo a una fuente ya activa la dejaba activa y rota.** El arreglo no es
    re-probar y desactivar, es **rechazar el cambio**: asi el invariante deja de ser "se probo al
    activar" y pasa a ser **"una fuente ACTIVA siempre tiene un mapeo que cuadra"**, que es mas
    fuerte y no tiene estado que envejecer. La edicion legitima (la hoja cambio un encabezado y el
    mapeo se ajusta) pasa la prueba, asi que la reja no estorba. Mordido en los dos sentidos y
    **probado quitando el arreglo para ver el test caerse**.

  - ✅ **F-04 hecha.** Los UPDATE del sync pasan por `ejecutarJuntas` en lotes de 200: **una
    peticion HTTP por lote** en vez de una por persona. No era un bug activo —una corrida normal
    actualiza ~6 filas— era una bomba: el dia que un ajuste de mapeo tocara a las 4.700 serian
    4.700 viajes y ~235s contra un techo de 300s.
    **No se uso `UPDATE ... FROM (VALUES ...)`**: habria necesitado una plantilla `sql` con una
    tabla adentro, que es el footgun de las columnas sin calificar. `ejecutarJuntas` ya existia.
    ✅ **Verificado contra Neon, no solo contra PGlite** (son caminos DISTINTOS: batch vs
    transaccion): se ensuciaron 250 nombres en `dev` y el sync reparo 247 en 6,3s.
    🩸 **Y de paso me mordio a mi:** los 3 que no reparo son personas `entrada: crm`, que no estan
    en la hoja — el sync hace bien en no tocarlas—, pero yo ya les habia pisado el nombre sin
    forma de restaurarlo. **Me salvo `change_log`**, que tenia los tres nombres originales. Eran
    datos de prueba de recorridos viejos, asi que no se perdio nada real. **Leccion: ensuciar datos
    para probar algo exige saber de antemano como se restauran.**

  - ✅ **F-05 VERIFICADA MUERTA sin escribir codigo.** Se re-parseo con el parser de hoy el
    `raw.fechaAplicacion` de las 3.369 personas de `production` con una sola aplicacion: **3.369
    coinciden exacto, 0 difieren**. Se auto-reparo el 18-sep al entrar las fechas en
    `CAMPOS_COMPARABLES`. 🎯 **Una deuda vieja se VERIFICA antes de trabajarla.**

  - 🎯 **F-01 cambio de direccion y se convirtio en el ticket 034 + ADR 0032.** La propuesta que
    dormia en el tracker era traducir los valores de la hoja a nuestro enum. **Mani la rechazo:
    "no debe haber nada hard coded".** Lo que se midio para decidirlo: `people.estado` es un
    `pgEnum` **decorativo** —las 4.688 personas estan en el default y **ningun `if` del codigo
    depende de su valor**—, y el dato de la hoja **ya esta en `people.raw` para 4.633 personas**,
    asi que no hace falta re-sincronizar para poblarlo. El caso que justifica "combinar" aparecio
    solo en los datos: `📅 Con Calendly` y `📅 Con Calendly (Juanito)` son la misma categoria en
    dos programas. **Mani lo quiere en su propia sesion.**

  - **Decisiones de Mani del 19-sep, todas ya escritas donde corresponde:**
    (1) F-01 sin nada hardcoded, en sesion propia → ticket 034 + ADR 0032.
    (2) F-04 de una → hecha.
    (3) **Todas las fechas son de Bogota** → regla dura nueva en AGENTS.md.
    (4) F-06: "desaparecio de la hoja" es una categoria mas → entra en el 034; **nunca se borra**.
    (5) Retencion: **para siempre**, ni el lead ni `raw`. La deuda pasa a ser de ESCALA (abajo).
    (6) CSRF: si, pero como fix rapido en sesion propia.
    (7) **Habeas data cerrado**: Mani hablo con el equipo, no hay obligaciones extra.

  - **Dos supuestos mas cerrados:** el snapshot en PDF lo toman **los dos roles** (el 021 deja de
    estar bloqueado, sigue de ultimo), y los closers **si** agregan recursos y crean plataformas de
    pago, con dos asimetrias declaradas (un closer no crea un recurso GLOBAL; una plataforma no
    tiene programa, asi que ahi no hay membresia que acote). **Las enmiendas a los tickets 013 y
    023 quedan SIN implementar.**

  - ✅ **TODO QUEDO EN `production` Y DESPLEGADO.** La 0018 se aplico con el ok de Mani **despues
    del push**, y ese orden importo: el codigo del 016 lee `programs.plantilla_lead`, y
    `sincronizarPersonas` selecciona TODAS las columnas de `programs`, asi que entre el push y la
    migracion **el sync de production habria reventado con *column does not exist***. No paso
    nada porque el cron corre a las 7am y la ventana fueron minutos, pero es la misma leccion de
    la 0016/0017 en la otra direccion.
    🎯 **La regla general que queda: una migracion aditiva se puede aplicar antes O despues del
    deploy, pero si el codigo nuevo LEE la columna, "despues" tiene una ventana. Mira que lee el
    codigo que estas desplegando, no solo si la migracion agrega o quita.**
    Verificado despues: 19 migraciones, `plantilla_lead` nullable, los dos programas en `null`
    (heredan el defecto), 4.688 personas intactas, deploy `f1085fa` vivo.

  - 🔭 **PIPELINE DE ETAPAS: sesion propia, y es mas grande de lo que parecia** (Mani, 19-sep, al
    cerrar el dia). La pregunta que quedo del embudo —¿en que ORDEN van las categorias, y
    `📞 Setteo No Calificado` es una etapa o una salida?— **no se responde improvisando**: Mani
    quiere mirar como HubSpot modela etapas y pipelines y copiar el modelo probado, para que un
    closer vea exactamente donde esta cada lead y lo pueda mover. Tarea de Notion creada con
    prioridad 1; **bloquea el ticket 034**.
    ⚠️ **Al escribir esa tarea se destapo una tension de arquitectura que nadie habia visto:**
    el ADR 0004 dice que **Sheets es la fuente de verdad de los leads**, y el 034 asume que la hoja
    es la duena de `estado`. Un pipeline donde el CLOSER mueve el lead hace que el CRM sea el dueno
    de la etapa. Las dos a la vez son **dos escritores sobre el mismo campo**, la forma exacta de
    bug que este repo ya conoce: cifras que no cuadran **sin lanzar un solo error**. Hay que
    decidir quien manda antes de codear el 034.
    🎯 **Sale de una regla que vale para todo: cuando una funcion nueva implica que alguien
    ESCRIBA lo que hoy solo se LEE de una fuente externa, la pregunta "¿quien es el dueno del
    campo?" hay que hacerla antes, no cuando los numeros discrepen.**

  - ⚠️ **Kiro cerro sin reportar DOS veces hoy** ("tengo tareas en background corriendo"), y las dos
    veces habia trabajo real en disco. La segunda si entrego reporte completo despues. **Verifica
    por tu cuenta antes de creerle, y antes de darlo por muerto revisa `git status`.**

- **2026-09-19 (CIERRE 12) — F-03 y F-07 eran el MISMO bug, y el enunciado de la deuda estaba
  mal escrito desde agosto. ADR 0031, migraciones 0016 y 0017 en `dev` y `production`.**

  **PARA QUIEN ABRA LA PROXIMA SESION, leer esto primero:**

  - ✅ **F-03 y F-07 cerradas, con migracion aplicada en las DOS ramas.** Estaban anotadas como
    deudas sueltas y son la misma: `lib/sheets/sync.ts` documentaba desde siempre que las personas
    se sincronizan **por programa** (se leen todas las fuentes juntas y se deduplica sobre el
    conjunto), pero la corrida se guardaba colgada de `fuentes[0].id`. De ahi salen las dos: no
    habia llave por programa sobre la cual poner un candado (F-03) y la bitacora nombraba una
    fuente de varias (F-07). Una columna, `sync_runs.program_id`, cierra las dos.

  - 🩸 **EL HALLAZGO, y sale de mirar las filas de `production` en vez de releer el ticket:**
    F-07 estaba escrita como *"corrida atribuida a la primera fuente"*, y eso **no era cierto**.
    La consulta de fuentes **no tiene `ORDER BY`** —el `sort` por `orden` ocurre despues, solo para
    leer— asi que `fuentes[0]` era la fila que Postgres devolviera de primera: **la atribucion era
    NO DETERMINISTA**. En `production`, de las 3 corridas de Comunicarte una quedo bajo un
    formulario y dos bajo el otro, sin que nada hubiera cambiado. Yo mismo repeti el enunciado malo
    en dos mensajes antes de abrir los datos.
    🎯 **La leccion: el enunciado de un bug viejo es una hipotesis, no un hecho. Lee las filas
    antes de repetirlo.** "La primera" sonaba a una regla; no habia ninguna regla.

  - 🎯 **El candado es el INSERT, no un lock.** Indice unico parcial
    `sync_runs_una_corriendo_por_programa_idx ... WHERE estado = 'corriendo'`, mismo molde que
    `cohorts_una_activa_por_programa_idx`. Con `neon-http` no hay locks de sesion (ADR 0018), asi
    que la exclusion mutua vive en la base (ADR 0005). **No hay candado que pedir ni que acordarse
    de soltar:** la fila que dice "estoy corriendo" ES el candado. 23505 → `SyncEnCursoError` (409),
    que el cron cuenta como `omitidos` y no como `fallidos`: contar el candado funcionando como una
    rotura haria que el numero dejara de significar algo el dia que algo se rompa de verdad.

  - ⚠️ **El reaper es la mitad que no se puede olvidar.** Sin el, una funcion que se cae deja la
    fila `corriendo` para siempre y **el candado pasa de proteger a bloquear**: el sync no vuelve a
    correr nunca y nadie se entera. Cierra como `error` las corridas de mas de
    `MINUTOS_ANTES_DE_DAR_POR_MUERTA` (10 = 2x el `maxDuration = 300` de las rutas, no un numero
    de gusto).

  - 🎯 **LA TRAMPA, que es la pieza mas transferible: un guardia que escribe en el recurso que
    protege tiene que probar que NO lo toca cuando rechaza.** El `try/catch` grande de
    `sincronizarPersonas` termina marcando `corrida.id` como `error`. Meter el candado adentro
    parece lo natural y hace lo contrario de lo que el candado existe para hacer: un sync rechazado
    **marcaria como error la corrida VIVA de otro proceso**. El reaper y el insert van fuera, y hay
    un test que lo muerde (despues del 409 la primera sigue `corriendo` y sin `errores`).

  - ✅ **Mordido contra Neon de verdad, no solo contra PGlite.** Dos `sincronizarPersonas` en
    paralelo sobre el mismo programa: una devolvio 2.053 personas y la otra un 409, con **una sola
    fila** en `sync_runs` (la rechazada no creo nada, la viva no se marco). Y un zombi insertado a
    mano con 30 minutos quedo cerrado como `error` con su motivo mientras la corrida nueva
    arrancaba. La corrida guardo **las dos** fuentes con sus conteos: `Formulario anterior (67)` +
    `Formulario actual (2.176)` — F-07 vista de frente, porque con el codigo viejo esa corrida se
    habria etiquetado con UNA de las dos.

  - 🎯 **Afinada una regla de AGENTS.md midiendola, porque estaba escrita mas ancha de lo que es.**
    "Dentro de una plantilla `sql` las columnas salen SIN calificar" no es general: **lo que
    desactiva la calificacion es meter una TABLA en la plantilla** (`${people}`). Una plantilla que
    solo referencia columnas las sigue calificando — `sql`${syncRuns.fuentesLeidas}`` dentro de un
    select con join se renderiza `"sync_runs"."fuentes_leidas"`, comprobado con `.toSQL()`. La
    conducta no cambia (nada de subconsultas correlacionadas) pero no hay que desconfiar de un cast
    de tipo sobre una columna. **`query.toSQL().sql` cuesta un comando y responde de verdad.**

  - 🩸 **El guardian del ADR 0012 me mordio a MI.** El docblock que escribi en `lib/db/schema.ts`
    nombraba "Comunicarte", y `tests/contrato-extension.test.ts` prohibe nombres de programa en
    `lib/`, `app/` y `components/`. Lo detecto Kiro al correr el suite. Reformulado a "un programa
    con dos formularios activos". El guardian funciona incluso contra quien lo respeta de memoria.

  - ⚠️ **Esta migracion NO es aditiva, y por eso la regla del CIERRE 10 no alcanza.** `program_id`
    entra NOT NULL y `source_id` se va, asi que hay una ventana en la que el esquema y el codigo
    desplegado no se entienden **en cualquiera de los dos ordenes**. Se asumio con el radio medido:
    lo unico que toca `sync_runs` son `/nerd-stats` (developer) y `/ajustes/fuentes` (gerente) mas
    el sync; **ninguna pantalla de closer** (`/mi-dia`, `/programas/[slug]`, `/personas/[id]`,
    `/recursos`) lee esa tabla, y un sync que falla no deja nada a medias porque el insert de la
    corrida falla antes de escribir una sola persona y el siguiente recalcula desde cero.
    🎯 **Para la proxima migracion destructiva: la pregunta no es "¿migro antes o despues?", es
    "¿que pantallas leen esta tabla y quien las usa?".**

  - ✅ **`production` verificada DESPUES de migrar, contra el snapshot tomado ANTES:** 18
    migraciones, `source_id` fuera, `program_id` NOT NULL, el candado existe, las 6 corridas
    historicas conservan su programa exacto (3 comunicarte + 3 tactical, identico al snapshot),
    cero huerfanas, 4.688 personas. Migrar sin tomar el snapshot antes habria dejado el backfill
    sin nada contra que comprobarse.

  - **Dos tareas de Notion cerradas** por el chequeo del embudo, las dos con trabajo terminado y
    tarea abierta: *ticket 028 "ver como" del developer* (hecho el 18-sep) y *Pedirle a Michael el
    .env.local* (hecho el 16-sep). El patron del CLAUDE.md otra vez: **trabajo terminado que no
    cierra su tarea se ve identico al pendiente.**

  - **Kiro implemento el codigo y los tests; las migraciones las genero y aplico esta sesion**
    (regla de AGENTS.md). Ojo: **Kiro cerro sin reportar la primera vez** ("tengo tareas en
    background"), asi que la verificacion la corrio esta sesion por su cuenta antes de creerle;
    despues si llego su reporte y coincidio. **577 tests, typecheck y lint limpios.**

- **2026-09-18 (CIERRE 11) — El recorrido REAL en production destapo que `Mani` y `mani` eran
  dos closers. ADR 0030, migracion 0015 y un guardian. Queda un borrado por correr.**

  **PARA QUIEN ABRA LA PROXIMA SESION, leer esto primero:**

  - ✅ **LOS DATOS DE PRUEBA DEL RECORRIDO YA NO ESTAN.** Mani corrio
    `scripts/_limpiar-recorrido-prod.ts -- --escribir` (el clasificador de permisos bloqueo el
    borrado desde la sesion, correctamente, igual que en el CIERRE 7). Se fueron 6 filas de negocio
    —2 llamadas, la venta de 1.500 USD, el abono de 800, la persona `hola@test.com` "Thisa Test" y
    el recurso "Test"— mas sus 11 filas de `change_log`. Cada una por su uuid exacto, no por un
    `where origen = 'app'` que se habria llevado tambien lo que el equipo registre manana.
    **Verificado despues por una consulta aparte**, no por la salida del script: `production` queda
    en 0 llamadas / 0 ventas / 0 abonos / 0 recursos / 0 personas del CRM, con las **4.599 personas
    reales** y toda la configuracion intactas (6 categorias, 5 enlaces de pago, 2 productos, 4
    cohortes), y el `change_log` conservando solo lo que es configuracion de verdad.
    El script era TEMPORAL y ya se borro del repo.

  - ✅ **EL RECORRIDO REAL CONTRA `production` ESTA HECHO, y las consultas corren.** Mani cargo
    su `closer_id`, activo sus dos membresias, creo una persona a mano, registro una llamada `show`,
    luego una `cerrada` con venta (1.500 USD, producto real) y abono (800 USD, PayPal), y creo un
    recurso desde `/recursos`. **Criterios 1, 5 y 6 de la spec ejercidos contra la base de
    verdad.** Eso es lo que `/api/health` nunca pudo decir: devuelve un JSON constante.

  - 🩸 **EL HALLAZGO: el `closer_id` quedo en `mani` y el de la otra closer es `Maru`.**
    `closerId` se comparaba como texto crudo en cuatro sitios, asi que `Mani` y `mani` eran **dos
    closers en todas las metricas**: el comparativo mostraba dos filas donde hay una persona, el
    filtro devolvia la mitad de sus llamadas, `esCloserValidoEnPrograma` habria negado un programa
    donde si vende, y la reja de la anulacion le habria dicho *"la registro otro closer"* a quien la
    registro. **Ninguna de las cuatro lanza un error.** Es la familia del centinela del ano 1.
    Cerrado con el **ticket 033 / ADR 0030**: `lib/closers/identidad.ts` es la unica respuesta a
    "¿son el mismo closer?", el texto se sigue guardando como se escribio (la ortografia de la hoja
    es suya, ADR 0004), y un **indice unico sobre la forma normalizada** (migracion `0015`, aplicada
    en `dev` y `production`) impide dos cuentas reclamando el mismo closer. `users.closer_id` de
    Mani corregido a `Mani` en `production`, por el molde.

  - 🎯 **LA TRAMPA QUE CASI ENTRA, y es la leccion mas transferible del dia: un regex dentro
    de una plantilla `sql` pasa por DOS capas de escape.** La primera version normalizaba con
    `'\s+'` escrito en un template literal de JavaScript, que **se cocina a `'s+'`**: el regex que
    llegaba a Postgres colapsaba las **eses**, no los espacios. `Jose` se habria normalizado a
    `jo e` y `Vanessa` a `vane a`. Y peor: el indice y la consulta viven en archivos distintos y
    quedaron con escapes **distintos**, o sea el indice habria protegido una cosa y la consulta
    agrupado otra, que es la divergencia exacta que el modulo existe para impedir.
    Se atajo antes de aplicar nada. La expresion final es `'[[:space:]]+'` (sin backslash, nada que
    cocinar) y hay un test que **ejecuta** las dos normalizaciones contra Postgres y las compara en
    vez de leer los dos textos y darlos por iguales.

  - 🎯 **El guardian nuevo mordio mi propio arreglo, y eso mejoro el diseno.** La primera
    version marcaba `groupBy(claveDeCloserSql(calls.closerId))`, que es justo lo que el ADR pide.
    En vez de poner una excepcion —donde se esconde lo que no caza (ticket 028)— se hicieron dos
    cosas: el guardian borra las formas AUTORIZADAS antes de buscar las prohibidas, y **el
    comparativo paso a agrupar por la clave normalizada en SQL** en vez de agrupar por texto crudo y
    unir en memoria. Lo segundo funcionaba, pero dejaba el footgun puesto para la proxima consulta.
    El guardian se prueba mordiendo **en los dos sentidos**: que caza las cuatro formas malas y que
    **no marca la solucion**. Eso ultimo es nuevo y conviene copiarlo al resto.

  - **Dos cosas que parecian hallazgos y NO lo son**, comprobadas en el codigo antes de reportarlas:
    `sales.precio_lista_usd` en `null` esta fuera de alcance a proposito
    (`lib/mutations/registro.ts:217`), y un `recursos.program_id` en `null` significa **recurso
    global**, que aparece con cualquier filtro (`lib/queries/recursos.ts:77`). El criterio 6 se
    cumple igual.

  - **Lo que sigue pendiente de Andrea:** su alta. Candidato `andrea.machado@30x.com`, sin
    confirmar por ella. Su `closer_id` es `Andrea`.

- **2026-09-18 (CIERRE 10) — Tres decisiones cerradas, el 031 hecho, y el deploy dejo de ser
  inverificable.**

  **PARA QUIEN ABRA LA PROXIMA SESION, leer esto primero:**

  - ✅ **`848edee` ESTA VIVO en produccion, y ahora se sabe como comprobarlo.** El CIERRE 7 dejo
    escrito "no se pudo confirmar que commit quedo vivo" porque el conector MCP de Vercel pide
    OAuth. **La CLI de esta maquina si esta logueada** (`vercel whoami` -> `danieltovartech-4302`)
    y alcanza `agencia-dani/retia-metrics`, cuyo alias de produccion es
    `retia-metrics-seven.vercel.app`. El deploy se crea segundos despues del commit, asi que
    `vercel inspect` + `git log --format='%h %ci'` identifican el commit vivo: `848edee` a las
    11:59:07 -05 <-> deploy creado 11:59:10 -05.
    🎯 **La leccion de metodo: "el conector no arranca" no es lo mismo que "no es verificable".**
    Se dio por imposible una comprobacion por el primer camino que fallo, y quedo escrita como un
    hecho del entorno durante un dia entero.
  - ⚠️ **`/api/health` no prueba absolutamente nada de las consultas.** Leido el codigo: devuelve
    un JSON constante y no toca la base. Un 200 ahi dice que la funcion arranca. Nada mas.

  - 🩸 **EL HALLAZGO QUE CAMBIA EL ORDEN DE ARRANQUE: el bloqueo de la primera llamada real no
    es Andrea, es el usuario de Mani.** En `production`, `manuelmejiaarana@gmail.com` es
    `developer` con **`closer_id = null` y cero membresias**. `registrarLlamada` copia el closerId
    de la sesion (`closerDeLaSesion`, ADR 0011) y sin el tira 400 seco. **Aunque Andrea se diera de
    alta hoy, la primera llamada la tiene que registrar Mani o Maru.** Y no necesita el 031:
    `developer` cumple `esAdministrador`, asi que ya puede cargarselo desde `/ajustes/usuarios`.
    Detalle aparte que va a morder despues: para ASIGNARSE como responsable de una persona,
    `esCloserValidoEnPrograma` exige membresia activa en el programa. Registrar una llamada no.

  - **Estado real de `production` al 18-sep** (lectura, rama `br-withered-mud-b4cvvg80`, distinta
    de la de `DATABASE_URL`): 4.599 personas (2.622 tactical · 1.977 comunicarte), **0 llamadas,
    0 ventas, 0 abonos, 0 recursos**, 6 categorias de recurso, 5 enlaces de pago (todos
    ComunicArte), 2 productos (los reales; los 3 de la semilla ya no estan), 3 usuarios, 4
    cohortes. `people.responsable_closer_id` esta en null en las 4.599.

  - ✅ **031 CERRADO (Kiro implemento, esta sesion reviso). Decision: opcion 1.** Solo quien cumple
    `esAdministrador` edita su `closerId`; un closer lo ve en lectura. **Por que no la opcion 2
    ("cualquiera, pero solo si esta vacio"): el momento de riesgo es el PRIMER valor, no el
    cambio.** Una cuenta recien creada con el campo vacio es exactamente la situacion de quien
    quisiera escribir `Andrea` y heredar sus 317 llamadas. Poner la reja despues de ese momento es
    ponerla donde no pasa nada. Y la opcion 2 haria que «¿puede este actor?» dependiera de si una
    columna esta en `null`: autorizacion mezclada con estado de la fila, justo lo que el ADR 0025
    empuja a no hacer. La 1 ademas no necesita predicado nuevo. 556 tests.
    `editarCloserIdPropio` **reusa el molde** en vez de duplicar el `db.update`, asi que el
    `change_log` sale por el mismo camino que un alta.
    ⚠️ **Y quedo con CERO clics humanos.** Ver el punto de metodo abajo.

  - 🎯 **ADR 0029 nuevo: una fila de catalogo se crea por el molde, tambien desde un script.**
    La pregunta que venia del CIERRE 7 —*¿un script de semilla debe dejar rastro?*— estaba mal
    planteada: mete en la misma bolsa sembrar una base **vacia** y meter cinco filas de negocio en
    una base **viva**. **La linea no es "script o pantalla", es si la base ya esta viva.**
    `cargar-enlaces-pago.ts` ahora llama `crearEnlacePago` en vez de `db.insert`, y el "quien" lo
    da `actorDelScript()` en `scripts/actor.ts` (`SCRIPT_ACTOR_EMAIL`), en un solo lugar, negandose
    a arrancar sin el. Excepciones nombradas: sembrar una base vacia y `npm run usuarios`, que
    existe justo para cuando no hay administrador con quien actuar.
    **Lo que NO se hizo, a proposito: no se les fabrico `change_log` a los 5 enlaces que ya estan
    en `production`.** Un rastro de auditoria inventado se ve identico al de verdad.
    **Y lo que queda sin decidir:** `seed-datos.ts` sobre una base viva sigue pudiendo insertar de
    mas (asi nacieron los 3 productos duplicados). La reja natural -cada seccion se niega a tocar
    una tabla que ya tiene filas que la semilla no puso— choca con un uso real: la seccion de
    `sources` **actualiza** filas existentes a proposito, y re-sembrar es como se ajusta el plan de
    sync en `dev`. Es su propia decision y no se tomo de paso.

  - **021: el formato es PDF** (decision de Mani, contra la recomendacion de la sesion, que era
    texto copiable por cero dependencias). Sigue de ultimo. Lo que arrastra esta escrito en el
    ticket: es el unico de los cuatro formatos que obliga a dependencia nueva (va DENTRO del
    ticket, ADR 0006), y el PDF **recibe el mismo objeto que pinto el dashboard**, no recalcula.

  - ✅ **RECORRIDO EN NAVEGADOR HECHO, y no se quedo en cargar pantallas.** Mani se logueo a
    mitad de sesion y se probo clic por clic contra `dev`. **El menu de usuario abre sin tumbar el
    layout y sin un solo error en consola**, que era el riesgo real: el bug de
    `MenuGroupContext is missing` del CIERRE 7 vivio dias con 543 tests en verde. "Mi perfil"
    navega, la escritura real (`Mani` -> `Mani Prueba`) dio su toast y dejo **exactamente UNA**
    fila en `change_log` (`campo: closerId`, `origen: app`, con su `userId`), y en vista `closer`
    el input desaparece y queda texto plano.

  - 🎯 **LA PIEZA DE METODO DEL DIA: se probo que el SERVIDOR rechaza, no solo que el input
    no se pinta.** Hasta hoy, "el rol se enforza en el servidor" y "esconder un boton no es
    seguridad" eran contratos escritos que ningun recorrido habia medido: los recorridos miraban
    que el control no apareciera, que es justo lo que un atacante no hace.
    **Como se hizo, y sirve para el proximo:** se envuelve `window.fetch` en la pagina para
    capturar la cabecera `Next-Action` al enviar el formulario una vez; con ese id se invoca la
    server action **a mano, saltandose la interfaz entera**, desde la vista que NO deberia poder.
    Se mando `closerId: "Andrea"` en vista `closer` (literalmente el ataque que describe el ticket
    031) y el servidor devolvio
    `{"ok":false,"error":"Solo un administrador puede editar el closer_id..."}` con la base
    intacta. Segunda mitad: se metieron un `id` y un `userId` ajenos en el cuerpo y **se ignoraron
    los dos**, porque el esquema zod solo admite `closerId` y la accion pasa `session.user.id`.
    🎯 **Un contrato que nadie mordio es una creencia.** Haceselo al proximo.
    Los cambios de prueba en `dev` quedaron revertidos (`closer_id` volvio a `Mani`).

  - 🔍 **Andrea: candidato `andrea.machado@30x.com`**, encontrado en el Workspace de 30X (aparece
    en las listas de all-hands) y corroborado en WhatsApp ("Closer Andrea Machado" /
    "Andrea Machado ComunicArte"; el puente de Juanito la nombra en un push de Tactical Investor).
    **No se dio de alta: decision de Mani de confirmarselo a ella primero**, porque Maru entra con
    un Gmail personal, asi que el correo corporativo no es el patron de la casa y un usuario mal
    creado no puede loguearse. No hay ningun `@retiagrowth.com` humano para ella.

  - **No se pudo mirar como es el reporte diario de Mike** (el que el PDF del 021 viene a
    reemplazar): el clasificador de permisos bloqueo la lectura del grupo *Ventas ComunicArte*, con
    razon, porque esos grupos tienen credenciales. Queda anotado en el ticket 021: sin ese formato
    a la vista, el PDF se va a inventar una estructura y el equipo va a seguir mandando el de Mike.

  - 🔴 **Sigue sin resolver, y es de Mani:** la contrasena de la cuenta de PayPal de Retia sigue
    publicada en texto plano en *Ventas JP Vieira* desde el 18-ago.

- **2026-09-18 (CIERRE 9) — Recorrido de interacciones TERMINADO (lo que faltaba del CIERRE 8).
  Un hallazgo de formato, arreglado. Prellenado de precio y fecha, pedido de Mani.**

  **PARA QUIEN ABRA LA PRÓXIMA SESIÓN, leer esto primero:**

  - 🟡 **HALLAZGO, arreglado: dos pantallas de `/ajustes` escribían el dinero en crudo.**
    `/ajustes/programas` mostraba *"ticket USD 797.00"* y *"USD 1500.00"* —punto decimal, sin
    separador de miles— y `/ajustes/programas/[slug]` lo mismo con el precio de la cohorte y la
    TRM. Salían del string de la base **sin pasar por `lib/format.ts`**, mientras TODAS las demás
    pantallas muestran "USD 1.500,00". Incumplía el contrato de formato de AGENTS.md.
    🎯 **Por qué importa más de lo que parece:** es la misma enfermedad del ADR 0024 pero en
    presentación. La respuesta a "¿cómo se escribe un monto?" vive en un módulo, y dos pantallas
    la contestaron por su cuenta. Nadie lo vio porque **no falla: se ve casi bien.**
    Arreglado: `usd(Number(...))` y `num(Number(...), 2)` para la TRM.
  - ✅ **Prellenado (pedido de Mani, 18-sep).** Elegir el producto prellena *Precio aplicado* con su
    precio de lista, y las dos *Fecha del abono* (la del cierre y la del abono suelto) nacen con
    hoy. Ambos siguen editables a propósito: el precio aplicado no siempre es el de lista (la C2
    respeta el anterior a quien ya lo tenía cotizado) y a veces se carga un abono de ayer.
    ⚠️ **La fecha NO es `toISOString().slice(0,10)`**, que da el día en UTC: Bogotá va cinco horas
    atrás, así que **de 7pm a medianoche prellenaría mañana** y el abono caería en otro rango del
    dashboard. Vive en `hoyEnBogota()` en `lib/format.ts`, una sola definición para los dos
    formularios que la piden.

  - ✅ **"Copiar link" FUNCIONA** (Mani lo probó con un clic real, 18-sep). En el CIERRE 8 quedó
    como inconcluso porque en el panel automatizado el permiso `clipboard-write` sale `denied`, y
    la app respondía *"No se pudo copiar el link"*. **No era un bug: era el entorno.**
    🎯 **La lección de método, que vale para el próximo recorrido automatizado:** hay cosas que un
    agente NO puede concluir —portapapeles, descargas, notificaciones, cámara, cualquier cosa que
    dependa de un permiso del navegador o de un gesto humano real—. Cuando una de esas falle,
    **compruébalo con `navigator.permissions.query` antes de escribirla como hallazgo**, y si el
    permiso está denegado, pásasela a un humano en vez de reportar un bug que no existe.

  - ✅ **032 CERRADO el mismo día, y el arreglo de verdad fue el guardián.** `crearPersonaManual`
    decide con `trabajaLeads`; `asignarResponsable` quedó como predicado POSITIVO
    (`!esAdministrador`) en vez de literal —habría funcionado igual porque el rol ya viene
    proyectado, pero el predicado dice CAPACIDAD en vez de ROL, que es lo que pide el ADR 0025—; y
    `scripts/usuarios.ts` cuenta administradores con `esAdministrador`, no gerentes.
    **El guardián ahora caza cualquier `.rol` comparado con un literal, no solo
    `session.user.rol`, y recorre `scripts/`.** Se probó mordiendo las dos formas que antes se le
    escapaban y señaló archivo, línea y forma en las dos. Verificado además en el navegador: en
    vista `todo` crear persona responde "Persona creada". 545 tests.
    🎯 **Y hay un test nuevo que es el que impide que vuelva:** `vista "todo" es un superconjunto
    de vista "closer"`. No prueba un caso, prueba una PROPIEDAD. Los tres puntos ciegos del día
    salieron porque cada arreglo fijaba el caso concreto; esto fija la regla.
    Quedó UNA excepción nombrada, `lib/catalogo/usuarios.ts:80`, que es validación de formulario
    (qué campos exige el rol que se ASIGNA), no autorización de un actor.

  **LO QUE FALTABA RECORRER, y pasó todo:**

  - `/personas`: busca y encuentra gente de LOS DOS programas (el arreglo del CIERRE 5).
  - Dashboard de Tactical: estados vacíos manejados sin romperse ni mostrar NaN.
  - `/ajustes/catalogos`: las cuatro pestañas cambian, y las 6 categorías de recurso están.
  - `/ajustes/fuentes`: explica las fuentes "sin mapeo" inactivas y ofrece sincronizar.
  - **Reemplazar un recurso**: crea la versión nueva vigente y aparece *"Historial (1)"* con la URL
    anterior guardada. El versionado del ADR 0017 cumple.
  - **Abono suelto** sobre una venta existente, con su fecha ya prellenada.
  - 🎯 **La reja de sobrepago, que es la mejor pieza que vi hoy:** un abono de 1.000 sobre un saldo
    de 797 se BLOQUEA con el número exacto —*"deja la venta con un sobrepago de USD 203,00: el
    saldo pendiente es USD 797,00. Confirma el sobrepago si el pago entró de verdad."*— y ofrece
    confirmarlo. Al confirmar, la etiqueta CAMBIA: *"Abonado: USD 1.000,00 · **sobrepago**: USD
    203,00"*, no "saldo pendiente de -203". Es `saldoLegible` haciendo exactamente lo que su
    comentario promete.

- **2026-09-18 (CIERRE 8) — RECORRIDO DE INTERACCIONES hecho contra `dev`, clic por clic. Casi
  todo pasa; sale UN bug real y el tercer punto ciego del mismo guardián.**

  **PARA QUIEN ABRA LA PRÓXIMA SESIÓN, leer esto primero:**

  - 🔴 **EL HALLAZGO: la vista `todo` es MENOS capaz que la vista `closer`.** Como developer en
    vista `todo` (la de por defecto, la más ancha), crear persona en `/mi-dia` falla con *"Registrar
    trabajo de venta es del closer."*; la misma acción con los mismos datos **funciona en vista
    `closer`**. Se probó seguido, en el navegador. Causa: `lib/mutations/personas.ts:236` compara
    `actor.rol !== "closer"` a mano, cuando la pregunta ya tiene función (`trabajaLeads`).
    **Es un bug por dos razones, y la segunda es la grave:** AGENTS.md dice que todo `rol === "..."`
    a mano que excluya al developer es un bug; y **invierte el modelo del 028**, porque si la
    proyección más ancha no es un superconjunto de las estrechas, "estrechar" dejó de significar
    algo. Ticket **032**.
  - 🩸 **TERCER punto ciego del guardián del 028, en un solo día.** Los dos anteriores (solo cazaba
    comparaciones literales; no recorría `lib/`) se arreglaron hoy. Este es distinto y **es una
    exención escrita a propósito**: el guardián exige `.user` antes de `.rol` para NO marcar
    `actor.rol === "closer"`, razonando que ese rol "ya viene proyectado". **Venir proyectado dice
    de dónde salió el valor, no si compararlo excluye al developer.** Y lo excluye.
    🎯 **La lección: un guardián se prueba mordiendo, y su lista de exenciones es donde se esconde
    lo que no caza.** Cada exención hay que leerla como una afirmación que puede ser falsa.
  - **Hermano, sin ticket propio (va dentro del 032):** `scripts/usuarios.ts:124-125` calcula la
    salvaguarda del último administrador con `rol === "gerente"`, pero AGENTS.md dice que esa
    pregunta es `esAdministrador` (gerente Y developer). Conservador, no abre hueco, pero
    contradice el documento. Y **el guardián no recorre `scripts/`**.

  **LO QUE PASÓ, y es la mayoría** (todo verificado clic a clic, no leyendo código):

  - ✅ **Criterio 1 de la spec, completo:** llamada cerrada + venta + primer abono en un solo
    registro, y en la base quedó con closer `Mani`, cohorte **C2**, programa y producto correctos.
    `calls` guarda bien las DOS cosas que se llaman origen: `origen = "app"` (procedencia, ADR 0010)
    y `origen_id → "Agenda del día"` (el catálogo). No se pisan.
  - ✅ **Criterio 6, completo:** recurso creado desde `/recursos` con categoría Drive, y aparece con
    Copiar / Abrir / Reemplazar / Desactivar. Una URL `http://` se rechaza con *"La URL debe empezar
    por https://."* (ADR 0017).
  - ✅ **Anulación (ADR 0026) verificada en vivo:** al anular el abono, *Abonado* pasó de USD 400,00
    a USD 0,00 y el saldo de 397,00 a 797,00 **en el acto**, y el abono siguió visible con quién,
    cuándo y por qué. Fuera de las métricas, dentro del historial.
  - ✅ **ADR 0013 confirmado en el dashboard:** con el abono anulado quedó *Caja recaudada* en "—"
    y *Ventas cerradas* en **1**. La anulación tocó la caja y no la venta: son dos métricas y se
    comportan como dos.
  - ✅ **El 028 funciona de verdad, en los dos sentidos.** Vista `closer`: el nav pierde Nerd Stats
    y Ajustes, y `/recursos` esconde los controles de creación. Vista `gerente`: **estando en
    `/mi-dia` la guarda expulsa** a `/programas/comunicarte`, y entrar por URL directa a `/mi-dia`
    o `/nerd-stats` también redirige. La vista estrecha la guarda, no solo el nav.
  - ✅ `/nerd-stats`: los conteos por programa **no dan cero** (el bug del 025 no volvió), los
    abonos figuran en 0 porque el único está anulado (o sea `vigente()` cumple), y la bitácora
    registró los 4 campos del recurso con quién y cuándo.
  - ✅ `/ajustes/usuarios` muestra y edita el `closer_id` de un developer (lo que el 029 arregló).
  - ✅ Todos los desplegables abren con datos: resultado (8), origen (7), producto, plataforma (7),
    categoría (6), y los tres comboboxes Base UI del dashboard.

  **DOS COSAS QUE NO SON BUGS PERO HAY QUE DECIDIR:**

  - Elegir un producto **no prellena** "Precio aplicado", y "Fecha del abono" no trae la de hoy.
    Probablemente deliberado (el precio aplicado puede diferir del de lista, ADR de la C2), pero
    son dos campos que el closer escribe a mano en cada venta.
  - **"Copiar link" falló, y NO se puede concluir que sea un bug:** el permiso `clipboard-write`
    está **denegado en el panel automatizado** (se comprobó: `permissions.query` devuelve `denied`).
    La app degradó bien, con *"No se pudo copiar el link"*. **Esto necesita un clic humano.**

  **LO QUE NO SE RECORRIÓ** (para que nadie lo dé por probado): `/personas` como pantalla propia,
  el dashboard de Tactical, `/ajustes/catalogos`, `/ajustes/fuentes`, `/ajustes/programas`,
  "Reemplazar" un recurso, el alta de abono suelto sobre una venta existente, y la reja de
  sobrepago.

  **Datos de prueba que quedaron en `dev`** (no en `production`): la persona
  `prueba.recorrido@ejemplo.com` con su llamada, venta y abono anulado, y el recurso "Carpeta Drive
  ComunicArte". Inofensivos; borrarlos si estorban.

- **2026-09-18 (CIERRE 7 del mismo día) — El 028 cerrado (543 tests, sin migración), los 5 enlaces
  de PayPal y las 6 categorías cargados en `production`, y un incidente propio con `seed:datos`
  que hay que terminar de limpiar.**

  **PARA QUIEN ABRA LA PRÓXIMA SESIÓN, leer esto primero:**

  - ✅ **`main` SÍ está pusheado.** `git ls-remote origin main` y `git rev-parse main` daban lo
    mismo al abrir la sesión. **La advertencia del CIERRE 5 ("SIGUE SIN PUSHEAR") está vencida**;
    no la creas sin comprobar, el fenómeno es intermitente y hay que medirlo cada vez.

  - 🩸 **EL INCIDENTE, y es el que más importa: `npm run seed:datos` NO es un no-op sobre una base
    viva.** Se corrió contra `production` para crear las 6 categorías de recurso (que faltaban) y
    **de paso insertó 3 productos** que duplican los 2 que el equipo había creado a mano desde
    `/productos` esa misma mañana: la semilla los busca **por nombre**, y sus nombres genéricos
    ("Programa completo", "Reserva de cupo") no coinciden con los reales ("Método ComunicArte",
    "De Cero a Tactical Investor"), así que no los reconoció y los agregó al lado.
    **La sesión verificó `programs`, `sources` y las cuatro ventanas de venta de las cohortes
    —las cinco coincidían exactamente— y NO verificó `productos`.** Afirmó que sería un no-op y no
    lo era. La lección no es "revisá mejor": es que **un script de semilla reconcilia por un campo
    que puede haber cambiado**, y sobre una base que ya vive eso inserta en vez de reconocer.
    ⚠️ **QUEDA PENDIENTE BORRAR ESOS 3.** El script está en `scripts/_limpiar-productos-semilla.ts`
    (TEMPORAL, borrarlo después de correrlo; simula por defecto, `-- --escribir` aplica, y solo
    toca filas con cero referencias). Los ids están dentro. **Mientras no se corra, el desplegable
    de producto al registrar una venta muestra 5 opciones y un closer va a elegir mal.** El borrado
    directo desde la sesión lo bloqueó el clasificador de permisos, correctamente.

  - 🎯 **028 cerrado, y la lección es sobre el GUARDIÁN, no sobre el selector.** La primera entrega
    arregló las tres comparaciones literales (`/mi-dia`, `/recursos`, `/productos`), escribió un
    guardián y se declaró completa. **Pero tres sitios más seguían pasando `session.user.rol` crudo
    a una función que decide alcance**, y el guardián no los veía porque solo cazaba comparaciones
    contra un literal: `personas/acciones.ts` (un developer en vista closer seguía buscando en
    TODOS los programas, incumpliendo un criterio explícito del ticket), el **segundo `actorDe`**
    de `productos/acciones.ts` (había dos funciones con el mismo nombre y solo se arregló una), y
    `anulaciones.ts`, que **tenía un comentario del autor del 029 pidiendo justo ese cambio** y
    quedó mintiendo. **La forma que sobrevive no es la que el guardián conoce.** El guardián final
    recorre `app/` Y `lib/`, borra comentarios y cadenas antes de analizar, caza las dos formas
    (comparación literal y valor crudo), y sus 7 excepciones están nombradas con su porqué.
    **Se probó adversarialmente:** se metió una violación real en un archivo nuevo bajo
    `lib/queries/`, el guardián falló señalando archivo, línea y forma, y se borró el archivo. Un
    guardián que no se prueba mordiendo es confianza falsa. **Hacé eso con el próximo.**

  - **La propiedad de seguridad del 028 se sostiene:** `proyectarRol` ignora la cookie entera si el
    rol no es de acceso total, así que un closer con una cookie `gerente` puesta a mano sigue siendo
    closer. El único efecto posible de la vista es que un developer PIERDA acceso. Sin migración:
    la cookie no es esquema.

  - **Los dos `actorDe` quedaron separados a conciencia.** Contestan la misma pregunta pero devuelven
    tipos distintos (el de personas lleva `closerId` por ADR 0011, el de productos no). Lo que se
    unificó fue la FUENTE del rol. Forzar una función con dos formas de retorno habría sido el error
    opuesto al que advierte el ADR 0024.

  - 💳 **Los 5 enlaces de PayPal de ComunicArte están cargados en `production`** (797, 697, 400, 300
    y 200 USD), vigentes, activos y **sin producto** (decisión de Mani: los tres montos bajos son
    abonos parciales, no productos distintos). Salieron del grupo de WhatsApp *Ventas ComunicArte*,
    publicados por Michael el 10-sep bajo el rótulo "LINKS PAYPAL COMUNICARTE".
    ⚠️ **El JSON quedó en el scratchpad de la sesión, que es efímero.** Si se necesita de nuevo,
    darle una casa estable fuera del repo y apuntar ahí `ENLACES_PAGO_JSON`. Ningún link vive en git.

  - 🔍 **Tactical Investor NO tiene catálogo de links, y eso rompe un supuesto de la spec.** Se
    revisó *Ventas JP Vieira* del 18-ago al 18-sep: **los links se generan uno por venta y a pedido**
    (1000 USD para Jero, 1500 para un correo puntual de Andrea), desde una cuenta compartida. La
    entidad `enlaces_pago` modela un catálogo durable; la operación de Tactical es ad-hoc.
    **Decisión de Mani: dejarlo vacío por ahora.** El criterio 6 se cierra solo con ComunicArte.

  - 🔴 **HALLAZGO DE SEGURIDAD SIN RESOLVER: la contraseña de la cuenta de PayPal de Retia está
    publicada en texto plano** en el grupo *Ventas JP Vieira*, desde el 18-ago, con el mensaje "con
    esta cuenta tenemos acceso al paypal de JP Vieira". No se copió a ningún archivo. Rotarla y
    borrar el mensaje sigue pendiente, es decisión de Mani.

  - ⚠️ **`scripts/cargar-enlaces-pago.ts` hace `db.insert` en crudo y NO escribe en `change_log`**,
    saltándose el molde de catálogo. `crearEnlacePago` sí cumple el contrato del ADR 0012; el script
    no. Los 5 enlaces entraron sin rastro de auditoría (verificado: `change_log` de `enlaces_pago`
    está en 0). No falla, solo omite. Tampoco tiene alias en `package.json`: se corre con `npx tsx`.
    **Pregunta de diseño abierta: ¿un script de semilla debe dejar rastro, o no?** Hoy ninguno lo
    hace, así que la respuesta debe valer para todos, no solo para este.

  - **No hay camino de línea de comandos para crear un recurso**: el único que llama `crearRecurso`
    es la server action de la pantalla. **Y está bien que así sea**: el criterio 6 es sobre alguien
    USANDO `/recursos`, así que insertar la fila por detrás poblaría el dato sin probar el criterio.
    Ahora que las 6 categorías existen, crear el primer recurso desde la pantalla es la prueba.

  - **DECISIÓN DE MANI sobre los closers inactivos (cerrada, no volver a preguntar):** Dana, Alejo,
    `juanse` y Sebastian **no se dan de alta**. Quedan solo como `closer_id` histórico: siguen
    apareciendo como closer asignado en las métricas, pero sin cuenta. Anotado en el ticket 007.

  - 🩸 **EL BUG QUE MÁS ENSEÑA DE TODO EL DÍA: el menú de usuario tumbaba el layout entero al
    ABRIRLO, y estaba roto DESDE ANTES del 028.** `DropdownMenuLabel` es `Menu.GroupLabel` de Base
    UI, que exige vivir dentro de un `Menu.Group` o un `Menu.RadioGroup`. La cabecera (nombre,
    correo, badge) estaba suelta → `MenuGroupContext is missing` → como el menú vive en el sidebar,
    o sea dentro del layout, **el error se llevaba puesta la página completa**.
    **543 tests en verde con el bug adentro.** Es un error de contexto de React en tiempo de
    ejecución: no existe test de este repo que lo vea. `git show 75b2201:components/user-menu.tsx`
    tiene el mismo label suelto, así que **el menú nunca se había abierto en un navegador**, ni en
    el "recorrido visual" del CIERRE 5. Se descubrió el 18-sep al hacerle clic por primera vez.
    🎯 **La lección, y es de método:** un recorrido visual que solo CARGA pantallas no es un
    recorrido visual. Lo que rompe son las interacciones —abrir un menú, desplegar un select— y
    esas no se ejercitan mirando. El 028 agregó un segundo label con el mismo defecto, así que
    arreglar uno no alcanzaba. Y esto es lo que **desbloqueó** el criterio del 028 "el selector se
    ve siempre": estaba escrito y era literalmente inalcanzable.

  - ✅ **Los 3 productos de la semilla BORRADOS de `production`** (con ok de Mani). Quedan los 2
    reales. Confirmación de la causa raíz: la misma semilla corrida contra `dev` **no duplicó nada**
    (`= ya existe, no se toca`), porque allá los productos SÍ habían nacido de la semilla y los
    nombres coincidían. El problema nunca fue el script: fue reconciliar por un campo que cambió.

  - 🧪 **`dev` está listo para el recorrido de Mani** (decisión suya: probarlo todo él antes de
    entregárselo al equipo). Su usuario allá ya es `developer` con `closer_id = "Mani"` y los DOS
    programas, hay cohortes C2 activas, productos, 8 motivos y 7 orígenes, y se le sembraron las 6
    categorías de recurso que faltaban. Solo hay 2 personas: para practicar la búsqueda conviene
    crear más desde el "Crear persona" de `/mi-dia`.

  - **El correo de Andrea queda PENDIENTE por decisión de Mani** (18-sep), no por olvido. Sin él,
    `production` sigue con un solo closer activo (Maru).

  - 🚀 **Desplegado:** `main` pusheado hasta `677cf19`. `/api/health` responde 200 y la raíz da 307
    a login (nada público). ⚠️ **No se pudo confirmar QUÉ COMMIT quedó vivo:** el conector de
    Vercel pide OAuth y la sesión no lo tenía. Eso se mira en el dashboard.

  - 🆕 **Ticket 031 nuevo, pedido de Mani:** cargarse el `closerId` propio desde el perfil, sin pasar
    por `/ajustes/usuarios` (que es la pantalla de administrar A OTROS). **Tiene una decisión abierta
    que NO es cosmética:** `closerId` es la llave que ata un usuario a su historia, así que un closer
    que pudiera editarse el suyo se atribuiría las 317 llamadas de Andrea escribiendo su nombre en un
    campo de texto. Sin error y sin cifra rara. Las tres opciones están planteadas en el ticket.

- **2026-09-18 (CIERRE 6 del mismo día) — Las fechas de aplicación entran a `CAMPOS_COMPARABLES`:
  el sync se auto-repara. 511 tests. Verificado contra `production` sin escribir.**

  **PARA QUIEN ABRA LA PRÓXIMA SESIÓN, leer esto primero:**

  - **Decisión de Mani, cerrada:** `fechaPrimeraAplicacion` **y** `fechaUltimaAplicacion` están en
    `CAMPOS_COMPARABLES` (`lib/sheets/plan-sync.ts`). Van las dos y no solo la primera: son el
    mismo concepto, las escribe el mismo dedup y las corrompió el mismo centinela; dejar una fuera
    sería la clase de asimetría que se ve bien y falla sola.
  - **Qué cambia en la práctica:** un centinela reparado por `parsearFecha` ahora produce un diff, así
    que **el sync lo corrige solo** en la corrida siguiente, con su fila de bitácora.
    `npm run backfill-fechas` queda como herramienta de una sola vez (ya ejecutada), **no como pieza
    del diseño**. Su encabezado lo dice, para que nadie lo lea como el camino normal.
  - ⚠️ **EL RIESGO DE ESTE CAMBIO, y tiene test propio porque no falla, miente.** `compararCampos`
    compara `String(valor)`. Si una fecha leída de la base y la misma recién parseada de la hoja
    dejaran de dar la MISMA cadena, **cada sync vería un diff falso en cada persona y reescribiría
    la base entera —4.599 filas y 4.599 de bitácora— todos los días, sin que nada fallara.** El test
    "la MISMA fecha no produce un diff falso" en `tests/plan-sync.test.ts` es el que se entera.
  - 🎯 **Y se midió contra `production`, no solo en tests:** se corrió `planificarSync` con los datos
    reales de las dos hojas **sin escribir**. Resultado: de 4.599 personas el próximo sync
    actualizaría **6 filas, y ninguna por fecha** (3 `ingresoDeclarado`, 2 `nombre`, 2 `urgencia`,
    cambios de verdad en la hoja). Si la comparación fuera inestable, ahí saldrían miles. **Esa
    simulación es la forma de comprobar cualquier cambio futuro a `CAMPOS_COMPARABLES`.**
  - **Un test cambió de significado a conciencia:** el que decía *"cambiar un campo que no se compara
    (estado, fechas) no dispara escritura"* se partió en dos. `estado` sigue fuera (F-01 abierto);
    las fechas ahora sí disparan. El comentario *"si cambia, que sea consciente"* cumplió su función
    exactamente como estaba pensado: frenó a la sesión anterior, que lo dejó como decisión de Mani
    en vez de voltearlo por su cuenta.

- **2026-09-18 (CIERRE 5 del mismo día) — Los dos huecos de rol cerrados: nace `/personas` y
  `/recursos` deja de esconderle la edición al developer. 507 tests. Recorrido visual hecho.**

  **PARA QUIEN ABRA LA PRÓXIMA SESIÓN, leer esto primero:**

  - 🆕 **Existe `/personas`**, una ruta nueva: buscar un lead por nombre o correo y abrir su
    historial. La ven gerente y closer (ADR 0009) y ya está en el sidebar. **No es una pantalla de
    trabajo**: no toma personas ni registra, para eso sigue `/mi-dia`.
  - **Por qué nació:** `/personas/[id]` existía y su guarda dejaba entrar al gerente, pero el ÚNICO
    enlace hacia allá vivía dentro del buscador de `/mi-dia`, que es exclusiva de closer. **Faltaba
    la ruta, no el permiso.** Un gerente no podía abrir el historial de ningún lead.
  - 🩸 **Y debajo había un bug de la misma familia que los dos de ayer:** `buscarPersonas` filtraba
    SIEMPRE por membresía, sin mirar el rol. Un gerente no necesita membresías → no encontraba a
    nadie, nunca. **La pregunta era del rol y se contestaba con la membresía**, igual que
    `exigirAccesoAlPrograma` en productos. Ahora el alcance lo decide el rol: `esAdministrador` ve
    todos los programas activos, el closer sus membresías.
  - ⚠️ **Un test afirmaba el hueco como si fuera regla** (*"un gerente no puede buscar personas"*).
    Se cambió a conciencia y con el porqué escrito: lo que el ADR 0003 prohíbe es que el gerente
    REGISTRE, no que mire. **Cuidado con los tests que documentan un bug: se ven idénticos a los que
    documentan una decisión.**
  - **`buscarPersonasAccion` se MOVIÓ** de `mi-dia/acciones.ts` a `personas/acciones.ts`, con
    `requireRole("gerente","closer")`. La comparten las dos pantallas y la regla de quién puede
    buscar tiene que ser una sola, igual que la anulación que ya vivía ahí.
  - **`/recursos` arreglado:** la prop pasó de `esGerente` (`rol === "gerente"`) a `puedeEditar`
    (`esAdministrador`). El developer YA podía escribir —las server actions pasan por
    `puedeAcceder`— pero la pantalla no le ofrecía los controles: **podía hacerlo y no tenía cómo.**
  - 🎯 **La lección, y es reutilizable: el nombre de la variable era el bug.** `esGerente` para
    decidir un permiso ya contestó mal la pregunta, porque la pregunta nunca fue de qué rol es
    alguien sino de qué puede hacer. **Cuando una variable de permiso se llame como un rol,
    sospecha.** Está en AGENTS.md.
  - **Verificado en el navegador, no solo en tests:** `/personas` busca y devuelve gente de LOS DOS
    programas (antes, como developer sin membresías, habría dado cero), el botón Historial abre
    `/personas/[id]` con las anulaciones tachadas, `/recursos` ya muestra "Nuevo recurso" y "Nuevo
    enlace de pago", y la consola sale limpia.
  - **Los tres incumplimientos de la regla "al developer no se le restringe nada" quedaron
    cerrados** (productos, recursos, buscador). El **028** sigue valiendo, pero por su razón propia:
    unificar "¿con qué rol proyecto esta pantalla?" en `rolDeVista`, no tapar un agujero.

  ⚠️ **SIGUE SIN PUSHEAR.** Los commits de hoy están solo en local: el harness bloquea `git push`
  desde la sesión. Y ojo: una vez `main` apareció pusheado sin que nadie corriera el comando y otra
  vez no, así que el fenómeno es intermitente. **Comprobar `git ls-remote origin main` antes de
  asumir cualquier cosa sobre qué está desplegado.**

- **2026-09-18 (CIERRE 4 del mismo día) — El centinela del año 1 ARREGLADO y reparado en
  `production`: 0 filas dañadas, 839 fechas reales recuperadas. 500 tests.**

  **PARA QUIEN ABRA LA PRÓXIMA SESIÓN, leer esto primero:**

  - **El hallazgo del CIERRE 3 está cerrado.** `parsearFecha` tiene piso de plausibilidad
    (`ANO_MINIMO_PLAUSIBLE`, año 2000) y devuelve `null` ante un centinela. Los 3 tests se vieron en
    rojo antes. La reparación de lo ya escrito es `npm run backfill-fechas` (simula por defecto;
    `-- --escribir` aplica), **idempotente**: solo toca filas bajo el piso.
  - **Resultado real en `production`:** 1.034 afectadas → **839 recuperaron su fecha verdadera**,
    195 quedan en `null` porque TODAS sus filas traían centinela. Cero filas dañadas hoy.
  - ⚠️ **Y esto es lo que hay que entender antes de celebrar: el dashboard casi no se movió.**
    Los leads de la cohorte C2 de Tactical pasaron de 798 a **801**, +3. Lo recuperado es casi todo
    de junio y julio (julio: 327 → 1.017), o sea ANTES de la ventana de la C2. El arreglo importa
    para la verdad del dato y para cualquier mirada histórica o de C1, **no** para la cifra que se
    está mirando hoy. Quien espere un salto en el dashboard se va a confundir.
  - 🎯 **La lección, y no es sobre fechas:** la regla vieja ("un mapeo que no cuadra falla
    ruidosamente") ataja lo que NO se puede leer. El agujero era lo que **sí se lee y no significa
    nada**. `1/1/0001` es sintácticamente una fecha perfecta. No hubo error, no hubo cifra rara, no
    hubo nada que revisar, y el 39% de un programa llevaba días invisible. Está en AGENTS.md como
    regla: **cuando entre un tipo de dato nuevo desde una hoja, preguntar cuál es el valor que esa
    fuente escribe cuando no sabe.**
  - 🩸 **El efecto de segundo orden fue peor que el directo.** El dedup conserva la fecha más
    antigua, así que el año 1 le ganaba siempre: **una sola fila envenenada le borraba la fecha real
    a alguien que sí la tenía.** 839 de las 1.034 eran eso, no filas genuinamente sin fecha.
  - 🧱 **El guardián del ADR 0012 cazó los comentarios del arreglo**, porque nombraban un programa
    dentro de `lib/`. Tenía razón dos veces: por la regla y por el fondo, el centinela es un
    problema de formato de datos y no de un programa. Los números concretos viven en este handoff.

  ✅ **DECISIÓN CERRADA el mismo día (Mani): SÍ entran a `CAMPOS_COMPARABLES`.** Ver el CIERRE 6
  arriba. Lo que sigue es el planteamiento tal como quedó cuando estaba abierta:

  🔓 **~~DECISIÓN ABIERTA~~: ¿`fechaPrimeraAplicacion` debe estar en `CAMPOS_COMPARABLES`?** Hoy no está (`lib/sheets/plan-sync.ts:17`), así que el sync **nunca**
  actualiza una fecha por sí sola: una persona cuyo único campo malo es la fecha no entra a
  `aActualizar`. Por eso hizo falta el script. Eso NO se cambió porque
  `tests/plan-sync.test.ts` dice explícitamente que la exclusión es a propósito (*"Hoy es así a
  propósito (F-01 y F-05 siguen abiertos). Si cambia, que sea consciente"*), y voltearla sin que
  Mani lo decida sería justo lo que ese comentario pide no hacer. **Si se mete a la comparación, el
  sync se auto-repara y el script sobra; si no, todo centinela futuro necesita backfill a mano.**

- **2026-09-18 (CIERRE 3 del mismo día) — Verificación del 029 contra `production` HECHA y pasada.
  Equipo y productos dados de alta en `production`. Un bug de rol encontrado y arreglado.
  Dos hallazgos nuevos sin tocar, uno de ellos grave. 496 tests.**

  **PARA QUIEN ABRA LA PRÓXIMA SESIÓN, leer esto primero:**

  - 👑 **REGLA NUEVA DE MANI, y gobierna todo: el developer es el DUEÑO, no se le restringe NADA.**
    Está en AGENTS.md y en el ADR 0025 punto 5. Operativamente: **todo `rol === "..."` escrito a
    mano que excluya al developer es un bug, no una decisión.** La proyección por rol existe para
    que una pantalla no le salga vacía, nunca para darle menos.
  - **El pendiente del 029 está cerrado.** Se corrieron contra `production` las MISMAS funciones
    que llaman las páginas (`conteosPorPrograma`, `armarVistaDelDashboard` ×4, `historialDePersona`),
    con el cliente apuntado allá. Ninguna reventó; 470 a 740 ms. **`conteosPorPrograma` da 1.977 y
    2.622, no cero: la subconsulta correlacionada del 025 no volvió.** Se eligió ese camino en vez
    de apuntar el dev server a `production` porque contesta lo mismo y **no puede escribir**.
  - **`production` ya tiene equipo y productos** (escrituras con el ok de Mani, rama comprobada
    antes de cada una):

    | quién | rol | closer_id | programas |
    |---|---|---|---|
    | `administrativa@retiagrowth.com` | gerente | — | — |
    | `manuelmejiaarana@gmail.com` | developer | — (no lo quiere) | — |
    | `soymarumarquez@gmail.com` | closer | `Maru` | los dos |

    Productos: **Método ComunicArte** 797 USD (Comunicarte) y **De Cero a Tactical Investor**
    1500 USD (Tactical). Precios = los de la cohorte C2 activa, aprobado por Mani.
  - 🔑 **El `closer_id` NO se inventa ni se le pregunta a nadie: está en la columna "Closer" de la
    pestaña "Registro de llamadas" de cada hoja.** Valores reales: `Andrea` (125 Tactical + 192
    Comunicarte), `Maru` (1 + 10), y además `Dana`, `Alejo`, `juanse` (minúscula, ojo) y
    `Sebastian`, 96 llamadas entre los cuatro, que Michael no listó como activos. **Falta el correo
    de Andrea y nada más**: su `closer_id` ya se sabe.
  - **Mani NO quiere `closer_id` ni membresías.** Como developer solo quiere ver, y para ver no
    hace falta ninguna de las dos: los dashboards y `/nerd-stats` no filtran por usuario.

  🔴 **HALLAZGO GRAVE, SIN TOCAR: 1.034 de las 2.622 personas de Tactical Investor (39%) tienen
  `fecha_primera_aplicacion` en el año 1, así que NO cuentan como lead en ninguna pantalla.**
  Comunicarte está limpio. La hoja de Tactical trae literalmente `1/1/0001 0:00:00` como centinela
  de "vacío"; `parsearFecha` lo lee **correctamente** como el 1 de enero del año 1, porque es una
  fecha válida, y no avisa. Peor: el dedup conserva la fecha **más antigua**
  (`lib/sheets/dedup.ts:103`), y el año 1 le gana a cualquier fecha real, así que **una sola fila
  envenenada le borra la fecha buena a alguien que sí tiene filas buenas**: 704 de los 1.034 son
  personas con 2+ aplicaciones. **Y no se cura solo:** `fechaPrimeraAplicacion` se escribe en el
  update pero NO está en `CAMPOS_COMPARABLES` (`lib/sheets/plan-sync.ts:17`) y el plan descarta a
  quien no tenga ningún diff (`plan-sync.ts:57`), así que arreglar el parser no repara lo escrito.
  Arreglo en tres piezas: piso de plausibilidad en `parsearFecha` (año 1 → `null`, y el dedup lo
  ignora solo), backfill desde `raw`, y decidir si `fechaPrimeraAplicacion` debe ser comparable.

  🐛 **EL BUG ARREGLADO, y la lección es que apareció fuera de los tests.** `exigirAccesoAlPrograma`
  en `lib/catalogo/productos.ts` preguntaba `actor.rol === "gerente"`, así que un developer caía al
  chequeo de membresía y recibía un **403 que además mentía**: *"no puedes gestionar productos de un
  programa donde no vendes"*, cuando el developer no vende en ninguno por definición. Se destapó
  **intentando cargar los productos reales de `production`**, no en un test. Arreglo: una línea,
  `esAdministrador(actor.rol)`, predicado que el repo ya tenía sin usar acá. Test de regresión con
  un developer **sin membresías**, visto en rojo con el mensaje exacto del bug antes de tocar nada.
  Los productos se cargaron **con la cuenta de developer**, que es la prueba real del arreglo.

  ⚠️ **Incumplimiento conocido de la regla nueva, sin tocar:** `app/(app)/recursos/page.tsx:41`
  decide `esGerente` con `rol === "gerente"` y le esconde al developer la creación de recursos y
  enlaces. Es del ticket **028**, que convierte esa pregunta en `rolDeVista`.

  🕳️ **HUECO DE DISEÑO, sin tocar: un gerente no puede abrir el historial de NINGÚN lead.** El
  único enlace a `/personas/[id]` está dentro del buscador de `/mi-dia`
  (`components/mi-dia-registro.tsx:216`), `buscarPersonas` filtra por membresía y `/mi-dia` es
  exclusiva de closer (ADR 0003). El gerente no tiene ruta. No es config, es diseño.

  **Corrección a algo que se creía:** en `/nerd-stats`, "Últimos cambios desde la app" **vacío era
  lo correcto** en `production`: filtra por `origen = "app"` y las 80 filas de `change_log` de allá
  eran todas del sync. Ya no: las altas de esta sesión dejaron 12 filas con `origen: app`.

  **Sigue pendiente de Mani:** el correo de Andrea, los 5 enlaces de PayPal (el script los lee de un
  JSON fuera del repo vía `ENLACES_PAGO_JSON`, ADR 0017), decidir el 021, y los dos hallazgos de
  arriba. El 028 está listo para codear. ⏰ **Comunicarte C2 cierra ventas el 21-sep.**

- **2026-09-18 (CIERRE 2 del mismo día) — Ticket 029 cerrado: anular registros. ADR 0027 nuevo.
  Migraciones 0013 y 0014 en `dev` Y en `production`. Commiteado, pusheado y desplegado.
  Recorrido visual de la anulación hecho, 3 hallazgos, los 3 arreglados. 495 tests.**

  **PARA QUIEN ABRA LA PRÓXIMA SESIÓN, leer esto primero:**

  - **Las DOS ramas de Neon van en 15 migraciones.** `dev` (`br-withered-sun-b439zjof`) y
    `production` (`br-withered-mud-b4cvvg80`). Las 0013 y 0014 se aplicaron en `production` con el
    ok explícito de Mani, comprobando `neon.branch_id` antes de escribir (ADR 0018) y pasando la
    URL por el entorno del proceso, nunca por la línea de comandos.
  - **`main` está pusheado y desplegado.** Commit `8eff647`, verificado contra el remoto real con
    `git ls-remote`. Deploy de producción `Ready`; `/api/health` responde 200 y el dashboard sin
    sesión redirige al login con 307.
  - ⚠️ **El orden importó y quedó bien por poco.** El código de `main` consulta `anulado_en` y
    `sales.call_id` en cada consulta del embudo. Si se hubiera pusheado ANTES de migrar, el
    dashboard, `/mi-dia`, el historial y `/nerd-stats` habrían reventado con *column does not
    exist*. **Migrar primero y desplegar después es la regla**: las migraciones aditivas no rompen
    el código viejo (las columnas sobran hasta que llega quien las use), al revés sí.
  - **Forma de los datos de `production` (18-sep):** ~4.600 personas y **cero llamadas, cero
    ventas, cero abonos**. Solo leads. Por eso la anulación allá todavía no tiene nada que tocar, y
    por eso un dashboard en ceros allá es lo correcto, no un síntoma.
  - 🤔 **Algo pusheó `main` antes de que yo corriera `git push`**, que respondió "Everything
    up-to-date". No hay hooks de git en el repo. Sospecha: la integración del escritorio. No está
    confirmado; se deja anotado por si vuelve a pasar y confunde a alguien.
  - **El 029 está commiteado en `main`** (31 archivos, incluidas las dos migraciones y estos
    docs). Árbol limpio; typecheck, lint, build y 495 tests, todos limpios.
  - **En `dev` se gastaron los datos de prueba del recorrido anterior.** Las dos ventas de
    Ana Prueba y sus tres abonos quedaron anulados, más una venta nueva que se creó y se anuló para
    probar la cascada. Queda viva una llamada de compromiso de pago. Si hace falta ver
    `/personas/[id]` con contenido vigente, hay que registrar algo nuevo desde `/mi-dia`.
  - **A Mani se le cargó `closer_id = 'Mani'` en `dev`.** Estaba en `null` desde que volvió a
    `developer`, y sin eso `/mi-dia` rechaza cualquier registro. En `production` sigue sin cargar.

  **Qué es el 029, en una línea:** una llamada, una venta o un abono se ANULAN con motivo, dejan de
  contar en toda métrica, y siguen viéndose tachados en el historial de la persona.

  🎯 **LA LECCIÓN DE LA SESIÓN, y no es sobre anular: `revalidatePath` no refresca la pantalla que
  acaba de escribir.** Al anular un abono la base quedaba perfecta —anulado, con motivo, autor y su
  fila en `change_log`— y **la pantalla seguía mostrando el total anterior**. Escritura correcta y
  pantalla mintiendo, que es peor que fallar: quien lo viera volvería a anular "porque no funcionó".
  La causa: `revalidatePath("/personas", "layout")` no coincidía con nada (ruta dinámica, y
  `personas/` no tiene layout propio), así que esa línea parecía trabajo y no invalidaba nada, **sin
  error**. El arreglo es `router.refresh()` en el cliente para la ruta actual, y `revalidatePath`
  por PATRÓN (`"/personas/[id]", "page"`) para las otras. Está en AGENTS.md. **Ningún test lo
  habría cogido nunca**: es exactamente lo que el recorrido visual existe para encontrar.

  **Lo que se construyó:**

  - **`lib/queries/vigente.ts`** — `vigente(tabla)` es LA definición de "este registro cuenta", e
    `incluyendoAnulados(tabla)` es la marca explícita de que una consulta quiere ver lo anulado (el
    historial, ADR 0026 punto 4). Las 21 lecturas del embudo pasan por ahí.
  - **`tests/vigencia-centralizada.test.ts`** — el guardián, escrito ANTES y visto en rojo. La
    unidad de análisis es la **cadena de drizzle**, no el archivo ni el statement: dentro de una
    función no hay ningún `;` a profundidad cero, así que cortar por statements mete el archivo
    entero en una unidad y el guardián deja de poder señalar CUÁL consulta falla.
  - **`lib/mutations/anulaciones.ts`** — la cascada del ADR 0026 punto 2 en una escritura atómica,
    los permisos del punto 6 y una fila de `change_log` por registro anulado.
  - **UI**: `/personas/[id]` dejó de ser de solo lectura, y `/mi-dia` puede anular una venta desde
    la lista.

  **Tres cosas que el ticket NO pedía y que hubo que hacer:**

  1. 🩸 **`sales` no sabía de qué llamada nació**, así que la cascada "llamada cerrada → su venta"
     del ADR 0026 **no se podía cumplir**. Se agregó `sales.call_id` con índice único (una llamada
     cierra como mucho una venta, garantizado en la base) → **ADR 0027**. Las filas viejas y las de
     Sheets no tienen enlace: ahí se RECHAZA con mensaje en vez de adivinar por persona y fecha.
  2. **El guardián acabó mirando todo el código, no solo `lib/queries/`.** Ensancharlo destapó
     cuatro lecturas de esas tablas viviendo en `lib/mutations/`, fuera del alcance original.
  3. **`ventasDePersona` respondía dos preguntas distintas** con el mismo SQL: "¿sobre cuál puedo
     registrar un abono?" (`/mi-dia`) y "¿qué le pasó a esta persona?" (historial). Con la
     anulación dejan de tener la misma respuesta. Partida en dos funciones, sin un booleano.

  **Del 028, adelantado sin querer:** `trabajaLeads(rol)` (la tercera pregunta de la familia de
  roles) y **`/ajustes/usuarios` ya deja cargarle el `closer_id` y las membresías a un developer**.
  Preguntaba `rol === "closer"` a mano, así que el criterio del 028 "con el closerId cargado" era
  **imposible desde la app**. Y quedó DECIDIDO: **la vista del developer estrecha también la
  guarda**, no solo la proyección (razones en el ticket 028).

  **Los 3 hallazgos del recorrido visual de la anulación, todos arreglados:**
  1. 🔴 El refresco (arriba). El grande.
  2. **Tres botones "Anular" idénticos apilados** bajo cada venta: dos de abonos y uno que se lleva
     la venta entera. Ahora el de la venta dice "Anular la venta".
  3. **"Saldo pendiente: USD 797,00" en una venta anulada.** Tachada y aun así afirmando una deuda
     viva. El precio y lo abonado son hechos; el saldo es una afirmación sobre lo que alguien debe,
     y una venta anulada no reclama nada. Es el primo del "Saldo pendiente: USD -103" del cierre 1.

  **Lo que se verificó en vivo** (no solo en tests): la cascada con enlace real (toast *"Se anuló la
  llamada, su venta y 1 abono"*), la rama legacy de punta a punta (rechaza → anulas la venta → ahora
  sí), que un abono ya anulado **conserva su motivo original** cuando después se anula la venta, que
  `saldoLegible` pasó sola de "Sobrepago" a "Saldo pendiente", y que dashboard, `/mi-dia` y el
  historial cuentan la misma realidad después de anular.

  **Sigue pendiente de Mani, sin cambios:** cargar los 5 enlaces de PayPal, decidir el 021, el 007
  (⚠️ `production` tiene 0 productos, así que ningún closer podrá registrar una venta cerrada hasta
  que alguien los cargue), y mirar `/nerd-stats` contra `production`, que nunca se ha visto allá.

  **MINI PROMPT PARA LA PRÓXIMA SESIÓN** (copiar tal cual):

  > Retomamos el Retia CRM (retia-metrics-mani). Lee AGENTS.md y la entrada "CIERRE 2" del 18-sep
  > en docs/agents/handoff.md.
  >
  > Contexto: el ticket 029 (anular registros) está cerrado, commiteado (`8eff647`), pusheado y
  > desplegado. Las dos ramas de Neon van en 15 migraciones. 495 tests verdes, typecheck, lint y
  > build limpios.
  >
  > Lo único que quedó sin comprobar del 029: **abrir el dashboard desplegado con mi sesión.** El
  > build pasa y la app arranca, pero que las consultas nuevas corran bien contra la base de
  > `production` solo se ve pidiendo la página con sesión, y el login es mío. Dime exactamente qué
  > mirar y en qué orden; con `production` en cero llamadas y cero ventas, lo esperable es un
  > dashboard en ceros, no un error.
  >
  > Y de paso `/nerd-stats` contra production, que nunca se ha visto allá. El total de personas
  > debe rondar 4.600 y SUBE con cada corrida del cron, así que no compares contra un número fijo:
  > lo que importa es que los conteos por programa NO sean cero. Un cero ahí es la subconsulta
  > correlacionada del 025 volviendo.
  >
  > Después, en este orden: (1) el **007**, dar de alta al equipo en production — ojo que
  > `production` tiene **0 productos** y sin eso ningún closer puede registrar una venta cerrada;
  > (2) cargar los 5 enlaces de PayPal; (3) decidir el **021**.
  >
  > El **028** está listo para codear y ya tiene decidido que la vista estrecha también la guarda;
  > el 029 le adelantó `trabajaLeads` y el `closer_id` del developer en `/ajustes/usuarios`. El
  > 016 y el 030 pueden esperar.

- **2026-09-18 (CIERRE DE SESIÓN) — Se hizo el recorrido visual de `/mi-dia` de punta a punta.
  7 hallazgos, los 7 arreglados. Dos decisiones nuevas de Mani: "ver como" del developer (028) y
  poder anular/borrar desde la app (ADR 0026, tickets 029 y 030).**

  **PARA QUIEN ABRA LA PRÓXIMA SESIÓN, leer esto primero:**

  - **El recorrido visual de `/mi-dia` YA SE HIZO y pasó.** Era el pendiente número uno del cierre
    anterior. Lo que sigue sin mirarse: `/nerd-stats` **contra production** (en local sí se vio, y
    ahí los números no significan nada), y `/recursos` con contenido (está vacía en las dos ramas).
  - **Árbol limpio, todo en `origin/main`.** 477 tests, typecheck, lint y build limpios.
  - **Mani volvió a `developer` en `dev`**, pero le quedaron **las dos membresías de programa
    activas**. Eso no es basura: el buscador de `/mi-dia` se filtra por MEMBRESÍA, no por rol, así
    que como developer en `dev` la búsqueda ahora sí devuelve resultados. En `production` no tiene
    membresías, así que allá sí daría 0.
  - **En `dev` quedaron datos de prueba a propósito:** 2 personas ("Ana Prueba" en Comunicarte,
    "Ana En Tactical"), 2 llamadas, 1 venta de USD 797 y 2 abonos (400 + 500, con sobrepago
    confirmado). Sirven para mirar `/personas/[id]` con contenido. No se borran porque **no hay
    forma de borrarlos**, que es justo el hallazgo que originó el 029.

  🔴 **LO QUE DESTAPÓ EL RECORRIDO Y ES LO MÁS IMPORTANTE DE LA SESIÓN: no existe ni un solo
  `.delete(` en `lib/`, `app/` ni `scripts/`.** Un closer que le da a "Cerrada" por error inventa
  una venta permanente que cuenta en el embudo, en la caja y en el comparativo entre closers, para
  siempre. La única salida hoy es entrar a la base a mano. Mani decidió que eso se arregla:
  **ADR 0026**, tickets **029** (anular registros) y **030** (borrar del catálogo lo no usado).

  **Los 7 hallazgos del recorrido, todos arreglados y verificados en el navegador:**
  1. 🟠 **"Persona creada" mentía cuando en realidad fue dedup.** El mismo toast verde en un alta
     real y en un correo repetido, con el nombre recién escrito descartado en silencio.
     `crearPersonaManual` ahora devuelve `{ persona, creada }` y el toast dice "Esa persona ya
     existía". El tipo `ResultadoAltaManual` obliga a distinguirlos.
  2. 🟠 **Al abono posterior le faltaba el campo Comprobante.** El estado y el envío a la acción
     existían, pero no había input: el soporte del primer pago se adjuntaba y el de los siguientes
     no. Estado muerto colgando.
  3. **404 en inglés** ("This page could not be found") en una app en español. Ahora hay
     `app/not-found.tsx` (raíz, sin sesión) y `app/(app)/not-found.tsx` (dentro del shell, con
     sidebar y salida).
  4. **Error de Base UI en consola** por `render={<Link/>}` con `nativeButton` en true: se pierde
     la semántica nativa de botón. Arreglado en `mi-dia-registro.tsx` y en `programas-admin.tsx`,
     que tenía el mismo patrón.
  5. **Mensajes de validación del navegador en inglés.** Se resolvió con
     `components/validacion-en-espanol.tsx`, montado UNA vez en el layout raíz, en vez de decorar
     los 32 inputs `required` repartidos en 7 componentes. Listener en fase de CAPTURA porque
     `invalid` no burbujea, y limpieza del mensaje al escribir o el campo queda inválido para
     siempre.
  6. **El dólar salía sin decimales** ("USD 797"). Ahora `usd` siempre lleva dos. El peso NO
     cambia: en Colombia no se cobra con centavos. Era una convención **testeada a propósito**, así
     que se cambió el test, no se rodeó.
  7. **"Saldo pendiente: USD -103"** tras confirmar un sobrepago, que le dice al closer que el
     cliente debe plata cuando pagó de más. `saldoLegible` en `lib/format.ts` devuelve **etiqueta y
     valor juntos** (un sobrepago cambia las dos) y lo importan las dos pantallas que lo preguntan.

  **Lo que el recorrido CONFIRMÓ que funciona** (nada de esto se había visto correr nunca):
  - 🎯 **La zona horaria.** Compromiso de pago con fecha 19 → `2026-09-19 17:00:00+00` (mediodía de
    Bogotá) → el historial dice "19 sep 2026". De punta a punta sin correrse un día.
  - 🎯 **La reja del sobrepago.** Rechaza con la cifra exacta, ofrece "Confirmar sobrepago" y al
    confirmar escribe. Era la garantía del ADR 0024 que nadie había ejercitado.
  - El dedup por (programa, correo) no duplica, no pisa el nombre existente y no ensucia
    `change_log`; el mismo correo en otro programa sí es otra persona.
  - El buscador: mínimo 2 caracteres, ILIKE, `%` escapado (con `%%` da "Sin resultados", no la base
    entera) y **el texto buscado nunca llega a la URL**.
  - `entrada: crm`, `num_aplicaciones: 0` explícito, responsable copiado de la sesión, cohorte
    activa asignada sola, `origen: app`, y venta+abono+llamada en una escritura atómica.
  - `/personas/[id]` da 404 limpio con id basura, **con un correo en la URL** y con uuid
    inexistente. Ningún 500.
  - El rol se relee de la base en cada emisión del token: cambiarlo surte efecto sin cerrar sesión.

  **Las dos decisiones nuevas de Mani (18-sep):**
  - **028 · "Ver como" del developer.** Estaba en "Futuro" y se sacó. La cookie guarda la vista y
    `rolDeVista(session)` pasa a ser LA definición de con qué rol se proyecta cada pantalla. Hoy esa
    pregunta está contestada a mano en tres sitios distintos (`/mi-dia`, `/recursos`, `/productos`),
    **y eso es exactamente por qué el hueco de `/recursos` sobrevivió al ticket 024**. El developer
    SÍ escribe cuando está en vista closer, con su propio `closerId` (decisión explícita de Mani);
    el truco para no tocar las mutaciones es que `actorDe` construya el actor con `rolDeVista`.
    **Queda UNA decisión abierta dentro del ticket:** si la vista estrecha también la GUARDA o solo
    la proyección. Recomendación escrita ahí: que estreche la guarda.
  - **ADR 0026 · anular y borrar.** Registros se ANULAN (soft, con quién/cuándo/motivo, nunca un
    booleano) y lo anulado desaparece de toda métrica pero se ve tachado en el historial. Del
    catálogo se BORRA de verdad solo lo que tiene cero referencias; lo demás se desactiva y la app
    dice por qué. Enmienda acotada al ADR 0012, ya reflejada en AGENTS.md.

  ⚠️ **El riesgo del 029, escrito para que nadie lo subestime:** lo difícil no es escribir la
  anulación, es **olvidar una consulta**. Una cifra inflada se ve creíble y no lanza ningún error.
  Por eso el predicado "está vigente" vive en un solo módulo y hay un test guardián que se escribe
  ANTES y se ve en rojo. Es la misma lección que la subconsulta correlacionada del 025.

  **Sigue pendiente de Mani, sin cambios:** cargar los 5 enlaces de PayPal, decidir el 021, y el
  007 (dar de alta al equipo en `production`). ⚠️ **Y un hallazgo nuevo para el 007:
  `production` tiene 0 productos**, así que cuando entre el equipo ningún closer va a poder
  registrar una venta cerrada hasta que alguien los cargue.

  ~~**MINI PROMPT PARA LA PRÓXIMA SESIÓN**~~ **OBSOLETO: ya se ejecutó.** El 029 se cerró el mismo
  18-sep; el mini prompt vigente es el de la entrada de arriba (CIERRE 2). Se deja el texto porque
  el razonamiento del orden sigue valiendo.

  > Retomamos el Retia CRM (retia-metrics-mani). Lee AGENTS.md y la entrada "CIERRE DE SESIÓN"
  > del 18-sep en docs/agents/handoff.md.
  >
  > Contexto: el recorrido visual de /mi-dia ya se hizo y pasó; los 7 hallazgos están arreglados.
  > Árbol limpio, todo en origin/main, 477 tests verdes. Soy `developer` en las dos ramas de Neon.
  >
  > Arranca por el ticket 029 (anular un registro, ADR 0026). Antes de tocar consultas, escribe el
  > test guardián de `lib/queries/vigente.ts` y muéstramelo en rojo: el riesgo del ticket no es la
  > anulación, es que se te escape una consulta del embudo y las cifras queden infladas sin error.
  > La migración la generas y aplicas tú en `dev`, nunca un subagente, y `production` solo con mi ok.
  >
  > Antes de empezar dime qué decides del 028: si la vista del developer estrecha también la guarda
  > o solo la proyección (tu recomendación quedó escrita en el ticket).
  >
  > Después: /nerd-stats contra production (nunca se ha mirado allá), cargar los enlaces de PayPal,
  > el 007 (ojo: production tiene 0 productos), decidir el 021. El 016 y el 030 pueden esperar.

- **2026-09-18 (cierre anterior, mismo día) — F4 cerrada, todo desplegado y vivo. Lo que falta NO es
  código: es abrir la app y mirarla.**

  **PARA QUIEN ABRA LA PRÓXIMA SESIÓN, leer esto primero:**

  - **El árbol está limpio y todo está en `origin/main`** (`f8aac63`). Sin ramas sueltas, sin
    stash, sin subagentes corriendo. El stash "wip 024 rol developer" que llevaba dos sesiones
    ahí **ya no existe**: se rescató el código y se descartó su migración (cierre 5).
  - **DESPLEGADO Y VERIFICADO.** Deploy de producción `Ready` el 17-sep 23:59, con el alias
    `retia-metrics-seven.vercel.app`. Verificado con la CLI de Vercel
    (`npx vercel ls retia-metrics --scope agencia-dani`), que en esta máquina está logueada como
    `danieltovartech-4302`. **Eso es nuevo y útil: la CLI SÍ sirve para leer deploys**, aunque el
    conector MCP de Vercel pida OAuth y no funcione en sesión no interactiva.
  - **Las dos ramas de Neon están idénticas: 13 migraciones cada una**, `dev`
    (`br-withered-sun-b439zjof`) y `production` (`br-withered-mud-b4cvvg80`), verificado por
    `neon.branch_id` y no por el nombre de la variable.
  - **Mani es `developer` en LAS DOS ramas.** Con eso una sola cuenta ve las pantallas de todos
    los roles, sin cambiarse el rol en la base entre una y otra.
  - **`production` tiene UN solo usuario** (Mani). El equipo todavía no entra: eso es el 007.

  **Qué se cerró hoy:** **024** (rol developer, ADR 0025, migración 0012) y **025**
  (`/nerd-stats`). **Con eso F4 queda cerrada, y con ella F0–F4 completas en código.** Lo único
  abierto del CRM es el **016** (puede esperar), el **007** (operación) y el **021** (bloqueado
  por decisión de Mani). Detalle de cada uno en los cierres 5 y 6, abajo.

  🔴 **EL PENDIENTE NÚMERO UNO NO ES CÓDIGO.** Hay **cuatro pantallas en producción que nadie ha
  abierto nunca**: `/mi-dia`, `/personas/[id]`, `/recursos` y `/nerd-stats`. Mani decidió
  explícitamente acumular toda la verificación para el final, con la advertencia sobre la mesa
  de que acumularla es lo que produjo este estado. Ahora todo está live y no hay nada que
  esperar. **`/mi-dia` es la que más urge:** es la pantalla de captura que alimenta todas las
  métricas, y un campo roto ahí ensucia la base antes de que el dashboard lo delate; ahí el
  arreglo ya no es solo de código. La sesión de recorrido merece checklist, no una pasada.

  **Tres cosas que sigue debiendo Mani y que nadie más puede hacer:**
  1. **El recorrido visual de las cuatro pantallas** (arriba).
  2. **Cargar los 5 enlaces de PayPal** (`scripts/cargar-enlaces-pago.ts` los lee de
     `ENLACES_PAGO_JSON`, fuera del repo; ningún link real vive en git).
  3. **Decidir el 021.**

  **Dos reglas nuevas que gobiernan de aquí en adelante:**
  - **ADR 0025:** `developer` es la única excepción a la disjunción de roles, y la excepción vive
    en UN solo lugar (`esAccesoTotal` dentro de `puedeAcceder`). **Nunca escribas `"developer"`
    en un `requireRole` ni en un `paginaConRol`.** Y pasar la guarda no es tener una pantalla
    útil: lo que la página proyecta adentro sigue decidiéndose por rol.
  - **La plantilla `sql` de drizzle no califica las columnas**, así que una subconsulta
    correlacionada devuelve **0 sin lanzar error**. Está en `AGENTS.md`. Costó la primera versión
    de los conteos del 025 y lo destapó un test, no una revisión.

  ~~**MINI PROMPT PARA LA PRÓXIMA SESIÓN**~~ **OBSOLETO: ya se ejecutó.** El recorrido visual que
  pedía se hizo el mismo 18-sep. El mini prompt vigente es el de la entrada de arriba. Se deja el
  texto porque el razonamiento del orden sigue valiendo.

  > Retomamos el Retia CRM (retia-metrics-mani). Lee AGENTS.md y la entrada "CIERRE DE SESIÓN"
  > de docs/agents/handoff.md.
  >
  > Contexto: F0 a F4 cerradas en código. Todo está en origin/main (f8aac63), árbol limpio, sin
  > stash ni subagentes. Desplegado y vivo en retia-metrics-seven.vercel.app. Las dos ramas de
  > Neon con 13 migraciones, y yo soy `developer` en las dos.
  >
  > No arranques código. Lo primero es el recorrido visual: hay cuatro pantallas en producción
  > que nadie ha abierto nunca (/mi-dia, /personas/[id], /recursos y /nerd-stats). Ármame un
  > checklist por pantalla, campo por campo, empezando por /mi-dia, que es la de captura.
  > Levanta el server local si hace falta (npm run dev, hay .claude/launch.json) y avísame qué
  > mirar; el login lo hago yo.
  >
  > Después de eso: cargar los enlaces de PayPal, decidir el 021, y el 007 (dar de alta al
  > equipo en production, que hoy tiene un solo usuario). El 016 puede esperar.

- **2026-09-17 (cierre 6) — Ticket 025: `/nerd-stats`. F4 cerrada. Sin migración.**

  **F4 queda cerrada.** Con el 024 y el 025 no queda ticket de F4 pendiente. Lo que sigue
  abierto en todo el plan es el **016** (fuentes configurables, puede esperar), el **007**
  (operación, no código) y el **021** (bloqueado esperando decisión de Mani).

  **Qué es `/nerd-stats`:** la salud de la herramienta sin abrir la base. Seis bloques:
  despliegue (entorno, commit, `CRON_SECRET` como sí/no y nunca su valor), usuarios activos
  por rol, registros por origen (hoja vs app — el canario de si el equipo está usando el CRM),
  conteos por programa, últimas corridas de sync y últimos cambios desde la app. Se renderiza
  entera en el servidor: es solo lectura, así que no hay componente cliente ni JS que enviar.

  **Es la primera ruta EXCLUSIVA del developer**, y salió gratis: `paginaConRol("developer")`
  cierra a gerente y closer por la misma función central que le abre todo lo demás al
  developer. El test la mira por el lado que faltaba, el restrictivo: gerente y closer,
  disjuntos entre sí, quedan los DOS afuera de la misma ruta.

  🩸 **El hallazgo de la sesión, y no estaba en el alcance: drizzle renderiza las columnas SIN
  CALIFICAR dentro de una plantilla `sql`.** La primera versión de `conteosPorPrograma` usaba
  subconsultas correlacionadas y se convertía en
  `select count(*) from "people" where "program_id" = "id"`. Ese `"id"` resuelve a la columna
  de la tabla INTERNA, así que compara una fila consigo misma: **todos los conteos devolvían 0
  y no lanzaba ningún error.** Una pantalla entera de ceros creíbles. Lo destapó el test de
  PGlite, que ya estaba escrito antes de correr nada. Reescrita con cinco consultas agrupadas
  unidas en memoria, que a esta escala es gratis y se lee obviamente correcto. **La trampa
  quedó en `AGENTS.md`** porque ningún linter la ve, y la lección general es la de siempre
  aquí: un número mudo en cero es peor que uno que revienta.

  **Dos consolidaciones por ADR 0024, ninguna pedida por el ticket:**
  - **"Últimas corridas de sync" ya existía** dentro de `estadoDeFuentes`. Dos pantallas
    (`/ajustes/fuentes` y `/nerd-stats`) haciendo la misma pregunta: se sacó a
    `ultimasCorridasDeSync` en `lib/queries/fuentes.ts` y las dos la importan. De paso ese
    módulo ganó inyección de base, que no tenía.
  - **`haceCuanto`** vivía suelto dentro de la página de fuentes; ahora está en
    `lib/format.ts` y lo importan las dos.

  **Privacidad, que era criterio de aceptación:** `ultimosCambiosDesdeLaApp` **no proyecta**
  `etiqueta` ni los valores, que es justo donde `lib/mutations/personas.ts` escribe el nombre
  y el correo de un lead. No es cuidado al pintar, es que la consulta no los pide: falla
  cerrado. El test siembra una fila de bitácora con datos de lead y verifica sobre la fila
  entera serializada, no columna por columna, así que una columna nueva con datos personales
  también lo rompe.

  **Rendimiento, el otro criterio:** medido contra `production` (4.497 personas), las cinco
  lecturas en paralelo tardan **356 ms**, contra **347 ms** que cuesta un `select 1` vacío
  desde la misma máquina. El trabajo de base son ~9 ms. **Salvedad honesta:** el primer golpe
  después de que el compute de Neon se duerme tarda ~1,4 s, y eso es Neon despertando.

  **Loops:** 474 tests (eran 462), typecheck, lint y build limpios. `/nerd-stats` aparece en
  el build.

  ~~🔴 **Nada de esto está desplegado todavía.**~~ **RESUELTO el 18-sep: pusheado y desplegado
  (`f8aac63`, deploy `Ready` 23:59, alias de producción), y Mani ya es `developer` en
  `production`.** Se deja el texto por el razonamiento del orden, que sigue siendo la regla si
  algún día se agrega otro rol. Cuando se escribió, los dos commits de hoy (024 y 025) estaban
  solo en local: Mani decidió dejar TODA la verificación visual para el final, con la app ya live.
  Lo que falta, en este orden: **pushear** → esperar el deploy → **poner a Mani `developer` en
  `production`** (la base ya lo acepta, las 13 migraciones están aplicadas en las dos ramas) →
  **sesión de recorrido de las cinco pantallas sin mirar**: `/mi-dia`, `/personas/[id]`,
  `/recursos` y `/nerd-stats`, más los enlaces de PayPal cuando los cargue.
  **El orden importa y no es negociable:** con el código viejo desplegado, un usuario con rol
  `developer` en la base cae en `esRolValido` → false → `token.rol = "closer"`, y Mani entraría
  como closer sin programas, o sea a una app vacía.

  ⚠️ **El riesgo que Mani ya aceptó por escrito:** acumular verificación es lo que produjo el
  estado actual, con pantallas en producción que nadie ha abierto. Ahora son cuatro. La sesión
  de recorrido merece checklist, no una pasada rápida.

- **2026-09-17 (cierre 5) — Ticket 024: rol `developer`. ADR 0025, migración 0012 en `dev`.
  El `git stash` de Kiro quedó cerrado.**

  **El stash ya no existe.** Se decidió (Mani) **rescatar el código y descartar la migración**. Por
  qué: estaba basado en `cc40d4e`, **26 commits atrás**, y su migración pedía el slot `0008`, que
  desde entonces ocupa `0008_registro_y_abonos`; el ADR que proponía como `0022` también quedó
  ocupado (ventana de venta). Un `git stash pop` ni siquiera era posible: colisionaban
  `_journal.json` y `0008_snapshot.json`. Se extrajo archivo por archivo (`git checkout stash@{0} --`
  para los cuatro que no se habían movido, `git apply -3` para los que sí), se regeneró la migración
  como **0012** y el ADR como **0025**, y se hizo `git stash drop`.

  **El código de Kiro era bueno y su decisión de diseño se conservó:** el "pasa todo" vive en un
  solo `puedeAcceder` (vía `esAccesoTotal`) y no repetido en cada guarda. Pero era ~60% del ticket.
  **Tres huecos que no cubría:**
  1. **`/mi-dia` quedaba inservible para el developer.** Pasaba la guarda, pero la página seguía
     con `programasGestionablesPorUsuario(..., "closer", ...)` hardcodeado: un developer no es
     miembro de ningún programa, así que entraba a una pantalla vacía. Kiro hizo esta misma
     inversión en `/productos` y se le olvidó aquí. **El test solo miraba la guarda.** De ahí salió
     el punto 4 del ADR 0025: *una guarda que se pasa no es una pantalla que sirve*.
  2. **`protegerAdministrador` (015) le impedía a un gerente ponerse developer a sí mismo.** Ahora
     pregunta por `esAdministrador`: gerente ↔ developer se permite (no se pierde administración),
     bajar a `closer` o desactivarse no.
  3. **Había una TERCERA definición del union de roles**, escrita a mano en `types/next-auth.d.ts`.
     La destapó `tsc`, no un test: la sesión y el token seguían creyendo que había dos roles. Es
     exactamente el ADR 0024 y estaba escondida en un `.d.ts`, que es donde nadie mira.

  **De paso dejaron de tener literales de rol** `/ajustes/usuarios` (opciones desde `ROLES`), el
  menú de usuario (`Record<Rol, string>` exhaustivo: un rol nuevo sin etiqueta rompe el typecheck) y
  el CLI de emergencia (cuenta administradores, no gerentes).

  **Base:** migración **0012 aplicada en `dev`** (`br-withered-sun-b439zjof`, verificado por
  `neon.branch_id` antes de escribir), 13 migraciones. `manuelmejiaarana@gmail.com` quedó
  **developer en `dev`**.
  ~~🔴 **`production` sigue con 12 migraciones y Mani sigue de `gerente` allá.**~~ **RESUELTO el
  18-sep, con ok de Mani: 0012 aplicada en `production` (13 migraciones) y Mani es
  `developer` allá.** Ver la entrada de CIERRE DE SESIÓN arriba.

  **Loops:** 462 tests (eran 444), typecheck, lint y build limpios. Ningún test de disjunción
  gerente/closer cambió de resultado, que era el segundo criterio del "Done cuando".

  **Lo siguiente en F4 es el 025 (Nerd Stats)**, que ya está desbloqueado. `/nerd-stats` va a nacer
  con el developer cubierto sin escribir una línea para eso, porque la excepción vive en
  `puedeAcceder`.

  **Sigue pendiente de Mani, sin cambios:** cargar los 5 enlaces de PayPal, abrir `/mi-dia`,
  `/personas/[id]` y `/recursos` en un navegador, y decidir el 021. **El rol developer hace la
  segunda más fácil:** con una sola cuenta ya se ven las pantallas de los dos roles.

- **2026-09-17 (CIERRE DE SESIÓN) — Cuatro tickets (003, 006, 022, 023), dos refactors, ADR 0024.
  Estado del repo para no chocar en la próxima sesión.**

  **PARA QUIEN ABRA LA PRÓXIMA SESIÓN, leer esto primero:**

  - **El árbol está limpio y todo está en `origin/main`** (último commit `bc95e46`). No hay trabajo
    a medias en el working tree, no hay ramas sueltas, no hay subagentes corriendo. Se puede
    arrancar cualquier cosa sin heredar nada.
  - ~~**HAY UN `git stash` VIVO: `stash@{0}` "wip 024 rol developer".**~~ **RESUELTO el 17-sep
    en el cierre 5: rescatado y dropeado.** Se deja el texto por el razonamiento. Es avance de Kiro del 16-sep
    **sin revisar por nadie**, de un ticket que entonces no tocaba. Quien arranque el **024** tiene
    que decidir explícitamente si lo hace `pop` o lo descarta y empieza de cero. **No lo dejes ahí
    otra sesión más**: un stash sin dueño es la forma más fácil de perder trabajo o de re-hacerlo.
  - **La base está al día en las DOS ramas:** 12 migraciones en `dev`
    (`br-withered-sun-b439zjof`) y en `production` (`br-withered-mud-b4cvvg80`), verificado por
    `neon.branch_id`. Ninguna migración pendiente de aplicar.
  - **Archivos que se movieron mucho HOY** (si otra sesión corre en paralelo, que no los toque):
    `lib/queries/{personas,recursos,programas,saldo,ventas}.ts`, `lib/catalogo/{recursos,
    enlaces-pago,categorias-recurso,versionar,registro}.ts`, `lib/db/schema.ts`, `lib/nav.ts`,
    `app/(app)/{mi-dia,personas,recursos,documentos}/`, `components/{mi-dia-registro,
    historial-persona,recursos-pantalla,app-sidebar}.tsx`, y los tests de todos ellos.
  - **Sigue rigiendo el reparto por ARCHIVOS, no por el grafo de dependencias**, y las colisiones
    siguen siendo las mismas: migraciones (journal + snapshot + `schema.ts`),
    `docs/tasks/README.md`, este handoff y los commits.

  **Qué se cerró hoy:** **003** (`/mi-dia`), **006** (`/personas/[id]`), **022** (tablas de recursos
  y enlaces de pago + migración 0011) y **023** (pantalla `/recursos`). Con eso **F1, F2 y F3 quedan
  cerradas** salvo el **007**, que es operación y no código. Detalle de cada uno en las entradas de
  abajo.

  **Lo que NO es código y nadie más puede hacer (tres cosas de Mani):**
  1. **Cargar los 5 enlaces de PayPal.** `scripts/cargar-enlaces-pago.ts` los lee de
     `ENLACES_PAGO_JSON` (archivo fuera del repo). Ningún link real vive en git y así debe seguir.
  2. **Abrir en un navegador `/mi-dia`, `/personas/[id]` y `/recursos`.** Las tres salieron a
     producción y **ninguna ha sido vista por un humano**: exigen sesión de Google. `/mi-dia` es la
     que más urge, porque es la pantalla de captura que alimenta todas las métricas: si tiene un
     campo roto, ensucia la base antes de que el dashboard lo delate. Y el criterio de celular del
     023 está marcado `[~]`, no `[x]`, justo por esto.
  3. **Decidir el 021** (snapshot del dashboard), que sigue bloqueado esperando esa decisión.

  **Dos reglas nuevas que gobiernan de aquí en adelante:**
  - **ADR 0024 (con su enmienda del mismo día):** si dos lugares responden la MISMA pregunta, la
    respuesta vive en un módulo y los dos la importan. Nació del saldo (que estaba escrito dos
    veces: en la reja del sobrepago y en la pantalla) y se generalizó con los programas activos
    (que estaban escritos tres veces). **El matiz importa:** dos preguntas distintas que hoy dan el
    mismo SQL siguen siendo dos funciones — por eso `programasGestionablesPorUsuario` no se fusionó.
  - **`drizzle-kit generate` y `migrate` están permitidos en `.claude/settings.json`; `push` y
    `drop` están DENEGADOS a propósito.** `push` aplica el esquema sin dejar migración y se salta
    todo el historial.

  **Lección de proceso con subagentes, que costó tiempo hoy:** Kiro notificó "terminado" **antes**
  de estarlo y siguió editando archivos. Un `npm run lint` corrido en esa ventana reportó un
  warning que minutos después ya no existía, y casi se reporta como defecto un archivo a medio
  guardar. **Confirmar que el agente está `completed` (con `ListAgents`) antes de verificar nada.**
  Además dejó un proceso de polling vivo que siguió re-notificando con resultados vacíos; hubo que
  matarlo a mano. La verificación independiente de la sesión principal coincidió con su reporte
  cuando por fin llegó, así que el resultado es sólido — pero por poco.

- **2026-09-17 (cierre 3) — Ticket 023: la pantalla `/recursos`. F3 cerrada. Sin migracion.**

  **Siguiente sesión:** con esto F1, F2 y F3 quedan cerradas salvo el **007** (operación) y el
  **021** (bloqueado por decisión). Lo siguiente con código es **F4**: el **024** (rol developer),
  que tiene avance parcial **sin revisar** en `git stash` ("wip 024 rol developer"), y detrás el
  **025**. También sigue abierto el **016**, que puede esperar.

  **Código** (444 tests, typecheck, lint y build limpios). Lo implementó Kiro; la sesión principal
  revisó y corrió los cuatro loops:
  - `/recursos` con filtro por programa (incluye "Todos") y búsqueda por título, enlaces de pago
    agrupados por programa y producto, copiar/abrir e historial desplegable.
  - `/documentos` pasa a ser un `permanentRedirect` a `/recursos`; no había nada que conservar (era
    un `ProximaFase`). El ítem del sidebar se renombró a "Recursos" en `lib/nav.ts`, y con él la
    clave del icono en `components/app-sidebar.tsx`.
  - `lib/queries/recursos.ts` (solo SELECT) con los nombres de categoría y programa ya resueltos, y
    el historial por la cadena de `reemplazaA`.

  **Decisiones:**
  - **El filtro VA en la URL, al contrario que el buscador de `/mi-dia`.** No es incoherencia: allá
    lo que se teclea es el nombre o correo de un lead (dato personal, prohibido en query strings por
    `AGENTS.md`); el título de un brochure no lo es, así que aquí gana que el filtro sea compartible
    y recargable (ADR 0023). El programa viaja por **slug**, no por uuid.
  - **Leer lo pueden los dos roles; escribir solo el gerente.** No es como `/productos` (ADR 0016,
    específico de productos). Las seis acciones pasan por `requireRole("gerente")` y hay test de que
    un closer recibe `ok:false` en las seis: la barrera es de servidor, no un botón escondido.
  - Un recurso global (`programId` nulo) aparece con cualquier filtro de programa, con test.

  **Lo que NO se verificó, y es un criterio del ticket:** "en celular se usa sin scroll horizontal".
  El marcado se construyó mobile-first (sin tablas, sin anchos fijos, URLs con `break-all`) y se
  revisó por inspección, pero **nadie lo abrió en un teléfono**. Queda marcado `[~]` en el ticket,
  no `[x]`. Un test no ve un layout roto.

  **Nota de proceso:** Kiro notificó **tres veces**; las dos primeras sin reporte (avisos vacíos) y
  la tercera con el reporte completo, ya terminada la verificación de la sesión principal. Y siguió
  editando después de la primera notificación: un `npm run lint` corrido en ese momento reportó un
  warning (`plataformas` sin usar) que minutos después ya no existía, porque Kiro estaba cambiando
  ese formulario. **Una notificación no es señal de que el árbol esté quieto: hay que confirmar que
  el agente está `completed` antes de verificar**, o se verifica un estado que todavía se mueve. La
  verificación independiente de la sesión principal coincidió con el reporte cuando este llegó.

  **Deuda detectada Y arreglada en la misma sesión (Mani lo pidió al leer el reporte):**
  `lib/queries/programas.ts` tenía tres funciones que significaban "programas activos" y solo
  diferían en las columnas proyectadas. Quedaron en **una** `programasActivos` que devuelve id, slug
  y nombre; cada pantalla toma lo que necesita. El diff resta más de lo que suma (40 líneas fuera,
  24 dentro) y los 444 tests siguen verdes.
  - **`programasGestionablesPorUsuario` NO se fusionó**, aunque el SQL se parezca: no responde
    "cuáles están activos" sino "cuáles puede tocar esta persona" (membresía activa). Son dos
    preguntas distintas, y juntarlas por parecido sintáctico sería el error opuesto al que se estaba
    arreglando.
  - **El ADR 0024 se enmendó** con esto: la regla no era del dinero, era de las preguntas repetidas.
    Si dos lugares responden la misma pregunta, la respuesta vive en un módulo; la proyección es del
    llamador, el predicado es del módulo.

- **2026-09-17 (cierre 2) — Ticket 022: recursos y enlaces de pago. Migracion 0011 en `dev` Y en
  `production`.**

  **Siguiente sesión:** **023** (pantalla `/recursos`), que el 022 acaba de destrabar. Queda el
  **007** (operación) y el **021** bloqueado. Y dos cosas que solo puede hacer Mani: cargar los 5
  enlaces de PayPal, y abrir en el navegador `/mi-dia` y `/personas/[id]`.

  **Base de datos:** la **0011** está aplicada en las **dos** ramas, verificado por `neon.branch_id`
  y no por el nombre de la variable: `dev` (`br-withered-sun-b439zjof`) y `production`
  (`br-withered-mud-b4cvvg80`), las dos con 12 migraciones y las tres tablas nuevas. Se aplicó
  primero a `dev` y después a `production`, con el ok explícito de Mani. Es una migración
  puramente aditiva (tres `CREATE TABLE`): ningún código lee todavía esas tablas, así que
  aplicarla antes de que exista la pantalla no rompe nada.

  **Esquema (lo escribió la sesión principal; `drizzle-kit` no se delega):** `categorias_recurso`
  como catálogo del molde, `recursos` (link, no archivo) y `enlaces_pago` con monto y moneda al lado.
  - **Un recurso global tiene `program_id` NULL y Postgres considera dos NULL como DISTINTOS.** Un
    índice único ingenuo habría dejado pasar dos recursos globales vigentes con el mismo título, que
    es exactamente lo que el ticket prohíbe. `nullsNotDistinct` **no existe en drizzle 0.45**
    (verificado en `node_modules`), así que el índice va sobre
    `coalesce(program_id, <uuid de ceros>)`, y es PARCIAL para que el historial no ocupe cupo.
  - `vigente` (cuál es la versión de hoy) y `activo` (borrado suave del molde) son distintos y los
    dos hacen falta: una versión reemplazada queda `vigente = false` pero `activo = true`.

  **Código de Kiro** (420 tests, typecheck, lint y build limpios; revisado por la sesión principal):
  - `lib/catalogo/versionar.ts` con `reemplazarVersionado`, compartido por recursos y enlaces de
    pago **citando el ADR 0024**: las dos hacen lo mismo, así que lo hace un módulo y las dos lo
    importan. **El orden de las escrituras no es opcional:** primero el UPDATE que baja la vigente
    (libera el cupo del índice), después el INSERT de la nueva; al revés Postgres tira un `23505`
    que parece aleatorio.
  - `lib/catalogo/{categorias-recurso,recursos,enlaces-pago}.ts` sobre el molde, zod exigiendo
    `https://` (ADR 0017), y una línea en `lib/catalogo/registro.ts` para que las categorías salgan
    en `/ajustes/catalogos`.
  - Un duplicado sale como **409**, no 400: es lo que el molde ya hacía desde el ticket 011. El
    prompt de delegación decía 400; Kiro siguió el repo, que es lo correcto.

  **Los 5 enlaces de PayPal NO están cargados.** `scripts/cargar-enlaces-pago.ts` los lee de
  `ENLACES_PAGO_JSON` (archivo fuera del repo) y falla con mensaje explícito si falta. Ningún link
  real ni placeholder vive en el repo: son datos de pago y no van a git.

  **Permisos:** `.claude/settings.json` ahora **permite** `drizzle-kit generate` y `migrate`, y
  **deniega** `push` y `drop`. `push` aplica el esquema directo sin dejar archivo de migración: se
  salta el historial y la revisión, que es la disciplina que este repo enforza. La denegación es
  deliberada, no un olvido.

- **2026-09-17 (cierre) — ADR 0024: el saldo estaba escrito dos veces. Centralizado. Sin
  migracion.**

  **Siguiente sesión:** F1 y F2 cerradas salvo el **007** (operación, no código). Con código lo
  siguiente es **F3**: el **022** está listo, y detrás el **023**. El **021** sigue bloqueado.

  **Lo que lo destapó:** al cerrar el 006 se reportó que `historialDePersona` "compone
  `ventasDePersona` en vez de repetir el SQL del saldo". Mani respondió la regla general (no dejar
  que el saldo se desincronice; priorizar bajo acoplamiento y centralización). Al revisarlo con eso
  en mente salió que la composición del 006 evitó una **tercera** copia, pero **ya había dos**, con
  el SQL idéntico palabra por palabra: `saldoDeVenta` (la reja que bloquea un sobrepago) y
  `ventasDePersona` (lo que el closer ve en pantalla). Una pantalla y una reja discrepando sobre el
  mismo número no se descubre hasta que el dinero no cuadra.

  **Código** (392 tests, typecheck, lint y build limpios):
  - `lib/queries/saldo.ts` nuevo: `ABONADO`, `SALDO` y `estaPagadaCompleta`, la única definición.
    `lib/queries/ventas.ts` y `lib/queries/personas.ts` ahora la importan; ninguna consulta escribe
    `sum(abonos.monto)` a mano.
  - `tests/saldo-centralizado.test.ts`: lee la misma venta por los dos caminos y exige que
    coincidan, con abonos parciales, sin abonos, sin precio de contrato y con sobrepago. **Un
    comentario pidiendo no separarlos no falla nunca; este test sí.**
  - Refactor sin cambio observable: misma salida, mismas columnas, ninguna migración.

  **ADR 0024** lo deja escrito, y la regla subió a `AGENTS.md` (Restricciones no-negociables):
  si dos lugares tienen que dar la misma cifra, la cifra vive en un módulo y los dos la importan.
  Es el mismo error que el ADR 0023 ya había evitado por otro lado (descartar
  `dashboard-por-closer.ts` para no duplicar el anclaje de fecha en Bogotá); ahora tiene nombre.

  **Glosario:** entraron *Saldo pendiente*, *Sobrepago* e *Historial de una persona*.

  **Pendiente que dejó abierto:** nadie ha verificado `lib/queries/dashboard.ts` contra esta regla.
  Hoy no parece duplicado, pero es una revisión que no se hizo, no una garantía.

  **Dudas de Mani resueltas en esta sesión** (quedan acá porque volverán a aparecer):
  - *"¿Cómo así que no lista personas?"* — **Persona** = un lead deduplicado por correo, el ser
    humano. El dashboard muestra **cuentas** (agendas, cierres, caja, comparativo), no nombres: no
    hay ninguna fila con un nombre en la que se pueda hacer clic. Por eso el enlace al historial
    salió del buscador de `/mi-dia`. Darle una lista de personas al dashboard es trabajo real
    (¿qué personas?, ¿del rango?, ¿paginadas?) y merece su propio ticket si se quiere.
  - *"¿Las dos decisiones son para atacar 500 y 404?"* — Solo una. **Quién ve la página** es
    permisos (gerente y closer, ADR 0009), no errores. **El guard de uuid** sí es de errores: un
    correo en la URL contra una columna uuid revienta en Postgres y saldría como **500**, que
    insinúa que el id existe y esconde que el problema era la URL; el **404** dice la verdad.

- **2026-09-17 (noche) — Ticket 006: `/personas/[id]`, el historial de una persona. Sin
  migración.**

  **Siguiente sesión:** F1 y F2 quedan cerradas salvo el **007** (alta de los closers reales, es
  operación, no código). Lo siguiente con código es **F3**: **022** (recursos + enlaces de pago),
  que está listo, y detrás el **023**. El **021** sigue bloqueado esperando decisión. Y sigue
  pendiente la prueba manual de `/mi-dia` y de esta pantalla con login real.

  **Código** (385 tests, typecheck, lint y build limpios; hecho en la sesión principal con TDD,
  rojo-verde-refactor de a un comportamiento):
  - `historialDePersona` en `lib/queries/personas.ts`: persona + llamadas + ventas con sus abonos.
    **Compone `ventasDePersona` (del 003) en vez de repetir el SQL del saldo**: el dinero se resta
    en un solo lugar, porque dos definiciones de "saldo" se desincronizan sin que nadie lo note.
    Los abonos de todas las ventas salen en UNA consulta con `inArray`, así el número de consultas
    no depende de cuántas ventas tenga la persona.
  - `app/(app)/personas/[id]/page.tsx` y `components/historial-persona.tsx`: **solo lectura**, sin
    componente cliente ni server action, porque editar o borrar registros pasados está fuera del
    alcance. Los motivos, orígenes y plataformas salen resueltos a su nombre (nunca el uuid), y los
    montos con su moneda al lado.
  - Los timestamps se pasan por `diaDeCalendario` antes de formatear: es la única definición de
    "qué día es" del proyecto, y Vercel corre en UTC mientras el equipo está en Bogotá.

  **Tres decisiones, con su argumento:**
  - **El enlace sale del buscador de `/mi-dia`, no del dashboard.** El objetivo del ticket decía
    "desde el dashboard, entrar a una persona", pero **el dashboard no lista personas**: muestra
    agregados. La puerta que el ticket suponía no existía. Ponerla ahí exigía agregarle una lista
    de personas al dashboard, que es una feature nueva. El buscador del 003 es hoy el único lugar
    donde se listan personas.
  - **La ven gerente y closer**, igual que el dashboard desde el que se entra (ADR 0009). Ningún
    ADR pide restringirla más, así que no se inventó una restricción.
  - **Un id que no es uuid es 404 sin tocar la base.** `where id = 'lead@correo.co'` sobre una
    columna uuid revienta en Postgres y saldría como 500, que además insinuaría que el id existe.
    Hay test de que en ese caso la query ni se llama.

  **Base de datos:** sin cambios. Ninguna migración nueva.

  **Verificado / no verificado:** `npm test` (385), typecheck, lint y `npm run build`. **No** se
  abrió en el navegador: la página exige sesión de Google.

- **2026-09-17 (noche) — Ticket 003: `/mi-dia` deja de ser un `ProximaFase`. Sin migración,
  sin mutaciones nuevas.**

  **Siguiente sesión:** **006** (historial de una persona), que ya tenía su dependencia (005)
  cerrada. Sigue pendiente la prueba de login real, lo único que no se puede verificar desde acá.

  **Código** (371 tests, typecheck y lint limpios; un solo commit). Lo implementó Kiro con TDD; la
  sesión principal revisó contra el "Done cuando" y corrió los tres loops:
  - **La pantalla no escribe nada por su cuenta.** Todo lo que toca la base ya existía: 002
    (`registrarLlamada`), 019 (`registrarAbono`), 026 (`asignarResponsable`, `crearPersonaManual`).
    El ticket aportó lectura, UI y server actions. `lib/db/schema.ts` y `lib/mutations/*` quedaron
    intactos.
  - `lib/queries/personas.ts` (solo SELECT): `buscarPersonas` acotada a los programas donde el
    closer tiene membresía **activa** (mismo join que `programasGestionablesPorUsuario`), ILIKE
    sobre nombre y correo con los comodines escapados, mínimo 2 caracteres y tope de 20 filas;
    `ventasDePersona` con lo abonado y el saldo **calculados en SQL sobre `numeric`** y devueltos
    como texto, igual que `saldoDeVenta` (el dinero nunca pasa por un float de JS).
  - `app/(app)/mi-dia/acciones.ts`: seis acciones, **todas con `requireRole("closer")`**, incluida
    la de tomar persona. `asignarResponsable` acepta gerente, pero esta pantalla es del closer
    (ADR 0003) y la barrera se declara en la ruta. Resultado serializable, nunca se lanza al
    cliente (patrón de `productos/acciones.ts`).
  - `components/mi-dia-registro.tsx`: buscador, alta manual, formulario con los campos
    condicionales de la tabla del ADR 0015, y abonos sobre las ventas existentes. Reusa
    `ProductoCrearEnLinea` tal cual (se escribió en el 017 pensando en esta pantalla). Los montos
    salen por `monto(valor, moneda)` y las fechas por `fecha(iso)`: nada formateado a mano.

  **Dos decisiones que tomó la sesión principal antes de delegar, para que no se inventaran:**
  - **El texto del buscador NO va a la URL.** Un correo o un nombre en un query string viola
    "ningún dato personal en URLs" de `AGENTS.md`. La búsqueda es una server action con el texto
    en estado local. No contradice el ADR 0023 (el filtro del dashboard sí vive en la URL): allá
    lo que viaja es un `closerId` y un preset de rango, no el dato de un lead.
  - **Las fechas del formulario se anclan al MEDIODÍA de Bogotá** (`T12:00:00-05:00`), en la
    acción y no en la mutación (que pide `z.date()` y no se toca). Con `new Date('2026-09-20')`
    —medianoche UTC— el día se lee como 19 en Bogotá y un compromiso de pago quedaría registrado
    un día antes del prometido. Hay test que lo fija leyendo la fila en `America/Bogota`.

  **Base de datos:** sin cambios. Ninguna migración nueva, ninguna escritura en `production`.
  Las 11 migraciones siguen siendo las del 17-sep; "aplicar el 003 en producción" no tocó la base
  porque el ticket no trajo esquema.

  **Desplegado:** commit `47e2413` empujado a `main` el 17-sep en la noche, con `npm run build`
  limpio antes del push. `main` es la rama de producción en Vercel, así que el push dispara el
  deploy. **El resultado del deploy no se verificó desde la sesión** (el MCP de Vercel pide
  autorización y la sesión era no interactiva): queda por confirmar en el panel.

  **Verificado / no verificado:** `npm test` (371), typecheck, lint y `npm run build`, corridos por
  la sesión principal además de por Kiro. **No** se abrió en el navegador: la página exige sesión
  de Google. `/mi-dia` salió a producción sin que ningún humano la haya visto renderizada; es una
  pantalla de captura del closer, así que la primera pasada manual es la prueba que falta.

  **Dos costuras conocidas, ninguna introducida por este ticket:**
  - El botón de confirmar sobrepago se activa detectando la palabra "sobrepago" en el mensaje de
    error de `registrarAbono`. Si alguien reescribe ese mensaje, el flujo de confirmación
    desaparece sin que nada falle. Se hizo así porque la mutación devuelve un string y este ticket
    no podía tocarla; el día que moleste, la mutación necesita un código de error, no la UI otra
    regex.
  - `ventasDePersonaAccion` y `registrarAbonoAccion` reciben un id y no comprueban membresía en el
    programa. Es exactamente lo que ya hacen el dashboard (`/programas/[slug]` abre a cualquier
    closer, ADR 0009) y `registrarAbono` desde el 019: es la política vigente, no un hueco nuevo.
    Si alguna vez se decide acotar por membresía, se decide para los tres a la vez.

  **Fuera del 003 a propósito:** seleccionar automáticamente el producto recién creado en línea.
  `crearProductoAccion` no devuelve el id del producto nuevo y cambiarla estaba fuera de alcance;
  hoy se refresca la lista y el closer lo elige.

- **2026-09-17 (tarde) — Ticket 005: el dashboard real en pantalla, con metricas individuales por
  closer. ADR 0023. Sin migracion.**

  **Siguiente sesion:** **003** (`/mi-dia`), que ya tiene todo lo que necesitaba (002, 019, 015,
  026). Despues **006** (historial de persona), que dependia del 005. Y sigue pendiente la prueba
  de login real, que es lo unico que no se puede verificar desde aca.

  **Codigo** (350 tests, typecheck, lint y `npm run build` limpios; un solo commit):
  - **005** `/programas/[slug]` deja de ser un `ProximaFase`: tarjetas (caja por moneda, ventas,
    llamadas y % show, % cierre, leads contra meta, compromisos), cohorte con su dia habil y su
    meta dinamica, comparativo entre closers, motivos y origenes. `components/dashboard-programa.tsx`
    no calcula ni consulta nada, y `components/filtro-dashboard.tsx` solo escribe en la URL.
  - **Decision de Mani que cambio el diseno a mitad de camino (ADR 0023):** el filtro por closer
    NO se queda en el comparativo. Baja hasta `lib/queries/dashboard.ts`, que pasa de
    `(programId, rango, db)` a `Alcance = { programId, rango, closerId? }`. Con eso quedan
    individuales tambien los leads (por `people.responsableCloserId`), los compromisos, los
    motivos, los origenes y la contribucion a la cohorte. Se descarto el modulo aparte
    (`dashboard-por-closer.ts`) para no tener dos implementaciones del anclaje de fecha en Bogota
    y del agrupado por moneda.
  - **Lo que NO se invento:** no hay meta individual. `vistaDeCohorteActiva` suma
    `vendidosDelCloser` como contribucion y deja la meta, la meta dinamica y el cumplimiento
    medidos contra la cohorte completa (ADR 0022). Y como "sin responsable" es valido (ADR 0021),
    la suma de leads de los closers no da el total del programa: la pantalla lo dice.
  - **El comparativo no se puede filtrar y lo impide el compilador:** el alcance de
    `embudoPorCloser` es `Omit<Alcance, "closerId">`. Es la garantia de "todos ven todo" (ADR
    0009) escrita en el tipo, no en un comentario.
  - `lib/rangos.ts` (puro, 11 tests): hoy, semana (lunes a hoy), mes (dia 1 a hoy), cohorte (su
    ventana de venta hasta hoy, sin pasarse del cierre) y personalizado. Un preset imposible cae a
    "hoy" **y el selector muestra "hoy"**: nunca dice que estas viendo algo distinto de lo que ves.
  - `lib/format.ts`: `monto(valor, moneda)` (la moneda siempre al lado, la caja una linea por
    moneda) y `fecha(iso)` → "14 ago 2026" (se parte el string, no se construye un `Date`, porque
    la fecha es un dia de calendario y no un instante). `Intl` en es-CO daba "14 de ago de 2026" y
    "sept", que no es como escribe el negocio.
  - `lib/dias-habiles.ts`: el helper privado `isoBogota` se exporto como `diaDeCalendario`. Es la
    unica definicion de "que dia es hoy" del proyecto; la pagina la usa sobre `new Date()` para no
    depender de la zona del servidor (Vercel corre en UTC).
  - **El filtro vive en la URL, nunca en la sesion.** `armarVistaDelDashboard` no recibe rol ni
    sesion, y `tests/paginas.test.ts` corre la pagina como gerente y como closer y compara con que
    argumentos pide la vista. Si alguien mete una diferencia por rol, ese test falla.

  **Base de datos:** sin cambios. Ninguna migracion nueva, ninguna escritura en `production`.

  **Verificado / no verificado:** tests, typecheck, lint y build, mas un render del componente a
  HTML con datos de forma real (dos monedas, tasas nulas, cohorte con ventana, fila "sin closer").
  **No** se abrio en el navegador: la pagina exige sesion de Google y eso lo tiene que probar Mani.

  **Fuera del 005 a proposito:** la pauta (ninguna consulta del 004 la lee, aunque el texto viejo
  del `ProximaFase` la prometia) y las graficas.

- **2026-09-17 — Seis tickets cerrados (018, 027, 002, 026, 004 + esquema del 026), ADR 0022,
  migraciones 0008-0010 en las dos ramas, y la primera tanda de sesiones en paralelo.**

  **Siguiente sesion:** **019** (registrar abono, ya destrabado por el 002) y **005** (dashboard
  en pantalla, destrabado por el 004). Despues **003** (`/mi-dia`), que necesita 002, 019 y 026.
  Prompts listos en el historial de la sesion del 17-sep.

  **Codigo** (306 tests, typecheck y lint limpios; un commit por ticket):
  - **018** esquema del registro y abonos: `resultado_llamada` a 8 valores, `calls` con
    `fechaSeguimiento`/`motivoId`/`origenId`, `sales` con `productoId`, tabla `abonos` con
    `onDelete: restrict`, y `lib/abonos/esquema.ts` (solo USD). **Decision de Mani:
    `sales.esPagoCompleto` se elimina**, no queda como cache: todo derivado se calcula (enmienda
    en el ADR 0013). La 0008 copia cada `montoAbonado` viejo a un abono; habia 0 ventas.
  - **027** ventana de venta por cohorte (**ADR 0022**, sale de `/grill-with-docs`). Los reportes
    diarios desmienten las dos reglas que el glosario daba por buenas: el inicio no se deduce del
    cierre de la cohorte anterior (Comunicarte C2 arranca 14-ago, no 12-ago) y el cierre no se
    deduce del inicio de clases (un programa cierra el mismo dia, el otro la vispera). Ahora
    `cohorts.fechaInicioVentas` es dato editable y un `CHECK` impide una cohorte activa sin el; el
    cierre de Comunicarte C2 se corrigio a 21-sep. Verificado: 27 habiles y el 15-sep es el dia 23.
  - **002** `cohorteActiva` y `registrarLlamada` (`lib/mutations/registro.ts`): inserta la llamada
    con `origen="app"` y el `closerId` de la sesion; si el resultado es `cerrada`, la venta y su
    primer abono van en el mismo lote atomico. Rechaza producto de otro programa, producto
    desactivado y plataforma desactivada.
  - **026** `asignarResponsable` y `crearPersonaManual` (`lib/mutations/personas.ts`): una sola
    regla de asignacion (el closer destino vende en ese programa y esta activo) que de paso impide
    que un closer ajeno se lleve personas. El sync no incluye `responsableCloserId` en su
    registro, asi que no lo pisa, y una persona `crm` que reaparece en el formulario pasa a
    `formulario` con rastro en la bitacora. Un closer sin `closerId` recibe 400, no un 403 enganoso.
  - **004** `lib/queries/dashboard.ts`: caja por fecha del abono y agrupada por moneda (nunca
    mezcla dos), tasas `null` en vez de `NaN` con 0 agendas, anclaje de fechas en Bogota
    (02:00Z del 16 es el 15), leads solo de entrada `formulario`, y una cohorte sin inicio de
    ventas devuelve `null` en vez de inventar ventana.
  - `vitest.config.mts`: `testTimeout` y `hookTimeout` a 20s. Los tests con PGlite aplican todas
    las migraciones; con varias sesiones compitiendo por la maquina el suite se caia en cascada
    por el reloj, no por el codigo. **Un fallo de timeout aca no es una regresion: re-corre el
    archivo solo antes de investigar.**

  **Base de datos:** `dev` y `production` con 11 migraciones (0008, 0009 y 0010). `production`
  tiene **4.497 personas** reales; `dev` tiene 0, asi que una prueba manual contra `dev` necesita
  sembrar datos primero.

  **Proceso, tres cosas que costaron tiempo y no se repiten:**
  - **Las migraciones las genera y aplica la sesion principal, nunca un subagente** (regla ya en
    `AGENTS.md`). `drizzle-kit generate` es interactivo: pregunta si una columna es un renombre
    cuando una se va y otra llega, y dejo a Kiro colgado 12 minutos sin poder contestar. Desde la
    sesion principal se responde con `expect`.
  - **Un `CHECK` nuevo se crea DESPUES de arreglar los datos**, en la misma migracion. El de la
    0009 habria fallado con las dos cohortes activas que estaban sin inicio de ventas.
  - **El reparto en paralelo se hace por ARCHIVOS, no por el grafo de dependencias.** El 17-sep
    corrieron tres sesiones (002, 004, 026; una en otra cuenta) sin un solo choque. Los puntos de
    colision son las migraciones (journal + snapshot + `schema.ts`), `docs/tasks/README.md`,
    `docs/agents/handoff.md` y los commits. Reglas: nadie corre `drizzle-kit`, nadie edita el
    tracker ni el handoff, cada sesion commitea nombrando sus archivos (nunca `git add -A`), y el
    coordinador revisa contra el "Done cuando", marca y migra. **No van en paralelo dos tickets
    que escriben la misma logica** (019 y 002 comparten el insert del abono) ni dos que necesiten
    migracion (016 y 022).

- **2026-09-16 (cierre) — ADR 0021, tickets 012, 013, 015, 014, 017 y 020, migraciones
  0004-0007 en las dos ramas, incidente de `.env.local` resuelto.**

  **Siguiente sesion:** seguir **Now** en orden, por partes. El 024 (rol developer) **no** va
  ahora: es de F4 y espera su turno (su avance parcial esta en un stash, ver abajo).

  **Codigo** (Kiro con TDD, cada ticket revisado contra su "Done cuando", un commit por ticket;
  235 tests, typecheck y lint limpios):
  - `/grill-with-docs` sobre el responsable del lead: **ADR 0021** (responsable y alta manual
    viven en el CRM; las hojas no tienen columna de closer). Ticket nuevo **026** (depende de 015,
    bloquea 003). Glosario: Responsable, Alta manual.
  - **012** catalogos `motivos` y `origenes` (migracion 0004).
  - **013** `/ajustes/catalogos` sobre `lib/catalogo/registro.ts` (un catalogo nuevo = una
    linea); el molde gano `reactivar`; un id no-uuid da 400.
  - **015** `/ajustes/usuarios`, `users.calendlyEmail`, `miembros_programa` (migracion 0005).
    Un solo esquema para la pantalla y el CLI. Deuda y respuestas a Mani en el ticket: el CLI
    ahora pide uuid de programa para un closer; "usuario" es la cuenta que entra (closer o
    gerente, no un lead) y su fila y sus programas se guardan en dos lotes (no atomico).
  - **014** `/ajustes/programas` y `/ajustes/programas/[slug]`; indice unico parcial "una
    cohorte activa por programa" (migracion 0006). Cerrar una cohorte es su "desactivar".
  - **017** `/productos` para gerente y closer (el closer solo en sus programas), tabla
    `productos` (migracion 0007). Semillas en `seed-datos.ts`, solo insertan lo que falta.
  - **020** `lib/dias-habiles.ts`: dias habiles en Bogota, meta dinamica y lineal.

  **Base de datos (verificado con `neon.branch_id`):**
  - **Incidente:** `DATABASE_URL` de `.env.local` era la misma URL que `DB_PROD`, asi que todo lo
    local escribia en `production`. Mani lo arreglo: hoy `DATABASE_URL` = `dev`
    (`br-withered-sun-b439zjof`) y `DB_PROD` = `production` (`br-withered-mud-b4cvvg80`).
    Detalle en el ADR 0018; regla nueva en `AGENTS.md`: comprobar la rama antes de escribir.
  - 0004-0007 aplicadas a `production` (por decision de Mani, antes de arreglar `dev`) y luego a
    `dev`. Las dos ramas: 8 migraciones, 7 plataformas, 8 motivos, 7 origenes.
  - `dev` sembrada (2 programas, 4 cohortes, 3 productos, 10 fuentes). `production` **sin
    productos**. En las dos, el unico usuario es Mani como `gerente`;
    `administrativa@retiagrowth.com` no esta cargado.

  **Hallazgo:** la ventana de venta de Comunicarte C2 del reporte (14-ago a 21-sep) no coincide
  con la semilla (inicio implicito 12-ago, cierre 22-sep). Decision pendiente en el tracker;
  bloquea 004.

  **Pausado:** Mani pidio ser `developer`, pero ese rol es el ticket 024 (F4). Kiro alcanzo a
  empezarlo y se detuvo; su avance **sin revisar** esta en `git stash` ("wip 024 rol developer").
  No se aplico nada en ninguna base. Retomarlo cuando le toque (notas en el ticket).

- **2026-09-16 (noche) — F0 arranca: tickets 008-011 hechos, migraciones en las dos ramas, Google
  Cloud y login pasados a Retia, respuestas de Michael bajadas.**

  **Codigo** (Kiro implementa con TDD en segundo plano; cada ticket se reviso contra su "Done
  cuando" y va en su propio commit; 94 tests, typecheck y lint limpios):
  - **008** Corte → Cohorte. Migracion `drizzle/0002_*` escrita a mano, solo `RENAME`.
  - **009** `tests/contrato-extension.test.ts`: falla si un programa aparece escrito en `lib/`,
    `app/` o `components/` (contenido **y** rutas).
  - **010** Programas desde la base: `app/(app)/programas/[slug]`, `lib/queries/programas.ts`,
    `lib/nav.ts` puro, `destinoInicial()` en `lib/auth/page-guards.ts`; las rutas viejas
    redirigen desde `next.config.ts`. La descripcion del dashboard ya no trae la fecha de C2;
    vuelve con `cohorteActiva()` (002).
  - **011** Molde `lib/catalogo/molde.ts` (listar/crear/editar/desactivar, `change_log` con
    `userId`, nunca `DELETE`) estrenado con `lib/catalogo/plataformas.ts`. Migracion `0003_*`
    con 7 plataformas. La base entra por parametro; `lib/db/ejecutar-juntas.ts` usa `batch`
    (neon-http) o `transaction` (PGlite). Deuda: un id que no es uuid da 500 (validar en 013).
  - **ADR 0020 (Mani):** tests de base con PGlite en memoria; `tests/helpers/base-de-prueba.ts`
    aplica todas las migraciones.
  - **Bug evitado:** el `when` de 0002 en el journal era mayor que el de 0003 y el migrador se
    habria saltado 0003. Corregido; `tests/migraciones.test.ts` lo vigila.
  - `npm run cuenta-servicio -- <ruta>` acepta la ruta de la llave.

  **Infraestructura (verificado):**
  - Migraciones 0002 y 0003 aplicadas en `dev` (`npm run db:migrate`) y en `production` (SQL
    Editor de Neon, una transaccion, con las filas de `drizzle.__drizzle_migrations` y los mismos
    hash que `dev`). Ambas: 4 migraciones, 7 plataformas.
  - `DATABASE_URL` de Vercel Production recargada por Mani con la rama `production`.
  - Google Cloud: todo lo de la app vive en el proyecto **`retia-growth`**. Cuenta de servicio
    `retia-metrics-sync@retia-growth.iam.gserviceaccount.com` en `.env.local` y Vercel
    Production; las dos hojas compartidas y `npm run descubrir` las ve. El **login** se movio a
    un cliente OAuth web de `retia-growth` (antes vivia en el proyecto personal
    `google-workspace-mcp`); Google acepta las URIs de produccion y `localhost:3000`, y
    `.env.local` y el deploy de produccion usan el mismo cliente. `AUTH_URL` en Production.
  - Produccion desplegada y sana (`/api/health` 200, redirecciones 308 ok).
  - **`production` sembrada** (`seed:datos`): 2 programas, 4 cohortes, 10 fuentes (3 activas).
    Estaba vacia.
  - **Enmienda al ADR 0018 (Mani):** la URL de `production` vive en `.env.local` como
    `DB_PROD`. Ningun codigo la lee; lectura libre, escritura solo con ok de Mani.

  **Decisiones de negocio** (detalle en `docs/insumos/mensaje-michael-2026-09-16.md` y el
  tracker): closers activos Andrea y Maru; los usuarios reales (closers y managers) se cargan
  desde la UI del 015 al salir a produccion; abonos siempre en USD y el closer convierte al
  registrar; snapshot de ultimo, parecido al reporte diario actual; `Estado` es la clasificacion
  del lead (valores contados y mapeo propuesto en F-01). **Alcance nuevo:** todo lead tiene un
  closer responsable que se asigna en el CRM, y eso choca con ADR 0004.

  **Hallazgos:** la hoja de Tactical tiene pestanas que `docs/estructura-bbdd.md` no documenta
  (`🚨 Urgencias`, `_urg_data`, `Leads interesados en prox. Cohort`, `Lead Magnet Ruta`,
  `BK_*_20260905_1650`). `New form` devuelve justo 2.000 filas (eran 1.320 el 19-ago): revisar
  si son filas vacias con formula.

  **Siguiente sesion, en orden:** ver **Now** abajo.
  Skills sugeridas: `/grill-with-docs` (responsable del lead vs ADR 0004), `/tdd` por ticket
  delegando a Kiro.

- **2026-09-16 (tarde) — Sesion de riesgos: S-14, CRON_SECRET, B-01, decisiones de negocio.**

  **Siguiente sesion, en orden** (_todo resuelto en la sesion de la noche salvo F-03 + F-07_):
  1. Cargar `GOOGLE_SERVICE_ACCOUNT_JSON_B64` (`npm run cuenta-servicio`, necesita el JSON de
     Google Cloud) en `.env.local` y en Vercel Production.
  2. S-10: `AUTH_URL=https://retia-metrics-seven.vercel.app` en Production + callback en Google OAuth.
  3. Redeploy de produccion y probar `/api/cron/sync` (hoy responde 500: falta `CRON_SECRET` en el
     deploy activo, falla cerrado, esperado).
  4. Confirmar que la `DATABASE_URL` de Production es la rama `production` (ADR 0018).
  5. F-03 + F-07 juntos, con migracion en `dev` (diseno en el tracker).
  6. Tickets 008 y 009. Cuando Michael responda, bajar sus respuestas al tracker y los tickets.

  **Hecho:**
  - **S-14 (ADR 0018):** la base de `.env.local` es el proyecto Neon `retia-metrics-crm` (org
    Retia-Agencia, creado el 15-sep), del fork y casi vacio (0 personas, 1 usuario). Rama `dev`
    creada; `.env.local` y Vercel Preview la usan; Production conserva su `DATABASE_URL`.
    `neonctl` quedo autenticado en esta maquina (`npx neonctl ...`).
  - **Vercel:** proyecto `agencia-dani/retia-metrics` (cuenta de Daniel, dominio
    `retia-metrics-seven.vercel.app`). La CLI de esta maquina quedo logueada como
    `danieltovartech-4302`; para volver a `manigreeen`: `vercel logout` + `vercel login`. Repo
    enlazado con `.vercel/repo.json`.
  - **CRON_SECRET:** `npm run rotar` no lo genera (se corrigio esa instruccion). Nuevo
    `npm run cron-secret` (sin eco, con respaldo, `-- --vercel` sube por la API). Esta en
    `.env.local` y en Vercel Production; aplica con el proximo deploy.
  - **B-01:** la decision del sync vive en `lib/sheets/plan-sync.ts` (`planificarSync`, pura) y
    `sync.ts` solo escribe. 6 tests verificados con mutaciones; 77 en total.
  - **F-03 no se hizo:** con `neon-http` no hay advisory locks de sesion; necesita indice unico
    parcial (migracion).
  - **Decisiones:** sync de leads con Sheets **si** (Michael); "todos ven todo" **si** e importar
    el historico de C2 **si** (Mani). Idea de Mani convertida en ADR 0019: plantilla de lead por
    programa, heredada y ajustable por fuente, campos fijos en codigo y extras a `raw`; se
    construye en el ticket 016. Las hojas **no** se estandarizan.
  - **Mensaje a Michael** (`docs/insumos/mensaje-michael-2026-09-16.md`): **enviado por Mani el
    16-sep**, esperando respuesta sobre closers y correos, moneda de abonos, leads fuera del
    formulario, formato del snapshot y valores de `Estado`.
  - Tarea de Notion del CRM actualizada con el estado. El respaldo `.env.local.bak-*` se borro.
  - Los push a `origin/main` los hace Mani a mano; `main` despliega a produccion en Vercel.

- **2026-09-16 — Overview del CRM, contrato de extension y re-plan completo en 5 fases.**
  Se reviso el repo entero, los grupos de WhatsApp "Ventas ComunicArte" y "Ventas JP Vieira", y
  los 5 reportes diarios de Mike (1 al 15 de sep, en Downloads). Hallazgos que cambiaron el
  modelo: una venta puede tener varios pagos (Maryce pago USD 750 el 15-sep sobre un cupo del
  31-ago); las plataformas de pago crecen (Zelle, DollarApp, Addi); los links de pago y los
  brochures se pierden en el chat; Juanito tiene closers de Calendly escritos en su codigo;
  Andrea vende en los dos programas; el reporte gira sobre origen del cierre, motivos,
  compromisos de pago con fecha y meta dinamica; hay mas de un producto por programa.

  **Decisiones de Mani (16-sep), ya bajadas a ADR:** 0012 contrato de extension (instancias en
  base, tipos en codigo; reemplaza el ticket 001), 0013 abonos separados de ventas, 0014 "Corte"
  pasa a "Cohorte" en todo, 0015 resultado ampliado (`compromiso_pago`, `cancelada`) y motivos
  como catalogo, 0016 productos por programa que crean gerentes **y** closers, 0017 recursos y
  comprobantes solo como links (descarta Vercel Blob de `docs/design.md`).

  **Documentos reescritos:** `docs/spec.md` (4 pilares + contrato, 6 criterios), `docs/plan.md`
  (fases F0-F4, modelo de datos, grafo de tickets), `docs/agents/context.md` (Cohorte, Abono,
  Producto, Recurso, Catalogo, Instancia/Tipo...), `AGENTS.md` (restriccion y contrato nuevos).
  Tickets 001-007 actualizados y 008-025 creados. **Tracker unico: `docs/tasks/README.md`.**
  Orden acordado: F0 contrato → F1 llamadas y ventas → F2 metricas → F3 recursos → F4 Nerd Stats.

  **Pendientes de negocio para Michael** (en el tracker): lista y correos de closers activos,
  moneda de los abonos por Bancolombia/MercadoPago, lead que no esta en el sync, formato del
  snapshot, confirmacion de "todos ven todo", que importar del historico C2.
  **Propuestas de Notion sin aplicar** (Mani no las aprobo aun): enlazar el tracker en la tarea
  del CRM y cerrar "Pedirle a Michael el .env.local" (el archivo ya existe).

  **No se toco codigo en esta sesion.** Siguiente paso: tickets 008 y 009 (listos). Ojo con S-14
  antes de aplicar cualquier migracion. Tarea de Notion asociada: "Definir arquitectura y
  construir dashboard CRM para closers de Retia".

- **2026-09-15 — Sesion de diseno: se creo `docs/design.md`** (vista de diseno del CRM que faltaba:
  actores, servicios por rol, propuesta de valor, layout de 3 capas, C4, secuencia por actor). Es un
  BORRADOR vivo, voz de Mani como principal, con etiquetas 🎯 MVP / 🔮 futuro / ⚔️ choca-con-ADR.
  Partio del raw de ideas de Mani (recuperado tras un incidente: el agente sobrescribio el archivo
  con `create` sin releer — leccion guardada, no repetir).

  **Decisiones de negocio nuevas tomadas por Mani en esta sesion (aun NO bajadas a spec/ADR/tickets):**
  1. **PDF -> snapshot.** El dashboard es el reporte en vivo; se permite un snapshot descargable a
     demanda (refleja, no re-calcula). YA aplicado en `docs/spec.md` §2. Reemplaza la restriccion
     anterior de "ningun reporte exportable". Formato (PDF/PNG/CSV) y quien lo toma: sin decidir.
  2. **Tercer rol: Developer.** All-around user (ve todo, cambia de vista, salud de la herramienta,
     settings dev). El ROL entra al MVP; las CAPACIDADES son post-scaffold. Requiere ampliar
     `rolEnum` (hoy `["gerente","closer"]`) + guards + tests + nav -> **actualiza ADR 0003
     conscientemente** (no re-litigar en silencio). Sin ticket aun.
  3. **Cuentas (cierra el bloqueante que tenia el registro por closer):** cada CLOSER entra con su
     propia cuenta Google (asi `closerId` se copia limpio de la sesion, ADR 0011 funciona); los
     MANAGERS comparten `administrativa@retiagrowth.com`; los DEVELOPERS usan cualquier cuenta.
  4. **Comprobante como archivo:** ademas de los datos de venta, ofrecer subir el comprobante como
     archivo. Recomendacion: Vercel Blob (`sales.comprobanteUrl` + endpoint upload) si el deadline
     lo permite; si aprieta, cae a post-lanzamiento. No bloquea el registro de la venta. Sin ticket.
  5. **Ambicion:** el CRM REEMPLAZA la operacion (estandarizar + automatizar + persistir), no es
     solo un dashboard de lectura.
  6. **Futuro (🔮) validado, fuera de MVP:** intake automatico por DTO+crontab desde Typeform/
     Calendly/Kapso; mapeo enriquecido de leads (perfil, notas, estado frio/caliente); calendar
     view en la pestana Calls del gerente; cambio de vista del developer.

  **Insumos guardados en el repo esta sesion:**
  - `docs/insumos/fleeting/2026-09-14-reunion-jefes-retia.md` — notas crudas de la reunion.
  - `docs/insumos/historico-c2/comunicarte-c2-consolidado.md` y `…/tactical-investor-c2-consolidado.md`
    — los dos MD historicos de Michael (backlog hasta que se inyecten; NO son insumo limpio 1:1,
    ver `docs/spec.md` §7).

  **Lo que este diseno DESTAPO y falta hacer (deuda de reconciliacion):** el diseno introduce un
  rol y 3 features que el spec/plan/tickets actuales NO cubren. Antes de codear hay que reconciliar:
  _(Nota del 16-sep: estos numeros se reasignaron. Snapshot = ticket 021; comprobante como
  archivo = descartado por ADR 0017, queda como link; rol Developer = ticket 024.)_
  - **Ticket 008** (falta escribir): snapshot descargable. Decidir formato y permiso primero.
  - **Ticket 009** (falta escribir): comprobante como archivo (Vercel Blob).
  - **Ticket 010** (falta escribir): rol Developer (enum + guards + tests + nav) + actualizar ADR 0003.
  - **`docs/spec.md`**: sumar Developer, snapshot (ya), comprobante; mover a §2/§7 lo que sea futuro.
  - **Pendiente de negocio:** Maico va a mandar ejemplos de reportes reales para alimentar la
    pestana de metricas del gerente. Sin recibir.

  **Decisiones abiertas** (ver `docs/design.md` §8): formato del snapshot; quien lo toma; comprobante
  en MVP o post; + los supuestos que ya venian en `docs/spec.md` §7 (todos-ven-todo sin confirmar por
  Michael, import historico con discrepancias, lead que no esta en el sync, marco regulatorio de
  datos financieros, Calendly individual vs compartido).

- **2026-09-14/15 — Se definio que se construye: el repo se convierte en el Retia CRM.** Reunion
  de Tech Retia del 14 sep (Michael Castellanos, Alejandro Carvajal, Alejandro Davila, via Granola)
  detono el cambio: los closers dejan WhatsApp y el calendario compartido, y registran llamadas y
  ventas directo en la app. `docs/spec.md` (primer spec del repo) documenta el alcance: registro de
  llamada+venta en una pantalla, dashboard en vivo sin PDF, "todos ven todo" (comparativo, caja y
  pauta visibles para cualquier closer, no solo gerente).

  `/grill-with-docs` encontro y resolvio dos contradicciones reales entre el codigo y lo que se
  estaba especificando: `calls`/`sales` ya existian pero disenadas solo para filas de Sheets
  (`huellaFila`, `closerId` de texto), y `resultadoLlamadaEnum` ya era un unico estado cuando el
  spec pedia dos casillas (show/cierre) por separado. Se resolvio a favor del codigo existente.
  Cuatro ADR nuevos documentan las decisiones: **0008** (Sheets deja de ser fuente de
  llamadas/ventas, sigue siendolo para leads), **0009** (el dashboard abre a closer lo que ADR 0003
  prohibia — cambio ya aplicado en codigo: `AGENTS.md`, `lib/nav.ts`, ambas paginas de programa y
  sus tests), **0010** (se reusan `calls`/`sales` con `origen="app"`, no tablas nuevas), **0011**
  (`closerId` en escrituras nativas se copia de `session.user.closerId`, no un FK nuevo). El
  glosario (`docs/agents/context.md`) ya refleja el nuevo lenguaje.

  `/plan` produjo `docs/plan.md` (arquitectura, diagrama de flujo, modelo de datos) y 7 tickets en
  `docs/tasks/` (001 a 007), del campo de plataforma de pago que falta hasta el onboarding de
  `closerId` para Andrea/Maru/Jero. Deadline de negocio: antes de que cierren los C2 actuales
  (Comunicarte 22 sep, Tactical 29 sep de 2026).

  **Supuestos sin validar con el negocio** (ver `docs/spec.md` §7): "todos ven todo" no lo confirmo
  Michael ni Alejandro Carvajal directamente; el import historico (dos MD consolidados que Michael
  ya paso, en Downloads al momento de escribir esto) tiene discrepancias documentadas entre si y
  necesita una decision de reconciliacion antes de migrarse; Calendly individual vs cuenta
  compartida, sin confirmar.

- **2026-09-14 — Repo scaffolded.** Se borro la documentacion heredada (los siete prompts de
  fase del master prompt original, el informe de revision externa y su plan de remediacion,
  2.670 lineas entre los dos, y `DEPENDENCIES.md`) y el conocimiento que valia se destilo a esta
  estructura: glosario en `context.md`, constitucion y convenciones en `AGENTS.md`, decisiones en
  `docs/adr/`, deuda en el roadmap de abajo. Todo lo borrado vive en el commit `269aa6c`.
  **El plan de construccion anterior se descarto a proposito**: era el metodo de otra persona.
  Lo que viene se define con `/spec`.

- **Lo que existe y funciona hoy** (verificado: `npm test` 68 verdes, `npm run typecheck` limpio):
  - `lib/auth/` — Auth.js v5 con Google OAuth, allowlist estricta contra la tabla `users`, rol
    revalidado contra la base en cada emision de token, guards para APIs y para paginas.
  - `lib/db/schema.ts` — 10 tablas: `users`, `programs`, `cohorts`, `sources`, `people`, `calls`,
    `sales`, `ad_spend`, `sync_runs`, `change_log`.
  - `lib/sheets/` — el motor de sincronizacion: lee una pestana, resuelve columnas por texto del
    encabezado, deduplica por correo, inserta por lotes y escribe la bitacora de cambios.
  - `proxy.ts` — protege todo salvo `/login`, `/api/auth/*` y `/api/health`.
  - `POST /api/sync/[programa]` (gerente) y `GET /api/cron/sync` (con `CRON_SECRET`, falla cerrado).
  - `/ajustes/fuentes` — la unica pantalla con contenido real. Las otras cinco son placeholders.
  - 13 scripts de CLI: setup de `.env.local`, rotacion de secretos, diagnostico de hojas, seeds,
    sync manual y gestion de usuarios. Ninguno de los de diagnostico imprime datos personales.

- **Verificado contra datos reales** (2026-08-19): Comunicarte 1.320 filas -> 1.253 personas
  (5,1% duplicados); Tactical Investor 2.965 -> 1.839 (38,0%). El motor reproduce el ratio
  documentado. La segunda corrida deja `change_log` intacto. Carga en frio de 1.253 personas en
  4,0 segundos.

- **Incidente de seguridad, 2026-08-18.** Una captura de pantalla de `.env.local` abierto en
  TextEdit expuso la contrasena de Neon, el secreto de OAuth y el `AUTH_SECRET`. Se rotaron el
  mismo dia, y otra vez el 6 de septiembre junto con seis secretos mas. De ahi salen
  `npm run setup` y `npm run rotar`, que leen los secretos sin eco: **nunca se abre `.env.local`
  en un editor**.

- **Este repo es un fork independiente.** El deployment original (`retia-metrics.vercel.app`,
  bajo Michael) no se hereda. Desde el 14-sep el fork se despliega en `agencia-dani/retia-metrics`
  (`retia-metrics-seven.vercel.app`) con su propia base Neon (ADR 0018).

## Roadmap

> **27-sep: esta sección ya no guarda contenido propio.** Lo que sigue y en qué orden:
> [`docs/plan.md`](../plan.md) §5 (orden por pasos) y §7 (decisiones abiertas). El estado de cada
> ticket: [`docs/tasks/README.md`](../tasks/README.md). Lo que vivía aquí (detalles del entorno, datos
> de validación de C1, deuda heredada, pendientes de seguridad) está en
> [`docs/operations.md`](../operations.md). El texto anterior: `git show da68cdf:docs/agents/handoff.md`.

### Now

- 🎯 **2-oct, EL MÉTODO COMERCIAL: el ciclo de vida de 30X es como se maneja Retia** (Mani). Transcrito en
  `docs/insumos/30x-ciclo-de-vida.md`; manual aprobado (`docs/manual-gestion-comercial.md`, su §0 es el punto de
  entrada) y dudas D-1 a D-9 y QM-12 en el ADR 0071. **El 142 está desbloqueado y al frente de la cola de
  migraciones (142 → 092 → 102).** Para retomarlo: primero M-1 a M-6 (manual §0, decisiones cortas que cambian el
  diseño del 142), después el 142 a Codex con `/delegate` (la migración la genera y aplica la sesión principal),
  y el orden hasta el corte está en el manual §0.
- ✅ **2-oct, checkpoint `cp-20261002-1`** (`526a105`, CI verde, producción sirve ese commit): 139 y 150 done
  (095 y 135 ya estaban en `cp-20261001-1`).
- 🌊 **1-oct: olas y checkpoints** (`docs/plan-reparto.md` §1, §4 a §6). Ola O1 abierta; camino crítico: QM-10 y el
  manual de gestión comercial (QD-8) → 142. Cola de migraciones: ~~0057~~ (aplicada el 1-oct) → 092 → 102 → 142. Manual de
  gestión comercial en borrador (Alejo, `docs/manual-gestion-comercial.md`): falta que Mani lo apruebe.
- **1-oct, documentación reconectada:** `plan.md` §2 re-medido (58 migraciones, 0057 sin aplicar; C3 y comisión %
  verificadas en producción), O-5 cerrada, A12 nueva (TRM del ROAS, antes de E7), `comercial.md` §8 al día, A-01
  marcada obsoleta (134), 092 con el ADR 0068 en la cola, ticket 150 (tests rápidos) creado.

#### Antes del 1-oct (historia)

- 🎯 **30-sep, PRIORIDAD: el norte comercial de Gerencia** (`docs/comercial.md`, tracker arriba de todo). Pasos 1 y
  2 hechos (1-oct). Sigue el **lote 1** (sin Dani) en paralelo al mensaje a Dani; el **lote 2** (etapas de 30X)
  espera el manual. El `--aplicar` del 078 espera al lote 2.
- **30-sep:** E6 abierta. Carril de Mani: 089 (acotado) → 118 (espera el 117); 083, 101, 085, 087 y 121 done, 084
  reemplazado. Carril de Alejo: cerrar 072 (recorrido) y 078 (resolver sus tres hallazgos y `--aplicar`), después 092,
  117, 119/120 y 102; 127, 116, 080 y 099 done. El orden completo, en el prompt de arriba y en `plan-reparto.md` §4.
- **Dapta Forms (1-oct):** 131 y 130 done; ComunicArte recibe por Dapta en producción. Antes de repartir el link:
  la pantalla final (respuesta de Dapta al `id` del outcome). Memorable espera su Calendly. Ver `docs/dapta/README.md`.
- Vigilar que los leads reales sigan entrando por webhook: `/ajustes/salud` (110). Los pares sin canal:
  `/ajustes/canales` (101).
