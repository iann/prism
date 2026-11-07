/**
 * Tests for the optional OpenCode Go outlook rewrite.
 */

import type { WeatherOutlookDay } from '@/components/widgets/WeatherWidget';

const OUTLOOK: WeatherOutlookDay[] = [
  {
    day: 'Today',
    start: '2026-11-06T17:00:00-05:00',
    short: 'Rain Likely',
    detail: 'Rain likely and patchy fog and a slight chance of thunderstorms.',
    detailedForecast:
      'Rain likely and patchy fog and a slight chance of thunderstorms. Cloudy, with a high near 68. South wind around 6 mph.',
  },
  {
    day: 'Saturday',
    start: '2026-11-07T06:00:00-05:00',
    short: 'Light Rain Likely',
    detail: 'Rain likely and patchy fog.',
    detailedForecast:
      'Rain likely and patchy fog. Mostly cloudy, with a high near 62. Northwest wind around 7 mph.',
  },
  {
    day: 'Sunday',
    start: '2026-11-08T06:00:00-05:00',
    short: 'Chance Light Rain then Mostly Sunny',
    detail: 'A chance of rain and patchy fog before 7am.',
    detailedForecast:
      'A chance of rain and patchy fog before 7am. Mostly sunny, with a high near 59. West wind 8 to 14 mph.',
  },
];

const GOOD_PROSE =
  'Rain likely today with fog and a slight thunderstorm chance, then more rain Saturday. Sunday is mostly sunny after early rain and fog.';

function completion(content: string) {
  return {
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  } as Response;
}

const savedEnv = {
  key: process.env.OPENCODE_GO_API_KEY,
  base: process.env.OPENCODE_GO_BASE_URL,
  model: process.env.OPENCODE_GO_MODEL,
  fallback: process.env.OPENCODE_GO_FALLBACK_MODEL,
  org: process.env.OPENCODE_GO_ORG_ID,
  session: process.env.OPENCODE_GO_SESSION,
};

