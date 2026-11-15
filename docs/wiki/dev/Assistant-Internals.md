[Русский](Assistant-Internals.ru.md)
[Home](../Home.md) › [For developers](README.md)

# How the assistant works

One answer of the assistant is a *turn*. It runs in main, talks to the chosen model through the AI SDK (`ai` and
`@ai-sdk/*`), and changes the graph only through the command engine.

## A turn, step by step

1. **The renderer starts it.** `src/renderer/services/llm/chatService.ts` opens a run (`startRun`, or `resumeRun`
   after a pause) and sends the conversation on `llm:stream-chat` with the turn context: the mode (ask, build or
   chat), the selection, what is on screen and the language.
2. **Main builds the prompt.** `src/main/agent/prompt.ts` writes the system prompt from the turn context, a summary
   of the catalog, the graph with every field value (values that look like keys become `[redacted]`; with Settings ▸
   Privacy ▸ Send field values off, values are left out) and the person's recent commands. The history is cut to fit
   70 % of the model's context window (`src/shared/agent/contextWindow.ts`). The renderer's own system messages are
   replaced; the renderer cannot see the catalog or the action log.
3. **Main offers tools.** Which ones depends on the mode (below). With a small context window on a local server only
   the tools the turn cannot do without are offered (`compactToolNames` in `src/main/agent/turn.ts`).
4. **The model answers and calls tools.** `src/main/llmService.ts` streams the answer. Each tool call is checked
   against its schema and run in main.
5. **Main streams back** text, `build-step` chunks for each step tool, and a new `projection` after every commit
   (`src/main/agent/streamParts.ts`).
6. **The turn ends**: the model finished, the person stopped it, it failed, or it reached the step limit. On the step
   limit a `turn-paused` chunk comes and the run stays paused for Continue; otherwise the run is closed (and its new
   nodes arranged).

## The tools

| Group | Tools | When |
| --- | --- | --- |
| Read | `getGraph`, `searchNodeTypes`, `describeNodeType`, `findInstalledModels`, `describeModel`, `checkGraph`, `searchWeb`, `fetchPage` | Every turn. `searchWeb` and `fetchPage` only when allowed in Settings ▸ Assistant. |
| Knowledge | `explain` | Every turn: writes an explanation of a node, link or the graph. |
| Proposal | `proposeNode`, `proposeConnection`, `proposeParameter`, `proposeSubgraph` | Ask and chat turns: grey drafts the person accepts or not. |
| Build | `addNode`, `connectNodes`, `setParameter`, `removeNode`, `createSubgraph`, `insertSubgraph`, `annotateNode`, `setComponentDocumentation`, `setProcess` | Build turns, and chat turns when Settings ▸ Assistant ▸ When I ask for a change is Build directly. Each call is a command with `actor: 'ai'`. |

The lists are in `src/shared/contracts/agentTools.ts`; their schemas and descriptions in `src/main/agent/toolSpecs.ts`,
`src/shared/commands/toolSpecs.ts`; read tools in `src/main/agent/tools.ts`, build tools in
`src/main/agent/buildTools.ts`. How to add one: [Adding a tool for the assistant](Adding-A-Tool.md).

## Drafts

A proposal tool writes a *draft* (`src/main/proposals/`): a ghost node, link or value drawn grey on the canvas. The
person accepts it, which commits it as an ordinary command, or dismisses it. A draft goes stale when the nodes it was
made for are removed or another graph is opened.

## Web search and pages

`src/main/agent/web.ts`. A cloud model with its own search tool (OpenAI, Anthropic, Google) searches on the
provider's side. Otherwise `searchWeb` asks DuckDuckGo's HTML page from main. `fetchPage` opens only public `http`
and `https` addresses on ports 80 and 443, never an address of this computer, the local network, the ComfyUI address
or the MCP server; a page is read up to a size cap and its text is cut to a length cap, and it is passed to the model
as data, marked as cut when it was.

## Errors

A failed turn becomes one kind of error (`src/shared/agent/turnError.ts`, `providerErrors.ts`) with one sentence for
the person (`src/renderer/services/llm/turnErrorText.ts`). The server's own words stay available under What the
server said. [Failed answers](../assistant/Failed-Answers.md)

## The conversation log

`src/main/trace/modelTrace.ts` writes each turn to `logs/model/`: what was sent, each step and tool call, server
errors, tokens and time, the request and response bodies without headers. Every line passes the same redaction as
the main log. The window to read it is `src/renderer/components/log/`.

## Tests

`tests/unit/agent/`, `tests/integration/chatToGraph.test.ts`, `chatRunLifecycle.test.ts` and the e2e tests
`assistant-runs`, `step-checkpoint`, `strict-chat-to-graph` and `model-log` use a scripted model
(`src/main/testLLMTransport.ts`), so no network is needed.

## See also

- [For developers](README.md)
- [The command engine and history](Command-Engine.md)
- [What is sent to the model](../assistant/What-Is-Sent.md)
