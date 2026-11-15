[Русский](IPC.ru.md)
[Home](../Home.md) › [For developers](README.md)

# IPC between window and main

The window cannot touch files, the network or the database. It asks main through IPC channels, each a named
request with an answer.

## The pieces

| Piece | Where | What it is |
| --- | --- | --- |
| Channel names | `src/shared/ipc-channels.ts` | `IPC_CHANNELS`: one constant per channel, such as `ABOUT_INFO: 'about:info'`. |
| A copy of the names | `src/preload/index.ts` | The same `IPC_CHANNELS`, written out again: a sandboxed preload cannot import other files. Keep both lists the same. |
| The method | `src/preload/index.ts` | A method on `window.electronAPI` that calls `ipcRenderer.invoke(channel, …)`, and its line in the `ElectronAPI` type. |
| The handler | `src/main/ipc.ts` or `src/main/ipc/*Ipc.ts` | `ipcMain.handle(channel, handler)` inside a `register…Ipc(ipcMain)` function. |
| The types | `src/shared/contracts/` | What goes in and what comes back, shared by all three. |

## The guard

`src/main/ipc.ts` wraps Electron's `ipcMain` with `guardedIpcMain` (`src/main/ipc/guard.ts`) before any handler is
registered:

- `handle` checks that the sender is the app's own page (the built `index.html` or the app scheme; the Vite server in
  development). Any other frame, an iframe, or a page that navigated away gets the error "The request did not come from
  the app window." and the handler never runs.
- `on`, `once`, `addListener`, `prependListener` and `handleOnce` throw: they would carry no sender check. Use
  `handle` for every channel.

Inside the handler, treat every argument as untrusted: parse it with a zod schema and return a fixed error for
anything that does not fit.

## Adding a channel

1. Add the name to `IPC_CHANNELS` in `src/shared/ipc-channels.ts`, and the same line to the copy in
   `src/preload/index.ts`.
2. Add the types to `src/shared/contracts/` if the call carries more than a string.
3. In `src/preload/index.ts`, add a method to the `electronAPI` object and its line to the `ElectronAPI` type.
4. In main, add `ipcMain.handle(IPC_CHANNELS.YOUR_CHANNEL, handler)` to the right `register…Ipc` function. Parse the
   arguments; never return a secret.
5. Call it from a service in `src/renderer/services/`, not from a component.
6. Test the handler in `tests/unit` (call the function the handler uses), and the path through the window in an e2e
   test if a person can see the result.

Example in the code: the Help reader's `help:tree`, `help:page` and `help:search` in `src/main/ipc/aboutIpc.ts`.

## Streams

The assistant's answer comes back in pieces: the window sends a request on `llm:stream-chat`, and main sends chunks
back to that window until the turn ends (`src/main/ipc/agentIpc.ts`, `src/renderer/services/llm/chatService.ts`).

## See also

- [For developers](README.md)
- [Architecture](Architecture.md)
- [Security](../trust/Security.md)
