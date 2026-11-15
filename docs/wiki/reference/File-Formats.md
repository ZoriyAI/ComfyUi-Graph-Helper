[Русский](File-Formats.ru.md)
[Home](../Home.md) › [Reference](README.md)

# File formats

The files the app reads and writes, outside its [data folder](Data-Folder.md). All of them are JSON text, except
the pictures and videos a workflow is read from. A file larger than 64 MB is not opened.

## The project file

- **Name:** `*.nodewise.json` is suggested when you save. Project files saved by version 0.9, under the file ending
  of the app's old name, still open: the app goes by what is inside, not by the name. Save writes such a file back
  under its own name; Save project as suggests the `.nodewise.json` ending.
- **Written by:** File ▸ Save project. **Read by:** File ▸ Open project.
- **Inside:** a `format` field that names the project format (`nodewise-studio-project`; the id version 0.9 wrote
  is still read, and the file is written back with the new one), a `version` (2 today; versions 0 and 1 still open), the
  graph in ComfyUI's own form, the component records (purpose, how to use), subgraphs, groups, the title and notes of
  the graph, and the explanations and notes you wrote.
- **Not inside:** the chat, the settings and keys. A field that looks like a key or a token is shown to you before
  saving, and you choose to save without it or as it is.
- **Forward-compatible:** fields this version does not know are kept and written back on save.
- A new project holds its graph in workflow format 1, so subgraphs can be made in it.
- A project file from a newer version is refused with a message that names its version.

More: [Project files](../graph/Project-Files.md).

## The workflow file

- **Written by:** File ▸ Save workflow for ComfyUI… **Read by:** File ▸ Open workflow… (and ComfyUI).
- **Inside:** an ordinary ComfyUI workflow in the format the ComfyUI frontend saves (versions 0.4 and 1), with
  subgraphs. What you did not change comes back exactly as it was, including values the app does not show.
- **The older format 0.4** opens, but cannot hold a subgraph: the app says to copy the nodes into a new project.
- **From a picture or a video:** File ▸ Open workflow… also offers the pictures and videos ComfyUI saves (PNG,
  WebP, JPEG, GIF, MP4, WebM, MKV, MOV) and its audio files (FLAC, MP3, Opus, OGG). ComfyUI writes the workflow into
  the files it saves; the app reads it from there and says "Read from the picture…" or "Read from the video…". A
  file without a workflow says "There is no workflow in this file…".
- **The API format** of ComfyUI (a file of prompts by node number, with no positions) opens too: the app lays the
  nodes out from left to right and says "This file was in the API format, which has no positions…". It opens as
  format 0.4.
- A file dropped on the window, or named on the [command line](Command-Line.md), opens the same way.
- Keys are handled as for the project file.

More: [Opening a workflow](../graph/Opening-Workflows.md), [Saving a workflow for ComfyUI](../graph/Saving-Workflows.md).

## The lesson file

- **Name:** `*.lesson.json`. **Written by:** the export button on a lesson card or next to a group title.
  **Read by:** File ▸ Import lessons…, the Import… button in My lessons, or a file dropped on the lesson list.
- **Inside:** a `format` field (`nodewise-studio/lessons`), a `version` (1 today; a newer one is refused with a
  message) and one lesson or more (at most 200): ids, the words in English, Russian or both, the steps and what each
  step checks on the canvas. Next to `title`, `result` and `steps`, the words of a language may carry an optional
  `roles` map: what each node is called in this lesson, so "Still to do" can tell two alike nodes apart. A file is at
  most 2 MB.
- A refused file says which rule it breaks, in the language of the interface.
- **Data only:** nothing in it is run or opened; a file is all or nothing.

The whole format: [The lesson file format](../lessons/Lesson-File-Format.md).

## The node list file

- **Read by:** File ▸ Load node list from file…, for when there is no connection.
- **Inside:** the answer of ComfyUI's `/object_info`, saved from ComfyUI or a browser as a `.json` file.

## The conversation log

- **Written by:** Help ▸ Conversation log… ▸ Save to a file, for the answers you ticked.
- **Inside:** one JSON object per line (`.jsonl`): each request to the model, what came back, the tool calls and their
  results. Keys and tokens are hidden; the home folder is written as `~`.

More: [The conversation log](../assistant/Conversation-Log.md).

## See also

- [Reference](README.md)
- [The data folder](Data-Folder.md)
- [Workflow formats](../concepts/Workflow-Formats.md)
