[Русский](Releasing.ru.md)
[Home](../Home.md) › [For developers](README.md)

# Releasing

How a version is made public, and what is still checked only by hand.

## Source checks required by publication

The release job waits for type checking, lint, the complete unit suite, E2E, screen walks, Linux packages and the reusable Windows/macOS installer workflow. Every source checkout is pinned to the plan job’s `source_sha`. The reusable installer run skips its unrelated latest-release check. These dependencies prevent a tag or manual workflow invocation from publishing while another required check is pending or failed. A local/manual release must record its actual checks and untested platforms separately; a workflow definition is not evidence that its remote jobs ran.


## The checklist

1. **Notes in both languages.** `docs/releases/vX.Y.Z.md` (English; its first line links to the Russian file) and
   `docs/releases/vX.Y.Z.ru.md`. The paragraph under the title is the summary. The English file is the text of the
   release page.
2. **The change lists.** `node scripts/changelog.js` writes `CHANGELOG.md` and `CHANGELOG.ru.md` from the notes;
   `--check` fails when they are out of date (CI runs it).
3. **The version.** `npm version X.Y.Z --no-git-tag-version`.
4. **The wiki.** `WIKI_STRICT=1 npx vitest run tests/unit/wiki.test.ts` lists every `verify` and `skeleton` comment
   left in the documentation. Resolve each against the code; what cannot be checked here is said as "not tried" in
   the page itself and listed below. [Writing wiki pages](Wiki-Style.md)
5. **Nothing private.** `node scripts/public-tree-check.js` (CI runs it too). [Publishing a clean copy](Publishing-A-Clean-Copy.md)
6. **The project address.** `PROJECT_URL` in `src/main/identity.ts` and `homepage`, `repository`, `bugs` in
   `package.json` name the real repository (`tests/unit/identity.test.ts` compares them); until then the app greys out
   its project links and asks nothing about new versions.
7. **The install scripts.** The latest run of "Install scripts" (`.github/workflows/install-scripts.yml`) on the
   release commit is green on Windows and macOS: the scripts are release files, and the one-line installs in the
   README download them from the latest release.
8. **Release.** Push a tag `vX.Y.Z`, or run the workflow "Build and package" by hand with `release_tag`. The plan job
   checks that the tag, the version in `package.json` and the notes agree, and the release is made from that exact
   commit.

## What the release workflow runs

`.github/workflows/release.yml` (main pushes, tags, by hand, and weekly when the week had commits): end-to-end tests; the screen
walk in Russian at every size, in English at two sizes, and with wider text at 125 %; the four packages made and
started, `desktop-file-validate`, `shellcheck`, `lintian`, the installed `.deb` check; the upgrade test from the
newest earlier release (skipped with a notice when there is none); the `.rpm` installed in a Fedora container;
`install-windows.ps1` and `install-macos.sh` copied into the release files; `SHA256SUMS` over all of them and
an SBOM; then, in the `release` environment, the release with build provenance attestation. `scripts/release-plan.js`
refuses to publish a file list without the two install scripts and `SHA256SUMS`.
Every pull request and push runs the fast checks of `.github/workflows/ci.yml`. [Package formats](Package-Formats.md)

## For the repository page

The description, website and topics of the GitHub "About" box, the social preview picture and the settings only the
owner can change are in `docs/REPOSITORY-CARD.md`. Suggested one-line description: "NodeWise Studio: a desktop tutor for
ComfyUI graphs". Topics: `comfyui`, `comfyui-workflow`, `stable-diffusion`, `generative-ai`, `learning`, `tutorial`,
`education`, `node-graph`, `desktop-app`, `electron`, `linux`, `ai-assistant`.

## Not yet tried on a real install

Qualified state on 17 November 2026:

- Real ComfyUI 0.45.3: 3375 node types, 797/797 model files, direct reads when MCP is unavailable. [Catalog report](https://github.com/ZoriyAI/nodewise-studio/blob/v1.3.0/docs/research/2026-11-17-live-catalog.md).
- 678 official workflows passed preservation and editing, with separate checks against current real ComfyUI forms. [Compatibility](https://github.com/ZoriyAI/nodewise-studio/blob/v1.3.0/docs/research/2026-11-17-native-compatibility.md).
- A real local model passed construction, pause, restart and continuation; native Ollama released GPU memory on exit. [Agent runtime](https://github.com/ZoriyAI/nodewise-studio/blob/v1.3.0/docs/research/2026-11-17-agent-runtime.md).
- Isolated Electron windows passed at 200% on 1080p and 100% on 4K. Real AT-SPI events and Orca-generated speech were checked; human listening was not. [Accessibility](../trust/Accessibility.md).

Separate acceptance remains for:

1. Physical Android/iOS devices and an independent beginner’s installation-to-result journey. Emulated touch and all fifty guide screens do not replace them.
2. ComfyUI Desktop, ComfyUI on Windows, backslash paths and different Manager versions on real installations; older `/experiment` routes, slow disks and sign-in proxies.
3. Authenticated real artokun/comfyui-mcp and joenorton/comfyui-mcp-server. Direct ComfyUI fallback after 401 was checked, successful authentication to those servers was not.
4. Desktop `.deb` installation with apt, `.rpm` with dnf on Fedora and AppImage on different distributions. CI checks installation and upgrade; local package qualification must state its isolation and previous version separately.
5. The 0.9 migration with real GNOME/KWallet keys, KWallet5/6 themselves, and the old 0.9 update notice for renamed releases.
6. Real Windows 10/11 PCs and Macs: non-Latin user names, proxies, system Node, build tools, OS menus/shortcuts, Keychain after updates and key removal. GitHub checks scripts at the exact source, not every device. Linux keychain choices are no longer shown as settings for those systems.
7. A complete screen-reader journey, human listening and additional system scaling combinations.
8. Fresh OS installations using the published ComfyUI commands; real Windows/macOS signing credentials and signed binary package installation.

New evidence closes its specific scenario only. Reports and release notes must retain these boundaries.

## See also

- [For developers](README.md)
- [Package formats](Package-Formats.md)
- [Publishing a clean copy](Publishing-A-Clean-Copy.md)
