# Retia Metrics

Dashboard comercial interno de Retia para los programas **Comunicarte** y **Tactical Investor**.
Lee las BBDD de Google Sheets, calcula el embudo, proyecta el corte y deja que los closers
registren sus llamadas.

El contexto de negocio y las reglas que no se pueden violar estan en [`PROJECT.md`](./PROJECT.md).
El estado de avance por fase esta en [`STATE.md`](./STATE.md).

> Acceso restringido. La app maneja datos personales de leads y cifras comerciales:
> no hay ninguna vista publica y no existe el auto-registro.

## Requisitos

- Node 20 o superior (probado en 25.9)
- Una base de datos [Neon Postgres](https://neon.tech)
- Credenciales de Google OAuth

El gestor de paquetes es **npm**.

## Setup local

```bash
npm install
cp .env.example .env.local
```

Llena `.env.local`:

| Variable | De donde sale |
|---|---|
| `DATABASE_URL` | Neon > tu proyecto > Connection string (con `?sslmode=require`) |
| `AUTH_SECRET` | `npx auth secret` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google Cloud Console > APIs y servicios > Credenciales > ID de cliente OAuth (tipo *Aplicacion web*) |
| `SEED_GERENTE_EMAIL` | Tu correo de Google. Es el primer y unico usuario que existira al arrancar. |

URIs de redireccion autorizadas en Google Cloud:

```
http://localhost:3000/api/auth/callback/google
https://<tu-dominio-de-vercel>/api/auth/callback/google
```

Luego:

```bash
npm run db:migrate    # crea la tabla users en Neon
npm run seed:users    # te inserta como gerente
npm run dev
```

## Comandos

| Comando | Que hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de produccion |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Tests (Vitest) |
| `npm run db:generate` | Genera migracion a partir del schema |
| `npm run db:migrate` | Aplica migraciones |
| `npm run db:studio` | Explorador de la base de datos |
| `npm run seed:users` | Crea o promueve al gerente de `SEED_GERENTE_EMAIL` |

## Deploy a Vercel

1. Sube el repo a GitHub.
2. En Vercel: **Add New > Project** y selecciona el repo. El framework se detecta solo.
3. Carga las variables de entorno de `.env.example` con los valores de produccion.
   `AUTH_SECRET` debe ser distinto al de local.
4. Despliega, copia el dominio y agrega su callback en Google Cloud.
5. Corre `npm run db:migrate` apuntando a la base de produccion.

## Como se agrega alguien al equipo

No hay registro abierto: quien no este en la tabla `users` con `activo = true` recibe un
error de acceso denegado aunque su cuenta de Google sea valida.

Por ahora se agrega con `npm run db:studio` (insertar fila con `email`, `nombre`, `rol` y,
si es closer, el `closer_id` con el que aparece en la BBDD de Sheets). La pantalla para
hacerlo desde la app llega en una fase posterior.

Para revocar a alguien: `activo = false`. Surte efecto en la siguiente emision de token.

## Roles

| | gerente | closer |
|---|---|---|
| Dashboards de programa | si | no |
| Comparativo entre closers, caja, pauta | si | no |
| Su propia cola y sus propias llamadas | si | si |
| Documentos | si (sube) | si (lee) |
| Ajustes | si | no |

No hay herencia: son conjuntos disjuntos y la validacion es de servidor, en cada ruta.
Esconder un boton no es seguridad.
