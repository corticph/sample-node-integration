/**
 * Integration tests. Boots the real Express app against an in-process stub
 * that impersonates the Corti desktop app's /callMethod RPC, so the full
 * request flow runs without the real desktop app. Run: npm run test:integration
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

let stub, stubCalls, server, baseUrl, stubUrl;
// Overridable so a test can simulate a malformed/empty desktop-app response.
let activeSessionsResult = { activeSessions: [] };

function startServer(handler) {
  return new Promise((resolve) => {
    const s = http.createServer(handler);
    s.listen(0, '127.0.0.1', () => resolve(s));
  });
}

function readBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => {
      try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); }
    });
  });
}

async function waitFor(fn, timeout = 2000, interval = 25) {
  const start = Date.now();
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() - start >= timeout) return v;
    await new Promise((r) => setTimeout(r, interval));
  }
}

function callsSince(index, method) {
  return stubCalls.find((c, i) => i >= index && c.method === method);
}

test.before(async () => {
  stubCalls = [];

  // Stub desktop app: answers the callMethod RPCs this integration makes.
  stub = await startServer(async (req, res) => {
    const body = await readBody(req);
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'POST' && req.url === '/callMethod') {
      const { method, params } = body;
      stubCalls.push({ method, params });
      let result = {};
      switch (method) {
        case '/app/getApiHost':
          result = { apiHost: stubUrl };
          break;
        case '/app/getCurrentUser':
          result = { id: 'user-1', name: 'Test', organizationID: 'org-1' };
          break;
        case '/realtime/activeSessions':
          result = activeSessionsResult;
          break;
        case '/realtime/startSession':
          result = { session: { id: 'new-session-1', externalID: params?.externalID } };
          break;
        default:
          result = {};
      }
      res.end(JSON.stringify({ result }));
      return;
    }
    res.statusCode = 404;
    res.end('{}');
  });
  stubUrl = `http://127.0.0.1:${stub.address().port}`;

  // Point the integration at the stub BEFORE requiring it (clientHost is read at import).
  process.env.CLIENTHOST = stubUrl;
  const { createApp } = require('../dist/app.js');
  const app = createApp();
  server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (server) await new Promise((r) => server.close(r));
  if (stub) await new Promise((r) => stub.close(r));
});

test('GET /health returns ok', async () => {
  const r = await fetch(`${baseUrl}/health`);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { status: 'ok' });
});

test('POST /openCortiSession with no externalId returns 400', async () => {
  const r = await fetch(`${baseUrl}/openCortiSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: {} }),
  });
  assert.equal(r.status, 400);
});

test('POST /openCortiSession starts a session and forwards facts as { sessionID, facts }', async () => {
  const before = stubCalls.length;
  const r = await fetch(`${baseUrl}/openCortiSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: {
        externalId: 'EXT-INT-1',
        facts: { factValues: [{ id: 'patient.age', value: '62' }] },
      },
    }),
  });
  assert.equal(r.status, 200);
  const json = await r.json();
  assert.equal(json.message, 'Session New');
  assert.equal(json.sessionId, 'new-session-1');

  // enterSessionAndOpenWindow runs fire-and-forget after the response.
  const setCall = await waitFor(() => callsSince(before, '/realtime/session/setFactValues'));
  assert.ok(setCall, 'setFactValues should be called');
  assert.equal(setCall.params.sessionID, 'new-session-1', 'sessionID is included');
  assert.deepEqual(
    setCall.params.facts,
    [{ id: 'patient.age', value: '62' }],
    'factValues are forwarded under the `facts` key'
  );
});

test('POST /openCortiSession survives a malformed activeSessions response (regression)', async () => {
  // Reproduces the crash where the desktop app (e.g. while shutting down)
  // returned no usable activeSessions and `.find` threw, killing the process.
  activeSessionsResult = null;
  try {
    const r = await fetch(`${baseUrl}/openCortiSession`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { externalId: 'EXT-MALFORMED' } }),
    });
    assert.equal(r.status, 200, 'falls back to creating a session instead of crashing');
    const json = await r.json();
    assert.equal(json.message, 'Session New');
  } finally {
    activeSessionsResult = { activeSessions: [] };
  }

  // Prove the server is still alive afterwards.
  const health = await fetch(`${baseUrl}/health`);
  assert.equal(health.status, 200);
});

test('POST /events action-block-triggered patches merged facts via setFactValues', async () => {
  const before = stubCalls.length;
  const r = await fetch(`${baseUrl}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'realtime.session.triage-flow.action-block-triggered',
      data: {
        session: { id: 's-int', externalID: 'EXT-INT-1' },
        blockPrototype: {
          id: 'bp',
          content: '',
          name: 'Chest Pain',
          customProperties: [{ key: 'typecode', value: 'PROTO' }],
        },
        blockInstance: { id: 'bi', customProperties: [{ key: 'typecode', value: 'CHEST_PAIN' }] },
      },
    }),
  });
  assert.equal(r.status, 200);

  const setCall = await waitFor(() => callsSince(before, '/realtime/session/setFactValues'));
  assert.ok(setCall);
  assert.equal(setCall.params.sessionID, 's-int');
  assert.deepEqual(setCall.params.facts, [{ id: 'typecode', value: 'CHEST_PAIN' }]);
});

test('POST /events case-id-changed writes case custom properties', async () => {
  const before = stubCalls.length;
  const r = await fetch(`${baseUrl}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'realtime.session.case-id-changed',
      data: { session: { id: 's', caseID: 'case-1', externalID: 'EXT-INT-1' } },
    }),
  });
  assert.equal(r.status, 200);

  const call = await waitFor(() => callsSince(before, '/backendproxy/cases/ensureCaseCustomProperties'));
  assert.ok(call);
  assert.equal(call.params.caseID, 'case-1');
  assert.equal(typeof call.params.customProperties, 'object');
});

test('POST /events comment-created / grouped-fvc / unknown all return 200', async () => {
  const events = [
    { name: 'realtime.session.comments.comment-created', data: { session: { id: 's', externalID: 'E' }, comment: { text: 'hi', createdBy: { id: 'u' } } } },
    { name: 'realtime.session.triage-flow.grouped-flow-value-collector-blocks-updated', data: { session: { id: 's', externalID: 'E' }, group: [] } },
    { name: 'realtime.session-opened', data: { session: { id: 's', externalID: 'E' } } },
    { name: 'some.unknown.event', data: {} },
  ];
  for (const ev of events) {
    const r = await fetch(`${baseUrl}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ev),
    });
    assert.equal(r.status, 200, `${ev.name} returns 200`);
  }
});

test('POST /leaveCortiSession forwards sessionID when provided', async () => {
  const before = stubCalls.length;
  const r = await fetch(`${baseUrl}/leaveCortiSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: 'leave-me' }),
  });
  assert.equal(r.status, 200);
  const leaveCall = await waitFor(() => callsSince(before, '/realtime/leaveSession'));
  assert.ok(leaveCall);
  assert.deepEqual(leaveCall.params, { sessionID: 'leave-me' });
});

test('POST /leaveCortiSession with empty body still leaves (no params)', async () => {
  const before = stubCalls.length;
  const r = await fetch(`${baseUrl}/leaveCortiSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(r.status, 200);
  const leaveCall = await waitFor(() => callsSince(before, '/realtime/leaveSession'));
  assert.ok(leaveCall);
  assert.equal(leaveCall.params, undefined);
});
