import { supabaseAdmin } from '@/lib/supabase/server';
import { embedBatch } from '@/lib/ai/gemini';
import { splitParentChunks, splitChildChunks } from '@/lib/chunking_ext';
import { parseDocx } from '@/lib/ingestion/docx';
import { parseHwpx } from '@/lib/ingestion/hwpx';
import { parsePdf } from '@/lib/ingestion/pdf';
import { parsePptx } from '@/lib/ingestion/pptx';
import { parseTxt } from '@/lib/ingestion/txt';
import { parseXlsx } from '@/lib/ingestion/xlsx';
import { performPdfOcr } from '@/lib/ingestion/ocr';

export async function processDocumentIngestion(documentId: string): Promise<void> {
  const setStatus = async (status: string, errorMessage: string | null = null) => {
    await supabaseAdmin
      .from('documents')
      .update({ status, error_message: errorMessage, updated_at: new Date().toISOString() })
      .eq('id', documentId);
  };

  try {
    // 1. Fetch document record
    const { data: doc, error: docErr } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docErr || !doc) {
      throw new Error(`Document not found: ${docErr?.message ?? documentId}`);
    }

    // 2. Fetch file from Supabase Storage
    const { data: fileBlob, error: storageErr } = await supabaseAdmin
      .storage
      .from('documents')
      .download(doc.storage_path);

    if (storageErr || !fileBlob) {
      throw new Error(`Failed to download file from storage: ${storageErr?.message ?? 'Empty blob'}`);
    }

    const buffer = await fileBlob.arrayBuffer();
    const fileExt = doc.storage_path.split('.').pop()?.toLowerCase() ?? '';

    // 3. Parsing
    await setStatus('PROCESSING');
    let extractedText = '';

    switch (fileExt) {
      case 'pdf': {
        const pagesMap = await parsePdf(buffer);
        extractedText = Object.values(pagesMap).join('\n');
        break;
      }
      case 'docx':
        extractedText = await parseDocx(buffer);
        break;
      case 'hwpx':
        extractedText = await parseHwpx(buffer);
        break;
      case 'xlsx':
        extractedText = await parseXlsx(buffer);
        break;
      case 'pptx':
        extractedText = await parsePptx(buffer);
        break;
      case 'txt':
        extractedText = await parseTxt(buffer);
        break;
      default:
        throw new Error(`Unsupported file format: .${fileExt}`);
    }

    let ocrUsed = false;

    if (!extractedText.trim() && fileExt === 'pdf') {
      console.log('No text extracted from PDF. Triggering Gemini Flash Vision OCR fallback...');
      const ocrResult = await performPdfOcr(buffer);
      if (ocrResult.text.trim()) {
        extractedText = ocrResult.text.trim();
        ocrUsed = ocrResult.ocrUsed;
      }
    }

    if (!extractedText.trim()) {
      throw new Error('스캔 이미지 PDF 텍스트 추출에 실패했습니다. 텍스트 추출이 가능한 PDF/DOCX/HWPX/TXT 파일을 업로드해 주세요.');
    }

    // 4. Chunking
    const parents = splitParentChunks(extractedText.trim());
    const children = splitChildChunks(parents);

    if (!parents.length || !children.length) {
      throw new Error('Chunking produced 0 chunks');
    }

    // 5. Generate local 384-dimensional embeddings by default.
    const allEmbeddings = await embedBatch(children.map((c) => c.content));

    // 6. Indexing & Storing in Supabase pgvector

    // Clean existing chunks first
    await supabaseAdmin.rpc('delete_document_chunks', { doc_id: documentId });

    // Insert Parent Chunks
    if (parents.length > 0) {
      const parentRows = parents.map((p) => ({
        id: p.id,
        document_id: documentId,
        chunk_index: p.chunkIndex,
        content: p.content,
        metadata: { page_number: p.pageNumber, section_title: doc.filename },
      }));
      const { error: pErr } = await supabaseAdmin.from('parent_chunks').insert(parentRows);
      if (pErr) throw new Error(`Parent chunk insert error: ${pErr.message}`);
    }

    // Insert Child Chunks (document_chunks) via direct table upsert
    const chunkPayloads = children.map((c, idx) => ({
      id: c.id,
      document_id: documentId,
      parent_id: c.parentId,
      chunk_index: c.chunkIndex,
      content: c.content,
      page_number: c.pageNumber,
      embedding: allEmbeddings[idx],
    }));

    for (let i = 0; i < chunkPayloads.length; i += 50) {
      const chunkBatch = chunkPayloads.slice(i, i + 50);
      const { error: upsertErr } = await supabaseAdmin
        .from('document_chunks')
        .upsert(chunkBatch, { onConflict: 'id' });

      if (upsertErr) {
        const { error: rpcErr } = await supabaseAdmin.rpc('upsert_chunks', {
          doc_id: documentId,
          chunks: chunkBatch,
        });
        if (rpcErr) throw new Error(`Upsert chunks error: ${upsertErr.message} (RPC: ${rpcErr.message})`);
      }
    }

    // 7. Mark READY
    await setStatus('READY');
    await supabaseAdmin
      .from('documents')
      .update({
        metadata: { ocr_used: ocrUsed, chunk_count: children.length },
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`Ingestion error for doc ${documentId}:`, errorMsg);
    await setStatus('ERROR', errorMsg.slice(0, 1000));
  }
}
