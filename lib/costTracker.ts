import type Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/server';

// ─────────────────────────────────────────────────────────────────────────────
// Pricing: USD per 1M tokens (current Claude list prices). Cost math is
// cache-aware — it reads cache_creation/cache_read tokens off `usage`.
// ─────────────────────────────────────────────────────────────────────────────
export const PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5': { input: 1.0, output: 5.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-opus-4-8': { input: 5.0, output: 25.0 },
};
const DEFAULT_MODEL = 'claude-sonnet-4-6';
const CACHE_WRITE_MULT = 1.25; // 5-minute cache write = 1.25× input
const CACHE_READ_MULT = 0.1; //  cache read = 0.10× input

/** Which model each feature runs on (mirror the app's routing). */
export const FEATURE_MODELS: Record<string, string> = {
  ai_analysis: 'claude-sonnet-4-6',
  job_match_score: 'claude-haiku-4-5',
  resume_tailor: 'claude-sonnet-4-6',
  interview_prep: 'claude-sonnet-4-6',
  salary_insights: 'claude-sonnet-4-6',
  complex_analysis: 'claude-opus-4-8',
};
/** Typical output sizes for pre-flight estimates (tune from real data). */
const EST_OUTPUT_TOKENS: Record<string, number> = {
  ai_analysis: 1200, job_match_score: 350, resume_tailor: 1200,
  interview_prep: 900, salary_insights: 500, complex_analysis: 1500,
};

// Limits / alert thresholds
const MONTHLY_SOFT_USD = 45;
const SINGLE_CALL_WARN_USD = 0.5;
const DAILY_SPEND_ERR_USD = 50;

/** Thrown when a user is over a limit — the route maps this to HTTP 429. */
export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export interface CostInfo {
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  costUsd: number;
  monthSpendUsd: number;
  softLimitAlert: boolean;
}

// ── time boundaries (UTC), as ISO strings for timestamptz comparisons ────────
function dayStart(d = new Date()) { const x = new Date(d); x.setUTCHours(0, 0, 0, 0); return x.toISOString(); }
function monthStart(d = new Date()) { const x = new Date(d); x.setUTCDate(1); x.setUTCHours(0, 0, 0, 0); return x.toISOString(); }
function yearStart(d = new Date()) { const x = new Date(d); x.setUTCMonth(0, 1); x.setUTCHours(0, 0, 0, 0); return x.toISOString(); }

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

