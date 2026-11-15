[Русский](FAQ.ru.md)
[Home](../Home.md) › [Start](README.md)

# Questions and answers

Short answers, each with a link to the page that says more.

## Does NodeWise Studio run my workflow?

No. It builds and explains graphs; ComfyUI runs them. You save a workflow and open it in ComfyUI.
[Running the result in ComfyUI](../graph/Running-In-ComfyUI.md)

## Can it change or break my ComfyUI?

No. It only reads: it never installs, downloads, deletes, writes or queues anything in ComfyUI.
[ComfyUI is only read](../trust/Read-Only.md)

## Do I need an AI model or the internet?

Not for lessons, the canvas, explanations of known nodes or the check: they work without a model and without the
internet. The assistant needs a model: a cloud one with your key, or one on your own computer.
[Choosing who answers](../assistant/Choosing-Who-Answers.md)

## Does it work without a cloud service?

Yes. Choose "Your own server" and point it at Ollama, LM Studio, vLLM, the llama.cpp server or any OpenAI-compatible
server on your computer or network; Find local servers looks for them on this computer. Small local models have a small context window; see
[The context window](../assistant/Context-Window.md).

## How much does it cost?

The app is free. A cloud model is paid by you to its provider, per question; a long build can take dozens of steps,
each one a request. A model on your own computer costs nothing but electricity.

## Which ComfyUI do I need, and how does the app reach it?

A running ComfyUI, on this computer or on another one in your network: the app needs only the address you open it
at in the browser. An MCP server is optional. How to connect: [Connecting to ComfyUI](../connect/Connecting.md).

## Is there a version for Windows or macOS?

There are no packages for them, but each release has an install script for each: it builds the app on your
computer from the project's source and installs it for your user, with one command. The scripts are checked on
GitHub's Windows and macOS machines on every change, not yet on a range of real computers; if you try one, please
report what happened in the project's Issues, with the log the script names at the end.
[Installing on Windows](Installing-On-Windows.md), [Installing on macOS](Installing-On-macOS.md)

## Where are my settings and projects?

Settings, the history of the graph and the chats are in the data folder in your home folder; project files and
workflows are where you saved them. [The data folder](../reference/Data-Folder.md)

## Are my keys safe?

A key you choose to remember is kept in the system keychain, encrypted by your system. A key goes only to the
address you pasted it for, never into logs, project files or the text sent to a model.
[Security](../trust/Security.md), [Privacy](../trust/Privacy.md)

## What does the app send over the internet?

Only what is listed in [Privacy](../trust/Privacy.md): your questions to the model you chose, web searches of the
assistant (on by default, can be switched off), model lookups when you ask. A question about new versions only if you switch it on
(off by default). The download pages of ComfyUI and Ollama open in your browser only when you click their buttons.
No telemetry, no crash reports.

## Can I open a workflow I found on the internet?

Yes: File ▸ Open workflow…, or drop the file on the window. A workflow `.json` file opens, and so do the pictures
and videos ComfyUI saves (PNG, WebP, MP4, WebM and others), because ComfyUI writes the workflow into them. A picture
from elsewhere, or one sent through a chat app, usually has none: the app says "There is no workflow in this file…". A
file in ComfyUI's API format opens too, laid out from left to right. [Opening a workflow](../graph/Opening-Workflows.md)

## Will the workflow come back to ComfyUI the same?

Yes: what you did not change comes back exactly as it was, including subgraphs and values the app does not show.
[Saving a workflow for ComfyUI](../graph/Saving-Workflows.md)

## Where are my explanations and notes kept?

In the project file (File ▸ Save project), together with the graph. A workflow saved for ComfyUI does not contain
them. [Project files](../graph/Project-Files.md)

## Why does a lesson not start?

Lessons are fitted to your ComfyUI: before ComfyUI is read they ask you to connect it. A lesson that needs nodes your
ComfyUI lacks, for example the WanVideoWrapper pack for some video lessons, says "This lesson does not fit your
ComfyUI yet" and names the reasons. The lessons for adults stay behind Settings ▸ Privacy ▸ Adult content (18+).
[How lessons work](../lessons/How-Lessons-Work.md)

## Can I make my own lesson?

Yes. File ▸ Make a lesson from this graph turns the graph on the canvas into a lesson you edit, try and keep in My
lessons. Lessons can be exported to a `.lesson.json` file and imported again (File ▸ Import lessons…). A lesson file
is data only. [My lessons](../lessons/My-Lessons.md)

## I have no ComfyUI yet. Can I still try the app?

Yes: look around, read the guide and the glossary, and ask the assistant. The welcome card's **I have no ComfyUI yet**
explains ComfyUI and opens its download page on a click. [ComfyUI and where to get it](ComfyUI.md)

## Can the assistant install a missing node or model for me?

No. It tells you what is missing and, when it knows, which pack a node comes from. Installing is done in ComfyUI.
[Node packs](../concepts/Node-Packs.md)

## I made a mistake. Can I go back?

Yes: Edit ▸ Undo (`Ctrl+Z`), as many steps as you need. A whole build of the assistant is undone in one step.
[History and undo](../graph/History-And-Undo.md)

## Is it open source?

The source code is public, but it is not open source in the usual sense: the license (MIT with the Commons Clause)
does not allow selling the app. [License and third-party notices](../trust/Licence.md)

## Who answers my questions?

This is an experimental project without promised support. Ideas, wishes and questions go to the project's
Discussions; problems to Issues (Help ▸ Report a problem fills in the versions).

## See also

- [Start](README.md)
- [Troubleshooting](../reference/Troubleshooting.md)
- [Glossary](../reference/Glossary.md)
- [Known limitations](../reference/Known-Limits.md)
