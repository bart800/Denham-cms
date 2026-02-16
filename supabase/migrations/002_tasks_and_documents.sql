-- Denham CMS - Tasks & Documents Tables
-- Adds the two placeholder tabs

-- ============================================================
-- TASKS
-- ============================================================
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL REFERENCES team_members(id),
  created_by UUID NOT NULL REFERENCES team_members(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','cancelled')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_case_id ON tasks(case_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_priority ON tasks(priority);

-- ============================================================
-- DOCUMENTS
-- ============================================================
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES team_members(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'policy','estimate','correspondence','pleading','discovery',
    'photo','report','contract','invoice','other'
  )),
  file_url TEXT,
  file_size INTEGER,
  mime_type TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_case_id ON documents(case_id);
CREATE INDEX idx_documents_type ON documents(type);
CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by);

-- Triggers
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Authenticated access
CREATE POLICY tasks_select ON tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY tasks_insert ON tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY tasks_update ON tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY tasks_delete ON tasks FOR DELETE TO authenticated USING (true);

CREATE POLICY documents_select ON documents FOR SELECT TO authenticated USING (true);
CREATE POLICY documents_insert ON documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY documents_update ON documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY documents_delete ON documents FOR DELETE TO authenticated USING (true);

-- Anon access (dev/demo)
CREATE POLICY tasks_anon_select ON tasks FOR SELECT TO anon USING (true);
CREATE POLICY tasks_anon_insert ON tasks FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY tasks_anon_update ON tasks FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY tasks_anon_delete ON tasks FOR DELETE TO anon USING (true);

CREATE POLICY documents_anon_select ON documents FOR SELECT TO anon USING (true);
CREATE POLICY documents_anon_insert ON documents FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY documents_anon_update ON documents FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY documents_anon_delete ON documents FOR DELETE TO anon USING (true);
