# Desktop App Public API

The desktop (Electron) app exposes a JSON-RPC style API via the `publicapi` framework. Methods are called via `callMethod` and events are subscribed via `subscribeAll`.

- **Renderer:** `window.publicapi.callMethod<T>(method, params?)` / `window.publicapi.subscribeAll(cb)`
- **HTTP (launcher):** `POST /callMethod` with `{ method, params? }` body; events are POSTed to a configured webhook URL.
- **IPC:** Events and method calls are bridged between main and renderer via channels `core/publicapi:method-call` and `core/publicapi:push-event`.

---

## Shared Types

```typescript
interface Session {
  id: string;
  caseID?: string;
  externalID?: string;
  owner?: {
    id: string;
    name: string;
  };
}

type NotificationType = 'info' | 'error' | 'success' | 'warning';

type ShowNotificationInput = PermanentNotificationInput | TemporaryNotificationInput;

interface BaseNotificationInput {
  id?: string;
  message: string;
  detailText?: string;
  type?: NotificationType;
  closable?: boolean;
  permanent?: boolean;
}

interface PermanentNotificationInput extends BaseNotificationInput {
  permanent: true;
}

interface TemporaryNotificationInput extends BaseNotificationInput {
  permanent?: false;
  duration?: number;
  showDurationTimer?: boolean;
}

interface UserTypeSerialized {
  id: string;
  name: string;
  organizationID: string;
  extension?: string;
  externalID?: string;
}

interface CustomProperty {
  key: string;
  value: string;
}

type Fact = {
  id: string;
  value: string | boolean;
};
```

---

## Methods (`callMethod`)

### Auth

#### `/app/getCurrentUserToken`

Returns the token of the currently logged-in user.

```typescript
// params: none

// result:
{
  userToken: string | undefined;
}
```

#### `/app/getCurrentUser`

Returns the current authenticated user.

```typescript
// params: none

// result: UserTypeSerialized | undefined
{
  id: string;
  name: string;
  organizationID: string;
  extension?: string;
  externalID?: string;
}
```

#### `/app/logout`

Logs out the current user.

```typescript
// params: none
// result: void
```

#### `/app/signInWithToken`

Determines the owner of a token and signs them in.

```typescript
// params:
{
  token: string;
  options?: {
    rememberUser?: boolean;
  };
}

// result: void
```

---

### Navigation

#### `/router/push`

Changes the app route by adding an entry to history.

```typescript
// params:
{
  path: string;
}

// result: void
```

#### `/router/replace`

Changes the app route without adding to history.

```typescript
// params:
{
  path: string;
}

// result: void
```

#### `/app/changeApp`

Switches the active app/module.

```typescript
// params:
{
  app: 'triage' | 'review' | 'editor';
}

// result: void
```

---

### Configuration / Backend

#### `/app/getApiHost`

Returns the current API host.

```typescript
// params: none

// result:
{
  apiHost?: string;
}
```

#### `/app/changeApiHost`

Changes the host of the main backend API server.

```typescript
// params:
{
  apiHost: string;
}

// result: void
```

#### `/backendproxy/cases/ensureCaseCustomProperties`

Merges provided custom properties with existing ones of a case.

```typescript
// params:
{
  caseID: string;
  customProperties: Record<string, string>;
}

// result: boolean
```

---

### Notifications

#### `/app/showNotification`

Shows a UI notification. Returns a notification ID.

```typescript
// params: ShowNotificationInput
{
  message: string;
  id?: string;
  detailText?: string;
  type?: 'info' | 'error' | 'success' | 'warning';
  closable?: boolean;
  permanent?: boolean;
  // if permanent is false/omitted:
  duration?: number;
  showDurationTimer?: boolean;
}

// result:
{
  notificationID: string;
}
```

#### `/app/closeNotification`

Closes a notification.

```typescript
// params:
{
  notificationID: string;
}

// result: void
```

---

### Realtime

#### `/realtime/activeSessions`

Returns all active/ongoing sessions.

```typescript
// params: none

// result:
{
  activeSessions: Session[];
}
```

#### `/realtime/enterSession`

Enters the view of an existing session.

```typescript
// params:
{
  sessionID: string;
}

// result: void
```

#### `/realtime/startSession`

Starts a new session. If `externalID` matches an active session, it refocuses instead of creating new.

```typescript
// params:
{
  externalID?: string;
  startTime?: string;   // ISO 8601, syncs start time to account for network delay
  caseID?: string;       // attaches session to an existing case; creates new case if omitted
}

// result:
{
  session: {
    id: string;
    externalID?: string;
  };
}
```

#### `/realtime/leaveSession`

Leaves the current session view.

```typescript
// params:
{
  sessionID: string;
}

// result: void
```

---

### Triage Session

#### `/realtime/session/setFactValues`

Sets fact values on the currently active triage session. Only updates provided facts; existing unprovided facts are unchanged.

```typescript
// params:
{
  sessionID: string;
  facts: Fact[];
}

// result: void
```

#### `/realtime/session/getFactValues`

