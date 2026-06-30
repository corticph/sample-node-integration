# Corti Triage — CAD Integration (Node.js)

A working example of a CAD integration for the Corti Triage desktop application. Clone it, run it alongside the Corti desktop app, and replace the `console.log` placeholders and `TODO` comments with calls to your own CAD API.

---

## Architecture

Two local HTTP servers run side by side on the dispatcher's machine:

```
Your CAD system          This integration             Corti Desktop App
                       (Node.js / Express)             (running locally)
                              │                               │
POST /openCortiSession ──────▶│                               │
                              │──/realtime/activeSessions────▶│
                              │◀── [ existing sessions ] ─────│
                              │                               │
                              │  (no existing session found)  │
                              │──/realtime/startSession──────▶│  ← creates session
                              │◀── { session: { id } } ───────│
                              │──/realtime/enterSession───────▶│  ← navigates to it
                              │──/window/unhideAllAndFocus────▶│  ← focuses the window
                              │                               │
◀── { sessionId } ───────────│                               │
                              │                               │
                              │       Dispatcher works        │
                              │                               │
POST /events ◀───────────────│◀── action-block-triggered ────│
POST /events ◀───────────────│◀── grouped-fvc-updated ───────│
POST /events ◀───────────────│◀── comment-created ───────────│
                              │                               │
POST /leaveCortiSession ─────▶│──/realtime/leaveSession──────▶│
```

| Port | Owner | Purpose |
|------|-------|---------|
| `45002` | This integration | Receives commands from your CAD (`/openCortiSession`, `/leaveCortiSession`) and events pushed by Corti (`/events`) |
| `45001` | Corti Desktop App | Receives `callMethod` RPC calls from this integration to control sessions and the window |

Your CAD calls port `45002` only. The integration handles all Corti communication.

---

## Getting started

### Prerequisites

- Node.js 18+
- Corti Triage desktop app installed and running with a user logged in
- A Corti API key for your environment

### Install

```bash
git clone https://github.com/corticph/sample-node-integration.git
cd sample-node-integration
npm install
```

### Configure

Create a `.env` file in the project root:

```
# Port this integration listens on
PORT=45002

# Corti desktop app RPC server — don't change this
CLIENTHOST=http://localhost:45001

# API key for your Corti environment.
# Derive the variable name from your API host:
# https://api.myenv.motocorti.io → API_KEY_MYENV
API_KEY_MYENV=your-api-key-here
```

### Run

```bash
# Development — TypeScript watch mode with auto-restart
npm run dev

# Production
npm run build && npm start
```

---

## Typical flow walkthrough

The script below simulates exactly what your CAD system will do. Run it to verify the full flow end to end:

```bash
# Terminal 1 — start the integration
npm run dev

# Terminal 2 — simulate a CAD dispatch
node test-manual-flow.js
```

Here is what happens at each step.

---

### Step 1 — CAD dispatches a call

Your CAD POSTs to `/openCortiSession` when an incoming call is answered:

```http
POST http://localhost:45002/openCortiSession
Content-Type: application/json

{
  "data": {
    "externalId": "CAD-12345",
    "facts": {
      "factValues": [
        { "id": "patient.name",    "value": "Jane Smith" },
        { "id": "patient.age",     "value": "62" },
        { "id": "chief.complaint", "value": "Shortness of breath" }
      ]
    }
  }
}
```

- **`externalId`** — your unique identifier for this call or incident. Used to prevent duplicates and to match events back to the right record.
- **`facts`** — data you already have. When re-entering an existing session these are written back to the session so the dispatcher sees up-to-date information.

---

### Step 2 — Integration opens the session

`src/controllers/sessionController.ts` runs through this logic on every `/openCortiSession` call:

1. **Check active sessions** — calls `/realtime/activeSessions` on the desktop app. If a session with the same `externalId` is already open, navigates to it and returns immediately.
2. **Check the database** — calls the Corti REST API to look up a past session by `externalId`. If one exists, re-enters it.
3. **Start a new session** — calls the Corti REST API to find an active call for the current user, then calls `/realtime/startSession`. If a matching call is found the session is linked to its case ID; otherwise a standalone session is created.
4. **Enter and focus** — calls `/realtime/enterSession` to navigate the desktop app to the session, then `/window/unhideAllAndFocus` to bring it to the foreground.

