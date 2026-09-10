-- CreateTable
CREATE TABLE "MonthClose" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "free_savings_cents" INTEGER NOT NULL,
    "allocated_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "closed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthClose_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MonthClose_user_id_idx" ON "MonthClose"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "MonthClose_user_id_period_key" ON "MonthClose"("user_id", "period");

-- AddForeignKey
ALTER TABLE "MonthClose" ADD CONSTRAINT "MonthClose_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
