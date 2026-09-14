# 0001 — npm en vez de pnpm

**Fecha:** 2026-08-18

El plan original del proyecto especificaba `pnpm`. En la maquina de desarrollo npm apunta a
`/usr/local`, asi que instalar pnpm global requiere sudo y no estaba disponible.

**Decidimos usar npm**, y dejar `package-lock.json` versionado. Todos los scripts de
`package.json` son los mismos; donde una instruccion heredada diga `pnpm X`, se corre `npm run X`.

Se registra porque es la clase de detalle que un agente "corrige" por su cuenta creyendo que es un
descuido, y el cambio arrastraria el lockfile entero y el cache de CI. Si algun dia se migra, es
una decision deliberada, no un arreglo de paso.
