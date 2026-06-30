import { CustomProperty, Fact, Session } from "./shared";

// Event payload types — the `data` field of each `{ name, data }` envelope.
// Kept 1:1 with the Events section of DESKTOP_APP_API.md.

// realtime.session.comments.comment-created
export interface CommentCreated {
  session: Session;
  comment: {
    text: string;
    createdBy: {
      id: string;
    };
  };
}

// realtime.session.triage-flow.action-block-triggered
export interface ActionBlockTriggered {
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
}

// realtime.session.case-id-changed
export interface SessionCaseIDChanged {
  session: Session;
}

// realtime.session-opened / realtime.session-closed
export interface SessionOpenedOrClosed {
  session: Session;
}

// realtime.session.triage-flow.grouped-flow-value-collector-blocks-updated
export interface GroupedFlowValueCollectorBlocksUpdated {
  session: Session;
  group: FlowValueCollectorPayload[];
}

export interface FlowValueCollectorPayload {
  /**
   * Display Values: Ordered and formatted (custom format evaluated) collector
   * values as they are displayed in the UI.
   */
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
