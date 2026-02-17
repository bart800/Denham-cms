-- 006_case_tasks.sql
-- Task management for cases

CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');

CREATE TABLE case_tasks (
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

CREATE POLICY "Allow all for authenticated" ON case_tasks
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_case_tasks_case_id ON case_tasks(case_id);
CREATE INDEX idx_case_tasks_assigned_to ON case_tasks(assigned_to);
CREATE INDEX idx_case_tasks_due_date ON case_tasks(due_date);
CREATE INDEX idx_case_tasks_status ON case_tasks(status);

-- Auto-update updated_at
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

CREATE TRIGGER case_tasks_updated_at
  BEFORE UPDATE ON case_tasks
  FOR EACH ROW EXECUTE FUNCTION update_case_tasks_updated_at();
