-- ============================================
-- ALL PENDING MIGRATIONS - Paste this into Supabase SQL Editor
-- Run once. Safe to re-run (uses IF NOT EXISTS where possible).
-- ============================================

-- === 002: Add enrichment columns ===
ALTER TABLE cases ADD COLUMN IF NOT EXISTS property_address TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS cause_of_loss TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS adjuster_name TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS adjuster_phone TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS adjuster_email TEXT;

-- === 003: Discovery tables ===
CREATE TABLE IF NOT EXISTS discovery_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('Interrogatories', 'RFP', 'RFA', 'Subpoena', 'Deposition')),
  direction TEXT NOT NULL CHECK (direction IN ('Sent', 'Received')),
  title TEXT NOT NULL,
  served_date DATE,
  due_date DATE,
  response_date DATE,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Overdue', 'Objected')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS discovery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id UUID NOT NULL REFERENCES discovery_sets(id) ON DELETE CASCADE,
  item_number INTEGER NOT NULL,
  request_text TEXT,
  response_text TEXT,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Answered', 'Objected', 'Supplemented')),
  objection_text TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE discovery_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_discovery_sets') THEN
    CREATE POLICY "allow_all_discovery_sets" ON discovery_sets FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_discovery_items') THEN
    CREATE POLICY "allow_all_discovery_items" ON discovery_items FOR ALL USING (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_discovery_sets_case ON discovery_sets(case_id);
CREATE INDEX IF NOT EXISTS idx_discovery_items_set ON discovery_items(set_id);

-- === 004: Case notes ===
CREATE TABLE IF NOT EXISTS case_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  author_id UUID REFERENCES team_members(id),
  content TEXT NOT NULL,
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_notes_case_id ON case_notes(case_id);
CREATE INDEX IF NOT EXISTS idx_case_notes_pinned ON case_notes(case_id, pinned) WHERE pinned = true;

ALTER TABLE case_notes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'case_notes_select') THEN
    CREATE POLICY case_notes_select ON case_notes FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'case_notes_insert') THEN
    CREATE POLICY case_notes_insert ON case_notes FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'case_notes_update') THEN
    CREATE POLICY case_notes_update ON case_notes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'case_notes_delete') THEN
    CREATE POLICY case_notes_delete ON case_notes FOR DELETE TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'case_notes_anon_select') THEN
    CREATE POLICY case_notes_anon_select ON case_notes FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'case_notes_anon_insert') THEN
    CREATE POLICY case_notes_anon_insert ON case_notes FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'case_notes_anon_update') THEN
    CREATE POLICY case_notes_anon_update ON case_notes FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'case_notes_anon_delete') THEN
    CREATE POLICY case_notes_anon_delete ON case_notes FOR DELETE TO anon USING (true);
  END IF;
END $$;

-- === 005: Case emails ===
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_direction') THEN
    CREATE TYPE email_direction AS ENUM ('inbound', 'outbound');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS case_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  subject TEXT,
  from_address TEXT,
  to_address TEXT,
  cc_address TEXT,
  body_text TEXT,
  body_html TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  direction email_direction NOT NULL DEFAULT 'inbound',
  read BOOLEAN NOT NULL DEFAULT false,
  starred BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_emails_case_id ON case_emails(case_id);
CREATE INDEX IF NOT EXISTS idx_case_emails_received_at ON case_emails(received_at DESC);

ALTER TABLE case_emails ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can view case emails') THEN
    CREATE POLICY "Authenticated users can view case emails" ON case_emails FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can insert case emails') THEN
    CREATE POLICY "Authenticated users can insert case emails" ON case_emails FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can update case emails') THEN
    CREATE POLICY "Authenticated users can update case emails" ON case_emails FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can delete case emails') THEN
    CREATE POLICY "Authenticated users can delete case emails" ON case_emails FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- === 006: Case tasks ===
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_priority') THEN
    CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
    CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS case_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES team_members(id) ON DELETE SET NULL,
  due_date DATE,
  priority task_priority NOT NULL DEFAULT 'medium',
  status task_status NOT NULL DEFAULT 'pending',
  created_by UUID REFERENCES team_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE case_tasks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for authenticated tasks') THEN
    CREATE POLICY "Allow all for authenticated tasks" ON case_tasks FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_case_tasks_case_id ON case_tasks(case_id);
CREATE INDEX IF NOT EXISTS idx_case_tasks_assigned_to ON case_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_case_tasks_due_date ON case_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_case_tasks_status ON case_tasks(status);

CREATE OR REPLACE FUNCTION update_case_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = now();
  END IF;
  IF NEW.status != 'completed' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS case_tasks_updated_at ON case_tasks;
CREATE TRIGGER case_tasks_updated_at
  BEFORE UPDATE ON case_tasks
  FOR EACH ROW EXECUTE FUNCTION update_case_tasks_updated_at();

-- === Expand jurisdiction constraint ===
ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_jurisdiction_check;
ALTER TABLE cases ADD CONSTRAINT cases_jurisdiction_check 
  CHECK (jurisdiction IS NULL OR jurisdiction IN ('KY','OH','TN','FL','TX','AL','WV','VA','NC','SC','IN','MI','GA','NV','WA','MT','PA','IL','MO','MS','LA','AR','CO','AZ','CA','NY','NJ','MD','DC'));

-- ============================================
-- DONE! All migrations applied.
-- ============================================