The response is returned to your CAD:

```json
{ "message": "Session New", "sessionId": "235caf94-bcb6-41f4-b663-c99e09e38aff" }
```

`message` will be `"Session New"`, `"Session Opened"` (existing active session), or `"Session from Db"` (found in database). Store the `sessionId` to correlate incoming events.

---

### Step 3 — Events arrive as the dispatcher works

While the dispatcher interacts with the Corti flow, the desktop app pushes events to `POST /events`. Every event has this envelope:

```json
{ "name": "event.name", "data": { ... } }
```

`src/controllers/eventsController.ts` routes each event by name to a handler. The handlers currently log the data — **replace the `console.log` calls and `TODO` comments with your CAD API calls.**

#### Dispatcher triggers an action block (typecode button)

**Event:** `realtime.session.triage-flow.action-block-triggered`  
**Handler:** `src/eventHandlers/handleActionBlockTriggered.ts`

Fired when the dispatcher clicks a protocol or typecode button. The handler merges `customProperties` from the block prototype and block instance (instance values win on conflict) into a flat map, logs each value, and writes them back to the session as facts via `/realtime/session/setFactValues`.

```
Terminal log: New Typecode: typecode - CHEST_PAIN (External Session ID: CAD-12345)
```

The `customProperties` keys and values are configured in the Corti flow builder. Use them to encode your CAD's field names:

```typescript
// TODO: replace with your CAD API call
console.log(`New Typecode: ${fact.id} - ${fact.value} (External Session ID: ${session.externalID})`);

// Example replacement:
await yourCadApi.updateIncidentType(session.externalID, { [fact.id]: fact.value });
```

#### Dispatcher fills in a flow value collector

**Event:** `realtime.session.triage-flow.grouped-flow-value-collector-blocks-updated`  
**Handler:** `src/eventHandlers/handleGroupedFlowValueCollectorBlocksUpdated.ts`

Fired when the dispatcher answers a question in a structured collector (demographics, incident details, clinical pathway, etc.). Corti sends the **full current state** of all collectors on every update — not just the changed field.

Each collector block in `group[]` contains:
- `displayValues` — formatted, human-readable answer strings
- `collectedBlockValues` — structured values with `blockPrototypeID` for mapping
- `blockPrototype.customProperties` — key/value pairs you configure in the Corti flow builder

```
Terminal log: New Collector: Patient Age - 62 (External Session ID: CAD-12345)
Terminal log: Collector custom properties: 62 (External Session ID: CAD-12345) [{ key: 'fact_mapping', value: 'pt.age' }]
```

The handler deduplicates values by `blockPrototypeId` and surfaces any `customProperties` for blocks that have them. Configure a `customProperty` like `fact_mapping = pt.age` on each selectable option in the Corti flow builder to control field mapping from configuration rather than code:

```typescript
// TODO: replace with your CAD API call
console.log(`New Collector: ${block.blockPrototype.name} - ${textString} (External Session ID: ${session.externalID})`);

// Example replacement using customProperties for field mapping:
const mapping = update.customProperties.find(p => p.key === 'fact_mapping');
if (mapping) {
  await yourCadApi.setField(session.externalID, mapping.value, update.text);
}
```

By default, one event is posted per value change. Set a `requireExplicitSendToLocalhostApi` custom property to `true` on a collector to only receive an event when the dispatcher clicks "Send".

#### Dispatcher adds a comment

**Event:** `realtime.session.comments.comment-created`  
**Handler:** `src/eventHandlers/handleCommentCreated.ts`

Fired when the dispatcher types a free-text comment.

```
Terminal log: New Comment: Patient is conscious and breathing. (External Session ID: CAD-12345)
```

```typescript
// TODO: replace with your CAD API call
console.log(`New Comment: ${comment.text} (External Session ID: ${session.externalID})`);

// Example replacement:
await yourCadApi.appendNote(session.externalID, comment.text);
```

#### A case ID is linked to the session

**Event:** `realtime.session.case-id-changed`  
**Handler:** `src/eventHandlers/handleSessionCaseIDChanged.ts`

Fired when Corti associates a case ID with the session (e.g. when it matches the call to an incoming call record). The handler calls `/backendproxy/cases/ensureCaseCustomProperties` to write properties onto the case.

```
Terminal log: Case ID changed: case-abc-123 (External Session ID: CAD-12345)
```

