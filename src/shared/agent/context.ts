const NODE_CAP = 40;
const TEXT_CAP = 240;

function clip(value: string): string {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed.length > TEXT_CAP ? `${trimmed.slice(0, TEXT_CAP)}…` : trimmed;
}

export interface AgentGraphContext {
  nodes: Array<{ id: string; data?: { comfyType?: string; title?: string } }>;
  components: Array<{ ownerKind: string; ownerId: string; purpose: string; usage: string }>;
  process: { title: string; notes: string };
}

/**
 * Instructions and the current graph for the built-in agent.
 * Widget values are omitted so a secret typed into a field is not copied into the prompt.
 */
export function agentGraphContext(input: AgentGraphContext): string {
  const listed = input.nodes.slice(0, NODE_CAP).map((node) => {
    const record = input.components.find((item) => item.ownerKind === 'node' && item.ownerId === node.id);
    const type = node.data?.comfyType || 'unknown';
    const title = clip(node.data?.title || '');
    const purpose = clip(record?.purpose || '');
    const usage = clip(record?.usage || '');
    return `${node.id} type=${type} title=${title} purpose=${purpose} usage=${usage}`;
  });
  const omitted = Math.max(0, input.nodes.length - NODE_CAP);
  return [
    'You help build one shared process graph. Use addNode for a new step, setComponentDocumentation for an existing node id, and setProcess for the process title and notes. Explain what you changed and what each component is for. Do not claim the workflow ran in ComfyUI. The user exports it and runs it there.',
    `Process title: ${clip(input.process.title)}`,
    `Process notes: ${clip(input.process.notes)}`,
    listed.length > 0 ? listed.join('\n') : 'The graph has no nodes.',
    omitted > 0 ? `${omitted} more nodes are not listed.` : '',
  ].filter((line) => line !== '').join('\n');
}
