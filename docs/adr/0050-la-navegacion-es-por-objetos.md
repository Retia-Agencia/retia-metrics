# 0050 — La navegación es por objetos: tabs tipo HubSpot, un selector de programa, Inbox y Dashboard

**Fecha:** 2026-09-24 · **Estado:** aceptado (Mani) en la forma; el contenido de cada pantalla se
valida con los closers · **Implementación:** tickets 095, 097, 098, 099, 100 y las enmiendas de 069 a
074 · **Enmienda:** plan v2 §6 etapa 6 · **Aplica:** ADR 0023 (el filtro vive en la URL), ADR 0048
(alcance y agregado) · **Origen:** `docs/auditorias/propuesta-crm-y-reunion-comercial-2026-09-24.md` §3.5

## El problema

La barra de hoy nació ticket por ticket sobre el modelo viejo: "Mi día" (hoy vacío, con un aviso de
"llega en la fase 6"), un ítem por programa que abre su dashboard, Personas, Productos, Recursos,
Ajustes y Nerd Stats. Mani:

- *"Quiero replicar como lo hacen en HubSpot: tab Leads, Deals, Students, Programs, Products, Calls,
  Resources."*
- *"No me gusta lo de Mi día; se puede reemplazar por un Inbox"* donde caen los deals sin dueño, lo que
  hay que atender y las llamadas de Calendly que no están colgadas de ningún deal.
- *"La sección de Programas no me gusta; quiero una tab Dashboard donde se pueda filtrar por programa
  o ver el agregado."*

## Decidimos

**1. Una tab por objeto del modelo, a la izquierda:** Inbox · Dashboard · Leads · Deals · Calls ·
Students · Campañas · Programs · Products · Resources · Ajustes · Nerd Stats (solo developer). La UI
espeja el modelo de datos, que es el principio que Mani ya había escrito en `docs/design.md` §4.

**2. Un selector de programa arriba de la barra.** Toda tab trabaja sobre el programa elegido (ADR
0048: las listas son de un programa). El selector solo ofrece los programas que la sesión puede ver.
El Dashboard además ofrece "todos los programas", donde solo aparecen las cifras sumables.

**3. "Mi día" se reemplaza por Inbox**, y el dashboard por programa se reemplaza por la tab Dashboard.

**4. Las asociaciones se navegan, no se memorizan.** La ficha de un registro muestra sus registros
asociados (la de un Deal: su Lead, Calls, Abonos, Cuotas e historial) y cada tarjeta lleva a su lista
ya filtrada. **Los filtros viven en la URL** (ADR 0023), así que un filtro se comparte con un link.
Las vistas guardadas entran cuando alguien se queje de rearmar el mismo filtro (spec §2).

**5. El rol decide qué tabs aparecen, y el servidor decide qué se puede hacer en cada una.** Esconder
una tab no es seguridad; cada ruta conserva su guarda. La matriz rol × tab está en el documento de
origen §3.5 y se valida con los closers.

## Qué cae en el Inbox 🟡 (propuesta, se valida en la reunión)

1. Deals sin dueño: Pendiente Setteo nuevos, y Agendados cuyo host no está registrado en el programa.
2. Llamadas sueltas (ADR 0049).
3. Lo del closer que necesita atención: llamada de hoy sin resultado, Re-agenda sin nueva fecha,
   Compromiso Verbal con fecha vencida, cuota vencida, deal sin actividad en X días (X por definir),
   un lead con deal abierto que volvió a llenar el formulario.
4. Para el gerente: lo mismo de todo el equipo, más los leads "unidos por teléfono" para revisar.

## Consecuencias

- Los tickets 070 (Pendiente Setteo y Unclaimed) y 071 (Mis deals) **se funden en el Inbox**.
- El 069 (Kanban) pasa a ser la vista tablero de la tab Deals; el 072 (base de Leads) es la tab Leads.
- Nacen las tabs Calls (098), Students (099) y Programs (100), y la navegación con selector (097).
- `docs/design-system.md` gana el selector de programa dentro del marco.
- `rutaInicial` cambia: el closer aterriza en Inbox; gerente y developer, en Dashboard.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Un ítem por programa en la barra (lo de hoy) | Con N programas la barra crece por dato, y cada programa repite las mismas pantallas |
| Programa como filtro dentro de cada lista, sin selector | Invita a listas que cruzan programas, que el ADR 0048 prohíbe |
| Conservar "Mi día" junto al Inbox | Dos pantallas de inicio que responden lo mismo |
