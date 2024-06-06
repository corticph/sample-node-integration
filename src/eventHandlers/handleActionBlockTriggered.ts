import { cortiCallMethod } from "../services/cortiServices";
import { ActionBlockTriggered } from "../types/events";

const handleActionBlockTriggered = async (data: ActionBlockTriggered) => {
  let { session, blockPrototype, blockInstance } = data;

  // merge key/value pair objects in customProperties of blockPrototype and blockInstance.
  // In case of clash, choose the instance value.
  let customProperties: Record<string, string> = {};

  blockPrototype.customProperties.forEach((item, i) => {
    customProperties[item.key] = item.value;
  });
  blockInstance?.customProperties.forEach((item, i) => {
    customProperties[item.key] = item.value;
  });

  // convert an object to an array of key value pairs
  // https://stackoverflow.com/questions/43118692/typescript-convert-object-to-array-of-key-value-pairs
  const factUpdateBody = Object.entries(customProperties).reduce(
    (acc, [key, value]) => {
      acc.push({ id: key, value: value });
      return acc;
    },
    [] as { id: string; value: string | boolean }[]
  );

  // TODO: Set typecode and subtypecode in CAD
  factUpdateBody.forEach((fact) => {
    if(fact.value){
      console.log(session.id)
      console.log(`New Typecode: ${fact.id} - ${fact.value} (Session ID: ${session.externalID})`);
    }
  });
  
  // Patch session with new facts
  cortiCallMethod('/realtime/session/setFactValues', {
    sessionID: session.id,
    facts: factUpdateBody
  })
};

export default handleActionBlockTriggered;
