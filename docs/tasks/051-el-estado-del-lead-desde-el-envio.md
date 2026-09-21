---
id: 051
etapa: E3
serves: "plan v2 §6 etapa 3 · tarea E3-4 · ADR 0032 (cierra F-01), insumo §2.2"
depends: [049, 050]
status: todo
---

# 051 — `lead.estado` sale del envio completo mas reciente **por posicion en la hoja**

## Objetivo

Cerrar **F-01**, abierta desde agosto: el sync lee la columna `estado` y la descarta. Ahora la
guarda, tal cual viene.

## Las reglas

- Se guarda **como viene**, sin traduccion, sin enum, sin lista de valores conocidos (ADR 0032).
- El estado del Lead es el del **envio completo mas reciente POR POSICION en la hoja**, no por
  fecha: 🩸 los parciales llevan fecha placeholder `1/1/0001` y no sirven para ordenar.
- **`estado` vacio = "Sin Calificar":** el Lead existe y no tiene deal. Cuando un sync traiga el
  valor, se actualiza y se aplica la regla de deals (ticket 052).
- El **agrupamiento es dinamico**: se lee que valores existen y se agrupa por ellos. Una categoria
  nueva aparece sola, sin migracion y sin desplegar.
- **Combinar dos redacciones es un acto humano guardado como dato.** 🎯 El caso ya existe:
  `📅 Con Calendly` y `📅 Con Calendly (Juanito)` son la misma categoria en dos programas.
- La **razon de descarte no se trae** (vive en una pestana que no se lee).

## Alcance

- **Dentro:** escribir `leads.estado`, el agrupamiento dinamico y la tabla que guarda las
  combinaciones.
- **Dentro:** "desaparecio de la hoja" como una categoria mas (F-06). **Nunca se borra un lead**;
  lo que falta construir es la **deteccion**.
- **Fuera:** la pantalla que combina. Es de la etapa 6.
- **Fuera:** decidir si las categorias son por programa o globales. **Sigue abierto a proposito**
  (ADR 0032) y se decide con el embudo delante, en la etapa 5.

## Done cuando

- [ ] Despues de una corrida sobre `dev`, la distribucion de `estado` se parece a la medida el
      16-sep (Comunicarte: ~928 Descartado, ~786 Setteo, ~286 Con Calendly; Tactical: ~2.031,
      ~1.447, ~316 y 1 Cerrado). **Si no se parece, algo se esta perdiendo.**
- [ ] Un valor nuevo inventado en una celda aparece como su propio grupo, sin error.
- [ ] Un lead con un parcial posterior a su completa conserva el estado de **la completa**.
- [ ] Combinar dos valores deja fila con quien y cuando.

## Kiro

Si, con revision.
