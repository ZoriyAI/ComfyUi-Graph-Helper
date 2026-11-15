[Русский](Installing-On-Windows.ru.md)
[Home](../Home.md) › [Start](README.md)

# Installing on Windows

There is no ready Windows package yet. Instead, each release has a script, `install-windows.ps1`, that builds the app
on your computer from the project's own source and installs it for you. One command does everything; this page says
what it does, what it asks and how to undo it.

## What you need

- Windows 10 22H2 or Windows 11, 64-bit x86 (x64). Windows on ARM is not supported yet.
- Windows PowerShell 5.1 (part of Windows) or PowerShell 7.
- About 3.5 GB of free space for the build (it is removed at the end) and 600 MB for the app.
- An internet connection to `github.com`, `nodejs.org` and `registry.npmjs.org`.
- No administrator rights. Do not open PowerShell "as administrator": the app is installed for your own user.

## The one command

Open **PowerShell** (Start menu, type "PowerShell") and paste these two lines:

```powershell
Invoke-WebRequest -UseBasicParsing https://github.com/ZoriyAI/nodewise-studio/releases/latest/download/install-windows.ps1 -OutFile install-windows.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-windows.ps1
```

The project's front page (README) shows the same lines with the address filled in.

`-ExecutionPolicy Bypass` lets this one PowerShell process run the downloaded script. It changes no setting of
Windows: the next PowerShell window has the same rules as before.

## The careful way

1. Download `install-windows.ps1` and `SHA256SUMS` from the release page.
2. Check the file: `Get-FileHash .\install-windows.ps1 -Algorithm SHA256` must print the same value (in capital
   letters) as the line for `install-windows.ps1` in `SHA256SUMS`.
3. Read the script. It is plain text; every step has a comment.
4. See the plan without changing anything:
   `powershell -NoProfile -ExecutionPolicy Bypass -File .\install-windows.ps1 -DryRun`
5. Run it for real without `-DryRun`.

## What it does, step by step

1. **Checks this computer**: the Windows version, the processor, PowerShell, free space, the connection to GitHub,
   nodejs.org and the npm registry, and that NodeWise Studio is not running.
2. **Gets the source** of the latest release from GitHub as a zip (no Git needed) into a private build folder,
   `%LOCALAPPDATA%\nodewise-studio-installer`, and checks that it is this project: the archive's folder name, the
   names and the version in its `package.json`.
3. **Node.js for the build.** If Node.js of the version the project needs (22) is already installed, it is used.
   Otherwise a private copy is downloaded from nodejs.org into the build folder and checked against nodejs.org's
   `SHASUMS256.txt`. Your own Node.js, of any version, is never changed.
4. **Builds the app**: `npm ci`, `npm run build`, then Electron Forge makes the app folder. The database module comes
   ready-made for Windows x64, so no compiler is needed. This step takes the longest.
5. **Installs** into `%LOCALAPPDATA%\Programs\NodeWise Studio`: the new copy is prepared next to the old one and then
   swapped in, so a failure leaves the old version working. It adds a Start menu shortcut and an entry in
   Settings ▸ Apps ▸ Installed apps.
6. **Checks the installed app**: it must print its version with `--version`, open its window with a throw-away
   profile and refuse to start twice. Your own data folder is not touched by this check.

At the end it prints where the app is, where your data is, how to start and remove it, and where the log is.

## How long it takes

Most of the time is the download of the packages and the build: about 5 to 15 minutes on a usual connection. Nothing
needs you while it runs.

## What it asks

Nothing, in the usual case. It asks once, before anything is installed for the whole computer, only when you choose
that yourself (`-SystemNode`), or when a future version has no ready-made database module for your system (then the
Visual Studio C++ build tools and Python are needed). `-Yes` answers these questions with yes. Removing your data is
never done without your clear answer.

## Options

