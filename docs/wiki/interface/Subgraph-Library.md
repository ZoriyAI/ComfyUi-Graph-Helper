[Русский](Subgraph-Library.ru.md)
[Home](../Home.md) › [The window](README.md)

# Subgraphs in the library

The **Subgraphs** tab lists the subgraphs of this project: blocks of nodes you made or that came with an opened workflow. From here you put another copy of a subgraph on the canvas.

## Constructor

Use **Subgraph constructor…** in this tab or the Graph menu to create an empty or selected-node graph, define typed ports and expose controls. See [the four-step guide](../graph/Subgraphs.md). Copies share their internal structure and keep independent exposed values.

## How to put a subgraph on the canvas

1. Open the **Subgraphs** tab. Type in **Search subgraphs** to narrow the list.
2. Each row shows the name and how many nodes, inputs and outputs it has ("5 nodes · 2 inputs · 1 output").
3. Press **Insert** on the row. A copy goes on the canvas: "Inserted subgraph Upscale."

Every copy shares one inside: when you change the inside of one copy, all copies change. See [Subgraphs](../graph/Subgraphs.md).

The same list is in the canvas menu: right-click an empty place ▸ **Insert subgraph**.

## When it is empty

"No subgraphs in this project. Select nodes on the canvas and make a subgraph, or import a workflow that has them."

## What can go wrong

"The subgraph was not inserted." The message under it says why, for example "A subgraph cannot go inside itself, directly or through another subgraph."

## See also

- [Subgraphs](../graph/Subgraphs.md)
- [Canvas menus](Canvas-Menus.md)
- [The library](Library.md)
