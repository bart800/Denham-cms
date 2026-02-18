import { NextResponse } from "next/server";
import pg from "pg";
import dns from "dns";

const { Client } = pg;

// Force Node to prefer IPv6 for DNS resolution
dns.setDefaultResultOrder('verbatim');

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

  // Resolve IPv6 address manually, then connect directly
  let ipv6Addr = null;
  try {
    const addrs = await new Promise((res, rej) => 
      dns.resolve6('db.amyttoowrroajffqubpd.supabase.co', (e, a) => e ? rej(e) : res(a))
    );
    ipv6Addr = addrs[0];
  } catch (e) {
    // Fall through to hostname-based strategies
  }

  const strategies = [
    process.env.DATABASE_URL,
    // Direct IPv6 connection to pooler (transaction mode)
    ipv6Addr ? { host: ipv6Addr, port: 6543, user: 'postgres', password, database: 'postgres' } : null,
    // Direct IPv6 connection (direct mode)
    ipv6Addr ? { host: ipv6Addr, port: 5432, user: 'postgres', password, database: 'postgres' } : null,
    // Hostname-based fallbacks
    `postgres://postgres:${password}@db.amyttoowrroajffqubpd.supabase.co:6543/postgres`,
    `postgresql://postgres:${password}@db.amyttoowrroajffqubpd.supabase.co:5432/postgres`,
  ].filter(Boolean);

  const errors = [];
  for (let i = 0; i < strategies.length; i++) {
    const opts = typeof strategies[i] === 'string' 
      ? { connectionString: strategies[i] }
      : strategies[i];
    
    const client = new Client({
      ...opts,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000
    });
    try {
      await client.connect();
      const result = await client.query(sql);
      await client.end();
      return NextResponse.json({ ok: true, rowCount: result.rowCount, strategy: i, ipv6: ipv6Addr });
    } catch (e) {
      errors.push({ strategy: i, error: e.message });
      await client.end().catch(() => {});
    }
  }

  return NextResponse.json({ error: "All strategies failed", details: errors, ipv6: ipv6Addr }, { status: 500 });
}
