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
  org: process.env.OPENCODE_GO_ORG_ID,
  session: process.env.OPENCODE_GO_SESSION,
};

beforeEach(() => {
  process.env.OPENCODE_GO_API_KEY = 'test-key';
  process.env.OPENCODE_GO_BASE_URL = 'https://example.test/v1';
  process.env.OPENCODE_GO_MODEL = 'test-model';
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

  it('stays best-effort when the provider request fails', async () => {
    jest.spyOn(global, 'fetch' as never).mockRejectedValue(new Error('network down') as never);

    const { generateOutlookProse } = await import('../opencodeGo');
    await expect(generateOutlookProse(OUTLOOK)).resolves.toBeNull();
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
