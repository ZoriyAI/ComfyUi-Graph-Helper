[Русский](SECURITY.ru.md)

# Security policy

## Supported versions

Only the latest release gets fixes. The project is experimental: a fix comes in a new release, not as a patch to
an older one.

## Reporting a vulnerability

Please do not open a public issue for a security problem. Report it privately through GitHub: open the
[Security tab of the repository](../../security) and choose "Report a vulnerability". Describe what an attacker can
do, how to reproduce it, and the version (Help ▸ About ▸ Copy details).

We read every report and try to answer within two weeks. When a problem is confirmed, we fix it in a new release,
credit you in the release notes if you wish, and publish an advisory.

## What is in scope

- Keys and tokens: how they are kept (the system password store, an owner-only file when you choose it, memory),
  and that a key never goes to an address other than the one it was pasted for.
- The read-only promise: the app must never call a tool or an address of ComfyUI or its MCP server that writes,
  installs, deletes or queues.
- The window: it must not navigate away, open other windows, run outside code or reach main except through the
  checked IPC channels.
- Outside text: web pages, model answers and files the app reads are data and must not make the app act.
- Files the app writes: project files, workflows and logs must not carry keys or tokens.

## Out of scope

- Problems in ComfyUI, in MCP servers, in model servers or in cloud providers themselves (report them there).
- Running the app as root or with the sandbox switched off.
- What a model answers: the app shows answers, it does not vouch for them.

How the app protects keys and data is described in [Security](docs/wiki/trust/Security.md) and
[Privacy](docs/wiki/trust/Privacy.md).
