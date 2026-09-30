import { eq } from "drizzle-orm";
import { existsSync, readFileSync } from "node:fs";
import { parse } from "dotenv";
import { db } from "../lib/db";
import { abonos, leads, programs, users } from "../lib/db/schema";
import { actorDelScript } from "./actor";
import { LOCAL_DB_URL, validarUrlLocal } from "./db-local-url";
import { crearPrograma, guardarTokenCalendly, reactivarPrograma } from "../lib/catalogo/programas";
import { crearCohorte } from "../lib/catalogo/cohortes";
import { crearProducto } from "../lib/catalogo/productos";
import { activarFuente, crearFuente, rotarSecretoDeFuente } from "../lib/catalogo/fuentes";
import { crearUsuario } from "../lib/catalogo/usuarios";
import { motivos } from "../lib/catalogo/motivos";
import { areas } from "../lib/catalogo/areas";
import { ingerirEntradas } from "../lib/ingesta/ingerir";
import type { EntradaEnvio } from "../lib/ingesta/envio";
import { abrirDeal, moverEtapa } from "../lib/deals/mover-etapa";
import { agregarLlamada, marcarFallida, pegarGrain } from "../lib/deals/llamadas";
import { crearConRastro } from "../lib/crm/rastro";

/**
 * Un PAT de Calendly para la base local (ticket 096), del entorno o de `.env.local`. De ese
 * archivo se lee SOLO esta llave, nunca el archivo entero: ahi esta el `DATABASE_URL` de
 * produccion, y este seed no debe verlo.
 */
function patLocal(nombre: string): string | undefined {
  const delEntorno = process.env[nombre]?.trim();
  if (delEntorno) return delEntorno;
  if (!existsSync(".env.local")) return undefined;
  const valor = parse(readFileSync(".env.local"))[nombre]?.trim();
  return valor ? valor : undefined;
}

/**
 * Semilla de datos de prueba para desarrollo local (Ticket 113).
 *
 * Características:
 *  - Trabaja sobre la base local de Docker (127.0.0.1:54329).
 *  - Posee guardia estricta contra producción.
 *  - Pasa 100% por las funciones de `lib/`:
 *      * Catálogo: `lib/catalogo/` (programas, cohortes, productos, fuentes, usuarios, motivos, áreas).
 *      * Leads: `ingerirEntradas` de `lib/ingesta/`.
 *      * Etapas: `abrirDeal` y `moverEtapa` de `lib/deals/`.
 *      * Llamadas: `agregarLlamada`, `pegarGrain`, `marcarFallida` de `lib/deals/llamadas`.
 *      * Abonos: `crearConRastro` con registro en `change_log`.
 *  - Idempotencia: comprueba si la base ya tiene datos antes de sembrar; no duplica.
 *  - Cero datos reales de producción (todos ficticios con dominio `.local`).
 */

const CAMPOS_MAPEO = {
  token: "Token",
  correo: "Correo",
  telefono: "WhatsApp",
  nombre: "Nombre completo",
  fechaEnvio: "Submitted At",
  estadoHoja: "Estado",
  utmSource: "utm_source",
  utmMedium: "utm_medium",
  utmCampaign: "utm_campaign",
} as const;

function entradaDePrueba(
  fuenteId: string,
  o: {
    token: string;
    correo: string;
    nombre: string;
    telefono: string;
    estado: string;
    fecha?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
  },
): EntradaEnvio {
  return {
    sourceId: fuenteId,
    zona: "America/Bogota",
    posicion: null,
    columnas: {
      Token: o.token,
      Correo: o.correo,
      WhatsApp: o.telefono,
      "Nombre completo": o.nombre,
      "Submitted At": o.fecha ?? "2026-09-20T10:00:00-05:00",
      Estado: o.estado,
      utm_source: o.utmSource ?? "meta",
      utm_medium: o.utmMedium ?? "cpc",
      utm_campaign: o.utmCampaign ?? "campana_lanzamiento",
    },
    campos: { ...CAMPOS_MAPEO },
  };
}

