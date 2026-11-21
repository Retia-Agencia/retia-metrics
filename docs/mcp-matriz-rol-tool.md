# Matriz rol × herramienta del MCP (insumo del ticket 386)

Estado: borrador para revisión de Mani. Fecha: 21-nov-2026. Base: `origin/main` en `bb465175`.
Todo sale del código; donde no se pudo derivar dice "sin fuente verificada". No cambia código.

Convención de citas: `archivo:línea`, líneas de `bb465175`. Regla de fondo: la capacidad del MCP es la de la app
por rol (ADR 0129) y la decide `lib/auth/roles.ts`, nunca un rol escrito a mano en la herramienta.

## 0. Cómo se decide quién puede

| Pieza | Qué decide | Fuente |
|---|---|---|
| Registro de herramientas | Una herramienta que no está en `HERRAMIENTAS` no existe. `herramientasPara` filtra con `puede(contexto)`. | `lib/mcp/herramientas/index.ts:12-38` |
| Registro de acciones | 14 acciones. `preparar_accion` y `confirmar_cambio` solo existen con token de escritura. | `lib/mcp/acciones/index.ts:17-32`, `lib/mcp/herramientas/acciones.ts:104,201` |
| Token de escritura | `escritura` es `true` solo si el scope es "escritura" y la sesión no es una suplantación. | `lib/mcp/sesion.ts:58` |
| Acceso total | `developer` pasa toda guarda por `esAccesoTotal`, una sola vez. | `lib/auth/roles.ts:71`, `:189` (`puedeAcceder`) |
| Gerente y closer | Disjuntos, sin herencia (ADR 0003). | `lib/auth/roles.ts:183-193` |
| Alcance de programas | developer: todos los activos. gerente, paid_trafficker y media: los de su alcance configurable (o todos si no tienen filas). closer y customer_success: solo con membresía activa. | `lib/auth/alcance.ts:68-110`, `lib/auth/roles.ts:110` |
| Alcance de deals | gerente y developer ven todos. Cualquier otro rol con operación (closer) ve solo los suyos. | `lib/auth/alcance-deals.ts:8-13` |
| Quién trabaja un deal | Administrador (gerente, developer) o el closer dueño. Un deal sin dueño se reclama antes. | `lib/deals/permiso.ts:19-22` |
| Doble reja en `confirmar_cambio` | Revalida programa en alcance y que la acción siga permitida. | `lib/mcp/herramientas/acciones.ts:216,220` |

Funciones de `roles.ts` que aparecen en la matriz (quién las cumple):

| Función | Línea | gerente | closer | developer | paid_trafficker | customer_success | media |
|---|---|---|---|---|---|---|---|
| `puedeVerOperacion` | 195 | sí | sí | sí | no | no | no |
| `puedeVerFichaDeLead` | 199 | sí | sí | sí | no | sí | no |
| `veStudents` | 204 | sí | sí | sí | no | sí | no |
| `manejaPauta` | 219 | sí | no | sí | sí | no | no |
| `veTableroDelPrograma` | 246 | sí | no | sí | sí | no | no |
| `veEquipoComercial` | 230 | sí | sí | sí | no | no | no |
| `puedeConsultarDatos` | 260 | sí | no | sí | sí | no | no |
| `esAdministrador` | 97 | sí | no | sí | no | no | no |
| `marcaOnboarding` | 306 | sí | sí | sí | no | sí | no |
| `trabajaLeads` | 169 | solo con `operaComoCloser` | sí | sí | solo con `operaComoCloser` | solo con `operaComoCloser` | nunca |

Nota: `operaComoCloser` (ADR 0084) suma la capacidad `trabajaLeads` por usuario sin cambiar el rol. Las
herramientas de operación preguntan `puedeVerOperacion`, que mira el rol y no esa bandera. Un gerente que opera como
closer ya entra por ser gerente; un customer_success con la bandera no entra a las herramientas de operación
(sin fuente verificada de que sea intención, ver pregunta 6).

## 1. Matriz rol × herramienta y acción

Leyenda: SÍ = la herramienta aparece en `capacidades` y se puede llamar. NO = no aparece. "alcance" = qué filas ve.
La columna "Función" es la que decide `puede`.

### 1.1 Herramientas de lectura y soporte (17)

