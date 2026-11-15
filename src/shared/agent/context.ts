/**
 * The graph context of the renderer's own chat path (renderer/services/llm/chatService.ts): the instructions and
 * a one-line-per-node list it sends as the system message. Main builds a richer prompt for the agent turn
 * (main/agent/prompt.ts) and puts it in this message's place.
 */
/** One line, single spaces: a title or note must not break the one-line-per-node list. */
function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** What the list is made from: the nodes, their documentation records and the process title and notes. */
export interface AgentGraphContext {
  nodes: Array<{ id: string; data?: { comfyType?: string; title?: string } }>;
  components: Array<{ ownerKind: string; ownerId: string; purpose: string; usage: string }>;
  process: { title: string; notes: string };
}

/**
 * Instructions and the current graph for the built-in agent, as the renderer's system message. The main process
 * replaces it with its own prompt (main/agent/prompt.ts); it lists every node, whole, without a cap.
 * Widget values are omitted so a secret typed into a field is not copied into the prompt.
 */
export function agentGraphContext(input: AgentGraphContext): string {
  const listed = input.nodes.map((node) => {
    const record = input.components.find((item) => item.ownerKind === 'node' && item.ownerId === node.id);
    const type = node.data?.comfyType || 'unknown';
    const title = clean(node.data?.title || '');
    const purpose = clean(record?.purpose || '');
    const usage = clean(record?.usage || '');
    return `${node.id} type=${type} title=${title} purpose=${purpose} usage=${usage}`;
  });
  return [
    'You help build one shared process graph. Use addNode for a new step, setComponentDocumentation for an existing node id, and setProcess for the process title and notes. Explain what you changed and what each component is for. Do not claim the workflow ran in ComfyUI. The user exports it and runs it there.',
    `Process title: ${clean(input.process.title)}`,
    `Process notes: ${clean(input.process.notes)}`,
    listed.length > 0 ? listed.join('\n') : 'The graph has no nodes.',
  ].filter((line) => line !== '').join('\n');
}
