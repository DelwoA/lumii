-- Enable pgvector for retrieval embeddings.
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "MaterialChunk" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaterialChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaterialChunk_materialId_idx" ON "MaterialChunk"("materialId");
CREATE INDEX "MaterialChunk_userId_idx" ON "MaterialChunk"("userId");

-- Vector similarity index (cosine distance).
CREATE INDEX "MaterialChunk_embedding_idx"
  ON "MaterialChunk" USING hnsw ("embedding" vector_cosine_ops);

-- AddForeignKey
ALTER TABLE "MaterialChunk" ADD CONSTRAINT "MaterialChunk_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaterialChunk" ADD CONSTRAINT "MaterialChunk_materialId_fkey"
  FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;
