# Completion audit and next delivery

Baseline: v1.2.4, b18112c7f34782450f661bbf783482dddae281f0. The owner requested a fresh audit, brainstorming, completion and releases on 16 November 2026. Earlier read-only product descriptions do not prohibit the newly requested explicit service controls. This does not authorize unrelated host administration during development.

## Requirements reconciled with source

| Owner scenario | Current evidence | Remaining work |
| --- | --- | --- |
| Phone browser over Wi-Fi with a chosen interface/port | browser server, pairing, Settings BrowserAccessSection | Physical phone/Safari acceptance remains empirical; retain host pairing and address checks. |
| Close panels and operate nodes without a mouse | touch node menu, tap connections, image picker, 1.2.2 touch journey | Keep every new control usable at 390px. |
| Keep node fields visible when zooming out | node rendering and 1.2.2 coverage | No new implementation gap established. |
| Image from the current device to an IMAGE node | LoadImage upload/paste/drop | Phone selects a phone file; desktop selects a desktop file. |
| Collapse/expand library groups | existing library commands | No new gap established. |
| Preserve imported ComfyUI settings/links | native codec, import-settings and blueprint round trips | Unknown native data must remain intact; execution of all external graphs is not proven. |
| Create subgraphs and choose boundary/widgets | SubgraphWizard, create-subgraph and innerEdits | Existing inner creation was incorrectly described as unsupported in Known-Limits; correct source/docs discrepancy. Nested dissolution and inner group editing remain incomplete. |
| Templates and stepwise agent help | 115 pinned native blueprints; task wizard tools | Source inventory is a dated snapshot, not every possible workflow. |
| Teacher drafts and sharable lessons | My lessons import/export and draft tools | Drafts still require teacher review. |
| Ollama image-to-prompt/chat/embedding nodes | starter extension ZIP | Installation/execution on an external ComfyUI is still a separate operation. |
| Resource planning for mixed models | RAM/VRAM/file assessment | Estimated graph fit is not measured peak usage; display actual local service memory separately. |
| Russian metadata for all model folders | background translation/cache | Depends on a configured working assistant; never alter filenames/triggers. |
| Sync errors, retry, repair, exclusions | dedicated repair center and selected header import in 1.2.4 | Service restart should be available in-app when the local reader service is stopped or failed. |
| Explain model settings and set context automatically | native Ollama configure/readback in 1.2.4 | Other provider APIs have different capabilities; do not claim universal mutable context. |
| Start/stop/restart and monitor services in the app | no service lifecycle implementation in 1.2.4 | Implement explicit Linux user/system service controls and clear machine identity. |
| Understandable settings instead of arbitrary numbers | SyncSection still exposes batch size and millisecond pause as primary controls | Add named reading profiles with explanations; retain custom values under advanced settings. |

## Design decisions

1. Reuse Linux systemd instead of maintaining a second process supervisor. Discover only ComfyUI/MCP/Ollama/LM Studio/llama-server service families, including installed inactive services. Do not expose arbitrary commands, paths, service names or journal contents over IPC. Refresh and revalidate the exact discovered service before each action.
2. A Services settings section belongs to the computer running NodeWise. A paired phone operates that computer, not the phone or an unrelated remote endpoint. Show user/system scope, running/stopped/failed state, memory when reported, and the effect of start/stop/restart. System service actions use the OS authentication dialog; no password is stored and no sudo/polkit policy is installed.
3. Success requires state readback. A successful command is not a ready HTTP server. Show transitioning/failed states honestly and provide connection/sync navigation. Serialize actions and discard stale status polls.
4. Preserve original custom sync settings. Named balanced/gentle/faster profiles explain the performance tradeoff; advanced fields retain units and bounds. Do not rewrite the owner's saved values merely on opening Settings.
5. Finish nested graph operations using the existing revision/codec/command path, preserving boundary links, promoted widgets and undo. No alternate graph representation.

## Delivery sequence and proof boundary

- First release: service lifecycle/monitoring, phone access to those controls, named sync profiles and corrected current documentation. Focused command/authorization/state tests plus rendered desktop/phone journey; packaged startup and public artifact verification.
- Following graph delivery: nested dissolution and group support only after boundary/widget/export regressions demonstrate preservation. Avoid bundling unverified graph transformations into the service release.
- Physical-device testing, arbitrary remote OS administration, all-provider mutable context, automatic installation of third-party Python and guaranteed GPU fit are not established by these changes. Keep these limits explicit.

References: [systemctl](https://www.freedesktop.org/software/systemd/man/latest/systemctl.html), [polkit pkexec](https://www.freedesktop.org/software/polkit/docs/latest/pkexec.1.html). The implementation uses execFile with fixed arguments and bounded output; no shell commands from the UI.
