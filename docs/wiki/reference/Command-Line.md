[Русский](Command-Line.ru.md)
[Home](../Home.md) › [Reference](README.md)

# The command line

The program is `nodewise-studio`. Started without options it opens the window. It
accepts these options and one file:

| Option | What it does |
| --- | --- |
| `--version`, `-v` | Prints the version and exits without opening a window. |
| `--help`, `-h` | Prints the list of options and exits without opening a window. The text follows the system's language: Russian on a Russian system, otherwise English. |
| `--user-data-dir=<folder>` | Keeps settings, keys and history in this folder instead of the usual [data folder](Data-Folder.md). Useful for a second, separate profile or a test. |
| `--password-store=<store>` | Which system keychain keeps saved keys: `gnome-libsecret`, `kwallet5` or `kwallet6`. Settings ▸ Privacy ▸ Which keychain the app uses does the same from inside the app. |
| `--ozone-platform-hint=auto` | Runs natively on Wayland when the desktop uses it, instead of through XWayland. |
| `[file]` | A workflow (`.json`), a project, or a picture or video saved by ComfyUI: it opens in the window. If the graph on screen is in no file, the app asks first. |

Other options are Chromium's own and are passed on to it unchanged.

## Examples

```bash
nodewise-studio --version
nodewise-studio ~/Pictures/ComfyUI_00001_.png
nodewise-studio --user-data-dir="$HOME/nodewise-test"
nodewise-studio --password-store=kwallet6
```

Only one window of the app runs at a time for one data folder: starting it again brings the open window to the
front, and a file named in the second start opens there.

On Windows (not supported, not tried) the program has no console, so `--version` and `--help` print nothing there.

## See also

- [Reference](README.md)
- [The data folder](Data-Folder.md)
- [Troubleshooting](Troubleshooting.md)
