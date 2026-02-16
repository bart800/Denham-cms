-- Documents table: stores file metadata indexed from Clio/OneDrive
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  client_folder TEXT NOT NULL,
  case_folder TEXT,
  category TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_ext TEXT,
  file_size BIGINT DEFAULT 0,
  file_modified TIMESTAMPTZ,
  file_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_case_id ON documents(case_id);
CREATE INDEX idx_documents_category ON documents(category);
CREATE INDEX idx_documents_client_folder ON documents(client_folder);
CREATE INDEX idx_documents_filename ON documents(filename);

-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documents_read" ON documents FOR SELECT USING (true);
CREATE POLICY "documents_write" ON documents FOR INSERT WITH CHECK (true);
CREATE POLICY "documents_update" ON documents FOR UPDATE USING (true);
CREATE POLICY "documents_delete" ON documents FOR DELETE USING (true);
