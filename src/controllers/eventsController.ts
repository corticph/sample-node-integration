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
    case 'realtime.session-opened':
    case 'realtime.session-closed':
    case 'app.logout':
    case 'app.login':
    default:
    //   console.log(data);
      break;
  }
  res.sendStatus(200);
}
