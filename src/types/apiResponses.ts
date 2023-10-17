export interface Session {
  id: string;
  caseID?: string;
  externalID?: string;
  owner?: {
    id: string;
    name: string;
  };
}

export interface ActiveSessionsResponse {
  activeSessions: Session[];
}

export interface CurrentUserResponse {
  id: string;
  name: string;
  organizationID: string;
  extension?: string;
  externalID?: string;
}

/**
 * Starts new session.
 *
 * If external ID is provided and matches current session that is active
 * it will not create a new session, but will bring the existing one into focus
 */
export interface StartSessionResponse {
  session: {
    id: string;
    externalID?: string;
  };
}


export interface CallsResponse{
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