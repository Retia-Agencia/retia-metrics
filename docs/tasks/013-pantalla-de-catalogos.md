---
id: 013
fase: F0
serves: "ADR 0012 — pieza 3 del molde"
depends: [011]
status: done
---

# 013 — Pantalla de administración de catálogos

## Objetivo
Un gerente agrega, renombra y desactiva plataformas, motivos y orígenes desde
`/ajustes/catalogos`, sin código.

## Alcance
- Dentro: una sola pantalla con una pestaña por catálogo, construida sobre un componente
  genérico que recibe la definición del catálogo (nombre visible, esquema, acciones).
- Dentro: server actions con `requireRole("gerente")` que llaman al molde.
- Dentro: lista con activos e inactivos (los inactivos atenuados y reactivables).
- Dentro: enlace desde `/ajustes`.
- Fuera: productos (017, tiene su propia pantalla porque también la usan closers).

## Done cuando
- [x] Agregar un catálogo nuevo a esta pantalla es una línea de configuración.
- [x] Un closer que entra a `/ajustes/catalogos` es redirigido (test de páginas).
- [x] Cada cambio aparece en `change_log`.

## Notas
El molde ganó `reactivar` (simétrico a `desactivar`). Un id que no es uuid sale como 400
(deuda del 011 saldada en `lib/catalogo/operaciones.ts`). Las pestañas y el campo de texto son
nativos con los tokens del tema, sin instalar `tabs`/`input` de shadcn.

---

## Enmienda pendiente (Mani, 19 y 20-sep) — SIN IMPLEMENTAR

### Lo que Mani decidio

1. **Los closers pueden crear plataformas de pago** (19-sep).
2. **Las plataformas de pago pasan a tener programa** (20-sep, textual: *"quiero que las
   plataformas de pago si tengan programa mejor, cada link se asocia a un programa para que al
   registrar una venta en un programa solo se muestren los de ese"*).
3. **`/ajustes` deja de ser exclusivo de gerente**; la guarda baja a cada subpagina (20-sep).

### Lo que ya esta hecho y no hay que construir

**`enlaces_pago.programId` ya existe y es NOT NULL** (ticket 022). Un link de pago YA esta atado a
un programa, y `/recursos` ya los agrupa por programa y producto. La mitad de la frase de Mani
—"cada link se asocia a un programa"— **ya se cumple hoy**.

Lo que falta es lo otro: que el **selector de plataforma** se acote al programa. Hoy
`components/mi-dia-registro.tsx` (registrar venta y abono) y
`components/resources/recursos-pantalla.tsx` (crear enlace de pago) muestran TODAS las plataformas
activas.

### ✅ DECIDIDO el 20-sep por Mani — ADR 0034

**Tabla puente `plataformas_programa`** (opcion B), no una columna `program_id`.

Por que no la columna: `plataformas_pago` tiene un indice unico sobre `lower(nombre)` cuyo
comentario dice para que existe (*"'Paypal' y 'PayPal' no pueden partir las metricas en dos
plataformas distintas"*). Meterle `program_id` obliga a aflojarlo a unico POR programa, y PayPal
pasa a ser dos filas con dos ids: el dia que alguien agrupe caja por plataforma ve dos medios de
pago donde hay uno. **Es el dano que el indice existe para impedir, entrando por la puerta de al
lado, y sin lanzar un solo error.**

Con la tabla puente el indice queda intacto y PayPal sirviendo a dos programas son dos vinculos.
Mismo molde que `miembros_programa`.

**Una plataforma SI puede existir sin programa** (Mani corrigio el 20-sep). Queda invisible en los
selectores hasta que se asocie, y eso esta bien. Lo que no puede existir sin programa es el
METODO de pago, o sea el ENLACE, y `enlaces_pago.program_id` ya es `NOT NULL` desde el 022: ahi no
habia nada que construir.

**La tabla puente se gana su lugar por los abonos sin enlace** (Mani): una transferencia a
Bancolombia o un Zelle no pasan por un link, y el closer tiene que poder elegir esa plataforma
igual. Derivar el vinculo de `enlaces_pago` haria invisible justo ese caso. Por eso el vinculo es
dato propio: nace al crear un enlace de pago, y tambien se puede poner a mano.

### La migracion, medida en `production` el 20-sep

| plataforma | enlaces | abonos |
|---|---|---|
| PayPal | 5, todos de `comunicarte` | 0 |
| Bancolombia, DollarApp, Global66, Hotmart, MercadoPago, Zelle | **0** | **0** |

**Seis de siete no tienen de donde derivar su programa.** Y derivar el de PayPal seria peor que no
derivar nada: lo dejaria solo en `comunicarte` y **Tactical Investor perderia PayPal de su
selector sin que nadie lo decidiera**. Hoy lo ve, porque hoy no hay filtro.

**La migracion asocia TODAS las plataformas a TODOS los programas activos**, que es el
comportamiento de hoy, y el equipo desasocia lo que no aplique desde la pantalla. La decision de
negocio la toma un humano mirando, no una migracion adivinando con cinco filas.

### Estado de la migracion 0019 (20-sep)

- [x] `plataformas_programa` en `lib/db/schema.ts` + migracion `0019_foamy_gamora.sql`, con el
      **backfill en la MISMA migracion**: entre crear la tabla y llenarla, todos los selectores de
      plataforma de la app saldrian VACIOS.
- [x] Aplicada en `dev` y verificada: 7 plataformas x 2 programas, **0 huerfanas**.
- [ ] Aplicar en `production` (pide el ok de Mani).
- [ ] `lib/catalogo/plataformas.ts`: asociar y desasociar programas (sin minimo), y
      `exigirAccesoAlPrograma` para que un closer solo asocie donde vende.
- [ ] Crear un enlace de pago crea el vinculo plataforma-programa si falta, en la misma
      operacion, o el dato propio se desincroniza de `enlaces_pago`.
- [ ] Crear una plataforma nueva desde el formulario del enlace de pago.
- [ ] Acotar los selectores: `components/mi-dia-registro.tsx` (venta y abono) y
      `components/resources/recursos-pantalla.tsx` (crear enlace de pago).
- [ ] `/ajustes` proyectado por rol + guarda bajada a las subpaginas.

### Lo que arrastra el punto 3 (`/ajustes`)

`app/(app)/ajustes/page.tsx` es hoy `paginaConRol("gerente")` y es un indice de enlaces. Al
abrirlo, **el indice tiene que proyectar por rol**: un closer entra pero solo ve los enlaces que
puede usar. Si no, le salen `/ajustes/usuarios`, `/ajustes/programas` y `/ajustes/fuentes`, que lo
rebotan. Las subpaginas conservan su `paginaConRol("gerente")` cada una.

Y dentro de `/ajustes/catalogos`: motivos y origenes **siguen siendo solo de administracion**. La
pantalla tiene una pestana por catalogo, asi que a un closer se le proyecta unicamente la de
plataformas. No se escribe `rol === "closer"` a mano: sale de las funciones de `lib/auth/roles.ts`
(ADR 0025), o el developer se queda afuera de su propia app.

### Supuesto aplicado mientras tanto

**Un closer no crea, ni edita, ni desactiva un recurso GLOBAL** (`programId` nulo). Mani declaro
la asimetria para crear; se extiende a editar y desactivar por coherencia: lo que no se puede
crear tampoco se puede cambiar. **Si Mani lo corrige, se corrige aqui.**
