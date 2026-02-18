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
    // Dedicated pooler transaction mode
    `postgres://postgres:${password}@db.amyttoowrroajffqubpd.supabase.co:6543/postgres`,
    // Direct connection
    `postgresql://postgres:${password}@db.amyttoowrroajffqubpd.supabase.co:5432/postgres`,
  ].filter(Boolean);

  // Try DNS resolution first to debug
  const dns = require('dns');
  const dnsResults = {};
  try {
    const addrs4 = await new Promise((res, rej) => dns.resolve4('db.amyttoowrroajffqubpd.supabase.co', (e, a) => e ? rej(e) : res(a)));
    dnsResults.ipv4 = addrs4;
  } catch (e) { dnsResults.ipv4Error = e.message; }
  try {
    const addrs6 = await new Promise((res, rej) => dns.resolve6('db.amyttoowrroajffqubpd.supabase.co', (e, a) => e ? rej(e) : res(a)));
    dnsResults.ipv6 = addrs6;
  } catch (e) { dnsResults.ipv6Error = e.message; }

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

  return NextResponse.json({ error: "All strategies failed", details: errors, dns: dnsResults }, { status: 500 });
}
