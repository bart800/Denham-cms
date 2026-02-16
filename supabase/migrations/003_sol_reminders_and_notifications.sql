-- Denham CMS - SOL Reminders & Notifications
-- Migration 003

-- ============================================================
-- SOL REMINDERS - tracks sent SOL deadline reminders
-- ============================================================
CREATE TABLE sol_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('30_day','60_day','90_day','custom')),
  channel TEXT NOT NULL DEFAULT 'system' CHECK (channel IN ('system','email','sms')),
  sent_to TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sol_reminders_case_id ON sol_reminders(case_id);
CREATE INDEX idx_sol_reminders_type ON sol_reminders(reminder_type);

-- ============================================================
-- NOTIFICATIONS - general notification log
-- ============================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
  user_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'general',
  channel TEXT NOT NULL DEFAULT 'system' CHECK (channel IN ('system','email','sms')),
  recipient TEXT,
  subject TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped','logged')),
  provider TEXT,
  metadata JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_case_id ON notifications(case_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- RLS
ALTER TABLE sol_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY sol_reminders_anon_all ON sol_reminders FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY sol_reminders_auth_all ON sol_reminders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY notifications_anon_all ON notifications FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY notifications_auth_all ON notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);
