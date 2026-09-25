# Sistema de diseño "Tinta"

**Estado:** vigente desde el 23-sep-2026 (elegido por Alejandro entre tres direcciones: Pizarra,
Tinta y Cabina). **Paleta de la agencia desde el mismo 23-sep** (Daniel Tovar): blanco, negro y
morado. El morado es el de Nubank sobre fondo blanco, y un lila más claro sobre fondo negro. **Manda sobre cualquier estilo escrito en una pantalla.** Si una pantalla
necesita algo que este documento no cubre, se agrega **aquí y en los tokens**, no en la pantalla.

> No confundir con `docs/design.md`, que es el diseño **del producto** (actores, servicios,
> propuesta de valor). Este es el diseño **visual**.

## La idea en una línea

**El marco es tinta, el trabajo es la hoja.** La barra lateral es negra en los dos temas y se
lee como el marco; el contenido va sobre un gris neutro muy claro y cada bloque es una hoja blanca.
Es la estructura que el equipo ya conoce de HubSpot, a propósito: es una herramienta de trabajo
diario y lo familiar se usa más rápido.

## Dónde vive

| Pieza | Archivo |
|---|---|
| Tokens (color, sombra, radio, fuentes) | `app/globals.css` |
| Marco (barra lateral) | `components/app-sidebar.tsx`, con `data-zona="marco"` |
| Hoja (encabezado + contenido de cada pantalla) | `components/page-shell.tsx` |
| Firma de la app | `components/marca.tsx` |
| Tarjeta, botón, badge, select, menú | `components/ui/*` (shadcn sobre Base UI) |

### El marco desde el 24-sep (ADR 0050)

La navegación pasa a ser **por objetos**: una tab por objeto del modelo (Inbox, Dashboard, Leads,
Deals, Calls, Students, Campañas, Programs, Products, Resources, Ajustes) y un **selector de programa
arriba de la barra**, dentro del marco. El grupo "Programas" de hoy desaparece: el programa se elige
en el selector, no en la lista. El selector sigue las reglas de abajo como cualquier control del
marco (regla 7), y lo que despliega sale en un portal con los tokens del tema.

## Las reglas

1. **Ninguna pantalla escribe un color, una sombra ni un radio a mano.** Nada de `#hex`,
   `bg-green-500` ni `shadow-[...]` en `app/` o `components/` fuera de `components/ui/`. Se usa
   el token: `bg-card`, `text-muted-foreground`, `bg-primary`, `shadow-tarjeta`, `bg-tono-alerta-suave`.
   Si falta un token, se crea en `globals.css` con su versión clara **y** oscura.
2. **Un solo acento: el morado de la agencia (`marca` y `primary`).** Es `#820AD1` (el de
   Nubank) sobre fondo blanco y **lila** `#B57BFF` sobre fondo negro: en el marco y en el tema
   oscuro. La pantalla no elige cuál: usa el token y el fondo decide. Se usa para la acción
   principal (`<Button>` por defecto), lo seleccionado (la raya del ítem activo en el marco), el
   foco del teclado, la firma y, en su versión suave (`secondary`, `accent`, `marca-suave`), el
   botón secundario, el hover y el resaltado de menús, más el ítem activo del marco. **No para decir "éxito"**: eso es el tono `exito`, que sigue
   siendo verde porque es un estado, no la marca. Antes del 23-sep el acento era verde y los
   botones iban en tinta; la paleta de la agencia lo reemplazó.
3. **Los tonos de estado son semánticos, no decoración.** Cinco, cada uno con su versión suave de
   fondo: `neutro`, `info`, `alerta`, `exito`, `peligro`. Se usan con `<Badge variant="...">`. No
   cuentan como acento.
4. **Toda cifra que se compare va en `cifra`** (Geist Mono con dígitos de ancho fijo): valores de
   KPI, columnas numéricas de tablas, saldos. Un número dentro de una frase no. Y el formato es
   siempre el de `lib/format.ts`: punto de miles, coma decimal, USD con dos decimales y la moneda
   al lado.
5. **Una tarjeta se separa con sombra, no con borde** (`shadow-tarjeta`): un anillo de 1px casi
   invisible más una sombra corta. Lo que flota (menús, el login, un diálogo) usa
   `shadow-flotante`. **No todo es tarjeta**: una lista dentro de una tarjeta se separa con
   `divide-y`, no con más tarjetas.
6. **Radios: 8px en controles, 12px en tarjetas.** `rounded-lg` para botones, campos y badges de
   bloque; `rounded-xl` para tarjetas; `rounded-full` solo para píldoras y puntos.
