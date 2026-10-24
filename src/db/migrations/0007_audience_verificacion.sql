-- YUD-52 R2 (cierre): lookups selectivos y expiracion de tokens de verificacion de audiencia.
-- Indices NO uniques: la unicidad de correo se enforce a nivel aplicacion (alta publica
-- rechaza duplicados) porque aplicar UNIQUE requiere antes auditar conflictos en datos
-- existentes (documentado en YUD-52). No se destruyen ni fusionan registros.
CREATE INDEX "audience_users_email_idx_idx" ON "audience_users" USING btree ("email_idx");
CREATE INDEX "audience_users_verification_token_idx" ON "audience_users" USING btree ("verification_token");
ALTER TABLE "audience_users" ADD COLUMN IF NOT EXISTS "verification_token_creado_en" text;
