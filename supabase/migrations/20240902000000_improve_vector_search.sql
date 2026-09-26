-- ============================================================
-- 통합 마이그레이션: Supabase SQL Editor에서 한 번에 실행하세요
-- ============================================================

-- 1. vector_search RPC 업그레이드: score 반환 + READY 필터
DROP FUNCTION IF EXISTS vector_search(VECTOR, INT, FLOAT, UUID);
DROP FUNCTION IF EXISTS vector_search;

CREATE OR REPLACE FUNCTION vector_search(
    query_vec VECTOR,
    top_k INT DEFAULT 6,
    threshold FLOAT DEFAULT 0.35,
    category_id UUID DEFAULT NULL
) RETURNS TABLE (
    id UUID,
    document_id UUID,
    content TEXT,
    page_number INT,
    parent_content TEXT,
    section_title TEXT,
    document_name TEXT,
    score FLOAT
) LANGUAGE sql AS $$
    SELECT
        dc.id,
        dc.document_id,
        dc.content,
        dc.page_number,
        COALESCE(pc.content, dc.content) AS parent_content,
        COALESCE(pc.metadata->>'section_title', d.filename) AS section_title,
        d.filename AS document_name,
        (1 - (dc.embedding <=> query_vec))::FLOAT AS score
    FROM document_chunks dc
    LEFT JOIN parent_chunks pc ON pc.id = dc.parent_id
    JOIN documents d ON d.id = dc.document_id
    WHERE d.status = 'READY'
    AND (
        vector_search.category_id IS NULL OR d.category_id = vector_search.category_id
    )
    AND 1 - (dc.embedding <=> query_vec) >= threshold
    ORDER BY dc.embedding <=> query_vec
    LIMIT top_k;
$$;

-- 2. IVFFlat → HNSW 인덱스 변경 (검색 정확도 향상)
DROP INDEX IF EXISTS document_chunks_embedding_idx;
CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx
  ON document_chunks
  USING hnsw (embedding vector_cosine_ops);

-- 3. upsert_chunks RPC 함수 버그 수정 (record elem 필드 오류 해결)
CREATE OR REPLACE FUNCTION upsert_chunks(
    doc_id UUID,
    chunks JSONB
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    elem JSONB;
    p_id UUID;
    c_id UUID;
BEGIN
    FOR elem IN SELECT jsonb_array_elements(chunks)
    LOOP
        p_id := NULL;
        IF (elem->>'parent_id') IS NOT NULL AND (elem->>'parent_id') != '' THEN
            p_id := (elem->>'parent_id')::UUID;
        END IF;

        c_id := gen_random_uuid();
        IF (elem->>'id') IS NOT NULL AND (elem->>'id') != '' THEN
            c_id := (elem->>'id')::UUID;
        END IF;

        INSERT INTO document_chunks (
            id, document_id, parent_id, chunk_index, content, page_number, embedding
        ) VALUES (
            c_id,
            doc_id,
            p_id,
            COALESCE((elem->>'chunk_index')::INT, 0),
            elem->>'content',
            (elem->>'page_number')::INT,
            (elem->>'embedding')::VECTOR
        ) ON CONFLICT (id) DO UPDATE SET
            content = EXCLUDED.content,
            embedding = EXCLUDED.embedding,
            page_number = EXCLUDED.page_number;
    END LOOP;
END;
$$;

-- 4. 오픈소스 384차원 임베딩(multilingual-e5-small) 마이그레이션
TRUNCATE TABLE document_chunks;
DROP INDEX IF EXISTS document_chunks_embedding_idx;
DROP INDEX IF EXISTS document_chunks_embedding_hnsw_idx;

ALTER TABLE document_chunks ALTER COLUMN embedding TYPE VECTOR(384);

CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx
  ON document_chunks
  USING hnsw (embedding vector_cosine_ops);
