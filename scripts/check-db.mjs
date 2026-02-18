import { createClient } from '@supabase/supabase-js';
const s = createClient('https://amyttoowrroajffqubpd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFteXR0b293cnJvYWpmZnF1YnBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA5NDA5NiwiZXhwIjoyMDg2NjcwMDk2fQ.XOo3TXGaKHXUrhiZ_eO12j6qAmKqOZFEXiIoChy6uWA');

const { data, error } = await s.from('documents').select('*').limit(1);
console.log('documents sample:', JSON.stringify(data, null, 2), error?.message);

const { data: buckets } = await s.storage.listBuckets();
console.log('buckets:', buckets?.map(b => b.name));
