import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assistantInput,
  askAssistant,
  plotContext,
  AssistantUnavailable,
} from '../services/assistant.js';
import { newRun, synthetic } from '../simulation/engine.js';
import type { Farm, Plot } from '@agritwin/shared';

const plot: Plot = {
  id: 'plot',
  name: 'Private plot name',
  crop: 'Tomato',
  soil: 'Loam',
  method: 'Drip',
  area: 100,
  plantingDate: '2026-01-01',
};
function fixture(): Farm {
  return {
    id: 'farm',
    ownerId: 'private-owner',
    name: 'Private farm name',
    location: 'Private address',
    latitude: 18,
    longitude: 73,
    area: 100,
    unit: 'm²',
    plots: [plot],
    run: newRun([plot], plot.plantingDate),
    archives: [],
    scenarios: [],
    createdAt: '2026-01-01',
  };
}
const question = (farm: Farm) =>
  assistantInput.parse({
    plotId: plot.id,
    snapshotId: farm.run.history[0].id,
    message: 'Does my crop need water?',
  });
const message = (text: string) => ({
  status: 'completed',
  output: [{ type: 'message', content: [{ type: 'output_text', text }] }],
});
test('no-key guide uses saved facts and never contacts an AI provider', async () => {
  const farm = fixture();
  for (const language of ['en', 'hi', 'mr'] as const) {
    const result = await askAssistant(
      farm,
      { ...question(farm), language },
      {
        key: '',
        fetcher: async () => {
          throw new Error('Network must not run');
        },
      },
    );
    assert.equal(result.mode, 'guide');
    assert.equal(result.evidence.date, '2026-01-01');
    assert.ok(result.answer.length > 50);
  }
});
test('assistant validates scope and bounds; context omits account identifiers and addresses', () => {
  const farm = fixture();
  assert.throws(() => plotContext(farm, { ...question(farm), plotId: 'someone-else' }));
  assert.throws(() => plotContext(farm, { ...question(farm), snapshotId: 'missing' }));
  assert.equal(
    assistantInput.safeParse({ ...question(farm), message: 'x'.repeat(1201) }).success,
    false,
  );
  const facts = JSON.stringify(plotContext(farm, question(farm)).facts);
  for (const privateValue of [
    'Private address',
    'private-owner',
    'Private farm name',
    'Private plot name',
    'plotId',
  ])
    assert.ok(!facts.includes(privateValue));
});
test('connected responses use server auth, bounded output, no stored response and selected evidence', async () => {
  const farm = fixture();
  let sent: any;
  const result = await askAssistant(farm, question(farm), {
    key: 'test-only-key',
    fetcher: async (url, init) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer test-only-key');
      sent = JSON.parse(String(init?.body));
      return Response.json(message('The model estimates sufficient water.'));
    },
  });
  assert.equal(sent.store, false);
  assert.equal(sent.max_output_tokens, 900);
  assert.equal(result.mode, 'ai');
  assert.ok(sent.instructions.includes('FACTS_JSON'));
  assert.ok(!JSON.stringify(result).includes('test-only-key'));
});
test('tool preview computes both branches without changing saved farm and returns provenance', async () => {
  const farm = fixture(),
    before = JSON.stringify(farm);
  let calls = 0;
  const config = {
    name: 'Less water',
    days: 2,
    rainMultiplier: 1,
    temperatureDelta: 0,
    irrigationMultiplier: 0.75,
    interval: 1,
    amount: 15,
  };
  const result = await askAssistant(farm, question(farm), {
    key: 'test',
    weather: async () =>
      [synthetic('2026-01-02'), synthetic('2026-01-03')].map((w) => ({
        ...w,
        source: 'historical' as const,
      })),
    fetcher: async (_url, init) => {
      calls++;
      if (calls === 1)
        return Response.json({
          status: 'completed',
          output: [
            {
              type: 'function_call',
              name: 'preview_scenario',
              call_id: 'call-1',
              arguments: JSON.stringify(config),
            },
          ],
        });
      const body = JSON.parse(String(init?.body));
      assert.deepEqual(body.tools, []);
      const tool = body.input.at(-1);
      assert.equal(tool.type, 'function_call_output');
      assert.ok(
        JSON.parse(tool.output).experiment.additionalWaterLitres <
          JSON.parse(tool.output).baseline.additionalWaterLitres,
      );
      return Response.json(message('The experiment uses less water; these are estimates.'));
    },
  });
  assert.equal(calls, 2);
  assert.ok('comparison' in result);
  assert.equal(JSON.stringify(farm), before);
});
test('invalid tool parameters do not execute weather or invent comparison results', async () => {
  const farm = fixture();
  let calls = 0;
  const result = await askAssistant(farm, question(farm), {
    key: 'test',
    weather: async () => {
      throw new Error('Must not run');
    },
    fetcher: async (_url, init) => {
      if (++calls === 1)
        return Response.json({
          output: [
            {
              type: 'function_call',
              name: 'preview_scenario',
              call_id: 'c',
              arguments: '{"days":99999}',
            },
          ],
        });
      assert.ok(JSON.parse(JSON.parse(String(init?.body)).input.at(-1).output).error);
      return Response.json(message('The experiment could not run.'));
    },
  });
  assert.ok(!('comparison' in result));
});
test('provider failures and empty or incomplete replies return a safe error', async () => {
  for (const body of [
    Response.json({ error: 'secret provider error' }, { status: 401 }),
    Response.json({ output: [] }),
    Response.json({ status: 'incomplete', output: [] }),
  ]) {
    const farm = fixture();
    await assert.rejects(
      askAssistant(farm, question(farm), { key: 'test', fetcher: async () => body }),
      AssistantUnavailable,
    );
  }
});
