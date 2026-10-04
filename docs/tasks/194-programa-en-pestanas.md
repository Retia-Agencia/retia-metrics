---
id: 194
etapa: O6
serves: "docs/anotaciones.md A-98; A-06, A-86; ADR 0077"
depends: [193]
status: done
---

# 194 — Programa: pantalla fija y su contenido en pestañas

Sesión **P2**, frente de pantallas de la ola O6. Arranca cuando el 193 esté en `main` (usa `pestanas.tsx`). Sin
migración.

## Por qué existe

**A-98 (Mani, 4-oct).** La tab Programa apila todo en una página que crece sin fin: con cada persona del equipo, cada
cohorte y cada formulario se alarga. Hay que llevarla a pantalla fija y agrupar lo que muestra en pestañas, con la
misma barra del Inbox.

## Alcance

1. **Las pestañas** (propuesta de la central; Mani la confirma al lanzar). Mani sugirió "configuración e información";
   casi todo aquí es configuración, así que agrupar por **para qué sirve** se entiende mejor:

   | Pestaña (`id`) | Qué tiene hoy en la página | Línea descriptiva |
   |---|---|---|
   | `general` | "Le falta para activarse", Destinos | El estado del programa y a dónde llevan sus links. |
   | `equipo` | Equipo | Quién trabaja este programa y con qué rol. |
   | `captacion` | Formularios, Fuentes de leads, Calendly | Por dónde entran los leads y las citas. |
   | `ventas` | Cohortes, Plataformas de pago | Las cohortes que se venden y cómo se cobra. |

   Abre en `general`. Si el programa está inactivo y le falta algo, `general` lo dice primero (hoy es la primera
   tarjeta). Los enlaces que hoy apuntan a un ancla de la página (`#equipo`, el paso de "Sin fuente principal" del
   185) pasan a `?seccion=…` de su pestaña: buscarlos con `grep`.
2. **Pantalla fija** con `PageShell fija` y `PantallaFija`: la barra fija arriba, el scroll en el contenido de la
   pestaña. Una lista que crece (equipo, cohortes, fuentes) hace scroll dentro de su tarjeta si comparte pestaña con
   otra. A 375 px vuelve el scroll de página.
3. **Nada cambia de conducta**: mismos permisos (`administra`, lo que ve un closer), mismas acciones, mismo "Editar
   programa" en el encabezado. Es reacomodo.

## Archivos

`app/(app)/p/[programa]/programa/page.tsx` y, solo si el corte lo pide, `equipo-del-programa.tsx` y
`plataformas-del-programa.tsx`. Quien enlace a un ancla de esta página.

## Done cuando

- Cuatro pestañas con su línea; la página no crece con el equipo ni con las cohortes desde `md`.
- Los enlaces viejos a anclas abren la pestaña correcta.
- Typecheck, lint, `npm run build`.
- Recorrido en `dev:local` como gerente, developer y closer (lo que cada uno ve no cambió), escritorio y 375 px,
  consola abierta, abriendo cada diálogo de cada pestaña (editar programa, formulario, Reconectar Calendly, agregar
  miembro, cohorte, plataforma).

## Nota de cierre (central, 4-oct)

Llegó en `9b3bcc5` (P2); checkpoint `cp-20261004-6`. Revisado en `dev:local`: General, Equipo, Captación y Ventas miden
900 px a 1440×900; como closer se ven las cuatro pestañas sin "Editar". Faltó la nota de la sesión en este archivo.
