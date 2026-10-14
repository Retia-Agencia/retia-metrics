-- Ticket 238: la 0078 creo archivos sin RLS, contra el ADR 0047 punto 5 (lo cazo
-- tests/rls-en-todas-las-tablas.test.ts en el CI). Como la 0078 ya se aplico en produccion, va aparte.
ALTER TABLE "archivos" ENABLE ROW LEVEL SECURITY;