| Herramienta | Función que decide (línea de la herramienta → roles.ts) | gerente | closer | developer | paid_trafficker | customer_success | media |
|---|---|---|---|---|---|---|---|
| `programas_visibles` | ninguna, `() => true` (`programas.ts:15`) | SÍ, su alcance | SÍ, sus membresías | SÍ, todos | SÍ, su alcance | SÍ, sus membresías | SÍ, su alcance |
| `capacidades` | ninguna, `() => true` (`capacidades.ts:67`); lista según cada `puede` | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `resumen_del_hub` | `veTableroDelPrograma` (`metricas.ts:45` → `roles.ts:246`) | SÍ | NO | SÍ | SÍ, sin trabajo por closer (`conEquipo`, `metricas.ts:78`) | NO | NO |
| `consultar_metrica` | `veTableroDelPrograma \|\| veEquipoComercial` (`metricas.ts:133`); además cada lista exige `capacidadParaMetrica` (`lib/queries/metricas-con-filas.ts:123-138`) | SÍ, todas las listas | SÍ, pero solo la lista `no_agendaron` | SÍ, todas | SÍ, solo listas de pauta, origen y embudo comercial | NO | NO |
| `consultar_hechos` | `veTableroDelPrograma` (`hechos.ts:95`) | SÍ | NO | SÍ | SÍ, sin dimensiones del equipo comercial (`hechos.ts:102`) | NO | NO |
| `definiciones_de_metricas` | `puedeConsultarDatos` (`datos.ts:105` → `roles.ts:260`) | SÍ | NO | SÍ | SÍ | NO | NO |
| `consultar_datos` | `puedeConsultarDatos` y conexión de lectura configurada (`datos.ts:55`) | SÍ, la base impone alcance | NO | SÍ | SÍ, sin trabajo del equipo | NO | NO |
| `buscar` | `puedeVerOperacion` (`operacion.ts:47` → `roles.ts:195`) | SÍ, todos los deals | SÍ, solo deals propios | SÍ | NO | NO | NO |
| `buscar_leads` | `puedeVerOperacion` (`operacion.ts:112`) | SÍ | SÍ, alcance propio | SÍ | NO | NO | NO |
| `ficha_de_lead` | `puedeVerFichaDeLead` (`operacion.ts:148` → `roles.ts:199`); el rol viaja a la función de la pantalla (`operacion.ts:153-156`) | SÍ | SÍ | SÍ | NO | SÍ, solo lo básico en la app (`veSoloLoBasicoDelLead`, `roles.ts:321`); que el adaptador lo respete: sin fuente verificada | NO |
| `ficha_de_deal` | `puedeVerOperacion` (`operacion.ts:172`) | SÍ | SÍ, mismos deals que la pantalla: propios o sin dueño (`alcance-deals.ts:16`) | SÍ | NO | NO | NO |
| `tablero_de_deals` | `puedeVerOperacion` (`operacion.ts:219`) | SÍ, todos | SÍ, solo propios (`alcanceDeDeals`, `operacion.ts:228`) | SÍ | NO | NO | NO |
| `opciones_de_filtros` | `puedeVerOperacion \|\| veTableroDelPrograma` (`operacion.ts:264`); lista de dueños solo si `veEquipoComercial` (`operacion.ts:274`) | SÍ, con dueños | SÍ, con dueños (`veEquipoComercial` lo cumple) | SÍ, con dueños | SÍ, sin dueños | NO | NO |
| `bandeja` | `puedeVerOperacion` (`operacion.ts:303`) | SÍ, el equipo | SÍ, sus deals donde aplica dueño | SÍ | NO | NO | NO |
| `cartera_vencida` | `veStudents` (`decisiones.ts:56` → `roles.ts:204`) | SÍ | SÍ | SÍ | NO | SÍ | NO |
| `pauta_roas` | `manejaPauta` (`decisiones.ts:117` → `roles.ts:219`) | SÍ | NO | SÍ | SÍ | NO | NO |
| `origen_del_programa` | `veTableroDelPrograma` (`decisiones.ts:153`) | SÍ | NO | SÍ | SÍ | NO | NO |

### 1.2 Herramientas de escritura (2)

