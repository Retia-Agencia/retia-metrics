---
id: 411
etapa: mcp
serves: "Pedido de Mani del 9-nov (el MCP no limita acciones ni métricas: puerta de entrada con reglas de orientación, visibilidad completa y control total según el rol) · ADR 0129 · ADR 0119 · A-177 · A-178 a A-185"
depends: [348, 383]
status: en curso  # 13-nov: F0, F1, F2 y F3 hechas; faltan F4 y F5
---

# 411 — El MCP del CRM como puerta total: sin límites de acciones ni de métricas

> **Prioridad alta, antes de seguir con 384, 386, 387 y 407 (Mani, 9-nov).** Es el ticket que decide el *modelo y alcance*
> del MCP. Hoy el MCP es una interfaz rígida de once consultas de solo lectura; lo que Mani pidió es una **puerta de
> entrada con reglas de orientación**: lo que la app puede mostrar o hacer, el MCP también, según el rol. Lee antes
> `docs/mcp.md`, el ADR 0119, el ADR 0129 (este ticket lo implementa), el ticket 384 (escrituras) y el 385 (métricas).

## De dónde sale (9-nov, sesión de Mani en Ventas Francisco)

Mani usó el MCP del CRM (`retia-crm`) para verificar que un lead que le pasó un closer a otro había quedado bien: el deal
`69e0b861…` de Comunícate con Confianza (cohorte C1), de Alejo Carvajal a Nicolás. **Tardó mucho y tomó ~18 llamadas para
una pregunta que la app responde con un clic.** Mani pidió identificar qué limita las llamadas desde la infraestructura
que se definió, y, si está floja o incompleta en su modelo y alcance, hacerlo **con prioridad antes de seguir**.

## Qué se midió (solo lecturas; `mcp_llamadas` en producción, ref `hfqmiyiuyqapdsbywrag`, 9-nov)

**El servidor no es el cuello.** Duración en servidor de las 18 llamadas de la sesión (22:02 a 22:03 UTC, cliente
`claude-code 2.1.321`): `programas_visibles` 98 ms; `buscar_leads` 287 a 336 ms; `ficha_de_lead` 341 a 352 ms;
`tablero_de_deals` 316 a 2.062 ms; 4 rechazos de esquema de 0 a 2 ms. Suma ≈ 11 s. Promedios de 7 días: `consultar_metrica`
472 ms (p95 1.019), `tablero_de_deals` 879 (p95 1.973), `resumen_del_hub` 755, `buscar_leads` 404, `bandeja` 840,
`cartera_vencida` 424, `origen_del_programa` 1.173, `pauta_roas` 1.921 (p95 2.823, máx. 3.053), `ficha_de_lead` 174.
El resto del tiempo es del lado del modelo y del cliente (esperar cada respuesta grande, decidir la siguiente llamada),
igual que la medición del 7-nov (96 y 890 ms en servidor contra ~40 s en el cliente, `docs/mcp.md` §4.15). **No se alcanzó el
tope de 300 llamadas por minuto.** Lo que alarga es la *forma* del MCP, no la infraestructura de red o de base:

## Las limitaciones identificadas (L1 a L11), con su evidencia

