/**
 * Sync documents from local OneDrive/Clio folder to Supabase Storage + documents table.
 * 
 * Usage:
 *   node scripts/sync-onedrive-to-supabase.js [--dry-run] [--client "Client Name"] [--limit 100]
 * 
 * Requires: .env.local with SUPABASE_SERVICE_ROLE_KEY
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');
const { readdir, stat, readFile } = require('fs/promises');
const { join, extname, relative } = require('path');

const CLIO_BASE = "C:\\Users\\bart\\OneDrive - Bart Denham Law\\Clio";
const BUCKET = "documents";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://amyttoowrroajffqubpd.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) { console.error("Missing SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Parse CLI args
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const clientFilter = args.includes("--client") ? args[args.indexOf("--client") + 1] : null;
const limitArg = args.includes("--limit") ? parseInt(args[args.indexOf("--limit") + 1]) : Infinity;

const MIME_MAP = {
  pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", tiff: "image/tiff",
  msg: "application/vnd.ms-outlook", eml: "message/rfc822", txt: "text/plain", csv: "text/csv",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip", rar: "application/x-rar-compressed",
};

// Load case mapping (client_name → case_id)
let caseMap = {};

async function loadCaseMap() {
  const { data, error } = await supabase.from("cases").select("id, client_name, ref");
  if (error) { console.error("Failed to load cases:", error.message); return; }
  for (const c of data) {
    // Map by client name (lowercased for fuzzy matching)
    caseMap[c.client_name.toLowerCase()] = c.id;
    // Also map by ref
    if (c.ref) caseMap[c.ref.toLowerCase()] = c.id;
  }
  console.log(`Loaded ${data.length} cases for mapping`);
}

async function walkDir(dir, depth = 0) {
  const entries = [];
  try {
    const items = await readdir(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = join(dir, item.name);
      if (item.isDirectory()) {
        const sub = await walkDir(fullPath, depth + 1);
        entries.push(...sub);
      } else {
        try {
          const s = await stat(fullPath);
          entries.push({ path: fullPath, name: item.name, size: s.size, modified: s.mtime });
        } catch { /* skip unreadable files */ }
      }
    }
  } catch { /* skip unreadable dirs */ }
  return entries;
}

function inferCategory(relativePath) {
  const parts = relativePath.split(/[\\/]/);
  // Look for known category folder names in the path
  const known = ["Intake", "Correspondence", "Discovery", "Estimates", "E-Pleadings", "Photos", "Policy", "PA Files", "Pleadings"];
  for (const part of parts) {
    for (const cat of known) {
      if (part.toLowerCase() === cat.toLowerCase()) return cat;
    }
  }
  // If no known category, use the first subfolder under the case folder
  if (parts.length >= 3) return parts[2]; // client/case/category/...
  return "Uncategorized";
}

function findCaseId(clientFolder, caseFolder) {
  // Try exact client name match
  const clientKey = clientFolder.toLowerCase();
  if (caseMap[clientKey]) return caseMap[clientKey];
  
  // Try case folder as ref
  const caseKey = caseFolder?.toLowerCase();
  if (caseKey && caseMap[caseKey]) return caseMap[caseKey];

  // Try partial match on client name
  for (const [key, id] of Object.entries(caseMap)) {
    if (clientKey.includes(key) || key.includes(clientKey)) return id;
  }
  return null;
}

