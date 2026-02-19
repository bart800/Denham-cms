const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://amyttoowrroajffqubpd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFteXR0b293cnJvYWpmZnF1YnBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA5NDA5NiwiZXhwIjoyMDg2NjcwMDk2fQ.XOo3TXGaKHXUrhiZ_eO12j6qAmKqOZFEXiIoChy6uWA');

async function run() {
  const tables = ['case_expenses','audit_trail','document_requests','case_demands','portal_sessions'];
  for (const t of tables) {
    // Insert a dummy row to see what columns are accepted - or just select *
    const r = await s.from(t).select('*').limit(0);
    // The columns won't show from empty results, let's try inserting bad data
    const r2 = await s.from(t).insert({_test:1}).select();
    console.log(t + ': ' + (r2.error ? r2.error.message : JSON.stringify(r2.data)));
  }
}
run();
