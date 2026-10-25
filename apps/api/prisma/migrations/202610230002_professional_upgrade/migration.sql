ALTER TABLE "User" ADD COLUMN "firebaseUid" TEXT;
CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");
ALTER TABLE "Farm" ADD COLUMN "boundary" JSONB;
ALTER TABLE "Plot" ADD COLUMN "crop" TEXT NOT NULL DEFAULT 'Tomato';
CREATE TABLE "HarvestEvent" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "runId" TEXT NOT NULL REFERENCES "SimulationRun"("id") ON DELETE CASCADE,
 "plotId" TEXT NOT NULL REFERENCES "Plot"("id") ON DELETE CASCADE,
 "date" TEXT NOT NULL,
 "kg" DOUBLE PRECISION NOT NULL CHECK ("kg">0)
);
CREATE INDEX "HarvestEvent_runId_date_idx" ON "HarvestEvent"("runId","date");
