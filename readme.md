# Corti Triage Sample Integration Application (Node.js)

This repository contains a sample integration for the Corti Triaging application in Node.js. The integration demonstrates various functionalities such as handling session opening, action block triggering, comment creation, flow value collector updates, and session leaving.

## Installation
To run this integration locally, please follow these steps:

1. Clone this repository to your local machine.
2. Install Node.js (version 18.0.0 or higher) if not already installed.
3. Navigate to the cloned repository directory in your terminal.
4. Run `npm install` to install the required dependencies.

## Configuration
Before running the integration, you need to configure the following settings in the .env file:

- `PORT`: This variable specifies the port on which the integration server will listen for incoming requests. The default value is 45002.
- `CLIENTHOST`: This variable defines the host URL of the client application that interacts with the Corti Triaging integration. It is the URL where the client application is running, and the integration needs to communicate with it. The default value is http://localhost:45001.
- `API_KEY_{{ENV_ID}}`: This variable represents the API key used to authenticate requests to the Corti Triaging application. Each environment you use requires its own entry, adhereing to the same format. Note the enivornment ID should be in all-caps.

### Example .env File
```
PORT=5173
CLIENTHOST=http://localhost:3000
API_KEY_ENGAGESTAGING=xxxxxx
API_KEY_OTHERENV=yyyyyyy
```

## Usage
Start the integration by running node index.js in your terminal.
The server will start listening for incoming events from the Corti Triaging application.

### Starting a Session
When a session needs to be opened, send a POST request to `/openCortiSession` with the required payload. The full explanation of the workflow of opening a session is explained here:

#### Payload
The payload should be an object with the following properties:

- `externalID`: A string representing an identifier for the session.
- `factValues` (optional): An array of objects representing initial fact values for the session. Each object within the factValues array should have the following properties:
  - `id` (string): The identifier of the fact.
  - `value` (string): The initial value for the fact.

```
POST /openCortiSession HTTP/1.1
Content-Type: application/json

{
  "externalID": "T52661002",
  "factValues": [
    {
      "id": "address.sss",
      "value": "string"
    },
    {
      "id": "string",
      "value": "string"
    },
    ...
  ]
}

```
### Leaving a Session:
The integration listens for the event when a session is left or closed.

## Event Handlers
The example integration handles three of the most common events that the application emits. Rather than integrating with a third party application, we have just decided to console log the event output.

### Action Block Triggered:
The integration handles the event when an action block is triggered. It extracts custom properties and updates the corresponding session's facts.

### Comment Created:
When a new comment is created in a session, it is logged with the associated session ID.

### Grouped Flow Value Collector Blocks Updated:
This event logs updates to grouped flow value collectors such as reports and demographics.


## Contact
For any queries or suggestions regarding this integration, please contact [your email address].

We hope this sample integration helps you get started with integrating