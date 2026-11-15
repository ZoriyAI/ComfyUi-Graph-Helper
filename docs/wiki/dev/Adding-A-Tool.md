[Русский](Adding-A-Tool.ru.md)
[Home](../Home.md) › [For developers](README.md)

# Adding a tool for the assistant

Every file a new tool touches, in order. How a turn uses tools: [How the assistant works](Assistant-Internals.md).

## First decide

- **Does it read or does it change?** A read tool returns data and changes nothing. A tool that changes the graph is
  a build tool and must go through the command engine. A tool that suggests is a proposal tool and writes a draft.
- **Does it need the network?** Then it must respect Settings ▸ Assistant (web search, reading pages) and never reach
  this computer, the local network, ComfyUI or the MCP server. See `src/main/agent/web.ts`.
- **Can it reach ComfyUI?** Only through the read-only gate; a new MCP call needs its schema in
  `src/main/mcp/readOnly.ts`. [Reading ComfyUI](Reading-ComfyUI.md)

## A read, knowledge or proposal tool

1. **The name**: add it to `AGENT_READ_TOOLS`, `AGENT_KNOWLEDGE_TOOLS` or `AGENT_PROPOSAL_TOOLS` in
   `src/shared/contracts/agentTools.ts`.
2. **The spec**: its description and JSON schema in `MAIN_TOOL_SPECS`, `src/main/agent/toolSpecs.ts`. Write the
   description for the model: what it returns, when to call it, limits (pages, sizes).
3. **The code**: a `define(name, zodSchema, run)` entry in `src/main/agent/tools.ts`. Parse the arguments with zod;
   return plain data; redact anything that may hold a key (`src/shared/agent/redact.ts`).
4. **The prompt**: if the model needs to know when to prefer it, one line in `src/main/agent/prompt.ts`; if it is
   one of the few tools a small context window keeps, add it to the compact lists in `src/main/agent/turn.ts`.
5. **The chat**: its label in the catalog of texts, in both languages: `agent.tools.<name>` (the tool card) and
   `chat.quiet.<name>` (the quiet line of readings), in `src/shared/i18n/catalog.ts`.
6. **Tests**: `tests/unit/agent/tools.test.ts` (arguments, result, refusal of a bad argument).

## A build tool

1. **The name**: `AGENT_BUILD_TOOLS` (and `BUILD_STEP_TOOLS` if it is a visible step) in
   `src/shared/contracts/agentTools.ts`.
2. **The spec**: `src/shared/commands/toolSpecs.ts` (shared with the renderer, which draws the step).
3. **The command**: if no payload type does the job, add one to `src/shared/commands/types.ts` and apply it in
   `src/main/commands/commit.ts` / `graphOps.ts` ([The command engine and history](Command-Engine.md)).
4. **The code**: the case in `src/main/agent/buildTools.ts` that turns the call into a `commitCommand` with
   `actor: 'ai'` and the run's id. A conflict or refusal comes back to the model as a failed step, not an exception.
5. **The step in the chat**: `src/renderer/components/chat/buildSteps.ts`, with the texts
   `chat.step.<name>` and `chat.stepFailed.<name>` in both languages.
6. **Tests**: `tests/unit/agent/`, and `tests/integration/chatToGraph.test.ts` for the whole path with the scripted
   model.

## Before the pull request

- `npm test`, `npm run type-check`.
- `xvfb-run -a npx playwright test tests/e2e/strict-chat-to-graph.test.ts --trace off` for a build tool.
- If the person can see the tool's effect, say so in the wiki page of the assistant it belongs to.

## See also

- [For developers](README.md)
- [How the assistant works](Assistant-Internals.md)
- [IPC between window and main](IPC.md)
