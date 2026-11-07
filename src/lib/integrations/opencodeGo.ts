/**
 * Optional OpenCode Go rewrite of the weather outlook.
 *
 * OpenCode Go exposes OpenAI-compatible Chat Completions and Responses
 * endpoints, so the dashboard can ask a model to turn the NWS detailed
 * forecasts into two short, natural sentences. The generated text is cached by
 * the caller and is always optional: if the key is missing, the request fails,
 * or the output violates the length/fact rules, the widget keeps its
 * deterministic outlook.
 *
 * Configuration:
 *   OPENCODE_GO_API_KEY          required to enable the rewrite (oc_sk_...)
 *   OPENCODE_GO_MODEL            default glm-5.3-flash (Chat Completions)
 *   OPENCODE_GO_FALLBACK_MODEL   default gpt-6-luna (Responses API)
 *   OPENCODE_GO_BASE_URL         default https://opencode.ai/inference/go/openai/v1
 *   OPENCODE_GO_ORG_ID           optional x-opencode-org-id header
 */

import { createHash } from 'node:crypto';
import type { WeatherOutlookDay } from '@/components/widgets/WeatherWidget';
import { logError } from '@/lib/utils/logError';

const DEFAULT_BASE_URL = 'https://opencode.ai/inference/go/openai/v1';
const DEFAULT_MODEL = 'glm-5.3-flash';
const DEFAULT_FALLBACK_MODEL = 'gpt-6-luna';
const TARGET_CHARS = 155;
const MAX_CHARS = 170;

/**
 * Bump when the prompt or validation rules change, so cached prose and cached
 * failures written under the old prompt are not reused.
 */
export const OUTLOOK_PROSE_PROMPT_VERSION = 'v2';
const REQUEST_TIMEOUT_MS = 12_000;
// Reasoning models count their thinking tokens against the output budget.
// 600 leaves enough room for a short answer plus the model's reasoning.
const MAX_COMPLETION_TOKENS = 600;

const SYSTEM_PROMPT =
  'You rewrite weather forecasts for a wall dashboard. Follow the length and format constraints exactly.';

const RESPONSES_MODELS = new Set([
  'gpt-6-luna',
  'gpt-5.6-luna',
  'grok-4.7',
  'muse-spark-1.3-contributor',
  'muse-spark-1.2-contributor',
  'crouton-alpha-free',
]);

type GenerateApi = 'chat' | 'responses';

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

type ResponsesResponse = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

function apiForModel(model: string): GenerateApi {
  return RESPONSES_MODELS.has(model) ? 'responses' : 'chat';
}

export function isOutlookLlmConfigured(): boolean {
  return Boolean(process.env.OPENCODE_GO_API_KEY?.trim());
}

/** Cache key for a given three-day outlook, independent of its labels. */
export function outlookProseCacheKey(outlook: WeatherOutlookDay[]): string {
  const material = outlook
    .slice(0, 3)
    .map((day) => `${day.day}:${day.detailedForecast || day.detail || day.short}`)
    .join('|');
  return createHash('sha1').update(material).digest('hex');
}

function dayLabels(outlook: WeatherOutlookDay[]): string[] {
  return outlook.slice(0, 3).map((day, index) => {
    if (index !== 0) return day.day;
    return /^(today|this (morning|afternoon|evening))$/i.test(day.day) ? 'Today' : day.day;
  });
}

/**
 * Keep the human-written conditions and drop the numbers the widget already
 * shows elsewhere: temperatures, wind speeds, precipitation percentages, and
 * rainfall amounts. This keeps the prompt short and makes the 155-character
 * target much easier for the model to hit.
 */
function conditionSummary(day: WeatherOutlookDay): string {
  const source = day.detailedForecast || day.detail || day.short;
  const summary = source
    .split(/(?<=[.!?])\s+/)
    .map((sentence) =>
      sentence
        .replace(/,\s*with a (?:high near|low around) \d+\.?/gi, '.')
        .replace(/\b(?:north|south|east|west|northwest|northeast|southwest|southeast)?\s*wind\b[^.]*\.?/gi, '')
        .replace(/chance of precipitation is \d+%\.?/gi, '')
        .replace(/new rainfall amounts[^.]*\.?/gi, '')
        .trim(),
    )
    .filter((sentence) => sentence.length > 0)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return summary || day.detail || day.short;
}

function buildPrompt(outlook: WeatherOutlookDay[], previous?: string): string {
  const labels = dayLabels(outlook);
  const input = outlook
    .slice(0, 3)
    .map((day, index) => `${labels[index]}: ${conditionSummary(day)}`)
    .join('\n');

  const retry = previous
    ? `\nYour previous answer was:\n${previous}\nIt was too long or did not follow the rules. Rewrite it using only the facts in the Input below.\n`
    : '';

  return `Rewrite the 3-day weather outlook below for a wall dashboard.${retry}
Rules:
- Exactly two natural sentences.
- The TOTAL must be ${TARGET_CHARS} characters or fewer. This is a hard limit.
- Use only the facts in the input. Do not add temperatures or invent numbers.
- Use these day labels: ${labels.join(', ')}. Every label must appear.
- Be terse. Drop secondary details before dropping a day.
- Prefer natural connectives such as "then", "followed by", or "after that".
- Focus on conditions.

Output format:
- Plain prose only. No bullets, labels, or line breaks.
- Never write a day name followed by a colon, such as "Tonight:" or "Saturday:".
- Use day names only as ordinary words inside the sentence.
- Return only the final two sentences.

Example shape:
Rain and fog tonight, then rain likely Saturday. Sunday turns mostly sunny after morning fog.

Input:
${input}

Return only the two sentences.`;
}

