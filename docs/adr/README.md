# Decisiones de arquitectura (ADR)

Cada archivo `NNNN-slug.md` es **una** decisión difícil de revertir: el contexto, lo que se decidió y
por qué. Se escribe un ADR solo si se cumplen las tres: es difícil de revertir, sorprendería a quien
llegue después, y hubo alternativas reales. `/grill-with-docs` y `/improve-codebase` los proponen en
el momento justo. Un ADR nuevo toma el **siguiente número libre (hoy 0073)**; los números retirados
no se reutilizan, porque el código los cita.

**27-sep-2026: la carpeta se depuró.** Quedan solo los ADR que describen lo que está confirmado para
construir, **reescritos** para decir la decisión vigente sin capas de enmiendas. Los que ya no
aplicaban se retiraron: su texto sigue en git (`git show da68cdf:docs/adr/<archivo>`) y la tabla de
abajo dice dónde quedó lo que seguía vivo de cada uno. El código cita muchos de esos números en
comentarios; esta tabla es la que los resuelve.

## Vigentes

**Datos e identidad**

| # | Decisión |
|---|---|
| [0004](./0004-el-formulario-es-la-fuente-del-lead.md) | El formulario es la fuente del lead, y lo que manda una fuente se guarda como llegó |
| [0005](./0005-dedup-garantizado-por-la-base.md) | Las garantías viven en la base: índices únicos y parciales, no solo código |
| [0035](./0035-el-lead-y-sus-contactos.md) | El Lead es una persona en un programa; el correo manda y el teléfono une y marca |
| [0036](./0036-el-envio-y-todas-las-columnas-sin-plantilla.md) | El Envío guarda todas las columnas; las promovidas no se repiten |
| [0039](./0039-un-programa-una-fuente-de-leads.md) | Un programa, una fuente de leads activa (**el punto 2 lo enmienda el 0064**) |
| [0064](./0064-un-programa-puede-tener-varios-formularios-activos.md) | Un programa puede tener varios formularios activos a la vez (migrar de proveedor sin perder envíos) |
| [0068](./0068-el-link-de-captacion-sale-de-la-fuente.md) | El link de captación sale de la fuente, con una principal por programa (`programs.form_url` se retira) |
| [0069](./0069-la-etapa-de-entrada-la-decide-el-crm.md) | La etapa de entrada la decide el CRM con la agenda y la calidad; el formulario ya no manda `estado` (reemplaza al 0061) |
| [0061](./0061-el-estado-de-llegada-se-mapea-por-una-tabla.md) | El Estado de llegada lo manda el formulario y una tabla por programa lo lleva a su etapa (reemplaza el 0054) |
| [0055](./0055-el-webhook-estandar-de-formularios.md) | Un webhook estándar para cualquier formulario; el programa sale de la URL |
| [0056](./0056-el-motor-decide-quien-mueve-con-que-motivo-y-datos.md) | El motor decide quién mueve, con qué motivo (cuatro listas) y con qué datos (**el punto 1 lo enmienda el 0070: la cohorte se muda al retomar**) |
| [0057](./0057-el-programa-lleva-su-formulario-y-su-token-de-calendly.md) | El programa lleva su formulario y su token de Calendly (segundo secreto en la base) |
| [0058](./0058-el-webhook-no-pierde-nada.md) | El webhook no pierde nada: caja negra, variables genéricas, un solo mapeo, nombre del lead, re-agenda |
| [0059](./0059-el-deal-historico-nace-en-su-etapa.md) | El deal histórico nace en su etapa, por un template y con su huella (migración de las pestañas de gestión) |
| [0043](./0043-el-area-agrupa-y-el-programa-es-frontera.md) | El Área agrupa por origen; el Programa es frontera, no filtro |

**El deal y la operación**

