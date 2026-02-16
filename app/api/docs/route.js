import { readdir, stat } from "fs/promises";
import { join, basename, extname } from "path";

const CLIO_BASE = "C:\\Users\\bart\\OneDrive - Bart Denham Law\\Clio";
const CATEGORIES = ["Intake", "Correspondence", "Discovery", "Estimates", "E-Pleadings", "Photos", "Policy", "PA Files", "Pleadings"];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const clientName = searchParams.get("client");
  const caseNumber = searchParams.get("case");
  const category = searchParams.get("category");

  try {
    // List clients
    if (!clientName) {
      const clients = await safeReadDir(CLIO_BASE);
      return Response.json({ clients: clients.filter(c => c.isDirectory).map(c => c.name) });
    }

    const clientPath = join(CLIO_BASE, clientName);

    // List case folders for a client
    if (!caseNumber) {
      const cases = await safeReadDir(clientPath);
      return Response.json({ client: clientName, cases: cases.filter(c => c.isDirectory).map(c => c.name) });
    }

    const casePath = join(clientPath, caseNumber);

    // List categories or files within a category
    if (!category) {
      const dirs = await safeReadDir(casePath);
      const categories = dirs.filter(d => d.isDirectory).map(d => d.name);
      return Response.json({ client: clientName, case: caseNumber, categories });
    }

    const catPath = join(casePath, category);
    const files = await safeReadDir(catPath);
    return Response.json({
      client: clientName,
      case: caseNumber,
      category,
      files: files.filter(f => !f.isDirectory).map(f => ({
        name: f.name,
        ext: extname(f.name).toLowerCase(),
        size: f.size,
        modified: f.modified,
      })),
    });
  } catch (err) {
    if (err.code === "ENOENT") {
      return Response.json({ error: "Path not found", path: err.path }, { status: 404 });
    }
    return Response.json({ error: err.message }, { status: 500 });
  }
}

async function safeReadDir(dirPath) {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    const results = [];
    for (const entry of entries) {
      try {
        const fullPath = join(dirPath, entry.name);
        const s = await stat(fullPath);
        results.push({
          name: entry.name,
          isDirectory: entry.isDirectory(),
          size: s.size,
          modified: s.mtime.toISOString(),
        });
      } catch {
        results.push({ name: entry.name, isDirectory: entry.isDirectory(), size: 0, modified: null });
      }
    }
    return results;
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}
