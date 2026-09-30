---
id: 125
etapa: E8
serves: "ADR 0062 · docs/analytics.md PT-15, PT-16, PT-33, DP-18"
depends: [120, 123]
status: todo
---

# 125 — La tab Campañas: el árbol de Meta con su embudo

## Objetivo

La vista de atribución de Adpulze: cada campaña, conjunto y anuncio con sus registros, agendas, show,
ventas, gasto, costos y ROAS, para saber qué creativo vende.

## Alcance

- **Dentro:** la tab Campañas del programa (ADR 0050), para gerente, trafficker de sus programas y
  developer (ADR 0052 enmendado): el árbol que refleja el 120, desplegable, con el embudo por fila; filtros
  por fecha, cohorte, placement (`utm_term`) y formato.
- **Dentro:** cada anuncio con su link al Administrador de anuncios (Pauta: el id lo hace clicable).
- **Dentro:** una fila "sin anuncio" por nivel para lo que llegó sin `utm_id` (histórico o sin plantilla),
  con su conteo: la calidad de la traza a la vista.
- **Dentro:** el builder (092) vive en esta misma tab para el orgánico y los links de closer.
- **Fuera:** editar Meta.

## Done cuando

- [ ] Un anuncio con dos ventas muestra sus ventas, su gasto y su ROAS, cuadrados con 123.
- [ ] Un closer que forja la ruta recibe 404 o 403 según el caso (alcance y rol).
- [ ] Recorrido con clic en todo lo que se abre.

## Kiro

Sí, con revisión visual.
