import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Temporary admin endpoint for running migrations
// Uses service role key to execute SQL via pg_dump workaround
export async function POST(request) {
  const { sql, secret } = await request.json();
  
  if (secret !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { db: { schema: 'public' } }
  );

  // Split SQL into individual statements and execute via rpc if available
  // Actually, supabase-js can't run raw DDL. We need pg directly.
  // On Vercel, we can use @vercel/postgres or pg with the connection string.
  
  try {
    const { Client } = require('pg');
    const client = new Client({
      connectionString: process.env.DATABASE_URL || 
        `postgresql://postgres:${process.env.DB_PASSWORD}@db.${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://','').replace('.supabase.co','')}supabase.co:5432/postgres`,
      ssl: { rejectUnauthorized: false }
    });
    await client.connect();
    const result = await client.query(sql);
    await client.end();
    return NextResponse.json({ ok: true, rowCount: result.rowCount });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