function cleanProse(value: string): string {
  return value
    .replace(/```[a-z]*\s*/gi, '')
    .replace(/```/g, '')
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function digitTokens(value: string): string[] {
  return value.match(/\d+/g) ?? [];
}

/**
 * Validate the rewrite. The length cap is deliberately the only place that
 * can reject a good sentence; facts are checked so the model cannot invent a
 * temperature or a number that was not in the source.
 */
function isValidProse(prose: string, outlook: WeatherOutlookDay[]): boolean {
  if (prose.length === 0 || prose.length > MAX_CHARS) return false;
  if (/^[-*•]\s/m.test(prose)) return false;
  // The model is told to write plain prose. A day label followed by a colon is
  // a format failure; reject it and let the retry/fallback handle it rather
  // than silently rewriting the model's sentence.
  if (/\b(?:Today|Tonight|Overnight|Tomorrow|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s*:/i.test(prose)) {
    return false;
  }

  const source = outlook
    .slice(0, 3)
    .map((day) => `${day.day} ${conditionSummary(day)}`)
    .join(' ');
  const allowedDigits = new Set(digitTokens(source));
  if (digitTokens(prose).some((token) => !allowedDigits.has(token))) return false;

  const lower = prose.toLowerCase();
  const labels = dayLabels(outlook).map((label) => label.toLowerCase());
  if (labels.filter((label) => lower.includes(label)).length < 2) return false;

  return true;
}

async function requestProse(
  model: string,
  api: GenerateApi,
  outlook: WeatherOutlookDay[],
  previous?: string,
): Promise<string | null> {
  const apiKey = process.env.OPENCODE_GO_API_KEY?.trim();
  if (!apiKey) return null;

  const baseUrl = (process.env.OPENCODE_GO_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const orgId = process.env.OPENCODE_GO_ORG_ID?.trim();
  // OpenCode Go asks clients to identify themselves and send a stable session
  // so it can route and reuse prompt caches. This is one logical weather
  // conversation, not a coding session.
  const sessionId = process.env.OPENCODE_GO_SESSION?.trim() || 'prism-weather-outlook';
  const userAgent = 'Prism-Family-Dashboard/1.0 (+https://github.com/sandydargoport/prism)';
  const prompt = buildPrompt(outlook, previous);
  const endpoint = api === 'responses' ? `${baseUrl}/responses` : `${baseUrl}/chat/completions`;
  const body =
    api === 'responses'
      ? {
          model,
          instructions: SYSTEM_PROMPT,
          input: prompt,
          max_output_tokens: MAX_COMPLETION_TOKENS,
        }
      : {
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: MAX_COMPLETION_TOKENS,
        };

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': userAgent,
        'x-opencode-session': sessionId,
        ...(orgId ? { 'x-opencode-org-id': orgId } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: 'no-store',
    });
  } catch (error) {
    logError('OpenCode Go outlook request failed:', error);
    return null;
  }

  if (!response.ok) {
    logError('OpenCode Go outlook request failed:', new Error(`HTTP ${response.status}`));
    return null;
  }

  let content: string | undefined;
  try {
    if (api === 'responses') {
      const data = (await response.json()) as ResponsesResponse;
      const output = data.output ?? [];
      const textParts = output
        .filter((item) => item.type === 'message')
        .flatMap((item) => item.content ?? [])
        .filter((part) => part.type === 'output_text' && typeof part.text === 'string')
        .map((part) => part.text!.trim())
        .filter(Boolean);
      content = textParts.join(' ') || data.output_text;
    } else {
      const data = (await response.json()) as ChatCompletionResponse;
      content = data.choices?.[0]?.message?.content;
    }
  } catch (error) {
    logError('OpenCode Go outlook response was not JSON:', error);
    return null;
  }

  if (typeof content !== 'string') return null;

  return cleanProse(content).replace(/[.!?]?$/, (match) => match || '.');
}

/**
 * Ask OpenCode Go for a two-sentence outlook. Returns null when the feature is
 * not configured, the provider fails, or the output cannot be validated.
 */
export async function generateOutlookProse(
  outlook: WeatherOutlookDay[],
): Promise<string | null> {
  if (outlook.length === 0 || !isOutlookLlmConfigured()) return null;

  const primary = process.env.OPENCODE_GO_MODEL?.trim() || DEFAULT_MODEL;
  const fallback = process.env.OPENCODE_GO_FALLBACK_MODEL?.trim() || DEFAULT_FALLBACK_MODEL;
  const models = [...new Set([primary, fallback].filter(Boolean))].map((model) => ({
    model,
    api: apiForModel(model),
  }));

  for (const { model, api } of models) {
    const first = await requestProse(model, api, outlook);
    if (first && isValidProse(first, outlook)) return first;

    // A non-null answer that failed validation is usually a length miss;
    // retry that model once with the previous text in the prompt. If the call
    // itself failed, move straight to the next model.
    if (first) {
      const retry = await requestProse(model, api, outlook, first);
      if (retry && isValidProse(retry, outlook)) return retry;
    }
  }

  return null;
}
