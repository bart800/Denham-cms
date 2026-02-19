import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { M365_CONFIG } from '@/lib/m365-auth';

// GET /api/auth/m365/callback?code=xxx&state=xxx
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDesc = searchParams.get('error_description');
  const baseUrl = new URL(request.url).origin;

  if (error) {
    console.error('[m365-callback] OAuth error:', error, errorDesc);
    return NextResponse.redirect(`${baseUrl}/connect-m365?error=${encodeURIComponent(errorDesc || error)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/connect-m365?error=missing_params`);
  }

  // Look up state
  const { data: oauthState } = await supabaseAdmin
    .from('m365_oauth_state')
    .select('*')
    .eq('state', state)
    .single();

  if (!oauthState) {
    return NextResponse.redirect(`${baseUrl}/connect-m365?error=invalid_state`);
  }

  // Check expiry (10 min)
  if (Date.now() - new Date(oauthState.created_at).getTime() > 10 * 60 * 1000) {
    await supabaseAdmin.from('m365_oauth_state').delete().eq('state', state);
    return NextResponse.redirect(`${baseUrl}/connect-m365?error=expired`);
  }

  // Exchange code for tokens
  const tokenRes = await fetch(M365_CONFIG.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: M365_CONFIG.clientId,
      client_secret: M365_CONFIG.clientSecret,
      code,
      redirect_uri: M365_CONFIG.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: oauthState.code_verifier,
      scope: M365_CONFIG.scopes,
    }),
  });

  const tokens = await tokenRes.json();
  if (!tokenRes.ok || tokens.error) {
    console.error('[m365-callback] Token exchange failed:', tokens);
    await supabaseAdmin.from('m365_oauth_state').delete().eq('state', state);
    return NextResponse.redirect(`${baseUrl}/connect-m365?error=${encodeURIComponent(tokens.error_description || 'token_failed')}`);
  }

  // Get user profile from Graph
  const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await profileRes.json();

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  // Store tokens
  const { error: upsertErr } = await supabaseAdmin
    .from('m365_tokens')
    .upsert({
      team_member_id: oauthState.team_member_id,
      microsoft_user_id: profile.id,
      email: profile.mail || profile.userPrincipalName,
      display_name: profile.displayName,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      scope: tokens.scope,
      expires_at: expiresAt,
    }, { onConflict: 'team_member_id' });

  if (upsertErr) {
    console.error('[m365-callback] Token storage failed:', upsertErr);
    await supabaseAdmin.from('m365_oauth_state').delete().eq('state', state);
    return NextResponse.redirect(`${baseUrl}/connect-m365?error=storage_failed`);
  }

  // Mark team member as connected
  await supabaseAdmin.from('team_members').update({ microsoft_connected: true }).eq('id', oauthState.team_member_id);

  // Clean up state
  await supabaseAdmin.from('m365_oauth_state').delete().eq('state', state);

  // Redirect to success
  const redirectAfter = oauthState.redirect_after || '/';
  return NextResponse.redirect(`${baseUrl}${redirectAfter}?m365=connected`);
}
