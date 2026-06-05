-- CreateEnum
CREATE TYPE "DataSourceType" AS ENUM ('FILE_UPLOAD', 'NEXTCLOUD');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "data_source_type" "DataSourceType" NOT NULL DEFAULT 'FILE_UPLOAD',
ADD COLUMN "data_source_config" JSONB;

-- Migrate existing Nextcloud paths into new JSON config
UPDATE "User"
SET
  "data_source_type" = 'NEXTCLOUD',
  "data_source_config" = jsonb_build_object('filePath', "nextcloud_file_path")
WHERE
  "nextcloud_file_path" IS NOT NULL
  AND btrim("nextcloud_file_path") <> '';

-- Drop old column
ALTER TABLE "User" DROP COLUMN "nextcloud_file_path";
