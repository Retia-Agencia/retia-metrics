---
id: 287
etapa: llamadas
serves: "El export de Grain trae la campaña, el conjunto y el anuncio de origen de cada llamada, y se filtra por anuncio, para analizar llamadas por creativo fuera del CRM (Anderson vía Michael, 19-oct)"
depends: [277, 247]
status: todo
---

# 287 — Grain con el anuncio de origen

## Por qué

En la lista de Anderson: "análisis de Grain orientado a anuncios". Analizar transcripciones dentro del CRM sigue fuera
(PT-60, QM-4: Grain no tiene API y es caro). Decidido con Mani (19-oct): el CRM entrega la lista con su atribución y
el análisis lo hacen César o Anderson con Claude. El MCP del CRM (MCP-1) tendrá una herramienta equivalente.

## Alcance

- El CSV de Grain (275, 277) gana las columnas área, canal, campaña, conjunto y anuncio del envío que abrió el deal
  (ADR 0060), resueltas por el árbol (247), y el nivel de traza.
- Un filtro por campaña o anuncio en la barra de Calls, que también recorta el export.
- **Fuera:** leer o resumir la transcripción.

## Done cuando

Pauta baja el CSV de las llamadas de un anuncio y cada fila trae su link de Grain y su anuncio de origen.
