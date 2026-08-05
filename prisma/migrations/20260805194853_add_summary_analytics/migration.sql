-- CreateEnum
CREATE TYPE "SummaryAnalyticsSource" AS ENUM ('SCHEDULED', 'MANUAL');

-- CreateTable
CREATE TABLE "SummaryAnalytics" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "source" "SummaryAnalyticsSource" NOT NULL,
    "currency" TEXT NOT NULL,
    "salary_cents" INTEGER NOT NULL,
    "total_expenses_cents" INTEGER NOT NULL,
    "savings_cents" INTEGER NOT NULL,
    "savings_message" TEXT,
    "categories" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SummaryAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SummaryAnalytics_user_id_idx" ON "SummaryAnalytics"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "SummaryAnalytics_user_id_period_key" ON "SummaryAnalytics"("user_id", "period");

-- AddForeignKey
ALTER TABLE "SummaryAnalytics" ADD CONSTRAINT "SummaryAnalytics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
