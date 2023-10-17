export interface CommentCreated {
  session: Session;
  comment: {
    text: string;
    createdBy: {
      id: string;
    };
  };
}

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

export interface GroupedFlowValueCollectorBlocksUpdated {
  session: Session;
  group: FlowValueCollectorPayload[];
}

interface FlowValueCollectorPayload {
  /**
   * Display Values: Ordered and formatted (custom format evaluated) collector values as they are displayed in the UI
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
  collectedFactValues: Array<{
    factID: string;
    value: string;
  }>;
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

interface CustomProperty {
  key: string;
  value: string;
}

interface Session {
  id: string;
  caseID?: string;
  externalID?: string;
  owner?: {
    id: string;
    name: string;
  };
}
