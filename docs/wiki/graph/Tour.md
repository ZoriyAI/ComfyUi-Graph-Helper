[Русский](Tour.ru.md)
[Home](../Home.md) › [Working with a graph](README.md)

# The tour of a graph

The tour walks through the graph node by node, in the order the data flows, and says at each stop what the node is and what it does here. It is the fastest way to understand a graph someone else made, or one the assistant just built. No model is needed: the tour uses the explanations already saved and what the app knows about each kind of node.

## How to start it

- **Tour** on the canvas toolbar.
- **Graph ▸ Guided tour**.
- Right-click a node ▸ **Tour from here**: the tour starts at that node.
- After a build: **Tour the graph** in the build result.

It tours the level on screen: the main graph, or the inside of an open subgraph.

## While it runs

- The view moves to each node in turn and shows its description card.
- The node of the step and the nodes that feed it stand out; the rest of the graph dims.
- A bar under the canvas toolbar has **Previous step**, **Play** / **Pause**, **Next step**, "Step 3 of 7" and **End tour**.
- Click a node of the graph: the tour goes on from that node.
- Any press on the canvas pauses the playing.
- `Escape`, **End tour**, or **Tour** again ends it.

With **Play the guided tour automatically** off (Settings ▸ Canvas), the tour waits at each stop until you press **Next step**. With motion off, it does not play by itself either.

## What can go wrong

- **Tour** is grey on an empty graph and during a history replay.
- A node nobody has described gets a plain sentence: "Takes MODEL and gives LATENT." Ask the assistant about it, or write your own description.

## See also

- [Description cards](../interface/Description-Cards.md)
- [The canvas toolbar](../interface/Canvas-Toolbar.md)
- [Settings: Canvas](../interface/Settings-Canvas.md)
- [Notes and descriptions](Notes-And-Descriptions.md)
