Русская версия: [CONTRIBUTING.ru.md](CONTRIBUTING.ru.md)

# Taking part

NodeWise Studio is an experimental desktop app that helps you learn ComfyUI and understand its graphs. It is made by
one author, Aleksey Ponomarenko, at https://github.com/ZoriyAI/nodewise-studio. You can help a lot without writing a
line of code, and this page says how.

## What helps most

- **Try the app and tell what happened.** The most useful thing right now is a test of the new install scripts for
  Windows and macOS: they have not been tried on real computers yet. Run one
  ([Windows](docs/wiki/start/Installing-On-Windows.md), [macOS](docs/wiki/start/Installing-On-macOS.md)), then open an
  [issue](../../issues/new/choose) with the form "Test report: Windows or macOS install": your system version, the
  script, what happened, the exit code and the log file the script names at the end
  (`%TEMP%\nodewise-studio-install.log` or `~/Library/Logs/nodewise-studio-install.log`). A report that says "it
  worked" is just as welcome as one that says it did not.
- **Report a problem** in [Issues](../../issues). Help ▸ Report a problem in the app opens the form with the versions
  filled in; Help ▸ Copy diagnostics gives a log without keys or tokens.
- **Share ideas and wishes** in [Discussions](../../discussions). An idea that is still half-formed is fine there.
- **Ask questions** in [Discussions](../../discussions). A question that the documentation did not answer shows where
  it should.
- **Point out a mistake in the documentation** in an issue: name the page (its file in `docs/wiki` or its title in
  Help), quote the sentence as it is, and say what it should say. The author makes the change.
- **Share a lesson of your own** in [Discussions](../../discussions). Export it from My lessons and attach the
  `.lesson.json` file; others import it with File ▸ Import lessons…. The lesson stays yours: sharing it in a
  discussion does not put it into the project. The format: [The lesson file format](docs/wiki/lessons/Lesson-File-Format.md).

A security problem goes privately, not to Issues: see [SECURITY.md](SECURITY.md). Everyone taking part follows the
[Code of Conduct](CODE_OF_CONDUCT.md).

## What is not accepted

The project does not accept pull requests that change its code, texts or other files, however small. The author keeps
the copyright of the whole project in one hand, so its licence and its future stay clear and can be decided by one
person. A change written by someone else would need a written agreement about its rights, and the project does not
run such agreements.

## When a pull request arrives anyway

It is closed, with thanks, and with a request to open an issue or a discussion that describes the idea in words. The
author may then build the idea himself, in his own way, or not at all.

Please know one thing before you describe an idea: by posting an idea, a wish or a report in Issues or Discussions,
you agree that the author may use it in NodeWise Studio freely, and that you claim no rights, payment or credit for
the result. If you do not want an idea used that way, please keep it to yourself. This is a plain statement of how the
project works, not legal advice.

## Building it for yourself

You are welcome to read the code, build the app and change your own copy: the [LICENSE](LICENSE) (MIT with the Commons
Clause condition) allows that, as long as the app is not sold ([COMMERCIAL.md](COMMERCIAL.md)). Everything you need
is in the developer documentation:

- [Building from source](docs/wiki/dev/Building-From-Source.md), and the steps by hand on
  [Windows](docs/wiki/dev/Building-On-Windows.md) and [macOS](docs/wiki/dev/Building-On-macOS.md);
- [Testing](docs/wiki/dev/Testing.md): how to run the checks;
- [Architecture](docs/wiki/dev/Architecture.md) and [For developers](docs/wiki/dev/README.md) for the rest.

A development run uses the same profile folder as an installed app; start it with `--user-data-dir=<a folder of your
own>` to keep a test profile apart ([Building from source](docs/wiki/dev/Building-From-Source.md)).

If something you found while building would help everyone, describe it in an issue.
