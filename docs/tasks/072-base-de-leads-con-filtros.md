---
id: 072
etapa: E6
serves: "plan v2 §6 etapa 6 · tarea E6-4 · insumo §4.3, ADR 0032"
depends: [069]
status: en curso
---

# 072 — La base de Leads: lo que existe y todavia no es una oportunidad

## Objetivo

Ver y filtrar los leads **sin deal**: Descartado, Sin Calificar, parciales, y los que
"desaparecieron de la hoja".

## Por que esta pantalla importa mas de lo que parece

Es donde vive la parte de arriba del embudo, que hoy **esta vacia**: 4.791 de 4.791 leads con el
estado en su valor por defecto. Con el ticket 051, por fin hay algo que mirar. Y los parciales
huerfanos (236 en Tactical) **existen aqui o no existen en ninguna parte**.

## Alcance

- **Dentro:** listado con filtros por estado (**agrupado dinamicamente**, ADR 0032), por rango de
  fechas y por programa.
- **Dentro:** la accion de **combinar dos redacciones** del estado, que es un acto humano guardado
  como dato (`📅 Con Calendly` y `📅 Con Calendly (Juanito)` son el mismo grupo).
- **Dentro:** la lista de **posibles duplicados** (unidos por telefono) con separar / confirmar
  (ticket 050).
- **Dentro:** ningun dato personal en la URL ni en la query string. Los ids son opacos.
- **Fuera:** crear un lead a mano. El alta manual crea **deal** y vive en el Kanban (ADR 0021).

## Done cuando

- [ ] Los filtros reproducen la distribucion real de estados de `dev`.
- [ ] Combinar dos valores deja rastro con quien y cuando.
- [ ] Separar un lead unido por telefono deja dos leads con sus envios intactos.
- [ ] Ningun correo aparece en una URL.

## Kiro

Si, con revision visual.

---

## Enmienda 2026-09-24 (ADR 0050): esta es la tab Leads

Filtros que se suman: canal, área y campaña (ticket 101), y "traído por". Siempre dentro del programa
del selector (ADR 0048).


---

## Enmienda 2026-09-29 (reunión con Pauta, [`docs/analytics.md`](../analytics.md))

- Filtros nuevos: "abandonó el formulario" (token con parcial y sin completa, sin estado: lead sin deal, ADR 0061) y "sin estado" (valor vacío o desconocido). Ninguno abre deal; los dos se ven aquí.

---

## ✅ Construido (30-sep, Alejo)

Medido en producción antes (solo agregados): 68 correos sin confirmar en 65 leads (CA 23, TI 42), 2 de esos leads
con deal y 1 caso donde el envío a mover es origen de un deal; 98% de los leads sin deal (CA 2.491/2.532, TI
2.897/2.933); 187 leads de TI con solo parciales.

**La tab `/p/<programa>/leads`** (`lib/queries/leads.ts`, `app/(app)/p/[programa]/leads/`), tab en la nav. Filtros por
hecho: con o sin deal vigente (un anulado no cuenta), estado (o "sin estado"), abandonó el formulario (TODOS sus
envíos parciales), posible duplicado y fechas de la última aplicación en días de Bogotá. 100 por página. **Sin
búsqueda por texto:** los filtros van en la URL y un correo ahí está prohibido; para buscar está Personas.

**Posibles duplicados: confirmar o separar** (`lib/ingesta/separar.ts`). Decisiones de Alejo, 29-sep:
- **Separar** crea un lead nuevo con ese correo y mueve **los envíos que traen ese correo exacto** (el que lo trajo y
  cualquier otro cuyas respuestas lo contengan, normalizado). Los demás se quedan; el teléfono compartido se queda
  con el lead original. Recalcula los dos resúmenes (`recalcularResumen`, ahora exportado con actor).
- Si un envío a mover **abrió un deal vigente**, 409 con la etapa del deal: lo resuelve una persona.
- Lo hace **quien trabaja el programa** (membresía activa) o quien administra (`exigirAccesoAlPrograma`).
- Todo en una transacción, con su rastro en `change_log` (`origen: app`, el usuario).

Tests: `tests/leads-tab.test.ts`, `tests/separar-correo.test.ts`, `tests/roles.test.ts`. Probado en Postgres real
(base local): los filtros y una separación.

**Fuera, con su razón:**
- *Combinar redacciones del estado:* salía del ADR 0032, **retirado**. Los valores del Estado los mapea la tabla
  `estados_llegada` (ADR 0061, ticket 117).
- *Filtros por canal, área y campaña:* dependen de 083, 084 y 101. *"Traído por":* de `leads.traido_por_user_id`
  (ADR 0044), que no existe todavía. Cada uno se suma aquí cuando exista su dato.

**Falta:** recorrido visual en navegador (claro/oscuro, 390 px, consola; incluye el flujo de separar).

---

## Anotaciones de UI (30-sep, Mani)

Este ticket recoge de [`docs/anotaciones.md`](../anotaciones.md): A-09 (tabla tipo hoja, páginas de 25 o 50, campos crudos del envío), A-11 y A-14 (Leads absorbe la búsqueda y Personas se retira: son el mismo objeto) y A-12 (el duplicado trae al candidato lado a lado). El texto vive allá.


---

## Enmienda 2026-10-01 (norte comercial, lote 1, [`docs/comercial.md`](../comercial.md))

- La lista suma el selector de fecha relativo (creado, último envío) del **141**, que lo construye sobre el 136. Coordinar con Mani antes: el 141 toca archivos de este ticket.
- El "Fuera: crear un lead a mano" sigue: crear un **deal** a mano es el **140** (elige un lead existente o crea el lead con el alta manual del 026).

---

## Recorrido visual (1-oct, sesión 67, Alejo)

Base local (`dev:local`, Tactical local, developer), con clics reales:
- **Filtros contra la base:** todos 124 · con deal 100 · sin deal 24 · Setteo no calificado 53 · Con calendly 48 ·
  Descartado 22 · sin estado 1 (el `estado_local_desconocido` del seed). Cuadran uno a uno con `leads.calificacion`.
- **Separar** (duplicado sembrado a mano en la base local: un segundo envío con otro correo y su contacto sin
  confirmar): el confirmar es en línea, Cancelar lo deshace, "Sí, separar" deja dos leads con un envío cada uno, el
  aviso "Correo separado en un lead nuevo" y una fila en `change_log` (`origen: app`, con usuario). Sin deal pasó a 25.
- **Es la misma persona:** confirma el contacto (`confirmado = true`) y la lista queda vacía con su aviso.
- Selector de fecha (Creado → "Este mes") abre y filtra. Claro y oscuro bien. Consola sin errores en todo el recorrido.
- **Ningún correo en una URL:** 115 enlaces y acciones de la página, ninguno con `@`; la ficha va por id opaco.
- **390 px: NO medido en vivo.** Chrome con la ventana maximizada no se dejó achicar, el zoom no activa el diseño
  móvil y los popups están bloqueados. Por código: el formulario es `grid` de una columna bajo `sm` y cada fila es
  `flex-wrap` con `truncate`. Falta mirarlo en un teléfono o en el modo dispositivo de DevTools (Ctrl+Shift+M).
- Detalle visto: el primer clic tras navegar puede caer antes de hidratar y no hacer nada (pasó una vez con
  "Es la misma persona"); el segundo funciona. No es de esta pantalla.
