import * as msal from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";

const CLIO_PATH = "Clio";

let msalApp = null;

function getMsalApp() {
  if (msalApp) return msalApp;
  const clientId = process.env.MS_GRAPH_CLIENT_ID;
  const tenantId = process.env.MS_GRAPH_TENANT_ID;
  if (!clientId || !tenantId) return null;

  msalApp = new msal.PublicClientApplication({
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
    },
  });
  return msalApp;
}

export function isGraphConfigured() {
  return !!(
    process.env.MS_GRAPH_CLIENT_ID &&
    process.env.MS_GRAPH_TENANT_ID &&
    process.env.MS_GRAPH_REFRESH_TOKEN
  );
}

async function getAccessToken() {
  const app = getMsalApp();
  if (!app) throw new Error("Graph not configured");

  const refreshToken = process.env.MS_GRAPH_REFRESH_TOKEN;
  if (!refreshToken) throw new Error("No refresh token");

  // MSAL node doesn't have acquireTokenByRefreshToken publicly,
  // but it does exist. Use it.
  const result = await app.acquireTokenByRefreshToken({
    refreshToken,
    scopes: ["Files.Read.All", "Sites.Read.All"],
  });

  return result.accessToken;
}

function getGraphClient() {
  return Client.init({
    authProvider: async (done) => {
      try {
        const token = await getAccessToken();
        done(null, token);
      } catch (err) {
        done(err, null);
      }
    },
  });
}

/**
 * List items at a path in the user's OneDrive.
 * @param {string} folderPath - Path relative to OneDrive root (e.g. "Clio/Smith, John")
 */
export async function listDriveItems(folderPath = "") {
  const client = getGraphClient();
  const encodedPath = folderPath
    ? encodeURIComponent(folderPath).replace(/%2F/g, "/")
    : "";

  let url;
  if (encodedPath) {
    url = `/me/drive/root:/${encodedPath}:/children`;
  } else {
    url = `/me/drive/root/children`;
  }

  const result = await client.api(url).top(999).get();
  return (result.value || []).map((item) => ({
    id: item.id,
    name: item.name,
    isFolder: !!item.folder,
    size: item.size,
    lastModified: item.lastModifiedDateTime,
    childCount: item.folder?.childCount,
    mimeType: item.file?.mimeType,
    webUrl: item.webUrl,
  }));
}

/**
 * Search for files across the user's OneDrive.
 */
export async function searchDriveItems(query) {
  const client = getGraphClient();
  const result = await client
    .api(`/me/drive/root/search(q='${encodeURIComponent(query)}')`)
    .top(50)
    .get();

  return (result.value || []).map((item) => ({
    id: item.id,
    name: item.name,
    isFolder: !!item.folder,
    size: item.size,
    lastModified: item.lastModifiedDateTime,
    path: item.parentReference?.path?.replace("/drive/root:", "") || "",
    mimeType: item.file?.mimeType,
    webUrl: item.webUrl,
  }));
}

/**
 * Get a download URL for a specific drive item.
 */
export async function getDriveItemContent(itemId) {
  const client = getGraphClient();
  const item = await client.api(`/me/drive/items/${itemId}`).get();
  return {
    id: item.id,
    name: item.name,
    downloadUrl: item["@microsoft.graph.downloadUrl"],
    webUrl: item.webUrl,
    size: item.size,
    mimeType: item.file?.mimeType,
  };
}

/**
 * List case folders in the Clio directory.
 */
export async function listCaseFolders() {
  return listDriveItems(CLIO_PATH);
}