| Herramienta | Función | Efecto por rol |
|---|---|---|
| `preparar_accion` | `contexto.escritura` (`acciones.ts:104`), luego `accion.puede` (`acciones.ts:111`) | Cualquier rol con token de escritura la ve; sin acciones permitidas devuelve 403 con la lista. customer_success, paid_trafficker y media la ven pero no tienen ninguna acción. |
| `confirmar_cambio` | `contexto.escritura` (`acciones.ts:201`), revalida alcance y acción (`:216,:220`) | Igual. Una vista previa vale diez minutos y se consume una vez. |

### 1.3 Acciones (14), todas con `puede` en su archivo

| Acción | Función | gerente | closer | developer | paid | CS | media | Se deshace |
|---|---|---|---|---|---|---|---|---|
| `mover_etapa` | `puedeVerOperacion` (`mover-etapa.ts:58`) | todos los deals | propios | todos | NO | NO | NO | sí |
| `deshacer_evento` | `puedeVerOperacion` (`deshacer.ts:33`); quién deshace: `puedeDeshacer` (`lib/deals/permiso.ts:25`) | sí | propios o hechos suyos | sí | NO | NO | NO | n/a |
| `marcar_show` | `puedeVerOperacion` (`marcar-show.ts:44`) | sí | propios | sí | NO | NO | NO | sin fuente verificada |
| `pegar_grain` | `puedeVerOperacion` (`pegar-grain.ts:54`) | sí | propios | sí | NO | NO | NO | sin fuente verificada |
| `corregir_resultado` | `puedeVerOperacion` (`corregir-resultado.ts:57`) | sí | propios | sí | NO | NO | NO | sin fuente verificada |
| `marcar_confirmacion` | `puedeVerOperacion` (`marcar-confirmacion.ts:51`) | sí | propios | sí | NO | NO | NO | sin fuente verificada |
| `registrar_abono` | `puedeVerOperacion` (`registrar-abono.ts:61`); exige URL de comprobante (`:22`) | sí | propios | sí | NO | NO | NO | sin fuente verificada |
| `cambiar_plataforma_de_abono` | `puedeVerOperacion` (`cambiar-plataforma-de-abono.ts:51`) | sí | propios | sí | NO | NO | NO | sin fuente verificada |
| `anular_deal` | `puedeVerOperacion` (`anular-deal.ts:40`) | sí | propios | sí | NO | NO | NO | no (`anular-deal.ts:59`) |
| `anular_abono` | `puedeVerOperacion` (`anular-abono.ts:58`) | sí | propios | sí | NO | NO | NO | no (`anular-abono.ts:86`) |
| `anular_llamada` | `puedeVerOperacion` (`anular-llamada.ts:53`) | sí | propios | sí | NO | NO | NO | no (`anular-llamada.ts:84`) |
| `marcar_fallida` | `puedeVerOperacion` (`marcar-fallida.ts:60`) | sí | propios | sí | NO | NO | NO | sin fuente verificada |
| `asignar_llamada_suelta` | `puedeVerOperacion` (`asignar-llamada-suelta.ts:49`) | sí | propios | sí | NO | NO | NO | sin fuente verificada |
| `reasignar_deal` | `esAdministrador` (`reasignar-deal.ts:38` → `roles.ts:97`) | SÍ | NO (ADR 0134) | SÍ | NO | NO | NO | sí (`reasignar-deal.ts:80`) |

"propios" significa: la acción hereda `puedeTrabajarDeal` (`lib/deals/permiso.ts:19`) si la función compartida de la
pantalla lo aplica. Esa herencia por acción es justo lo que el ticket 386 pide probar forjando la petición; aquí queda
como "sin fuente verificada por acción" salvo `reasignar_deal`, que se corta en `puede`. El `ActorDeMovimiento` con rol y
`operaComoCloser` sí viaja a cada función (`acciones.ts:56-64`).

### 1.4 Lo que sale de la matriz

- customer_success tiene 4 herramientas de lectura (`programas_visibles`, `capacidades`, `ficha_de_lead`, `cartera_vencida`) y ninguna acción.
- media tiene 2 (`programas_visibles`, `capacidades`) y ninguna acción.
- paid_trafficker tiene 10 de lectura (9 si no hay conexión de SQL) y ninguna acción.
- Ninguna herramienta es huérfana: las 19 están en un `HERRAMIENTAS` exhaustivo y 14 acciones en `ACCIONES`.
- El closer no ve `resumen_del_hub` ni `consultar_hechos` (el tablero ya no es suyo, `roles.ts:240-244`), así que para cifras propias solo tiene `consultar_metrica` limitada a `no_agendaron`, y `bandeja`, `tablero_de_deals`, `buscar`.

