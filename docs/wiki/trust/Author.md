[Русский](Author.ru.md)
[Home](../Home.md) › [Trust](README.md)

# The author and the experiment

Who makes NodeWise Studio, why it exists, and what that means for you when you use it.

## Who makes it

NodeWise Studio is made by Aleksey Ponomarenko, an independent developer who experiments in the field of AI
development.

## The experiment

NodeWise is one of these experiments. Two questions drive it.

1. **Can a program teach a tool as tangled as ComfyUI by explaining your own graph?** Not a general course, but the
   nodes, links and models that are on your screen right now, with an assistant that shows its reasons instead of
   silently doing the work for you.
2. **How far can one developer take a real desktop product when AI agents do much of the engineering under his
   direction?** Every change is meant to pass the tests, and the way the work is done stays in the public repository
   for anyone to read.

## What this means for you

- **The project moves fast.** Things change between versions, sometimes a lot.
- **It is experimental.** Some parts are unfinished and some have rough edges. There is no promise of support.
- **It says what was checked and what was not.** What the app does not do yet is in
  [Known limitations](../reference/Known-Limits.md); what has not been tried on a real install is listed in
  [Releasing](../dev/Releasing.md#not-yet-tried-on-a-real-install) and in each version's release notes.

## The principles

Each principle below is a promise the app keeps today, and the linked page says how.

- **Catalog reads preserve your ComfyUI.** Models, extensions and the queue stay unchanged. Uploading media requires you to select a file; generation runs in ComfyUI. [Access details](Read-Only.md)
- **It explains instead of hiding.** Every node, input, output and link has an explanation that says where it comes
  from, and when the assistant builds, it writes next to each node why it is there.
  [The assistant](../assistant/Assistant.md)
- **Requested edits stay under your control.** Assistant and Build modes can carry out requested changes to existing graphs. Explain mode offers answers and drafts without graph edits. History records changes so you can undo them. [Assistant modes](../assistant/Assistant.md)
- **Your keys stay with you.** There is no account, no telemetry and no crash reporting. Keys are kept on your
  computer, and each one goes only to the address it was pasted for. Every place the app can contact, and what goes
  there, is listed. [Privacy](Privacy.md), [Security](Security.md)
- **Plain words, two languages.** The interface and every page of this documentation are in English and in Russian,
  written for a person who has never used ComfyUI.
- **Free to use, not for sale.** The licence is MIT with the Commons Clause: you may use, change and share the app for
  free, but not sell it. [License and third-party notices](Licence.md)

## How to take part

The author can be reached through the project on GitHub only.

- **Ideas and wishes:** the project's Discussions.
- **Problems:** the project's Issues. Help ▸ Report a problem in the app opens the form with the versions filled in.
- **A security problem:** privately, as described in [Security](Security.md#reporting-a-vulnerability).
- **Code and texts** are written by the author; the project does not merge code from outside. Ideas, reports and
  tests of the app are how to take part: [Contributing](../dev/Contributing.md).
- **Commercial use:** contact the author through GitHub first: [Commercial use](../../../COMMERCIAL.md).

## See also

- [Trust](README.md)
- [What the app is](../start/What-It-Is.md)
- [Known limitations](../reference/Known-Limits.md)
- [License and third-party notices](Licence.md)
