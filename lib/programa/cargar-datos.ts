import type { Rol } from "@/lib/auth/roles";
import { administraUsuarios, configuraPrograma } from "@/lib/auth/roles";
import { cuentasPorPrograma } from "@/lib/calendly/cuentas";
import { membresiasConCalendly, listarUsuarios } from "@/lib/catalogo/usuarios";
import { cuentasDelPrograma, cuentasDisponibles } from "@/lib/catalogo/meta";
import { cuposSinAsignar, objetivosDeCohortes } from "@/lib/catalogo/objetivos";
import { reporteDelPrograma } from "@/lib/catalogo/reportes-whatsapp";
import { umbralesDelPrograma } from "@/lib/catalogo/umbrales";
import type { Db } from "@/lib/db/tipos";
import { estadoDeIntegraciones } from "@/lib/integraciones";
import { resumenMetaCapi } from "@/lib/meta-capi/resumen";
import { hechosDeConfiguracion } from "@/lib/programas/hechos";
import { pasosDeConfiguracion, seccionDeLaFicha } from "@/lib/programas/configuracion";
import { fichaDelPrograma, fuentesDelProgramaParaAdmin } from "@/lib/queries/ficha-programa";
import { costoPorAgendaDeLosUltimosHabiles } from "@/lib/semaforo/costo-por-agenda";
import { vistaPreviaDelReporte } from "@/lib/reporte-whatsapp/vista-previa";

type Busqueda = Record<string, string | string[] | undefined>;
type CargarCuentasDisponibles = typeof cuentasDisponibles;
const uno = (valor: string | string[] | undefined) => Array.isArray(valor) ? valor[0] : valor;

export async function cargarDatosDePrograma(db: Db, entrada: {
  visibleId: string;
  userId: string;
  rol: Rol | null;
  busqueda: Busqueda;
  hoy: string;
  origen: string;
  ahora: Date;
  cargarCuentasDisponibles?: CargarCuentasDisponibles;
}) {
  const ficha = await fichaDelPrograma(entrada.visibleId, db);
  if (!ficha) return null;
  const configura = configuraPrograma(entrada.rol);
  const puedeAgregarMiembros = administraUsuarios(entrada.rol);
  const { programa, cohortes } = ficha;
  const enRecorrido = !programa.activo && configura;
  const activa = cohortes.find((cohorte) => cohorte.estado === "activo") ?? null;
  const pasos = pasosDeConfiguracion(await hechosDeConfiguracion(db, programa.id));
  const [fuentesAdmin, membresias, usuarios, cuentas] = configura
    ? await Promise.all([
        fuentesDelProgramaParaAdmin(programa.id, db),
        membresiasConCalendly(db, programa.id),
        puedeAgregarMiembros ? listarUsuarios(db, { id: entrada.userId, rol: entrada.rol }) : Promise.resolve([]),
        cuentasPorPrograma(db, [programa.id]),
      ])
    : [null, [], [], {}];
  const pedida = seccionDeLaFicha(uno(entrada.busqueda.seccion));
  const seccion = pedida === "ventas" || (configura && pedida === "integraciones") ? pedida : "programa";
  const umbrales = seccion === "ventas" ? await umbralesDelPrograma(db, programa.id) : [];
  const objetivos = seccion === "ventas" ? await objetivosDeCohortes(db, cohortes.map((cohorte) => cohorte.id)) : [];
  const costoReciente = seccion === "ventas" ? await costoPorAgendaDeLosUltimosHabiles(db, { programId: programa.id, hoy: entrada.hoy, dias: 7 }) : null;
  const sinAsignar = seccion === "ventas" ? await Promise.all(cohortes.map((cohorte) => cuposSinAsignar(db, cohorte.id))) : cohortes.map(() => 0);
  const cargarIntegraciones = seccion === "integraciones" || enRecorrido;
  const estadosIntegraciones = cargarIntegraciones ? await estadoDeIntegraciones(db, programa.id) : [];
  const resumenCapi = cargarIntegraciones ? await resumenMetaCapi(db, programa.id) : { enviado: 0, fallido: 0, vencido: 0, omitido: 0, enviadosConFbc: 0, enviadosTotal: 0 };
  const metaConectada = estadosIntegraciones.find((estado) => estado.tipo === "meta")?.configurada ?? false;
  const cargarDisponibles = entrada.cargarCuentasDisponibles ?? cuentasDisponibles;
  const [cuentasMeta, consultaMeta] = cargarIntegraciones
    ? await Promise.all([
        cuentasDelPrograma(db, programa.id),
        configura && metaConectada
          ? cargarDisponibles(db, programa.id).then((disponibles) => ({ disponibles, error: null as string | null })).catch((error: unknown) => ({ disponibles: [], error: error instanceof Error ? error.message : "Error desconocido" }))
          : Promise.resolve({ disponibles: [], error: null as string | null }),
      ])
    : [[], { disponibles: [], error: null }];
  const [reporteWhatsapp, objetivosDelReporte] = seccion === "integraciones"
    ? await Promise.all([reporteDelPrograma(db, programa.id), activa ? objetivosDeCohortes(db, [activa.id]) : Promise.resolve([])])
    : [null, []];
  const vistaPrevia = seccion === "integraciones"
    ? await vistaPreviaDelReporte(db, { programId: programa.id, programa: programa.nombre, slug: programa.slug, origen: entrada.origen, ahora: entrada.ahora })
    : { dia: null, cierre: null, aviso: null };
  return { ficha, configura, puedeAgregarMiembros, enRecorrido, activa, pasos, fuentesAdmin, membresias, usuarios, cuentas, seccion, umbrales, objetivos, costoReciente, sinAsignar, estadosIntegraciones, resumenCapi, cuentasMeta, consultaMeta, reporteWhatsapp, objetivosDelReporte, vistaPrevia };
}
