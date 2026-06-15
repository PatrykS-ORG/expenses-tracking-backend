-- CreateEnum
CREATE TYPE "SummaryLogStatus" AS ENUM ('SUCCESS', 'FAILURE');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "summary_schedule_day" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "summary_schedule_hour" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN "summary_timezone" TEXT NOT NULL DEFAULT 'Europe/Warsaw',
ADD COLUMN "summary_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "next_summary_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SummaryLog" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "status" "SummaryLogStatus" NOT NULL,
    "error_message" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SummaryLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SummaryLog_user_id_idx" ON "SummaryLog"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "SummaryLog_user_id_period_key" ON "SummaryLog"("user_id", "period");

-- AddForeignKey
ALTER TABLE "SummaryLog" ADD CONSTRAINT "SummaryLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
