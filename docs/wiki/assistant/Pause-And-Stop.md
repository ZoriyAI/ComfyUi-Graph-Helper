[Русский](Pause-And-Stop.ru.md)
[Home](../Home.md) › [The assistant](README.md)

# Pausing and stopping

You can pause the assistant at any moment, let it go on, or stop it. Nothing it already did is lost when it pauses or stops, and the steps it made one after another can be undone in one step.

## Pause and resume

- **Pause** in the header of the Assistant tab, **Pause the build** on the strip over the canvas, **Pause** in the status bar, or **Assistant ▸ Pause the assistant**. The strip then says "The assistant is paused at step 3 of 8. Press Continue to go on or Stop to end the build; what is built stays."
- **Resume** (or **Resume the build**, **Assistant ▸ Resume the assistant**) lets it go on from where it stopped.

## Stop

**Stop** (the round button that takes the place of **Send** while the assistant works, the status bar, the strip or **Assistant ▸ Stop the assistant**) ends the work: "Stops the run. Changes already applied stay in the graph." The conversation says "Stopped: 4 nodes, 3 links. What is done stays in the graph." An answer you stopped says "Stopped by you: the answer may be unfinished."

## The pause at the step limit

Each action of the assistant is a step: reading the catalog, adding a node, drawing a link. After **Steps per answer** steps (60 by default, from 4 to 200, in Settings ▸ Assistant) it pauses by itself. An amber **Pause point** card says "The assistant used 60 steps and paused. This pause comes from the “Steps per answer” setting (Settings ▸ Assistant). Continue carries on; Stop ends the work. Changes already applied stay." Press **Continue** (the main button) or **Stop**. A text-to-image build takes about 16 steps. If you end the run from the status bar or the menu instead, the card says "Stopped. Changes already applied stay." and no longer offers Continue.

## The pause after failures

After 3 failed attempts in a row it pauses too: "The assistant paused after 3 failed attempts in a row. Something keeps failing. Check the cards above, then Continue to let it try again in the same run, or Stop."

## Undo a build

After it has stopped or finished, one `Ctrl+Z` undoes the steps it made one after another ("Undo: the assistant's consecutive steps (16)"). While it still builds: "The assistant is still building. Stop it to undo."

## After closing the app

With **Save chat history** enabled, the pause card and original task return after restart. **Check and continue** reads the graph as it is now, clears the old selection and asks the assistant to finish only what remains. Already applied changes stay; the app does not replay saved tool calls. Review the result as with any assistant answer.

If another workflow is open, or the saved task is incomplete, use **Review the current graph**. This runs in Explain mode: the assistant describes what matches and what needs attention. **Stop** closes the saved task too, so it will not return as an open pause next time. Starting a different message closes the older pause card.

Turning off chat history leaves future tasks only in the current window. Clearing chat history removes stored paused tasks and pending drafts too. A failure to save is visible in the chat and can be retried.

## See also

- [Build](Build.md)
- [Settings: Assistant](../interface/Settings-Assistant.md)
- [History and undo](../graph/History-And-Undo.md)
- [The status bar](../interface/Status-Bar.md)
