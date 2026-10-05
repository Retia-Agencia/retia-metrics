-- Ticket 147: la 0067 creo umbrales_alerta sin RLS, contra el ADR 0047 punto 5 (lo cazo
-- tests/rls-en-todas-las-tablas.test.ts en el CI). Como la 0067 ya se aplico en produccion, va aparte.
ALTER TABLE "umbrales_alerta" ENABLE ROW LEVEL SECURITY;
