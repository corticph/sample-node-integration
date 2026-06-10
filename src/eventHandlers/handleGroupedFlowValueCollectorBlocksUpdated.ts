import { GroupedFlowValueCollectorBlocksUpdated, CustomProperty } from "../types/events";

interface ISelectUpdates {
  blockPrototypeId?: string;
  value?: string;
  text: string;
  customProperties?: CustomProperty[];
}

const handleGroupedFlowValueCollectorBlocksUpdated = async (
  data: GroupedFlowValueCollectorBlocksUpdated
) => {
  const { group, session } = data;

  const selectUpdates: ISelectUpdates[] = []

  group.forEach((block) => {
    if (block.displayValues.length === 0) return;
    const textString = block.displayValues.map((obj) => obj.text).join(" | ");

    const { values, blockPrototypes } = block.collectedBlockValues;
    
    values.forEach((collectedBlockValue) => {

      const blockPrototype = blockPrototypes.find(
          (bp) => bp.id === collectedBlockValue.blockPrototypeID
        )

      const newCollectedBlock: ISelectUpdates = {
        blockPrototypeId: blockPrototype?.id,
        customProperties: blockPrototype?.customProperties || [],
        ...collectedBlockValue
      };

      selectUpdates.push(newCollectedBlock)
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
};

export default handleGroupedFlowValueCollectorBlocksUpdated;
