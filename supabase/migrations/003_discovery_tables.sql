-- Discovery sets (groups of requests)
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

-- Individual discovery items within a set
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

-- RLS
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_discovery_sets_case ON discovery_sets(case_id);
CREATE INDEX IF NOT EXISTS idx_discovery_items_set ON discovery_items(set_id);
