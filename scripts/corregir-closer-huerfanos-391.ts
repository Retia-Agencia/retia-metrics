import "./load-env";
import { and, count, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { db } from "../lib/db";
import { abonos, calls, deals, users } from "../lib/db/schema";
import { editarConRastro } from "../lib/crm/rastro";
import { normalizarCloserId, mismoCloser } from "../lib/closers/identidad";
import { vigente } from "../lib/queries/vigente";
import { actorDelScript } from "./actor";

/**
 * Ticket 391, fase A (auditoria 385 F3-05 y F3-07). SCRIPT DESECHABLE: se corre una vez y se borra.
 *
 *   npx tsx scripts/corregir-closer-huerfanos-391.ts                      # ensayo (por defecto, no escribe)
 *   npx tsx scripts/corregir-closer-huerfanos-391.ts --aplicar            # escribe lo inequivoco
 *   npx tsx scripts/corregir-closer-huerfanos-391.ts --aplicar \
 *       --decision <idDeAbonoODeal>=<userId>                              # la decision de Mani en un caso ambiguo
 *
 * Que corrige (siempre por `editarConRastro`, nunca un UPDATE a mano: cada campo deja su fila
 * en `change_log`):
 *  - abonos vigentes sin `registrado_por_user_id` cuyo `closer_id` (texto) NINGUN usuario resuelve (`mismoCloser`, ADR 0030):
 *    se escribe `registrado_por_user_id` (la identidad real; `claveCloserSql` le da prioridad sobre el
 *    texto) para que el comparativo deje de ver un fantasma. El texto historico no se toca.
 *  - ventas vigentes (Abonado o Completo) sin `owner_user_id`: se escribe el dueno.
 *
 * Nunca adivina. Un destino es inequivoco solo si TODAS las pistas que existen apuntan a UNA
 * persona; si no, el caso se lista con sus candidatos y espera `--decision`.
 */

type Pista = { userId: string; fuente: string };
type Candidato = { userId: string; nombre: string | null; fuentes: string[] };

function parseDecisiones(): Map<string, string> {
  const mapa = new Map<string, string>();
  const args = process.argv;
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== "--decision") continue;
    const [id, userId] = (args[i + 1] ?? "").split("=");
    if (!id || !userId) throw new Error("--decision exige <id>=<userId>.");
    mapa.set(id, userId);
  }
  return mapa;
}

function agrupar(pistas: Pista[], nombres: Map<string, string | null>): Candidato[] {
  const por = new Map<string, string[]>();
  for (const p of pistas) por.set(p.userId, [...(por.get(p.userId) ?? []), p.fuente]);
  return [...por.entries()].map(([userId, fuentes]) => ({ userId, nombre: nombres.get(userId) ?? null, fuentes }));
}

async function conteos() {
  const todosLosClosers = await db
    .select({ id: users.id, closerId: users.closerId })
    .from(users)
    .where(isNotNull(users.closerId));
  const abonosConTexto = await db
    .select({ id: abonos.id, closerId: abonos.closerId })
    .from(abonos)
    .where(and(vigente(abonos), isNotNull(abonos.closerId), isNull(abonos.registradoPorUserId)));
  const huerfanos = abonosConTexto.filter((a) => !todosLosClosers.some((u) => mismoCloser(u.closerId, a.closerId))).length;
  const [{ n: ventasSinDueno }] = await db
    .select({ n: count() })
    .from(deals)
    .where(
      and(
        vigente(deals),
        inArray(deals.etapa, ["ganado_parcial", "ganado_completo"]),
        isNull(deals.ownerUserId),
      ),
    );
  return { abonosHuerfanos: huerfanos, ventasSinDueno: Number(ventasSinDueno) };
}

