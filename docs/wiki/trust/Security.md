[Русский](Security.ru.md)
[Home](../Home.md) › [Trust](README.md)

# Security

How NodeWise Studio keeps your keys and your computer safe, and how to report a vulnerability.

## Keys and tokens

A model key or a server access token can be kept in one of three places. Settings ▸ Privacy ▸ Where keys are kept
shows where each one is now.

- **In the system keychain** (GNOME "Passwords and Keys" or KWallet on Linux), encrypted by your system. The app first checks
  that the store really encrypts; if it does not, it does not offer this place.
- **In memory until the app closes.** Nothing is written to disk.
- **In a file in the app folder, unencrypted,** only if you choose it where there is no keychain. The file can be
  read by your user only.

Whatever the place:

- A key goes only to the address it was pasted for. Change the address and the key stays behind until you paste it
  again.
- A cloud key goes only over `https`.
- Keys and tokens never appear in the log, the conversation log, project files, workflows, copied diagnostics or the
  text sent to a model. Every line of the log passes a filter that hides them.
- Settings ▸ Privacy ▸ Forget all keys and tokens removes every key, token and browser sign-in, from memory, from the
  keychain and from the app folder.

If the keychain does not open, see [Troubleshooting](../reference/Troubleshooting.md).

## The window

- The window runs in Chromium's sandbox, with its page kept apart from the app's own code. It reaches the rest of the
  app only through a fixed list of checked channels.
- It cannot go to another page or open new windows; links open in your system browser.
- It loads nothing from the internet: a content security policy allows only the app's own files.
- The packaged app cannot be started as a plain Node.js program and loads its code only from its own package.

## Keys of other services in a graph

Before a project or a workflow is written, every field of every node is looked at. Besides the keys of the model
providers, the app knows the keys of services that ComfyUI's paid nodes take (Replicate, fal, ElevenLabs, Runway,
Tavily, Perplexity), and treats a field named `key`, `auth`, `…_key` or after a service as a key field. A long
random-looking string in any field also makes the app ask before saving: save without it, or as it is.

## Outside text

Web pages, model answers, model descriptions and files the app reads are treated as data. They are shown or passed to
the model as text; they cannot make the app call a tool, open a file or reach an address on their own. A web page
the assistant reads is opened only at a public address, never inside your network.

- Text that goes to the model inside a data block cannot close that block: every `<data` and `</data` inside it, in
  any letter case, is changed so it no longer reads as a tag.
- The sources a provider's own web search cites are not added to the pages the assistant may open.
- Hidden characters that change how a name reads (text direction marks, invisible characters) are shown as � in the
  title of a node, in Properties and in a model card. A model card also marks a file name that mixes Latin letters
  with look-alike letters of another alphabet. Field values and group titles do not show them yet.
- An explanation that came with an opened project file is marked "From a file", even when you wrote it yourself
  in an earlier session: the app cannot tell your file from someone else's.

## Lessons from files

A lesson file is data only. A shared lesson can never run code, open a link (its text is drawn by a renderer that
opens nothing), make the app call ComfyUI or download anything, write anywhere but the profile's `lessons` folder
under a name made from its own checked id, replace a built-in lesson (its id becomes `my:<id>`), or bring a sentence
of its own into the reasons the app gives. Every string and list has a cap, control characters and hidden direction
marks are refused, and the lesson must be possible from an empty canvas. A file is taken whole or not at all.
[The lesson file format](../lessons/Lesson-File-Format.md)

## Node packs and model files

- The app never installs a node pack. The check and the lessons say to install packs through ComfyUI Manager or from
  an author you trust, never from a link in a workflow or a note: a pack runs its own code on your computer.
- A model card marks `.ckpt`, `.pt`, `.pth` and `.bin` files: these formats can run code when ComfyUI loads them.
  Prefer a `.safetensors` file of the same model. [Unsafe model formats](../concepts/Unsafe-Model-Formats.md)

## Size caps and safe start

- A workflow or project larger than 1500 nodes or 3000 links is refused before anything changes; subgraphs count.
- A file larger than 64 MB is not opened. An answer of an MCP server, and a node list loaded from a file, may be at
  most 128 MB; ComfyUI's own list of nodes at most 512 MB.
- Safe start: before the canvas draws a graph the app writes "drawing" in `graph-start.json`, and "drawn" after. If
  the last start never finished drawing, the app asks once: Start with an empty canvas (the default; the graph stays
  in the history) or Open the graph again.
- If the last sync did not finish (the app closed or stopped answering), automatic sync waits until you start one
  with Sync now.

## Files the app writes

The data folder is made readable by your user only (0700 on Linux). The database and its journal files, the log,
the conversation log, saved keys, your lessons and `graph-start.json` are created readable by your user only (0600).
Before a schema change the database is copied next to itself; a damaged one is set aside, never overwritten.
[The data folder](../reference/Data-Folder.md)

## Running safely

- Do not run the app as root and do not switch off its sandbox (`--no-sandbox`) yourself. Chromium, which draws the
  window, refuses to start as root with the sandbox on. The `.deb` and `.rpm` keep the sandbox. The unpacked formats
  (AppImage, `.tar.gz`) start without it on Ubuntu 24.04 and later, because there it cannot work without a helper
  installed as root, and they print why. [Package formats](../dev/Package-Formats.md)
- The spell checker of the window is off, so no dictionaries are downloaded.
- Install packages only from the project's Releases and check the checksum shown there.

## Reporting a vulnerability

Please do not open a public issue. Report privately through GitHub: on the repository's Security tab, choose
**Report a vulnerability**. Describe what an attacker can do, how to reproduce it and the version (Help ▸ About ▸
Copy details). What is in scope is listed in the project's `SECURITY.md`.

## See also

- [Trust](README.md)
- [Privacy](Privacy.md)
- [ComfyUI is only read](Read-Only.md)
- [Keys](../assistant/Keys.md)
