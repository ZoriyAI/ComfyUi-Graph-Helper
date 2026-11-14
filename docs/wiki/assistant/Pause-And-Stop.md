[Русский](Pause-And-Stop.ru.md)
[Home](../Home.md) › [The assistant](README.md)

# Pausing and stopping

You can pause the assistant at any moment, let it go on, or stop it. Nothing it already did is lost when it pauses or stops, and a whole build can be undone in one step.

## Pause and resume

- **Pause** in the header of the Assistant tab, **Pause the build** on the strip over the canvas, **Pause** in the status bar, or **Assistant ▸ Pause the assistant**.
- **Resume** (or **Resume the build**, **Assistant ▸ Resume the assistant**) lets it go on from where it stopped.

## Stop

**Stop** (in the tab, the status bar, the strip or **Assistant ▸ Stop the assistant**) ends the work: "Stops the run. Changes already applied stay in the graph." The conversation says "Stopped: 4 nodes, 3 links. What is done stays in the graph."

## The pause at the step limit

Each action of the assistant is a step: reading the catalog, adding a node, drawing a link. After **Steps per answer** steps (60 by default, from 4 to 200, in Settings ▸ Assistant) it pauses by itself. A **Checkpoint** card says "The assistant used 60 steps and paused. This pause comes from the “Steps per answer” setting (Settings ▸ Assistant). Continue carries on; Stop ends the work. Changes already applied stay." Press **Continue** or **Stop**. A text-to-image build takes about 16 steps.

## The pause after failures

After 3 failed attempts in a row it pauses too: "The assistant paused after 3 failed attempts in a row. Something keeps failing. Check the cards above, then Continue to let it try again in the same run, or Stop."

## Undo a build

After it has stopped or finished, one `Ctrl+Z` undoes the whole build. While it still builds: "The assistant is still building. Stop it to undo."

## See also

- [Build](Build.md)
- [Settings: Assistant](../interface/Settings-Assistant.md)
- [History and undo](../graph/History-And-Undo.md)
- [The status bar](../interface/Status-Bar.md)
