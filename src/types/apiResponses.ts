import { Fact, Session, UserTypeSerialized } from "./shared";

// ── Desktop app callMethod result types (1:1 with DESKTOP_APP_API.md) ──

// Result of /realtime/activeSessions
export interface ActiveSessionsResponse {
  activeSessions: Session[];
}

// Result of /app/getCurrentUser
export type CurrentUserResponse = UserTypeSerialized;

/**
 * Result of /realtime/startSession.
 *
 * If externalID matches an active session, the desktop app refocuses the
 * existing session instead of creating a new one.
 */
export interface StartSessionResponse {
  session: {
    id: string;
    externalID?: string;
  };
}

/**
 * Facts supplied by the CAD on /openCortiSession.
 *
 * The CAD sends `{ factValues: [...] }`. The desktop app's
 * `/realtime/session/setFactValues` RPC expects `{ sessionID, facts: Fact[] }`,
 * so the `factValues` array is forwarded as `facts` (see enterSessionAndOpenWindow).
 */
export interface FactUpdatePayload {
  factValues: Fact[];
}

// ── Corti REST API types (separate public REST API, not the desktop app) ──

export interface CallsResponse {
  continuation_token: number | null;
  data: Call[];
}

export interface Call {
  id: string;
  case_id: string;
  active: boolean;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  calling_party: string;
}

export interface DBSessionsResponse {
  data: DBSession | null;
}

export interface DBSession {
  id: string;
  user_id: string;
  owner_user_id: string;
  case_id: string;
  external_id: string | null;
  started_at: string;
  call_id: string | null;
}
