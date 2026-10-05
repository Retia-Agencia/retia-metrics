# 0050 — La navegación es por objetos: tabs tipo HubSpot, un selector de programa, Inbox y Dashboard

**Fecha:** 2026-09-24 · **Reescrito:** 2026-09-27 (el Inbox, con lo que dijeron los closers el 24-sep)
· **Estado:** aceptado en la forma; el contenido de cada pantalla se afina al construirla ·
**Implementación:** tickets 095, 097, 098, 099, 100 y 069 a 074

## El problema

La barra nació ticket por ticket sobre el modelo viejo: "Mi día" (vacío), un ítem por programa que
abre su dashboard, Personas, Productos, Recursos, Ajustes y Nerd Stats. Mani, 24-sep:

- *"Quiero replicar como lo hacen en HubSpot: tab Leads, Deals, Students, Programs, Products, Calls,
  Resources."*
- *"No me gusta lo de Mi día; se puede reemplazar por un Inbox."*
- *"Quiero una tab Dashboard donde se pueda filtrar por programa o ver el agregado."*

## Decidimos

**1. Una tab por objeto del modelo, a la izquierda:** Inbox · Dashboard · Leads · Deals · Calls ·
Students · Campañas · Programs · Products · Resources · Ajustes · Nerd Stats (solo developer). La UI
espeja el modelo de datos.

**2. Un selector de programa arriba de la barra.** Toda tab trabaja sobre el programa elegido (las
listas son de un programa, ADR 0048) y el selector solo ofrece los programas que la sesión puede ver.
El Dashboard además ofrece "todos los programas", con solo lo sumable.

**3. "Mi día" se reemplaza por el Inbox**, y los dashboards por programa por la tab Dashboard. El
closer aterriza en el Inbox; gerente y developer, en el Dashboard.

**4. Las asociaciones se navegan, no se memorizan.** La ficha de un Deal muestra su Lead, sus
llamadas, abonos e historial, y cada tarjeta lleva a su lista ya filtrada. **Los filtros viven en la
URL** (ADR 0023): un filtro se comparte con un link. Las vistas guardadas entran cuando alguien se
queje de rearmar el mismo filtro.

**5. El rol decide qué tabs aparecen; el servidor decide qué se puede hacer en cada una.** Esconder
una tab no es seguridad. La matriz rol × tab está en `docs/structure.md`.

## Qué cae en el Inbox

1. **Deals sin dueño:** Pendiente Setteo nuevos, que se **reclaman** (el primero que lo ve lo toma,
   confirmado por los closers), y Agendados cuyo host no está registrado en el programa. **El Setteo
   viene ordenado**: por banda de ingreso declarado y, dentro de la banda, por recencia del último
   envío (N1 del 24-sep). 🟡 El orden entre los dos criterios es propuesta; 🔴 qué pregunta del
   formulario es el ingreso, en qué moneda y periodo, se configura por fuente y falta confirmarlo.
2. **Llamadas sueltas** que Calendly no pudo colgar de un deal sin duda (ADR 0049).
3. **Lo del closer que necesita atención:** llamada de hoy sin resultado (el dolor número uno de los
   closers es registrar después de varias llamadas seguidas), Re-agenda sin nueva fecha, Compromiso
   Verbal vencido, fecha límite de pago vencida con saldo (ADR 0053), un lead con deal abierto que
   volvió a llenar el formulario, y deal sin actividad en X días (🔴 X sin definir).
4. **Para el gerente:** lo mismo de todo el equipo, más los leads "unidos por teléfono" para revisar.

## Descartado

| Alternativa | Por qué no |
|---|---|
| Un ítem por programa en la barra | Con N programas la barra crece por dato |
| El programa como filtro dentro de cada lista, sin selector | Invita a listas que cruzan programas |
| Conservar "Mi día" junto al Inbox | Dos pantallas de inicio que responden lo mismo |

### Enmienda (5-oct): el último programa abierto

El último programa abierto se recuerda en la cookie `programa_preferido` y se usa solo como fallback
cuando la URL no indica programa. La URL siempre gana, como exige el ADR 0023. Antes de usar la
cookie, el servidor valida el slug contra los programas visibles para la sesión; si no pertenece al
alcance, usa el primer programa visible. La cookie recuerda navegación, nunca concede acceso ni es autoridad.
