-- Acessório opcional do look (ex.: touca), além da peça de cima e da de baixo.
ALTER TABLE "SavedLook" ADD COLUMN "accessoryVariantId" TEXT;

-- AddForeignKey
ALTER TABLE "SavedLook" ADD CONSTRAINT "SavedLook_accessoryVariantId_fkey" FOREIGN KEY ("accessoryVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
