import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCostDashboard } from '@/lib/costTracker';

/**
 * Cost monitoring dashboard. Gated to emails in the ADMIN_EMAILS env var
 * (comma-separated). Without that env set, it returns 403 for everyone.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const admins = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!admins.includes((user.email ?? '').toLowerCase())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    return NextResponse.json(await getCostDashboard());
  } catch (err) {
    console.error('[cost] dashboard error:', err);
    return NextResponse.json({ error: 'Usage reporting is temporarily unavailable.' }, { status: 503 });
  }
}
