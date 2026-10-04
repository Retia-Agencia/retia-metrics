---
id: 199
etapa: O6
serves: "Manual de operación para los closers (Mani, 4-oct); regla 'nada de la app es público'"
depends: []
status: todo
---

# 199 — El manual de uso se abre desde la app, detrás del login

Sin migración.

## Por qué existe

Mani, 4-oct: los closers nuevos (Memorable) necesitan el manual de operación a mano, dentro del CRM. Hoy el manual es
`docs/manuales/operacion-comercial.html` y solo se abre en el navegador de quien tiene el repo o publicado como
artifact privado, que un closer no puede abrir.

## Decidido (sesión central, 4-oct)

1. **Una ruta `GET /manual`** (route handler, `app/manual/route.ts`) que lee `docs/manuales/operacion-comercial.html`
   y lo devuelve como `text/html; charset=utf-8`, envuelto en el esqueleto que el archivo no trae (formato artifact:
   empieza por `<title>` y `<style>`): `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta
   name="viewport" content="width=device-width, initial-scale=1">` + el archivo + `</html>`.
2. **Detrás del login, sin rol:** cualquier sesión válida lo lee (`requireSessionDeLectura` o la guarda de lectura
   que corresponda), sin sesión 401/redirect como todo. El proxy ya lo cubre; la guarda en el handler es la de
   siempre (nada de la app es público). No se agrega a `esRutaPublica`.
3. **Un solo archivo fuente:** la ruta lee el archivo del repo; no hay copia en `public/`. Para que viaje al build de
   Vercel, `outputFileTracingIncludes` en `next.config.ts` para `/manual`.
4. **El botón:** en Mi espacio, un enlace sutil **"Manual de uso"** (variante `ghost` o `link` de `Button`, tamaño
   `sm`, ícono `BookOpen` de lucide), dentro de la tarjeta del perfil (`PerfilDeMiEspacio`), alineado a la derecha.
   Abre en pestaña nueva (`target="_blank" rel="noopener"`). Lo ven todos los que entran a Mi espacio. Tokens de
   Tinta, nada de color a mano (`docs/structure.md` §9).

## Done cuando

- `tests/manual-de-uso.test.ts`: sin sesión, error de autenticación; con sesión de closer, 200, `content-type` html y
  el cuerpo empieza por `<!doctype html>` y contiene el `<title>` del manual.
- `npm run typecheck`, `npm run lint`, ese test y `npm run build` limpios.
- Recorrido: el botón se ve en Mi espacio y abre el manual en otra pestaña.

## Fuera

El contenido del manual (lo actualiza la sesión central en el mismo frente) y cualquier otro manual.
