import { NextResponse } from "next/server";
import pg from "pg";

const { Client } = pg;

export async function POST(request) {
  const { sql, secret, debug } = await request.json();
  
  if (secret !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (debug) {
    return NextResponse.json({
      hasDBPassword: !!process.env.DB_PASSWORD,
      dbPasswordLen: process.env.DB_PASSWORD?.length || 0,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
    });
  }

  const password = process.env.DB_PASSWORD;
  if (!password && !process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DB_PASSWORD or DATABASE_URL env var not set" }, { status: 500 });
  }

  // Try strategies in order
  const errors = [];
  const strategies = [
    process.env.DATABASE_URL,
    `postgresql://postgres:${password}@db.amyttoowrroajffqubpd.supabase.co:5432/postgres`,
    `postgresql://postgres.amyttoowrroajffqubpd:${password}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
    `postgresql://postgres.amyttoowrroajffqubpd:${password}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
  ].filter(Boolean);

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
      errors.push({ strategy: i, error: e.message });
      await client.end().catch(() => {});
    }
  }

  return NextResponse.json({ error: "All strategies failed", details: errors }, { status: 500 });
}
