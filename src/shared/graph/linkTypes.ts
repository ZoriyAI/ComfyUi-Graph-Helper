/**
 * ComfyUI_frontend LiteGraph.isValidConnection, output type then input type.
 * src/lib/litegraph/src/LiteGraphGlobal.ts @98700cfc
 * Called as LiteGraph.isValidConnection(output.type, input.type) from
 * LGraphNode.connectSlots @07d5bd50.
 * '' and '*' match any type. A comma-separated list matches when any pair matches.
 * The comparison is case-insensitive. EVENT and ACTION are both -1 in that file.
 */
const EVENT = -1;
const ACTION = -1;

export function portsCompatible(outputType: string, inputType: string): boolean {
  return isValidConnection(outputType, inputType);
}

function isValidConnection(typeA: string | number, typeB: string | number): boolean {
  let outputType: string | number = typeA;
  let inputType: string | number = typeB;
  if (outputType == '' || outputType === '*') outputType = 0;
  if (inputType == '' || inputType === '*') inputType = 0;
  if (!outputType || !inputType || outputType == inputType || (outputType == EVENT && inputType == ACTION)) return true;
  const outputName = String(outputType).toLowerCase();
  const inputName = String(inputType).toLowerCase();
  if (!outputName.includes(',') && !inputName.includes(',')) return outputName == inputName;
  for (const outputPart of outputName.split(',')) {
    for (const inputPart of inputName.split(',')) {
      if (isValidConnection(outputPart, inputPart)) return true;
    }
  }
  return false;
}
