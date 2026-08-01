-- CreateEnum
CREATE TYPE "AiActionType" AS ENUM ('TEMPLATE_GENERATION', 'EXPENSE_SUMMARY', 'RECEIPT_SCAN');

-- CreateEnum
CREATE TYPE "AiUsageTrigger" AS ENUM ('MANUAL', 'SCHEDULED');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "ai_credit_limit" INTEGER NOT NULL DEFAULT 50;

-- CreateTable
CREATE TABLE "AiUsageLog" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" "AiActionType" NOT NULL,
    "trigger" "AiUsageTrigger" NOT NULL DEFAULT 'MANUAL',
    "model" TEXT NOT NULL,
    "prompt_tokens" INTEGER NOT NULL,
    "completion_tokens" INTEGER NOT NULL,
    "total_tokens" INTEGER NOT NULL,
    "credits_used" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiUsageLog_user_id_created_at_idx" ON "AiUsageLog"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "AiUsageLog" ADD CONSTRAINT "AiUsageLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
