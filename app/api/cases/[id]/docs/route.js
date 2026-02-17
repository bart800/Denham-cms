import { readdir, stat } from "fs/promises";
import { join, extname } from "path";
import { createClient } from "@supabase/supabase-js";

const CLIO_BASE = "C:\\Users\\bart\\OneDrive - Bart Denham Law\\Clio";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://amyttoowrroajffqubpd.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFteXR0b293cnJvYWpmZnF1YnBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTQwOTYsImV4cCI6MjA4NjY3MDA5Nn0.tp97U9MmMG1Lz6-XaYg5WIqbaUrbC7V2LcqlJXgw1jM";

import { readFile } from "fs/promises";

let clioIndex = null;
async function getClioIndex() {
  if (!clioIndex) {
    try {
      const raw = await readFile(join(process.cwd(), "data", "clio-index.json"), "utf8");
      clioIndex = JSON.parse(raw);
    } catch { clioIndex = { cases: [] }; }
  }
  return clioIndex;
}

// Match a case to Clio folders by client name
async function findClioMatch(clientName) {
  if (!clientName) return null;
  const index = await getClioIndex();
  const norm = clientName.toLowerCase().trim();

  // Exact match
  let match = index.cases.find(c => c.name.toLowerCase().trim() === norm);
  if (match) return match;

  // Try "Last, First" format
  const parts = norm.split(/\s+/);
  if (parts.length >= 2) {
    const lastFirst = `${parts[parts.length - 1]}, ${parts[0]}`;
    match = index.cases.find(c => c.name.toLowerCase().trim() === lastFirst);
    if (match) return match;
    // Also try first name matching: "First Last" → look for "Last, First"
    const firstLast = `${parts[0]}`;
    const lastName = parts[parts.length - 1];
    match = index.cases.find(c => {
      const cn = c.name.toLowerCase();
      return cn.startsWith(lastName + ",") && cn.includes(firstLast);
    });
    if (match) return match;
  }

  // Fuzzy: check if all significant client name words appear in Clio folder name
  match = index.cases.find(c => {
    const cn = c.name.toLowerCase();
    return parts.filter(p => p.length > 2).every(p => cn.includes(p));
  });

  return match || null;
}

export async function GET(request, { params }) {
  const { id } = await params;

  try {
    // Get the case from Supabase to find client name
    const supabase = createClient(url, key);
    const { data: caseData, error } = await supabase
      .from("cases")
      .select("client_name, ref")
      .eq("id", id)
      .single();

    if (error || !caseData) {
      return Response.json({ error: "Case not found" }, { status: 404 });
    }

    const clientName = caseData.client_name;
    const clioMatch = await findClioMatch(clientName);

    if (!clioMatch) {
      return Response.json({
        caseId: id,
        clientName,
        matched: false,
        clioFolder: null,
        subfolders: [],
        rootFiles: [],
      });
    }

    // Try to read actual files from disk for richer data
    const clioPath = join(CLIO_BASE, clioMatch.name);
    let subfolders = [];
    let rootFiles = clioMatch.files || [];

    try {
      const entries = await readdir(clioPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subPath = join(clioPath, entry.name);
          try {
            const subEntries = await readdir(subPath, { withFileTypes: true });
            const files = [];
            const subdirs = [];
            for (const se of subEntries) {
              if (se.isDirectory()) {
                // Recurse one more level for category subfolders
                const catPath = join(subPath, se.name);
                try {
                  const catEntries = await readdir(catPath, { withFileTypes: true });
                  const catFiles = [];
                  for (const ce of catEntries) {
                    if (!ce.isDirectory()) {
                      try {
                        const s = await stat(join(catPath, ce.name));
                        catFiles.push({ name: ce.name, ext: extname(ce.name).toLowerCase(), size: s.size, modified: s.mtime.toISOString() });
                      } catch {
                        catFiles.push({ name: ce.name, ext: extname(ce.name).toLowerCase(), size: 0, modified: null });
                      }
                    }
                  }
                  if (catFiles.length > 0) {
                    subdirs.push({ name: se.name, files: catFiles });
                  }
                } catch { /* skip unreadable */ }
              } else {
                try {
                  const s = await stat(join(subPath, se.name));
                  files.push({ name: se.name, ext: extname(se.name).toLowerCase(), size: s.size, modified: s.mtime.toISOString() });
                } catch {
                  files.push({ name: se.name, ext: extname(se.name).toLowerCase(), size: 0, modified: null });
                }
              }
            }
            subfolders.push({ name: entry.name, files, subdirs });
          } catch { /* skip unreadable */ }
        }
      }
    } catch {
      // Fall back to index data only
      subfolders = (clioMatch.subfolders || []).map(sf => ({
        name: sf.name,
        files: [],
        categories: sf.categories || {},
      }));
    }

    return Response.json({
      caseId: id,
      clientName,
      matched: true,
      clioFolder: clioMatch.name,
      subfolders,
      rootFiles,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
