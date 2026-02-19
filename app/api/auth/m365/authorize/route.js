import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { M365_CONFIG, generateCodeVerifier, generateCodeChallenge, generateState } from '@/lib/m365-auth';

// GET /api/auth/m365/authorize?memberId=xxx&redirect=/portal
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get('memberId');
  const redirectAfter = searchParams.get('redirect') || '/';

  if (!memberId) {
    return NextResponse.json({ error: 'memberId required' }, { status: 400 });
  }

  if (!M365_CONFIG.clientId) {
    return NextResponse.json({ error: 'M365 not configured (missing M365_CLIENT_ID)' }, { status: 500 });
  }

  // Verify member exists
  const { data: member } = await supabaseAdmin.from('team_members').select('id, email').eq('id', memberId).single();
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

  // Generate PKCE values
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();

  // Store state in DB
  await supabaseAdmin.from('m365_oauth_state').upsert({
    state,
    team_member_id: memberId,
    code_verifier: codeVerifier,
    redirect_after: redirectAfter,
    created_at: new Date().toISOString(),
  });

  // Build Microsoft auth URL
  const params = new URLSearchParams({
    client_id: M365_CONFIG.clientId,
    response_type: 'code',
    redirect_uri: M365_CONFIG.redirectUri,
    scope: M365_CONFIG.scopes,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    response_mode: 'query',
    login_hint: member.email, // Pre-fill their email
  });

  return NextResponse.redirect(`${M365_CONFIG.authorizeUrl}?${params.toString()}`);
}
