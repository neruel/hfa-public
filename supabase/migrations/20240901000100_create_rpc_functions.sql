-- Migration: RPC functions for housing FAQ assistant

-- 1. Vector search using pgvector
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
    document_name TEXT
) LANGUAGE sql AS $$
    SELECT
        dc.id,
        dc.document_id,
        dc.content,
        dc.page_number,
        COALESCE(pc.content, dc.content) AS parent_content,
        COALESCE(pc.metadata->>'section_title', d.filename) AS section_title,
        d.filename AS document_name
    FROM document_chunks dc
    LEFT JOIN parent_chunks pc ON pc.id = dc.parent_id
    JOIN documents d ON d.id = dc.document_id
    WHERE (
        vector_search.category_id IS NULL OR d.category_id = vector_search.category_id
    )
    AND 1 - (dc.embedding <=> query_vec) >= threshold
    ORDER BY dc.embedding <=> query_vec
    LIMIT top_k;
$$;

-- 2. Trigger ingestion (placeholder for DB notification)
CREATE OR REPLACE FUNCTION trigger_ingest(document_id UUID) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    PERFORM pg_notify('ingest', document_id::text);
END;
$$;

-- 3. Delete all chunks (and their vectors) for a document
CREATE OR REPLACE FUNCTION delete_document_chunks(doc_id UUID) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM document_chunks WHERE document_id = doc_id;
    DELETE FROM parent_chunks WHERE document_id = doc_id;
END;
$$;

-- 4. Upsert chunks – bulk insert of document chunks with embeddings
--   Expects a JSONB array of objects: [{id, chunk_index, content, embedding, page_number, parent_id}]
CREATE OR REPLACE FUNCTION upsert_chunks(
    doc_id UUID,
    chunks JSONB
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    rec RECORD;
    p_id UUID;
    c_id UUID;
BEGIN
    FOR rec IN SELECT * FROM jsonb_array_elements(chunks) AS elem
    LOOP
        p_id := NULL;
        IF (rec.elem->>'parent_id') IS NOT NULL AND (rec.elem->>'parent_id') != '' THEN
            p_id := (rec.elem->>'parent_id')::UUID;
        END IF;

        c_id := gen_random_uuid();
        IF (rec.elem->>'id') IS NOT NULL AND (rec.elem->>'id') != '' THEN
            c_id := (rec.elem->>'id')::UUID;
        END IF;

        INSERT INTO document_chunks (
            id, document_id, parent_id, chunk_index, content, page_number, embedding
        ) VALUES (
            c_id,
            doc_id,
            p_id,
            COALESCE((rec.elem->>'chunk_index')::INT, 0),
            rec.elem->>'content',
            (rec.elem->>'page_number')::INT,
            (rec.elem->>'embedding')::VECTOR
        ) ON CONFLICT (id) DO UPDATE SET
            content = EXCLUDED.content,
            embedding = EXCLUDED.embedding,
            page_number = EXCLUDED.page_number;
    END LOOP;
END;
$$;