| # | Limitación | Evidencia | Consecuencia |
|---|---|---|---|
| L1 | **Solo lectura.** Las once herramientas llevan `soloLectura: true` (`lib/mcp/herramientas/tipos.ts:26`, `readOnlyHint` en `servidor.ts:58`). El scope `escritura` existe en `token.ts` pero no hay ninguna herramienta que lo use; el 384 está `todo`. | Ceder el deal, mover una etapa, registrar un abono o anotar: no hay puerta. Para lo que sí puede hacer la app, el MCP responde «no se puede». | Contradice el pedido: control total según el rol. |
| L2 | **Superficie fija de consultas pre-armadas (once).** Una pregunta que cruza objetos no tiene herramienta propia. | «¿De quién es el lead Alexander?» necesitó 3 búsquedas (una por programa), 3 fichas y 4 tableros. `buscar_leads` devuelve etapa pero **no dueño**; la ficha trae el dueño, una persona a la vez (N+1). | Muchas llamadas y mucho contexto por una pregunta simple. |
| L3 | **Nombres inconsistentes entre herramientas.** `buscar_leads` devuelve `id_de_la_persona`; `ficha_de_lead` exige `id` y es `.strict()`. | 3 rechazos `ENTRADA_INVALIDA:clave_desconocida,id` seguidos (0, 0 y 1 ms). Además, el esquema de cada herramienta no está en el prompt del cliente (herramientas diferidas): el error es la única forma de aprenderlo. | Llamadas desperdiciadas y descubrimiento por ensayo y error. |
| L4 | **El filtro `closer` del tablero acepta texto libre y no valida.** Con «Nicolás» respondió 0 tarjetas sin error y eco `"dueno":"Nicolás"` como si se hubiera aplicado; solo el id de usuario (`05a03558…`) funcionó. En métricas, `closer` es otro objeto (código opaco de 64 hex, `lib/queries/filtros-de-lista.ts:28`). | Tableros de Tactical, Comunicarte y Confianza con «Nicolás» y «Alejo Carvajal» devolvieron `total: 0`; el mismo filtro con el id sí encontró el deal. | **Miente en silencio** (la clase de error que AGENTS.md describe: una cifra creíble sin error). Un parámetro con dos significados. |
| L5 | **Filtro por defecto silencioso.** Sin `cohorte`, el tablero filtra a la cohorte activa y lo muestra como un uuid en `filtros.cohorte`, no como «por defecto». | Los 8 «Alexander» de Confianza incluían leads de otros periodos que el tablero no listó; no hay forma de pedir «todas las cohortes» ni de buscar un deal por nombre en todo el programa. | Un resultado vacío se confunde con «no existe». |
| L6 | **Respuestas desmedidas, sin proyección.** `tablero_de_deals` devuelve siempre `opciones` completas (19 motivos, canales, plataformas, cohortes, dueños…) además de las tarjetas; `ficha_de_lead` devuelve cada campo del formulario (incluido `fbclid`). No hay parámetro `campos`, ni vista compacta, ni opciones aparte. | 5 tableros de la sesión repitieron las mismas opciones (≈ miles de tokens cada una). | Contexto y tiempo del modelo gastados en lo que no se pidió. |
| L7 | **Paginación en memoria.** `tablero_de_deals` carga el tablero completo (`tableroDeDealsParaActor`) y recorta 50 tarjetas por página después (`operacion.ts`). | El costo en servidor es el del tablero entero por cada página (1 a 2 s hoy). | No escala con el volumen; sin `EXPLAIN` (deuda 386). |
| L8 | **Sin consulta genérica.** Ninguna herramienta consulta los hechos (envío, agenda, cita, venta, abono, gasto) por dimensiones. La capa que lo permite ya está definida como contrato C-2 (`docs/hub.md` §8, `lib/queries/hechos/`), pero el MCP solo expone vistas ya hechas. | `consultar_metrica` solo atiende métricas del registro; lo demás exige otra herramienta o no existe. | «No es una interfaz rígida» no se cumple. |
| L9 | **Costo fijo por llamada.** Cada llamada valida el token, arma una sesión fresca dos veces (`atender` y el paso 2 del flujo) y escribe una fila en `mcp_llamadas`; el SDK vuelve a armar un servidor por petición. | Sin medir todavía: no hay desglose de dónde van los ms; `mcp_llamadas` guarda `duracion_ms` total pero no bytes de respuesta ni conteo de consultas. | No se puede decir con datos qué parte es overhead. |
| L10 | **Descubrimiento.** `instrucciones.ts` lista qué herramienta usar para qué; no hay herramienta de «qué puedo hacer / qué filtros existen / qué dimensiones», y el nombre de un campo cambia de una herramienta a otra (L3). | El modelo exploró por ensayo. | Pasos de más; riesgo de elegir mal. |
| L11 | **Rol y alcance, bien, pero el rol acota la superficie entera.** Gerente y closer ven operación; paid trafficker, hub y pauta; customer success, ficha reducida y cartera (`docs/mcp.md` §3). Un rol sin herramienta para algo que su pantalla sí le muestra no tiene alternativa. | La regla debe ser «lo que ve y hace en la app», no «lo que alguien listó». | Cualquier capacidad nueva de la app queda fuera del MCP hasta que alguien agregue su herramienta. |

