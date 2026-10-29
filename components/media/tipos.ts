/**
 * Lo que el servidor le entrega a la pagina de media (tickets 316, 317 y 321). Todo llega
 * calculado: el link ya armado y el estado ya decidido; ninguna regla vive en el cliente.
 */
import type { EstadoDePieza } from "@/lib/media/estado-de-pieza";
export type { EstadoDePieza };

export interface PiezaVista {
  id: string;
  nombre: string;
  creador: string;
  programa: string | null;
  tipo: string;
  red: string | null;
  cta: string | null;
  fecha: string | null;
  permanente: boolean;
  estado: EstadoDePieza;
  /** El link ya armado, o el porque no hay. */
  link: { ok: true; url: string; desglose: { nombre: string; valor: string }[] } | { ok: false; motivo: string };
}

export interface CreadorOpcion {
  id: string;
  nombre: string;
  programa: string | null;
}

export interface OpcionesDeMedia {
  redes: readonly string[];
  tipos: { id: string; nombre: string }[];
  programas: { id: string; nombre: string }[];
  /** Los creadores activos, para elegir en el formulario de pieza. */
  creadores: (CreadorOpcion & { slug: string })[];
  /** Solo quien no tiene el alcance limitado puede crear un creador sin programa. */
  conSinPrograma: boolean;
  /** El programa elegido en el selector: prellena el del creador nuevo. */
  programaInicial: string;
  /** `utm_medium` de todo link de contenido: constante del codigo, solo se muestra. */
  medioDeContenido: string;
}

export interface CreadorConLinksVista {
  id: string;
  nombre: string;
  programa: string | null;
  activo: boolean;
  links: {
    id: string;
    red: string | null;
    link: PiezaVista["link"];
  }[];
}
