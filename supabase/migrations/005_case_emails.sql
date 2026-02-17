-- Migration: Case Emails
-- Stores email records linked to cases

CREATE TYPE email_direction AS ENUM ('inbound', 'outbound');

CREATE TABLE case_emails (
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

-- Indexes
CREATE INDEX idx_case_emails_case_id ON case_emails(case_id);
CREATE INDEX idx_case_emails_received_at ON case_emails(received_at DESC);

-- RLS
ALTER TABLE case_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view case emails"
  ON case_emails FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert case emails"
  ON case_emails FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update case emails"
  ON case_emails FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete case emails"
  ON case_emails FOR DELETE
  TO authenticated
  USING (true);