| # | Decisión |
|---|---|
| [0037](./0037-el-deal-y-las-once-etapas.md) | El Deal es el objeto central, con once etapas y un solo motor que las mueve (**el punto 2 lo reemplaza el 0065; el Grain como requisito lo enmienda el 0066; las etapas 3, 9 y 11 las reemplaza el 0070**) |
| [0070](./0070-re-agenda-seguimiento-y-proxima-cohorte-son-pendientes-del-deal.md) | Re-agenda, Seguimiento y Próxima Cohorte son pendientes del deal, no etapas: el deal se queda en su etapa y el motor escribe los dos |
| [0071](./0071-como-se-mueve-un-deal-por-las-etapas-de-30x.md) | Cómo se mueve un deal por las etapas de 30X: primera actividad → En gestión, contacto → Contactado, los tres intentos alertan y no cierran, cortesía = 100% de descuento con marca (**enmienda el punto 7 del 0059**) |
| [0073](./0073-un-reenvio-sube-el-deal-a-su-mejor-etapa-de-entrada.md) | Un reenvío sube el deal abierto que sigue en una puerta a la etapa de entrada de su mejor envío (S1 a S3, solo hacia arriba); el CRM avisa cuando un lead tiene dos o más envíos |
| [0074](./0074-lo-propio-del-closer-lo-edita-el-closer.md) | Lo propio del closer (su cuenta de Calendly por programa) lo edita el closer; rol, membresías y `closer_id` siguen siendo de quien administra |
| [0075](./0075-la-ficha-se-opera-por-etapa-destino.md) | El deal se mueve con botones de etapa destino (ficha y Kanban, un solo pop-up), las alertas son su recuadro, el comprobante no bloquea (alerta roja) y el closer ve solo sus deals |
| [0076](./0076-el-setter-entrega-el-deal-al-closer-por-la-cita.md) | El setter entrega el deal al closer por la cita: handoff sin soltar el deal (alerta a 1 hábil), crédito en `deals.setter_user_id`, cuatro caminos de una llamada con su llave, y una suelta solo la cuelga su host |
| [0077](./0077-cada-dato-vive-en-la-pantalla-de-su-objeto.md) | Cada dato vive en la pantalla de su objeto (Programa, Perfil, Deal, Lead) y lo que no se usa se quita; la llamada siempre tiene closer; los canales los crea quien `manejaPauta`; tres franjas en la ficha |
| [0078](./0078-corregir-el-ultimo-movimiento.md) | Corregir deshace el último movimiento humano, restaura su pendiente y exige motivo de corrección |
| [0072](./0072-una-pregunta-por-etapa-mueve-el-deal.md) | Una pregunta por etapa mueve el deal, también al arrastrar el Kanban (muestra lo que tiene y le falta); solo alertas, nada automatizado en v1; Lead Value ordena la cola |
| [0066](./0066-atendido-sin-grain-es-una-alarma.md) | Atendido sin Grain se acepta, cuenta como show y prende una alarma derivada |
| [0015](./0015-resultado-de-llamada-ampliado.md) | La llamada dice qué pasó (ocho resultados); el motor decide qué significa |
| [0049](./0049-calendly-cuelga-llamadas-de-deals.md) | Calendly cuelga cada llamada de su deal; si hay duda, la llamada queda suelta |
| [0026](./0026-anular-registros-y-borrar-del-catalogo.md) | Un registro se anula, no se borra; del catálogo se borra solo lo que nunca se usó |
| [0038](./0038-anular-no-es-cierre-perdido.md) | Anular no es Cierre Perdido |
| [0042](./0042-todo-movimiento-del-crm-deja-rastro.md) | Todo movimiento del CRM deja rastro, desde el primer día |
| [0059](./0059-el-deal-historico-nace-en-su-etapa.md) | El deal histórico nace en su etapa, por un template y con su huella |
| [0060](./0060-el-origen-es-del-envio-y-la-venta-hereda-el-del-envio-que-abrio-el-deal.md) | El origen es del envío; la venta hereda el del envío que abrió su deal (cierra D5) |
| [0022](./0022-ventana-de-venta-de-la-cohorte-es-dato-por-cohorte.md) | La ventana de venta es dato de cada cohorte |
| [0023](./0023-metricas-por-closer-sin-meta-individual.md) | Las métricas por closer salen de las mismas consultas, y la meta no se reparte |

