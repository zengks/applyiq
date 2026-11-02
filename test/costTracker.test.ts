import { beforeEach, describe, expect, it, vi } from 'vitest';

// A chainable, thenable Supabase stub. Each `await admin.from(...)...` pops the
// next queued result, in the order the code awaits them.
const state = vi.hoisted(() => ({ queue: [] as unknown[] }));
vi.mock('@/lib/supabase/server', () => {
  function makeAdmin(queue: unknown[]) {
    let i = 0;
    const chain: unknown = new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === 'then') {
          const r = queue[i++] ?? {};
          return (resolve: (v: unknown) => void) => resolve(r);
        }
        return () => chain;
      },
      apply: () => chain,
    });
    return { from: () => chain, rpc: () => chain };
  }
  return { createAdminClient: () => makeAdmin(state.queue) };
});

import {
  costEstimate, enforceRateLimits, logUsage, getCostDashboard, RateLimitError,
} from '@/lib/costTracker';

beforeEach(() => { state.queue = []; });

// ── 1. costEstimate — billing math + model routing ──────────────────────────
describe('costEstimate', () => {
  it('prices ai_analysis on Sonnet 4.6 with the default output size', () => {
    const e = costEstimate('ai_analysis', 10_000);
    // (10000*$3 + 1200*$15) / 1e6 = 0.048
    expect(e.model).toBe('claude-sonnet-4-6');
    expect(e.estimatedCostUsd).toBeCloseTo(0.048, 6);
    expect(e.tokenBreakdown).toEqual({ inputTokens: 10_000, estimatedOutputTokens: 1200 });
  });

  it('honors an explicit output-token override', () => {
    const e = costEstimate('job_match_score', 1000, 200);
    // haiku: (1000*$1 + 200*$5) / 1e6 = 0.002
    expect(e.model).toBe('claude-haiku-4-5');
    expect(e.estimatedCostUsd).toBeCloseTo(0.002, 6);
  });

  it('suggests Haiku (with savings) for lightweight Sonnet features', () => {
    const e = costEstimate('salary_insights', 5000);
    expect(e.model).toBe('claude-sonnet-4-6');
    expect(e.suggestedModel).toBe('claude-haiku-4-5');
    expect(e.suggestedModelCostUsd).toBeLessThan(e.estimatedCostUsd);
    expect(e.potentialSavingsUsd).toBeCloseTo(e.estimatedCostUsd - e.suggestedModelCostUsd, 6);
  });

  it('does not suggest a different model for heavy features', () => {
    const e = costEstimate('resume_tailor', 2000);
    expect(e.suggestedModel).toBe(e.model);
    expect(e.potentialSavingsUsd).toBe(0);
  });
});

// ── 2. enforceRateLimits — 429 decision logic ───────────────────────────────
describe('enforceRateLimits', () => {
  it('passes when under the hourly and monthly limits', async () => {
    state.queue = [{ data: 'reservation', error: null }];
    await expect(enforceRateLimits('u1', 'ai_analysis')).resolves.toBeUndefined();
  });

  it('throws RateLimitError at the hourly call cap', async () => {
    // hourly count (5) → over cap; then registerHit inserts + counts.
    state.queue = [{ error: { message: 'Usage limit: Too many analyses this hour.' } }];
    await expect(enforceRateLimits('u1', 'ai_analysis')).rejects.toBeInstanceOf(RateLimitError);
  });

  it('throws RateLimitError when the monthly spend cap is reached', async () => {
    state.queue = [{ error: { message: 'Usage limit: Your monthly AI fair-use budget has been reached.' } }];
    await expect(enforceRateLimits('u1', 'ai_analysis')).rejects.toThrow(/monthly AI fair-use/);
  });

  it('propagates DB errors so the caller blocks spending', async () => {
    state.queue = [{ count: null, error: { message: 'relation does not exist' } }];
    await expect(enforceRateLimits('u1', 'ai_analysis')).rejects.toBeDefined();
  });
});

// ── 3. logUsage — cache-aware cost + returned info ──────────────────────────
describe('logUsage', () => {
  const msg = (usage: Record<string, number>, model = 'claude-sonnet-4-6') =>
    ({ model, usage }) as never;

  it('prices a call from token usage and returns cost info', async () => {
    state.queue = [{} /* insert */, { data: [{ cost_usd: 0.006 }] } /* month */, { data: [{ cost_usd: 0.006 }] } /* day */];
    const info = await logUsage('ai_analysis', 'u1',
      msg({ input_tokens: 1000, output_tokens: 200, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }));
    // (1000*$3 + 200*$15) / 1e6 = 0.006
    expect(info.costUsd).toBeCloseTo(0.006, 6);
    expect(info.model).toBe('claude-sonnet-4-6');
    expect(info.softLimitAlert).toBe(false);
  });

  it('includes cached tokens (read at 0.10×) in the cost', async () => {
    state.queue = [{}, { data: [] }, { data: [] }];
    const info = await logUsage('ai_analysis', 'u1',
      msg({ input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 1_000_000 }));
    // 1e6 read tokens * $3 * 0.10 / 1e6 = 0.30
    expect(info.costUsd).toBeCloseTo(0.3, 6);
  });

  it('flags the monthly soft-limit alert past $45', async () => {
    state.queue = [{}, { data: [{ cost_usd: 46 }] }, { data: [{ cost_usd: 46 }] }];
    const info = await logUsage('ai_analysis', 'u1',
      msg({ input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }));
    expect(info.softLimitAlert).toBe(true);
  });
});

// ── 4. getCostDashboard — aggregation ───────────────────────────────────────
describe('getCostDashboard', () => {
  it('aggregates totals, by feature, and top users', async () => {
    state.queue = [{
      data: [
        { feature: 'ai_analysis', user_id: 'u1', cost_usd: 0.10, created_at: new Date().toISOString() },
        { feature: 'ai_analysis', user_id: 'u2', cost_usd: 0.40, created_at: new Date().toISOString() },
        { feature: 'resume_tailor', user_id: 'u1', cost_usd: 0.05, created_at: new Date().toISOString() },
      ],
    }];
    const d = await getCostDashboard();
    expect(d.total_spend_ytd_usd).toBeCloseTo(0.55, 4);
    expect(d.spend_by_feature[0]).toMatchObject({ feature: 'ai_analysis', cost_usd: 0.5, calls: 2 });
    expect(d.top_users[0]).toMatchObject({ user_id: 'u2', cost_usd: 0.4 });
    expect(d.top_users.length).toBeLessThanOrEqual(10);
  });

  it('handles an empty table', async () => {
    state.queue = [{ data: [] }];
    const d = await getCostDashboard();
    expect(d.total_spend_ytd_usd).toBe(0);
    expect(d.spend_by_feature).toEqual([]);
    expect(d.spike_detected).toBe(false);
  });
});
