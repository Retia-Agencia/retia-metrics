import type { ProgramaVisible } from "@/lib/auth/alcance";
import type { Db } from "@/lib/db/tipos";
import type { EntradaDePeriodo } from "@/lib/periodo";
import { escaleraPorPrograma } from "@/lib/queries/escalera-todos";
import { leerVamosALlegar, type VamosALlegar as DatosVamosALlegar } from "@/lib/queries/vamos-a-llegar";
import { armarReporteDiario } from "@/lib/queries/reporte-diario";
import { vistaDealsContraAgendas } from "@/lib/queries/vista-deals-contra-agendas";
import { armarVistaDeTodos } from "@/lib/queries/vista-todos";
import { detallesDeOperacion, detallesDelDashboard } from "@/lib/queries/vista-metrica";

export type SeccionDelHubDeTodos = "hoy" | "comercial" | "pauta" | "dinero";

export interface EntradaDeDatosDelHub {
  programas: ProgramaVisible[];
  hoy: string;
  periodo: EntradaDePeriodo;
  origen: string;
  seccion: SeccionDelHubDeTodos;
  diaDelReporte: string;
  conListas: boolean;
}

export async function cargarDatosDeHub(db: Db, entrada: EntradaDeDatosDelHub) {
  const { programas, hoy, periodo, origen, seccion, diaDelReporte, conListas } = entrada;
  const esHoy = seccion === "hoy";
  const [vista, reportes] = await Promise.all([
    armarVistaDeTodos({ programas, hoy, periodo: esHoy ? { preset: "hoy" } : periodo, origen }, db),
    esHoy
      ? Promise.all(programas.map(async (programa) => ({
          programa: { id: programa.id, slug: programa.slug, nombre: programa.nombre },
          reporte: await armarReporteDiario({ programId: programa.id, dia: diaDelReporte }, db),
        })))
      : Promise.resolve([]),
  ]);

  // Antes eran componentes hermanos que React renderizaba a la vez: aquí corren en paralelo igual.
  const diaDeVamos = esHoy ? diaDelReporte : hoy;
  const [comercial, vamosALlegar] = await Promise.all([
    seccion === "comercial" ? cargarComercial(db, vista, hoy, origen, conListas) : Promise.resolve(null),
    // "¿Vamos a llegar?" sale en todas las secciones; en Hoy, con el día del reporte.
    Promise.all(programas.map(async (programa) => [programa.id, await leerVamosALlegar(programa.id, diaDeVamos, db)] as const))
      .then((pares) => new Map<string, DatosVamosALlegar>(pares)),
  ]);

  return { vista, reportes, comercial, vamosALlegar };
}

type VistaDeTodosCargada = Awaited<ReturnType<typeof armarVistaDeTodos>>;

async function cargarComercial(db: Db, vista: VistaDeTodosCargada, hoy: string, origen: string, conListas: boolean) {
  const [escalera, operaciones] = await Promise.all([
    escaleraPorPrograma({ programas: vista.programas.map((fila) => fila.programa), hoy, periodo: vista.periodo, origen, conListas }, db),
    Promise.all(vista.programas.map(async (fila) => {
      const datos = { programId: fila.programa.id, slug: fila.programa.slug, hoy, periodo: vista.periodo, claveCloser: null, origen };
      const [detalles, dealsContraAgendas, detallesOperacion] = await Promise.all([
        detallesDelDashboard(datos, db),
        vistaDealsContraAgendas(datos, db),
        detallesDeOperacion(datos, fila.dashboard.comparativo.map((comparacion) => comparacion.clave), db),
      ]);
      return { fila, detalles, dealsContraAgendas, detallesOperacion };
    })),
  ]);
  return { escalera, operaciones };
}

export type DatosDelHub = Awaited<ReturnType<typeof cargarDatosDeHub>>;
