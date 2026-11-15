[Русский](Command-Line.ru.md)
[Home](../Home.md) › [Reference](README.md)

# The command line

The program is `cozygraph`. <!-- verify: technical rename --> Started without options it opens the window. It
accepts these options:

| Option | What it does |
| --- | --- |
| `--version`, `-v` | Prints the version and exits without opening a window. |
| `--help`, `-h` | Prints the list of options and exits without opening a window. |
| `--user-data-dir=<folder>` | Keeps settings, keys and history in this folder instead of the usual [data folder](Data-Folder.md). Useful for a second, separate profile or a test. |
| `--password-store=<store>` | Which system password store keeps saved keys: `gnome-libsecret`, `kwallet5` or `kwallet6`. Settings ▸ Privacy ▸ Password store does the same from inside the app. |
| `--ozone-platform-hint=auto` | Runs natively on Wayland when the desktop uses it, instead of through XWayland. |

Other options are Chromium's own and are passed on to it unchanged.

## Examples

```bash
cozygraph --version
cozygraph --user-data-dir="$HOME/cozygraph-test"
cozygraph --password-store=kwallet6
```
<!-- verify: technical rename -->

Only one window of the app runs at a time for one data folder: starting it again brings the open window to the
front.

On Windows the program has no console, so `--version` and `--help` print nothing there.

## See also

- [Reference](README.md)
- [The data folder](Data-Folder.md)
- [Troubleshooting](Troubleshooting.md)
