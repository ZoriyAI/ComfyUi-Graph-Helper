[Русский](Installing-On-macOS.ru.md)
[Home](../Home.md) › [Start](README.md)

# Installing on macOS

There is no ready macOS package yet. Instead, each release has a script, `install-macos.sh`, that builds the app on
your Mac from the project's own source and installs it for you. One command does everything; this page says what it
does, what it asks and how to undo it.

## What you need

- macOS 13 Ventura or newer, on Apple silicon (M1 and later) or Intel.
- About 3.5 GB of free space for the build (it is removed at the end) and 600 MB for the app.
- An internet connection to `github.com`, `nodejs.org` and `registry.npmjs.org`.
- No administrator password, unless you choose `/Applications` or a Node.js for the whole Mac.

## The one command

Open **Terminal** (Launchpad ▸ Other ▸ Terminal) and paste:

```bash
curl -fsSL https://github.com/ZoriyAI/nodewise-studio/releases/latest/download/install-macos.sh -o install-macos.sh && bash install-macos.sh
```

The project's front page (README) shows the same line with the address filled in.

## The careful way

1. Download `install-macos.sh` and `SHA256SUMS` from the release page.
2. Check the file: `grep ' install-macos.sh$' SHA256SUMS | shasum -a 256 -c` must say `install-macos.sh: OK`.
3. Read the script. It is plain text; every step has a comment.
4. See the plan without changing anything: `bash install-macos.sh --dry-run`
5. Run it for real: `bash install-macos.sh`

## What it does, step by step

1. **Checks this Mac**: the macOS version, the processor, free space, the connection to GitHub, nodejs.org and the npm
   registry, and that NodeWise Studio is not running.
2. **Gets the source** of the latest release from GitHub as an archive (no Git needed) into a private build folder,
   `~/Library/Caches/nodewise-studio-installer`, and checks that it is this project: the archive's folder name, the
   names and the version in its `package.json`.
3. **Node.js for the build.** If Node.js of the version the project needs (22) is already on your Mac (from
   nodejs.org, Homebrew, nvm or fnm), it is used. Otherwise a private copy is downloaded from nodejs.org into the build
   folder and checked against nodejs.org's `SHASUMS256.txt`. Homebrew is not needed, and your own Node.js is never
   changed.
4. **Builds the app**: `npm ci`, `npm run build`, then Electron Forge makes `NodeWise Studio.app`. The database module
   comes ready-made for Apple silicon and Intel Macs, so Apple's Command Line Tools are not needed. This step takes
   the longest.
5. **Installs** into `~/Applications/NodeWise Studio.app` (the folder is created if needed): the new copy is prepared
   next to the old one, signed for this Mac (see below) and then swapped in, so a failure leaves the old version
   working.
6. **Checks the installed app**: it must print its version with `--version`, open its window with a throw-away
   profile and refuse to start twice. Your own data folder and Keychain are not touched by this check.

At the end it prints where the app is, where your data is, how to start and remove it, and where the log is.

## How long it takes

Most of the time is the download of the packages and the build: about 5 to 15 minutes on a usual connection. Nothing
needs you while it runs.

## What it asks