## Lo que sí está bien y no se toca

Autenticación por OAuth/token con hash; rol y alcance revalidados en cada llamada; el programa como frontera (404, no
403); el developer sin restricciones (ADR 0025); lectura por las mismas consultas de las pantallas (ADR 0115 N1/N2); rastro
sin argumentos y tope por minuto; errores sin detalle interno. **Abrir el MCP no es relajar la seguridad**: el rol y el
alcance los sigue dictando el servidor, no el cliente ni la herramienta.

## Modelo y alcance propuestos (a decidir con Mani; ADR 0129 fija el principio, esto es el diseño)

**Principio:** *capacidad de la app = capacidad del MCP, por rol.* Una herramienta del MCP no es una pregunta
pre-armada: es una **puerta con reglas de orientación** sobre los mismos servicios que usa la app. Se mantiene la regla de
«pocas herramientas de alto valor» (`docs/mcp.md` §4.8), pero de **alto alcance**, no de alcance acotado.

1. **Lectura abierta (F1).** Reemplazar el N+1 por búsqueda y consulta flexibles:
   - `buscar` global (persona, deal, llamada) que devuelva **dueño, etapa, programa, cohorte y última actividad** en la fila.
   - `consultar_hechos`: un hecho del contrato C-2, filtros por la lista blanca de dimensiones, agrupar, ordenar, `campos`
     y paginar **en SQL** (la misma consulta que la lista detrás de cada cifra del Hub), no recortando en memoria.
   - Los filtros aceptan **nombre o id** y resuelven de forma determinista: ambiguo, inexistente o fuera de alcance
     responde error accionable, **nunca 0 silencioso** (L4); todo filtro por defecto se **declara** en la respuesta (L5).
   - `opciones_de_filtros` aparte: las opciones dejan de viajar con cada tablero (L6).
   - Un solo nombre para el mismo concepto en todas las herramientas (L3), con alias aceptados de entrada y un
     guardián que compare entradas y salidas.
2. **Escritura completa (F2, absorbe el 384).** Cada acción que la app permite a un rol existe en el MCP como acción de
   un **registro exhaustivo** derivado de los servicios de `lib/` (las mismas funciones que la UI: `moverEtapa`,
   `editarDeal`, `reclamarDeal`, `registrarAbono`, llamadas, anulaciones, cesión de deal A-177…), cada una con **vista
   previa → confirmación en el chat → `crearConRastro` con origen `mcp` → deshacer** (regla del 6-nov del 384, intacta).
   Misma validación que la pantalla, nunca una reglita propia del MCP.
3. **Guardián de cobertura (F3).** Un registro de capacidades de la app (acciones de servidor y consultas por rol) contra el
   de capacidades del MCP, con **excepciones nombradas y justificadas** (p. ej. emitir tokens, secretos): una capacidad
   nueva de la app sin equivalente en el MCP falla el test, igual que `tests/contrato-extension.test.ts` caza un programa
   escrito a mano. Así «sin límites» no depende de la memoria de nadie.
4. **Medición (F4).** `mcp_llamadas` guarda además bytes de respuesta y consultas ejecutadas (migración); un informe por
   herramienta con p50/p95 de servidor y tamaño, `EXPLAIN` a 10× el volumen (deuda del 386) y tablero con paginación en
   SQL. Meta inicial: nada de lo que hoy tarda 1 a 3 s en servidor tarda más; las respuestas por defecto caben en un
   contexto razonable; la pregunta del 9-nov se contesta en **1 llamada**.
5. **Descubrimiento (F5, absorbe el espíritu del 387).** Una herramienta de capacidades («qué puedo consultar y hacer, con
   qué filtros y dimensiones») y un conjunto de evaluaciones de preguntas reales de closers y gerencia (la de Alexander,
   la cesión de A-177, ventas de la semana por closer…), con el número de llamadas esperado.

## Decisiones abiertas (ninguna asumida; cada una se resuelve con Mani antes de construir)

