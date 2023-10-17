import { Call, CallsResponse, DBSession, DBSessionsResponse } from "../types/apiResponses";
import { getApiHost, getApiKey } from "../utils/utils";
const clientHost = process.env.clientHost;

interface IParams {
  [key: string]: any;
}

interface IFactUpdate {
  id: string;
  value: string;
}

export const cortiCallMethod = async (method: string, params?: IParams) => {
    const body = JSON.stringify({ method, params });
  
    var requestOptions = {
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
      body: body,
    };
  
    try {
        const response = await fetch(`${clientHost}/callMethod`, requestOptions);
        const result = await response.json() as { result: unknown };
        return result.result;
    } catch (error) {
        console.log("error", error);
        throw error; // Optionally rethrow the error for better error handling
    }
  };
  

export const updateFactValues = async (
  sessionId: string,
  factUpdateBody: IFactUpdate[]
) => {
  const apiHost = await getApiHost();
  const apiKey = getApiKey(apiHost);
  if (!apiKey) return console.error(`No API key found for ${apiHost}`);

  fetch(
    `${apiHost}/public/api/v2.0/triage-sessions/${sessionId}/flow-fact-values?&timeout=5`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(factUpdateBody),
    }
  );
};

export const checkSessionExists = async (externalSessionId: string): Promise<DBSession | null> => {
  const apiHost = await getApiHost();
  const apiKey = getApiKey(apiHost);
  if (!apiKey) {
    console.error(`No API key found for ${apiHost}`);
    return null;
}

  return fetch(
    `${apiHost}/public/api/v2.0/triage-sessions/by-external-id/${externalSessionId}`,
    {
      headers: {
        "x-api-key": apiKey,
      },
    }
  )
    .then((response) => response.json() as Promise<DBSessionsResponse>)
    .then((result) => result.data || null)
    .catch(() => {
        return null;
    });
};


export const getMatchingCalls = async (window = 60): Promise<Call[]> => {
  
    const apiHost = await getApiHost();
    const apiKey = getApiKey(apiHost);
    if (!apiKey) {
        console.error(`No API key found for ${apiHost}`);
        return []
    }

    // get current datetime and look back 60 seconds
    const now = new Date();
    const started_before = now.toISOString();
    const started_from = new Date(now.getTime() - Number(window) * 1000).toISOString();
  
    
    return fetch(
        `${apiHost}/public/api/v2.0/calls?started_from=${started_from}&started_before=${started_before}`,
        {
        headers: {
            'x-api-key': apiKey
        }
    }
    )
    .then((response) => response.json() as Promise<CallsResponse>)
    .then((result) => result.data || [])
    .catch((error) => {
        console.log('error', error);
        return [];
    });
  };