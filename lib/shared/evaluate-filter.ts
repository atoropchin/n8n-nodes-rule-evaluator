import { IExecuteFunctions } from "n8n-workflow";

export function evaluateFilterCondition(
  ctx: IExecuteFunctions,
  parameterPath: string,
  itemIndex: number,
): boolean {
  return ctx.getNodeParameter(parameterPath, itemIndex, false, {
    extractValue: true,
  }) as boolean;
}
