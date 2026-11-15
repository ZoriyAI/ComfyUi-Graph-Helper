[Русский](Groups.ru.md)
[Home](../Home.md) › [Working with a graph](README.md)

# Groups

A group is a named frame drawn around a few nodes, for example "Prompts" or "Upscale". It only helps you read the graph: ComfyUI runs the nodes the same with or without it. A group is kept in the workflow, so ComfyUI shows it too.

## How to group nodes

1. Select the nodes.
2. **Graph ▸ Make a group from selection** (`Ctrl+Shift+G`), or right-click one of them ▸ **Make a group from selection**.
3. A frame titled "Group" appears around them.

## How to rename a group

Double-click its title, type the new one, press `Enter`. `Escape` cancels.

## How to move a group

Drag the group by its title. Its nodes move with it, in one step of the history. The tooltip says: "Drag to move the group with its nodes. Double-click to rename."

## Which nodes are in it

The frame is drawn around the nodes of the group and follows them: you cannot resize it by hand.

- To add nodes: select them, right-click ▸ **Add to group** ▸ the group.
- To take nodes out: select them, right-click ▸ **Take out of group**.
- A group keeps at least one node: "A group keeps at least one node. To remove the group, use Remove group."

## Colour

Right-click the group ▸ **Color** and choose one of ComfyUI's colours, or **No color**. Nodes have the same menu, and **Graph ▸ Color** colours the selected nodes. The colours are ComfyUI's own palette, so ComfyUI shows them too.

## How to remove a group

Right-click the group ▸ **Remove group**. The nodes stay where they are.

## Ask about it

Right-click the group ▸ **What is this group for?** asks the assistant.

## Limits

- Groups live on the main canvas only, not inside a subgraph.
- A workflow from ComfyUI keeps its groups and their colours.

## See also

- [Subgraphs](Subgraphs.md)
- [Arranging the graph](Arranging.md)
- [Canvas menus](../interface/Canvas-Menus.md)
