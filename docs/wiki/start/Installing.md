[Русский](Installing.ru.md)
[Home](../Home.md) › [Start](README.md)

# Installing

The app targets Linux x64. Download the format actually attached to your chosen release. Source builders for a format do not prove that it has been published or verified on your desktop. ARM builds are not provided.

| Format in source | Installation or launch |
|---|---|
| `.deb` | On a Debian-based system: `sudo apt install ./comfyui-graph-builder_*.deb` |
| `.rpm` | Install the downloaded file with your distribution's package manager, for example `sudo dnf install ./comfyui-graph-builder-*.rpm` |
| AppImage | Make the downloaded file executable and open it; the launcher checks sandbox support |
| `.tar.gz` | Extract it; `./run.sh` starts in place, `./install.sh` installs for the current user and `./uninstall.sh` removes that installation |

The source build uses Node 22 and the existing Electron Forge toolchain. `.deb` needs `dpkg` and `fakeroot`; `.rpm` also needs `rpmbuild`. AppImage needs `mksquashfs` and an AppImage type 2 runtime. See [Development](../../DEVELOPMENT.md) for build and package checks.

The profile stays in `~/.config/comfyui-graph-builder` across updates. Project and workflow files stay where you saved them. Package removal does not erase your profile. A working OS password store is needed to remember encrypted credentials. Target OS, keyring, display scaling and real desktop checks are separate from source tests.

Start ComfyUI separately, then [connect using its browser address](../connect/Connecting.md). MCP is optional. Lessons work without an assistant model.
