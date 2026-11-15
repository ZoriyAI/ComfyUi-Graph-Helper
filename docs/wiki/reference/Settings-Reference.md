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
| Choose the assistant (Provider) | Not chosen | Not chosen, OpenAI, Anthropic, Google Gemini, OpenAI-compatible, Your own server (TEST mode appears only in a development run) |
| Model | empty | any model name; the list of the provider or server is offered |
| Server address | empty; required for Your own server | an `http` or `https` address with its port |
| Service address | empty; required for OpenAI-compatible | an `https` address, usually ending in `/v1` |
| Server address (optional) | empty: the official address of OpenAI, Anthropic or Google | an `https` address of your own proxy |
| Model key | not held | kept per provider and address; Remember on this computer, or Remember in the app folder where there is no keychain |
| Key for this server (optional) | not held | only for a server of your own that asks for one |
| Organization (optional), Project (optional) | empty | OpenAI only: the `org-…` and `proj_…` ids |
| When I ask for a change | Suggest first (grey drafts) | Suggest first, Build directly |
| Steps per answer | 60 | 4 to 200 |
| Context window (tokens) | 0 (auto) | 0 or up to 10 000 000 |
| Allow web search | on | on, off |
| Allow reading web pages | on | on, off |
| Answer language | Same as the interface | Same as the interface, English, Russian |
| Answer length | Short | Short, Detailed |

### Network

| Setting | Default | Values |
| --- | --- | --- |
| Proxy (optional) | empty: the system's proxy settings | `http://`, `https://`, `socks4://` or `socks5://`, a host and a port, without a user name or password. Your own server on this computer or your home network is always reached directly. |

## Connection

| Setting | Default | Values |
| --- | --- | --- |
| ComfyUI address | empty | an `http` or `https` address, the one you open ComfyUI at in the browser |
| MCP server address (in MCP server (optional)) | empty | an `http` address on this computer, otherwise `https` |
| Access to the server | not chosen; Test server picks it | No sign-in, Token, Sign in through the browser |

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
| Language | the system's language on the first start: Russian on a Russian system, otherwise English | Русский, English (applies at once) |
| Motion | System | System, On, Reduced, Off |
| Density | Comfortable | Comfortable, Compact |
| Accent color | Cyan | Cyan, Violet, Mint, Amber |
| Reduce glow | off | on, off |
| Interface size | 100 % | 80, 90, 100, 110, 125, 150, 175 or 200 %; also View ▸ Larger interface (`Ctrl+Alt+=`), Smaller interface (`Ctrl+Alt+-`), Normal interface size (`Ctrl+Alt+0`) |

## Shortcuts

Every command's shortcut can be changed, removed or reset; only your changes are kept. Defaults:
[Keyboard shortcuts](Shortcuts.md).

## Privacy

| Setting | Default | Values |
| --- | --- | --- |
| Send field values to the model | on | on, off |
| Keep chat history in the project | on | on, off |
| Keep a log of the conversation with the model | on | on, off |
| Adult content (18+) | off | on (after the confirmation "I am 18 or older"), off |
| Look up models on the internet during sync | off | on, off |
| Check for new versions | off | on, off |
| Which keychain the app uses | Detect automatically | Detect automatically, GNOME "Passwords and Keys", KWallet 6, KWallet 5, KWallet 4 (applies after a restart; kept in `password-store.json`) |

Also here: **Where keys are kept**, **Forget all keys and tokens**, **Clear chat history** and **Clear the picture
cache**.

## Kept without a setting

The app also remembers, without asking:

- the size and place of the window (`window-state.json`);
- how you left the window: the library tab and whether it is folded, the right panel's tab, width and whether it is
  folded, and the kind, family and order chosen on the Models tab (in the database, never in a project file);
- which lesson is open, which lesson steps you read and which lessons you finished;
- the last 10 files you opened or saved (`recent-files.json`);
- your own lessons, in the `lessons` folder;
- in the window's own storage (Chromium's folders in the data folder): whether the tour of the window was already
  shown, whether the card "Run it in ComfyUI" opens after every save (its switch "Show this after every save"), and
  the last 6 nodes you added from the node search.

## See also

- [Reference](README.md)
- [The data folder](Data-Folder.md)
- [Privacy](../trust/Privacy.md)
