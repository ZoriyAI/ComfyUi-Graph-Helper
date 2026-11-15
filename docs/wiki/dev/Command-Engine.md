[Русский](Command-Engine.ru.md)
[Home](../Home.md) › [For developers](README.md)

# The command engine and history

Every change of the graph, by the person or by the assistant, is one *command*. The engine lives in main
(`src/main/commands/commit.ts`); the schemas are shared (`src/shared/commands/types.ts`).

## A command

| Field | Meaning |
| --- | --- |
| `projectId` | The project the graph belongs to. |
| `actionId` | A fresh id for this action. The same id sent again is answered from the record, never applied twice. |
| `expectedRevisionId` | The version the sender saw. If the graph moved on, the command is a conflict. |
| `actor` | `manual` (the person) or `ai` (the assistant). |
| `runId` | `null` for the person; the id of the open run for the assistant. |
| `payload` | What to do: `add-node`, `remove-node`, `move-node`, `move-nodes`, `rename-node`, `connect`, `remove-edge`, `retarget-edge`, `set-parameter`, `annotate-node`, `set-component`, `set-process`, `import-workflow`, `open-native`, `create-subgraph`, `insert-subgraph`, `dissolve-subgraph`, `rename-subgraph`, `add-subgraph-io`, `remove-subgraph-io`, `rename-subgraph-io`, `edit-in-subgraph`, `add-group`, `remove-group`, `rename-group`, `restore-revision`. |

## What `commitCommand` does

In one SQLite transaction (`immediate`, so two writers never interleave):

1. Parses the request; a request that does not fit the schema is `rejected`.
2. Looks up `applied_commands`: the same `actionId` with the same payload is `historical` (the stored result comes
   back); with another payload it is `rejected`.
3. Checks the actor: a `manual` command must have no run; an `ai` command must belong to a run that is `running` and
   expects exactly the current version. Otherwise `conflict`.
4. Applies the payload to the current graph. A node the assistant adds is placed so it never lands on another.
5. Writes a new row in `graph_revisions` (the whole graph, its document, components and title), points
   `projects.current_revision_id` at it, and records the command in `applied_commands`.
6. Updates explanations for the new version, and marks open drafts stale when the nodes they were made for are gone
   or a different graph was opened.
7. Moves the open run's `expected_revision_id` forward: to the new version for the assistant, and, when the person
   edits during a run, to the person's version too, so the run continues from what the person did.

The answer is `applied`, `historical`, `conflict` or `rejected`, always with the current *projection* (graph,
version, open run). A full disk or a file that cannot be written rolls back the transaction and comes back as
`rejected` with the reason, so the person is told the change did not land.

## Runs

A *run* is one turn of the assistant that may change the graph (`runs` table).

| Call | What it does |
| --- | --- |
| `startRun` | Closes any other open run of the project (one at a time) and opens a new one at the current version. |
| `pauseRun` | `running` → `paused`; commits of the run are refused while paused. |
| `resumeRun` | Reopens the newest paused run at the current version, or starts a new one. |
| `cancelRun` | Stops the run; what it built stays and can be undone. |
| `closeRun` | The turn ended: the nodes the run made are arranged in one more commit, then the run is closed. |
| `closeStaleRuns` | At start-up, closes runs an earlier session left open. |

The step limit (Settings ▸ Assistant ▸ Steps per answer) pauses a run at a checkpoint; Continue resumes it.

## Undo, redo and history

- Undo and redo are commands with the payload `restore-revision`: the old version becomes a new one. Nothing is
  rewritten, so undo is itself undoable.
- A whole build of the assistant is undone in one step: the renderer's undo stack groups the commits of one run
  (`src/renderer/state/undoState.ts`, `src/renderer/commands/undo.ts`).
- History is pruned after commits (`src/main/commands/history.ts`): at most 2000 versions per project, fewer for a big
  graph (a budget of 256 MB), but never fewer than 200; the version on screen, the versions open runs and open drafts
  depend on are always kept.

## Tests

`tests/unit` and `tests/integration` cover the engine directly; `aiHumanConflict.test.ts` and
`chatRunLifecycle.test.ts` follow a run through conflicts and pauses; `tests/e2e/undo-redo.test.ts` and
`command-lifecycle.test.ts` follow it through the window.

## See also

- [For developers](README.md)
- [Architecture](Architecture.md)
- [How the assistant works](Assistant-Internals.md)
- [The database and migrations](Database.md)
