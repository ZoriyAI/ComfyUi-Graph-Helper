[Русский](NOTICE.ru.md)

# Copyright, authorship and priority

**Copyright © 2026 Aleksey Ponomarenko (ZoriyAI). All rights reserved, except the permissions the [LICENSE](LICENSE)
grants.**

This file says who made NodeWise Studio, what in it belongs to him and what does not, what the licence allows and
forbids, and the dated record of when the project and each of its releases were first published. It describes the
project's position. It is not legal advice, and the text of the [LICENSE](LICENSE) governs.

## The author and the holder of the rights

- NodeWise Studio (https://github.com/ZoriyAI/nodewise-studio) is written and directed by **Aleksey Ponomarenko**.
  `ZoriyAI` is his GitHub account. "ZoriyAI", named in the LICENSE as the Licensor and in its copyright line, is him.
- The project merges no code, texts or other files from outside: ideas, reports and tests are welcome, contributions
  of code are not ([CONTRIBUTING.md](CONTRIBUTING.md)). No other person holds a share in the rights to the project's own
  work, so one person grants permissions and one person enforces them.
- How the work is made: much of the engineering is done by AI tools working under the author's direction, as
  [The author and the experiment](docs/wiki/trust/Author.md) says openly. How far copyright covers material made with
  such tools differs between countries and is not settled everywhere. The choices, the design, the arrangement and
  the texts are the author's decisions, and whatever rights the law gives in this work belong to him alone.

## What is the project's own

Written for this project and first published here:

- the source code of the app;
- the lesson engine and the lesson file format (`.lesson.json`);
- the 79 built-in lessons in twelve groups, their texts in English and in Russian, their steps and the reasons each
  step gives;
- the knowledge sets: the explanations of nodes, inputs, outputs, models and links, each with its provenance (where
  the explanation comes from);
- the graph check and its findings in plain words;
- the way the assistant proposes changes: grey drafts that wait for the person, who accepts or rejects them, and a
  stepwise building with requested edits to existing and new graph objects;
- the design of the interface and of its motion;
- the documentation (the wiki in two languages, the release notes, this file), the screenshots and the app icon.

## What is not the project's

- **Components of other people.** The app ships with open-source components (Electron, React, React Flow,
  better-sqlite3, the Geist font, the lucide icons and others). Each keeps its own authors and its own licence; the
  full list is in the app under Help ▸ About ▸ Third-party components and in
  [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Nothing in this file claims them.
- **ComfyUI.** ComfyUI, the ComfyUI frontend, their names, the names of their nodes and node classes (such as
  `KSampler` or `CheckpointLoaderSimple`) and their workflow file format belong to their own authors. NodeWise
  follows that format so that a saved workflow opens in ComfyUI; it contains no ComfyUI code. One table of facts,
  which core loader node reads which model folder, comes from the ComfyUI frontend and is credited in
  `src/shared/catalog/modelFolders.ts`.
- **Node packs and models** named in lessons and explanations, and their names, belong to their authors.
- **Your own work.** The pictures, clips and workflows you make with the app's help are yours.

## What the licence allows and forbids

The LICENSE is the MIT License with the "Commons Clause" License Condition v1.0. In its own words:

- MIT grants, "free of charge, to any person obtaining a copy of this software and associated documentation files",
  the right "to deal in the Software without restriction, including without limitation the rights to use, copy,
  modify, merge, publish, distribute, sublicense, and/or sell copies", on the condition that "the above copyright
  notice and this permission notice shall be included in all copies or substantial portions of the Software".
- The Commons Clause takes one right away: "the License does not grant to you, the right to Sell the Software".
  "Sell" means "practicing any or all of the rights granted to you under the License to provide to third parties,
  for a fee or other consideration (including without limitation fees for hosting or consulting/ support services
  related to the Software), a product or service whose value derives, entirely or substantially, from the
  functionality of the Software". And: "Any license notice or attribution required by the License must also include
  this Commons Clause License Condition notice."

In plain words:

- **Anyone may, for free and without asking:** use NodeWise Studio, at work too; read, copy and change it; share it,
  changed or not, as long as it is not sold.
- **Nobody may, without the written permission of the holder:** sell it; or offer, for a fee or any other
  consideration, a product or service (hosting, consulting and support included) whose value comes entirely or
  substantially from its functionality. How to ask: [COMMERCIAL.md](COMMERCIAL.md).
- **Every copy** and every substantial portion keeps the copyright notice, the MIT permission notice and the Commons
  Clause notice.
- **The texts are covered too.** The LICENSE covers the software "and associated documentation files", so the lessons,
  the knowledge sets and the documentation of this repository are under it. Whether a particular paid use of the texts
  alone is "Sell" depends on the words above; anyone who plans a paid product built on them asks first.
- The software comes without any warranty, as the LICENSE says.

## What copyright protects, and what it does not

- **Protected:** the code, the texts, the lesson content, the documentation, the images and the design, as they are
  written and drawn here. Copying them, closely or in translation, is copying this work.
- **Not protected, here or anywhere:** ideas, methods and general concepts. Copyright does not cover the idea of
  lessons on a real canvas, of explaining every node, or of an assistant whose changes wait as drafts. Anyone may build
  such a thing from scratch, in their own words and their own code.
- **Why the record of dates matters.** Being first does not stop someone else from making something similar on their
  own. It does show, with dates nobody can quietly change, which work came first and what it contained. That matters
  when a later product reproduces this one's code, texts, lessons or design.

## The name and the icon

- "NodeWise Studio", "NodeWise" and the app icon identify this project and its author.
- The LICENSE gives permissions in the software. It grants no right to use these names or the icon as the name or mark
  of another product, or to present a changed copy as the original.
- **Trademark status: not registered at this time (November 2026).** _The owner updates this line if he registers
  them: country or office, number, date._
- An unregistered name is still a name: in many countries the law on passing off or unfair competition forbids using
  it to make people take another product for this one.

## The record of dates

The project's history in Git starts with commit `47b6a4aa5a66f27e626ac3dafb07b51eb92f50f2`, dated
2026-11-07 13:48:51 UTC. The repository https://github.com/ZoriyAI/nodewise-studio holds that whole history; it was
private while versions 0.2.0 to 0.8.0 were released ([docs/releases/0.x.md](docs/releases/0.x.md)) and is public now.
The date the repository was opened is not recorded in Git.

The releases. "Published" is the time GitHub's servers recorded on the release page, in UTC.

| Version | Tag | Tagged commit | Published | Notes |
| --- | --- | --- | --- | --- |
| 0.2.0 | `v0.2.0` | `7ac44c25c588` | 2026-11-09 20:27:34 | private release ([0.x](docs/releases/0.x.md)) |
| 0.2.1 | `v0.2.1` | `4f30e07fbe91` | 2026-11-09 20:49:42 | private release |
| 0.2.2 | `v0.2.2` | `8befca374906` | 2026-11-09 21:05:47 | private release |
| 0.2.3 | `v0.2.3` | `7dc9552e63e0` | 2026-11-09 22:33:44 | private release |
| 0.2.4 | `v0.2.4` | `b6d5f406b4ff` | 2026-11-09 23:17:01 | private release |
| 0.2.5 | `v0.2.5` | `55ce267627ab` | 2026-11-10 00:11:56 | private release |
| 0.2.6 | `v0.2.6` | `f96c92aefe73` | 2026-11-10 00:33:15 | private release |
| 0.2.7 | `v0.2.7` | `e0b4664334a2` | 2026-11-10 01:06:39 | private release |
| 0.3.0 | `v0.3.0` | `c03c59af3b1c` | 2026-11-10 03:06:54 | private release |
| 0.3.1 | `v0.3.1` | `2f52a3d0ff12` | 2026-11-10 07:37:59 | private release |
| 0.3.2 | `v0.3.2` | `092071d5d0a1` | 2026-11-10 11:04:32 | private release |
| 0.4.0 | `v0.4.0` | `be04b0dc9912` | 2026-11-10 17:02:38 | private release; Learn, lessons built by hand |
| 0.4.1 | `v0.4.1` | `81883585ffb2` | 2026-11-10 17:53:58 | private release |
| 0.5.0 | `v0.5.0` | `57d0f25860e7` | 2026-11-10 22:21:25 | private release |
| 0.6.0 | `v0.6.0` | `b6d98ec792ee` | 2026-11-11 22:09:11 | private release |
| 0.7.0 | `v0.7.0` | `358adfec8324` | 2026-11-12 18:51:33 | private release |
| 0.8.0 | `v0.8.0` | `db2f11de4bda` | 2026-11-13 16:28:21 | private release ([notes](docs/releases/v0.8.0.md)) |
| 0.9.0 | `v0.9.0` | `35b5ca9d92f2` | 2026-11-15 01:57:53 | the first release after the project was published ([notes](docs/releases/v0.9.0.md)) |
| 1.0.0 | `v1.0.0` | `44a9b9547e6d` | 2026-11-15 12:11:01 | [notes](docs/releases/v1.0.0.md) |
| 1.1.0 | `v1.1.0` | `666760feca77` | 2026-11-15 14:52:33 | [notes](docs/releases/v1.1.0.md) |
| 1.2.0 | `v1.2.0` | `8bdd5f6d4d9f` | 2026-11-15 20:46:05 | [notes](docs/releases/v1.2.0.md) |
| 1.2.1 | `v1.2.1` | `5a4b41f2fc8c` | 2026-11-15 21:46:50 | [notes](docs/releases/v1.2.1.md) |
| 1.2.2 | `v1.2.2` | `57446912e74d` | 2026-11-15 23:45:48 | [notes](docs/releases/v1.2.2.md) |
| 1.2.3 | `v1.2.3` | `3e938489da26` | 2026-11-16 01:00:55 | [notes](docs/releases/v1.2.3.md) |
| 1.2.4 | `v1.2.4` | `b18112c7f347` | 2026-11-16 02:28:57 | [notes](docs/releases/v1.2.4.md) |
| 1.2.5 | `v1.2.5` | `2f715679397c` | 2026-11-16 04:37:10 | [notes](docs/releases/v1.2.5.md) |
| 1.2.6 | `v1.2.6` | `465350ec3fdd` | 2026-11-16 05:02:06 | [notes](docs/releases/v1.2.6.md) |
| 1.2.7 | `v1.2.7` | `1e63b7997637` | 2026-11-16 15:40:00 | [notes](docs/releases/v1.2.7.md) |
| 1.2.8 | `v1.2.8` | release tag | see release page | [notes](docs/releases/v1.2.8.md) |
| 1.3.0 | `v1.3.0` | release tag | see release page | [notes](docs/releases/v1.3.0.md) |

A release cannot hold its own publication time, so each row is filled in by the first commit after that release.

What 1.0.0 first publishes, as its notes describe it:

- the lesson engine and the lesson file format (`.lesson.json`, data only);
- 79 lessons in twelve groups, in English and in Russian;
- explanations of every node, input, output and link, each saying where it comes from;
- the read-only connection: every request to ComfyUI goes through one gate, `GET` only, on a short list of routes;
- the graph check, with findings in plain words on every node it marks;
- grey drafts: a change the assistant proposes to your own work waits until you accept or reject it;
- My lessons: lessons of your own, made from a graph, edited, exported and imported as files.

## How anyone can check these dates

1. **The Git history.** Clone the repository and run `git log --reverse` and `git show <hash>`. Each commit hash
   depends on every commit before it, so a published history cannot be changed without changing every later hash,
   and any clone made earlier would show the difference. A commit date by itself is written by the author's own
   computer: it is the author's statement, and the witnesses below confirm it.
2. **The release pages on GitHub.** Each release page carries the time GitHub recorded when it was published, and the
   files attached to it.
3. **Checksums, a component list and a build provenance attestation**, from 0.9.0 on. The release workflow
   (`.github/workflows/release.yml`) writes `SHA256SUMS` over every release file and a CycloneDX component list
   (`nodewise-studio-<version>.cdx.json`), checks the sums again before publishing, and attaches a build provenance
   attestation to the packages, the component list, the two install scripts and `SHA256SUMS`: a signed statement of
   which repository, workflow and commit built each file. Anyone can check a file with
   `gh attestation verify <file> --repo ZoriyAI/nodewise-studio`. For a public repository such attestations are also
   written to a public transparency log. Versions 0.2.0 to 0.8.0 were released without checksums or attestations.
4. **Archives kept by others.** A snapshot of the repository in the Internet Archive's Wayback Machine or in Software
   Heritage is a further witness that no party to a dispute controls. _Action for the owner: request such snapshots
   after each release (see [the repository card](docs/REPOSITORY-CARD.md#to-strengthen-the-record)). None is claimed
   here as made._

## If you find a copy

**A breach of the licence** is:

- selling NodeWise Studio or a changed copy, or offering for a fee or other consideration a product or service whose
  value comes entirely or substantially from it, without the holder's written permission;
- shipping its code or content, or a substantial portion of them, without the copyright notice, the MIT permission
  notice and the Commons Clause notice.

**Also not allowed**, by law rather than by the licence: using the name "NodeWise" or the app icon to pass another
product off as this one.

**Not a breach:** using the app, changing it, sharing it for free with the notices, and building something on similar
ideas from scratch.

**How to report it:** privately, through GitHub. Write to the owner through his profile (https://github.com/ZoriyAI),
or use the repository's private report form (Security ▸ Report a vulnerability, which only the owner reads; see
[SECURITY.md](SECURITY.md)). Give the address of the copy, what was copied and where you saw it. Please do not accuse
anyone in public: a mistaken accusation harms people and weakens the record.

**What the holder may then do:** ask whoever made the copy to restore the notices, or to stop selling or shipping it;
and where copied code or content is hosted on GitHub, send GitHub a notice under its DMCA Takedown Policy, after which
GitHub may disable the content and the other side may answer with a counter notice.

---

This file describes the project's position on its rights. It is not legal advice; the text of the [LICENSE](LICENSE)
governs.
