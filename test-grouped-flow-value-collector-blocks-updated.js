/**
 * Tests for grouped-flow-value-collector-blocks-updated and requireExplicitSendToLocalhostApi
 *
 * Event: realtime.session.triage-flow.grouped-flow-value-collector-blocks-updated
 * Attribute: block prototype customProperties: { key: 'requireExplicitSendToLocalhostApi', value: 'true' }
 *
 * Behaviour:
 * - Default (no attribute): localhost API receives one event per value change.
 * - With requireExplicitSendToLocalhostApi: events only when user clicks "Send {FVC name}".
 *
 * Run with API up: npm run test:grouped-fvc
 * Or: node test-grouped-flow-value-collector-blocks-updated.js
 */

const MAIN_APP_PORT = process.env.PORT || 45002;
const BASE_URL = `http://localhost:${MAIN_APP_PORT}`;
const EVENT_NAME = 'realtime.session.triage-flow.grouped-flow-value-collector-blocks-updated';

async function postEvent(eventPayload) {
  const res = await fetch(`${BASE_URL}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(eventPayload),
  });
  return { status: res.status, ok: res.ok };
}

/**
 * Build minimal valid payload for grouped-flow-value-collector-blocks-updated.
 * Matches GroupedFlowValueCollectorBlocksUpdated: { session, group }.
 */
function buildFvcEventPayload(options = {}) {
  const {
    sessionId = 'test-session-' + Date.now(),
    externalId = 'TEST-' + Date.now(),
    fvcName = 'Test Collector',
    blockPrototypeId = 'fvc-prototype-1',
    customProperties = [],
    displayValue = 'value',
  } = options;

  const blockPrototype = {
    id: blockPrototypeId,
    name: fvcName,
    customProperties,
  };

  return {
    name: EVENT_NAME,
    data: {
      session: {
        id: sessionId,
        externalID: externalId,
      },
      group: [
        {
          displayValues: [{ text: displayValue }],
          blockPrototype,
          customValues: [{ value: displayValue }],
          collectedFactValues: [],
          collectedBlockValues: {
            blockPrototypes: [],
            values: [],
          },
        },
      ],
    },
  };
}

async function runTests() {
  const results = { passed: 0, failed: 0, errors: [] };

  function pass(msg) {
    results.passed++;
    console.log('  ✅ ' + msg);
  }

  function fail(msg, detail) {
    results.failed++;
    results.errors.push({ msg, detail });
    console.log('  ❌ ' + msg + (detail ? ' ' + detail : ''));
  }

  console.log('\n' + '='.repeat(60));
  console.log('grouped-flow-value-collector-blocks-updated & requireExplicitSendToLocalhostApi');
  console.log('='.repeat(60));
  console.log('API base URL:', BASE_URL);
  console.log('');

  // ----------------------------------------
  // 1. Default FVC (no attribute): API receives one event per value change
  // ----------------------------------------
  console.log('Test 1: Default FVC – event per value change');
  console.log('-'.repeat(60));
  try {
    const changes = ['A', 'B', 'C'];
    let allOk = true;
    for (let i = 0; i < changes.length; i++) {
      const payload = buildFvcEventPayload({
        displayValue: changes[i],
        customProperties: [], // no requireExplicitSendToLocalhostApi
      });
      const { status, ok } = await postEvent(payload);
      if (!ok || status !== 200) {
        allOk = false;
        fail(`Change ${i + 1} (value "${changes[i]}")`, `status=${status}`);
      }
    }
    if (allOk) pass(`Localhost API received ${changes.length} events (one per change).`);
    else fail('Localhost API did not accept all events for default FVC.');
  } catch (e) {
    fail('Default FVC test threw', e.message);
  }
  console.log('');

  // ----------------------------------------
  // 2. FVC carrying requireExplicitSendToLocalhostApi is still accepted by the integration
  // ----------------------------------------
  console.log('Test 2: FVC with requireExplicitSendToLocalhostApi is accepted by the integration');
  console.log('-'.repeat(60));
  console.log('  Note: auto-emit suppression happens in the desktop app, not here.');
  console.log('  Once an event IS emitted, the integration must process it normally.');
  try {
    const payload = buildFvcEventPayload({
      fvcName: 'ExplicitSendCollector',
      customProperties: [{ key: 'requireExplicitSendToLocalhostApi', value: 'true' }],
      displayValue: 'pending-value',
    });
    const { status, ok } = await postEvent(payload);
    if (ok && status === 200) {
      pass('Integration accepted an FVC event that carries requireExplicitSendToLocalhostApi.');
    } else {
      fail('Integration rejected the requireExplicitSendToLocalhostApi event', `status=${status}`);
    }
  } catch (e) {
    fail('requireExplicitSendToLocalhostApi acceptance test threw', e.message);
  }
  console.log('');

  // ----------------------------------------
  // 3. Explicit send: exactly one event on “Send {FVC name}”
  // ----------------------------------------
  console.log('Test 3: Explicit send – exactly one event on “Send {FVC name}”');
  console.log('-'.repeat(60));
  try {
    const payload = buildFvcEventPayload({
      fvcName: 'ExplicitSendCollector',
      customProperties: [{ key: 'requireExplicitSendToLocalhostApi', value: 'true' }],
      displayValue: 'sent-value',
    });

    const { status, ok } = await postEvent(payload);
    if (!ok || status !== 200) {
      fail('Localhost API did not accept the single “Send” event', `status=${status}`);
    } else {
      pass('Localhost API received exactly one grouped-flow-value-collector-blocks-updated on Send.');
    }

    // Payload shape: session + group with blockPrototype.customProperties containing the attribute
    const hasSession = payload.data && payload.data.session && payload.data.session.id;
    const group = (payload.data && payload.data.group) || [];
    const hasRequireExplicit = group.some(
      (b) =>
        (b.blockPrototype?.customProperties || []).some(
          (p) => p.key === 'requireExplicitSendToLocalhostApi' && p.value === 'true'
        )
    );
    if (hasSession && group.length >= 1 && hasRequireExplicit) {
      pass('Payload has session, group/collectors, and requireExplicitSendToLocalhostApi.');
    } else {
      fail('Payload missing session, group, or requireExplicitSendToLocalhostApi.');
    }
  } catch (e) {
    fail('Explicit send test threw', e.message);
  }
  console.log('');

  // ----------------------------------------
  // 4. Sanity: sending a second “Send” gives another event (API accepts each Send)
  // ----------------------------------------
  console.log('Test 4: Second “Send” also delivers one event');
  console.log('-'.repeat(60));
  try {
    const payload = buildFvcEventPayload({
      fvcName: 'ExplicitSendCollector',
      customProperties: [{ key: 'requireExplicitSendToLocalhostApi', value: 'true' }],
      displayValue: 'second-send',
    });
    const { status, ok } = await postEvent(payload);
    if (ok && status === 200) {
      pass('Localhost API received the second “Send” event.');
    } else {
      fail('Second “Send” was not accepted', `status=${status}`);
    }
  } catch (e) {
    fail('Second Send test threw', e.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Summary:', results.passed, 'passed,', results.failed, 'failed');
  if (results.errors.length) {
    console.log('Errors:');
    results.errors.forEach(({ msg, detail }) => console.log('  -', msg, detail || ''));
  }
  console.log('='.repeat(60) + '\n');
  process.exit(results.failed > 0 ? 1 : 0);
}

// Allow running standalone (node test-grouped-flow-value-collector-blocks-updated.js)
async function main() {
  try {
    const r = await fetch(BASE_URL + '/health').catch(() => null);
    if (!r || r.status !== 200) {
      console.error('Cannot reach API at', BASE_URL, '- ensure the app is running (e.g. npm run dev).');
      process.exit(1);
    }
  } catch (e) {
    console.error('Cannot reach API at', BASE_URL, '- ensure the app is running.');
    process.exit(1);
  }
  await runTests();
}

main();