function costFor(model: string, inp: number, out: number, cw = 0, cr = 0): number {
  const p = PRICING[model] ?? PRICING[DEFAULT_MODEL];
  const total =
    inp * p.input + out * p.output + cw * p.input * CACHE_WRITE_MULT + cr * p.input * CACHE_READ_MULT;
  return round6(total / 1e6);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Pre-flight estimate — "this analysis will cost ~$0.05"
// ─────────────────────────────────────────────────────────────────────────────
export function costEstimate(feature: string, inputTokens: number, outputTokens?: number) {
  const model = FEATURE_MODELS[feature] ?? DEFAULT_MODEL;
  const out = outputTokens ?? EST_OUTPUT_TOKENS[feature] ?? 600;
  const est = costFor(model, inputTokens, out);
  const suggested =
    model !== 'claude-haiku-4-5' && (feature === 'job_match_score' || feature === 'salary_insights')
      ? 'claude-haiku-4-5'
      : model;
  const sug = costFor(suggested, inputTokens, out);
  return {
    feature,
    model,
    estimatedCostUsd: est,
    tokenBreakdown: { inputTokens, estimatedOutputTokens: out },
    suggestedModel: suggested,
    suggestedModelCostUsd: sug,
    potentialSavingsUsd: round6(est - sug),
  };
}

/** Atomically reserve an attempt before spending tokens. Database outages block spending. */
export async function enforceRateLimits(userId: string, feature: string): Promise<void> {
  const { error } = await createAdminClient().rpc('reserve_ai_analysis', {
    account_id: userId, feature_name: feature,
  });
  if (error) {
    if (error.message?.startsWith('Usage limit:')) throw new RateLimitError(error.message);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1 + 5. Log a completed call and emit alerts. Returns cost info for the response.
// ─────────────────────────────────────────────────────────────────────────────
export async function logUsage(
  feature: string,
  userId: string,
  message: Anthropic.Message,
): Promise<CostInfo> {
  const u = message.usage;
  const inp = u?.input_tokens ?? 0;
  const out = u?.output_tokens ?? 0;
  const cw = u?.cache_creation_input_tokens ?? 0;
  const cr = u?.cache_read_input_tokens ?? 0;
  const model = message.model ?? FEATURE_MODELS[feature] ?? DEFAULT_MODEL;
  const costUsd = costFor(model, inp, out, cw, cr);

  const admin = createAdminClient();
  const { error: insertError } = await admin.from('api_usage').insert({
    user_id: userId, feature, model,
    input_tokens: inp, output_tokens: out,
    cache_write_tokens: cw, cache_read_tokens: cr, cost_usd: costUsd,
  });

  if (insertError) throw insertError;

  const { data: monthRows, error: monthError } = await admin
    .from('api_usage').select('cost_usd').eq('user_id', userId).gte('created_at', monthStart());
  if (monthError) throw monthError;
  const monthSpend = (monthRows ?? []).reduce((s, r) => s + Number(r.cost_usd), 0);

  const { data: dayRows, error: dayError } = await admin
    .from('api_usage').select('cost_usd').gte('created_at', dayStart());
  if (dayError) throw dayError;
  const daySpend = (dayRows ?? []).reduce((s, r) => s + Number(r.cost_usd), 0);

  // Alerts (standard server logging)
  if (costUsd > SINGLE_CALL_WARN_USD)
    console.warn(`[cost] ALERT: single ${feature} call for ${userId} cost $${costUsd.toFixed(4)}`);
  if (daySpend > DAILY_SPEND_ERR_USD)
    console.error(`[cost] ALERT: daily spend $${daySpend.toFixed(2)} exceeds $${DAILY_SPEND_ERR_USD}`);
  const softLimitAlert = monthSpend >= MONTHLY_SOFT_USD;
  if (softLimitAlert)
    console.warn(`[cost] user ${userId} at $${monthSpend.toFixed(2)}/month (soft limit $${MONTHLY_SOFT_USD})`);

  return {
    feature, model, inputTokens: inp, outputTokens: out,
    cacheWriteTokens: cw, cacheReadTokens: cr, costUsd,
    monthSpendUsd: Math.round(monthSpend * 1e4) / 1e4, softLimitAlert,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Monitoring dashboard data (aggregated in JS — fine at this volume).
// ─────────────────────────────────────────────────────────────────────────────
export async function getCostDashboard() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('api_usage')
    .select('feature,user_id,cost_usd,created_at')
    .gte('created_at', yearStart());
  if (error) throw error;
  const rows = data ?? [];

  const now = Date.now();
  const msIso = monthStart();
  const since24h = now - 24 * 3600_000;

  let ytd = 0;
  let mtd = 0;
  const byFeature = new Map<string, { cost_usd: number; calls: number }>();
  const byUser = new Map<string, { cost_usd: number; calls: number }>();
  const hourly = new Map<number, number>();

  for (const r of rows) {
    const cost = Number(r.cost_usd);
    ytd += cost;
    const f = byFeature.get(r.feature) ?? { cost_usd: 0, calls: 0 };
    f.cost_usd += cost; f.calls += 1; byFeature.set(r.feature, f);
    const usr = byUser.get(r.user_id) ?? { cost_usd: 0, calls: 0 };
    usr.cost_usd += cost; usr.calls += 1; byUser.set(r.user_id, usr);
    if (r.created_at >= msIso) mtd += cost;
    const t = new Date(r.created_at).getTime();
    if (t >= since24h) {
      const bucket = Math.floor(t / 3600_000);
      hourly.set(bucket, (hourly.get(bucket) ?? 0) + 1);
    }
  }

  const round4 = (n: number) => Math.round(n * 1e4) / 1e4;
  const hourlyArr = [...hourly.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([bucket, calls]) => ({
      hour_utc: new Date(bucket * 3600_000).toISOString().slice(0, 13) + ':00',
      calls,
    }));
  const counts = hourlyArr.map((h) => h.calls);
  const avg = counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
  const spikeDetected = counts.some((n) => n >= Math.max(5, 3 * avg));

  const daysInMonth = new Date(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 0).getUTCDate();
  const daysElapsed = Math.max((now - new Date(msIso).getTime()) / 86400_000, 1 / 24);
  const projectedMonthly = round4((mtd / daysElapsed) * daysInMonth);

  return {
    total_spend_ytd_usd: round4(ytd),
    spend_month_to_date_usd: round4(mtd),
    projected_monthly_spend_usd: projectedMonthly,
    spend_by_feature: [...byFeature.entries()]
      .map(([feature, v]) => ({ feature, cost_usd: round4(v.cost_usd), calls: v.calls }))
      .sort((a, b) => b.cost_usd - a.cost_usd),
    top_users: [...byUser.entries()]
      .map(([user_id, v]) => ({ user_id, cost_usd: round4(v.cost_usd), calls: v.calls }))
      .sort((a, b) => b.cost_usd - a.cost_usd)
      .slice(0, 10),
    hourly_call_volume_24h: hourlyArr,
    spike_detected: spikeDetected,
  };
}
