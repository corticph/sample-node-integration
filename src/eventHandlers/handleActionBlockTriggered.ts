import { cortiCallMethod } from "../services/cortiServices";
import { ActionBlockTriggered } from "../types/events";

const handleActionBlockTriggered = async (data: ActionBlockTriggered) => {
  const { session, blockPrototype, blockInstance } = data;

  // Always log that an action block was triggered — even one carrying no
  // custom properties — so the event is never silent. Real blocks may have an
  // empty `name`, so use `||` to fall through to content / id (never blank).
  const blockLabel =
    blockPrototype?.name ||
    blockPrototype?.content ||
    blockPrototype?.id ||
    "(unknown)";
  console.log(
    `Action block triggered: ${blockLabel} (External Session ID: ${session?.externalID})`
  );

  // Merge customProperties from blockPrototype and blockInstance.
  // In case of a clash, the instance value wins. A block may carry none, so
  // default to an empty list rather than assuming the field is present.
  const customProperties: Record<string, string> = {};

  (blockPrototype?.customProperties ?? []).forEach((item) => {
    customProperties[item.key] = item.value;
  });
  (blockInstance?.customProperties ?? []).forEach((item) => {
    customProperties[item.key] = item.value;
  });

  // convert an object to an array of key value pairs
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
      console.log(`New Typecode: ${fact.id} - ${fact.value} (External Session ID: ${session.externalID})`);
    }
  });
  
  // Patch session with new facts (only when the block carried any).
  if (factUpdateBody.length) {
    cortiCallMethod('/realtime/session/setFactValues', {
      sessionID: session.id,
      facts: factUpdateBody,
    });
  }

  // Returned for testability; the controller ignores the return value.
  return factUpdateBody;
};

export default handleActionBlockTriggered;
