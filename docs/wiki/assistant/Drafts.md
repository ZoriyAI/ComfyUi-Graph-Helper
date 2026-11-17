[Русский](Drafts.ru.md)
[Home](../Home.md) › [The assistant](README.md)

# Grey drafts

A grey draft is a suggested change that has not been applied. It waits for you to accept or reject it. Explain mode uses drafts; Assistant and Build can also propose one when you need to choose. A direct request to edit an existing node can be applied immediately with undo history. Drafts remain useful for reviewing alternatives before changing the graph.

<!-- picture: a grey draft node with Accept and Reject next to a real node -->

## The kinds

| Draft | On the canvas |
|---|---|
| **Add a node** | a grey node, "Suggested node KSampler" |
| **Connect** | a grey dashed link, "Suggested link" |
| **Set a value** | a mark on the field, "Suggested value" |
| **Make a subgraph** / **Insert a subgraph** | a grey block |
| **Remove a node** | the node marked "Suggested removal" |
| **Remove a link** | the link marked for removal |
| **Note on a node**, **Node description**, **Graph name** | a card in the conversation; the text goes in when you accept |

Each draft also has a card in the conversation, with its kind, the "Why" note and the buttons.

## How to accept or reject

- **Accept** or **Reject** on the draft itself, or on its card in the conversation. Accepting makes the change ("Applying…"), as one step of the history.
- Several at once: **Accept all (3)** on the canvas toolbar, **Graph ▸ Accept all suggestions**, or right-click an empty place ▸ **Accept all suggestions**. They are accepted one after another.
- **Reject all** beside it on the canvas toolbar, **Graph ▸ Reject all suggestions**, or right-click an empty place ▸ **Reject all suggestions** rejects them all at once.
- A build that left drafts ends its summary with, for example, "1 grey draft waits for your decision: it changes what you made".
- To find them: right-click an empty place ▸ **Show the assistant’s suggestions**.

Each card then says **Accepted** or **Rejected**. With motion on, an accepted draft turns into the node, a rejected one dissolves, and a draft that lands off screen is brought into view. A draft's **Why** shows the assistant's reason only.

## Out of date

If the graph changed after the suggestion, so that it no longer fits, it turns **Out of date**: "The graph changed, so this suggestion no longer applies as it was made." Ask again.

## Limits

- Drafts live on the main canvas; inside a subgraph they are not shown.
- Accepting is refused during a history replay.

## See also

- [Ask](Ask.md)
- [A node on the canvas](../interface/Node.md)
- [Graph menu](../interface/Graph-Menu.md)
