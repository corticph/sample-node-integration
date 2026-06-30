// Import the event handlers you have (Assuming they also exist in `controllers` directory)
import { Request, Response } from 'express';
import * as eventHandlers from '../eventHandlers'

// single function to handle all types of events
export const handleEvent = async (req: Request, res: Response) => {
  let event = req.body;
  let data = event.data;
  switch (event.name) {
    case 'realtime.session.triage-flow.action-block-triggered':
        eventHandlers.handleActionBlockTriggered(data);
      break;
    case 'realtime.session.comments.comment-created':
        eventHandlers.handleCommentCreated(data);
      break;
    case 'realtime.session.triage-flow.grouped-flow-value-collector-blocks-updated':
        eventHandlers.handleGroupedFlowValueCollectorBlocksUpdated(data);
      break;
    case 'realtime.session.case-id-changed':
        eventHandlers.handleSessionCaseIDChanged(data);
      break;
    case 'realtime.session-opened':
      console.log(`Event: ${event.name} (Session ID: ${data?.session?.id ?? 'N/A'}, External ID: ${data?.session?.externalID ?? 'N/A'})`);
      break;
    case 'realtime.session-closed':
      console.log(`Event: ${event.name} (Session ID: ${data?.session?.id ?? 'N/A'}, External ID: ${data?.session?.externalID ?? 'N/A'})`);
      break;
    case 'app.logout':
    case 'app.login':
      console.log(`Event: ${event.name}`);
      break;
    default:
      // Avoid logging the full payload — event data can contain session facts
      // and other PII. Log only the name and identifiers.
      console.log(`Unhandled event: ${event.name} (Session ID: ${data?.session?.id ?? 'N/A'}, External ID: ${data?.session?.externalID ?? 'N/A'})`);
      break;
  }
  res.sendStatus(200);
}
