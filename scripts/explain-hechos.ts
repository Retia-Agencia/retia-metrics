import "./load-env";
import { abrirBaseDeScript } from "@/lib/db/cliente-de-script";
import { LOCAL_DB_URL, validarUrlLocal } from "./db-local-url";
import * as abonos from "../lib/queries/hechos/abono";
import * as agendas from "../lib/queries/hechos/agenda";
import * as citas from "../lib/queries/hechos/cita";
import * as envios from "../lib/queries/hechos/envio";
import * as gastos from "../lib/queries/hechos/gasto";
import * as ventas from "../lib/queries/hechos/venta";

interface ConsultaCapturada {
  nombre: string;
  sql: string;
  parametros: unknown[];
}

interface NodoPlan {
  "Node Type"?: string;
  "Relation Name"?: string;
  Plans?: NodoPlan[];
}

const TABLAS_GRANDES = new Set(["submissions", "calls", "deals", "abonos", "gasto_pauta"]);

/**
 * La siembra local actual tiene un volumen determinista y no acepta un factor 10x. Para probar ese
 * tamaño sin una migración, crea una base local desechable y repite allí los datos del seed con ids y
 * huellas nuevas; este script es deliberadamente de solo lectura y nunca multiplica filas ni crea índices.
 */
async function main() {
  validarUrlLocal(LOCAL_DB_URL);
  const capturadas: ConsultaCapturada[] = [];
  let nombreActual = "preparación";
  const { base, sql, cerrar } = abrirBaseDeScript(LOCAL_DB_URL, (texto, parametros) => {
    if (nombreActual !== "preparación") capturadas.push({ nombre: nombreActual, sql: texto, parametros });
  });

  try {
    const [programa] = await sql<{ id: string }>("select id from programs order by created_at limit 1");
    if (!programa) throw new Error("La base local no está sembrada. Ejecuta npm run db:local.");
    const alcance = {
      programId: programa.id,
      rango: { desde: "2020-01-01", hasta: "2030-12-31" },
    };
    const pagina = { limite: 20, offset: 0 } as const;

    const ejecutar = async (nombre: string, consulta: () => Promise<unknown>) => {
      nombreActual = nombre;
      await consulta();
    };
    await ejecutar("envíos agrupados", () => envios.agrupar(base, { ...alcance, agruparPor: ["dia"] }));
    await ejecutar("envíos listados", () => envios.listar(base, { ...alcance, pagina }));
    await ejecutar("agendas agrupadas", () => agendas.agrupar(base, { ...alcance, agruparPor: ["dia"] }));
    await ejecutar("agendas listadas", () => agendas.listar(base, { ...alcance, pagina }));
    await ejecutar("citas agrupadas", () => citas.agrupar(base, { ...alcance, agruparPor: ["dia"] }));
    await ejecutar("citas listadas", () => citas.listar(base, { ...alcance, pagina }));
    await ejecutar("ventas agrupadas", () => ventas.agrupar(base, { ...alcance, agruparPor: ["dia"] }));
    await ejecutar("ventas listadas", () => ventas.listar(base, { ...alcance, pagina }));
    await ejecutar("abonos agrupados", () => abonos.agrupar(base, { ...alcance, agruparPor: ["dia"] }));
    await ejecutar("abonos listados", () => abonos.listar(base, { ...alcance, pagina }));
    await ejecutar("gastos agrupados", () => gastos.agrupar(base, { ...alcance, agruparPor: ["dia"] }));
    await ejecutar("gastos listados", () => gastos.listar(base, { ...alcance, pagina }));

    const vistas = new Set<string>();
    const hallazgos: Array<{ consulta: string; tabla: string }> = [];
    for (const capturada of capturadas) {
      const clave = `${capturada.nombre}\n${capturada.sql}`;
      if (vistas.has(clave)) continue;
      vistas.add(clave);
      const filas = await sql<{ "QUERY PLAN": unknown }>(`EXPLAIN (FORMAT JSON) ${capturada.sql}`, capturada.parametros);
      const documento = filas[0]?.["QUERY PLAN"];
      const planRaiz = (typeof documento === "string" ? JSON.parse(documento) : documento) as Array<{ Plan: NodoPlan }>;
      const visitar = (nodo: NodoPlan | undefined) => {
        if (!nodo) return;
        if (nodo["Node Type"] === "Seq Scan" && nodo["Relation Name"] && TABLAS_GRANDES.has(nodo["Relation Name"])) {
          hallazgos.push({ consulta: capturada.nombre, tabla: nodo["Relation Name"] });
        }
        nodo.Plans?.forEach(visitar);
      };
      visitar(planRaiz[0]?.Plan);
    }

    console.log(`${vistas.size} consultas de hechos explicadas contra ${new URL(LOCAL_DB_URL).hostname}.`);
    if (hallazgos.length === 0) console.log("Sin Seq Scan sobre tablas grandes.");
    else console.table(hallazgos);
  } finally {
    await cerrar();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
