import dotenv from 'dotenv';
import { cortiCallMethod } from '../services/cortiServices';

// load the .env file
dotenv.config();

export const getApiKey = (apiHost: string) => {
    // format the API host to match the naming convention in the .env file 

    // convert format https://api.ENVIRONMENTID.motocorti.io to ENVIRONMENTID in a single line
    const environmentID = apiHost.replace(/https:\/\/api\.(.*?)\.motocorti\.io/, '$1').toLocaleUpperCase();

    const envVariableName = `API_KEY_${environmentID}`;
    
    // get and return the matching API key from the environment variables
    return process.env[envVariableName];
}

export const getApiHost = async () => {
        const response = await cortiCallMethod('/app/getApiHost');
        return (response as { apiHost: string }).apiHost;
};

export const enterSessionAndOpenWindow = async (sessionID: string) => {
    console.log(`Entering Session: ${sessionID}`);
    cortiCallMethod('/realtime/enterSession', {
      sessionID
    }).then(() =>
      fetch(`http://localhost:45001/window/unhideAllAndFocus`, {
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'POST'
      })
    );
  };