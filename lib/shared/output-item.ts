import { INodeExecutionData } from "n8n-workflow";

interface IOutputItemOptions {
  item: INodeExecutionData;
  itemIndex: number;
  outputFieldName: string;
  decision: string | string[];
  matchedCase?: {
    index: number;
    name?: string;
  };
  matchedCases?: Array<{
    index: number;
    name?: string;
    decision: string;
  }>;
}

export function createOutputItem(
  options: IOutputItemOptions,
): INodeExecutionData {
  const {
    item,
    itemIndex,
    outputFieldName,
    decision,
    matchedCase,
    matchedCases,
  } = options;

  const outputItem: INodeExecutionData = {
    json: {
      ...item.json,
      [outputFieldName]: decision,
    },
    pairedItem: {
      item: itemIndex,
    },
  };

  if (matchedCase) {
    outputItem.json.matched_case = matchedCase;
  }

  if (matchedCases) {
    outputItem.json.matched_cases = matchedCases;
  }

  if (item.binary !== undefined) {
    outputItem.binary = item.binary;
  }

  return outputItem;
}

interface IFailedOutputItemOptions {
  item: INodeExecutionData;
  itemIndex: number;
  outputFieldName: string;
  errorMessage: string;
}

export function createFailedOutputItem(
  options: IFailedOutputItemOptions,
): INodeExecutionData {
  const { item, itemIndex, outputFieldName, errorMessage } = options;

  const failedItem: INodeExecutionData = {
    json: {
      ...item.json,
      [outputFieldName]: "error",
      error: errorMessage,
    },
    pairedItem: {
      item: itemIndex,
    },
  };

  if (item.binary !== undefined) {
    failedItem.binary = item.binary;
  }

  return failedItem;
}