7. **Lo que vive dentro del marco no se estiliza aparte.** `data-zona="marco"` redefine los tokens
   generales a su versión sobre tinta, así que un botón `ghost`, un separador o un texto `muted`
   dentro de la barra se ven bien solos. Lo que se abre desde el marco (el menú de usuario) sale
   en un portal con los tokens normales del tema.
8. **Claro y oscuro son el mismo sistema.** Todo token existe en `:root` y en `.dark`. Una
   pantalla nunca pregunta por el tema.
9. **Movimiento: 150 ms y solo para estado.** Hover y foco con `transition-colors duration-150`.
   Nada de animaciones de entrada en pantallas que se abren cien veces al día.
10. **Todo control interactivo tiene hover, foco visible y deshabilitado.** El foco es un anillo
    `ring` (morado de marca, lila sobre negro). Sin foco visible no se mergea.

## Paleta

| Token | Claro | Oscuro | Para qué |
|---|---|---|---|
| `sidebar` | `#0a0a0a` | `#050505` | El marco (negro) |
| `background` | `#f6f4f9` | `#0a0a0a` | Fondo de trabajo (gris con un toque lila) |
| `card` | `#ffffff` | `#141414` | La hoja |
| `foreground` | `#0a0a0a` | `#ededed` | Texto principal |
| `muted-foreground` | `#6b6b6b` | `#a3a3a3` | Texto secundario, etiquetas |
| `border` | `#e5e5e5` | blanco 8 % | Divisores |
| `primary` | `#820ad1` | `#b57bff` | Botón principal |
| `marca` | `#820ad1` | `#b57bff` | Selección, foco, firma |
| `marca-texto` | `#820ad1` | `#c9a3ff` | Texto morado legible |
| `secondary` / `accent` | `#f3e8fc` | lila 14 % | Botón secundario, hover, resaltado de menú |
| `sidebar-primary` | `#b57bff` | `#b57bff` | El lila del marco, en los dos temas |

Contraste medido: blanco sobre `#820ad1` da 7,2:1, y `#b57bff` sobre negro da 6,8:1. Los dos
pasan AA para texto normal. **El morado oscuro nunca va sobre negro ni el lila sobre blanco**: por
eso existen los dos.

## Tipografía

- **Geist** para toda la interfaz; **Geist Mono** solo para cifras (`cifra`). Las carga
  `app/layout.tsx`.
- Escala fija, sin tamaños fluidos: `text-xs` (etiquetas, notas), `text-sm` (cuerpo por
  defecto), `text-base` (títulos de tarjeta grandes), `text-lg` (título de pantalla), `text-2xl`
  (valor de KPI).
- Pesos: 400 cuerpo, 500 etiquetas y navegación, 600 títulos y cifras. Sin 700 salvo la marca.
- Mayúsculas solo en las etiquetas de grupo del marco, con `tracking-wide`. Todo lo demás en
  minúscula de oración ("Caja recaudada", no "Caja Recaudada").

## Etapas del deal → tono

Una etapa se pinta **siempre** igual, en el Kanban, la ficha y cualquier tabla (ADR 0037):

| Etapa | Tono |
|---|---|
| Pendiente Setteo | `neutro` |
| En Contacto | `neutro` |
| Pendiente Re-agenda | `alerta` |
| Agendado | `info` |
| Atendido | `info` |
| Compromiso Verbal | `alerta` |
| Abonado | `exito` |
| Completo | `exito` |
| Próxima Cohorte | `neutro` |
| Cierre Perdido | `peligro` |

Anulado **no es una etapa** (ADR 0038): se muestra tachado y en `muted-foreground`, nunca con un
tono.

## Cómo se construye una pantalla nueva

1. Envolver en `<PageShell titulo descripcion acciones>`.
2. Resumen arriba (KPIs en una grilla de 4), detalle abajo (tablas en tarjetas).
3. Estados en `<Badge variant>` con el tono que corresponde, nunca un color suelto.
4. Números con `cifra` y el formato de `lib/format.ts`.
5. Estado vacío escrito (qué falta y cómo llenarlo), nunca una tarjeta en blanco.
6. Revisarla en claro **y** en oscuro, y abrir todo lo que se abre (AGENTS.md: cargar una
   pantalla no es probarla).

## Lo que se decidió no hacer

- **Nada de gradientes, vidrio ni sombras de color.** Es una herramienta de trabajo.
- **No se cambian los íconos** (siguen en `lucide-react`, trazo 2) hasta que haya una razón de
  uso: cambiar de librería es tocar todas las pantallas sin mejorar ninguna.
- **No hay componente de etapa todavía.** Llega con el Kanban (E6); la tabla de arriba es su
  contrato.
