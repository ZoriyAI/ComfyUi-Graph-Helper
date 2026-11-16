[Русский](CHANGELOG.ru.md)

# Changes

Releases, newest first. Each release has full notes in `docs/releases/`.
This file is written by `node scripts/changelog.js`: change the notes, not this file.

## 1.2.5

**Settings → Services** discovers supported Linux systemd services on the NodeWise computer and offers start, stop, restart and live status. The same controls are available from a paired phone. **Sync** now offers explained Gentle, Balanced and Faster reading profiles instead of leading with batch sizes and millisecond pauses.

Notes: [docs/releases/v1.2.5.md](docs/releases/v1.2.5.md)

## 1.2.4

Sync problems now have a separate **Sync → Sync problems and repairs** window. It collects connection warnings, unread and excluded files, with retry and direct-file repair. A skipped file can be retried immediately; a successful read removes its exclusion.

Notes: [docs/releases/v1.2.4.md](docs/releases/v1.2.4.md)

## 1.2.3

Fixes a model-metadata sync that repeatedly stopped at the same file after MCP reported `Not connected`. ComfyUI's native metadata route also returns HTTP 404 for headers above its 1 MiB limit or without embedded metadata. Previously, failure on that first fallback file stopped the entire pass.

Notes: [docs/releases/v1.2.3.md](docs/releases/v1.2.3.md)

## 1.2.2

Phone and tablet panels now close with a second tap or the back-to-canvas action, including their floating cards. Photo selection uses the current device's native picker. The **Image** button, paste and file drop add an ordinary ComfyUI `LoadImage` source with preview and an `IMAGE` output.

Notes: [docs/releases/v1.2.2.md](docs/releases/v1.2.2.md)

## 1.2.1

Media loaders now let you choose a file from this device, including a phone browser. The node library has **Collapse all** and **Expand all** controls. Input and output ports share the same rows, following ComfyUI's node layout. Browser access over Wi-Fi from 1.2.0 is included.

Notes: [docs/releases/v1.2.1.md](docs/releases/v1.2.1.md)

## 1.2.0

Open the running app from your phone or tablet over Wi-Fi. The browser shares the computer's project and assistant, with a layout that fits a phone, tablet or desktop. This version also preserves lesson edits during saves and imports, tracks explanation changes in saved projects, and reports incomplete secret removal.

Notes: [docs/releases/v1.2.0.md](docs/releases/v1.2.0.md)

## 1.1.0

Lessons now ask you things, not only the canvas: checklists, rubrics, questions and checks the app makes, each saying whether the app saw it or you said it. Lessons have levels, tracks and a path; 95 lessons in sixteen groups, with the new groups Start and a reliable setup, Experiments and quality, Diagnostics, performance and safety, and The daily work cycle. Lesson progress is saved again after the 3D lesson or one of My lessons (1.0.0 lost it). A model of Ollama's cloud is no longer called local. A full guide to choosing a model, with current suggestions and prices. Copyright and authorship are stated in NOTICE and COPYRIGHT, and the packages carry them.

Notes: [docs/releases/v1.1.0.md](docs/releases/v1.1.0.md)

## 1.0.0

The app is now NodeWise Studio. A plain ComfyUI address is enough to connect, 79 lessons in twelve groups and lessons of your own, a first hour that leads a newcomer, an assistant that asks before it changes your work, editing as in ComfyUI, motion that explains, accessibility from the keyboard to the screen reader, and caps that keep a broken file from hanging the window. Packages for Linux, built, installed and started on the build server; on Windows and macOS an install script, new and not tested yet, builds the app from this release's source and installs it.

Notes: [docs/releases/v1.0.0.md](docs/releases/v1.0.0.md)

## 0.9.0

A graph and subgraph editor, 45 lessons grouped by topic and more precise help: the assistant leaves the choice of subject to you, and undoing consecutive steps of the assistant keeps the manual edits made between them.

Notes: [docs/releases/v0.9.0.md](docs/releases/v0.9.0.md)

## Earlier versions

Versions 0.2.0 to 0.8.0 were private releases, made before the project was published.
A short list of what each brought: [docs/releases/0.x.md](docs/releases/0.x.md).
