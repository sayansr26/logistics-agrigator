const ADAPTER_MAP = {
  DELHIVERY: require("./DelhiveryAdapter"),
  BLUEDART: require("./BlueDartAdapter"),
};

function createAdapter(channelConfig) {
  const { aggregatorType } = channelConfig;

  if (aggregatorType === "NONE") {
    return null;
  }

  const AdapterClass = ADAPTER_MAP[aggregatorType];

  if (!AdapterClass) {
    throw new Error(`No adapter found for aggregator type: ${aggregatorType}`);
  }

  return new AdapterClass(channelConfig);
}

function getSupportedAggregators() {
  return Object.keys(ADAPTER_MAP);
}

module.exports = { createAdapter, getSupportedAggregators };
