-- Add document analysis columns
ALTER TABLE documents ADD COLUMN IF NOT EXISTS analysis JSONB;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS doc_type TEXT;

-- Index for filtering by document type
CREATE INDEX IF NOT EXISTS idx_documents_doc_type ON documents(doc_type);
