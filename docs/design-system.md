# Sistema de diseño "Tinta"

**Estado:** vigente desde el 23-sep-2026 (elegido por Alejandro entre tres direcciones: Pizarra,
Tinta y Cabina). **Manda sobre cualquier estilo escrito en una pantalla.** Si una pantalla
necesita algo que este documento no cubre, se agrega **aquí y en los tokens**, no en la pantalla.

> No confundir con `docs/design.md`, que es el diseño **del producto** (actores, servicios,
> propuesta de valor). Este es el diseño **visual**.

## La idea en una línea

**El marco es tinta, el trabajo es la hoja.** La barra lateral es oscura en los dos temas y se
lee como el marco; el contenido va sobre un gris azulado claro y cada bloque es una hoja blanca.
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
   el token: `bg-card`, `text-muted-foreground`, `bg-marca`, `shadow-tarjeta`, `bg-tono-alerta-suave`.
   Si falta un token, se crea en `globals.css` con su versión clara **y** oscura.
2. **Un solo acento: el verde de marca (`marca`).** Es el color de la plata que entra, así que
   significa **avance**. Se usa para lo seleccionado (el punto del ítem activo en el marco), el
   foco del teclado, el progreso (barra de la cohorte) y el éxito. **Nunca para un botón**: la
   acción principal va en tinta (`primary`), para que el verde siga diciendo "avance".
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
    `ring` (verde de marca). Sin foco visible no se mergea.

## Paleta

| Token | Claro | Oscuro | Para qué |
|---|---|---|---|
| `sidebar` | `#0e1726` | `#070c16` | El marco |
| `background` | `#f5f7fa` | `#0b1120` | Fondo de trabajo |
| `card` | `#ffffff` | `#111a2b` | La hoja |
| `foreground` | `#0e1726` | `#e6eaf0` | Texto principal |
| `muted-foreground` | `#667085` | `#94a0b4` | Texto secundario, etiquetas |
| `border` | `#e4e8ee` | blanco 8 % | Divisores |
| `primary` | `#0e1726` | `#e6eaf0` | Botón principal |
| `marca` | `#22c38e` | `#3ad6a1` | Avance, selección, foco |
| `marca-texto` | `#0f7a57` | `#5fe0b2` | Texto verde legible sobre blanco |

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
| Completo | `exito` (con el verde de marca en el punto) |
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
