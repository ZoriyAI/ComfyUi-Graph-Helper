[Русский](Updating.ru.md)
[Home](../Home.md) › [Start](README.md)

# Updating

A new version is installed over the old one. Your settings, saved keys, projects and the history of your graph are
kept.

## How to know there is a new version

The app does not check for new versions by itself (it never contacts the internet on its own). Look at the project's
Releases page: Help ▸ New versions opens it. Help ▸ What is new shows the notes of the version you have.

## Install the new version

1. Download the new `nodewise-studio_<version>_amd64.deb` (and `SHA256SUMS` to check it, see [Installing](Installing.md)).
2. Quit the app (File ▸ Exit).
3. Install it the same way as the first time:

   ```bash
   sudo apt install ./nodewise-studio_*_amd64.deb
   ```

4. Start the app again.

## What happens to your data

- Everything stays in [the data folder](../reference/Data-Folder.md). The package never touches it.
- When the new version needs a newer layout of the database, it first writes a copy of the old database next to it,
  `comfyui-desktop.db.before-v<N>.bak` (one copy is kept), then upgrades it.
- Saved keys stay in the system password store under the same name.
- Project files and workflows you saved stay where you saved them.

## From version 0.9 to 1.0

Until 0.9 the app had another name. From 1.0 it is NodeWise Studio, and its package, program and data folder are
named `nodewise-studio`. What that means for an update:

- **The package.** The new `.deb` (and `.rpm`) replaces the 0.9 package: installing it removes the old one, so the
  menu shows the app once. A copy that `install.sh` put in your home folder is removed by the new `install.sh`.
- **Your data.** On its first start NodeWise moves the 0.9 data folder to `~/.config/nodewise-studio`: settings,
  projects, chats, the history of your graph and the logs come along. It moves the folder, it does not copy or delete
  it. It leaves both alone when `~/.config/nodewise-studio` already exists. If version 0.9 is still open, it asks you
  to quit it and start again. A window then says once where your work is now.
- **Keys you saved in the system password store must be entered again.** The password store (GNOME Keyring,
  KWallet) keeps the secret that encrypts them under the app's name, and NodeWise cannot open them under the new one.
  Enter them again in Settings; the old entry stays in the password store, and your keyring manager (for example
  Passwords and Keys) can delete it. Keys you kept in a file on this computer (`model-key.json`, `mcp-token.json`)
  come along and work.
- **Project files.** Files saved by 0.9 open as before. Save writes them back under their own name; new projects are
  saved as `*.nodewise.json`.

## Going back to an older version

An older version cannot open a database that a newer version upgraded: it says "Your data was saved by a newer
version of the app" and changes nothing. To go back:

1. Quit the app and install the older `.deb`.
2. In the data folder, move away `comfyui-desktop.db`, `comfyui-desktop.db-wal` and `comfyui-desktop.db-shm`.
3. Rename the copy `comfyui-desktop.db.before-v<N>.bak` to `comfyui-desktop.db`.
4. Start the older version.

Changes made with the newer version are lost this way; your saved project files are not.

Going back from 1.0 to 0.9 also needs the 0.9 folder name: remove the new package first
(`sudo apt remove nodewise-studio`), install the 0.9 `.deb`, and rename `~/.config/nodewise-studio` to the name the
0.9 package file begins with (the part before the first `_`). Then do steps 2 to 4 in that folder.

## See also

- [Start](README.md)
- [Installing](Installing.md)
- [Removing](Removing.md)
- [The data folder](../reference/Data-Folder.md)
- [Known limitations](../reference/Known-Limits.md)
