-- CreateEnum
CREATE TYPE "SummaryEmailLanguage" AS ENUM ('PL', 'EN');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "summary_email_language" "SummaryEmailLanguage" NOT NULL DEFAULT 'PL';
