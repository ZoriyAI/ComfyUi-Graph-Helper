[Русский](Keys.ru.md)
[Home](../Home.md) › [The assistant](README.md)

# Keys and where they are kept

A cloud assistant needs a key: a long secret from OpenAI, Anthropic or Google that lets the app use your account. A key can spend money, so the app treats it with care: it never shows it again, never writes it to the settings file, the logs, the project or the workflow, never sends it to the model, and sends it only to the address it was pasted for. Your own server needs no key.

## Where a key can live

| Place | When | What it means |
|---|---|---|
| **In memory until the app closes** | you pasted it and did not tick anything | it works until you close the app; then paste it again |
| **Encrypted in the OS password manager** | you ticked **Remember on this computer** | GNOME “Passwords and Keys” or KWallet keeps it encrypted; it works after a restart |
| **In the app folder, unencrypted (your choice)** | no password store is available and you ticked **Remember in the app folder** | a file only your user can read; do this only on your own computer |

Settings ▸ Privacy ▸ **Where keys are kept** shows, for each key, where it is now. The toolbar chooser says it too, for example "The OpenAI key works until the app closes. It is not written to disk."

## How to paste, remember and forget a key

1. Settings ▸ Assistant ▸ the provider ▸ its key field. Paste. The app checks it at once with the provider.
2. Tick **Remember on this computer** to keep it.
3. **Forget key** removes it.
4. Settings ▸ Privacy ▸ **Forget all keys and tokens** removes every model key, every server access token and every browser sign-in, from memory, the password store and the app folder, after a question.

## A key belongs to one address

"A key works only with the address it was pasted for: for another address, paste its own key." If you change **Server address (optional)**, the old key is not sent there.

## When the password store is missing

"The system password store is not available on this computer, so keys live only until the app closes." Install or unlock GNOME “Passwords and Keys” or KWallet, or pick it in Settings ▸ Privacy ▸ **Password store** and restart the app. The app also refuses a store it cannot prove encrypts: "The app could not confirm that the password store encrypts keys, so the key was not saved."

## See also

- [Settings: Privacy](../interface/Settings-Privacy.md)
- [Security](../trust/Security.md)
- [OpenAI](OpenAI.md), [Anthropic](Anthropic.md), [Google Gemini](Google.md)
