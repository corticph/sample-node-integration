# Corti Triage — Sample CAD Integration (Node.js)

This repository is a **starting point for CAD vendors** building a real-time integration between their dispatch system and the Corti Triage desktop application. Clone it, run it alongside the Corti desktop app, and replace the `console.log` placeholders with calls to your own CAD API.

---

## What you are building

When a dispatcher takes a call, your CAD system should automatically open a Corti Triage session and pre-fill it with what you already know (caller details, incident type, location). As the dispatcher works through Corti's clinical decision support flow, the results — typecodes, demographics, clinical pathway answers — should flow back into your CAD in real time.

This integration sits between the two systems and handles that two-way communication:

```
Your CAD system                 This integration                 Corti desktop app
      │                        (Node.js / Express)                (running locally)
      │                               │                                  │
      │  Call comes in                │                                  │
      │──POST /openCortiSession──────▶│                                  │
      │                               │──callMethod /realtime/startSession──▶│
      │                               │◀─── { session: { id } } ────────│
      │                               │──callMethod /realtime/enterSession──▶│
      │                               │──callMethod /window/unhideAllAndFocus▶│
      │◀── { sessionId } ────────────│                                  │
      │                               │                                  │
      │                               │     Dispatcher works the flow    │
      │                               │                                  │
      │                               │◀──POST /events (action-block-triggered)
      │  Update typecode in CAD  ◀───│                                  │
      │                               │◀──POST /events (grouped-fvc-updated)
      │  Update patient details  ◀───│                                  │
      │                               │                                  │
      │  Call ends                    │                                  │
      │──POST /leaveCortiSession─────▶│                                  │
      │                               │──callMethod /realtime/leaveSession──▶│
```

**Two local ports are involved:**

| Port | Owner | Purpose |
|------|-------|---------|
| `45002` | This integration | Receives commands from your CAD (`/openCortiSession`, `/leaveCortiSession`) and real-time events from Corti (`/events`) |
| `45001` | Corti desktop app | Receives `callMethod` RPC calls from this integration to control the session and window |

Your CAD system only ever speaks to port `45002`. The integration translates those requests into the appropriate `callMethod` calls on port `45001`, and routes events coming back from Corti to your CAD.

---

## Getting started

### Prerequisites

- Node.js 18+
- Corti Triage desktop app installed and running on the same machine
- A Corti API key for your environment

### Install and configure

```bash
git clone https://github.com/corticph/sample-node-integration.git
cd sample-node-integration
npm install
```

Create a `.env` file in the project root:

```
# Port this integration listens on (your CAD calls this)
PORT=45002

# Corti desktop app RPC server — don't change this unless explicitly instructed
CLIENTHOST=http://localhost:45001

# API key for the Corti REST API.
# The variable name encodes your environment ID (uppercase).
# For API host https://api.myenv.motocorti.io → API_KEY_MYENV
API_KEY_MYENV=your-api-key-here
```

### Run

```bash
# Development — TypeScript watch mode with auto-restart
npm run dev

# Production
npm run build && npm start
```

The integration starts at `http://localhost:45002`.

### Verify it works

With the Corti desktop app open and a user logged in:

```bash
# Terminal 2 — simulates your CAD dispatching a call
node test-manual-flow.js
```

The Corti window should come into focus with a new session. Watch Terminal 1 for event logs as you interact with the flow.

---

## Connecting your CAD system

There are two integration points you need to implement on the CAD side.

### 1. Open a session when a call comes in

When your CAD receives a new call, POST to `/openCortiSession`:

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
        { "id": "chief.complaint", "value": "Shortness of breath" },
        { "id": "address",         "value": "34 Elm St, Springfield" }
      ]
    }
  }
}
```

- **`externalId`** — your CAD's unique identifier for this call or incident. Corti stores this so you can match events back to the right record.
- **`facts`** — any information you already have. These pre-fill the Corti session so the dispatcher doesn't need to type what you already know. The fact IDs (`patient.name`, `patient.age`, etc.) are defined in your Corti flow configuration.

The integration handles the idempotency: if a session with that `externalId` is already active it enters it rather than creating a duplicate.

**Response:**

```json
{ "message": "Session New", "sessionId": "235caf94-bcb6-41f4-b663-c99e09e38aff" }
```

Store the `sessionId` — you may need it to correlate incoming events.

### 2. Close the session when the call ends

```http
POST http://localhost:45002/leaveCortiSession
Content-Type: application/json

