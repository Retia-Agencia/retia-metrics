-- Ticket 173 (ADR 0052): el rol del Paid Trafficker. Aditivo: ninguna fila cambia.
SET lock_timeout = '5s';--> statement-breakpoint
ALTER TYPE "public"."rol" ADD VALUE IF NOT EXISTS 'paid_trafficker';
