-- CreateEnum
CREATE TYPE "ReturnReason" AS ENUM ('SIZE', 'COLOR', 'DEFECT', 'REGRET', 'OTHER');

-- CreateEnum
CREATE TYPE "ReturnKind" AS ENUM ('EXCHANGE', 'REFUND');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('OPEN', 'APPROVED', 'DENIED', 'RECEIVED', 'COMPLETED', 'CANCELED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveredAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "refundedAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ReturnRequest" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" "ReturnReason" NOT NULL,
    "reasonText" TEXT,
    "kind" "ReturnKind" NOT NULL,
    "exchangeVariantId" TEXT,
    "exchangeColor" TEXT,
    "exchangeSize" TEXT,
    "status" "ReturnStatus" NOT NULL DEFAULT 'OPEN',
    "approvedKind" "ReturnKind",
    "adminMessage" TEXT,
    "stockReserved" BOOLEAN NOT NULL DEFAULT false,
    "goodCondition" BOOLEAN,
    "refundAmount" DECIMAL(10,2),
    "refundShipping" BOOLEAN NOT NULL DEFAULT false,
    "refundId" TEXT,
    "refundedAt" TIMESTAMP(3),
    "trackingCode" TEXT,
    "answeredAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnPhoto" (
    "id" TEXT NOT NULL,
    "returnRequestId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReturnPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedLook" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "topVariantId" TEXT,
    "bottomVariantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedLook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "storeName" TEXT NOT NULL DEFAULT 'VESTRA ROOM',
    "cnpj" TEXT NOT NULL DEFAULT '00.000.000/0001-00',
    "email" TEXT NOT NULL DEFAULT 'contato@vestraroom.com.br',
    "phone" TEXT NOT NULL DEFAULT '(11) 4000-0000',
    "returnAddress" TEXT NOT NULL DEFAULT 'VESTRA ROOM — Trocas
Av. Paulista, 1000, sala 10
Bela Vista, São Paulo/SP
CEP 01310-100',
    "returnPolicy" TEXT,
    "privacyPolicy" TEXT,
    "regretDays" INTEGER NOT NULL DEFAULT 7,
    "exchangeDays" INTEGER NOT NULL DEFAULT 30,
    "defectDays" INTEGER NOT NULL DEFAULT 90,
    "boletoDays" INTEGER NOT NULL DEFAULT 3,
    "freeShippingFrom" DECIMAL(10,2) NOT NULL DEFAULT 300,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
    "fitToleranceCm" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReturnRequest_orderItemId_idx" ON "ReturnRequest"("orderItemId");

-- CreateIndex
CREATE INDEX "ReturnRequest_userId_createdAt_idx" ON "ReturnRequest"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ReturnRequest_status_createdAt_idx" ON "ReturnRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SavedLook_userId_createdAt_idx" ON "SavedLook"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_exchangeVariantId_fkey" FOREIGN KEY ("exchangeVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnPhoto" ADD CONSTRAINT "ReturnPhoto_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedLook" ADD CONSTRAINT "SavedLook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedLook" ADD CONSTRAINT "SavedLook_topVariantId_fkey" FOREIGN KEY ("topVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedLook" ADD CONSTRAINT "SavedLook_bottomVariantId_fkey" FOREIGN KEY ("bottomVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Dados existentes ---------------------------------------------------------

-- Pedidos já entregues: a data da entrega passa a ser a da última
-- atualização (o pedido não guardava a entrega até aqui).
UPDATE "Order" SET "deliveredAt" = "updatedAt" WHERE "status" = 'DELIVERED' AND "deliveredAt" IS NULL;

-- Pagamentos já reembolsados (item 20) foram reembolsados por inteiro.
UPDATE "Payment" SET "refundedAmount" = "amount" WHERE "status" = 'REFUNDED';

-- Linha única das configurações, com os valores que estavam no código.
INSERT INTO "StoreSettings" ("id", "updatedAt") VALUES ('default', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
