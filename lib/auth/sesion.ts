import { auth } from "./index";
import { memoizadaPorSolicitud } from "./solicitud";

/**
 * `auth()` una vez por request: el callback `jwt` revalida contra `users` en CADA
 * llamada (S-02), y el layout, `paginaConRol` y la pagina la repetian. Las guardas de
 * pagina y de servidor la importan de aqui, no de `./index`. En una server action no
 * memoiza (ver `solicitud.ts`).
 */
export const sesionDelRequest = memoizadaPorSolicitud(() => auth());
