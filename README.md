# Retia Metrics

CRM interno de Retia para sus programas (hoy **ComunicArte** y **Tactical Investor**): los leads, los
deals, las llamadas, los pagos y la plata cobrada, con las métricas calculándose solas encima.

> Acceso restringido. La app maneja datos personales de leads y cifras comerciales:
> no hay ninguna vista pública y no existe el auto-registro.

## Dónde está todo

| Documento | Qué tiene |
|---|---|
| [`AGENTS.md`](./AGENTS.md) | el contrato para trabajar en este repo: reglas que no se pueden violar, contratos, comandos y convenciones |
| [`docs/plan.md`](./docs/plan.md) | el plan de implementación: tracks, orden, hitos y decisiones abiertas. **Punto de entrada del trabajo** |
| [`docs/overview.md`](./docs/overview.md) | qué es la herramienta de principio a fin, y el vocabulario del negocio |
| [`docs/structure.md`](./docs/structure.md) | diagramas y componentes, técnicos y operacionales, y el sistema de diseño |
| [`docs/operations.md`](./docs/operations.md) | entornos, URLs de cada programa, variables, base de datos, scripts, despliegue |
| [`docs/adr/`](./docs/adr/README.md) | las decisiones de arquitectura y por qué |
| [`docs/tasks/README.md`](./docs/tasks/README.md) | el estado de cada ticket |
| [`docs/agents/handoff.md`](./docs/agents/handoff.md) | la memoria de sesiones |

## Requisitos

- Node 20 o superior. El gestor de paquetes es **npm**.
- Una base PostgreSQL en [Supabase](https://supabase.com) (ADR 0047).
- Credenciales de Google OAuth.

## Setup local

```bash
npm run setup      # arma .env.local
npm run db:migrate # aplica las migraciones a la base de DATABASE_URL_DIRECTA
npm run seed:users # te inserta como gerente (SEED_GERENTE_EMAIL)
npm run seed:datos # siembra una base VACÍA: nunca sobre una base con datos reales
npm run dev
```

Qué va en cada variable y de dónde sale: [`docs/operations.md`](./docs/operations.md) §3. Mientras el
`package-lock.json` no esté reparado, instala con `npm install --no-package-lock` (`npm ci` falla).

Las URIs de redirección autorizadas en Google Cloud son
`http://localhost:3000/api/auth/callback/google` y `https://<dominio>/api/auth/callback/google`.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | servidor de desarrollo |
| `npm test` · `npm run typecheck` · `npm run lint` | los tres chequeos; ninguna etapa se cierra sin los tres limpios |
| `npm run build` | build de producción |
| `npm run db:generate` · `npm run db:migrate` | migraciones: **se lee el SQL generado antes de aplicarlo**, y producción pide el ok de Mani |
| `npm run usuarios` | acceso de emergencia (la vía normal es `/ajustes/usuarios`) |

La lista completa está en [`docs/operations.md`](./docs/operations.md) §5.

## Cómo se agrega alguien al equipo

Desde `/ajustes/usuarios`. No hay registro abierto: quien no esté en la tabla `users` con
`activo = true` recibe acceso denegado aunque su cuenta de Google sea válida. Un closer necesita al
menos una membresía de programa: solo ve los programas donde es miembro (ADR 0048). Quitar a alguien
lo desactiva, no lo borra, y lo saca de inmediato; el sistema no deja desactivar al último
administrador.

## Roles

`closer`, `gerente`, `developer` y, cuando entre, `paid_trafficker`. Qué ve y qué puede cada uno:
[`docs/structure.md`](./docs/structure.md) §8. Gerente y closer son disjuntos (ADR 0003) y la
validación es de servidor en cada ruta: esconder un botón no es seguridad.
