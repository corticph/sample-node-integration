import { updateCaseCustomProperties } from "../services/cortiServices";
import { SessionCaseIDChanged } from "../types/events";

const handleSessionCaseIDChanged = async (data: SessionCaseIDChanged) => {
  const { session } = data;
  if (session.caseID) {
    console.log(`Case ID changed: ${session.caseID} (External Session ID: ${session.externalID})`);
    // fetch custom properties for the case, either from the CAD or in memory
    const customProperties = {
        "telephone": "1234567890",
        "location": "34 Elm St, Springfield, IL"
    }
    await updateCaseCustomProperties(session.caseID, customProperties);
  }
};

export default handleSessionCaseIDChanged;
