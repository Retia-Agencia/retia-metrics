import { permanentRedirect } from "next/navigation";

/**
 * `/documentos` se renombro a `/recursos` (ticket 023). No queda nada que conservar
 * de la pantalla vieja (era solo un `ProximaFase`), asi que la ruta redirige de forma
 * PERMANENTE: cualquier enlace o marcador viejo aterriza en la pantalla nueva y los
 * buscadores/navegadores actualizan la URL. El guard de rol lo pone `/recursos`.
 */
export default function DocumentosPage() {
  permanentRedirect("/recursos");
}
