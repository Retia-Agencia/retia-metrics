import { and, eq } from "drizzle-orm";
import { esAdministrador, trabajaLeads, type Rol } from "@/lib/auth/roles";
import { changeLog, miembrosPrograma, users } from "@/lib/db/schema";
import { esViolacionUnica } from "@/lib/db/errores";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";

type Transaccion = { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> };

export interface ActorSetterPorDefecto {
  userId: string;
  rol: Rol;
}

/** El setter activo y elegible del programa, o null cuando no hay uno configurado. */
export async function setterPorDefectoDelPrograma(db: Db, programId: string): Promise<string | null> {
  const [fila] = await db
    .select({ userId: miembrosPrograma.userId })
    .from(miembrosPrograma)
    .innerJoin(users, eq(users.id, miembrosPrograma.userId))
    .where(
      and(
        eq(miembrosPrograma.programId, programId),
        eq(miembrosPrograma.activo, true),
        eq(miembrosPrograma.setterPorDefecto, true),
        eq(users.activo, true),
      ),
    );
  return fila?.userId ?? null;
}

/** Configura el único setter por defecto del programa y deja rastro por cada cambio. */
export async function marcarSetterPorDefecto(
  db: Db,
  actor: ActorSetterPorDefecto,
  input: { programId: string; userId: string | null },
): Promise<void> {
  if (!esAdministrador(actor.rol)) {
    throw new ErrorDeApp("Solo quien administra puede cambiar el setter por defecto.", 403);
  }

  try {
    await (db as unknown as Transaccion).transaction(async (tx) => {
      let objetivo: { id: string; email: string; setterPorDefecto: boolean } | null = null;
      if (input.userId !== null) {
        const [fila] = await tx
          .select({
            id: miembrosPrograma.id,
            email: users.email,
            rol: users.rol,
            activoUsuario: users.activo,
            activoMembresia: miembrosPrograma.activo,
            setterPorDefecto: miembrosPrograma.setterPorDefecto,
          })
          .from(miembrosPrograma)
          .innerJoin(users, eq(users.id, miembrosPrograma.userId))
          .where(
            and(
              eq(miembrosPrograma.programId, input.programId),
              eq(miembrosPrograma.userId, input.userId),
            ),
          );
        if (!fila || !fila.activoUsuario || !fila.activoMembresia || !trabajaLeads(fila.rol)) {
          throw new ErrorDeApp("El setter debe trabajar leads y tener membresía activa en el programa.", 422);
        }
        objetivo = fila;
      }

      const anteriores = await tx
        .select({ id: miembrosPrograma.id, userId: miembrosPrograma.userId, email: users.email })
        .from(miembrosPrograma)
        .innerJoin(users, eq(users.id, miembrosPrograma.userId))
        .where(
          and(
            eq(miembrosPrograma.programId, input.programId),
            eq(miembrosPrograma.setterPorDefecto, true),
          ),
        );

      for (const anterior of anteriores) {
        if (anterior.userId === input.userId) continue;
        await tx.update(miembrosPrograma).set({ setterPorDefecto: false }).where(eq(miembrosPrograma.id, anterior.id));
        await tx.insert(changeLog).values({
          tabla: "miembros_programa",
          registroId: anterior.id,
          etiqueta: anterior.email,
          campo: "setterPorDefecto",
          valorAnterior: "true",
          valorNuevo: "false",
          origen: "app",
          userId: actor.userId,
        });
      }

      if (objetivo && !objetivo.setterPorDefecto) {
        await tx.update(miembrosPrograma).set({ setterPorDefecto: true }).where(eq(miembrosPrograma.id, objetivo.id));
        await tx.insert(changeLog).values({
          tabla: "miembros_programa",
          registroId: objetivo.id,
          etiqueta: objetivo.email,
          campo: "setterPorDefecto",
          valorAnterior: "false",
          valorNuevo: "true",
          origen: "app",
          userId: actor.userId,
        });
      }
    });
  } catch (error) {
    if (esViolacionUnica(error)) {
      throw new ErrorDeApp("El programa ya tiene otro setter por defecto.", 409);
    }
    throw error;
  }
}
