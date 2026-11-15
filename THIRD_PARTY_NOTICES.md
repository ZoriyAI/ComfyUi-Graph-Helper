[Русский](THIRD_PARTY_NOTICES.ru.md)

# Third-party notices

CozyGraph ships with open-source components made by other people. Each keeps its own licence.

## Where the full list is

The full list, with the version, the licence and the licence text of every component that ships with the app, is
written when the app is built:

- in the app: Help ▸ About ▸ Third-party components;
- in the installed package: `/usr/share/doc/cozygraph/copyright` <!-- verify: technical rename --> (the app's licence first, then the
  notices);
- in a build from source: `dist/notices/THIRD_PARTY_NOTICES.txt` and `dist/notices/third-party.json`, written by
  `scripts/build-assets.js` during `npm run build`.

The list covers the packages the main process uses at run time, the packages the window's bundle is built from, and
Electron. Chromium, which comes with Electron, has its own list: `LICENSES.chromium.html` next to the program
(About ▸ Third-party components ▸ Chromium licences).

## Worth naming here

- **Geist** font (`@fontsource/geist`): SIL Open Font License 1.1.
- **React Flow** (`@xyflow/react`, `@xyflow/system`): MIT. Its attribution stays visible on the canvas.
- **lucide** icons (`lucide-react`): ISC.
- **Vercel AI SDK** (`ai`, `@ai-sdk/*`) and the **Model Context Protocol** SDK (`@modelcontextprotocol/*`):
  Apache License 2.0.
- **Electron**: MIT; **better-sqlite3**: MIT.

## The ComfyUI frontend

So that a workflow saved here opens in ComfyUI as it is, the app follows the file format and the behaviour of the
ComfyUI frontend (`Comfy-Org/ComfyUI_frontend`, GPL-3.0): the order of widget values, slot numbers, subgraph
definitions. It contains no code of that project. One table of facts, which core loader node reads which model
folder, was taken from its file `modelNodeMappings.ts` and is credited in `src/shared/catalog/modelFolders.ts`.

The app's own licence is in [LICENSE](LICENSE).
