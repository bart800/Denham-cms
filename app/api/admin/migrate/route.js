import { NextResponse } from "next/server";
import pg from "pg";

const { Client } = pg;

// Temporary admin endpoint for running migrations
// Connects to Supabase Postgres directly (Vercel has IPv6)
export async function POST(request) {
  const { sql, secret } = await request.json();
  
  if (secret !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Build connection string from existing env vars
  // DB_PASSWORD must be set on Vercel, or fall back to DATABASE_URL
  const connStr = process.env.DATABASE_URL || 
    `postgresql://postgres:${process.env.DB_PASSWORD}@db.amyttoowrroajffqubpd.supabase.co:5432/postgres`;

  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const result = await client.query(sql);
    await client.end();
    return NextResponse.json({ ok: true, rowCount: result.rowCount });
  } catch (e) {
    await client.end().catch(() => {});
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
