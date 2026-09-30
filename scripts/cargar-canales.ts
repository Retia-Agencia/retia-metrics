import "./load-env";
import { db } from "../lib/db";
import { areas } from "../lib/catalogo/areas";
import { canales, type EntradaCanal } from "../lib/catalogo/canales";
import { actorDelScript } from "./actor";

type Definicion = Omit<EntradaCanal, "areaId" | "nombre"> & { area: string; nombre?: string };

const DEFINICIONES: readonly Definicion[] = [
  { utmSource: "", utmMedium: "paid_social", area: "Paid", formato: "plantilla_pauta", nombre: "Meta (cualquier source) / paid_social" },
  { utmSource: "facebook", utmMedium: "cpc", area: "Paid", formato: "meta_historico" },
  { utmSource: "fb", utmMedium: "paid", area: "Paid", formato: null },
  { utmSource: "closer", utmMedium: "referido", area: "Referidos", formato: "closer" },
  { utmSource: "direct", utmMedium: "organic", area: "Orgánico", formato: null },
  ...["linktree", "stories", "manychat", "storiesfijadas", "dm"].flatMap((utmMedium) => [
    { utmSource: "instagram rosario", utmMedium, area: "Orgánico", formato: null },
    { utmSource: "instagram milena", utmMedium, area: "Orgánico", formato: null },
  ]),
  ...["linktree", "stories", "manychat", "storiesfijadas", "dm", "storiesmanychat"].map((utmMedium) => ({ utmSource: "instagram", utmMedium, area: "Orgánico", formato: null })),
  { utmSource: "tiktok", utmMedium: "linktree", area: "Orgánico", formato: null },
  { utmSource: "tiktok", utmMedium: "manychat", area: "Orgánico", formato: null },
  { utmSource: "youtube", utmMedium: "linktree", area: "Orgánico", formato: null },
  { utmSource: "whatsapp rosario", utmMedium: "chat", area: "Orgánico", formato: null },
  { utmSource: "leadmagnetdiagnostico", utmMedium: "pdf", area: "Orgánico", formato: null },
];

const clave = (source: unknown, medium: unknown) => `${String(source ?? "").trim().toLowerCase()}\u0000${String(medium).trim().toLowerCase()}`;

async function main() {
  const actor = await actorDelScript(db);
  const filasAreas = await areas(db).listar({ soloActivos: true });
  const porNombre = new Map(filasAreas.map((area) => [String(area.nombre).trim().toLowerCase(), area.id]));
  for (const requerida of ["Paid", "Orgánico", "Referidos"]) {
    if (!porNombre.has(requerida.toLowerCase())) throw new Error(`Falta el área activa "${requerida}".`);
  }

  const cat = canales(db);
  const existentes = new Set((await cat.listar()).map((canal) => clave(canal.utmSource, canal.utmMedium)));
  for (const definicion of DEFINICIONES) {
    const par = clave(definicion.utmSource, definicion.utmMedium);
    const nombre = definicion.nombre ?? `${definicion.utmSource} / ${definicion.utmMedium}`;
    if (existentes.has(par)) {
      console.log(`  = ${nombre}`);
      continue;
    }
    await cat.crear(actor, {
      nombre,
      utmSource: definicion.utmSource,
      utmMedium: definicion.utmMedium,
      areaId: porNombre.get(definicion.area.toLowerCase())!,
      formato: definicion.formato,
    });
    existentes.add(par);
    console.log(`  + ${nombre}`);
  }
  process.exit(0);
}

main().catch((error) => { console.error(error); process.exit(1); });
