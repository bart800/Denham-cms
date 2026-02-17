import { isGraphConfigured, listDriveItems, listCaseFolders, searchDriveItems, getDriveItemContent } from "../../../../lib/graph";

export async function GET(request) {
  if (!isGraphConfigured()) {
    return Response.json({ error: "Graph API not configured. Run: node scripts/graph-login.js" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  const search = searchParams.get("search");
  const itemId = searchParams.get("itemId");

  try {
    // Get download URL for a specific item
    if (itemId) {
      const item = await getDriveItemContent(itemId);
      return Response.json(item);
    }

    // Search
    if (search) {
      const results = await searchDriveItems(search);
      return Response.json({ items: results, total: results.length });
    }

    // List case folders (default) or browse a path
    if (path) {
      const items = await listDriveItems(path);
      return Response.json({ items, total: items.length, path });
    }

    // Default: list Clio case folders
    const folders = await listCaseFolders();
    return Response.json({ items: folders, total: folders.length, path: "Clio" });
  } catch (err) {
    console.error("Graph API error:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