| Option | What it does |
|---|---|
| `-Version v1.0.0` | Builds this release instead of the latest one. |
| `-Main` | Builds the newest code of the main branch (not a release; may be broken). |
| `-Source <folder>` | Builds from a folder that already holds the source. |
| `-DesktopShortcut` | Also puts a shortcut on the desktop. |
| `-SystemNode` | Installs Node.js for the whole computer with winget instead of a private copy. |
| `-PrivateNode` | Uses a private copy of Node.js even when a fitting one is installed. |
| `-DryRun` | Prints every step and changes nothing. |
| `-KeepBuild` | Keeps the build folder (about 1.5 GB) after the install. |
| `-BuildDir <folder>` | Builds somewhere else, for example on another drive. |
| `-LogPath <file>` | Writes the log there instead of `%TEMP%\nodewise-studio-install.log`. |
| `-Language en` or `ru` | The language of the messages; by default the language of Windows. |
| `-Uninstall`, `-PurgeData` | See "Removing" below. |
| `-Help` | Lists the options and the exit codes. |

## Updating

Run the same command again. It builds the latest release and replaces the app in place. Your settings, keys, projects
and conversations stay, because they live in a separate folder. Quit the app first, or the script stops and says so.

## Removing

Settings ▸ Apps ▸ Installed apps ▸ NodeWise Studio ▸ Uninstall. Or in PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\Programs\NodeWise Studio\install-windows.ps1" -Uninstall
```

It removes the app folder, the shortcuts, the Installed apps entry and the build folder. Then it asks whether to remove
your data too; the answer is "no" unless you type `y`. `-PurgeData` removes the data without asking. See
[Removing](Removing.md).

## Where your data is

`%APPDATA%\nodewise-studio`, for example `C:\Users\you\AppData\Roaming\nodewise-studio`. Keys are encrypted by Windows
(DPAPI) for your user. [The data folder](../reference/Data-Folder.md)

## Why the app is not signed, and what Windows says

Signing a Windows program needs a paid certificate the project does not have yet. Nothing is downloaded as a finished
program: the app is built on your computer. SmartScreen checks files that carry the "downloaded from the internet" mark;
the files the script builds do not carry it, so SmartScreen is not expected to ask anything when you start the app.
The project's automatic builds record whether any installed file carries the mark; this has not yet been watched on
a real desktop.

## Troubleshooting

The script ends with an exit code and a message, and prints the path of its log (by default
`%TEMP%\nodewise-studio-install.log`). The log holds every command and its output; attach it when you report a problem.

| Code | Meaning | What to do |
|---|---|---|
| 0 | Done. | Nothing. |
| 1 | Something unexpected failed. | Read the last lines of the log; report it with the log. |
| 2 | A wrong option, or two that exclude each other. | See `-Help`. |
| 3 | The system is not supported: not Windows, older than 22H2, not x64, or an old PowerShell. | Use a supported system; on Linux install a package. |
| 4 | Not enough free space. | Free space, or build elsewhere with `-BuildDir D:\build`. |
| 5 | GitHub, nodejs.org or the npm registry cannot be reached. | Check the connection; a proxy is used when `HTTPS_PROXY` is set. |
| 6 | A required tool is missing and was not installed (you said no, or winget is missing). | Run again and agree, or install App Installer from the Microsoft Store. |
| 7 | A download or a check failed: the archive is not this project, a checksum or a signature does not match, or GitHub did not name the latest release. | Run again; name a release with `-Version v1.0.0`. |
| 8 | The build failed. | The log shows the failing command; long folder paths can break it: try `-BuildDir C:\nwbuild`. |
| 9 | An install step failed; the old version is unchanged. | Read the log; check that nothing holds files in the app folder. |
| 10 | The installed app did not pass its check. | Report it with the log. |
| 11 | NodeWise Studio is running. | Quit it and run the script again. |
| 12 | Cancelled (used by the macOS script; PowerShell ends a script on Ctrl+C itself). | Run again when ready. |
| 13 | This release cannot be installed by the script: it was made before the script existed. | Use a newer release with `-Version`. |

## What is not tried yet

The project's automatic builds run this script on GitHub's Windows runners (Windows Server 2022 and the newest
Windows Server image, with Windows PowerShell 5.1 and PowerShell 7). It has not yet been tried on a range of real
computers: Windows 10 and 11 desktops, a user name with letters outside English, a proxy, `-SystemNode` with winget,
and a computer that needs the C++ build tools. If something fails, please report it with the log.

## See also

- [Installing](Installing.md)
- [Installing on macOS](Installing-On-macOS.md)
- [Updating](Updating.md)
- [Removing](Removing.md)
- [Building and running on Windows](../dev/Building-On-Windows.md)
- [Security](../trust/Security.md)
