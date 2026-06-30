/**
 * End-to-end smoke test against the REAL Corti desktop app.
 *
 * Requires:
 *   - the desktop app running and logged in (RPC on CLIENTHOST, default :45001)
 *   - this integration running (npm run dev / npm start) on PORT (default :45002)
 *
 * Verifies the open → (facts write-back) → leave flow end to end:
 *   GET  /health
 *   POST /openCortiSession   → 200 + sessionId, opens/focuses the desktop app
 *   POST /leaveCortiSession  → 200, leaves the session view
 *
 * Run: npm run test:e2e
 */
const PORT = process.env.PORT || 45002;
const BASE_URL = `http://localhost:${PORT}`;
const EXTERNAL_ID = `E2E-${Date.now()}`;

async function req(method, endpoint, body) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

let failed = 0;
function check(label, cond, detail) {
  if (cond) {
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`);
  }
}

async function run() {
  console.log('='.repeat(60));
  console.log('  E2E against real desktop app');
  console.log('='.repeat(60));
  console.log(`  Integration: ${BASE_URL}`);
  console.log(`  External ID: ${EXTERNAL_ID}\n`);

  // 1. Health
  const health = await req('GET', '/health').catch((e) => ({ status: 0, data: e.message }));
  check('GET /health returns 200', health.status === 200, `status=${health.status}`);
  if (health.status !== 200) {
    console.error('\n  Integration is not running. Start it with `npm run dev` or `npm start`.\n');
    process.exit(1);
  }

  // 2. Open a session (with facts, exercising the setFactValues write-back path)
  const open = await req('POST', '/openCortiSession', {
    data: {
      externalId: EXTERNAL_ID,
      facts: {
        factValues: [
          { id: 'patient.name', value: 'E2E Test' },
          { id: 'patient.age', value: '62' },
        ],
      },
    },
  });
  console.log(`  → /openCortiSession HTTP ${open.status}:`, open.data);
  check('POST /openCortiSession returns 200', open.status === 200, `status=${open.status}`);
  check('response includes a sessionId', Boolean(open.data && open.data.sessionId), JSON.stringify(open.data));
  check(
    'message is one of Session New/Opened/from Db',
    ['Session New', 'Session Opened', 'Session from Db'].includes(open.data && open.data.message),
    open.data && open.data.message
  );

  const sessionId = open.data && open.data.sessionId;

  // 3. Leave the session (forwarding the sessionID, per the desktop API)
  const leave = await req('POST', '/leaveCortiSession', sessionId ? { sessionId } : {});
  console.log(`  → /leaveCortiSession HTTP ${leave.status}`);
  check('POST /leaveCortiSession returns 200', leave.status === 200, `status=${leave.status}`);

  console.log('\n' + '='.repeat(60));
  console.log(failed === 0 ? '  ✅ E2E PASSED' : `  ❌ E2E FAILED (${failed} check(s))`);
  console.log('='.repeat(60) + '\n');
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((err) => {
  console.error('Unexpected error:', err.message);
  process.exit(1);
});
