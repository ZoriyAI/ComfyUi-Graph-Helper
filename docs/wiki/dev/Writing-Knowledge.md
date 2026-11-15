[Русский](Writing-Knowledge.ru.md)
[Home](../Home.md) › [For developers](README.md)

# Writing built-in knowledge

Built-in knowledge lets the canvas explain the basics before any model is set up: what a core node does, what a link
type carries, what a model family needs. It is written by hand in English and Russian.

## Where it is

| What | Where |
| --- | --- |
| The lists of what is covered | `src/shared/knowledge/coreKnowledge.ts`: `CORE_NODE_CLASSES`, `CORE_LINK_TYPES`, `CORE_FAMILIES`, and links to the official ComfyUI documentation (`CORE_NODE_DOCS`). |
| The texts | `coreKnowledge.en.ts` and `coreKnowledge.ru.ts`: `nodes`, `linkTypes`, `families`. |
| Into the database | `src/main/knowledge/seedCore.ts` writes them as explanations in the interface language, and rewrites them when the language changes. |
| Model families | `src/shared/knowledge/baseModel.ts` (how a file's family is recognised), `modelKind.ts`. |

## The shape

- A node or a link type: `what` (what it is), `why` (why it is used), `connect` (what goes in and out) and an optional
  `risk` (a common mistake).
- A family: what it is, which loaders it needs, and the compatibility pitfall.

## Rules

- **Truth first.** `what` and `connect` describe standard ComfyUI behaviour and are shown as *fact*, with the official
  documentation page when there is one (every address checked against `docs.comfy.org`). `why` and `risk` are advice
  and shown as *inference*. A family note is a fact only when an official tutorial backs the parts it names.
- **Both languages, the same items.** The Russian text in Russian, the English text without Cyrillic; the same
  optional `risk` notes in both.
- **Short.** A description card shows the first line; the explanations tab shows the rest.
- **No secrets, no model names of chat assistants, no links outside `docs.comfy.org`.**

## Adding a node, a type or a family

1. Add its id to the list in `coreKnowledge.ts` (the class name as ComfyUI spells it).
2. Add its texts to both `coreKnowledge.en.ts` and `coreKnowledge.ru.ts`.
3. Add its documentation link, or `null` when there is none.
4. Run `npx vitest run tests/unit/coreKnowledge.test.ts`: it checks every item in both languages, the language of
   each text, the links and how each text is marked.
5. If a wiki page explains the same idea (`docs/wiki/concepts/`), keep the two saying the same.

## See also

- [For developers](README.md)
- [Writing a lesson](Writing-A-Lesson.md)
- [Texts and languages](Texts-And-Languages.md)
