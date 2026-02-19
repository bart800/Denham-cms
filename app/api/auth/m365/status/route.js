import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/auth/m365/status?memberId=xxx
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get('memberId');
  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 });

  const { data: token } = await supabaseAdmin
    .from('m365_tokens')
    .select('email, display_name, expires_at')
    .eq('team_member_id', memberId)
    .single();

  if (!token) return NextResponse.json({ connected: false });

  return NextResponse.json({
    connected: true,
    email: token.email,
    displayName: token.display_name,
    tokenExpires: token.expires_at,
  });
}
