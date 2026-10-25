ALTER TABLE "Farm" ADD COLUMN "dataMode" TEXT NOT NULL DEFAULT 'live';
ALTER TABLE "Farm" ADD COLUMN "economics" JSONB;
UPDATE "Farm" SET "dataMode"='demo' WHERE "ownerId" IN (SELECT "id" FROM "User" WHERE "email" LIKE 'demo-%@example.invalid');
