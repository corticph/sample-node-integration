# Corti Triage Sample Integration (Node.js)

A reference integration showing how a CAD or dispatch system connects to the Corti Triage desktop application. It handles two directions of communication: **inbound commands** from your system that open and manage sessions, and **inbound events** from the Corti desktop app that report what is happening inside a session.

---

## How it works

```
┌─────────────────────┐         ┌──────────────────────────────┐         ┌──────────────────────┐
│   Your CAD system   │         │   This integration           │         │  Corti desktop app   │
│                     │         │   (Node.js / Express)        │         │                      │
│  POST /openCorti    │────────▶│                              │────────▶│  callMethod RPC      │
│  Session            │         │  sessionController.ts        │         │  localhost:45001     │
│                     │         │  · checks active sessions    │         │                      │
│                     │         │  · starts or enters session  │         │  /realtime/start     │
│                     │         │  · focuses the window        │         │  Session             │
│                     │         │                              │         │  /realtime/enter     │
│                     │         │                              │         │  Session             │
│                     │         │                              │         │  /window/unhideAll   │
│                     │         │                              │         │  AndFocus            │
│                     │◀────────│  returns { sessionId }       │         │                      │
└─────────────────────┘         └──────────────────────────────┘         └──────────────────────┘
                                         ▲
                                         │  POST /events
                                         │  (Corti pushes events here
                                         │   as the call progresses)
                                         │
                               ┌─────────┴────────────────────┐
                               │  eventsController.ts         │
                               │  · routes by event name      │
                               │  · calls the right handler   │
                               └──────────────────────────────┘
                                  │            │           │
                          ┌───────┘    ┌───────┘    ┌──────┘
                          ▼            ▼            ▼
                   action-block   comment-    grouped-fvc-
                   triggered      created     updated
                   handler        handler     handler
```

**There are two separate local ports involved:**

| Port | Who listens | What it receives |
|------|-------------|-----------------|
| `45002` | **This integration** | Commands from your CAD (`/openCortiSession`, `/leaveCortiSession`) and events pushed by Corti (`/events`) |
| `45001` | **Corti desktop app** | `callMethod` RPC calls from this integration (start session, enter session, focus window, etc.) |

Your CAD system only ever talks to port 45002. The integration translates those requests into `callMethod` calls on port 45001. Corti sends real-time session events back to port 45002.

---

## The callMethod RPC

The Corti desktop app exposes a local HTTP RPC server at `http://localhost:45001/callMethod`. Every call is a `POST` with a JSON body:

```json
{ "method": "/some/method", "params": { "key": "value" } }
```

The response is always:

```json
{ "result": <method-specific response> }
```

This integration wraps that in `cortiCallMethod(method, params?)` in `src/services/cortiServices.ts`. All session management goes through this function — there are no direct Corti REST API calls for session control.

The desktop app endpoints used by this integration:

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

## HTTP endpoints exposed by this integration

### `POST /openCortiSession`

Called by your CAD system when a new call comes in. The integration will:

1. Check if a session with the given `externalId` is already active — if so, enter it.
2. Check if it exists in the Corti database — if so, enter it.
3. Otherwise create a new session, optionally linking it to a matching active call.
4. Focus the Corti desktop window and set any initial fact values.

**Request body:**

```json
{
  "data": {
    "externalId": "CAD-12345",
    "facts": {
      "factValues": [
        { "id": "patient.name", "value": "Jane Smith" },
        { "id": "patient.age",  "value": "62" },
        { "id": "chief.complaint", "value": "Shortness of breath" }
      ]
    }
  }
}
```

**Response:**

```json
{ "message": "Session New", "sessionId": "235caf94-..." }
```

`message` will be `"Session New"`, `"Session Opened"` (was active), or `"Session from Db"` (existed in DB).

---

### `POST /leaveCortiSession`

Called by your CAD system when the call ends. Tells the desktop app to leave the current session view.

**Request body:** `{}` (no payload required)

---

### `POST /events`

This endpoint is called by the **Corti desktop app**, not your CAD system. Configure Corti to POST events to `http://localhost:45002/events`.

Every event has the shape:

```json
{ "name": "event.name.here", "data": { ... } }
```