- **D1 Forma:** ¿una acción genérica `proponer_accion`/`confirmar_accion` con registro exhaustivo, o una herramienta por
  familia de acciones? (Hay que sopesar la guía de «pocas herramientas» contra «sin límites».)
  - ✅ **Respondida (Mani, 12-nov): genérica con registro exhaustivo y descubrimiento progresivo.** Medido: 137 server
    actions en `app/`, unas 40 de escritura operativa (31 solo en `deals/[id]/acciones.ts`); una herramienta por acción
    llevaría `tools/list` de 11 a más de 50, y cargar definiciones por adelantado es lo que más contexto gasta (Anthropic,
    *Code execution with MCP*: 150.000 → 2.000 tokens con divulgación progresiva y una búsqueda con nivel de detalle). La spec
    permite que `tools/list` varíe por credencial, no por conexión, con orden determinista. **El contrato:**
    - `capacidades({accion?, detalle})` (lectura): qué acciones y consultas tiene el rol, una línea cada una; con `accion`,
      su esquema completo y un ejemplo.
    - `preparar_accion({accion, argumentos})` (no escribe): `accion` es el enum de las permitidas al rol; el servidor valida
      `argumentos` con el zod `.strict()` de la acción y, si falla, el error nombra el campo y devuelve el esquema esperado.
      Responde vista previa (antes → después, lo que no se podrá aplicar y por qué, efectos externos), id de un uso con
      vencimiento de 10 minutos y huellas; lotes hasta 50.
    - `confirmar_cambio({id})` (`destructiveHint`): revisa la huella, aplica por fila en su transacción, dice cómo deshacer.
    - Deshacer es una acción más del registro.
    - **`AccionMcp`** en un registro exhaustivo `ACCIONES`: clave, título, cuándo usarla, zod estricto con topes, `puede`
      de `roles.ts`, `revisar` (la vista previa pura de la app), `huella`, `aplicar` (el MISMO caso de uso de `lib/` que la
      server action, con origen `mcp`), si se deshace y si tiene efecto externo. Una funcionalidad nueva de la app = una fila
      en `ACCIONES` y su test; el guardián del F3 falla si falta.
    - El propósito que lo juzga (Mani): productividad. Gerencia pide cualquier dato (pauta, negocio) y el MCP es su puerta a
      los datos; el closer ve y opera todo lo suyo (alertas, hallazgos, su pipeline entero), extrae y actualiza.
- **D2 Escrituras y roles:** ¿cada rol escribe exactamente lo que escribe en la app? ¿El gerente que opera como closer
  (ADR 0084) cumple? ¿Customer success? (Propuesta: sí, sin ensanchar nada.)
  - ✅ **Respondida (Mani, 12-nov): igual que la app, ni más ni menos.** La lista de acciones de un rol sale del `puede` de
    cada acción (funciones de `roles.ts`) y el permiso sobre la fila lo vuelve a decidir `lib/` (`puedeTrabajarDeal`, la reja de
    `moverEtapa`): el MCP no tiene reglas propias. El gerente con `opera_como_closer` escribe como closer (`trabajaLeads` ya
    recibe la capacidad), customer success lo que su pantalla permite (onboarding), el paid trafficker lo de pauta que la app le
    deja, el developer todo salvo con «ver como» activo (172), y un token de lectura no ve ninguna acción de escritura.
- **D3 Qué queda fuera por seguridad:** emitir o revocar tokens, secretos de fuentes, usuarios y roles. ¿Algo más?
  - ✅ **Respondida (Mani, 12-nov): tres grupos, todos nombrados en el guardián del F3.** (A) **Siempre fuera:** emitir o
    revocar tokens y el consentimiento OAuth; secretos (firma de fuentes, tokens de Calendly, Meta y Typeform); usuarios, roles,
    alcance y `opera_como_closer`; **SQL libre** (cruza programas, recalcula cifras fuera de su módulo, N1, y se salta
    `vigente()`): la puerta de gerencia a los datos es `consultar_hechos` sobre los hechos del C-2 con todas sus dimensiones y la
    lista detrás de cada cifra. (B) **Dentro con confirmación**, al revés del 384: anular deal, llamada o abono (la app lo
    permite y lleva motivo; **corregido el 13-nov (Mani): como en la app, una anulación NO se deshace** y la vista previa lo dice; hacerla reversible es regla nueva de la app, ticket aparte). (C) **Dentro en una ola posterior**, como pendientes nombrados: configuración del
    programa e integraciones (objetivos, umbrales, fuentes y su mapeo, Meta, Calendly, reporte de WhatsApp, catálogos), porque un
    mapeo roto pierde leads sin error.
