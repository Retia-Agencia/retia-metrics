## Qué cambia

<!-- El ticket (docs/tasks/NNN-...) y en una o dos frases qué hace este PR. -->

Ticket: 

## Contratos de AGENTS.md que toca

Marca solo los que aplican y di cómo se cumplen. Uno que aplica y no se marcó es el olor.

- [ ] **Programa = frontera.** Nada cruza programas; una lista nueva lleva selector de programa.
- [ ] **Dedup por `(programa, correo)`.** Toda tasa sobre personas, nunca sobre filas.
- [ ] **Vigencia.** Toda lectura de `calls`, `deals` o `abonos` pasa por `vigente()` o `incluyendoAnulados()`.
- [ ] **Rastro.** Toda escritura de `deals`, `calls`, `abonos` o `deal_actividades` va por `crearConRastro` / `editarConRastro`; catálogo por `lib/catalogo/`.
- [ ] **`deals.etapa` solo por `moverEtapa()`.**
- [ ] **Dinero.** Saldo y abonado desde `lib/queries/saldo.ts`; la moneda al lado del número; caja ≠ ventas.
- [ ] **Roles.** Guarda en el servidor (`requireRole` / `paginaConRol`); ningún `rol === "..."` a mano (`esAdministrador`, `trabajaLeads`, `esAccesoTotal`). El developer no pierde nada.
- [ ] **Fechas de Bogotá.** Nada de `new Date(a, m, d)` ni `toISOString().slice(0, 10)` para una fecha de negocio.
- [ ] **UTM.** No se lee `utm_term`, ni `utm_content` fuera de `lib/atribucion/`.
- [ ] **Datos personales.** Ningún correo ni dato personal en URLs; secretos solo en `.env.local` / Vercel.
- [ ] **Migración.** SQL leído a mano, probado en PGlite, generado y aplicado por la sesión principal con el ok de Mani.
- [ ] **Sistema de diseño Tinta** (`docs/structure.md` §9) si toca una pantalla.

## Cómo se probó

- [ ] `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` (el CI los corre).
- [ ] Si toca una pantalla: se hizo clic en todo lo que se abre y se miró la consola.
- [ ] Si toca un permiso: se forjó la petición desde la vista que NO debería poder (403 y la base quieta).

## Tracker

- [ ] `docs/tasks/README.md` y el `status` del ticket actualizados.
