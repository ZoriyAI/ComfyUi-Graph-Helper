[Русский](Drafts.ru.md)
[Home](../Home.md) › [The assistant](README.md)

# Grey drafts

A grey draft is a change the assistant suggests but has not made: a node, a link, a value, a subgraph, a removal. It stands on the canvas in grey, with a short "Why", until you accept or reject it. Only what you accept goes into the graph. Drafts come from **Ask** mode. They are never put on top of your own nodes.

<!-- picture: a grey draft node with Accept and Reject next to a real node -->

## The kinds

| Draft | On the canvas |
|---|---|
| **Add a node** | a grey node, "Suggested node KSampler" |
| **Connect** | a grey dashed link, "Suggested connection" |
| **Set a value** | a mark on the field, "Suggested value" |
| **Make a subgraph** / **Insert a subgraph** | a grey block |
| **Remove a node** | the node marked "Suggested removal" |

Each draft also has a card in the conversation, with its kind, the "Why" note and the buttons.

## How to accept or reject

- **Accept** or **Reject** on the draft itself, or on its card in the conversation. Accepting makes the change ("Applying…"), as one step of the history.
- Several at once: **Accept all (3)** on the canvas toolbar, **Graph ▸ Accept all suggestions**, or right-click an empty place ▸ **Accept all suggestions**. They are accepted one after another.
- To find them: right-click an empty place ▸ **Show the assistant’s suggestions**.

Each card then says **Accepted** or **Rejected**.

## Out of date

If the graph changed after the suggestion, so that it no longer fits, it turns **Out of date**: "The graph changed, so this suggestion no longer applies as it was made." Ask again.

## Limits

- Drafts live on the main canvas; inside a subgraph they are not shown.
- Accepting is refused during a history replay.

<!-- verify: the assistant branch adds «Reject all» -->

## See also

- [Ask](Ask.md)
- [A node on the canvas](../interface/Node.md)
- [Graph menu](../interface/Graph-Menu.md)