- **D4 Orden frente a los tickets abiertos:** Mani pidió prioridad. ¿411 antes del 384 (que pasa a ser su F2), del 385 F3 en
  adelante y de la ola 2 del 401?
  - ✅ **Respondida (Mani, 12-nov): el 411 antes del 384 (que se cierra absorbido como F2), del 385 F3 en adelante, del 386,
    387, 407 y de la ola 2 del 401; y dentro del 411, gerencia primero.** El F1 entero (incluido `consultar_hechos` con paginación
    en SQL) va antes de cualquier escritura; luego F2 (ola 1 pipeline del closer, ola 2 dinero, Calendly y anular), F3, F4 y F5.
    Se descartó partir el F1 para adelantar las escrituras de Michael.
- **D5 Cesión de deal entre closers (A-177):** ¿entra como primera acción de escritura de prueba del MCP o primero la
  pantalla? Las nueve preguntas de A-177 siguen abiertas.
  - ✅ **Respondida (Mani, 12-nov): primero ADR y pantalla.** La cesión pasa por `/grill-with-docs`, un ADR (enmienda del 0003)
    y su caso de uso en `lib/` con su pantalla; cuando exista, entra al MCP como una fila más de `ACCIONES`. La primera acción
    del MCP es mover de etapa, que ya tiene vista previa pura (`revisarMovimiento`): se prueba el molde, no una norma nueva. La
    pregunta del 9-nov (¿quedó bien el traspaso?) es de lectura y la resuelve el F1.
- **D6 Cuánto se mide en producción:** ¿bytes y conteo de consultas por llamada siempre, o solo con una bandera?
  - ✅ **Respondida (Mani, 12-nov): siempre, sin bandera.** Cada fila de `mcp_llamadas` guarda bytes de la respuesta (largo del
    JSON serializado) y número de consultas a la base (contador por llamada en el logger de drizzle). Retención de 90 días, la
    que ya existe; la migración la aplica la sesión principal.

## Fases y "Done cuando"

- [x] **F0 Diagnóstico cerrado.** Las 11 limitaciones confirmadas con una medición reproducible (script de lectura en
  `mcp_llamadas`) y D1 a D6 respondidas por Mani. Sin esto, no se construye.
  - **Hecho el 12-nov.** `scripts/informe-mcp.ts` (solo lectura, sin usuarios ni tokens): por herramienta llamadas, p50, p95,
    máximo y fallas por código; con `--desde`/`--hasta`, la secuencia. Se corre con
    `npx tsx --env-file=<.env.local> scripts/informe-mcp.ts [--dias N | --desde ISO --hasta ISO]`; es también la línea base del F4.
  - **La sesión del 9-nov** (22:00 a 22:06 UTC): 17 llamadas registradas (el ticket contó ~18; `mcp_llamadas` no explica
    la diferencia), 10.366 ms en servidor en total; 4 rechazos de esquema (3 `ficha_de_lead` por `id`, 1 `tablero_de_deals`) de 0 a
    2 ms: confirma L2, L3 y que el servidor no es el cuello. L1, L4 a L8, L10 y L11 se confirman en el código citado en la tabla;
    L9 se confirma por ausencia (la tabla no tiene bytes ni consultas).
  - **7 días (5 al 12-nov), p50/p95 en ms:** `programas_visibles` 113/175 · `buscar_leads` 331/741 · `ficha_de_lead` 172/351 ·
    `cartera_vencida` 438/535 · `consultar_metrica` 369/947 · `resumen_del_hub` 774/1.021 · `tablero_de_deals` 783/1.789 ·
    `bandeja` 840/866 · `origen_del_programa` 1.224/1.460 · `pauta_roas` 1.745/2.757 · **`ficha_de_deal` 2.023/2.472 (máx.
    2.612)**, la más lenta por llamada y no estaba en la medición del 9-nov. Ningún tope alcanzado.
  - **Hallazgo fuera de las L:** `pauta_roas` respondió 7 veces «Error interno» (9-nov 19:37 desde claude.ai, cuatro seguidas;
    10-nov 05:08 y 05:43 desde Claude Code); ninguna después del 10-nov 05:44 UTC. No es de este ticket: va como follow-up.
