[Русский](Releasing.ru.md)
[Home](../Home.md) › [For developers](README.md)

# Releasing

How a version is made public, and what is still checked only by hand.

## The checklist

1. **Notes in both languages.** `docs/releases/vX.Y.Z.md` (English; its first line links to the Russian file) and
   `docs/releases/vX.Y.Z.ru.md`. The paragraph under the title is the summary. The English file is the text of the
   release page.
2. **The change lists.** `node scripts/changelog.js` writes `CHANGELOG.md` and `CHANGELOG.ru.md` from the notes;
   `--check` fails when they are out of date (CI runs it).
3. **The version.** `npm version X.Y.Z --no-git-tag-version`.
4. **The wiki.** `WIKI_STRICT=1 npx vitest run tests/unit/wiki.test.ts` lists every `verify` and `skeleton` comment
   left in the documentation; resolve them or accept them knowingly.
5. **Nothing private.** `node scripts/public-tree-check.js` (CI runs it too). [Publishing a clean copy](Publishing-A-Clean-Copy.md)
6. **The project address.** `PROJECT_URL` in `src/main/identity.ts` and `homepage`, `repository`, `bugs` in
   `package.json` name the real repository (`tests/unit/identity.test.ts` compares them); until then the app greys out
   its project links and asks nothing about new versions.
7. **Release.** Push a tag `vX.Y.Z`, or run the workflow "Build and package" by hand with `release_tag`. The plan job
   checks that the tag, the version in `package.json` and the notes agree, and the release is made from that exact
   commit.

## What the release workflow runs

`.github/workflows/release.yml` (tags, by hand, and weekly when the week had commits): end-to-end tests; the screen
walk in Russian at every size, in English at two sizes, and with wider text at 125 %; the four packages made and
started, `desktop-file-validate`, `shellcheck`, `lintian`, the installed `.deb` check; the upgrade test from the
newest earlier release (skipped with a notice when there is none); the `.rpm` installed in a Fedora container;
`SHA256SUMS` and an SBOM; then, in the `release` environment, the release with build provenance attestation.
Every pull request and push runs the fast checks of `.github/workflows/ci.yml`. [Package formats](Package-Formats.md)

## For the repository page

The description, website and topics of the GitHub "About" box, the social preview picture and the settings only the
owner can change are in `docs/REPOSITORY-CARD.md`. Suggested one-line description: "CozyGraph: a desktop tutor for
ComfyUI graphs". Topics: `comfyui`, `comfyui-workflow`, `stable-diffusion`, `generative-ai`, `learning`, `tutorial`,
`education`, `node-graph`, `desktop-app`, `electron`, `linux`, `ai-assistant`.

## Not yet tried on a real install

The connection is checked against test servers that speak ComfyUI's routes. Before calling it verified, try on a real
machine:

1. ComfyUI started from its folder on 8188 and the desktop app on 8000 are both found by Find on this computer.
2. ComfyUI on Windows: model paths come back with backslashes and sub-folders with `\`; previews load.
3. A large install (3000 or more node types) reads `/object_info` within 180 seconds.
4. A ComfyUI older than the `/experiment` routes shows model names only.
5. With and without ComfyUI-Manager: the pack names match the folders in `custom_nodes`.
6. ComfyUI on another computer started with `--listen`: it reads over `http`, and the hints appear.
7. `/view_metadata` answers 404 for files without metadata, and the header read stops there.
8. Real artokun/comfyui-mcp and joenorton/comfyui-mcp-server: their tool schemas match what the app recognises.
9. On spinning disks the preview route takes about a second per file during the background read.
10. ComfyUI behind a proxy with a sign-in: the app says the address sends it to another page.

Packages: installing the `.deb` with apt on a real desktop, the `.rpm` with dnf on Fedora, the final AppImage file,
and the upgrade from an earlier release are checked on CI only.

## See also

- [For developers](README.md)
- [Package formats](Package-Formats.md)
- [Publishing a clean copy](Publishing-A-Clean-Copy.md)