{}
```

### 3. Configure Corti to send events to this integration

In your Corti environment configuration, set the webhook URL for real-time session events to:

```
http://localhost:45002/events
```

Events will then flow automatically as the dispatcher works the call.

---

## What you receive from Corti (and what to do with it)

Every event Corti sends has this shape:

```json
{ "name": "event.name", "data": { ... } }
```

The integration routes each event to a handler in `src/eventHandlers/`. Each handler currently logs the data — **replace those `console.log` calls and `TODO` comments with your actual CAD API calls.**

---

### Action block triggered → update typecode in your CAD

**Event:** `realtime.session.triage-flow.action-block-triggered`

Fired when the dispatcher clicks a protocol or typecode button in the Corti flow. The handler merges the action block's `customProperties` (set in the Corti flow builder) into a flat key/value map and writes them back to the session as facts.

**File:** `src/eventHandlers/handleActionBlockTriggered.ts`

```typescript
// What you receive
{ typecode: 'CHEST_PAIN', subtypecode: 'ACUTE' }

// Current behaviour — replace this with your CAD API call
console.log(`New Typecode: ${fact.id} - ${fact.value} (External Session ID: ${session.externalID})`);

// What you should do instead, for example:
await yourCadApi.updateIncidentType(session.externalID, { typecode, subtypecode });
```

The `customProperties` on each action block prototype are configured in the Corti flow builder. Use them to encode your CAD's field names or codes as values.

---

### Comment created → write to your CAD notes

**Event:** `realtime.session.comments.comment-created`

Fired when the dispatcher adds a free-text comment to the session.

**File:** `src/eventHandlers/handleCommentCreated.ts`

```typescript
// What you receive
{ comment: { text: 'Patient is conscious and breathing.' }, session: { externalID: 'CAD-12345' } }

// Replace this:
console.log(`New Comment: ${comment.text} (External Session ID: ${session.externalID})`);

// With this:
await yourCadApi.appendNote(session.externalID, comment.text);
```

---

### Flow value collector updated → update patient record in your CAD

**Event:** `realtime.session.triage-flow.grouped-flow-value-collector-blocks-updated`

This is the most data-rich event. It fires every time the dispatcher answers a question in a structured collector (demographics, clinical pathway, incident summary, etc.). Corti sends the **full current state** of every collector on each update — not just the changed field.

**File:** `src/eventHandlers/handleGroupedFlowValueCollectorBlocksUpdated.ts`

Each collector block in the event has:
- `displayValues` — the formatted, human-readable answer strings (use these to display or log)
- `collectedBlockValues` — the structured values with their `blockPrototypeID` for mapping
- `blockPrototype.customProperties` — key/value pairs you configure in the Corti flow builder to control how this value maps to your CAD

**Using `customProperties` for field mapping:**

In the Corti flow builder, add a custom property to each selectable option's block prototype with the key `fact_mapping` (or any key your integration expects) and the value set to your CAD's field ID:

```
Block prototype: "Patient Age"
Custom property: fact_mapping = pt.age
```

The handler surfaces these:

```typescript
// What you receive (after dedup by blockPrototypeId)
{ text: '11', customProperties: [{ key: 'fact_mapping', value: 'pt.age' }] }

// Replace the console.log with mapping logic:
for (const update of uniqueSelectUpdates) {
  const mapping = update.customProperties.find(p => p.key === 'fact_mapping');
  if (mapping) {
    await yourCadApi.setField(session.externalID, mapping.value, update.text);
  }
}
```

This pattern means you control the CAD field mapping in the Corti flow configuration rather than in code.

---

### Case ID linked → push CAD data to the case

**Event:** `realtime.session.case-id-changed`

Fired when a Corti case ID is associated with the session (e.g. when Corti matches the call to an incoming call record). The handler calls `/backendproxy/cases/ensureCaseCustomProperties` to write properties onto the case.

**File:** `src/eventHandlers/handleSessionCaseIDChanged.ts`

```typescript
// Current — hardcoded placeholder values
const customProperties = {
  "telephone": "1234567890",
  "location": "34 Elm St, Springfield, IL"
}

