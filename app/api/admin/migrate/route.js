import { NextResponse } from "next/server";
import pg from "pg";

const { Client } = pg;

export async function POST(request) {
  const { sql, secret, debug } = await request.json();
  
  if (secret !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (debug) {
    // List all env vars that might contain DB connection info
    const envKeys = Object.keys(process.env).filter(k => 
      k.includes('DATABASE') || k.includes('POSTGRES') || k.includes('PG') || 
      k.includes('DB_') || k.includes('SUPABASE')
    );
    return NextResponse.json({
      dbEnvVars: envKeys.map(k => ({ key: k, len: process.env[k]?.length || 0, preview: process.env[k]?.substring(0, 30) + '...' }))
    });
  }

  // Build strategies from available env vars
  const password = process.env.DB_PASSWORD || '';
  const strategies = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.SUPABASE_DB_URL,
    // Direct connection (IPv6, may work on Vercel)
    password ? `postgresql://postgres:${password}@db.amyttoowrroajffqubpd.supabase.co:5432/postgres` : null,
    // Session mode pooler
    password ? `postgresql://postgres.amyttoowrroajffqubpd:${password}@aws-0-us-east-1.pooler.supabase.com:5432/postgres` : null,
    // Transaction mode pooler  
    password ? `postgresql://postgres.amyttoowrroajffqubpd:${password}@aws-0-us-east-1.pooler.supabase.com:6543/postgres` : null,
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
      return NextResponse.json({ ok: true, rowCount: result.rowCount, strategyIndex: i });
    } catch (e) {
      errors.push({ strategy: i, host: strategies[i].split('@')[1]?.split('/')[0] || '?', error: e.message });
      await client.end().catch(() => {});
    }
  }

  return NextResponse.json({ error: "All strategies failed", details: errors }, { status: 500 });
}