**El dinero y los catálogos**

| # | Decisión |
|---|---|
| [0013](./0013-abonos-separados-de-ventas.md) | Caja y ventas son dos métricas: cada pago es una fila |
| [0053](./0053-el-acuerdo-de-pago-es-nota-y-fecha-limite.md) | El acuerdo de pago es una nota y una fecha límite, no cuotas |
| [0024](./0024-una-sola-definicion-del-dinero-derivado.md) | Una sola definición por pregunta, empezando por el dinero derivado |
| [0012](./0012-contrato-de-extension-instancias-en-base-tipos-en-codigo.md) | Contrato de extensión: instancias en la base, tipos en el código |
| [0029](./0029-una-fila-de-catalogo-se-crea-por-el-molde-tambien-desde-un-script.md) | Una fila de catálogo se crea por el molde, también desde un script |
| [0065](./0065-el-valor-vendido-lo-escribe-el-closer.md) | El valor vendido lo escribe el closer; el ticket base es de la cohorte y la comisión es un porcentaje congelado |
| [0016](./0016-productos-por-programa-los-gestionan-gerentes-y-closers.md) | Los productos de cada programa los gestionan gerentes y closers (**lo del precio lo reemplaza el 0065: `productos` se retira; recursos y plataformas siguen**) |
| [0034](./0034-una-plataforma-de-pago-sirve-a-programas.md) | Una plataforma de pago sirve a programas, por tabla puente |
| [0017](./0017-recursos-solo-como-links.md) | Los recursos son links; el comprobante de un abono puede ser foto |

**Origen y atribución**

| # | Decisión |
|---|---|
| [0051](./0051-la-convencion-de-utm-y-el-builder.md) | La convención de UTM y el builder: el CRM genera los links |
| [0045](./0045-la-campana-y-el-patron-utm.md) | La campaña es una entidad y el emparejamiento es determinista |
| [0044](./0044-el-origen-humano-de-un-lead.md) | El origen humano de un lead: el link del closer y `traido_por` |
| [0062](./0062-el-anuncio-es-la-llave-de-la-pauta.md) | El anuncio es la llave de la pauta: UTM de Meta con macros, gasto por su API y origen declarado aparte (enmienda 0045, 0051 y 0052) |
| [0063](./0063-las-metricas-y-los-objetivos-de-pauta.md) | Las métricas y los objetivos de Pauta: registro por token, calificada por `lead_value`, ROAS sobre contratado, metas por área |

**Roles y acceso**

| # | Decisión |
|---|---|
| [0003](./0003-roles-sin-herencia.md) | Los roles no heredan: gerente y closer son disjuntos |
| [0025](./0025-developer-es-la-unica-excepcion-a-la-disjuncion.md) | `developer` es la única excepción a la disjunción |
| [0052](./0052-el-cuarto-rol-paid-trafficker.md) | El cuarto rol: Paid Trafficker |
| [0048](./0048-alcance-del-closer-y-agregado-de-lo-sumable.md) | Un closer ve solo sus programas; el agregado suma solo lo sumable |
| [0028](./0028-ver-como-la-vista-estrecha-guarda-y-proyeccion.md) | "Ver como": la vista estrecha la proyección y la guarda |
| [0030](./0030-mani-y-mani-son-el-mismo-closer.md) | La identidad del closer: FK para lo nativo, nombre normalizado para el histórico |
| [0002](./0002-sesiones-jwt-sin-adapter.md) | Sesiones JWT sin adapter de base |

**Pantallas**

| # | Decisión |
|---|---|
| [0050](./0050-la-navegacion-es-por-objetos.md) | La navegación es por objetos, con selector de programa, Inbox y Dashboard |
| [0067](./0067-numero-y-porcentaje-periodo-a-contra-b-y-toda-cifra-abre-su-lista.md) | Número y porcentaje siempre, periodo A contra B al mismo día hábil, y toda cifra abre su lista (resumen primero) |
| [0033](./0033-estructura-por-dominio-y-extracciones-incrementales.md) | Estructura por dominio y extracciones incrementales |