// Replace with a lookup from your CAD using session.externalID:
const call = await yourCadApi.getCall(session.externalID);
const customProperties = {
  "telephone": call.callerNumber,
  "location": call.incidentAddress,
}
```

---

### Session opened / closed

**Events:** `realtime.session-opened`, `realtime.session-closed`

Use these to track session state in your CAD — for example to know when the dispatcher is actively working Corti versus when they've left the session.

**File:** `src/controllers/eventsController.ts` — add logic directly to the `case` blocks.

---

## Architecture reference

### The callMethod RPC

The Corti desktop app exposes a local HTTP RPC server at `http://localhost:45001/callMethod`. Every call is a `POST`:

```json
{ "method": "/some/method", "params": { "key": "value" } }
```

Response:

```json
{ "result": <method-specific value> }
```

This integration wraps it in `cortiCallMethod(method, params?)` in `src/services/cortiServices.ts`. Use this function for all desktop app interactions — never call the Corti REST API directly for session control.

**Endpoints used by this integration:**

| Method | Params | What it does |
|--------|--------|--------------|
| `/realtime/activeSessions` | — | Returns all currently active sessions |
| `/realtime/startSession` | `externalID?, caseID?` | Creates a new session |
| `/realtime/enterSession` | `sessionID` | Navigates the desktop app to an existing session |
| `/realtime/leaveSession` | — | Leaves the current session view |
| `/realtime/session/setFactValues` | `sessionID, facts[]` | Sets fact values on the active session |
| `/window/unhideAllAndFocus` | — | Brings the Corti window to the foreground |
| `/app/getApiHost` | — | Returns the current Corti API base URL |
| `/app/getCurrentUser` | — | Returns the authenticated user |
| `/backendproxy/cases/ensureCaseCustomProperties` | `caseID, customProperties` | Merges custom properties onto a case |

---

## Testing

### Manual end-to-end test

Simulates a CAD dispatching a call and walks you through the actions to verify each event type.

```bash
# Terminal 1 — run the integration
npm run build && node dist/index.js

# Terminal 2 — simulate a CAD dispatch
node test-manual-flow.js
```

Interact with the Corti flow in the desktop app and watch Terminal 1 for the event logs.

### Automated FVC handler test

Posts synthetic payloads directly to `/events` to verify the grouped flow value collector handler — no live session needed.

```bash
# Terminal 1 — integration must be running
node dist/index.js

# Terminal 2
node test-grouped-flow-value-collector-blocks-updated.js
```

---

## Project structure

```
src/
  controllers/
    eventsController.ts       # Routes incoming events by name to handlers
    sessionController.ts      # Handles /openCortiSession and /leaveCortiSession
  eventHandlers/
    handleActionBlockTriggered.ts               # Typecode / protocol buttons
    handleCommentCreated.ts                     # Free-text comments
    handleGroupedFlowValueCollectorBlocksUpdated.ts  # Structured flow answers
    handleSessionCaseIDChanged.ts               # Case ID linking
  routes/
    events.ts                 # POST /events
    session.ts                # POST /openCortiSession, POST /leaveCortiSession
  services/
    cortiServices.ts          # callMethod wrapper + Corti REST API calls
  types/
    apiResponses.ts           # Response type definitions
    events.ts                 # Event payload type definitions
  utils/
    utils.ts                  # getApiHost, getApiKey, enterSessionAndOpenWindow
```

## Adding new handlers

1. Create `src/eventHandlers/handleMyEvent.ts`
2. Export it from `src/eventHandlers/index.ts`
3. Add a `case 'event.name.here':` block in `src/controllers/eventsController.ts`
