import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeAuthRedirect } from '@/lib/authRedirect';

/** Exchanges the PKCE code from signup, recovery, or an OAuth redirect. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const flowId = searchParams.get('sb_flow_id');
  const next = safeAuthRedirect(searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(
      code,
      flowId === null ? undefined : { flowId },
    );
    if (!error) {
      return new NextResponse(null, { status: 303, headers: { Location: next } });
    }
  }

  const failure = next === '/reset-password' ? '/forgot-password' : '/login';
  return new NextResponse(null, { status: 303, headers: { Location: `${failure}?error=callback` } });
}
