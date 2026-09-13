-- AlterTable
ALTER TABLE "blocks" ADD COLUMN     "textContent" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "blocks_textContent_idx" ON "blocks"("textContent");
