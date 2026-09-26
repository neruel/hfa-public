import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdminSession, verifyAdminSession } from '@/lib/server/admin-session';
import { processDocumentIngestion } from '@/lib/server/ingestion';

type Context = { params: Promise<{ path: string[] }> };

async function checkAuth(request: Request): Promise<boolean> {
  const secret = process.env.ADMIN_API_TOKEN;
  // Without a configured token, admin access is only open in local development.
  if (!secret) return process.env.NODE_ENV !== 'production';

  // 1. Check signed session passed as a Bearer header
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer session:')) {
    return verifyAdminSession(authHeader.slice('Bearer session:'.length).trim(), secret);
  }

  // 2. Check Cookie session
  return isAdminSession(request, secret);
}

async function handler(request: Request, context: Context) {
  const isAuth = await checkAuth(request);
  if (!isAuth) {
    return NextResponse.json({ error: 'Unauthorized administrator access' }, { status: 401 });
  }

  const { path } = await context.params;
  const sub = path[0];

  // GET /admin/overview – summary counts for Admin Dashboard
  if (request.method === 'GET' && sub === 'overview') {
    const { data: docs, error } = await supabaseAdmin.from('documents').select('status');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const totalDocuments = docs?.length ?? 0;
    const readyDocuments = docs?.filter((d) => d.status === 'READY').length ?? 0;
    const errorDocuments = docs?.filter((d) => d.status === 'ERROR').length ?? 0;

    return NextResponse.json({
      overview: { totalDocuments, readyDocuments, errorDocuments },
    });
  }

  // GET /admin/documents – list all documents
  if (request.method === 'GET' && sub === 'documents') {
    const { data, error } = await supabaseAdmin.from('documents').select('*').order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const documents = (data ?? []).map((doc) => ({
      id: doc.id,
      filename: doc.filename,
      file_type: doc.mime_type ?? doc.filename.split('.').pop()?.toUpperCase() ?? null,
      status: doc.status,
      ocr_used: Boolean(doc.metadata?.ocr_used),
      chunk_count: doc.metadata?.chunk_count ?? 0,
      created_at: doc.created_at,
      updated_at: doc.updated_at,
      error_message: doc.error_message ?? null,
    }));

    return NextResponse.json({ documents });
  }

  // POST /admin/upload – upload file and start background ingestion
  if (request.method === 'POST' && sub === 'upload') {
    try {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      const fileExt = file.name.split('.').pop()?.toLowerCase() ?? '';
      const allowedExtensions = new Set(['pdf', 'docx', 'xlsx', 'pptx', 'txt', 'hwpx']);
      if (!allowedExtensions.has(fileExt)) {
        return NextResponse.json({ error: 'Unsupported file format' }, { status: 400 });
      }
      if (file.size <= 0 || file.size > 25 * 1024 * 1024) {
        return NextResponse.json({ error: 'File must be between 1 byte and 25 MB' }, { status: 400 });
      }

      const docId = crypto.randomUUID();
      const storagePath = `${docId}/file.${fileExt}`;

      const arrayBuffer = await file.arrayBuffer();

      // Ensure storage bucket exists
      try {
        await supabaseAdmin.storage.createBucket('documents', { public: false });
      } catch {}

      // Upload file to Supabase Storage
      const { error: uploadErr } = await supabaseAdmin
        .storage
        .from('documents')
        .upload(storagePath, arrayBuffer, {
          contentType: file.type || 'application/octet-stream',
          upsert: true,
        });

      if (uploadErr) {
        return NextResponse.json({ error: `Storage upload failed: ${uploadErr.message}` }, { status: 500 });
      }

      // Insert document record
      const { error: dbErr } = await supabaseAdmin.from('documents').insert({
        id: docId,
        filename: file.name,
        original_filename: file.name,
        mime_type: file.type || null,
        file_size: file.size,
        storage_path: storagePath,
        status: 'UPLOADED',
      });

      if (dbErr) {
        return NextResponse.json({ error: `DB insert failed: ${dbErr.message}` }, { status: 500 });
      }

      // Process document ingestion to completion
      await processDocumentIngestion(docId);

      const { data: processedDocument, error: statusErr } = await supabaseAdmin
        .from('documents')
        .select('status, error_message')
        .eq('id', docId)
        .single();

      if (statusErr || !processedDocument) {
        return NextResponse.json({ error: 'Could not verify document processing status', documentId: docId }, { status: 500 });
      }
      if (processedDocument.status !== 'READY') {
        return NextResponse.json({
          error: processedDocument.error_message ?? 'Document processing failed',
          documentId: docId,
          status: processedDocument.status,
        }, { status: 422 });
      }

      return NextResponse.json({ documentId: docId, status: 'READY', queued: false }, { status: 201 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload processing error';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // POST /admin/documents/:id/reprocess – reprocess an existing document
  if (request.method === 'POST' && sub === 'documents' && path.length === 3 && path[2] === 'reprocess') {
    const docId = path[1];
    const { error } = await supabaseAdmin.from('documents').update({ status: 'UPLOADED', error_message: null }).eq('id', docId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await processDocumentIngestion(docId);
    return NextResponse.json({ documentId: docId, reprocessed: true });
  }

  // DELETE /admin/documents/:id – delete document and chunks
  if (request.method === 'DELETE' && sub === 'documents' && path.length === 2) {
    const docId = path[1];

    const { data: doc, error: fetchErr } = await supabaseAdmin
      .from('documents')
      .select('storage_path')
      .eq('id', docId)
      .single();

    if (fetchErr || !doc) {
      return NextResponse.json({ error: fetchErr?.message ?? 'Document not found' }, { status: 404 });
    }

    // Delete chunks via RPC
    const { error: delErr } = await supabaseAdmin.rpc('delete_document_chunks', { doc_id: docId });
    if (delErr) console.warn('Chunk deletion warning:', delErr.message);

    // Delete document row
    await supabaseAdmin.from('documents').delete().eq('id', docId);

    // Remove file from Supabase Storage
    try {
      await supabaseAdmin.storage.from('documents').remove([doc.storage_path]);
    } catch {}

    return NextResponse.json({ deleted: true });
  }

  return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 });
}

export const GET = handler;
export const POST = handler;
export const DELETE = handler;
export const PATCH = handler;
