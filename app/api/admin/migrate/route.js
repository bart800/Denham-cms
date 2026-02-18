import { NextResponse } from "next/server";
import pg from "pg";

const { Client } = pg;

// Temporary admin endpoint for running migrations
export async function POST(request) {
  const { sql, secret } = await request.json();
  
  if (secret !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Try multiple connection strategies
  const strategies = [
    // Strategy 1: Full DATABASE_URL if provided
    process.env.DATABASE_URL,
    // Strategy 2: Direct connection (IPv6, works on Vercel)
    `postgresql://postgres:${process.env.DB_PASSWORD}@db.amyttoowrroajffqubpd.supabase.co:5432/postgres`,
    // Strategy 3: Session mode pooler (port 5432)
    `postgresql://postgres.amyttoowrroajffqubpd:${process.env.DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
    // Strategy 4: Transaction mode pooler (port 6543) 
    `postgresql://postgres.amyttoowrroajffqubpd:${process.env.DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
  ].filter(Boolean);

  for (const connStr of strategies) {
    const client = new Client({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000
    });

    try {
      await client.connect();
      const result = await client.query(sql);
      await client.end();
      return NextResponse.json({ ok: true, rowCount: result.rowCount, strategy: connStr.split('@')[1]?.split('/')[0] });
    } catch (e) {
      await client.end().catch(() => {});
      // If last strategy, return error
      if (connStr === strategies[strategies.length - 1]) {
        return NextResponse.json({ error: e.message, tried: strategies.length }, { status: 500 });
      }
      // Otherwise try next
      continue;
    }
  }
}
