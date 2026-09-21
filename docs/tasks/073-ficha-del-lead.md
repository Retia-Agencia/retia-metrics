---
id: 073
etapa: E6
serves: "plan v2 §6 etapa 6 · tarea E6-5 · insumo §2.2 y §4.3"
depends: [072]
status: todo
---

# 073 — Ficha del Lead: todos sus envios, con el diff entre ellos

## Objetivo

Que se pueda ver, de una persona, **todo lo que dijo y cuando lo dijo**. Reemplaza a
`/personas/[id]`.

## Alcance

- **Dentro:** los envios en orden (por `posicion_en_hoja`, no por fecha: los parciales llevan
  fecha placeholder), con **el diff entre uno y el siguiente**. 🎯 Ahi es donde se ve "en julio
  decia que ganaba X y en septiembre Y", que es informacion comercial de verdad y hoy no existe.
- **Dentro:** los contactos (correos y telefonos) con **de que envio llego cada uno**.
- **Dentro:** los deals abiertos y **los cerrados**: reaplicar abre deal nuevo y los anteriores se
  ven (ADR 0037).
- **Dentro:** las respuestas no promovidas del `jsonb`, legibles, con su encabezado.
- **Dentro:** la marca "unido por telefono" y la de "desaparecio de la hoja", visibles.
- **Fuera:** editar el lead a mano. Lo que viene de la hoja lo manda la hoja (ADR 0004).

## Done cuando

- [ ] Un lead con tres envios muestra los tres y las diferencias entre ellos.
- [ ] Una columna que no existia en el envio viejo se ve como "no habia", no como vacia.
- [ ] Los deals cerrados se ven sin tener que buscarlos.
- [ ] Recorrido visual con clic en todo lo que se abre.

## Kiro

Si, con revision visual.
