[Русский](Removing.ru.md)
[Home](../Home.md) › [Start](README.md)

# Removing

Removing the package removes the program. Your data stays until you remove it yourself.

## Remove the program

```bash
sudo apt remove nodewise-studio
```

The menu entry, the icon and the program files are gone. Your data folder, your saved keys and the files you saved
are not touched.

On **Windows**: Settings ▸ Apps ▸ Installed apps ▸ NodeWise Studio ▸ Uninstall. On **macOS**:
`bash ~/Library/Application\ Support/nodewise-studio-installer/install-macos.sh --uninstall`. Both remove the app and
its shortcuts, then ask whether to remove your data too (the answer is "no" unless you say yes).
[Installing on Windows](Installing-On-Windows.md), [Installing on macOS](Installing-On-macOS.md)

## Remove your data too

1. Before you remove the program, forget the saved keys and tokens: **Settings ▸ Privacy ▸ Forget all keys and
   tokens**. The app asks first, then removes every key and token from memory, from the system keychain and
   from the app folder. Without this step, the saved keys stay in your keychain.
2. Remove the program (above).
3. Remove the data folder:

   ```bash
   rm -rf ~/.config/nodewise-studio
   ```

   On Windows the folder is `%APPDATA%\nodewise-studio`, on macOS `~/Library/Application Support/nodewise-studio`;
   the uninstall scripts remove it for you when you say yes (`-PurgeData` or `--purge-data` without asking).
   It holds the database (settings, the catalog, the history of the graph, chats), the logs, the conversation log
   and the cached model pictures. See [The data folder](../reference/Data-Folder.md).

Project files (`*.nodewise.json`) and workflows you saved elsewhere are yours; remove them by hand if you want.

## See also

- [Start](README.md)
- [Installing](Installing.md)
- [The data folder](../reference/Data-Folder.md)
- [Privacy](../trust/Privacy.md)
