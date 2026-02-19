const{Client}=require('pg');
const c=new Client('postgresql://postgres:f5fIQC4B8KaqcDH4@db.amyttoowrroajffqubpd.supabase.co:5432/postgres');
c.connect()
  .then(()=>c.query(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      outlook_event_id TEXT UNIQUE,
      team_member_id UUID REFERENCES team_members(id),
      subject TEXT,
      start_time TIMESTAMPTZ,
      end_time TIMESTAMPTZ,
      timezone TEXT DEFAULT 'Eastern Standard Time',
      location TEXT,
      body_preview TEXT,
      is_all_day BOOLEAN DEFAULT false,
      organizer_email TEXT,
      attendees JSONB,
      synced_from TEXT,
      case_id UUID REFERENCES cases(id),
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `))
  .then(()=>{console.log('calendar_events table ready');c.end()})
  .catch(e=>{console.error(e.message);c.end()})
