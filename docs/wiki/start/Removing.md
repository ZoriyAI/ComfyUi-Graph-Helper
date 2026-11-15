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

## Remove your data too

1. Before you remove the program, forget the saved keys and tokens: **Settings ▸ Privacy ▸ Forget all keys and
   tokens**. The app asks first, then removes every key and token from memory, from the system password store and
   from the app folder. Without this step, the saved keys stay in your password store.
2. Remove the program (above).
3. Remove the data folder:

   ```bash
   rm -rf ~/.config/nodewise-studio
   ```

   It holds the database (settings, the catalog, the history of the graph, chats), the logs, the conversation log
   and the cached model pictures. See [The data folder](../reference/Data-Folder.md).

Project files (`*.nodewise.json`) and workflows you saved elsewhere are yours; remove them by hand if you want.

## See also

- [Start](README.md)
- [Installing](Installing.md)
- [The data folder](../reference/Data-Folder.md)
- [Privacy](../trust/Privacy.md)
