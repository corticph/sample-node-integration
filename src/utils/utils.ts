import dotenv from "dotenv";
import { cortiCallMethod } from "../services/cortiServices";
import { FactUpdatePayload } from "../types/apiResponses";

// load the .env file
dotenv.config();

// The API key for the Corti environment this integration serves.
// Each customer has their own environment (see README "Environments"), so a
// single integration instance only ever needs one key.
export const getApiKey = () => process.env.API_KEY;

export const getApiHost = async () => {
  const response = await cortiCallMethod("/app/getApiHost");
  return (response as { apiHost: string }).apiHost;
};

export const enterSessionAndOpenWindow = async (
  sessionID: string,
  facts?: FactUpdatePayload
) => {
  console.log(`Entering Session: ${sessionID}`);
  cortiCallMethod("/realtime/enterSession", {
    sessionID,
  }).then(() => {
    cortiCallMethod("/window/unhideAllAndFocus");
    // The CAD sends facts as `{ factValues: [...] }`, but the desktop app's
    // setFactValues RPC expects `{ sessionID, facts: [...] }`. Forward accordingly.
    if (facts?.factValues?.length) {
      cortiCallMethod("/realtime/session/setFactValues", {
        sessionID,
        facts: facts.factValues,
      });
    }
  });
};
