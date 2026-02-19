import { supabaseAdmin } from './supabase';
import { M365_CONFIG } from './m365-auth';

/**
 * Get a valid access token for a team member, auto-refreshing if needed.
 * @param {string} memberId - team_members.id
 */
export async function getM365Token(memberId) {
  const { data: tokenRow } = await supabaseAdmin
    .from('m365_tokens')
    .select('*')
    .eq('team_member_id', memberId)
    .single();

  if (!tokenRow) return null;

  // If token expires in less than 5 minutes, refresh
  const expiresAt = new Date(tokenRow.expires_at);
  if (expiresAt.getTime() - Date.now() > 5 * 60 * 1000) {
    return tokenRow.access_token;
  }

  // Refresh
  const res = await fetch(M365_CONFIG.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: M365_CONFIG.clientId,
      client_secret: M365_CONFIG.clientSecret,
      refresh_token: tokenRow.refresh_token,
      grant_type: 'refresh_token',
      scope: M365_CONFIG.scopes,
    }),
  });

  const tokens = await res.json();
  if (!res.ok || tokens.error) {
    console.error('[m365] Auto-refresh failed:', tokens.error);
    if (tokens.error === 'invalid_grant') {
      await supabaseAdmin.from('m365_tokens').delete().eq('team_member_id', memberId);
    }
    return null;
  }

  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  await supabaseAdmin.from('m365_tokens').update({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || tokenRow.refresh_token,
    expires_at: newExpiresAt,
  }).eq('team_member_id', memberId);

  return tokens.access_token;
}

/**
 * Make an authenticated Graph API call for a team member.
 */
export async function graphFetch(memberId, endpoint, options = {}) {
  const token = await getM365Token(memberId);
  if (!token) throw new Error('No valid M365 token for this user');

  const url = endpoint.startsWith('http') ? endpoint : `https://graph.microsoft.com/v1.0${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Graph API ${res.status}: ${JSON.stringify(err)}`);
  }

  return res.json();
}
