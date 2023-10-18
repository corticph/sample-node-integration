import { Request, Response } from "express";
import {
  checkSessionExists,
  cortiCallMethod,
  getMatchingCalls,
} from "../services/cortiServices";
import { enterSessionAndOpenWindow } from "../utils/utils";
import {
  ActiveSessionsResponse,
  CurrentUserResponse,
  DBSession,
  StartSessionResponse,
} from "../types/apiResponses";

export const openSession = async (req: Request, res: Response) => {
  let data = req.body;
  const externalId = data.externalID.toString();

  const { activeSessions } =
    ((await cortiCallMethod(
      "/realtime/activeSessions"
    )) as ActiveSessionsResponse) || [];

  const activeSession = activeSessions.find(
    (session) => session.externalID === externalId
  );

  // Check if session is already open
  if (activeSession) {
    enterSessionAndOpenWindow(activeSession.id, data?.facts);
    return res
      .status(200)
      .send({ message: "Session Opened", sessionId: activeSession.id });
  }

  // Check if session already exists in database
  const sessionFromDb = (await checkSessionExists(externalId)) as DBSession;
  if (sessionFromDb) {
    enterSessionAndOpenWindow(sessionFromDb.id);
    return res
      .status(200)
      .send({ message: "Session from Db", sessionId: sessionFromDb.id });
  }

  // Find appropriate call to match
  const calls = await getMatchingCalls();
  // return first call that matches (calls are sorted by start time)
  // Note, you may want to introduce more complex logic here to ensure you are matching
  const currentUser = (await cortiCallMethod(
    "/app/getCurrentUser"
  )) as CurrentUserResponse;
  const matchingCall = calls.find((call) => call.user_id === currentUser.id);

  let newSession: StartSessionResponse;

  if (matchingCall) {
    newSession = (await cortiCallMethod("/realtime/startSession", {
      externalID: externalId,
      caseID: matchingCall.case_id,
    })) as StartSessionResponse;
  } else {
    newSession = (await cortiCallMethod("/realtime/startSession", {
      externalID: externalId,
    })) as StartSessionResponse;
  }

  enterSessionAndOpenWindow(newSession.session.id);

  return res
    .status(200)
    .send({ message: "Session New", sessionId: newSession.session.id });
};

export const leaveSession = async (req: Request, res: Response) => {
  cortiCallMethod("/realtime/enterSession").then(() => res.sendStatus(200));
};