- [x] **F1 Lectura abierta.** `buscar` con dueño; filtros por nombre o id sin 0 silencioso; filtros por defecto declarados;
  opciones aparte; `campos`; paginación en SQL; un solo nombre por concepto. La pregunta del 9-nov = 1 llamada. Cerrada el 12-nov (H3a): `consultar_hechos` sobre seis hechos, `buscar` por programa (una sección por programa, sin total, Mani), dueño y registrado_por ocultos a quien no ve el equipo comercial; abierto: el orden por nombre en SQL usa el collation de la base y la pantalla `localeCompare("es")`.
- [x] **F2 Escritura (reemplaza al 384).** Registro de acciones, vista previa, confirmación, rastro `mcp`, deshacer; revisión
  adversarial (`/codex:adversarial-review`) y petición forjada por rol y programa. Ola 1 en main el 13-nov: registro `ACCIONES` con `mover_etapa` y `deshacer_evento`, un solo caso de uso (`lib/deals/mover-deal.ts`), `mcp_vistas_previas` de un uso (0134) y el origen del movimiento en `deal_etapa_historial` (0135); ola 2 en main el 13-nov: diez acciones más (`marcar_show`, `pegar_grain`, `corregir_resultado`, `marcar_fallida`, `asignar_llamada_suelta`, `registrar_abono`, `cambiar_plataforma_de_abono`, `anular_deal`, `anular_abono`, `anular_llamada`) sobre los mismos casos de uso de la app, vista previa por ensayo con rollback (`lib/mcp/acciones/ensayo.ts`), guarda de alcance única con 404 (`lib/deals/alcance.ts`), anular mudado a `lib/deals/anular.ts`, Calendly y Grain después del commit, y el origen de cada movimiento en la ficha y en `ficha_de_deal`. Decisiones de Mani del 13-nov: sin reagendar ni agendar (reservan en Calendly); `cancelada` y asignar suelta entran avisando que cancelan en Calendly; el enlace del comprobante es obligatorio en el MCP; las anulaciones, `marcar_fallida`, `asignar_llamada_suelta`, `corregir_resultado`, `marcar_show`, `pegar_grain` y `cambiar_plataforma_de_abono` no se deshacen en un paso, igual que en la app. Hallazgo de la app, sin tocar: deshacer el resultado de una fallida deja Re-agenda puesto (fijado en `tests/mcp-acciones-ola2.test.ts`).
- [x] **F3 Guardián de cobertura** mordido en los dos sentidos.
- [ ] **F4 Medición** (migración propia, aplicada por la sesión principal, con `lock_timeout`) e informe.
- [ ] **F5 Descubrimiento y evaluaciones.**
- [x] `docs/mcp.md` reescrito (§1, §3, §4 puntos 7, 8 y 20, §7) en el mismo commit que el código (N8); `INSTRUCCIONES_MCP` al día.
- [ ] Tracker y `status:` coinciden (N9).

## F3 en detalle (enmienda del 13-nov, para implementar sin huecos)

> Origen: `docs/reportes/revision-hub-metricas-mcp-2026-11-13.md`, hallazgos H-5 y H-6. **F3 va antes de sumar más acciones:**
> sin el guardián, cada acción nueva de la app nace fuera del MCP y nadie se entera (ADR 0129).

**Medido el 13-nov.** La app exporta unas 150 funciones desde archivos `"use server"`
(`grep -rl '^"use server"' app components lib | xargs grep -h "^export async function"`). El MCP tiene 12 acciones en
`lib/mcp/acciones/`. La clasificación de abajo es **por el nombre de la función, sin abrir cada una**: es el punto de partida
del registro, no su contenido final. Quien implemente abre cada función y confirma su grupo.

