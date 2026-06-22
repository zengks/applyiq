import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

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
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) result = JSON.parse(match[0]);
      else throw new Error('Could not parse AI response');
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('AI analysis error:', err);
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 });
  }
}
