/**
 * Tool names the agent may call. Fixed here so the renderer, main, and tests agree.
 * Graph tools map to mutations through shared/commands/tools.ts mutationFromTool.
 * Reading and knowledge tools run in main through main/knowledge and main/proposals repositories.
 */

/** Tools that only read: the graph, the catalog, the models, the check, and the web when allowed. */
export const AGENT_READ_TOOLS = ['getGraph', 'searchNodeTypes', 'describeNodeType', 'findInstalledModels', 'describeModel', 'checkGraph', 'searchWeb', 'fetchPage'] as const;
/** `draftLesson` writes nothing either: its draft waits for the person (src/main/agent/lessonDraftTool.ts). */
export const AGENT_KNOWLEDGE_TOOLS = ['explain', 'draftLesson'] as const;
/** Tools that leave a ghost for the person to accept. */
export const AGENT_PROPOSAL_TOOLS = ['proposeNode', 'proposeConnection', 'proposeParameter', 'proposeSubgraph'] as const;
/** Tools that change the graph at once (build intent). */
export const AGENT_BUILD_TOOLS = ['addNode', 'connectNodes', 'setParameter', 'removeNode', 'createSubgraph', 'insertSubgraph', 'annotateNode', 'setComponentDocumentation', 'setProcess'] as const;

export type AgentReadTool = (typeof AGENT_READ_TOOLS)[number];
export type AgentKnowledgeTool = (typeof AGENT_KNOWLEDGE_TOOLS)[number];
export type AgentProposalTool = (typeof AGENT_PROPOSAL_TOOLS)[number];
export type AgentBuildTool = (typeof AGENT_BUILD_TOOLS)[number];
/** Build tools that take a `why` and show as one step of the live build on the canvas. */
export const BUILD_STEP_TOOLS = ['addNode', 'connectNodes', 'setParameter', 'createSubgraph', 'insertSubgraph', 'removeNode'] as const satisfies readonly AgentBuildTool[];
export type BuildStepTool = (typeof BUILD_STEP_TOOLS)[number];
/** Any tool name the agent may call. */
export type AgentTool = AgentReadTool | AgentKnowledgeTool | AgentProposalTool | AgentBuildTool;
