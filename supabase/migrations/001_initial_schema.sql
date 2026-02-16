-- Denham CMS - Initial Schema
-- Production-quality schema for plaintiff-side property insurance law firm

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TEAM MEMBERS
-- ============================================================
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  legacy_id INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Admin','Attorney','Paralegal','Case Manager','Legal Assistant')),
  title TEXT NOT NULL,
  initials TEXT NOT NULL,
  color TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_team_members_role ON team_members(role);

-- ============================================================
-- CASES
-- ============================================================
CREATE TABLE cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ref TEXT UNIQUE NOT NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT,
  client_email TEXT,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Intake' CHECK (status IN (
    'Intake','Investigation','Presuit Demand','Presuit Negotiation',
    'Litigation - Filed','Litigation - Discovery','Litigation - Mediation',
    'Litigation - Trial Prep','Appraisal','Settled','Closed'
  )),
  jurisdiction TEXT NOT NULL CHECK (jurisdiction IN ('KY','TN','MT','NC','TX','CA','WA','CO','NY')),
  attorney_id UUID NOT NULL REFERENCES team_members(id),
  support_id UUID NOT NULL REFERENCES team_members(id),
  date_of_loss DATE NOT NULL,
  date_opened DATE NOT NULL,
  statute_of_limitations DATE NOT NULL,
  insurer TEXT NOT NULL,
  claim_number TEXT,
  policy_number TEXT,
  total_recovery NUMERIC(12,2) NOT NULL DEFAULT 0,
  attorney_fees NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_jurisdiction ON cases(jurisdiction);
CREATE INDEX idx_cases_attorney_id ON cases(attorney_id);
CREATE INDEX idx_cases_support_id ON cases(support_id);
CREATE INDEX idx_cases_insurer ON cases(insurer);
CREATE INDEX idx_cases_sol ON cases(statute_of_limitations);
CREATE INDEX idx_cases_ref ON cases(ref);
CREATE INDEX idx_cases_client_name ON cases(client_name);

-- ============================================================
-- CLAIM DETAILS (1:1 with cases)
-- ============================================================
CREATE TABLE claim_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID UNIQUE NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  policy_number TEXT,
  claim_number TEXT,
  insurer TEXT,
  adjuster_name TEXT,
  adjuster_phone TEXT,
  adjuster_email TEXT,
  date_of_loss DATE,
  date_reported DATE,
  date_denied DATE,
  policy_type TEXT,
  policy_limits TEXT,
  deductible TEXT,
  cause_of_loss TEXT,
  property_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- LITIGATION DETAILS (1:1 with cases, nullable)
-- ============================================================
CREATE TABLE litigation_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID UNIQUE NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  case_number TEXT,
  court TEXT,
  judge TEXT,
  filed_date DATE,
  opposing_counsel TEXT,
  opposing_firm TEXT,
  opposing_phone TEXT,
  opposing_email TEXT,
  trial_date DATE,
  mediation_date DATE,
  discovery_deadline DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- NEGOTIATIONS
-- ============================================================
CREATE TABLE negotiations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'bottom_line','plaintiff_offer','defendant_offer','presuit_demand',
    'settlement','undisputed_payment','denial','appraisal_award'
  )),
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  date DATE NOT NULL,
  notes TEXT,
  by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_negotiations_case_id ON negotiations(case_id);
CREATE INDEX idx_negotiations_type ON negotiations(type);
CREATE INDEX idx_negotiations_date ON negotiations(date);

-- ============================================================
-- ESTIMATES
-- ============================================================
CREATE TABLE estimates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  vendor TEXT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_estimates_case_id ON estimates(case_id);

-- ============================================================
-- PLEADINGS
-- ============================================================
CREATE TABLE pleadings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  date DATE NOT NULL,
  filed_by TEXT NOT NULL CHECK (filed_by IN ('Plaintiff','Defendant')),
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Filed','Served','Pending','Granted','Denied','Withdrawn')),
  notes TEXT,
  doc_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pleadings_case_id ON pleadings(case_id);

-- ============================================================
-- ACTIVITY LOG
-- ============================================================
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'note','call','email','task','document','negotiation',
    'pleading','estimate','status_change','deadline'
  )),
  actor_name TEXT NOT NULL,
  actor_initials TEXT,
  actor_color TEXT,
  title TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  time TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_log_case_id ON activity_log(case_id);
CREATE INDEX idx_activity_log_type ON activity_log(type);
CREATE INDEX idx_activity_log_date ON activity_log(date DESC);

-- ============================================================
-- DISCOVERY SETS
-- ============================================================
CREATE TABLE discovery_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('Interrogatories','Requests for Production','Requests for Admission')),
  set_number INTEGER NOT NULL DEFAULT 1,
  served_date DATE,
  due_date DATE,
  from_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','overdue')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_discovery_sets_case_id ON discovery_sets(case_id);

-- ============================================================
-- DISCOVERY ITEMS
-- ============================================================
CREATE TABLE discovery_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  discovery_set_id UUID NOT NULL REFERENCES discovery_sets(id) ON DELETE CASCADE,
  item_number INTEGER NOT NULL,
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','drafted','reviewed','final','objection_only')),
  objections TEXT[] NOT NULL DEFAULT '{}',
  response TEXT NOT NULL DEFAULT '',
  ai_draft TEXT,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_discovery_items_set_id ON discovery_items(discovery_set_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'team_members','cases','claim_details','litigation_details',
    'negotiations','estimates','pleadings','activity_log',
    'discovery_sets','discovery_items'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
      t, t
    );
  END LOOP;
END $$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE litigation_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE negotiations ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE pleadings ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_items ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read/write all tables (firm-internal app)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'team_members','cases','claim_details','litigation_details',
    'negotiations','estimates','pleadings','activity_log',
    'discovery_sets','discovery_items'
  ] LOOP
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)', t || '_select', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (true)', t || '_insert', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t || '_update', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (true)', t || '_delete', t);
  END LOOP;
END $$;

-- Also allow anon access for demo/dev (remove in production)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'team_members','cases','claim_details','litigation_details',
    'negotiations','estimates','pleadings','activity_log',
    'discovery_sets','discovery_items'
  ] LOOP
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO anon USING (true)', t || '_anon_select', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO anon WITH CHECK (true)', t || '_anon_insert', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO anon USING (true) WITH CHECK (true)', t || '_anon_update', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO anon USING (true)', t || '_anon_delete', t);
  END LOOP;
END $$;
