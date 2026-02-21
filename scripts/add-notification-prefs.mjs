import { createClient } from '@supabase/supabase-js';
const db = createClient(
  'https://amyttoowrroajffqubpd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFteXR0b293cnJvYWpmZnF1YnBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA5NDA5NiwiZXhwIjoyMDg2NjcwMDk2fQ.XOo3TXGaKHXUrhiZ_eO12j6qAmKqOZFEXiIoChy6uWA'
);

const { data, error } = await db.rpc('exec_sql', {
  sql: `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{"email_enabled":true,"daily_digest":true,"task_assignment":true}'::jsonb`
});
console.log('Result:', JSON.stringify({ data, error }));
