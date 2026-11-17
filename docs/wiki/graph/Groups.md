[Русский](Groups.ru.md)
[Home](../Home.md) › [Working with a graph](README.md)

# Groups

A group is a named frame drawn around a few nodes, for example "Prompts" or "Upscale". It only helps you read the graph: ComfyUI runs the nodes the same with or without it. A group is kept in the workflow, so ComfyUI shows it too.

## How to group nodes

1. Select the nodes.
2. **Graph ▸ Make a group from selection** (`Ctrl+Shift+G`), or right-click one of them ▸ **Make a group from selection**.
3. A frame titled "Group" appears around them.

## How to rename a group

Double-click its title, type the new one, press `Enter`. `Escape` cancels. On a phone, tap the **⋯** button beside the group title and choose **Rename**. The same menu offers colour and removal.

## How to move a group

Drag the group by its title. Its frame and nodes move together in one history step. With the title focused, arrow keys move the group; Shift uses a larger step. Enter renames it.

## How to resize the frame

A new group automatically follows its member nodes. Drag the handle at the bottom-right corner to set its size yourself, with a mouse or touch. You can also focus the handle and use arrow keys (Shift for larger steps). Nodes stay in place. Undo restores the previous size.

Choose **Fit frame to its nodes** from the group’s **⋯** menu to return to automatic sizing. Imported ComfyUI groups initially retain their saved rectangles. All these controls work inside subgraphs too.

## Which nodes are in it

Resizing preserves membership while editing in NodeWise. ComfyUI determines group membership from node positions inside the saved rectangle; reopening or importing that file recomputes membership the same way. Keep the intended nodes inside the frame when you want the same group after export.

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

- Groups work on the main canvas and inside subgraphs. Identical group numbers on different levels refer to different frames.
- A workflow from ComfyUI keeps its groups and their colours.

## See also

- [Subgraphs](Subgraphs.md)
- [Arranging the graph](Arranging.md)
- [Canvas menus](../interface/Canvas-Menus.md)
