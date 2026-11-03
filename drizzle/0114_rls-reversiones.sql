-- RLS en toda tabla de public (ADR 0047): la 0113 creo `reversiones` sin ella.
ALTER TABLE "reversiones" ENABLE ROW LEVEL SECURITY;
