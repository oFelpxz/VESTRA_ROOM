-- CreateEnum
CREATE TYPE "ProductGender" AS ENUM ('MASCULINO', 'FEMININO', 'UNISSEX');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Model3D" ADD COLUMN     "availableSizes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "careInstructions" TEXT,
ADD COLUMN     "collection" TEXT,
ADD COLUMN     "composition" TEXT,
ADD COLUMN     "gender" "ProductGender",
ADD COLUMN     "material" TEXT,
ADD COLUMN     "maxInstallments" INTEGER,
ADD COLUMN     "returnPolicy" TEXT;

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "lowStockThreshold" INTEGER NOT NULL DEFAULT 5;

-- CreateTable
CREATE TABLE "Model3DVersion" (
    "id" TEXT NOT NULL,
    "model3DId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "format" "Model3DFormat" NOT NULL,
    "textureUrl" TEXT,
    "fileSizeMb" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Model3DVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Model3DVersion_model3DId_version_key" ON "Model3DVersion"("model3DId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Review_productId_userId_key" ON "Review"("productId", "userId");

-- AddForeignKey
ALTER TABLE "Model3DVersion" ADD CONSTRAINT "Model3DVersion_model3DId_fkey" FOREIGN KEY ("model3DId") REFERENCES "Model3D"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
