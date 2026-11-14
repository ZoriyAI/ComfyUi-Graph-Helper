[Русский](Prompt-Syntax.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Prompt syntax and weights

The few special forms ComfyUI really understands in a prompt, and the forms from other programs that it does not.

## What ComfyUI understands
| Form | What it does |
|---|---|
| `(red coat:1.2)` | Weight: the words in the parentheses pull with 1.2 instead of 1. Below 1 weakens: `(rain:0.8)`. |
| `(red coat)` | Weight 1.1 without a number. Nested parentheses multiply: `((red coat))` is about 1.21. |
| `\(` and `\)` | A plain parenthesis that must stay in the text, for example in a tag like `artist \(style\)`. |
| `embedding:name` | Uses a textual inversion file named `name` from `models/embeddings`. |
| `{day\|night\|dawn}` | A dynamic prompt: the ComfyUI editor picks one option each time you queue. `\{` keeps a plain brace. |
| `// ...` and `/* ... */` | Comments: the editor removes them before the prompt is encoded. |

Weights, embeddings and escaped parentheses are read by ComfyUI's text encoding. Curly braces and comments are handled by the ComfyUI editor when the prompt is queued, so a script that sends the API format straight to the server does not get them.

## What it does not understand
These come from other programs (mostly the AUTOMATIC1111 and Forge web UIs) and are plain characters in ComfyUI:
- `<lora:name:0.8>`: connects nothing. A LoRA is added with a [LoRA loader node](LoRA.md).
- `BREAK`, `AND`: not special.
- `[word]` (weaken in other programs), `[a:b:10]` (prompt editing): not special.
Prompts copied from picture sites are often full of such forms. Take them out.

## Values and what they change
- Keep weights between about 0.5 and 1.5; 1.1 to 1.3 is usually enough. Above 1.5 pictures burn and distort.
- ComfyUI applies weights more strongly than some other programs, so a prompt copied with its weights often needs them lowered.
- On sentence readers (Flux, Qwen-Image, Wan and others) weights act weakly and unpredictably. Say what matters in words and put it first.

## Typical mistakes
- Unmatched parentheses: the weight lands on other words than you meant.
- A weight of 2 or 3 copied from elsewhere: a burnt picture.
- `embedding:` with a file of another family: no effect or a warning.

## How the app helps
**Check** finds LoRA tags, `BREAK`, `AND` and square brackets, unmatched parentheses, weights above 1.5, and weights used on a model that reads sentences. The [prompt lesson](../lessons/Prompt.md) has a step where you set a weight yourself.

## See also
- [The prompt](Prompt.md)
- [The negative prompt](Negative-Prompt.md)
- [LoRA](LoRA.md)
- [Text encoders](Text-Encoders.md)
