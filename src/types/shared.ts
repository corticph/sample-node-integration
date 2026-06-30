// Shared types — kept 1:1 with the desktop app public API "Shared Types".
// See DESKTOP_APP_API.md. Only the types this integration actually uses are
// mirrored here; notification/router/etc. types are intentionally omitted.

export interface Session {
  id: string;
  caseID?: string;
  externalID?: string;
  owner?: {
    id: string;
    name: string;
  };
}

export interface CustomProperty {
  key: string;
  value: string;
}

export type Fact = {
  id: string;
  value: string | boolean;
};

export interface UserTypeSerialized {
  id: string;
  name: string;
  organizationID: string;
  extension?: string;
  externalID?: string;
}
