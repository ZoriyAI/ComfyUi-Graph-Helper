[Русский](Updating.ru.md)
[Home](../Home.md) › [Start](README.md)

# Updating

A new version is installed over the old one. Your settings, saved keys, projects and the history of your graph are
kept.

## How to know there is a new version

The app does not check for new versions by itself (it never contacts the internet on its own). Look at the project's
Releases page: Help ▸ New versions opens it. Help ▸ What is new shows the notes of the version you have.

## Install the new version

1. Download the new `cozygraph_<version>_amd64.deb` (and `SHA256SUMS` to check it, see [Installing](Installing.md)).
   <!-- verify: technical rename -->
2. Quit the app (File ▸ Exit).
3. Install it the same way as the first time:

   ```bash
   sudo apt install ./cozygraph_*_amd64.deb
   ```
   <!-- verify: technical rename -->

4. Start the app again.

## What happens to your data

- Everything stays in [the data folder](../reference/Data-Folder.md). The package never touches it.
- When the new version needs a newer layout of the database, it first writes a copy of the old database next to it,
  `comfyui-desktop.db.before-v<N>.bak` (one copy is kept), then upgrades it. <!-- verify: technical rename -->
- Saved keys stay in the system password store under the same name.
- Project files and workflows you saved stay where you saved them.

## Going back to an older version

An older version cannot open a database that a newer version upgraded: it says "Your data was saved by a newer
version of the app" and changes nothing. To go back:

1. Quit the app and install the older `.deb`.
2. In the data folder, move away `comfyui-desktop.db`, `comfyui-desktop.db-wal` and `comfyui-desktop.db-shm`.
3. Rename the copy `comfyui-desktop.db.before-v<N>.bak` to `comfyui-desktop.db`.
4. Start the older version.

Changes made with the newer version are lost this way; your saved project files are not.

## See also

- [Start](README.md)
- [Installing](Installing.md)
- [Removing](Removing.md)
- [The data folder](../reference/Data-Folder.md)
- [Known limitations](../reference/Known-Limits.md)
