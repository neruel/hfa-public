# Backend endpoint map

All application endpoints are implemented as Next.js route handlers. Server-side code connects directly to Supabase.

## Public endpoints

- `GET /api/health` — returns application status and timestamp.
- `POST /api/chat` — searches Supabase vector chunks and FAQ rows, then generates a grounded answer with Groq when matching context exists.
- `GET /api/search?q=...` — embeds the query locally and returns relevant document excerpts from Supabase.

Chat and search return document excerpts to unauthenticated callers. Only use public or demo-safe content in the connected database.

## Administrator endpoints

- `POST /api/admin/login` — exchanges `ADMIN_API_TOKEN` for a signed, HttpOnly session cookie.
- `GET /api/admin/documents` — lists document metadata and processing state.
- `GET /api/admin/overview` — returns document counts.
- `POST /api/admin/upload` — stores and processes a supported document.
- `POST /api/admin/documents/{id}/reprocess` — reprocesses a document.
- `DELETE /api/admin/documents/{id}` — deletes a document and its indexed chunks.

All administrator operations except login require a valid session. In production, set `ADMIN_API_TOKEN`; the administrator API rejects requests when it is not configured.

## Data flow

Document files are stored in the private Supabase Storage bucket `documents`. Metadata, FAQ rows, parent chunks, child chunks, and 384-dimensional embeddings are stored in Supabase PostgreSQL. Scanned PDF OCR uses Gemini when configured. Query embeddings run locally by default, and grounded answer generation uses Groq.
