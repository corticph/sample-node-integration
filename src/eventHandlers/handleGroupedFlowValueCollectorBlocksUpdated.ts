import { GroupedFlowValueCollectorBlocksUpdated } from "../types/events";
import { CustomProperty } from "../types/shared";

interface ISelectUpdates {
  blockPrototypeId: string;
  value?: string;
  text: string;
  customProperties: CustomProperty[];
}

const handleGroupedFlowValueCollectorBlocksUpdated = async (
  data: GroupedFlowValueCollectorBlocksUpdated
) => {
  const { group, session } = data;

  const selectUpdates: ISelectUpdates[] = []

  group.forEach((block) => {
    if (block.displayValues.length === 0) {
      console.log(`New Collector: ${block.blockPrototype.name} - (no values) (External Session ID: ${session.externalID})`);
      return;
    }
    const textString = block.displayValues.map((obj) => obj.text).join(" | ");

    const { values, blockPrototypes } = block.collectedBlockValues;
    
    values.forEach((collectedBlockValue) => {
      const blockPrototype = blockPrototypes.find(
        (bp) => bp.id === collectedBlockValue.blockPrototypeID
      );
      // Skip values we can't tie back to a prototype, otherwise they would
      // collapse under a single `undefined` key during dedupe below.
      if (!blockPrototype) return;

      // Spread first so the prototype-level fields below always win.
      selectUpdates.push({
        ...collectedBlockValue,
        blockPrototypeId: blockPrototype.id,
        customProperties: blockPrototype.customProperties || [],
      });
    })
    // TODO: update your application with the concatenated string value for each collector
    console.log(
      `New Collector: ${block.blockPrototype.name} - ${textString} (External Session ID: ${session.externalID})`
    );
  });

  // make selectUpdates unique by blockPrototype.id
  const uniqueSelectUpdates = Array.from(
    new Map(selectUpdates.map((item) => [item.blockPrototypeId, item])).values()
  ).filter((item => item.customProperties && item.customProperties.length > 0));

  // TODO: update your application with the collected custom properties per block
  uniqueSelectUpdates.forEach((update) => {
    console.log(
      `Collector custom properties: ${update.text} (External Session ID: ${session.externalID})`,
      update.customProperties
    );
  });

  // Returned for testability; the controller ignores the return value.
  return uniqueSelectUpdates;
};

export default handleGroupedFlowValueCollectorBlocksUpdated;
