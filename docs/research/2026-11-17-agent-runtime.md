# Assistant control, context and memory qualification — 17 November 2026

This report records actual local-model runs in isolated Electron profiles. It does not promise that every model will construct every workflow correctly. No owner workflow, installed application profile or shared server configuration was changed.

## Defects corrected

- Initial `Note`/`MarkdownNote` text could disappear although the tool reported success. Initial text and subsequent named text edits now reach the native widget value.
- Explicit edits could store a numeric field as a string. Declared numeric/boolean fields are normalized and validated at the command boundary, including exposed subgraph fields; untouched imported unknown data is preserved.
- A growing tool conversation could exhaust an actual 8192-token window and finish mid-answer while the run appeared complete. Every local-model step now budgets the actual tool schemas and current messages, reserves output space, and removes complete older exchanges when needed. The latest user request is retained.
- Removing older messages could lose a successful mutation receipt. A later partial graph page could then lead to duplicate creation. A compact, deterministic record of successful current-turn mutations survives message compaction; it carries returned node/definition ids and is included in the budget. Large argument values are explicitly marked as previews. It is data, not a new instruction.
- An answer-length limit or a request that cannot fit now leaves a durable, resumable task. The context pause also offers the existing automatic Ollama configuration action. It does not label unfinished work as completed.

## Actual graph control

Model: local `orcarouter/Qwen3.8-27B-Uncensored:q6_K`, Ollama 0.34.2, observed loaded window 8192 tokens. Default Assistant mode was used. The model was already resident and was preserved after these checks.

| Scenario | Observed result |
| --- | --- |
| Explicitly clear an existing canvas and create two notes plus KSampler | Three nodes; exact note texts retained |
| Set steps to 27 and create/populate two named subgraphs | Native numeric value 27; both definitions contain their requested note |
| Change only the note inside the first subgraph | Exact replacement text; second definition unchanged |
| Undo, then Redo | Serialized graph state restored correctly |
| Pause during a six-note task | Revision unchanged for 2.2 seconds |
| Reach a step checkpoint, exit, reopen and Continue | Six exact texts, each present once; earlier work retained |
| Stop a twenty-note task after its first edit | Revision unchanged for 2.5 seconds; remaining additions did not occur |
| Issue a separate one-note request after Stop | Exactly that new note added |

These checks compare actual graph values, not just tool success flags or node counts. No ComfyUI image generation was run by these graph-control scenarios.

## Actual model release

A separate Ollama 0.34.2 process used an isolated writable model directory and RTX 4060. Existing weights were read through individual read-only-source links. The owner's RTX 5090 model and services were left running.

`qwen3:4b-instruct` was loaded through the application's local-model control. Native `/api/ps` reported 3,873,366,343 bytes of model VRAM and an 8192-token context. GPU memory increased from 105 MiB to 3910 MiB.

The Russian Settings button **Освободить память для ComfyUI** returned a verified released state; `/api/ps` became empty and GPU memory returned to 105 MiB. After explicit resumption and another load, closing the desktop app again emptied `/api/ps` and returned GPU memory to 105 MiB. Closing took about 1.0 second. No renderer errors were recorded.

This proves native Ollama release on that configuration. Other compatible HTTP servers may lack load/unload APIs; the app reports an unsupported or unconfirmed action instead of stopping their service. Closing a phone tab does not close the desktop application.

## Automatic context setup

The real Russian Settings action **Применить режим диалога к Ollama**, with automatic context selection and the focused style, created and selected `qwen3:4b-instruct-ctx16k-focused`. Native `/api/ps` confirmed 16384 loaded tokens; `/api/show` confirmed temperature 0.2 and top-p 0.9. The original model definition was unchanged. Saving settings selected the copy, and closing the app unloaded it. No service-file edits or manual numeric entry were needed.

The first qualification attempt used read-only links for all weights; Ollama rejected creation because it updates blob access times. Repeating with private writable copies passed. That failure belonged to the isolated test setup.

## Verification boundaries

Focused regressions cover schema constraints, per-step budgets, complete call/result pairs, applied-action receipts, durable pauses, and actual SDK refusal before an oversized request is sent. Main/renderer/test TypeScript checks and the production build passed. Existing lint warnings in older runtime declarations remain visible; there were no lint errors in the touched set.

Actual-model quality remains variable. Physical mobile devices, other operating systems, and arbitrary custom-node execution require their own acceptance evidence. Release qualification uses the final release revision separately.

Native API references: [running models](https://docs.ollama.com/api/ps), [generation and keep-alive](https://docs.ollama.com/api/generate).
