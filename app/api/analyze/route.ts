import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { parseAIResponse } from '@/lib/ai';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimits, logUsage, RateLimitError, type CostInfo } from '@/lib/costTracker';

const client = new Anthropic();

const FEATURE = 'ai_analysis';

// Claude reads the posting itself via the web_fetch server tool. The
// `_20260209` variant (dynamic filtering — it filters the fetched page before
// it reaches the context window) requires Sonnet 4.6 / Opus-tier models.
const MODEL = 'claude-sonnet-4-6';

export async function POST(req: NextRequest) {
  const { jobUrl, jobDescription, resumeText } = await req.json();

  if (!jobUrl?.trim()) {
    return NextResponse.json({ error: 'A job posting URL is required.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  // Enforce per-user / per-feature limits before spending tokens. Fail open on
  // infra errors (e.g. the api_usage table isn't migrated yet) so analysis works.
  try {
    await enforceRateLimits(user.id, FEATURE);
  } catch (e) {
    if (e instanceof RateLimitError) return NextResponse.json({ error: e.message }, { status: 429 });
    console.warn('[cost] rate-limit check skipped:', e);
  }

  let url: URL;
  try {
    url = new URL(jobUrl.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('protocol');
  } catch {
    return NextResponse.json({ error: 'Please enter a valid http(s) job posting URL.' }, { status: 400 });
  }

  const resume = resumeText?.trim() || 'No resume provided — assess the role in general terms.';
  const pasted = jobDescription?.trim();

  const prompt = `You are a career coach AI. Use the web_fetch tool to open the job posting at the URL below and read its full contents, then analyze it against the candidate's background.

JOB POSTING URL: ${url.toString()}
${pasted ? `\nThe candidate also pasted this excerpt from the posting — use it to supplement what you fetch:\n${pasted}\n` : ''}
CANDIDATE BACKGROUND:
${resume}

After reading the posting, return ONLY valid raw JSON (no markdown, no code fences):
{
  "matchScore": 85,
  "role": "Job Title from posting",
  "company": "Company Name from posting",
  "matchedKeywords": ["skill1", "skill2", "skill3", "skill4", "skill5"],
  "missingKeywords": ["gap1", "gap2", "gap3"],
  "aiSuggestion": "One specific, actionable tip to improve this application",
  "coverLetter": "Dear Hiring Manager,\\n\\nParagraph 1 (2-3 sentences).\\n\\nParagraph 2 (2-3 sentences).\\n\\nParagraph 3 (closing, 1-2 sentences).\\n\\nSincerely,\\n[Your Name]",
  "interviewQuestions": [
    {"q": "Question 1?", "hint": "Hint for answering"},
    {"q": "Question 2?", "hint": "Hint for answering"},
    {"q": "Question 3?", "hint": "Hint for answering"}
  ],
  "salaryRange": "$X,000 - $Y,000 / year",
  "industry": "Industry name",
  "seniority": "Senior / Mid / Junior",
  "culture": ["tag1", "tag2", "tag3", "tag4"]
}

If the page can't be fetched or has no usable job description, still return the JSON using whatever information is available${pasted ? ' (including the pasted excerpt above)' : ''}, inferring "company" and "role" from the URL as best you can.`;

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }];

  try {
    let message = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      tools: [{ type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 5 }],
      messages,
    });

    // Server-tool loops can pause (pause_turn) when they hit the internal
    // iteration cap — re-send to let Claude resume. Bounded to avoid runaways.
    let continuations = 0;
    while (message.stop_reason === 'pause_turn' && continuations < 3) {
      messages.push({ role: 'assistant', content: message.content });
      message = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        tools: [{ type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 5 }],
        messages,
      });
      continuations++;
    }

    // Record cost for every completed call (even truncated ones consumed tokens).
    let cost: CostInfo | undefined;
    try {
      cost = await logUsage(FEATURE, user.id, message);
    } catch (e) {
      console.warn('[cost] usage log skipped:', e);
    }

    if (message.stop_reason === 'max_tokens') {
      console.error('AI analysis truncated: hit max_tokens.');
      return NextResponse.json({ error: 'The job posting was too long to analyze. Try a more specific URL or paste a shorter excerpt.' }, { status: 422 });
    }

    const raw = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    if (!raw) {
      return NextResponse.json({ error: 'Could not read the job posting from that URL. Try pasting the description instead.' }, { status: 422 });
    }

    return NextResponse.json({ ...parseAIResponse(raw), cost });
  } catch (err) {
    console.error('AI analysis error:', err);
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 });
  }
}
