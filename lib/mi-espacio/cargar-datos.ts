import type { Rol } from "@/lib/auth/roles";
import { programasVisibles, programaVisiblePorSlug } from "@/lib/auth/alcance";
import { enlacesDeCaptacion } from "@/lib/atribucion/captacion-del-closer";
import { cuentasPorPrograma } from "@/lib/calendly/cuentas";
import { membresiasConCalendlyDe } from "@/lib/catalogo/usuarios";
import type { Db } from "@/lib/db/tipos";
import { listarTokensPersonales } from "@/lib/mcp/token";
import type { SeccionMiEspacio } from "@/lib/mi-espacio/secciones";
import { listarConexionesOauth } from "@/lib/oauth/conexiones";
import { elegirPrograma } from "@/lib/programa-preferido";
import { programasActivos } from "@/lib/queries/programas";
import { cargarDatosDeCanales } from "@/lib/mi-espacio/datos-canales";
import { cargarDatosDeMetricas } from "@/lib/mi-espacio/datos-metricas";
import { cargarDatosDePorDecidir } from "@/lib/mi-espacio/datos-por-decidir";
import { cargarDatosDeMiDia } from "@/lib/mi-espacio/datos-mi-dia";

type Busqueda = Record<string, string | string[] | undefined>;

interface EntradaDeMiEspacio {
  userId: string;
  rol: Rol;
  puedeTrabajar: boolean;
  puedeConectarIa: boolean;
  puedeCrearToken: boolean;
  cargarProgramasVisibles: boolean;
  seccion: SeccionMiEspacio | null;
  programaPedido?: string;
  programaPreferido?: string | null;
  busqueda: Busqueda;
  hoy: string;
  origen: string;
}

type ProgramaElegido = { id: string; slug: string; nombre: string };

/** Los datos de la tab elegida; los mismos argumentos que cada tab usaba al leer por su cuenta. */
async function cargarDatosDeSeccion(db: Db, entrada: EntradaDeMiEspacio, programa: ProgramaElegido | null) {
  switch (entrada.seccion?.id) {
    case "mi-dia":
      return programa
        ? {
            id: "mi-dia" as const,
            datos: await cargarDatosDeMiDia(db, {
              programId: programa.id,
              userId: entrada.userId,
              hoy: entrada.hoy,
              busqueda: entrada.busqueda,
            }),
          }
        : null;
    case "metricas":
      if (!programa) return null;
      return {
        id: "metricas" as const,
        datos: await cargarDatosDeMetricas(db, {
          programa,
          closerUserId: entrada.userId,
          hoy: entrada.hoy,
          busqueda: entrada.busqueda,
          origen: entrada.origen,
        }),
      };
    case "canales":
      return { id: "canales" as const, datos: await cargarDatosDeCanales(db) };
    case "por-decidir":
      return programa ? { id: "por-decidir" as const, datos: await cargarDatosDePorDecidir(db, programa.id) } : null;
    default:
      return null;
  }
}

export async function cargarDatosDeMiEspacio(db: Db, entrada: EntradaDeMiEspacio) {
  const conexionesIa = entrada.puedeConectarIa
    ? await Promise.all([
        listarConexionesOauth(db, entrada.userId),
        entrada.puedeCrearToken ? listarTokensPersonales(db, entrada.userId) : Promise.resolve([]),
      ])
    : [[], []] as const;

  const membresias = entrada.puedeTrabajar ? await membresiasConCalendlyDe(db, entrada.userId) : [];
  if (entrada.puedeTrabajar && membresias.length === 0) {
    return { conexionesIa, membresias, calendly: null, enlaces: [], visibles: [], programa: null, deSeccion: null };
  }
  // Sin sección la página solo muestra perfil y conexiones: no lee Calendly, enlaces ni programas.
  if (!entrada.seccion && !entrada.cargarProgramasVisibles) {
    return { conexionesIa, membresias, calendly: null, enlaces: [], visibles: [], programa: null, deSeccion: null };
  }

  let calendly = null;
  if (entrada.puedeTrabajar && entrada.seccion) {
    const programIds = membresias.map((membresia) => membresia.programId);
    const [programas, cuentas] = await Promise.all([
      programasActivos(db).then((activos) => activos.filter((programa) => programIds.includes(programa.id))),
      cuentasPorPrograma(db, programIds),
    ]);
    calendly = { programas, cuentas };
  }
  const enlaces = entrada.puedeTrabajar && entrada.seccion ? await enlacesDeCaptacion(db, entrada.userId) : [];

  let visibles: Awaited<ReturnType<typeof programasVisibles>> = entrada.cargarProgramasVisibles
    ? await programasVisibles(entrada.userId, entrada.rol, db)
    : [];
  let programa: Awaited<ReturnType<typeof programaVisiblePorSlug>> = null;
  if (entrada.seccion?.porPrograma) {
    if (!entrada.cargarProgramasVisibles) visibles = await programasVisibles(entrada.userId, entrada.rol, db);
    programa = entrada.programaPedido
      ? await programaVisiblePorSlug(entrada.userId, entrada.rol, entrada.programaPedido, db)
      : elegirPrograma(visibles, entrada.programaPreferido ?? null);
  }

  const deSeccion = programa || entrada.seccion?.id === "canales"
    ? await cargarDatosDeSeccion(db, entrada, programa)
    : null;

  return { conexionesIa, membresias, calendly, enlaces, visibles, programa, deSeccion };
}

export type DatosDeMiEspacio = Awaited<ReturnType<typeof cargarDatosDeMiEspacio>>;
