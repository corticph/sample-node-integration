/**
 * Unit tests for pure handler/util logic. No network, no desktop app.
 * Run against the compiled output: npm run test:unit
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { getApiKey } = require('../dist/utils/utils.js');
const handleGroupedFvc = require('../dist/eventHandlers/handleGroupedFlowValueCollectorBlocksUpdated.js').default;
const services = require('../dist/services/cortiServices.js');
const handleActionBlock = require('../dist/eventHandlers/handleActionBlockTriggered.js').default;

test('getApiKey returns process.env.API_KEY', () => {
  process.env.API_KEY = 'secret-key';
  assert.equal(getApiKey(), 'secret-key');
});

test('getApiKey returns undefined when API_KEY is unset', () => {
  delete process.env.API_KEY;
  assert.equal(getApiKey(), undefined);
});

test('grouped FVC: dedupes by blockPrototypeId and keeps only blocks with customProperties', async () => {
  const data = {
    session: { id: 's1', externalID: 'EXT-1' },
    group: [
      {
        displayValues: [{ text: '62' }],
        blockPrototype: { id: 'bp-age', name: 'Patient Age', customProperties: [] },
        customValues: [],
        collectedFactValues: [],
        collectedBlockValues: {
          blockPrototypes: [
            { id: 'opt-age', label: '62', customProperties: [{ key: 'fact_mapping', value: 'pt.age' }] },
          ],
          values: [
            { blockPrototypeID: 'opt-age', text: '62' },
            { blockPrototypeID: 'opt-age', text: '62' }, // duplicate → deduped
            { blockPrototypeID: 'missing-prototype', text: 'orphan' }, // no prototype → skipped
          ],
        },
      },
      {
        displayValues: [{ text: 'Male' }],
        blockPrototype: { id: 'bp-sex', name: 'Sex', customProperties: [] },
        customValues: [],
        collectedFactValues: [],
        collectedBlockValues: {
          blockPrototypes: [{ id: 'opt-sex', label: 'Male', customProperties: [] }],
          values: [{ blockPrototypeID: 'opt-sex', text: 'Male' }], // no customProps → filtered out
        },
      },
    ],
  };

  const result = await handleGroupedFvc(data);
  assert.equal(result.length, 1, 'only the block with customProperties survives');
  assert.equal(result[0].blockPrototypeId, 'opt-age');
  assert.deepEqual(result[0].customProperties, [{ key: 'fact_mapping', value: 'pt.age' }]);
});

test('grouped FVC: tolerates a collector with no values', async () => {
  const data = {
    session: { id: 's1', externalID: 'EXT-1' },
    group: [
      {
        displayValues: [],
        blockPrototype: { id: 'bp-empty', name: 'Empty', customProperties: [] },
        customValues: [],
        collectedFactValues: [],
        collectedBlockValues: { blockPrototypes: [], values: [] },
      },
    ],
  };
  const result = await handleGroupedFvc(data);
  assert.deepEqual(result, []);
});

test('action-block: merges prototype + instance customProperties (instance wins) and patches facts', async (t) => {
  const calls = [];
  t.mock.method(services, 'cortiCallMethod', async (method, params) => {
    calls.push({ method, params });
    return {};
  });

  const data = {
    session: { id: 's1', externalID: 'EXT-1' },
    blockPrototype: {
      id: 'bp',
      content: '',
      name: 'Chest Pain',
      customProperties: [
        { key: 'typecode', value: 'PROTO' },
        { key: 'priority', value: 'P2' },
      ],
    },
    blockInstance: { id: 'bi', customProperties: [{ key: 'typecode', value: 'CHEST_PAIN' }] },
  };

  const facts = await handleActionBlock(data);

  assert.equal(facts.find((f) => f.id === 'typecode').value, 'CHEST_PAIN', 'instance value wins');
  assert.equal(facts.find((f) => f.id === 'priority').value, 'P2');

  const setCall = calls.find((c) => c.method === '/realtime/session/setFactValues');
  assert.ok(setCall, 'setFactValues is called');
  assert.equal(setCall.params.sessionID, 's1');
  assert.deepEqual(setCall.params.facts, facts);
});

test('action-block: a block with no custom properties is handled without throwing or patching facts', async (t) => {
  const calls = [];
  t.mock.method(services, 'cortiCallMethod', async (method, params) => {
    calls.push({ method, params });
    return {};
  });

  // blockPrototype.customProperties omitted entirely, no blockInstance —
  // this is the silent/throwing case that produced no console log.
  const data = {
    session: { id: 's1', externalID: 'EXT-1' },
    blockPrototype: { id: 'bp', content: '', name: 'Cardiac Arrest' },
  };

  const facts = await handleActionBlock(data);
  assert.deepEqual(facts, [], 'no facts derived');
  assert.equal(
    calls.find((c) => c.method === '/realtime/session/setFactValues'),
    undefined,
    'setFactValues is not called when there is nothing to write'
  );
});
