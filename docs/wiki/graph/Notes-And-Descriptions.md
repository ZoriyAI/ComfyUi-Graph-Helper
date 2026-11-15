[Русский](Notes-And-Descriptions.ru.md)
[Home](../Home.md) › [Working with a graph](README.md)

# Notes and descriptions

A graph is easier to come back to when it says why each part is there. The app keeps several kinds of text about a graph. Most of them are saved only in the [project file](Project-Files.md) and do not go into the workflow for ComfyUI, which stays clean. Two kinds do go into the workflow: a note on the canvas and the name of a node.

## What you can write, and where

| What | About | Where you write it |
|---|---|---|
| **Title** and **Notes** | the whole graph | [Properties](../interface/Properties.md) with nothing selected ▸ **This graph** ▸ **Save title and notes**. The title is the project name. |
| **Purpose** and **How to use** | one node or one subgraph | Properties ▸ **Component** ▸ **Save documentation**, or right-click the node ▸ **Note for this node…** |
| A description | one node | its [description card](../interface/Description-Cards.md) ▸ **Edit the description**: the text, and whether it answers "What it is" or "Why it is here" |
| A note with a topic | any object: node, port, link, group, model | the [Explain tab](../interface/Explain-Panel.md) ▸ **Add your own note**: the topic and the text |
| A name | one node | Properties ▸ **Name on the canvas** (this one does go into the workflow) |
| A note on the canvas | anyone who reads the graph | **Graph ▸ Add note**, or right-click an empty place ▸ **Add note**. Write right in the note: double-click it or press `Enter`; `Ctrl+Enter` or a click elsewhere saves, `Escape` cancels. It is a Note node, so it goes into the workflow and ComfyUI shows it. |

The text stays in the language you write it in.

## Removing a note

- Your own note on an object has **Delete note** in the Explain tab.
- **Remove what the assistant wrote here** removes everything the assistant wrote about that object, in one action.
- A note on the canvas is a node: select it and press `Delete`.

## What the assistant writes

- Answers to your questions are saved as explanations of the object you asked about, with the badge **Assistant**. Its hint: "The assistant (the model) wrote this. It may be wrong: the built-in knowledge and the documentation come first." The assistant's words are never marked **Fact**.
- In Ask mode the assistant saves nothing as general knowledge.
- In a build it writes why each node it placed is there ("Wrote down what KSampler is for") and may put a **Note:** line on a node. A note on one of your own nodes, or a new name for the graph, comes as a grey draft first. See [Grey drafts](../assistant/Drafts.md).

Your own text gets the badge **Written by you** (**You** in Properties) and is shown first in the node's card. Text that came with a project file you opened gets **From the file**: whoever made the file wrote it, and the app has not checked it.

## Where a note applies

The Explain tab says once for each topic where its text applies:

- "Written for this graph"
- "Kept in this project only"
- "General knowledge, not tied to this graph"

## Limits

- A text cannot hold a key or a password: "An explanation cannot hold a key or a password. Remove it from the text."
- A subgraph without an id of its own cannot be described: "This subgraph has no id of its own, so a description cannot be saved for it."
- An explanation written for an earlier version of the graph says so: "Written for an earlier version of the graph".

## See also

- [Description cards](../interface/Description-Cards.md)
- [The explanations tab](../interface/Explain-Panel.md)
- [Project files](Project-Files.md)