| Grupo | Qué es | Funciones de la app (nombre de la server action) |
|---|---|---|
| **Expuestas** (12) | Ya tienen acción en `ACCIONES` | `moverDeal`/`moverConHechoAccion`, `deshacerEventoAccion`, `marcarShowAccion`, `pegarGrainAccion`, `corregirResultadoAccion`, `registrarAbonoAccion`, `cambiarPlataformaDeAbonoAccion`, `anularDealAccion`, `anularAbonoAccion`, anular llamada, `marcarFallidaAccion`, `asignarLlamadaSueltaAccion` |
| **Pendientes de operación** (grupo B de D3: entran, con confirmación) | Lo que hace un closer, un gerente o CS a diario y hoy solo se puede en la app | `anotarAccion`/`registrarActividadAccion`, `reclamarDealAccion`, `reclamarTodosPorSettearAccion`, `reasignarDealAccion`, `editarDealAccion`, `editarAcuerdoAccion`, `crearDeal`, `crearDealDesdeSueltaAccion`, `crearPersonaAccion`, `agendarLlamadaAccion`, `reagendarLlamadaAccion`, `completarAgendadaAccion`, `descartarLlamadaSueltaAccion`, `confirmarComprobanteAccion`, `pegarComprobanteAccion`, `marcarCortesiaAccion`, `marcarLinkEnviadoAccion`, `cambiarCohorteAccion`, `proximaCohorteAccion`/`asignarProximaCohorteAccion`, `marcarOnboardedAccion`/`desmarcarOnboardedAccion`, `confirmarCorreoAccion`/`separarCorreoAccion` (y sus pares `DesdeDeal`), `revisarMovimientoAccion` |
| **Pendientes de configuración** (grupo C de D3: ola posterior) | Programa, cohortes, objetivos, umbrales, fuentes y su mapeo, integraciones, reporte de WhatsApp, plataformas y enlaces de pago, recursos, Calendly por membresía, media | `crearCohorteAccion`, `editarCohorteAccion`, `activarCohorteAccion`, `guardarObjetivoAccion`, `copiarObjetivosAccion`, `guardarUmbralAccion`, `crearFuenteAccion`, `editarFuenteAccion`, `activarFuenteAccion`, `guardarIntegracionAccion`, `guardarReporteWhatsappAccion`, `crearPlataformaAccion`, `crearEnlacePagoAccion`, `crearRecursoAccion`, `guardarRoundRobinAccion`, `asignarCalendlyDeMembresiaAccion`, `crearPiezaAccion`, `crearCreadorAccion` y sus pares de editar, desactivar y borrar |
| **Siempre fuera** (grupo A de D3) | Tokens, secretos, usuarios, roles, suplantación | `emitirMiTokenAccion`, `revocarMiTokenAccion`, `revocarConexionDeIa`, `permitirConexion`, `cancelarConexion`, `desconectarMiConexionAccion`, `rotarSecretoFuenteAccion`, `guardarSecretoFuenteAccion`, `crearUsuarioAccion`, `editarUsuarioAccion`, `desactivarUsuarioAccion`, `reactivarUsuarioAccion`, `verComoUsuario`, `cambiarVista`, `agregarWhatsappDeUsuarioAccion` |
| **No son escrituras** | Leen para la pantalla; su par del MCP es una consulta | `buscarLeadsAccion`, `buscarDealsAbiertosAccion`, `detalleDeLlamadaAccion`, `detalleDePuntoAccion`, `horasDisponiblesAccion`, `eventosDeMembresiaAccion`, `cargarMasEntregasAccion`, `probarFuenteAccion`, `probarIntegracionAccion` |

**Cómo se construye el guardián** (molde: `lib/deshacer/registro.ts`, que clasifica exhaustivamente cada columna con rastro):

1. `lib/mcp/cobertura.ts`: un `Record` con **cada** server action de la app y su clase: `expuesta` (con el nombre de la acción del
   MCP), `pendiente` (con el grupo y una frase), `fuera` (con la razón de D3) o `lectura` (con la herramienta que la cubre).
