[Русский](Licence.ru.md)
[Home](../Home.md) › [Trust](README.md)

# License and third-party notices

**NodeWise Studio: a desktop tutor for ComfyUI graphs**

NodeWise is an independent, experimental learning tool. It is not affiliated with or endorsed by Comfy Org. It
contains no ComfyUI code and only reads a running ComfyUI; it never changes it.

This page explains the license in plain words. It is an explanation, not the license: the text that counts is the
`LICENSE` file at the top of the project, also shown in the app under Help ▸ About ▸ License.

## The license in one paragraph

NodeWise is under the MIT license with the Commons Clause condition. MIT lets you use, copy, change and share the
software. The Commons Clause takes one thing away: the right to sell it. That makes the project **source-available**:
everyone can read, use and change the source, but it is not open source in the usual sense, because selling is not
allowed.

## What you may do

- Use the app, for work too: learn ComfyUI with it, build workflows with it, and use and sell the pictures and clips
  you then make in ComfyUI.
- Read the source and learn from it.
- Change it for yourself.
- Share a copy, changed or not, for free, as long as the license text goes with it.
- Use it in a course or a workshop you teach.

## What you may not do

Unless the copyright holder has agreed in writing:

- sell the app or a changed copy of it;
- offer a paid service, hosting or support whose value comes mainly from the app;
- put it inside a paid product whose value comes mainly from the app.

How to ask for permission: [Commercial use](../../../COMMERCIAL.md).

## No warranty

The software comes "as is", without any warranty. It is an experimental project: things change between versions and
some parts are unfinished.

## Components of other people

The app ships with open-source components made by other people (Electron, React, React Flow, better-sqlite3, the
Geist font and others). Each keeps its own license. The full list, with each license text, is in the app under Help ▸
About ▸ Third-party components, and in the installed package in `/usr/share/doc/nodewise-studio/copyright`.
Chromium has its own list: About ▸ Third-party components ▸ Chromium licenses.

## The ComfyUI frontend

| Question | Answer |
| --- | --- |
| Does NodeWise contain ComfyUI code? | No. |
| Why does it follow the ComfyUI frontend? | So that a saved workflow opens in ComfyUI as it is: the order of widget values, slot numbers, subgraph definitions. |
| Was anything taken from the frontend? | One table of facts: which core loader node reads which model folder (from `modelNodeMappings.ts` of `Comfy-Org/ComfyUI_frontend`, GPL-3.0). It is credited in `src/shared/catalog/modelFolders.ts`. |
| Does the app change ComfyUI? | No. It only reads a running ComfyUI. [ComfyUI is only read](Read-Only.md) |

ComfyUI and the ComfyUI frontend are projects of their own authors, under their own licenses.

## See also

- [Trust](README.md)
- [Commercial use](../../../COMMERCIAL.md)
- [Third-party notices](../../../THIRD_PARTY_NOTICES.md)
- [Privacy](Privacy.md)
