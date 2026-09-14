# Dependencias

Este proyecto es **100% Node.js/TypeScript** (npm) — no hay ningún componente Python, así
que no existe un `requirements.txt`. Este documento cumple ese rol: qué hace falta para
correr el repo, qué trae cada paquete y por qué está.

Auditado el 2026-09-14 contra el uso real en `app/`, `components/`, `lib/`, `scripts/` y
`tests/` (no solo contra lo que dice `package.json`).

## Requisitos del entorno (no son paquetes npm)

| Qué | Para qué | Dónde se consigue |
|---|---|---|
| Node 20+ (probado en 24/25) | Runtime | — |
| npm (no pnpm — ver `PROJECT.md`) | Gestor de paquetes | Viene con Node |
| Base de datos Neon Postgres | Persistencia | [neon.tech](https://neon.tech) |
| Credenciales OAuth de Google | Login + lectura/escritura de Sheets | Google Cloud Console |
| Cuenta de servicio de Google con acceso a las hojas | Sync con Google Sheets | Google Cloud Console |

`npm install` instala todo lo demás. No falta ningún paquete: `npm ls` no reporta nada
`missing` ni `invalid`.

## `dependencies` (van al bundle de producción)

| Paquete | Para qué | ¿Se usa? |
|---|---|---|
| `next` | Framework — App Router, Server Components, build | Sí, es el proyecto entero |
| `react` / `react-dom` | UI | Sí |
| `@neondatabase/serverless` | Driver de Postgres sobre HTTP, para Neon en entorno serverless (Vercel) | Sí — `lib/db/index.ts` |
| `drizzle-orm` | ORM — schema, queries, migraciones | Sí — 10 tablas, todo el acceso a datos |
| `next-auth` (v5 beta) | Auth.js — sesión, OAuth de Google, JWT | Sí — `lib/auth/*` |
| `googleapis` | Cliente de Google Sheets API (lectura y escritura) | Sí — `lib/sheets/*`, el motor de sync de la Fase 1 |
| `zod` | Validación de esquemas en los bordes (API/cron) | Sí — patrón fijado en B-03 |
| `@base-ui/react` | Primitivas headless sobre las que corre shadcn/ui en este proyecto (no Radix) | Sí — `components/ui/*` |
| `class-variance-authority` | Variantes de estilos tipadas para los componentes de shadcn/ui | Sí |
| `clsx` + `tailwind-merge` | Merge de clases de Tailwind sin colisiones (`cn()` en `lib/utils.ts`) | Sí |
| `tw-animate-css` | Utilidades de animación para Tailwind v4 | Sí — importado en `app/globals.css`, no en TS (por eso no aparece en un grep de imports JS) |
| `lucide-react` | Iconos | Sí — usado en sidebar, botones, estados |
| `next-themes` | Toggle claro/oscuro | Sí — requisito de `PROJECT.md` |
| `sonner` | Toasts (confirmaciones, errores) | Sí |

**No usadas todavía pero en el plan (Stack de `PROJECT.md`), no instaladas aún:** `recharts`
(Fase 2), `xlsx`/SheetJS (Fase 5), `unpdf` (Fase 5), `@react-pdf/renderer` (Fase 6). No las
instalé porque instalar sin código que las use es la abstracción especulativa que las reglas
de este proyecto prohíben — entran con la fase que las necesita.

## `devDependencies` (build, tooling, tests — no van a producción)

| Paquete | Para qué | ¿Se usa? |
|---|---|---|
| `typescript` | Compilador / `tsc --noEmit` | Sí |
| `@types/node`, `@types/react`, `@types/react-dom` | Tipos | Sí |
| `tsx` | Corre los `.ts` de `scripts/` directo, sin build | Sí — 8 scripts de `package.json` dependen de esto |
| `dotenv` | Carga `.env.local` en los scripts de CLI (Next lo hace solo, `tsx`/`drizzle-kit` no) | Sí — `scripts/load-env.ts` |
| `drizzle-kit` | `db:generate` / `db:migrate` / `db:studio` | Sí |
| `vitest` | Test runner — 68 tests | Sí |
| `eslint` + `eslint-config-next` | Lint | Sí |
| `tailwindcss` + `@tailwindcss/postcss` | Build de CSS | Sí |
| `shadcn` | CLI para agregar componentes (`npx shadcn add ...`) | Sí, pero como herramienta de build, no en runtime |

## Cambios que hice en esta auditoría

- **Eliminé `@types/pg`.** El proyecto usa `drizzle-orm/neon-http` (HTTP, sin socket), nunca
  el paquete `pg`. Era un tipo huérfano, probablemente sobrante de una prueba con otro driver
  antes de decidirse por Neon serverless.
- **Moví `shadcn` de `dependencies` a `devDependencies`.** No se importa en ningún `.ts`/`.tsx`
  — es un CLI que se invoca a mano para generar componentes nuevos. Estar en `dependencies` no
  rompía nada, pero infla sin motivo el bundle que Vercel empaqueta para las funciones.

Verificado después del cambio: `npm run typecheck` limpio y los 68 tests de `npm test` en
verde.
