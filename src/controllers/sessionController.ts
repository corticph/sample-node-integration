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
  FactUpdatePayload,
  StartSessionResponse,
} from "../types/apiResponses";

interface OpenSessionParams {
  externalId: string;
  facts?: FactUpdatePayload;
}

export const openSession = async (req: Request, res: Response) => {
  const data = req.body.data as OpenSessionParams;
  if (!data || !data.externalId) {
    return res.status(400).send({ message: "Missing externalId" });
  }
  const { externalId } = data;

  try {
    // Be defensive: the desktop app may return an unexpected shape (e.g. while
    // shutting down), so default to an empty list rather than crashing.
    const activeSessionsResult = (await cortiCallMethod(
      "/realtime/activeSessions"
    )) as ActiveSessionsResponse | undefined;
    const activeSessions = activeSessionsResult?.activeSessions ?? [];

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
      enterSessionAndOpenWindow(sessionFromDb.id, data?.facts);
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

    enterSessionAndOpenWindow(newSession.session.id, data?.facts);

    return res
      .status(200)
      .send({ message: "Session New", sessionId: newSession.session.id });
  } catch (error) {
    // A thrown error here (e.g. desktop app unreachable) would otherwise become
    // an unhandled rejection and crash the whole process.
    console.error("openSession failed:", error);
    return res
      .status(502)
      .send({ message: "Failed to reach the Corti desktop app" });
  }
};

export const leaveSession = async (req: Request, res: Response) => {
  // The desktop app's /realtime/leaveSession takes the sessionID to leave.
  // The CAD stored it from /openCortiSession; forward it when provided.
  const sessionId = req.body?.sessionId as string | undefined;
  const params = sessionId ? { sessionID: sessionId } : undefined;
  try {
    await cortiCallMethod("/realtime/leaveSession", params);
    res.sendStatus(200);
  } catch (error) {
    console.error("leaveSession failed:", error);
    res.sendStatus(502);
  }
};
