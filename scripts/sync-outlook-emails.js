#!/usr/bin/env node
/**
 * Outlook Email Sync for Denham CMS
 * Fetches emails via Maton.ai proxy and matches them to cases in Supabase.
 *
 * Usage:
 *   node scripts/sync-outlook-emails.js              # dry run
 *   node scripts/sync-outlook-emails.js --commit      # write to DB
 *   node scripts/sync-outlook-emails.js --days 60     # last 60 days
 */

const https = require("https");
const { URL } = require("url");
const path = require("path");

// Load .env.local from project root
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });

const { createClient } = require("@supabase/supabase-js");

// ── Config ──────────────────────────────────────────────────────────────────
const MATON_API_KEY = process.env.MATON_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://amyttoowrroajffqubpd.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FIRM_DOMAIN = "denham.law";
const BASE_URL = "https://gateway.maton.ai/outlook/v1.0/me";
const PAGE_SIZE = 50;
const RATE_LIMIT_MS = 100; // 10 req/sec

if (!MATON_API_KEY) { console.error("Missing MATON_API_KEY in .env.local"); process.exit(1); }
if (!SUPABASE_KEY) { console.error("Missing SUPABASE_SERVICE_ROLE_KEY in .env.local"); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Args ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const COMMIT = args.includes("--commit");
const daysIdx = args.indexOf("--days");
const DAYS = daysIdx !== -1 ? parseInt(args[daysIdx + 1], 10) : 30;

// ── Helpers ─────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function httpsGet(urlStr, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const opts = { hostname: u.hostname, path: u.pathname + u.search, headers, method: "GET" };
    const req = https.request(opts, (res) => {
      let body = "";
      res.on("data", c => body += c);
      res.on("end", () => {
        if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 300)}`));
        try { resolve(JSON.parse(body)); } catch { resolve(body); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function getDirection(msg) {
  const from = (msg.from?.emailAddress?.address || "").toLowerCase();
  return from.endsWith(`@${FIRM_DOMAIN}`) ? "outbound" : "inbound";
}

function allAddresses(msg) {
  const addrs = [];
  if (msg.from?.emailAddress?.address) addrs.push(msg.from.emailAddress.address.toLowerCase());
  for (const r of (msg.toRecipients || [])) {
    if (r.emailAddress?.address) addrs.push(r.emailAddress.address.toLowerCase());
  }
  for (const r of (msg.ccRecipients || [])) {
    if (r.emailAddress?.address) addrs.push(r.emailAddress.address.toLowerCase());
  }
  return addrs;
}

function matchCase(msg, cases) {
  const addrs = allAddresses(msg);
  const subject = (msg.subject || "").toLowerCase();

  // 1) Email match
  for (const c of cases) {
    if (c.client_email && addrs.includes(c.client_email.toLowerCase())) return c;
  }

  // 2) Subject contains client name or claim number
  for (const c of cases) {
    if (c.client_name && c.client_name.length > 3 && subject.includes(c.client_name.toLowerCase())) return c;
    if (c.claim_number && c.claim_number.length > 2 && subject.includes(c.claim_number.toLowerCase())) return c;
  }

  return null;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n📧 Outlook Email Sync — ${COMMIT ? "COMMIT" : "DRY RUN"} — last ${DAYS} days\n`);

  // Load cases
  const { data: cases, error: cErr } = await supabase
    .from("cases")
    .select("id, client_name, client_email, claim_number, ref");
  if (cErr) { console.error("Failed to load cases:", cErr.message); process.exit(1); }
  console.log(`Loaded ${cases.length} cases`);

  // Build date filter
  const since = new Date();
  since.setDate(since.getDate() - DAYS);
  const sinceISO = since.toISOString();

  const headers = { Authorization: `Bearer ${MATON_API_KEY}` };
  const select = "%24select=id,subject,from,toRecipients,ccRecipients,body,receivedDateTime";
  const filter = `%24filter=receivedDateTime%20ge%20${sinceISO}`;
  const orderby = "%24orderby=receivedDateTime%20desc";

  let nextUrl = `${BASE_URL}/messages?${select}&${filter}&${orderby}&%24top=${PAGE_SIZE}`;
  let allMessages = [];

  // Paginate
  while (nextUrl) {
    console.log(`Fetching page… (${allMessages.length} so far)`);
    const data = await httpsGet(nextUrl, headers);
    const msgs = data.value || [];
    allMessages = allMessages.concat(msgs);
    // Rewrite graph.microsoft.com URLs to Maton proxy
    let rawNext = data["@odata.nextLink"] || null;
    if (rawNext && rawNext.includes("graph.microsoft.com")) {
      rawNext = rawNext.replace("https://graph.microsoft.com", "https://gateway.maton.ai/outlook");
    }
    nextUrl = rawNext;
    if (nextUrl) await sleep(RATE_LIMIT_MS);
  }

  console.log(`Fetched ${allMessages.length} emails total\n`);

  // Match
  let stats = { total: allMessages.length, inbound: 0, outbound: 0, unmatched: 0 };
  const toUpsert = [];

  for (const msg of allMessages) {
    const matched = matchCase(msg, cases);
    if (!matched) { stats.unmatched++; continue; }

    const dir = getDirection(msg);
    dir === "inbound" ? stats.inbound++ : stats.outbound++;

    const fromAddr = msg.from?.emailAddress?.address || "";
    const toAddr = (msg.toRecipients || []).map(r => r.emailAddress?.address).filter(Boolean).join(", ");
    const ccAddr = (msg.ccRecipients || []).map(r => r.emailAddress?.address).filter(Boolean).join(", ");

    toUpsert.push({
      case_id: matched.id,
      subject: (msg.subject || "").slice(0, 500),
      from_address: fromAddr,
      to_address: toAddr,
      cc_address: ccAddr,
      body_text: (msg.body?.content || "").slice(0, 50000),
      body_html: msg.body?.contentType === "html" ? (msg.body?.content || "").slice(0, 50000) : null,
      direction: dir,
      received_at: msg.receivedDateTime,
      message_id: msg.id,
    });
  }

  console.log("── Stats ──");
  console.log(`  Total emails:      ${stats.total}`);
  console.log(`  Matched inbound:   ${stats.inbound}`);
  console.log(`  Matched outbound:  ${stats.outbound}`);
  console.log(`  Unmatched:         ${stats.unmatched}`);
  console.log(`  To upsert:         ${toUpsert.length}`);

  if (!COMMIT) {
    console.log("\n⚠️  Dry run — no changes written. Use --commit to write.\n");
    return;
  }

  // Upsert in batches of 50
  let inserted = 0, skipped = 0;
  for (let i = 0; i < toUpsert.length; i += 50) {
    const batch = toUpsert.slice(i, i + 50);
    const { data, error } = await supabase
      .from("case_emails")
      .upsert(batch, { onConflict: "message_id", ignoreDuplicates: true });
    if (error) {
      console.error(`Batch error at ${i}:`, error.message);
      skipped += batch.length;
    } else {
      inserted += batch.length;
    }
  }

  console.log(`\n✅ Done — inserted/updated: ${inserted}, errors: ${skipped}\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
