import { NextResponse } from "next/server";
import pg from "pg";

const { Client } = pg;

export async function POST(request) {
  const { sql, secret, debug } = await request.json();
  
  if (secret !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (debug) {
    const envKeys = Object.keys(process.env).filter(k => 
      k.includes('DATABASE') || k.includes('POSTGRES') || k.includes('PG') || 
      k.includes('DB_') || k.includes('SUPABASE')
    );
    return NextResponse.json({
      dbEnvVars: envKeys.map(k => ({ key: k, len: process.env[k]?.length || 0 }))
    });
  }

  const password = process.env.DB_PASSWORD || '';
  if (!password && !process.env.DATABASE_URL) {
    return NextResponse.json({ error: "No DB credentials configured" }, { status: 500 });
  }

  // Dedicated pooler (transaction mode, port 6543) - IPv6, works on Vercel
  // Username is "postgres" (not "postgres.ref") for dedicated pooler
  const strategies = [
    process.env.DATABASE_URL,
    `postgres://postgres:${password}@db.amyttoowrroajffqubpd.supabase.co:6543/postgres`,
    `postgresql://postgres:${password}@db.amyttoowrroajffqubpd.supabase.co:5432/postgres`,
  ].filter(Boolean);

  const errors = [];
  for (let i = 0; i < strategies.length; i++) {
    const client = new Client({
      connectionString: strategies[i],
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000
    });
    try {
      await client.connect();
      const result = await client.query(sql);
      await client.end();
      return NextResponse.json({ ok: true, rowCount: result.rowCount, strategy: i });
    } catch (e) {
      errors.push({ strategy: i, error: e.message });
      await client.end().catch(() => {});
    }
  }

  return NextResponse.json({ error: "All strategies failed", details: errors }, { status: 500 });
}
