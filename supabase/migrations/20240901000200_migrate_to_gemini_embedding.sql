-- Migration: Alter embedding vector dimension from 1024 to 1536 (Gemini Embedding 2)
-- Note: Existing 1024-dim vectors are cleared so documents can be re-ingested.

-- 1. Truncate existing document_chunks (clears old incompatible vectors)
TRUNCATE TABLE document_chunks;

-- 2. Drop existing vector index
DROP INDEX IF EXISTS document_chunks_embedding_idx;

-- 3. Alter embedding column dimension to VECTOR(1536)
ALTER TABLE document_chunks ALTER COLUMN embedding TYPE VECTOR(1536);

-- 4. Re-create index for 1536-dimensional vectors
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 5. Mark all existing documents as needing re-ingestion (status 'UPLOADED')
UPDATE documents SET status = 'UPLOADED', error_message = NULL WHERE status = 'READY';
