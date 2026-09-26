# Frontend architecture

The project uses the Next.js App Router. `src/app/layout.tsx` provides document metadata, global styles, and the root HTML shell. Pages in `src/app/(dashboard)/` share the dashboard layout and navigation.

## Pages

- `/` — landing page
- `/chat` — RAG chat interface
- `/search` — semantic document search
- `/call` — public demo contact information
- `/admin` — authenticated document management

## Main components

- `DashboardShell`, `Sidebar`, `Header`, and `MobileNavigation` — responsive dashboard navigation and shell
- `ChatInterface`, `MessageCard`, and `MessageInput` — chat experience
- `SearchBar` — document search results and excerpts
- `ContactCard` — demo contact information
- `AdminDashboard` — administrator authentication, uploads, processing status, and document actions
- `src/components/ui/` — shared buttons, cards, badges, fields, avatars, and section headers

## Data access

Client components call same-origin Next.js API routes. Supabase and model-provider credentials stay in server-side environment variables. User-facing chat and search APIs return matched source excerpts, so deployment data must be safe to disclose publicly.