beforeEach(() => {
  process.env.OPENCODE_GO_API_KEY = 'test-key';
  process.env.OPENCODE_GO_BASE_URL = 'https://example.test/v1';
  process.env.OPENCODE_GO_MODEL = 'test-model';
  process.env.OPENCODE_GO_FALLBACK_MODEL = 'test-fallback-model';
  delete process.env.OPENCODE_GO_ORG_ID;
  delete process.env.OPENCODE_GO_SESSION;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.resetModules();
  for (const [name, value] of [
    ['OPENCODE_GO_API_KEY', savedEnv.key],
    ['OPENCODE_GO_BASE_URL', savedEnv.base],
    ['OPENCODE_GO_MODEL', savedEnv.model],
    ['OPENCODE_GO_FALLBACK_MODEL', savedEnv.fallback],
    ['OPENCODE_GO_ORG_ID', savedEnv.org],
    ['OPENCODE_GO_SESSION', savedEnv.session],
  ] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe('generateOutlookProse', () => {
  it('sends the detailed forecasts to the OpenCode Go chat endpoint', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch' as never)
      .mockResolvedValueOnce(completion(GOOD_PROSE) as never);

    const { generateOutlookProse } = await import('../opencodeGo');
    await expect(generateOutlookProse(OUTLOOK)).resolves.toBe(GOOD_PROSE);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const call = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    const [url, init] = call;
    expect(url).toBe('https://example.test/v1/chat/completions');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-key');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['x-opencode-session']).toBe('prism-weather-outlook');
    expect(headers['User-Agent']).toContain('Prism-Family-Dashboard');

    const body = JSON.parse(String(init.body)) as {
      model: string;
      messages: Array<{ content: string }>;
      temperature: number;
    };
    expect(body.model).toBe('test-model');
    expect(body.temperature).toBe(0.3);
    expect(body.messages[1]?.content).toContain(
      'Rain likely and patchy fog and a slight chance of thunderstorms',
    );
    expect(body.messages[1]?.content).toContain('Mostly sunny.');
    expect(body.messages[1]?.content).not.toContain('high near');
    expect(body.messages[1]?.content).not.toContain('wind');
    expect(body.messages[1]?.content).toContain(
      'Never write a day name followed by a colon',
    );
    expect(body.messages[1]?.content).toContain('This is a hard limit.');
    expect(body.messages[1]?.content).toContain('Every label must appear.');
  });

  it('retries once when the first answer is too long', async () => {
    const tooLong = `${'Rain likely today, with patchy fog and a chance of thunderstorms, then more rain likely Saturday. '.repeat(2)}Sunday turns mostly sunny.`;
    const fetchSpy = jest
      .spyOn(global, 'fetch' as never)
      .mockResolvedValueOnce(completion(tooLong) as never)
      .mockResolvedValueOnce(completion(GOOD_PROSE) as never);

    const { generateOutlookProse } = await import('../opencodeGo');
    await expect(generateOutlookProse(OUTLOOK)).resolves.toBe(GOOD_PROSE);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    const retry = fetchSpy.mock.calls[1] as unknown as [string, RequestInit];
    const body = JSON.parse(String(retry[1].body)) as {
      messages: Array<{ content: string }>;
    };
    expect(body.messages[1]?.content).toContain('Your previous answer was');
    expect(body.messages[1]?.content).toContain('It was rejected.');
  });

  it('escalates length guidance across two attempts per model', async () => {
    const tooLong = `${'Rain likely today, with patchy fog and a chance of thunderstorms, then more rain likely Saturday. '.repeat(2)}Sunday turns mostly sunny.`;
    const fetchSpy = jest
      .spyOn(global, 'fetch' as never)
      .mockResolvedValue(completion(tooLong) as never);

    const { generateOutlookProse } = await import('../opencodeGo');
    await expect(generateOutlookProse(OUTLOOK)).resolves.toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(4);

    const bodies = fetchSpy.mock.calls.map((call) => {
      const init = call[1] as RequestInit;
      return JSON.parse(String(init.body)) as {
        model: string;
        messages: Array<{ content: string }>;
      };
    });
    expect(bodies.map((body) => body.model)).toEqual([
      'test-model',
      'test-model',
      'test-fallback-model',
      'test-fallback-model',
    ]);
    expect(bodies[0]?.messages[1]?.content).not.toContain('previous answer');
    expect(bodies[1]?.messages[1]?.content).toContain('Your previous answer was');
    expect(bodies[2]?.messages[1]?.content).toContain(
      'aim for 145 characters or fewer',
    );
    expect(bodies[3]?.messages[1]?.content).toContain('final attempt');
    expect(bodies[3]?.messages[1]?.content).toContain('at most 130 characters');
  });

  it('returns null when the model invents a number', async () => {
    const invented = 'Rain likely today with a high near 75, then more rain Saturday. Sunday is mostly sunny.';
    const fetchSpy = jest
      .spyOn(global, 'fetch' as never)
      .mockResolvedValue(completion(invented) as never);

    const { generateOutlookProse } = await import('../opencodeGo');
    await expect(generateOutlookProse(OUTLOOK)).resolves.toBeNull();
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('returns null without an API key and makes no request', async () => {
    delete process.env.OPENCODE_GO_API_KEY;
    const fetchSpy = jest.spyOn(global, 'fetch' as never);

    const { generateOutlookProse, isOutlookLlmConfigured } = await import('../opencodeGo');
    expect(isOutlookLlmConfigured()).toBe(false);
    await expect(generateOutlookProse(OUTLOOK)).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('falls back to the configured fallback model', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch' as never)
      .mockRejectedValueOnce(new Error('primary down') as never)
      .mockResolvedValueOnce(completion(GOOD_PROSE) as never);

    const { generateOutlookProse } = await import('../opencodeGo');
    await expect(generateOutlookProse(OUTLOOK)).resolves.toBe(GOOD_PROSE);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    const second = fetchSpy.mock.calls[1] as unknown as [string, RequestInit];
    const body = JSON.parse(String(second[1].body)) as { model: string };
    expect(body.model).toBe('test-fallback-model');
  });

  it('uses the Responses API for the gpt-6-luna fallback', async () => {
    process.env.OPENCODE_GO_FALLBACK_MODEL = 'gpt-6-luna';
    const fetchSpy = jest
      .spyOn(global, 'fetch' as never)
      .mockRejectedValueOnce(new Error('primary down') as never)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: [
            { type: 'reasoning' },
            {
              type: 'message',
              content: [{ type: 'output_text', text: GOOD_PROSE }],
            },
          ],
        }),
      } as never);

    const { generateOutlookProse } = await import('../opencodeGo');
    await expect(generateOutlookProse(OUTLOOK)).resolves.toBe(GOOD_PROSE);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    const second = fetchSpy.mock.calls[1] as unknown as [string, RequestInit];
    expect(String(second[0])).toBe('https://example.test/v1/responses');
    const body = JSON.parse(String(second[1].body)) as {
      model: string;
      input: string;
      messages?: unknown;
    };
    expect(body.model).toBe('gpt-6-luna');
    expect(body.input).toContain('Mostly sunny.');
    expect(body.messages).toBeUndefined();
  });

  it('rejects day-label prefixes instead of rewriting them', async () => {
    const labelled =
      'Tonight: Rain likely and patchy fog, mostly cloudy. Then Saturday: a chance of rain and patchy fog before 7am, mostly sunny, followed by Sunday: mostly sunny.';
    const fetchSpy = jest
      .spyOn(global, 'fetch' as never)
      .mockResolvedValue(completion(labelled) as never);

    const { generateOutlookProse } = await import('../opencodeGo');
    await expect(generateOutlookProse(OUTLOOK)).resolves.toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  it('stays best-effort when both provider requests fail', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch' as never)
      .mockRejectedValue(new Error('network down') as never);

    const { generateOutlookProse } = await import('../opencodeGo');
    await expect(generateOutlookProse(OUTLOOK)).resolves.toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe('outlookProseCacheKey', () => {
  it('is stable for the same forecast and changes when the text changes', async () => {
    const { outlookProseCacheKey } = await import('../opencodeGo');
    expect(outlookProseCacheKey(OUTLOOK)).toBe(outlookProseCacheKey(OUTLOOK));

    const changed = [{ ...OUTLOOK[0]!, detailedForecast: 'Different rain.' }];
    expect(outlookProseCacheKey(changed)).not.toBe(outlookProseCacheKey(OUTLOOK));
  });
});