async function syncFile(file, clientFolder, caseFolder) {
  const relPath = relative(CLIO_BASE, file.path);
  const ext = extname(file.name).slice(1).toLowerCase();
  const category = inferCategory(relPath);
  const caseId = findCaseId(clientFolder, caseFolder);
  const mime = MIME_MAP[ext] || "application/octet-stream";

  // Sanitize filename for Supabase Storage (no brackets, quotes, special unicode)
  const safeName = file.name
    .replace(/[\[\]"'""\u2018\u2019\u201C\u201D\u2013\u2014]/g, "")
    .replace(/[()]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_.\-]/g, "_")
    .replace(/_+/g, "_");

  // Log files over 5GB (Supabase Pro limit)
  if (file.size > 5 * 1024 * 1024 * 1024) {
    console.error(`\n  TOO LARGE (${fmtSize(file.size)}): ${file.path}`);
    return { synced: false, reason: "too large", size: file.size };
  }

  // Storage path: caseId/category/filename (or client/case/... if no case match)
  const storagePath = caseId
    ? `${caseId}/${category}/${safeName}`
    : `unmatched/${clientFolder.replace(/[^a-zA-Z0-9_.\-]/g, "_")}/${(caseFolder || "root").replace(/[^a-zA-Z0-9_.\-]/g, "_")}/${safeName}`;

  if (dryRun) {
    console.log(`[DRY] ${relPath} → ${storagePath} (case: ${caseId || "UNMATCHED"}, cat: ${category}, ${fmtSize(file.size)})`);
    return { synced: false, dryRun: true };
  }

  // Check if already uploaded
  const { data: existing } = await supabase
    .from("documents")
    .select("id, size_bytes, modified_at")
    .eq("storage_path", storagePath)
    .single();

  if (existing && existing.size_bytes === file.size) {
    return { synced: false, reason: "already exists" };
  }

  // Read and upload file
  const buffer = await readFile(file.path);
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: mime, upsert: true });

  if (uploadErr) {
    console.error(`  Upload failed: ${uploadErr.message}`);
    return { synced: false, error: uploadErr.message };
  }

  // Upsert document metadata
  const { error: dbErr } = await supabase
    .from("documents")
    .upsert({
      case_id: caseId,
      storage_path: storagePath,
      original_path: relPath,
      filename: file.name,
      extension: ext,
      category,
      size_bytes: file.size,
      mime_type: mime,
      modified_at: file.modified.toISOString(),
      uploaded_at: new Date().toISOString(),
    }, { onConflict: "storage_path" });

  if (dbErr) {
    console.error(`  DB insert failed: ${dbErr.message}`);
    return { synced: false, error: dbErr.message };
  }

  return { synced: true };
}

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

async function main() {
  console.log(`Sync: ${CLIO_BASE} → Supabase Storage`);
  if (dryRun) console.log("DRY RUN - no files will be uploaded");
  if (clientFilter) console.log(`Filter: ${clientFilter}`);
  console.log();

  await loadCaseMap();

  // Get client folders
  let clients;
  try {
    clients = await readdir(CLIO_BASE, { withFileTypes: true });
    clients = clients.filter(d => d.isDirectory()).map(d => d.name);
  } catch (err) {
    console.error(`Cannot read Clio folder: ${err.message}`);
    process.exit(1);
  }

  if (clientFilter) {
    clients = clients.filter(c => c.toLowerCase().includes(clientFilter.toLowerCase()));
  }

  console.log(`Found ${clients.length} client folders\n`);

  let totalFiles = 0, synced = 0, skipped = 0, errors = 0;

  for (const client of clients) {
    if (totalFiles >= limitArg) break;

    const clientPath = join(CLIO_BASE, client);
    const caseFolders = await readdir(clientPath, { withFileTypes: true });

    for (const cf of caseFolders) {
      if (totalFiles >= limitArg) break;
      const casePath = join(clientPath, cf.name);

      if (cf.isDirectory()) {
        const files = await walkDir(casePath);
        for (const file of files) {
          if (totalFiles >= limitArg) break;
          totalFiles++;
          
          const result = await syncFile(file, client, cf.name);
          if (result.synced) {
            synced++;
            process.stdout.write(`\r  Synced: ${synced} | Skipped: ${skipped} | Errors: ${errors} | Total: ${totalFiles}`);
          } else if (result.error) {
            errors++;
          } else {
            skipped++;
          }
        }
      } else {
        // File directly under client folder
        totalFiles++;
        const result = await syncFile({ path: casePath, name: cf.name, size: 0, modified: new Date() }, client, null);
        if (result.synced) synced++;
        else if (result.error) errors++;
        else skipped++;
      }
    }
  }

  console.log(`\n\nDone! Synced: ${synced} | Skipped: ${skipped} | Errors: ${errors} | Total: ${totalFiles}`);
}

main().catch(console.error);
