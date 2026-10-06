-- Durable application documents are accessed only from the trusted server-side
-- Postgres connection. The public Supabase API must not expose this table.
CREATE TABLE IF NOT EXISTS public.aviator_storage_documents (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.aviator_storage_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.aviator_storage_documents FROM PUBLIC, anon, authenticated;

-- Payment receipts live in a private bucket. The app uses its server-only
-- service-role key and performs owner/admin checks before returning file bytes.
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'uploads',
  'uploads',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
