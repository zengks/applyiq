import { AIResult } from './types';

/**
 * Extracts the JSON object from a model response. The model is asked for raw
 * JSON but sometimes wraps it in ```json fences or adds prose, so we strip
 * fences first and fall back to the first {...} block.
 */
export function parseAIResponse(raw: string): AIResult {
  const cleaned = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned) as AIResult;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as AIResult;
    throw new Error('Could not parse AI response');
  }
}
