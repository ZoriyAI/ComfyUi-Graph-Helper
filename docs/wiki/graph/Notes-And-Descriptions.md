[Русский](Notes-And-Descriptions.ru.md)
[Home](../Home.md) › [Working with a graph](README.md)

# Notes and descriptions

A graph is easier to come back to when it says why each part is there. The app keeps several kinds of text about a graph. All of them are saved in the [project file](Project-Files.md); none of them goes into the workflow for ComfyUI, which stays clean.

## What you can write, and where

| What | About | Where you write it |
|---|---|---|
| **Title** and **Notes** | the whole graph | [Properties](../interface/Properties.md) with nothing selected ▸ **This graph** ▸ **Save title and notes**. The title is the project name. |
| **Purpose** and **How to use** | one node or one subgraph | Properties ▸ **Component** ▸ **Save documentation**, or right-click the node ▸ **Note for this node…** |
| A description | one node | its [description card](../interface/Description-Cards.md) ▸ **Edit the description**: the text, and whether it answers "What it is" or "Why it is here" |
| A note with a topic | any object: node, port, link, group, model | the [Explain tab](../interface/Explain-Panel.md) ▸ **Add your own note**: the topic and the text |
| A name | one node | Properties ▸ **Name on the canvas** (this one does go into the workflow) |

The text stays in the language you write it in.

## What the assistant writes

- Answers to your questions are saved as explanations of the object you asked about, with a badge: **Fact**, **Guess** or **Web**.
- In a build it writes why each node is there ("Wrote down what KSampler is for") and may put a **Note:** line on a node.
- It may name the graph ("Named the graph “Text to image”").

Your own text gets the badge **You** and is shown first in the node's card.

## Limits

- A text cannot hold a key or a password: "An explanation cannot hold a key or a password. Remove it from the text."
- A subgraph without an id of its own cannot be described: "This subgraph has no id of its own, so a description cannot be saved for it."
- An explanation written for an earlier version of the graph says so: "Written for an earlier version of the graph".

<!-- verify: the assistant branch adds deleting one's own note -->

## See also

- [Description cards](../interface/Description-Cards.md)
- [The explanations tab](../interface/Explain-Panel.md)
- [Project files](Project-Files.md)