Nothing, in the usual case. It asks once, before anything is installed for the whole Mac, only when you choose that
yourself (`--system-node`), or when a future version has no ready-made database module for your Mac (then it offers
Apple's Command Line Tools: a system window opens and the script waits until they are installed). `--yes` answers
these questions with yes. Removing your data is never done without your clear answer.

## Options

| Option | What it does |
|---|---|
| `--version v1.0.0` | Builds this release instead of the latest one. |
| `--main` | Builds the newest code of the main branch (not a release; may be broken). |
| `--source <folder>` | Builds from a folder that already holds the source. |
| `--system-applications` | Installs into `/Applications` instead of `~/Applications`. |
| `--system-node` | Installs Node.js for the whole Mac from the official installer (asks for your password). |
| `--private-node` | Uses a private copy of Node.js even when a fitting one is installed. |
| `--dry-run` | Prints every step and changes nothing. |
| `--keep-build` | Keeps the build folder (about 1.5 GB) after the install. |
| `--build-dir <folder>` | Builds somewhere else. |
| `--log <file>` | Writes the log there instead of `~/Library/Logs/nodewise-studio-install.log`. |
| `--lang en` or `ru` | The language of the messages; by default the language of the Mac. |
| `--uninstall`, `--purge-data` | See "Removing" below. |
| `--help` | Lists the options and the exit codes. |

## Updating

Run the same command again. It builds the latest release and replaces the app in place. Your settings, keys, projects
and conversations stay, because they live in a separate folder. Quit the app first, or the script stops and says so.

After an update macOS may ask once whether NodeWise Studio may use "nodewise-studio Safe Storage" in your keychain:
each build is signed anew on your Mac, and the Keychain sees a new program. Enter your login password and choose
"Always Allow". This is expected from how the Keychain treats such signatures; it has not been watched on a real Mac yet.

## Removing

```bash
bash ~/Library/Application\ Support/nodewise-studio-installer/install-macos.sh --uninstall
```

It removes the app, the installer's own folder and the build folder. Then it asks whether to remove your data too;
the answer is "no" unless you type `y`. `--purge-data` removes the data without asking, together with the Keychain
item and the app's preferences file. See [Removing](Removing.md).

## Where your data is

`~/Library/Application Support/nodewise-studio`. Keys are encrypted with a key that macOS keeps in your login Keychain
under "nodewise-studio Safe Storage". [The data folder](../reference/Data-Folder.md)

## Why the app is not signed, and what macOS says

Signing and notarizing a Mac app needs a paid Apple developer membership the project does not have yet. So the script
signs the app "ad hoc" on your Mac (`codesign --sign -`): such a signature names no publisher, it only lets an Apple
silicon Mac run the code and lets macOS notice if the files change later. Gatekeeper checks apps that carry the
"downloaded from the internet" mark; an app built on your Mac does not carry it (the script also clears it), so
macOS is not expected to show the "cannot be opened" warning. The project's automatic builds record what `codesign`
and Gatekeeper's `spctl` say about the installed app and open it the way a double-click in Finder does; this has not
yet been watched on a range of real Macs.

## Troubleshooting

The script ends with an exit code and a message, and prints the path of its log (by default
`~/Library/Logs/nodewise-studio-install.log`). The log holds every command and its output; attach it when you report a
problem.

| Code | Meaning | What to do |
|---|---|---|
| 0 | Done. | Nothing. |
| 1 | Something unexpected failed. | Read the last lines the script printed; report it with the log. |
| 2 | A wrong option, or two that exclude each other. | See `--help`. |
| 3 | The system is not supported: not macOS, older than 13, an unknown processor, or started with `sudo`. | Use a supported Mac; run without `sudo`. |
| 4 | Not enough free space. | Free space, or build elsewhere with `--build-dir`. |
| 5 | GitHub, nodejs.org or the npm registry cannot be reached. | Check the connection; a proxy is used when `https_proxy` is set. |
| 6 | A required tool is missing and was not installed (you said no). | Run again and agree. |
| 7 | A download or a check failed: the archive is not this project, a checksum or a signature does not match, or GitHub did not name the latest release. | Run again; name a release with `--version v1.0.0`. |
| 8 | The build failed. | The log shows the failing command. |
| 9 | An install step failed; the old version is unchanged. | Read the log; for `/Applications` check that you may write there. |
| 10 | The installed app did not pass its check. | Report it with the log. |
| 11 | NodeWise Studio is running. | Quit it and run the script again. |
| 12 | Cancelled with Ctrl+C. | Run again when ready. |
| 13 | This release cannot be installed by the script: it was made before the script existed. | Use a newer release with `--version`. |

## What is not tried yet

The project's automatic builds run this script on GitHub's macOS runners, Apple silicon and Intel, with the bash 3.2
that macOS ships. It has not yet been tried on a range of real Macs: macOS 13 itself (the runners have newer
versions), a proxy, `--system-node`, `--system-applications`, a Mac that needs the Command Line Tools, and the
Keychain question after an update. If something fails, please report it with the log.

## See also

- [Installing](Installing.md)
- [Installing on Windows](Installing-On-Windows.md)
- [Updating](Updating.md)
- [Removing](Removing.md)
- [Building and running on macOS](../dev/Building-On-macOS.md)
- [Security](../trust/Security.md)