async function main() {
  const aplicar = process.argv.includes("--aplicar");
  const decisiones = parseDecisiones();
  const ref = process.env.DATABASE_URL?.match(/postgres\.([a-z0-9]+)[:@]/)?.[1] ?? "sin ref";
  console.log(`Base: ${ref} · ${aplicar ? "APLICANDO" : "ensayo (no escribe)"}`);
  const actorId = await actorDelScript(db);

  const antes = await conteos();
  console.log(`ANTES · abonos con closer sin usuario: ${antes.abonosHuerfanos} · ventas vigentes sin dueno: ${antes.ventasSinDueno}`);

  const usuarios = await db
    .select({ id: users.id, nombre: users.nombre, email: users.email, closerId: users.closerId, activo: users.activo })
    .from(users);
  const nombres = new Map(usuarios.map((u) => [u.id, u.nombre ?? u.email]));
  const porId = new Map(usuarios.map((u) => [u.id, u]));
  const pendientes: string[] = [];

  // ---- F3-05: abonos con closer fantasma ----
  const abonosVivos = await db
    .select({
      id: abonos.id,
      dealId: abonos.dealId,
      closerId: abonos.closerId,
      registradoPor: abonos.registradoPorUserId,
      fecha: abonos.fecha,
      monto: abonos.monto,
      moneda: abonos.moneda,
    })
    .from(abonos)
    .where(and(vigente(abonos), isNotNull(abonos.closerId), isNull(abonos.registradoPorUserId)));
  const huerfanos = abonosVivos.filter((a) => !usuarios.some((u) => mismoCloser(u.closerId, a.closerId)));

  console.log(`\n== Abonos con closer sin usuario resoluble: ${huerfanos.length} ==`);
  for (const a of huerfanos) {
    const pistas: Pista[] = [];
    if (a.registradoPor) pistas.push({ userId: a.registradoPor, fuente: "registrado_por_user_id del abono" });
    const [deal] = await db.select({ owner: deals.ownerUserId }).from(deals).where(eq(deals.id, a.dealId));
    if (deal?.owner) pistas.push({ userId: deal.owner, fuente: "dueno del deal" });
    // Parecido de texto: pista, nunca prueba. El texto huerfano contenido en el nombre o el correo de UN usuario.
    const clave = normalizarCloserId(a.closerId) ?? "";
    for (const u of usuarios) {
      const hay = `${normalizarCloserId(u.nombre) ?? ""} ${u.email.toLowerCase()}`;
      if (clave.length >= 3 && hay.includes(clave)) pistas.push({ userId: u.id, fuente: "texto parecido al nombre/correo" });
    }
    const candidatos = agrupar(pistas, nombres);
    const decidido = decisiones.get(a.id);
    const unico = candidatos.length === 1 ? candidatos[0] : null;
    const destino = decidido ? porId.get(decidido) : unico ? porId.get(unico.userId) : undefined;

    console.log(`- abono ${a.id} · deal ${a.dealId} · ${a.fecha} · ${a.monto} ${a.moneda} · closer_id="${a.closerId}"`);
    console.log(
      candidatos.length
        ? `    candidatos: ${candidatos.map((c) => `${c.userId} (${c.nombre}) por ${c.fuentes.join(" + ")}`).join(" | ")}`
        : "    candidatos: ninguno",
    );
    if (!destino) {
      console.log("    -> SIN destino inequivoco: decide Mani (--decision <abono>=<userId>)");
      pendientes.push(a.id);
      continue;
    }
    console.log(`    -> ${decidido ? "decision de Mani" : "inequivoco"}: registrado_por_user_id = ${destino.id} (${destino.nombre ?? destino.email}); el texto "${a.closerId}" se conserva como historia`);
    if (aplicar) {
      const ok = await editarConRastro(
        { db, tabla: abonos, nombreTabla: "abonos", actorId, etiqueta: `Abono ${a.fecha} ${a.monto} ${a.moneda}` },
        a.id,
        { registradoPorUserId: destino.id },
      );
      console.log(ok ? "    escrito" : "    sin cambio");
    }
  }

  // ---- F3-07: ventas vigentes sin dueno ----
  const ventas = await db
    .select({ id: deals.id, etapa: deals.etapa, valor: deals.valorVendidoUsd, cohortId: deals.cohortId, programId: deals.programId })
    .from(deals)
    .where(and(vigente(deals), inArray(deals.etapa, ["ganado_parcial", "ganado_completo"]), isNull(deals.ownerUserId)));

  console.log(`\n== Ventas vigentes sin dueno: ${ventas.length} ==`);
  for (const v of ventas) {
    const pistas: Pista[] = [];
    const llamadas = await db
      .select({ u: calls.closerUserId, texto: calls.closerId })
      .from(calls)
      .where(and(vigente(calls), eq(calls.dealId, v.id)));
    for (const l of llamadas) {
      if (l.u) pistas.push({ userId: l.u, fuente: "closer_user_id de una llamada" });
      else if (l.texto) {
        const u = usuarios.filter((x) => mismoCloser(x.closerId, l.texto));
        if (u.length === 1) pistas.push({ userId: u[0].id, fuente: "closer_id (texto) de una llamada" });
      }
    }
    const pagos = await db
      .select({ r: abonos.registradoPorUserId, texto: abonos.closerId })
      .from(abonos)
      .where(and(vigente(abonos), eq(abonos.dealId, v.id)));
    for (const p of pagos) {
      if (p.r) pistas.push({ userId: p.r, fuente: "registrado_por_user_id de un abono" });
      else if (p.texto) {
        const u = usuarios.filter((x) => mismoCloser(x.closerId, p.texto));
        if (u.length === 1) pistas.push({ userId: u[0].id, fuente: "closer_id (texto) de un abono" });
      }
    }
    const candidatos = agrupar(pistas, nombres);
    const decidido = decisiones.get(v.id);
    const unico = candidatos.length === 1 ? candidatos[0] : null;
    const destinoId = decidido ?? unico?.userId;

    console.log(`- deal ${v.id} · ${v.etapa} · valor ${v.valor ?? "sin valor"} · cohorte ${v.cohortId ?? "-"} · ${llamadas.length} llamadas, ${pagos.length} abonos`);
    console.log(
      candidatos.length
        ? `    candidatos: ${candidatos.map((c) => `${c.userId} (${c.nombre}) por ${c.fuentes.join(" + ")}`).join(" | ")}`
        : "    candidatos: ninguno",
    );
    if (!destinoId || !porId.has(destinoId)) {
      console.log("    -> SIN destino inequivoco: decide Mani (--decision <deal>=<userId>)");
      pendientes.push(v.id);
      continue;
    }
    console.log(`    -> ${decidido ? "decision de Mani" : "inequivoco"}: dueno = ${destinoId} (${nombres.get(destinoId)})`);
    if (aplicar) {
      const ok = await editarConRastro(
        { db, tabla: deals, nombreTabla: "deals", actorId, etiqueta: `Deal ${v.id}` },
        v.id,
        { ownerUserId: destinoId },
      );
      console.log(ok ? "    escrito" : "    sin cambio");
    }
  }

  const despues = await conteos();
  console.log(
    `\nDESPUES · abonos con closer sin usuario: ${despues.abonosHuerfanos} · ventas vigentes sin dueno: ${despues.ventasSinDueno}` +
      (aplicar ? "" : " (ensayo: nada cambio)"),
  );
  if (pendientes.length) console.log(`Pendientes de decision (${pendientes.length}): ${pendientes.join(", ")}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
