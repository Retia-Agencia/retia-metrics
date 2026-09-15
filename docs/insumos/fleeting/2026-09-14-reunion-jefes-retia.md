---
type: fleeting
date: 2026-09-14
source: reunion jefes Retia (Mike / Alejo / Dani Toar)
status: sin procesar
context: extracto crudo que Mani trajo a la sesion de spec-driven design del CRM
---

> Fleeting note. Insumo crudo, sin reconciliar. La verdad del alcance vive en `docs/spec.md`
> y los ADR; esto es el material del que salio.

# Contexto: reportes de ventas actuales

- Proceso actual completamente manual: Mike revisa el grupo de WhatsApp de closers, contrasta
  comprobantes de cierre con el calendario compartido y un resumen que le mandan las chicas.
- Todo pasa por Claude (second brain de Mike) y genera el reporte en PDF.
  - Se lo manda a Alejo y a Dani Toar.
- Problema: la data queda en el Claude de Mike, nadie mas puede consultarla directamente.

# Centralizar la info para los reportes

- Propuesta: CRM personalizado con dashboard central.
  - Closers registran sus llamadas con su propio perfil, sin WhatsApp ni calendario.
  - Reemplaza los canales actuales (eliminarlos una vez adoptado).
- Dashboard visible para todos: tasa de cierre por closer, por programa, por fecha.
- Generacion de reportes automatica desde lo registrado, con un solo boton.
- Prioridad: rapidez sobre estetica, numeros y tablas primero, se pule despues.
- Alojado en la nube con backend y base de datos.

# Metricas de leads desde la C2

- Toca cargar toda la data historica desde la segunda corte:
  - Practical (Tactical Investor): desde el 19 de agosto.
  - Comunicarte: desde el 12 de agosto.
- Primer paso: Mike exporta todo lo que tiene en su Claude en formato MD.
  - Con eso se idea la estructura tecnica de la herramienta.
- Metricas clave: ventas por closer, leads por programa, visibilidad total de lo que pasa con
  cada closer y cada programa.

# Insumos entregados

- `docs/insumos/historico-c2/comunicarte-c2-consolidado.md` (export de Downloads, 14-sep).
- `docs/insumos/historico-c2/tactical-investor-c2-consolidado.md` (export de Downloads, 14-sep).
- Backlog hasta que se inyecten a la herramienta. NO son insumo limpio para importar 1:1
  (ver `docs/spec.md` §7): reportes narrativos reconciliados a mano, con discrepancias documentadas.

# Tension nueva vs. lo ya especificado (a resolver, no inventar)

- El brief pide "generacion de reportes automatica con un solo boton (PDF)". El spec actual
  (§2) dice explicitamente "no genera PDF: el dashboard en pantalla es el reporte".
  -> Contradiccion real entre el brief del jefe y el spec vigente. Decidir con Mani/Mike.