```typescript
// TODO: replace the hardcoded values with a lookup from your CAD
const customProperties = {
  "telephone": "1234567890",
  "location": "34 Elm St, Springfield, IL"
}

// Example replacement:
const call = await yourCadApi.getCall(session.externalID);
const customProperties = { telephone: call.callerNumber, location: call.incidentAddress };
```

#### Session opened / closed

**Events:** `realtime.session-opened`, `realtime.session-closed`  
**Handler:** `src/controllers/eventsController.ts` — add logic directly to the `case` blocks.

Use these to track whether the dispatcher is actively working in Corti.

```
Terminal log: Event: realtime.session-opened (Session ID: 235caf94-…, External ID: CAD-12345)
Terminal log: Event: realtime.session-closed (Session ID: 235caf94-…, External ID: CAD-12345)
```

---

### Step 4 — Call ends

When the call is complete, your CAD POSTs to `/leaveCortiSession`:

```http
POST http://localhost:45002/leaveCortiSession
Content-Type: application/json

{}
```

The integration calls `/realtime/leaveSession` on the desktop app. The `realtime.session-closed` event will arrive at `/events` shortly after.

---

## Architecture reference

### The callMethod RPC

The Corti desktop app exposes a local HTTP RPC server at `http://localhost:45001/callMethod`. All calls are POSTs:

```json
{ "method": "/some/method", "params": { "key": "value" } }
```

Response:

```json
{ "result": <method-specific value> }
```

This integration wraps it in `cortiCallMethod(method, params?)` in `src/services/cortiServices.ts`. Use this function for all desktop app interactions.

**Endpoints used by this integration:**

| Method | Params | What it does |
|--------|--------|--------------|
| `/realtime/activeSessions` | — | Returns all currently active sessions |
| `/realtime/startSession` | `externalID?, caseID?` | Creates a new session |
| `/realtime/enterSession` | `sessionID` | Navigates the desktop app to a session |
| `/realtime/leaveSession` | — | Leaves the current session view |
| `/realtime/session/setFactValues` | `sessionID, facts[]` | Writes fact values onto a session |
| `/window/unhideAllAndFocus` | — | Brings the Corti window to the foreground |
| `/app/getApiHost` | — | Returns the Corti REST API base URL |
| `/app/getCurrentUser` | — | Returns the authenticated user |
| `/backendproxy/cases/ensureCaseCustomProperties` | `caseID, customProperties` | Merges custom properties onto a case |

---

## Testing

### Manual end-to-end test

Simulates a full dispatch cycle and walks you through verifying each event type in the live Corti UI.

```bash
# Terminal 1
npm run dev

# Terminal 2
node test-manual-flow.js
```

The script opens a session, prints a checklist of actions to perform in the Corti UI, and waits. Press Ctrl+C to trigger the leave step.

### Automated FVC handler test

Posts synthetic payloads directly to `/events` to verify the grouped flow value collector handler — no live session or desktop app required.

```bash
# Terminal 1 — integration must be running
npm run dev

# Terminal 2
node test-grouped-flow-value-collector-blocks-updated.js
# or: npm run test:grouped-fvc
```

---

## Project structure

```
src/
  controllers/
    eventsController.ts       # Routes incoming events by name to handlers
    sessionController.ts      # Handles /openCortiSession and /leaveCortiSession
  eventHandlers/
    handleActionBlockTriggered.ts                    # Typecode / protocol buttons
    handleCommentCreated.ts                          # Free-text comments
    handleGroupedFlowValueCollectorBlocksUpdated.ts  # Structured flow answers
    handleSessionCaseIDChanged.ts                    # Case ID linking
  routes/
    events.ts                 # POST /events
    session.ts                # POST /openCortiSession, POST /leaveCortiSession
  services/
    cortiServices.ts          # cortiCallMethod wrapper + Corti REST API calls
  types/
    apiResponses.ts           # Response type definitions
    events.ts                 # Event payload type definitions
  utils/
    utils.ts                  # getApiHost, getApiKey, enterSessionAndOpenWindow
```

### Adding a new event handler

1. Create `src/eventHandlers/handleMyEvent.ts`
2. Export it from `src/eventHandlers/index.ts`
3. Add a `case 'event.name.here':` block in `src/controllers/eventsController.ts`
