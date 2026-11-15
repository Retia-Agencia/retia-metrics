import type { ProgramaVisible } from "@/lib/auth/alcance";
import type { Db } from "@/lib/db/tipos";
import type { EntradaDePeriodo } from "@/lib/periodo";
import { escaleraPorPrograma } from "@/lib/queries/escalera-todos";
import { origenDelPrograma } from "@/lib/queries/origen";
import { armarReporteDiario } from "@/lib/queries/reporte-diario";
import { cargarRoasDePauta } from "@/lib/queries/roas-de-pauta";
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

  const pauta = seccion === "pauta"
    ? await Promise.all(programas.map(async (programa) => ({
        programa,
        roas: await cargarRoasDePauta(db, programa.id, vista.periodo.a, hoy),
      })))
    : [];
  const origenes = seccion === "pauta"
    ? await Promise.all(programas.map(async (programa) => ({
        programa,
        vista: await origenDelPrograma(db, { programId: programa.id, rango: vista.periodo.a, hoy }),
      })))
    : [];

  let comercial: null | {
    escalera: Awaited<ReturnType<typeof escaleraPorPrograma>>;
    operaciones: Array<{
      fila: (typeof vista.programas)[number];
      detalles: Awaited<ReturnType<typeof detallesDelDashboard>>;
      dealsContraAgendas: Awaited<ReturnType<typeof vistaDealsContraAgendas>>;
      detallesOperacion: Awaited<ReturnType<typeof detallesDeOperacion>>;
    }>;
  } = null;
  if (seccion === "comercial") {
    const escalera = await escaleraPorPrograma({
      programas: vista.programas.map((fila) => fila.programa), hoy, periodo: vista.periodo, origen, conListas,
    }, db);
    const operaciones = await Promise.all(vista.programas.map(async (fila) => {
      const datos = { programId: fila.programa.id, slug: fila.programa.slug, hoy, periodo: vista.periodo, claveCloser: null, origen };
      const [detalles, dealsContraAgendas, detallesOperacion] = await Promise.all([
        detallesDelDashboard(datos, db),
        vistaDealsContraAgendas(datos, db),
        detallesDeOperacion(datos, fila.dashboard.comparativo.map((comparacion) => comparacion.clave), db),
      ]);
      return { fila, detalles, dealsContraAgendas, detallesOperacion };
    }));
    comercial = { escalera, operaciones };
  }

  return { vista, reportes, pauta, origenes, comercial };
}

export type DatosDelHub = Awaited<ReturnType<typeof cargarDatosDeHub>>;