## 2. Matriz rol × requerimiento de negocio × tool

El ticket 386 enumera cinco roles (closer, gerente, paid trafficker, customer success, developer; `docs/tasks/386-...md:17-19`) y no menciona a `media`, que sí existe en `ROLES` (`roles.ts:8-15`). Los requerimientos
vienen de tres fuentes: lo que el 386 dice que cada rol "necesita hacer", las capacidades que declara `roles.ts` por rol, y las rutas de la app
(`app/(app)/...`). El 386 no los lista uno por uno: el listado de abajo es una derivación mía, para que Mani lo corrija (pregunta 1).

### closer (propios deals, programas con membresía)

| Requerimiento | Tool que lo cubre |
|---|---|
| Ver qué tiene pendiente hoy | `bandeja` |
| Ver su pipeline y filtrarlo | `tablero_de_deals`, `opciones_de_filtros` |
| Encontrar una persona y su historia | `buscar`, `buscar_leads`, `ficha_de_lead`, `ficha_de_deal` |
| Mover un deal de etapa | `preparar_accion` + `confirmar_cambio` (`mover_etapa`) |
| Marcar show, confirmación, fallida, corregir resultado | `marcar_show`, `marcar_confirmacion`, `marcar_fallida`, `corregir_resultado` |
| Pegar la grabación (Grain) | `pegar_grain` |
| Registrar un abono (con URL de comprobante) | `registrar_abono`, `cambiar_plataforma_de_abono` |
| Anular un deal, abono o llamada | `anular_deal`, `anular_abono`, `anular_llamada` |
| Asignar una llamada suelta | `asignar_llamada_suelta` |
| Deshacer lo que hizo | `deshacer_evento` |
| Ver sus ventas y comisión del periodo | falta (`resumen_del_hub` y `consultar_hechos` no son del closer; `consultar_metrica` solo da `no_agendaron`) |
| Ver cartera vencida de sus estudiantes | `cartera_vencida` |
| Registrar una actividad, anotar, editar acuerdo de pago | falta (pendiente en `cobertura.ts:106,104,103`) |
| Reclamar un deal sin dueño | falta (`cobertura.ts:167`) |
| Agendar o reagendar llamada | falta (`cobertura.ts:127,123`) |
| Crear un deal o persona a mano | falta (`cobertura.ts:70,165`) |
| Ceder su deal a otro closer | falta y fuera de alcance por decisión (ADR 0134; la app tampoco lo permite) |
| Adjuntar comprobante como archivo | falta (`pedirSubida...`, `cobertura.ts:108,112`); el MCP solo acepta URL |

### gerente

| Requerimiento | Tool que lo cubre |
|---|---|
| Cifras del programa y del periodo | `resumen_del_hub`, `consultar_metrica` |
| Cualquier conteo o lista por dimensiones | `consultar_hechos` |
| Explorar con SQL | `definiciones_de_metricas`, `consultar_datos` |
| Rendimiento de pauta y origen | `pauta_roas`, `origen_del_programa` |
| Ver todo el pipeline y la bandeja del equipo | `tablero_de_deals`, `bandeja`, `buscar` |
| Cartera vencida | `cartera_vencida` |
| Todo lo que hace un closer, sobre cualquier deal | las 13 acciones de operación |
| Reasignar un deal a otro closer | `reasignar_deal` |
| Administrar programa, SKUs, fuentes, catálogos, plataformas, objetivos | falta, 62 acciones de configuración pendientes (sección 3) |

### developer

Acceso total (`esAccesoTotal`, `roles.ts:71`): cubre lo mismo que gerente más lo que otras guardas le abran. Requerimiento propio del developer: emitir un token personal (`puedeCrearTokenPersonal`, `roles.ts:81`), que queda fuera del MCP por diseño (consentimiento OAuth, `cobertura.ts:20-21`).

### paid_trafficker

| Requerimiento | Tool que lo cubre |
|---|---|
| Cifras del tablero | `resumen_del_hub` |
| Listas de pauta, origen y embudo comercial | `consultar_metrica` (limitado) |
| Hechos por dimensión (sin equipo) | `consultar_hechos` |
| ROAS y origen | `pauta_roas`, `origen_del_programa` |
| SQL de solo lectura | `definiciones_de_metricas`, `consultar_datos` |
| Configurar Canales, Meta, objetivos de pauta | falta (`guardarObjetivoAccion`, `vincularCuentaMetaAccion` y otras, `cobertura.ts:64-66,72-74`) |

