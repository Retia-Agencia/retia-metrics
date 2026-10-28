---
id: 338
etapa: media
serves: "F4 (daily del 26-oct: banco de insumos del creador e inbox de crudos) · verificación de crudos del 28-oct, faltante 2"
depends: [316, 321]
status: todo
---

# 338 — Insumos del creador e inbox de crudos

## Por qué

Para editar, media depende de que el creador entregue fotos y videos crudos. Hoy llegan sueltos por WhatsApp y nadie
sabe cuánto falta hasta el día de editar. En el daily del 26-oct se decidió que el CRM lleve un banco de insumos por
creador y un inbox donde caigan los crudos.

## Alcance

- Por creador: un inbox de crudos (fotos y videos que entregó, con fecha) y su banco de insumos (lo ya revisado y
  disponible para editar). Archivos en Storage, molde del ADR 0085.
- Cuántos insumos se esperan por periodo es un **dato del creador** que llena coordinación de media; sin valor, no hay
  aviso y la pantalla lo dice. El aviso "faltan N" sale en la vista de media.
- Quién sube: coordinación de media (los creadores no tienen cuenta en v1, ADR 0107 punto 5).

## Abierto

- El presupuesto de almacenamiento para fotos y video (D13 de `docs/media/extraccion.md`) lo confirma gerencia antes de
  abrir la subida de video. Las fotos no esperan.

## Done cuando

- Subir, mover del inbox al banco y ver el aviso con el usuario `media`, en 375 px.
