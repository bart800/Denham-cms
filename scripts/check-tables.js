const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://amyttoowrroajffqubpd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFteXR0b293cnJvYWpmZnF1YnBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA5NDA5NiwiZXhwIjoyMDg2NjcwMDk2fQ.XOo3TXGaKHXUrhiZ_eO12j6qAmKqOZFEXiIoChy6uWA');

async function run() {
  const tables = ['case_expenses','audit_trail','document_requests','case_demands','portal_sessions'];
  for (const t of tables) {
    const r = await s.from(t).select('id').limit(1);
    console.log(t + ': ' + (r.error ? 'MISSING' : 'EXISTS (' + (r.data||[]).length + ' rows sample)'));
  }
}
run();