### customer_success

| Requerimiento | Tool que lo cubre |
|---|---|
| Ver Students y cartera vencida | `cartera_vencida` |
| Ver los datos básicos de un lead | `ficha_de_lead` |
| Marcar y desmarcar el onboarding (su única acción en la app, `roles.ts:293-308`) | falta (`marcarOnboardedAccion`, `desmarcarOnboardedAccion`, `cobertura.ts:115,117`); sin ninguna acción, el rol no puede escribir |
| Recibir avisos de estudiantes nuevos | fuera del MCP (WhatsApp, `roles.ts:311`), sin fuente verificada de que deba estar |

### media

| Requerimiento | Tool que lo cubre |
|---|---|
| Trabajar contenido: banco, piezas, insights (`trabajaContenido`, `roles.ts:345`) | falta toda la vista: 8 acciones de escritura pendientes (`cobertura.ts:23-30`) y ninguna lectura de contenido |
| Ver programas | `programas_visibles` |

media no está en el ticket 386 (pregunta 2).

## 3. Acciones de la app con clase "pendiente" en `cobertura.ts`

Conteo derivado con `grep` sobre `lib/mcp/cobertura.ts`: **102 entradas** con `clase: "pendiente"`, no ~37.
La diferencia: el brief hablaba de ~37 de operación (+8 de SKU y líneas). Lo que hay es:

| Grupo | Total | En curso H1 (SKU y líneas) | Por priorizar |
|---|---|---|---|
| operacion | 36 | 4 (asignarSku, editarValorLinea, quitarLinea, anularLinea) | 32 |
| configuracion | 66 | 4 (crearSku, editarSku, desactivarSku, reactivarSku) | 62 |
| Total | 102 | 8 | 94 |

Las 8 de H1 están en `cobertura.ts:87-90` y `:96-99`. Hay capacidades duplicadas en la app que cuentan como entradas
separadas por archivo: `completarAgendadaAccion` (deals y bandeja), `confirmarCorreo` y `separarCorreo` (deals y leads),
`asignarMiCalendlyAccion` (perfil y mi-espacio). Contadas por capacidad distinta, las de operación bajan de 32 a 28.

Quién puede hacerlas en la app (guardas de los archivos de acciones): casi todas las de deal usan `requireRole("gerente", "closer")` con
`puedeTrabajarDeal` (`app/(app)/p/[programa]/deals/[id]/acciones.ts:66-70`); onboarding añade customer_success (`:119`);
`crearPersonaAccion` es solo closer (`mi-dia/acciones.ts:80`); reasignar es administrador (`inbox/acciones.ts:180`).

Criterio de prioridad: frecuencia esperada para closers y gerencia, riesgo de la escritura, y dependencia
(si desbloquea un flujo ya expuesto o a un rol sin tool). **No hay datos de frecuencia real en el repo**: la frecuencia es
inferencia a partir del flujo (sin fuente verificada); la medición real se haría con `change_log` por acción.

### 3.1 Operación, prioridad alta (5)

| Acción | Argumento en una línea |
|---|---|
| `registrarActividadAccion` (`cobertura.ts:106`) | Es el registro diario del closer sobre un deal; sin él, el MCP mueve etapas pero no deja la actividad que la ficha y la bandeja miden. |
| `reclamarDealAccion` (`:167`) | Un deal sin dueño solo lo puede trabajar quien lo reclama (`permiso.ts:9`) y reasignar es de administrador (ADR 0134), así que sin esto el closer no puede iniciar su trabajo por el MCP. |
| `marcarOnboardedAccion` (`:115`) | Es la única acción de customer_success y hoy ese rol no tiene ninguna escritura; desbloquea un rol completo con riesgo bajo y reversible (`desmarcarOnboardedAccion`, `:117`). |
| `anotarAccion` (`:104`) | Frecuente, riesgo mínimo (agrega una línea al historial) y ya pasa por `anotar` central con rastro (`deals/[id]/acciones.ts:401-402`). |
| `completarAgendadaAccion` de la bandeja (`:170`; también `:119` en la ficha) | La bandeja ya se lee por MCP y "agendados sin dueño/incompletos" es su pendiente más típico; hoy se ve pero no se puede resolver. |

