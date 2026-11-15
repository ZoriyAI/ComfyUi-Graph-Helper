[Русский](Description-Cards.ru.md)
[Home](../Home.md) › [The window](README.md)

# Description cards

A description card is a small note under a node: what the node is and why it is here. Its text comes from an explanation of this node (by the assistant or by you), else from what the app knows about the node's class. A badge says where the text comes from.

<!-- picture: a node with its card open and the edit form below -->

## The three modes

| Mode | What you see |
|---|---|
| **Own notes only** (the default) | A card stands under the nodes that have your own explanation or purpose. Other nodes show a dot; their card opens when you hover over the node or select it. |
| **All nodes** | A card under every node that has something to say. |
| **Off (dots only)** | Only dots. A card opens on hover or selection. |

Switch the mode with the **Descriptions** button on the canvas toolbar (it cycles through the three), **View ▸ Node descriptions**, or Settings ▸ Canvas (**Description cards**).

## How to read a card

- Collapsed, a card shows its first line. **Expand the description** shows all of it: "What it is" and "Why it is here".
- Selecting the node expands its card. With several nodes selected the cards stay collapsed.
- **Hide the description** closes a card; the dot stays.
- The badge: **Fact** (read from ComfyUI or the file), **Guess** (concluded by the assistant from names and context), **Web** (found on the internet, with its link), **Written by you**, or **From the file** (came with a project file you opened; whoever made the file wrote it).
- "Written for an earlier version of the graph" means the graph has changed since.

## How to write your own

1. Open the card and choose **Edit the description**.
2. Write in **Description text**.
3. In **What the text answers** choose **What it is** or **Why it is here**.
4. Press **Save**. **Cancel** leaves it as it was.

Your text gets the badge **Written by you** and stays in the project file. When a card is empty it says "No description yet." and offers **Ask**, which asks the assistant.

## See also

- [Notes and descriptions](../graph/Notes-And-Descriptions.md)
- [A node on the canvas](Node.md)
- [The explanations tab](Explain-Panel.md)
- [Settings: Canvas](Settings-Canvas.md)
