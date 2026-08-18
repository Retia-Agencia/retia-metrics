import { pgEnum, pgTable, text, boolean, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Fase 0 — solo la tabla de usuarios.
 * El resto del modelo (programs, cohorts, people, calls, sales...) entra en la Fase 1.
 */

export const rolEnum = pgEnum("rol", ["gerente", "closer"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  nombre: text("nombre"),
  rol: rolEnum("rol").notNull().default("closer"),
  /** Identificador con el que este closer aparece en la BBDD de Google Sheets. */
  closerId: text("closer_id"),
  activo: boolean("activo").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Usuario = typeof users.$inferSelect;
export type NuevoUsuario = typeof users.$inferInsert;
