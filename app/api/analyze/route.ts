import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { parseAIResponse } from '@/lib/ai';

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { jobDescription, resumeText } = await req.json();

  if (!jobDescription?.trim()) {
    return NextResponse.json({ error: 'Job description is required.' }, { status: 400 });
  }

  const resume = resumeText?.trim() || 'No resume provided — assess the role in general terms.';

  const prompt = `You are a career coach AI. Analyze this job posting against the candidate's background.

JOB POSTING:
${jobDescription}

CANDIDATE BACKGROUND:
${resume}

Return ONLY valid raw JSON (no markdown, no code fences):
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
}`;

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      // Generous limit: the response includes a full cover letter + interview
      // questions; 1024 truncated real job posts mid-JSON.
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    if (message.stop_reason === 'max_tokens') {
      console.error('AI analysis truncated: hit max_tokens.');
      return NextResponse.json({ error: 'The job description is too long to analyze. Try trimming it.' }, { status: 422 });
    }

    const raw = message.content[0]?.type === 'text' ? message.content[0].text : '';
    return NextResponse.json(parseAIResponse(raw));
  } catch (err) {
    console.error('AI analysis error:', err);
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 });
  }
}
