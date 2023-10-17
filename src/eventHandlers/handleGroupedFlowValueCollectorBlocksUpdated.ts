import { GroupedFlowValueCollectorBlocksUpdated } from "../types/events";

const handleGroupedFlowValueCollectorBlocksUpdated = async (
  data: GroupedFlowValueCollectorBlocksUpdated
) => {
  const { group, session } = data;
  group.forEach((block) => {
    if (block.displayValues.length === 0) return;
    const textString = block.displayValues.map((obj) => obj.text).join(" | ");

    // TODOL update your application with the concatenated string value for each collector
    console.log(
      `New Collector: ${block.blockPrototype.name} - ${textString} (Session ID: ${session.externalID})`
    );
  });
};

export default handleGroupedFlowValueCollectorBlocksUpdated;