See [Event handlers](#event-handlers) below for what each event contains and how it is processed.

---

## Event handlers

The `eventsController.ts` routes incoming events by `event.name` to the appropriate handler in `src/eventHandlers/`.

### `realtime.session-opened`

Fired when the user enters a session in the desktop app.

```
Event: realtime.session-opened (Session ID: 235caf94-..., External ID: CAD-12345)
```

### `realtime.session-closed`

Fired when the session is closed.

```
Event: realtime.session-closed (Session ID: 235caf94-..., External ID: CAD-12345)
```

### `realtime.session.triage-flow.action-block-triggered`

Fired when the dispatcher clicks an action block (e.g. a typecode button). The handler merges prototype-level and instance-level `customProperties` (instance wins on clash), then logs each fact and calls `/realtime/session/setFactValues` to write the facts back to the session.

```
New Typecode: typecode - CHEST_PAIN (External Session ID: CAD-12345)
New Typecode: subtypecode - ACUTE (External Session ID: CAD-12345)
```

**To customise:** replace (or add to) the `setFactValues` call to push the typecode into your CAD.

### `realtime.session.comments.comment-created`

Fired when a comment is added to the session.

```
New Comment: Patient reports pain started 2 hours ago (External Session ID: CAD-12345)
```

**To customise:** replace the `console.log` with a write to your CAD notes field.

### `realtime.session.triage-flow.grouped-flow-value-collector-blocks-updated`

Fired whenever the dispatcher answers a question in a flow value collector (demographics, clinical pathway, etc.). This event fires on every change, not just on submission — Corti sends the full current state of the collector each time.

The handler logs the concatenated display string for each block, then extracts and logs any `customProperties` from collected block values (deduped by `blockPrototypeId`):

```
New Collector: Patient_Details - Patient sex: Female | manual test | 11 years old (External Session ID: CAD-12345)
Collector custom properties: 11 (External Session ID: CAD-12345) [ { key: 'fact_mapping', value: 'pt.age' } ]
```

Blocks with no values yet are logged as `(no values)` rather than silently skipped, so you can see when a collector is present but unanswered.

**To customise:** use the `customProperties` on each block prototype (set in the Corti flow builder) to drive mapping logic — e.g. `fact_mapping: pt.age` tells you which CAD field to update.

### `realtime.session.case-id-changed`

Fired when a case ID is linked to the session. The handler calls `/backendproxy/cases/ensureCaseCustomProperties` to merge properties onto the case.

```
Case ID changed: CASE-9981 (External Session ID: CAD-12345)
```

**To customise:** replace or extend the `customProperties` object with real values fetched from your CAD.

### `app.login` / `app.logout`

Fired when the Corti desktop app user logs in or out. Logged for visibility; no action taken by default.

### Unknown events

Any event name not listed above is logged as:

```
Unhandled event: some.unknown.event { ...data }
```

---

## Configuration

Copy `.env.example` to `.env` (or create `.env`) and set:

```
# Port this integration listens on (default: 45002)
PORT=45002

# URL of the Corti desktop app's local RPC server (default: http://localhost:45001)
CLIENTHOST=http://localhost:45001

# API key(s) for the Corti REST API — one per environment, uppercase env ID
# Format: API_KEY_<ENVIRONMENT_ID>=<key>
API_KEY_MYENV=your-api-key-here
```

The environment ID is derived from your Corti API host. For `https://api.myenv.motocorti.io` the variable name is `API_KEY_MYENV`.

---

## Running locally

```bash
npm install

# Development (TypeScript watch + nodemon auto-restart)
npm run dev

# Production
npm run build
npm start
```

The server starts at `http://localhost:45002` (or the `PORT` you configured).

---

## Testing

### Manual end-to-end test

Requires the Corti desktop app to be running and logged in.

```bash
# Terminal 1
npm run build && node dist/index.js

# Terminal 2
node test-manual-flow.js
```

The script opens a session (simulating a CAD dispatch) and prints a checklist of actions to perform in the desktop app. Watch Terminal 1 for the corresponding log lines as each event arrives.

### Automated FVC handler test

Tests the grouped flow value collector handler with synthetic payloads — no live Corti session needed.

```bash
# Terminal 1 (integration must be running)
node dist/index.js

# Terminal 2
node test-grouped-flow-value-collector-blocks-updated.js
```

---

## Extending the integration

- **Add a new event handler:** create `src/eventHandlers/handleMyEvent.ts`, export it from `src/eventHandlers/index.ts`, and add a `case` for it in `src/controllers/eventsController.ts`.
- **Add a new CAD endpoint:** add a route in `src/routes/session.ts` and a controller function in `src/controllers/sessionController.ts`. Use `cortiCallMethod` for any desktop app interaction.
- **Use more callMethod endpoints:** all 20 available methods on the desktop app are listed in the architecture notes above; call them via `cortiCallMethod(method, params)`.
