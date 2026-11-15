[Русский](Installing.ru.md)
[Home](../Home.md) › [Start](README.md)

# Installing

NodeWise Studio is built for Linux on 64-bit x86, in four formats: `.deb`, `.rpm`, AppImage and a `.tar.gz` you install
for your user only. Download only the files actually attached to the release you choose. There are no ARM packages.
Windows and macOS are not supported; you may try running the app from source (untested).

## What you need

- Linux, 64-bit x86. For the `.deb`: Ubuntu 22.04 or newer, Debian 12 or newer, Linux Mint 21 or newer, and others
  based on them; for the `.rpm`: Fedora, openSUSE and others with rpm packages; AppImage and `.tar.gz` run on most
  distributions.
- About 320 MB of disk space for the app.
- A desktop session (X11 or Wayland).
- Optional: a system keychain (GNOME Keyring, KWallet) so the app can keep keys between starts.

## Install the .deb

1. Open the project's Releases page and download the file `nodewise-studio_<version>_amd64.deb` of the latest version.
2. Optional but wise: download `SHA256SUMS` from the same release into the same folder and check the file:

   ```bash
   sha256sum -c SHA256SUMS --ignore-missing
   ```

   It must say `OK`.
3. Install with apt, which also installs what the app needs from your distribution:

   ```bash
   sudo apt install ./nodewise-studio_*_amd64.deb
   ```

   The `./` matters: it tells apt to install this file and not look for a package by name.

## The other formats

| Format | How |
|---|---|
| `.rpm` | `sudo dnf install ./nodewise-studio-*.rpm` (or your distribution's package manager). |
| AppImage | Make the file executable (`chmod +x`) and open it. |
| `.tar.gz` | Unpack it. `./run.sh` starts the app in place; `./install.sh` installs it for your user only, without root; `~/.local/share/nodewise-studio/uninstall.sh` removes it again (`--purge` also deletes your data folder). |


The `.deb` and `.rpm` keep Chromium's sandbox. The unpacked formats (AppImage, `.tar.gz`) start without it on
Ubuntu 24.04 and newer, and say why when they start. The `.rpm` installed with dnf and the final AppImage file are
checked only by the project's automatic builds, not on a real desktop yet.

## Start it

- From the applications menu: "NodeWise Studio".
- From a terminal: `nodewise-studio`.

`nodewise-studio --version` prints the version, `nodewise-studio --help` the options it accepts
([The command line](../reference/Command-Line.md)).

Do not start it with `sudo`: the app refuses to run as root. See [Troubleshooting](../reference/Troubleshooting.md).

## What the package puts where

| Where | What |
|---|---|
| `/usr/lib/nodewise-studio/` | The program itself. |
| `/usr/bin/nodewise-studio` | A link to start it from a terminal. |
| `/usr/share/applications/` | The menu entry. |
| `/usr/share/icons/hicolor/` | The icon in sizes from 16 to 512 pixels. |
| `/usr/share/doc/nodewise-studio/copyright` | The license and the third-party notices. |

Your settings, keys, projects and logs are not in the package: the app keeps them in your home folder, see
[The data folder](../reference/Data-Folder.md).

## Other ways

- **From source on Linux**: [Building from source](../dev/Building-From-Source.md).
- **Windows**: [Building and running on Windows](../dev/Building-On-Windows.md) (untested).
- **macOS**: [Building and running on macOS](../dev/Building-On-macOS.md) (untested).

## See also

- [Start](README.md)
- [Updating](Updating.md)
- [Removing](Removing.md)
- [The data folder](../reference/Data-Folder.md)
- [Package formats](../dev/Package-Formats.md)
