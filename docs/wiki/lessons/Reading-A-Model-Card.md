[Русский](Reading-A-Model-Card.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Model card: family, parts and license

<!-- lesson: model-card -->
Lesson "model-card", in the group **Experiments and quality** of the lesson list. Level 2, core; track Base. It follows
the new standard of lessons (standard 2).

## What you will be able to do
Before a model goes into a graph, say its family, the parts it needs, its file format and its license, each with a
source, and mark what is unknown.

## What you need
- [A first picture from text](Image.md), or the same graph built by hand.
- A ComfyUI you can run, with one picture model in `models/checkpoints` and one LoRA in `models/loras`.
- Nodes: Load Checkpoint, Load LoRA, CLIP Text Encode (Prompt), Empty Latent Image, KSampler, VAE Decode, Save Image.
  All are ComfyUI's own.
- Written for ComfyUI's core nodes and the app's model card, checked on 2026-11-15.

## The steps
1. **A name is not a proof** (reading): why a file name is only a hint.
2. **Before you start** (checklist, all three seen by the app): ComfyUI was read, a model in `models/checkpoints`, a
   LoRA in `models/loras`.
3. **Read the card in the app** (checklist, your own word): in **Models**, the card's **Family** and where it is known
   from, **Kind**, **Size**, **Folder**, the warning on `.ckpt`, `.pt`, `.pth` and `.bin`; optionally **Find on the
   internet** (it sends the file fingerprint to civitai.com and the name to huggingface.co).
4. **What parts a model needs** (reading): a checkpoint holds the diffusion model, the text encoder and the VAE; newer
   models come as separate files with their own loaders; precisions fp16, bf16, fp8, GGUF; a LoRA fits one family.
5. **Source and license** (checklist, your own word): the author's page, the license and commercial use (on Hugging
   Face the `license` in the model card), every unknown marked; optionally the checksum.
6. **The model in a small graph**: the picture graph with your model.
7. **A LoRA of the same family**: Load LoRA between the checkpoint and the rest; the app holds the LoRA to the
   checkpoint's family.
8. **Every node is in your ComfyUI** (a check the app makes).
9. **Run it** (checklist, your own word): save, run, read the console for "lora key not loaded".
10. **How good is the card?** (rubric): complete, unknowns marked (needed to go on), the LoRA had an effect.
11. **Check yourself** (three questions).
12. **On your own: a model in separate files** (your own task): a card for a model you do not have yet.

## What the lesson checks
- On the canvas, by the app: the nodes and links of the graph, a picture model in `ckpt_name`, the LoRA between the
  checkpoint and the sampler and prompts, and a LoRA of the checkpoint's family as far as its metadata or name tell.
- From what it already reads: that ComfyUI was read, that `models/checkpoints` and `models/loras` hold files, that
  every node is installed.
- Not checked: the model's page, its license, the card, the run and the picture. They are your own word.

## Mistakes people make
- The family taken from the file name alone: check where the card knows it from, and the author's page.
- Many "lora key not loaded" lines: the LoRA is of another family.
- No license on the page written as "free": write "unknown".
- Only a `.ckpt` or `.pt` from a re-upload: look for `.safetensors` on the author's page.

The notes on licenses are general teaching, not legal advice.

## See also
- [The model card](../interface/Model-Card.md)
- [Unsafe model formats](../concepts/Unsafe-Model-Formats.md)
- [Checkpoint](../concepts/Checkpoint.md)
- [LoRA](../concepts/LoRA.md)
- [How lessons work](How-Lessons-Work.md)
