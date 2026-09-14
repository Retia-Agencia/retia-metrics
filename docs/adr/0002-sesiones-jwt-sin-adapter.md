# 0002 — Sesiones JWT sin adapter de base de datos

**Fecha:** 2026-08-18 · **Revisado:** 2026-09-06 (hallazgo S-02)

Auth.js v5 ofrece dos estrategias de sesion: JWT, o un adapter que guarda sesiones y cuentas en la
base. El adapter trae tablas propias (`sessions`, `accounts`, `verification_tokens`) que existen
para manejar cuentas, y aca quien controla el acceso no es Google sino nuestra propia tabla
`users`.

**Decidimos sesiones JWT sin adapter.** El allowlist se valida en el callback `signIn` contra
`users`, y no hacen falta tablas de sesion.

El costo aparecio en la revision externa: un JWT es un papelito firmado que el servidor no
consulta, asi que desactivar a alguien no lo sacaba de la app hasta que el token expirara. Se
corrigio revalidando el rol contra la base **en cada emision de token** y acotando la sesion a 8
horas. Si el token viene vacio, el rol queda nulo y los cuatro consumidores fallan cerrado, en vez
de caer a `"closer"` por defecto.

**Alternativa descartada:** el adapter completo. Habria resuelto la revocacion inmediata, pero
agrega tres tablas y un modelo de cuentas que este proyecto no usa, para un equipo de cinco
personas.
