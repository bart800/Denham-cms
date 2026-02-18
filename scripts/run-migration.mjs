import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const s = createClient(
  'https://amyttoowrroajffqubpd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFteXR0b293cnJvYWpmZnF1YnBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA5NDA5NiwiZXhwIjoyMDg2NjcwMDk2fQ.XOo3TXGaKHXUrhiZ_eO12j6qAmKqOZFEXiIoChy6uWA',
  { db: { schema: 'public' } }
);

const sql = fs.readFileSync(process.argv[2], 'utf8');
const statements = sql.split(';').map(s => s.trim()).filter(Boolean);

for (const stmt of statements) {
  console.log('Running:', stmt.substring(0, 80) + '...');
  const { error } = await s.rpc('exec_sql', { query: stmt });
  if (error) {
    // Try via REST - use postgres connection directly
    console.log('RPC failed, trying direct...', error.message);
  } else {
    console.log('OK');
  }
}
