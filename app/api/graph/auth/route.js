import { isGraphConfigured } from "../../../../lib/graph";

export async function GET() {
  return Response.json({
    configured: isGraphConfigured(),
    hasClientId: !!process.env.MS_GRAPH_CLIENT_ID,
    hasTenantId: !!process.env.MS_GRAPH_TENANT_ID,
    hasRefreshToken: !!process.env.MS_GRAPH_REFRESH_TOKEN,
  });
}