export async function sembrarLocal(): Promise<void> {
  // 1. Guardia de seguridad: la base TIENE que ser local
  const urlDestino = process.env.DATABASE_URL ?? LOCAL_DB_URL;
  validarUrlLocal(urlDestino);
  // `npm run seed:local` suelto no trae DATABASE_URL: el cliente de lib/db es perezoso
  // y la lee al primer uso, asi que fijarla aqui basta.
  process.env.DATABASE_URL = urlDestino;

  console.log(`[seed:local] Iniciando siembra contra: ${urlDestino}`);

  // 2. Comprobar si ya fue sembrada (Idempotencia)
  const programasPrevios = await db.select().from(programs);
  if (programasPrevios.length >= 2) {
    console.log("[seed:local] La base de datos ya contiene programas sembrados.");
    console.log("             Omitiendo siembra para no duplicar datos.");
    console.log("             (Para reiniciar de cero: docker compose down -v && npm run db:local)");
    return;
  }

  // 3. Bootstrap del usuario actor en users (excepción de base vacía ADR 0029)
  const correoActor = (process.env.SCRIPT_ACTOR_EMAIL ?? "dev@retia.local").trim().toLowerCase();
  const [actorExistente] = await db.select().from(users).where(eq(users.email, correoActor)).limit(1);

  if (!actorExistente) {
    await db.insert(users).values({
      email: correoActor,
      nombre: "Developer Local",
      rol: "developer",
      activo: true,
    });
    console.log(`[seed:local] Usuario actor creado: ${correoActor}`);
  }

  process.env.SCRIPT_ACTOR_EMAIL = correoActor;
  const actorId = await actorDelScript(db);
  const actor = { id: actorId, rol: "developer" as const };

  // 4. Catálogo de Motivos (requeridos para transiciones de etapas)
  console.log("[seed:local] Configurando catálogo de motivos...");
  const catMotivos = motivos(db);
  const motivosExistentes = await catMotivos.listar();
  const mapaMotivos = new Map<string, string>();
  for (const m of motivosExistentes) {
    mapaMotivos.set(`${m.tipo}|${m.nombre}`, m.id);
  }

  const MOTIVOS_BASE = [
    { tipo: "perdida" as const, nombre: "Sin dinero para invertir ahora" },
    { tipo: "perdida" as const, nombre: "El programa no se ajusta a su nivel o necesidad" },
    { tipo: "reagenda" as const, nombre: "Faltó tiempo para terminar la llamada" },
    { tipo: "reagenda" as const, nombre: "Tiene que estar quien toma la decisión" },
    { tipo: "retroceso" as const, nombre: "Necesita más tiempo para pensarlo" },
    { tipo: "recuperacion" as const, nombre: "Volvió a mostrar interés" },
  ];

  for (const m of MOTIVOS_BASE) {
    const clave = `${m.tipo}|${m.nombre}`;
    if (!mapaMotivos.has(clave)) {
      const creado = await catMotivos.crear(actorId, m);
      mapaMotivos.set(clave, creado.id);
    }
  }

  // 4b. Catálogo global de Áreas
  console.log("[seed:local] Configurando catálogo de áreas...");
  const catAreas = areas(db);
  const areasExistentes = await catAreas.listar();
  const nombresDeAreas = new Set(
    areasExistentes.map((area) => String(area.nombre).toLowerCase()),
  );
  const AREAS_BASE = ["Paid", "Orgánico", "Referidos"];

  for (const nombre of AREAS_BASE) {
    if (!nombresDeAreas.has(nombre.toLowerCase())) {
      await catAreas.crear(actorId, { nombre });
    }
  }

  // 5. Dos Programas activos. El token de Calendly de cada uno sale de
  // CALENDLY_PAT_LOCAL_COMUNICARTE / CALENDLY_PAT_LOCAL_TACTICAL si estan (ver .env.example):
  // con un PAT real, las pantallas que leen Calendly (la cuenta por membresia en
  // /ajustes/usuarios, ticket 096) funcionan en local. Sin ellos va un token de mentira y
  // esas pantallas muestran el rechazo de Calendly, que es lo correcto.
  console.log("[seed:local] Creando programas activos...");
  const p1 = await crearPrograma(db, actorId, {
    nombre: "ComunicArte Local",
    slug: "comunicarte-local",
    ticketUsd: "797.00",
    formUrl: "https://form.typeform.com/to/comunicarte-demo",
  });
  await guardarTokenCalendly(
    db,
    actorId,
    p1.id,
    patLocal("CALENDLY_PAT_LOCAL_COMUNICARTE") ?? "calendly-token-local-comunicarte",
  );
  const prog1 = await reactivarPrograma(db, actorId, p1.id);

  const p2 = await crearPrograma(db, actorId, {
    nombre: "Tactical Investor Local",
    slug: "tactical-local",
    ticketUsd: "1500.00",
    formUrl: "https://form.typeform.com/to/tactical-demo",
  });
  await guardarTokenCalendly(
    db,
    actorId,
    p2.id,
    patLocal("CALENDLY_PAT_LOCAL_TACTICAL") ?? "calendly-token-local-tactical",
  );
  const prog2 = await reactivarPrograma(db, actorId, p2.id);

  // 6. Cohortes activas
  console.log("[seed:local] Creando cohortes activas...");
  const coh1 = await crearCohorte(db, actorId, {
    programId: prog1.id,
    codigo: "C1",
    metaCupos: 30,
    precioUsd: "797.00",
    fechaInicioClases: "2026-11-01",
    fechaInicioVentas: "2026-09-01",
    fechaCierreVentas: "2026-10-31",
    trmCohorte: "4100.00",
    estado: "activo",
  });

  const coh2 = await crearCohorte(db, actorId, {
    programId: prog2.id,
    codigo: "C1",
    metaCupos: 50,
    precioUsd: "1500.00",
    fechaInicioClases: "2026-11-15",
    fechaInicioVentas: "2026-09-01",
    fechaCierreVentas: "2026-11-14",
    trmCohorte: "4100.00",
    estado: "activo",
  });

  // 7. Productos
  console.log("[seed:local] Creando productos...");
  const prod1Completo = await crearProducto(db, actor, {
    programId: prog1.id,
    nombre: "Programa Completo ComunicArte",
    precioLista: "797.00",
    moneda: "USD",
  });
  await crearProducto(db, actor, {
    programId: prog1.id,
    nombre: "Reserva de Cupo",
    precioLista: "400.00",
    moneda: "USD",
  });

  const prod2Completo = await crearProducto(db, actor, {
    programId: prog2.id,
    nombre: "Programa Completo Tactical",
    precioLista: "1500.00",
    moneda: "USD",
  });

  // 8. Fuentes Webhook activas
  console.log("[seed:local] Creando fuentes webhook activas...");
  const f1 = await crearFuente(db, actor, {
    programId: prog1.id,
    nombre: "Formulario Webhook ComunicArte",
    tipo: "webhook",
    proveedor: "typeform",
    mapeoColumnas: {},
  });
  await rotarSecretoDeFuente(db, actor, f1.id);
  await activarFuente(db, actor, f1.id);

  const f2 = await crearFuente(db, actor, {
    programId: prog2.id,
    nombre: "Formulario Webhook Tactical",
    tipo: "webhook",
    proveedor: "typeform",
    mapeoColumnas: {},
  });
  await rotarSecretoDeFuente(db, actor, f2.id);
  await activarFuente(db, actor, f2.id);

  // 9. Closers con membresía
  console.log("[seed:local] Creando closers con membresías...");
  const closer1 = await crearUsuario(db, actorId, {
    email: "carlos.closer@retia.local",
    nombre: "Carlos Closer",
    rol: "closer",
    closerId: "carlos",
    programas: [prog1.id, prog2.id],
  });

  const closer2 = await crearUsuario(db, actorId, {
    email: "maria.closer@retia.local",
    nombre: "María Closer",
    rol: "closer",
    closerId: "maria",
    programas: [prog1.id],
  });

  // 10. Leads vía ingerirEntradas
  console.log("[seed:local] Ingiriendo leads por la puerta oficial (ingerirEntradas)...");
  const entradasProg1: EntradaEnvio[] = [
    entradaDePrueba(f1.id, {
      token: "tok-p1-1",
      correo: "andrea.morales@ejemplo.local",
      nombre: "Andrea Morales",
      telefono: "+573001110001",
      estado: "setteo_no_calificado",
    }),
    entradaDePrueba(f1.id, {
      token: "tok-p1-2",
      correo: "bernardo.gomez@ejemplo.local",
      nombre: "Bernardo Gómez",
      telefono: "+573001110002",
      estado: "setteo_no_calificado",
    }),
    entradaDePrueba(f1.id, {
      token: "tok-p1-3",
      correo: "camilo.rodriguez@ejemplo.local",
      nombre: "Camilo Rodríguez",
      telefono: "+573001110003",
      estado: "con_calendly",
    }),
    entradaDePrueba(f1.id, {
      token: "tok-p1-4",
      correo: "diana.castro@ejemplo.local",
      nombre: "Diana Castro",
      telefono: "+573001110004",
      estado: "con_calendly",
    }),
    entradaDePrueba(f1.id, {
      token: "tok-p1-5",
      correo: "esteban.duque@ejemplo.local",
      nombre: "Esteban Duque",
      telefono: "+573001110005",
      estado: "con_calendly",
    }),
    entradaDePrueba(f1.id, {
      token: "tok-p1-6",
      correo: "felipe.torres@ejemplo.local",
      nombre: "Felipe Torres",
      telefono: "+573001110006",
      estado: "con_calendly",
    }),
    entradaDePrueba(f1.id, {
      token: "tok-p1-7",
      correo: "gloria.vargas@ejemplo.local",
      nombre: "Gloria Vargas",
      telefono: "+573001110007",
      estado: "con_calendly",
    }),
    entradaDePrueba(f1.id, {
      token: "tok-p1-8",
      correo: "hector.sanchez@ejemplo.local",
      nombre: "Héctor Sánchez",
      telefono: "+573001110008",
      estado: "con_calendly",
    }),
    entradaDePrueba(f1.id, {
      token: "tok-p1-9",
      correo: "isabel.navarro@ejemplo.local",
      nombre: "Isabel Navarro",
      telefono: "+573001110009",
      estado: "setteo_no_calificado",
    }),
  ];

  const entradasProg2: EntradaEnvio[] = [
    entradaDePrueba(f2.id, {
      token: "tok-p2-1",
      correo: "jorge.perez@ejemplo.local",
      nombre: "Jorge Pérez",
      telefono: "+573002220001",
      estado: "con_calendly",
    }),
    entradaDePrueba(f2.id, {
      token: "tok-p2-2",
      correo: "karina.lopez@ejemplo.local",
      nombre: "Karina López",
      telefono: "+573002220002",
      estado: "setteo_no_calificado",
      utmSource: "google",
      utmMedium: "cpc",
    }),
    entradaDePrueba(f2.id, {
      token: "tok-p2-3",
      correo: "luis.mendoza@ejemplo.local",
      nombre: "Luis Mendoza",
      telefono: "+573002220003",
      estado: "con_calendly",
      utmSource: "google",
      utmMedium: "organic",
    }),
    entradaDePrueba(f2.id, {
      token: "tok-p2-4",
      correo: "marta.rios@ejemplo.local",
      nombre: "Marta Ríos",
      telefono: "+573002220004",
      estado: "con_calendly",
    }),
  ];

  await ingerirEntradas(db, prog1.id, entradasProg1, { aplicarReglaDeDeals: false });
  await ingerirEntradas(db, prog2.id, entradasProg2, { aplicarReglaDeDeals: false });

  // 11. Cargar leads recién creados
  const todosLeadsP1 = await db.select().from(leads).where(eq(leads.programId, prog1.id));
  const todosLeadsP2 = await db.select().from(leads).where(eq(leads.programId, prog2.id));

  const mapaLeads = new Map<string, typeof leads.$inferSelect>();
  for (const l of [...todosLeadsP1, ...todosLeadsP2]) {
    mapaLeads.set(l.emailNormalizado, l);
  }

  console.log("[seed:local] Creando deals y distribuyéndolos en varias etapas con llamadas y abonos...");

  // Deal 1 -> Etapa: pendiente_setteo
  const lead1 = mapaLeads.get("andrea.morales@ejemplo.local")!;
  await abrirDeal(db, {
    leadId: lead1.id,
    programId: prog1.id,
    etapa: "pendiente_setteo",
    actor: { tipo: "usuario", userId: closer1.id, rol: "closer" },
    ownerUserId: closer1.id,
    cohortId: coh1.id,
  });

  // Deal 2 -> Etapa: en_contacto
  const lead2 = mapaLeads.get("bernardo.gomez@ejemplo.local")!;
  await abrirDeal(db, {
    leadId: lead2.id,
    programId: prog1.id,
    etapa: "en_contacto",
    actor: { tipo: "usuario", userId: closer2.id, rol: "closer" },
    ownerUserId: closer2.id,
    cohortId: coh1.id,
  });

  // Deal 3 -> Etapa: agendado (vía agregarLlamada)
  const lead3 = mapaLeads.get("camilo.rodriguez@ejemplo.local")!;
  const deal3Id = await abrirDeal(db, {
    leadId: lead3.id,
    programId: prog1.id,
    etapa: "pendiente_setteo",
    actor: { tipo: "usuario", userId: closer1.id, rol: "closer" },
    ownerUserId: closer1.id,
    cohortId: coh1.id,
  });
  await agregarLlamada(
    db,
    { userId: closer1.id, rol: "closer" },
    {
      dealId: deal3Id,
      fechaAgenda: new Date("2026-10-02T15:00:00-05:00"),
      linkCalendly: "https://calendly.com/retia-demo/cita-camilo",
      notas: "Interesado en mejorar comunicación de equipo.",
    },
  );

  // Deal 4 -> Etapa: atendido (vía agregarLlamada + pegarGrain)
  const lead4 = mapaLeads.get("diana.castro@ejemplo.local")!;
  const deal4Id = await abrirDeal(db, {
    leadId: lead4.id,
    programId: prog1.id,
    etapa: "pendiente_setteo",
    actor: { tipo: "usuario", userId: closer1.id, rol: "closer" },
    ownerUserId: closer1.id,
    cohortId: coh1.id,
  });
  const resLlamada4 = await agregarLlamada(
    db,
    { userId: closer1.id, rol: "closer" },
    {
      dealId: deal4Id,
      fechaAgenda: new Date("2026-09-25T11:00:00-05:00"),
    },
  );
  await pegarGrain(
    db,
    { userId: closer1.id, rol: "closer" },
    {
      callId: resLlamada4.callId,
      linkGrain: "https://grain.com/share/recording-diana-demo",
    },
  );

  // Deal 5 -> Etapa: compromiso_verbal
  const lead5 = mapaLeads.get("esteban.duque@ejemplo.local")!;
  await abrirDeal(db, {
    leadId: lead5.id,
    programId: prog1.id,
    etapa: "compromiso_verbal",
    actor: { tipo: "usuario", userId: closer2.id, rol: "closer" },
    ownerUserId: closer2.id,
    cohortId: coh1.id,
    productoId: prod1Completo.id,
    fechaLimitePago: "2026-10-10",
  });

  // Deal 6 -> Etapa: abonado (abono parcial con comprobante + moverEtapa sistema)
  const lead6 = mapaLeads.get("felipe.torres@ejemplo.local")!;
  const deal6Id = await abrirDeal(db, {
    leadId: lead6.id,
    programId: prog1.id,
    etapa: "compromiso_verbal",
    actor: { tipo: "usuario", userId: closer1.id, rol: "closer" },
    ownerUserId: closer1.id,
    cohortId: coh1.id,
    productoId: prod1Completo.id,
    fechaLimitePago: "2026-10-05",
  });
  await crearConRastro(
    {
      db,
      tabla: abonos,
      nombreTabla: "abonos",
      actorId: closer1.id,
      etiqueta: "Abono inicial 300 USD",
    },
    {
      dealId: deal6Id,
      programId: prog1.id,
      fecha: "2026-09-26",
      monto: "300.00",
      moneda: "USD",
      closerId: "carlos",
      comprobanteUrl: "https://ejemplo.local/comprobantes/abono-felipe.pdf",
    },
  );
  await moverEtapa(db, {
    dealId: deal6Id,
    a: "abonado",
    actor: { tipo: "sistema" },
  });

  // Deal 7 -> Etapa: completo (pago total con comprobante + moverEtapa sistema)
  const lead7 = mapaLeads.get("gloria.vargas@ejemplo.local")!;
  const deal7Id = await abrirDeal(db, {
    leadId: lead7.id,
    programId: prog1.id,
    etapa: "compromiso_verbal",
    actor: { tipo: "usuario", userId: closer1.id, rol: "closer" },
    ownerUserId: closer1.id,
    cohortId: coh1.id,
    productoId: prod1Completo.id,
    fechaLimitePago: "2026-10-01",
  });
  await crearConRastro(
    {
      db,
      tabla: abonos,
      nombreTabla: "abonos",
      actorId: closer1.id,
      etiqueta: "Pago total 797 USD",
    },
    {
      dealId: deal7Id,
      programId: prog1.id,
      fecha: "2026-09-27",
      monto: "797.00",
      moneda: "USD",
      closerId: "carlos",
      comprobanteUrl: "https://ejemplo.local/comprobantes/completo-gloria.pdf",
    },
  );
  await moverEtapa(db, {
    dealId: deal7Id,
    a: "completo",
    actor: { tipo: "sistema" },
  });

  // Deal 8 -> Etapa: pendiente_reagenda (llamada fallida)
  const lead8 = mapaLeads.get("hector.sanchez@ejemplo.local")!;
  const deal8Id = await abrirDeal(db, {
    leadId: lead8.id,
    programId: prog1.id,
    etapa: "pendiente_setteo",
    actor: { tipo: "usuario", userId: closer1.id, rol: "closer" },
    ownerUserId: closer1.id,
    cohortId: coh1.id,
  });
  const resLlamada8 = await agregarLlamada(
    db,
    { userId: closer1.id, rol: "closer" },
    {
      dealId: deal8Id,
      fechaAgenda: new Date("2026-09-26T16:00:00-05:00"),
    },
  );
  await marcarFallida(
    db,
    { userId: closer1.id, rol: "closer" },
    {
      callId: resLlamada8.callId,
      resultado: "no_show",
    },
  );

  // Deal 9 -> Etapa: cierre_perdido
  const lead9 = mapaLeads.get("isabel.navarro@ejemplo.local")!;
  const deal9Id = await abrirDeal(db, {
    leadId: lead9.id,
    programId: prog1.id,
    etapa: "en_contacto",
    actor: { tipo: "usuario", userId: closer2.id, rol: "closer" },
    ownerUserId: closer2.id,
    cohortId: coh1.id,
  });
  const motivoPerdidaId = mapaMotivos.get("perdida|Sin dinero para invertir ahora");
  await moverEtapa(db, {
    dealId: deal9Id,
    a: "cierre_perdido",
    actor: { tipo: "usuario", userId: closer2.id, rol: "closer" },
    motivoId: motivoPerdidaId,
  });

  // Deal 10 -> Tactical Investor: etapa abonado
  const lead10 = mapaLeads.get("jorge.perez@ejemplo.local")!;
  const deal10Id = await abrirDeal(db, {
    leadId: lead10.id,
    programId: prog2.id,
    etapa: "compromiso_verbal",
    actor: { tipo: "usuario", userId: closer1.id, rol: "closer" },
    ownerUserId: closer1.id,
    cohortId: coh2.id,
    productoId: prod2Completo.id,
    fechaLimitePago: "2026-10-15",
  });
  await crearConRastro(
    {
      db,
      tabla: abonos,
      nombreTabla: "abonos",
      actorId: closer1.id,
      etiqueta: "Abono Tactical 500 USD",
    },
    {
      dealId: deal10Id,
      programId: prog2.id,
      fecha: "2026-09-28",
      monto: "500.00",
      moneda: "USD",
      closerId: "carlos",
      comprobanteUrl: "https://ejemplo.local/comprobantes/abono-jorge.pdf",
    },
  );
  await moverEtapa(db, {
    dealId: deal10Id,
    a: "abonado",
    actor: { tipo: "sistema" },
  });

  // Deal 11 -> Tactical: pendiente_setteo
  const lead11 = mapaLeads.get("karina.lopez@ejemplo.local")!;
  await abrirDeal(db, {
    leadId: lead11.id,
    programId: prog2.id,
    etapa: "pendiente_setteo",
    actor: { tipo: "usuario", userId: closer1.id, rol: "closer" },
    ownerUserId: closer1.id,
    cohortId: coh2.id,
  });

  // Deal 12 -> Tactical: agendado (vía agregarLlamada)
  const lead12 = mapaLeads.get("luis.mendoza@ejemplo.local")!;
  const deal12Id = await abrirDeal(db, {
    leadId: lead12.id,
    programId: prog2.id,
    etapa: "pendiente_setteo",
    actor: { tipo: "usuario", userId: closer1.id, rol: "closer" },
    ownerUserId: closer1.id,
    cohortId: coh2.id,
  });
  await agregarLlamada(
    db,
    { userId: closer1.id, rol: "closer" },
    {
      dealId: deal12Id,
      fechaAgenda: new Date("2026-10-06T15:00:00-05:00"),
      linkCalendly: "https://calendly.com/retia-demo/cita-luis",
      notas: "Quiere entender la estrategia antes de decidir.",
    },
  );

  // Deal 13 -> Tactical: compromiso_verbal (con fecha límite pasada, para ver el aviso)
  const lead13 = mapaLeads.get("marta.rios@ejemplo.local")!;
  await abrirDeal(db, {
    leadId: lead13.id,
    programId: prog2.id,
    etapa: "compromiso_verbal",
    actor: { tipo: "usuario", userId: closer1.id, rol: "closer" },
    ownerUserId: closer1.id,
    cohortId: coh2.id,
    productoId: prod2Completo.id,
    fechaLimitePago: "2026-09-20",
  });

  console.log("\n[seed:local] Siembra local finalizada exitosamente.");
}

if (process.argv[1]?.endsWith("seed-local.ts")) {
  sembrarLocal()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("\n[seed:local] Falló la siembra:", error);
      process.exit(1);
    });
}
