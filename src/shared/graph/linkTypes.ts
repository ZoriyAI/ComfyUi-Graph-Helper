/**
 * ComfyUI_frontend LiteGraph.isValidConnection, output type then input type.
 * src/lib/litegraph/src/LiteGraphGlobal.ts @98700cfc
 * Called as LiteGraph.isValidConnection(output.type, input.type) from
 * LGraphNode.connectSlots @07d5bd50.
 * Input slot order is separate: litegraphService.addInputs / addInputSocket /
 * addInputWidget @98700cfc place every socket before every widget.
 * '' and '*' match any type. A comma-separated list matches when any pair matches.
 * The comparison is case-insensitive. EVENT and ACTION are both -1 in that file.
 * The canvas (CanvasFlow.tsx, connectAssist.ts, AddNodeSearch.tsx) and main (commit, edit and graph ops, the graph
 * check, the node search) use it, so a link the app allows is one ComfyUI also accepts.
 */
const EVENT = -1;
const ACTION = -1;

/** True when a link from an output of `outputType` to an input of `inputType` is valid in ComfyUI. */
export function portsCompatible(outputType: string, inputType: string): boolean {
  return isValidConnection(outputType, inputType);
}

// A line-by-line copy of the frontend's function, loose `==` included, so edge cases behave the same.
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
