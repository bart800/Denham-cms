-- Case Notes table
CREATE TABLE case_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  author_id UUID REFERENCES team_members(id),
  content TEXT NOT NULL,
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_case_notes_case_id ON case_notes(case_id);
CREATE INDEX idx_case_notes_pinned ON case_notes(case_id, pinned) WHERE pinned = true;

-- Updated_at trigger
CREATE TRIGGER trg_case_notes_updated_at
  BEFORE UPDATE ON case_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE case_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY case_notes_select ON case_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY case_notes_insert ON case_notes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY case_notes_update ON case_notes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY case_notes_delete ON case_notes FOR DELETE TO authenticated USING (true);

CREATE POLICY case_notes_anon_select ON case_notes FOR SELECT TO anon USING (true);
CREATE POLICY case_notes_anon_insert ON case_notes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY case_notes_anon_update ON case_notes FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY case_notes_anon_delete ON case_notes FOR DELETE TO anon USING (true);
