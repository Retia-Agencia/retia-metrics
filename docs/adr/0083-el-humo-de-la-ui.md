# 0083: Las pantallas se prueban con un humo de Playwright que abre todo, no con tests de componente

- **Estado:** aceptado, 9-oct-2026 (Alejo). Se construye en el ticket 075.
- **Confirma:** la convención de `AGENTS.md` "cargar una pantalla no es probarla" (hay que hacer clic en todo lo que se
  abre y mirar la consola) y la de "para una regla de permiso hay que forjar la petición".

## Contexto

El 075 pedía decidir si entraban tests de componente o si la garantía seguía siendo el recorrido a mano. Los bugs de UI
que se colaron con la suite en verde fueron todos del mismo tipo:

- 18-sep: un `DropdownMenuLabel` fuera de su `Menu.Group` tumbó la página entera **al abrir el menú** del usuario, con
  543 tests en verde. Estuvo roto varios días. Base UI lanza en tiempo de ejecución, no en compilación.
- 20-sep: un `disabled` mal escrito dejó un botón muerto, con 669 tests en verde.

Un test de componente con jsdom no reproduce bien Base UI (portales, foco, contexto): el bug del 18-sep podía seguir
pasando. Y el recorrido a mano no se repite: la regresión de mañana no la ve nadie.

## Decisión

1. **Entra un humo de Playwright** (`e2e/humo.spec.ts`, `npm run test:humo`). Entra con cada rol de la base local
   (developer, gerente, closer y paid trafficker), visita cada pantalla global y cada tab de cada programa que ve, más
   la primera ficha de deal y de lead, y **hace clic en todo**: cualquier `button`, `[role=combobox]` y `summary`, y
   un nivel dentro de cada diálogo que se abre (sus selects y menús). Muchos diálogos del CRM se montan con estado
   desde un `onClick` y no lo anuncian con `aria-haspopup`, así que filtrar por ese atributo los dejaba fuera.
2. **Falla** si la consola registra un error, si la página lanza, si una pantalla responde 5xx, si la sesión vuelve
   a `/login` a mitad del recorrido o si un rol prueba menos de 3 pantallas (al paid trafficker casi todo lo redirige).
   Una pantalla que responde 4xx es una que el rol no tiene (ADR 0082): no se prueba, y lo que la página de 404
   deja en la consola no cuenta.
3. **Las escrituras se cortan en la red.** Toda petición que no sea GET se aborta antes de salir del navegador, así
   que ninguna server action ni formulario llega al servidor aunque el humo pulse "Guardar". El rastro que deja ese
   corte se perdona solo si el recurso que falló es uno que el humo abortó. Lo que una página escribe **al
   renderizar un GET** sí ocurre (abrir la ficha de un deal propio lo marca visto), y por eso:
4. **Corre solo contra `npm run dev:local`**, la base de Docker. La configuración no levanta el servidor por su cuenta,
   y el login que usa (`#email-local`) no existe contra producción.
5. **Un rol que la base no tiene falla, no se salta.** Se re-siembra con `npm run db:local` (el seed crea los cuatro) o
   se eligen roles con `HUMO_ROLES`.
6. **Dos tamaños:** escritorio (1440×900) y celular (Pixel 7).
7. **No entran tests de componente.** Si un día hace falta probar lógica de un componente, se extrae a una función
   pura de `lib/` y se prueba con Vitest, como ya se hace.
8. **El humo no es bloqueante todavía.** Corre en local antes de empujar un cambio de pantalla. Meterlo al CI (con
   Postgres y `next dev` en el runner) queda como paso siguiente.

## Consecuencias

- Un error de contexto de Base UI al abrir un menú, un select o un diálogo ya no depende de que alguien haga clic.
- Lo que el humo **no** ve: que un botón haga lo que debe (solo ve que no rompa), lo que pasa después de enviar (la
  escritura se corta), un permiso (eso se sigue mordiendo forjando la petición) y la usabilidad. El recorrido a mano
  del 075 sigue para eso. Tampoco ve más de 80 botones distintos por pantalla.
- Paquete nuevo: `@playwright/test` (devDependency) y el navegador Chromium (`npx playwright install chromium`).

## Alternativas descartadas

| Opción | Por qué no |
|---|---|
| Tests de componente (Testing Library + jsdom) | Muchos tests para escribir y jsdom no reproduce Base UI: el bug que motivó esto podía seguir pasando |
| Seguir solo a mano | Es lo que ya falló: el recorrido no se repite en cada cambio |