### 3.2 Operación, prioridad media (13)

| Acción | Argumento |
|---|---|
| `editarAcuerdoAccion` (`:103`) | El acuerdo de pago condiciona `fecha_limite_pago` y cartera, pero `mover_etapa` ya acepta `acuerdo_pago` y `fecha_limite_pago` (`mover-etapa.ts:17-18`), así que parte del caso está cubierto. |
| `marcarLinkEnviadoAccion` (`:102`) | Paso frecuente del embudo de pago; riesgo bajo; depende de que exista el enlace de pago (configuración). |
| `pegarComprobanteAccion` (`:111`) | Completa `registrar_abono`, que ya exige URL de comprobante (`registrar-abono.ts:22`); solo cubre el caso de comprobante tardío. |
| `confirmarComprobanteAccion` (`:113`) | Cierra la revisión de un abono; mueve dinero reconocido, por eso no es alta. |
| `descartarLlamadaSueltaAccion` (`:172`) | Es el par de `asignar_llamada_suelta`, ya expuesto; frecuencia media, no se deshace por construcción (sin fuente verificada). |
| `crearDealDesdeSueltaAccion` (`:173`) | Otro par de la llamada suelta; crea registros, riesgo medio por dedup (regla de correo). |
| `asignarCompraAccion` (`:176`) | Empareja una compra de pasarela con un lead; toca caja, riesgo medio, baja frecuencia. |
| `reclamarTodosPorSettearAccion` (`:168`) | Lote de reclamos; útil para gerente, riesgo medio por masivo; depende de `reclamarDealAccion`. |
| `cambiarCohorteAccion` (`:118`) | Afecta cohorte y fechas de un estudiante (devuelve `fechaLimiteAjustada`, `deals/[id]/acciones.ts:655`); riesgo medio. |
| `proximaCohorteAccion` (`:105`) y `asignarProximaCohorteAccion` (`:33`, en lote) | Cambian la meta de la cohorte vía asignación; frecuencia estacional (cierre de cohorte). |
| `editarDealAccion` (`:94`) | Edita dueño y datos comerciales; el dueño ya se cubre con `reasignar_deal` (`reasignar-deal.ts:25` llama `editarDeal`). |
| `marcarCortesiaAccion` (`:116`) | Cambia el tratamiento de una venta (cortesía); afecta métricas de caja y ventas separadas. |
| `desmarcarOnboardedAccion` (`:117`) | Va con `marcarOnboardedAccion`; se priorizan juntas en el mismo PR. |

### 3.3 Operación, prioridad baja (10)

| Acción | Argumento |
|---|---|
| `agendarLlamadaAccion` (`:127`) | Efecto externo en Calendly (crea cita); alto riesgo y requiere disponibilidad (`horasDisponiblesAccion`, `:126`, sin herramienta); mejor decidirlo antes. |
| `reagendarLlamadaAccion` (`:123`) | Igual: efecto externo y cancelación pendiente (`deals/[id]/acciones.ts:735`). |
| `crearDeal` (`:70`) y `crearPersonaAccion` (`:165`) | Los leads entran por webhook (`restricciones.md#fuentes-de-verdad`); la creación manual es excepcional y toca dedup. |
| `confirmarCorreoAccion` (`:160`) y `confirmarCorreoDesdeDealAccion` (`:100`) | Decisión de identidad de una persona; baja frecuencia y no se deshace limpio. |
| `separarCorreoAccion` (`:161`) y `separarCorreoDesdeDealAccion` (`:101`) | Igual, riesgo de partir una persona. |
| `pedirSubidaParaAbonoAccion` (`:108`) y `pedirSubidaComprobanteAccion` (`:112`) | Preparan subida de archivo; el MCP solo trabaja con URL (`registrar-abono.ts:13`), son del flujo del navegador. |
| `marcarNovedadCalendlyVistaAccion` (`:184`) y `abrirNovedadCalendlyAccion` (`:185`) | Son del espacio personal de la app, no del trabajo con el deal. |

Cuadre por entradas de `cobertura.ts`: alta 6 (5 acciones; `completarAgendadaAccion` tiene dos entradas) + media 14 (13 filas;
`proximaCohorte` y `asignarProximaCohorte` comparten fila) + baja 12 (10 filas con pares) = 32, igual a "por priorizar" arriba.

