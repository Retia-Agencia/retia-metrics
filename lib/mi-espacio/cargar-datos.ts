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
    return { conexionesIa, membresias, calendly: null, enlaces: [], visibles: [], programa: null };
  }

  let calendly = null;
  if (entrada.puedeTrabajar) {
    const programIds = membresias.map((membresia) => membresia.programId);
    const [programas, cuentas] = await Promise.all([
      programasActivos(db).then((activos) => activos.filter((programa) => programIds.includes(programa.id))),
      cuentasPorPrograma(db, programIds),
    ]);
    calendly = { programas, cuentas };
  }
  const enlaces = entrada.puedeTrabajar ? await enlacesDeCaptacion(db, entrada.userId) : [];

  let visibles: Awaited<ReturnType<typeof programasVisibles>> = entrada.cargarProgramasVisibles
    ? await programasVisibles(entrada.userId, entrada.rol, db)
    : [];
  let programa: Awaited<ReturnType<typeof programaVisiblePorSlug>> = null;
  if (entrada.seccion?.usaSelectorDePrograma) {
    if (!entrada.cargarProgramasVisibles) visibles = await programasVisibles(entrada.userId, entrada.rol, db);
    programa = entrada.seccion.id === "metricas" && entrada.programaPedido === "todos"
      ? null
      : entrada.programaPedido
      ? await programaVisiblePorSlug(entrada.userId, entrada.rol, entrada.programaPedido, db)
      : elegirPrograma(visibles, entrada.programaPreferido ?? null);
  }

  return { conexionesIa, membresias, calendly, enlaces, visibles, programa };
}

export type DatosDeMiEspacio = Awaited<ReturnType<typeof cargarDatosDeMiEspacio>>;
