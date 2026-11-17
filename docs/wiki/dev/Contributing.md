[Русский](Contributing.ru.md)
[Home](../Home.md) › [For developers](README.md)

# Contributing

NodeWise Studio takes ideas, reports and tests from everyone, and its code from one person: the author. This page
says how to take part and why pull requests with code are not merged. The same in more detail:
[CONTRIBUTING.md](../../../CONTRIBUTING.md) at the top of the project.

## How to take part

- **Test the install scripts.** The Windows and macOS scripts have not been tried on real computers yet
  ([Installing on Windows](../start/Installing-On-Windows.md), [Installing on macOS](../start/Installing-On-macOS.md)).
  Open an issue with the form "Test report: Windows or macOS install": the system version, the script, what happened,
  the exit code and the log file the script names at the end.
- **Report a problem** in the project's Issues. Help ▸ Report a problem fills in the versions.
- **Ideas, wishes and questions** go to the project's Discussions.
- **A mistake in the documentation:** open an issue that names the page, quotes the sentence and says what it should
  say. The author makes the change.
- **A lesson of your own:** attach its `.lesson.json` file to a discussion. It stays yours; others import it
  ([The lesson file format](../lessons/Lesson-File-Format.md)).
- **A security problem:** privately, as in [Security](../trust/Security.md#reporting-a-vulnerability).

## Why code is not accepted

The author keeps the copyright of the whole project in one hand, so its licence and its future stay clear. A change
written by someone else would need a written agreement about its rights, and the project does not run such agreements.

A pull request that arrives anyway is closed with thanks and a request to describe the idea in an issue. The author may
build the idea himself. By posting an idea, a wish or a report in Issues or Discussions you agree that the author may
use it freely, with no claim to rights, payment or credit for the result. This is a plain statement of how the project
works, not legal advice.

## Reading and building the code for yourself

The licence (MIT with the Commons Clause) lets you read, build and change your own copy, as long as it is not sold.
The pages of this chapter are written for that:

- [Building from source](Building-From-Source.md): set up, build, run; a development run takes its own profile with
  `--user-data-dir`.
- [Testing](Testing.md): the checks and what each kind of test covers.
- [Architecture](Architecture.md) and the [Code map](Code-Map.md): where to start reading.

The rules the author's own changes keep are worth knowing when you change your copy: catalog access is read-only, and media uploads require explicit file selection
([Reading ComfyUI](Reading-ComfyUI.md)); keys never reach the window, a log or a file
([Security](../trust/Security.md)); every IPC call is checked ([IPC](IPC.md)); every text exists in English and
Russian ([Texts and languages](Texts-And-Languages.md)).

Everyone taking part follows the code of conduct (`CODE_OF_CONDUCT.md`).

## See also

- [For developers](README.md)
- [Architecture](Architecture.md)
- [Testing](Testing.md)
- [The author and the experiment](../trust/Author.md)
