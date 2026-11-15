[Русский](Settings-Reference.ru.md)
[Home](../Home.md) › [Reference](README.md)

# Every setting

Every setting in File ▸ Settings… (`Ctrl+,`), its default and where it is kept. All settings are kept in the
database in the [data folder](Data-Folder.md); keys and tokens are kept apart (see [Security](../trust/Security.md)).
Most settings apply when you choose **Save settings**; the few that apply at once say so in the window.

What each setting does in detail: the Settings pages in [The interface](../interface/README.md), starting at [Settings](../interface/Settings.md).

## Assistant

| Setting | Default | Values |
| --- | --- | --- |
| Provider | not chosen | Test mode, OpenAI, Anthropic, Google, your own model |
| Model | empty | any model name; suggestions are offered |
| Base URL (server address) | empty; required for your own model | an `http` or `https` address |
| Model key | not held | kept per provider and address |
| When I ask for a change | Suggest first (grey drafts) | Suggest first, Build directly |
| Steps per answer | 60 | 4 to 200 |
| Context window (tokens) | 0 (auto) | 0 or up to 10 000 000 |
| Allow web search | on | on, off |
| Allow reading web pages | on | on, off |
| Answer language | Same as the interface | Same as the interface, English, Russian |
| Answer length | Short | Short, Fuller |

## Connection

| Setting | Default | Values |
| --- | --- | --- |
| ComfyUI address | empty | an `http` or `https` address, the one you open ComfyUI at in the browser |
| MCP server URL (optional) | empty | an `http` address on this computer, otherwise `https` |
| Access to the MCP server | not chosen | No sign-in, Access token, Sign in through the browser |

## Sync

| Setting | Default | Values |
| --- | --- | --- |
| Sync automatically | off | on, off (applies at once) |
| Interval, minutes | 30 | 5 to 1440, a day (applies at once) |
| Read model metadata from | Loader folders (checkpoints, LoRAs, VAE…) | Loader folders, All model folders |
| Models per batch | 50 | 10 to 1000 |
| Pause between batches, ms | 1500 | 0 to 10 000 |

## Canvas

| Setting | Default | Values |
| --- | --- | --- |
| Description cards | Own notes only | Own notes only, All nodes, Off (dots only) |
| Show minimap | on | on, off |
| Follow the assistant while it builds | on | on, off |
| Build pace, ms per step | 820 | 300 to 2000 |
| Play the guided tour automatically | on | on, off |
| Grid spacing, px | 18 | 8 to 48 |

## Appearance & Motion

| Setting | Default | Values |
| --- | --- | --- |
| Language | Russian | Russian, English (applies at once) |
| Motion | System | System, On, Reduced, Off |
| Density | Comfortable | Comfortable, Compact |
| Accent colour | Cyan | Cyan, Violet, Mint, Amber |
| Reduce glow | off | on, off |

## Shortcuts

Every command's shortcut can be changed, removed or reset; only your changes are kept. Defaults:
[Keyboard shortcuts](Shortcuts.md).

## Privacy

| Setting | Default | Values |
| --- | --- | --- |
| Send field values to the model | on | on, off |
| Keep chat history in the project | on | on, off |
| Keep a log of the conversation with the model | on | on, off |
| Show previews and examples marked as adult content | off | on, off |
| Look up models on the internet during sync | off | on, off |
| Check for new versions | off | on, off |
| Password store | Detect automatically | Detect automatically, GNOME Keyring, KWallet (applies after a restart; kept in `password-store.json`) |

Also here: **Where keys are kept**, **Forget all keys and tokens** and **Clear chat history**.

## Kept without a setting

The app also remembers, without asking: the size and place of the window (`window-state.json`), which lesson is
open, which lesson steps you read and which lessons you finished.

## See also

- [Reference](README.md)
- [The data folder](Data-Folder.md)
- [Privacy](../trust/Privacy.md)
