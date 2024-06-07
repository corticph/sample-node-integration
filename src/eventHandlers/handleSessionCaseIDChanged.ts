import { updateCaseCustomProperties } from "../services/cortiServices";
import { Session } from "../types/events";

interface SessionCaseIDChangedBody {
    session: Session;
}

const handleSessionCaseIDChanged = async (data: SessionCaseIDChangedBody) => {
  const { session } = data;
  if (session.caseID) {
    // fetch custom properties for the case, either from the CAD or in memory
    const customProperties = {
        "telephone": "1234567890",
        "location": "34 Elm St, Springfield, IL"
    }
    await updateCaseCustomProperties(session.caseID, customProperties);
  }
};

export default handleSessionCaseIDChanged;
