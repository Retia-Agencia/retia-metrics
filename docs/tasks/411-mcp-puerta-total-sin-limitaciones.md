---
id: 411
etapa: mcp
serves: "Pedido de Mani del 9-nov (el MCP no limita acciones ni métricas: puerta de entrada con reglas de orientación, visibilidad completa y control total según el rol) · ADR 0129 · ADR 0119 · A-177 · A-178 a A-185"
depends: [348, 383]
status: todo
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
- **D2 Escrituras y roles:** ¿cada rol escribe exactamente lo que escribe en la app? ¿El gerente que opera como closer
  (ADR 0084) cumple? ¿Customer success? (Propuesta: sí, sin ensanchar nada.)
- **D3 Qué queda fuera por seguridad:** emitir o revocar tokens, secretos de fuentes, usuarios y roles. ¿Algo más?
- **D4 Orden frente a los tickets abiertos:** Mani pidió prioridad. ¿411 antes del 384 (que pasa a ser su F2), del 385 F3 en
  adelante y de la ola 2 del 401?
- **D5 Cesión de deal entre closers (A-177):** ¿entra como primera acción de escritura de prueba del MCP o primero la
  pantalla? Las nueve preguntas de A-177 siguen abiertas.
- **D6 Cuánto se mide en producción:** ¿bytes y conteo de consultas por llamada siempre, o solo con una bandera?

## Fases y "Done cuando"

- [ ] **F0 Diagnóstico cerrado.** Las 11 limitaciones confirmadas con una medición reproducible (script de lectura en
  `mcp_llamadas`) y D1 a D6 respondidas por Mani. Sin esto, no se construye.
- [ ] **F1 Lectura abierta.** `buscar` con dueño; filtros por nombre o id sin 0 silencioso; filtros por defecto declarados;
  opciones aparte; `campos`; paginación en SQL; un solo nombre por concepto. La pregunta del 9-nov = 1 llamada.
- [ ] **F2 Escritura (reemplaza al 384).** Registro de acciones, vista previa, confirmación, rastro `mcp`, deshacer; revisión
  adversarial (`/codex:adversarial-review`) y petición forjada por rol y programa.
- [ ] **F3 Guardián de cobertura** mordido en los dos sentidos.
- [ ] **F4 Medición** (migración propia, aplicada por la sesión principal, con `lock_timeout`) e informe.
- [ ] **F5 Descubrimiento y evaluaciones.**
- [ ] `docs/mcp.md` reescrito (§1, §3, §4 puntos 7, 8 y 20, §7) en el mismo commit que el código (N8); `INSTRUCCIONES_MCP` al día.
- [ ] Tracker y `status:` coinciden (N9).

## Riesgos que este ticket no puede olvidar

- Abrir la escritura **sin** la regla de confirmación sería el error más caro del proyecto (un cambio malo se ve igual que
  uno bueno). La confirmación humana y el deshacer no se negocian.
- «Sin límites» no es «sin reglas»: el rol y el alcance los sigue dictando el servidor; una herramienta flexible que cruce
  programas rompe la frontera del programa (ADR 0043). El tipo de la consulta debe impedirlo.
- Una consulta genérica no define métricas: toda cifra sigue viniendo de `docs/metricas.md` y de su módulo (ADR 0115 N1).
- No copiar la proyección de una pantalla a la herramienta: importar el mismo módulo (regla del 6-nov, `AGENTS.md`).
