[Русский](Groups.ru.md)
[Home](../Home.md) › [Working with a graph](README.md)

# Groups

A group is a named frame drawn around a few nodes, for example "Prompts" or "Upscale". It only helps you read the graph: ComfyUI runs the nodes the same with or without it. A group is kept in the workflow, so ComfyUI shows it too.

## How to group nodes

1. Select the nodes.
2. **Graph ▸ Group selection**, or right-click one of them ▸ **Group selection**.
3. A frame titled "Group" appears around them.

## How to rename a group

Double-click its title, type the new one, press `Enter`. `Escape` cancels.

## How to remove a group

Right-click the group ▸ **Remove group**. The nodes stay where they are.

## Ask about it

Right-click the group ▸ **What is this group for?** asks the assistant.

## Limits

- Groups live on the main canvas only, not inside a subgraph.
- A group does not move with its nodes, and **Arrange** does not move groups.
- A workflow from ComfyUI keeps its groups and their colours.

<!-- verify: the canvas and files branch makes groups move with their content; the editing branch adds group size and colour -->

## See also

- [Subgraphs](Subgraphs.md)
- [Arranging the graph](Arranging.md)
- [Canvas menus](../interface/Canvas-Menus.md)
