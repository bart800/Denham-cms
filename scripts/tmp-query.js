const{Client}=require('pg');
const c=new Client('postgresql://postgres:f5fIQC4B8KaqcDH4@db.amyttoowrroajffqubpd.supabase.co:5432/postgres');
c.connect()
  .then(()=>c.query(`
    CREATE TABLE IF NOT EXISTS m365_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE UNIQUE,
      microsoft_user_id TEXT,
      email TEXT,
      display_name TEXT,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      scope TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS m365_oauth_state (
      state TEXT PRIMARY KEY,
      team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
      code_verifier TEXT NOT NULL,
      redirect_after TEXT DEFAULT '/',
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `))
  .then(()=>{console.log('Tables created');c.end()})
  .catch(e=>{console.error(e.message);c.end()})
