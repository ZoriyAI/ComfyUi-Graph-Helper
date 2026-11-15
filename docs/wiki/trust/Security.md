[Русский](Security.ru.md)
[Home](../Home.md) › [Trust](README.md)

# Security

How CozyGraph keeps your keys and your computer safe, and how to report a vulnerability.

## Keys and tokens

A model key or a server access token can be kept in one of three places. Settings ▸ Privacy ▸ Where keys are kept
shows where each one is now.

- **In the system password store** (GNOME Keyring or KWallet on Linux), encrypted by your system. The app first checks
  that the store really encrypts; if it does not, it does not offer this place.
- **In memory until the app closes.** Nothing is written to disk.
- **In a file in the app folder, unencrypted,** only if you choose it where there is no password store. The file can be
  read by your user only.

Whatever the place:

- A key goes only to the address it was pasted for. Change the address and the key stays behind until you paste it
  again.
- A cloud key goes only over `https`.
- Keys and tokens never appear in the log, the conversation log, project files, workflows, copied diagnostics or the
  text sent to a model. Every line of the log passes a filter that hides them.
- Settings ▸ Privacy ▸ Forget all keys and tokens removes every key, token and browser sign-in, from memory, from the
  password store and from the app folder.

If the password store does not open, see [Troubleshooting](../reference/Troubleshooting.md).

## The window

- The window runs in Chromium's sandbox, with its page kept apart from the app's own code. It reaches the rest of the
  app only through a fixed list of checked channels.
- It cannot go to another page or open new windows; links open in your system browser.
- It loads nothing from the internet: a content security policy allows only the app's own files.
- The packaged app cannot be started as a plain Node.js program and loads its code only from its own package.

## Outside text

Web pages, model answers, model descriptions and files the app reads are treated as data. They are shown or passed to
the model as text; they cannot make the app call a tool, open a file or reach an address on their own. A web page
the assistant reads is opened only at a public address, never inside your network.

## Files the app writes

The database, the log, the conversation log and saved keys are created readable by your user only (on Linux).
Before a schema change the database is copied next to itself; a damaged one is set aside, never overwritten.
[The data folder](../reference/Data-Folder.md)

## Running safely

- Do not run the app as root and do not switch off its sandbox (`--no-sandbox`). Chromium, which draws the window,
  refuses to start as root with the sandbox on.
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