Gets values of all facts in the triage session. Only facts with values set are returned.

```typescript
// params:
{
  sessionID: string;
}

// result: Fact[]
{
  id: string;
  value: string | boolean;
}[]
```

---

### Window (launcher-side)

#### `/window/hideAll`

Hides the app window(s).

```typescript
// params: none
// result: void
```

#### `/window/unhideAllAndFocus`

Unhides all windows and focuses the app.

```typescript
// params: none
// result: void
```

---

## Events (`subscribeAll`)

All events are emitted via `fireEvent` and received by `subscribeAll` callbacks as `{ name, data }`. Realtime events are only fired for the current session owner.

---

### `app.login`

Fired when the auth store has loaded (user is logged in / auth state initialized).

```typescript
{
  name: 'app.login';
  data: void;
}
```

### `app.logout`

Fired when the current user logs out.

```typescript
{
  name: 'app.logout';
  data: void;
}
```

### `shell.quit`

Fired when the Electron application is quitting.

```typescript
{
  name: 'shell.quit';
  data: void;
}
```

### `realtime.session-opened`

Fired when a triage session view is opened by the current user.

```typescript
{
  name: 'realtime.session-opened';
  data: {
    session: Session;
  };
}
```

### `realtime.session-closed`

Fired when a triage session view is closed by the current user.

```typescript
{
  name: 'realtime.session-closed';
  data: {
    session: Session;
  };
}
```

### `realtime.session.case-id-changed`

Fired when the session's `caseID` changes (becomes non-null and differs from previous).

```typescript
{
  name: 'realtime.session.case-id-changed';
  data: {
    session: Session;
  };
}
```

### `realtime.session.comments.comment-created`

Fired when a comment is created by the current user in a triage session.

```typescript
{
  name: 'realtime.session.comments.comment-created';
  data: {
    session: Session;
    comment: {
      text: string;
      createdBy: {
        id: string;
      };
    };
  };
}
```

### `realtime.session.triage-flow.action-block-triggered`

Fired when an action block is triggered in the triage flow.

```typescript
{
  name: 'realtime.session.triage-flow.action-block-triggered';
  data: {
    session: Session;
    nodeID?: string;
    blockInstance?: {
      id: string;
      customProperties: CustomProperty[];
    };
    blockPrototype: {
      id: string;
      content: string;
      name: string;
      customProperties: CustomProperty[];
    };
  };
}
```

### `realtime.session.triage-flow.grouped-flow-value-collector-blocks-updated`

Fired when grouped flow value collector blocks are updated. Auto-emission is suppressed if any collector has `requireExplicitSendToLocalhostApi=true` custom property; in that case it must be explicitly emitted via `emitGroupedCollectorBlocksToLocalhost`.

```typescript
{
  name: 'realtime.session.triage-flow.grouped-flow-value-collector-blocks-updated';
  data: {
    session: Session;
    group: FlowValueCollectorPayload[];
  };
}

interface FlowValueCollectorPayload {
  displayValues: Array<{
    text: string;
  }>;
  blockPrototype: {
    id: string;
    name: string;
    customProperties: CustomProperty[];
  };
  customValues: Array<{
    value: string;
  }>;
  collectedFactValues: Fact[];
  collectedBlockValues: {
    blockPrototypes: Array<{
      id: string;
      label: string;
      customProperties: CustomProperty[];
    }>;
    values: Array<{
      blockPrototypeID: string;
      value?: string;
      text: string;
      customProperties?: CustomProperty[];
    }>;
  };
}
```

---

## Type Definitions Source Files

| Domain | Type definitions | Implementation |
|---|---|---|
| Auth | `src/core/auth/auth.publicapi.ts` | `src/core/auth/auth.publicapi.impl.ts` |
| Navigation | `src/browser/navigation.publicapi.ts` | `src/browser/navigation.ts` |
| Config | `src/core/configuration/browser/config.publicapi.ts` | `src/core/configuration/browser/initConfig.ts` |
| Remote request | `src/browser/stores/remoterequest.publicapi.ts` | `src/browser/stores/remoterequest.publicapi.impl.ts` |
| Notifications | `src/browser/stores/notifications.publicapi.ts` | `src/browser/stores/notifications.publicapi.impl.ts` |
| Backend proxy | `src/browser/backendproxy.publicapi.ts` | `src/browser/backendproxy.publicapi.impl.ts` |
| Realtime | `src/modules/RealTimeApp/publicapi/realtime.publicapi.ts` | `src/modules/RealTimeApp/publicapi/RealTimePublicApi.ts` |
| Triage session | `src/modules/RealTimeApp/publicapi/triageSession.publicapi.ts` | `src/modules/RealTimeApp/publicapi/TriageSessionPublicApi.ts` |
| Window/shell | `packages/launcher/src/main/apiv2.publicapi.ts` | `packages/launcher/src/main/apiv2.publicapi.impl.ts` |
| Framework | `src/core/publicapi/shared/framework.ts` | — |
| Shared types | `src/core/api/shared/types.ts` | — |
