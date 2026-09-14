# 0006 — Un paquete no se instala antes del codigo que lo usa

**Fecha:** 2026-09-14

El stack del proyecto nombra librerias para trabajo futuro: Recharts para graficas, SheetJS para
archivos subidos, unpdf para leer PDFs, `@react-pdf/renderer` para exportar reportes.

**Decidimos no instalarlas hasta que exista el codigo que las use.** Un paquete instalado sin uso
es abstraccion especulativa: fija una version que envejece, aparece en las auditorias de
seguridad, engorda lo que Vercel empaqueta, y le sugiere al siguiente agente que la decision de
usarlo ya se tomo cuando no es cierto.

La auditoria del 14 de septiembre encontro dos casos del problema y los corrigio: `@types/pg` era
un tipo huerfano de una prueba con otro driver antes de decidirse por Neon serverless, y `shadcn`
estaba en `dependencies` siendo un CLI que solo se invoca a mano.

Corolario que aplica igual a los componentes: tres componentes de shadcn (`input`, `label`,
`table`) estaban generados y sin importar en ningun lado. Se borraron. Se recuperan con un
`npx shadcn add table` cuando haya una pantalla que los use.
