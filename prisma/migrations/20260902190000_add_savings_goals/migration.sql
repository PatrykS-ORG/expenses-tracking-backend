-- CreateTable
CREATE TABLE "SavingsGoalEvent" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "target_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavingsGoalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingsGoalItem" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "target_amount_cents" INTEGER NOT NULL,
    "target_date" TIMESTAMP(3),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavingsGoalItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingsGoalContribution" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "occurred_on" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavingsGoalContribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavingsGoalEvent_user_id_idx" ON "SavingsGoalEvent"("user_id");

-- CreateIndex
CREATE INDEX "SavingsGoalItem_event_id_idx" ON "SavingsGoalItem"("event_id");

-- CreateIndex
CREATE INDEX "SavingsGoalContribution_item_id_idx" ON "SavingsGoalContribution"("item_id");

-- AddForeignKey
ALTER TABLE "SavingsGoalEvent" ADD CONSTRAINT "SavingsGoalEvent_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsGoalItem" ADD CONSTRAINT "SavingsGoalItem_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "SavingsGoalEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsGoalContribution" ADD CONSTRAINT "SavingsGoalContribution_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "SavingsGoalItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
