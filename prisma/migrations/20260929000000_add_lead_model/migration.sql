-- CreateEnum
CREATE TYPE "LeadPipeline" AS ENUM ('ADS', 'WARM_APPROACH');

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('COLD', 'WARM', 'HOT', 'PLAN_MEET', 'PITCHED', 'PROPOSAL_SENT');

-- CreateEnum
CREATE TYPE "LeadOutcome" AS ENUM ('WON', 'LOST');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'LEAD_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'LEAD_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'LEAD_STAGE_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'LEAD_ASSIGNED';
ALTER TYPE "AuditAction" ADD VALUE 'LEAD_DELETED';

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "pipeline" "LeadPipeline" NOT NULL,
    "stage" "LeadStage" NOT NULL,
    "source" TEXT,
    "notes" TEXT,
    "assignedRepId" TEXT,
    "createdById" TEXT,
    "campaignName" TEXT,
    "adCreative" TEXT,
    "submittedAt" TIMESTAMP(3),
    "initialContactStatus" TEXT,
    "interestLevel" TEXT,
    "qualificationNotes" TEXT,
    "lastContactedAt" TIMESTAMP(3),
    "immediateRequirement" TEXT,
    "closingProbability" INTEGER,
    "meetingScheduled" BOOLEAN NOT NULL DEFAULT false,
    "lastInteractionAt" TIMESTAMP(3),
    "scheduledMeetingAt" TIMESTAMP(3),
    "followUpNotes" TEXT,
    "pitchedAt" TIMESTAMP(3),
    "serviceDiscussed" TEXT,
    "feedback" TEXT,
    "nextAction" TEXT,
    "proposalAmount" DECIMAL(12,2),
    "proposalDocUrl" TEXT,
    "proposalSentAt" TIMESTAMP(3),
    "expectedCloseAt" TIMESTAMP(3),
    "outcome" "LeadOutcome",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_pipeline_idx" ON "Lead"("pipeline");

-- CreateIndex
CREATE INDEX "Lead_stage_idx" ON "Lead"("stage");

-- CreateIndex
CREATE INDEX "Lead_assignedRepId_idx" ON "Lead"("assignedRepId");

-- CreateIndex
CREATE INDEX "Lead_source_idx" ON "Lead"("source");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedRepId_fkey" FOREIGN KEY ("assignedRepId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
