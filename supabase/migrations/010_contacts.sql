-- contacts table
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'person' CHECK (type IN ('person', 'company')),
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  title TEXT,
  email TEXT,
  phone TEXT,
  fax TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  fv_person_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- case_contacts junction table
CREATE TABLE case_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('adjuster', 'opposing_counsel', 'mortgage_company', 'contractor', 'public_adjuster', 'expert', 'witness', 'defendant', 'registered_agent', 'referred_by', 'client', 'other')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(case_id, contact_id, role)
);

CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_phone ON contacts(phone);
CREATE INDEX idx_contacts_company ON contacts(company);
CREATE INDEX idx_contacts_tags ON contacts USING GIN(tags);
CREATE INDEX idx_contacts_fv_person_id ON contacts(fv_person_id);
CREATE INDEX idx_case_contacts_case_id ON case_contacts(case_id);
CREATE INDEX idx_case_contacts_contact_id ON case_contacts(contact_id);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contacts_select" ON contacts FOR SELECT USING (true);
CREATE POLICY "contacts_insert" ON contacts FOR INSERT WITH CHECK (true);
CREATE POLICY "contacts_update" ON contacts FOR UPDATE USING (true);
CREATE POLICY "contacts_delete" ON contacts FOR DELETE USING (true);
CREATE POLICY "case_contacts_select" ON case_contacts FOR SELECT USING (true);
CREATE POLICY "case_contacts_insert" ON case_contacts FOR INSERT WITH CHECK (true);
CREATE POLICY "case_contacts_update" ON case_contacts FOR UPDATE USING (true);
CREATE POLICY "case_contacts_delete" ON case_contacts FOR DELETE USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
