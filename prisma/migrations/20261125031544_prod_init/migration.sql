/*
  Warnings:

  - You are about to drop the column `email` on the `Lead` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Lead" DROP COLUMN "email",
ADD COLUMN     "carModel" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "followUpCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isBranchManual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isInvalidPhone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isOutOfState" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "status" SET DEFAULT 'not_contacted';

-- CreateTable
CREATE TABLE "LeadActivity" (
    "id" SERIAL NOT NULL,
    "leadId" INTEGER NOT NULL,
    "userId" INTEGER,
    "username" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consultant" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "branch" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consultant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "radiusKm" DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationCache" (
    "id" SERIAL NOT NULL,
    "searchTerm" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "district" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'geocoder',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocationCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarModel" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadFollowUp" (
    "id" SERIAL NOT NULL,
    "leadId" INTEGER NOT NULL,
    "step" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadActivity_leadId_idx" ON "LeadActivity"("leadId");

-- CreateIndex
CREATE INDEX "LeadActivity_userId_idx" ON "LeadActivity"("userId");

-- CreateIndex
CREATE INDEX "LeadActivity_createdAt_idx" ON "LeadActivity"("createdAt");

-- CreateIndex
CREATE INDEX "Consultant_branch_idx" ON "Consultant"("branch");

-- CreateIndex
CREATE UNIQUE INDEX "Consultant_name_branch_key" ON "Consultant"("name", "branch");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_name_key" ON "Branch"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_code_key" ON "Branch"("code");

-- CreateIndex
CREATE INDEX "Branch_name_idx" ON "Branch"("name");

-- CreateIndex
CREATE INDEX "Branch_code_idx" ON "Branch"("code");

-- CreateIndex
CREATE INDEX "Branch_city_idx" ON "Branch"("city");

-- CreateIndex
CREATE INDEX "Branch_isActive_idx" ON "Branch"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LocationCache_searchTerm_key" ON "LocationCache"("searchTerm");

-- CreateIndex
CREATE INDEX "LocationCache_searchTerm_idx" ON "LocationCache"("searchTerm");

-- CreateIndex
CREATE INDEX "LocationCache_canonicalName_idx" ON "LocationCache"("canonicalName");

-- CreateIndex
CREATE INDEX "LocationCache_state_idx" ON "LocationCache"("state");

-- CreateIndex
CREATE UNIQUE INDEX "CarModel_name_key" ON "CarModel"("name");

-- CreateIndex
CREATE INDEX "CarModel_name_idx" ON "CarModel"("name");

-- CreateIndex
CREATE INDEX "CarModel_isActive_idx" ON "CarModel"("isActive");

-- CreateIndex
CREATE INDEX "LeadFollowUp_leadId_idx" ON "LeadFollowUp"("leadId");

-- CreateIndex
CREATE INDEX "LeadFollowUp_date_idx" ON "LeadFollowUp"("date");

-- CreateIndex
CREATE INDEX "Lead_carModel_idx" ON "Lead"("carModel");

-- CreateIndex
CREATE INDEX "Lead_isInvalidPhone_idx" ON "Lead"("isInvalidPhone");

-- CreateIndex
CREATE INDEX "Lead_isOutOfState_idx" ON "Lead"("isOutOfState");

-- CreateIndex
CREATE INDEX "Lead_isBranchManual_idx" ON "Lead"("isBranchManual");

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadFollowUp" ADD CONSTRAINT "LeadFollowUp_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