2. `tests/mcp-cobertura-guardian.test.ts` recorre los archivos `"use server"` de `app/`, `components/` y `lib/`, extrae las
   funciones exportadas y falla si una no está en el registro, o si el registro nombra una que ya no existe (N7). Y al revés:
   toda acción de `ACCIONES` aparece como `expuesta` en al menos una fila.
3. **Trinquete:** el número de `pendiente` se escribe en una constante (`TOPE_DE_PENDIENTES_DEL_MCP`) que solo puede bajar, como
   `lib/metricas/pendientes.ts`. Nace con el número real del día, no con cero.
4. Mordido en los dos sentidos: una server action sintética sin clasificar hace fallar el test; clasificarla lo pone en verde.
5. `capacidades` del MCP devuelve los pendientes como "todavía solo en la app", para que el modelo diga "eso se hace en la app" en
   vez de inventar un camino.

**Lo mismo para las consultas.** F3 pide también "consultas por rol". Lo mínimo verificable: cada `Metrica` de
`lib/queries/metricas-con-filas.ts` y cada concepto de `lib/metricas/registro.ts` se puede pedir por `consultar_metrica` o
`consultar_hechos` con el rol que lo ve en la app; un test lo recorre. Cuando el 419 (E-1) deje el texto de cada métrica en su
ficha, `capacidades` y `consultar_metrica` devuelven `que` y `formula` desde ahí: la definición que lee el modelo es la misma que
lee Gerencia en la pantalla.

**Orden recomendado de las acciones pendientes de operación** (después de F3; cada tanda con su revisión adversarial y su
petición forjada por rol): (1) anotar actividad, reclamar, editar deal y acuerdo: es lo que más se hace y no toca a terceros;
(2) crear persona y deal; (3) comprobantes, cortesía y onboarding; (4) cohorte y próxima cohorte; (5) agendar y reagendar, que
reservan en Calendly (Mani las dejó fuera el 13-nov: necesitan su propia decisión). La cesión de deal (A-177) sigue esperando su ADR.

**H-6 · `docs/mcp.md` se contradice.** §3 lista las 12 acciones; §7 todavía dice "la puerta de escritura ya tiene su primer caso de
uso, mover de etapa y deshacerlo". La casilla de abajo ("`docs/mcp.md` reescrito") lo cubre: hacerlo en el commit de F3. Revisar
también que `INSTRUCCIONES_MCP` (`lib/mcp/instrucciones.ts`) nombre las mismas acciones que `ACCIONES`; lo ideal es que la lista
salga de `ACCIONES` y no esté escrita a mano (regla de AGENTS.md: una herramienta no copia).

**Pendiente del 348 y del 383 que F5 debe cerrar** (no son de código): conectar un cliente real (Claude Code con `claude mcp add`,
claude.ai, ChatGPT), y comparar una misma cifra en el MCP, el Hub y el mensaje de WhatsApp para un programa y un periodo
cerrado. Es la prueba de aceptación de todo el frente de métricas y nadie la ha hecho.

## Riesgos que este ticket no puede olvidar

- Abrir la escritura **sin** la regla de confirmación sería el error más caro del proyecto (un cambio malo se ve igual que
  uno bueno). La confirmación humana y el deshacer no se negocian.
- «Sin límites» no es «sin reglas»: el rol y el alcance los sigue dictando el servidor; una herramienta flexible que cruce
  programas rompe la frontera del programa (ADR 0043). El tipo de la consulta debe impedirlo.
- Una consulta genérica no define métricas: toda cifra sigue viniendo de `docs/metricas.md` y de su módulo (ADR 0115 N1).
- No copiar la proyección de una pantalla a la herramienta: importar el mismo módulo (regla del 6-nov, `AGENTS.md`).

**14-nov, F4 (parte de base):** la migración 0143 agregó `mcp_llamadas.bytes_respuesta` y `consultas` (nulas), aplicada en producción con el ok de Mani. Falta solo el código (brief B-1 de `docs/agents/briefs-codex-14-nov.md`) y F5 (B-2 y la prueba con un cliente real).