**Plataforma**

| # | Decisión |
|---|---|
| [0047](./0047-la-base-se-muda-a-supabase.md) | La base es Supabase, con `postgres-js` y transacciones de verdad |
| [0020](./0020-tests-de-base-con-pglite-en-memoria.md) | Los tests de base corren contra PGlite en memoria |
| [0006](./0006-dependencias-solo-cuando-hay-codigo.md) | Un paquete no se instala antes del código que lo usa |
| [0001](./0001-npm-en-vez-de-pnpm.md) | npm en vez de pnpm |

## Retirados el 27-sep

| # | Qué decía | Por qué se retiró | Dónde quedó lo vigente |
|---|---|---|---|
| 0000 | Cómo se registran los ADR | Se fundió en este índice | este archivo |
| 0007 | El cron del sync corre una vez al día | El sync de Sheets se retira con el corte directo (T3, 22-sep) | el cron que existe hoy, en `operations.md`; el límite de Vercel Hobby, en `plan.md` §7 |
| 0008 | Sheets deja de ser fuente de llamadas y ventas | Superado: Sheets deja de ser fuente de todo | 0004 y 0037 |
| 0009 | El dashboard abre a los closers lo que el 0003 prohibía | Acotado por el 0048 hasta quedar dentro de él | 0048 |
| 0010 | Los registros nativos reusan `calls` y `sales` | `sales` no existe; las llamadas cuelgan del deal | 0037 y 0015 |
| 0011 | El closer de un registro es texto copiado | Los registros nativos pasan a FK a `users` | 0030 |
| 0014 | "Corte" pasa a llamarse "Cohorte" | Hecho; no queda nada por decidir | vocabulario en `overview.md` |
| 0018 | Producción y desarrollo en ramas de Neon | La base se mudó a Supabase | 0047 |
| 0019 | Plantilla de lead por programa, heredada por fuente | Era del sync de Sheets | 0036 (qué campo es cuál) y 0039 |
| 0021 | El responsable y el alta manual viven en el CRM | El responsable pasó a ser el dueño del deal | 0037 (dueño, reclamo) y 0044 (alta manual, CPL) |
| 0027 | Una venta sabe de qué llamada nació | `sales` no existe; la llamada cuelga del deal | 0037 (la lección: nada de emparejar por heurística) |
| 0031 | Una corrida de sync es de un programa, con candado en la base | El sync de Sheets se retira (T3). El código y su test siguen vivos hasta que se retire (decisión A6 del plan) | el molde del candado por índice parcial, en 0005 |
| 0032 | El estado del lead es una categoría de la hoja | Quién calcula el Estado está abierto (A1 y D4 del plan) | 0004 punto 3 (se guarda como llegó); `plan.md` §7 |
| 0040 | El sync se dispara por capas | El corte directo (T3) deja al webhook como única entrada | el webhook propio, en `plan.md` §4.3a |
| 0041 | Las cuotas pactadas son filas | En v1 no hay cuotas | 0053 (incluye la forma correcta si algún día se cobra por cuota) |
| 0046 | El CRM genera los links; árbol de campaña | El árbol se aplanó y el resto se fundió en la convención de UTM | 0051 |

## Retirados el 29-sep

| # | Qué decía | Por qué se retiró | Dónde quedó lo vigente |
|---|---|---|---|
| 0054 | El Estado de llegada lo pone el formulario (tres valores fijos: descartado, setteo, con calendly) y el CRM lo traduce | El 29-sep una edición del Typeform de Tactical quitó la variable y el CRM dejó de abrir deals en silencio; Mani pidió que los valores y su etapa sean datos y que descartado desaparezca (`docs/analytics.md` §2.4) | 0061. El código lo sigue hasta el ticket 117. Texto: `git show 17cbcd1:docs/adr/0054-el-estado-de-llegada-lo-pone-el-formulario.md` |