### 3.4 Configuración (62 por priorizar, no operación)

El pedido fue priorizar las de operación; la configuración queda por familia (agrupada por archivo de acciones, suma 66; 62 sin las 4 de SKU de H1).
Quién las hace en la app: administrador (`configuraPrograma`, `roles.ts:271`) salvo objetivos de pauta (`editaObjetivo`, `roles.ts:289`) y media; la guarda exacta por archivo: sin fuente verificada.

| Familia (archivo) | Entradas | Prioridad | Argumento |
|---|---|---|---|
| Media: creadores, tipos, piezas, enlaces (`media/acciones.ts`) | 8 | media | Es la única vía de escritura de `media`; sin ella el rol no tiene nada que hacer en el MCP. |
| Objetivos del programa (`acciones-objetivos.ts`) | 3 | media | Los toca gerencia cada periodo y paid trafficker en pauta; riesgo bajo. |
| Umbrales (`acciones-umbrales.ts`) | 1 | media | El 465 ya los hereda entre ciclos (ADR 0141); falta editarlos. |
| Programa, cohortes y setter (`acciones-programa.ts`) | 12 (8 sin H1) | media | Baja frecuencia, alto impacto sobre todo el programa. |
| Fuentes y mapeo (`acciones-fuentes.ts`) | 6 | baja | Tocan el ingreso de leads; un mapeo malo falla ruidoso (`MapeoInvalidoError`). |
| Plataformas y enlaces de pago (`programa/acciones.ts` y una en la ficha del deal) | 7 | baja | Tocan caja; son configuración de arranque. |
| Integraciones y reporte WhatsApp (`acciones-integraciones.ts`, `acciones-reporte-whatsapp.ts`) | 6 | baja | Secretos y efectos externos; mejor en la app (`restricciones.md#secretos`). |
| Cuentas de Meta (`acciones-meta.ts`) | 3 | baja | Igual: secretos y efecto externo. |
| Catálogos globales (`ajustes/catalogos/acciones.ts`) | 9 | baja | Un valor malo contamina todo; el rastro con actor es obligatorio (`restricciones.md#catalogo-por-molde`). |
| Calendly y perfil (`acciones-calendly.ts`, `ajustes/usuarios`, `perfil`, `mi-espacio`) | 6 | baja | Pertenecen al perfil de cada persona. |
| Recursos del programa (`recursos/acciones.ts`) | 4 | baja | Archivos; poco frecuentes. |
| Reprocesar entregas (`ajustes/salud/acciones.ts`) | 1 | baja | Soporte técnico. |

## 4. Preguntas abiertas para Mani

1. ¿Los requerimientos de la sección 2 son los que quieres por rol? El 386 pide la matriz "revisada con Mani" y no los enumera.
2. ¿`media` entra al alcance del 386? Hoy no está en el ticket y su única vía de escritura es la vista de contenido.
3. ¿Cuenta cada entrada de `cobertura.ts` o cada capacidad distinta? Son 32 contra 28 de operación (duplicados entre pantallas).
4. ¿Qué closers necesitan ver sus propias cifras (ventas, comisión) por el MCP? Hoy no tienen `resumen_del_hub` ni `consultar_hechos`; solo `consultar_metrica` con `no_agendaron`. Es el hueco más grande del closer en lectura.
5. ¿customer_success necesita al menos la acción de onboarding en este ciclo? Hoy puede leer pero no escribir.
6. ¿`operaComoCloser` debe abrir las herramientas de operación a un customer_success o paid_trafficker? Las herramientas piden `puedeVerOperacion` (por rol), no `trabajaLeads` (por capacidad); la app sí respeta la bandeja (ADR 0084).
7. ¿Se mide la frecuencia real con `change_log` antes de fijar las 5 altas? La prioridad actual es inferencia.
8. ¿Agendar y reagendar en Calendly entran al MCP o quedan en la app por el efecto externo (como OAuth y secretos)?
9. ¿La carga de comprobantes como archivo se queda en la app y el MCP solo acepta URL (`registrar-abono.ts:13`)? Es decisión de producto, no de código.
10. ¿La lectura de `ficha_de_lead` para customer_success debe aplicar el recorte `veSoloLoBasicoDelLead` también en el MCP? El adaptador pasa el rol (`operacion.ts:153`); no pude verificar que recorte.
