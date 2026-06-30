/**
 * Manual verification test script.
 * Calls the integration endpoints the way a CAD/dispatch system would.
 * Run alongside the integration: node dist/index.js
 */

const BASE_URL = 'http://localhost:45002';
const EXTERNAL_ID = `TEST-MANUAL-${Date.now()}`;

async function post(endpoint, body) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

function step(n, label) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`STEP ${n}: ${label}`);
  console.log('─'.repeat(60));
}

async function run() {
  console.log('='.repeat(60));
  console.log('  Corti Integration — Manual Verification Flow');
  console.log('='.repeat(60));
  console.log(`  External ID: ${EXTERNAL_ID}`);

  // ── Step 1: Open session ──────────────────────────────────
  step(1, 'openCortiSession — simulate CAD dispatching a call');
  const openResult = await post('/openCortiSession', {
    data: {
      externalId: EXTERNAL_ID,
      facts: {
        factValues: [
          { id: 'patient.name',      value: 'Jane Smith' },
          { id: 'patient.age',       value: '62' },
          { id: 'chief.complaint',   value: 'Shortness of breath' },
        ],
      },
    },
  });
  console.log(`  → HTTP ${openResult.status}:`, openResult.data);

  if (openResult.status !== 200) {
    console.error('\n  ❌ Could not open session. Is the Corti desktop app running?');
    process.exit(1);
  }

  const sessionId = openResult.data?.sessionId ?? '(unknown)';
  console.log(`\n  Session ID: ${sessionId}`);

  // ── Step 2: Instructions ──────────────────────────────────
  step(2, 'Your turn — interact with the Corti desktop app');
  console.log(`
  The Corti window should now be visible with the session open.
  Work through each action below and watch the integration logs
  in the other terminal to verify every event fires correctly.

  ┌──────────────────────────────────────────────────────────┐
  │  CHECKLIST                                               │
  ├──────────────────────────────────────────────────────────┤
  │  1. Confirm the Corti window opened / came into focus.   │
  │     → Expected log: "Entering Session: <id>"             │
  │     → Expected log: "Event: realtime.session-opened …"   │
  │                                                          │
  │  2. Trigger an action block (typecode button).           │
  │     → Expected log: "New Typecode: <id> - <value> …"    │
  │                                                          │
  │  3. Add a comment in the session.                        │
  │     → Expected log: "New Comment: <text> …"             │
  │                                                          │
  │  4. Fill in a flow value collector (e.g. demographics).  │
  │     → Expected log: "New Collector: <name> - <value> …" │
  │                                                          │
  │  5. Link a case ID (if available in the flow).           │
  │     → Expected log: "Case ID changed: <id> …"           │
  └──────────────────────────────────────────────────────────┘

  Press Ctrl+C when done to leave the session and wrap up.
`);

  // ── Step 3: Graceful shutdown ─────────────────────────────
  process.on('SIGINT', async () => {
    step(3, 'leaveCortiSession — cleaning up');
    const leaveResult = await post('/leaveCortiSession', {});
    console.log(`  → HTTP ${leaveResult.status}:`, leaveResult.data);
    console.log('\n  Done. Check integration logs for "Event: realtime.session-closed".\n');
    process.exit(0);
  });
}

run().catch(err => {
  console.error('Unexpected error:', err.message);
  process.exit(1);
});
