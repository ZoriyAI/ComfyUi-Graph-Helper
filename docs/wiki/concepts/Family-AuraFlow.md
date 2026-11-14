[Русский](Family-AuraFlow.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# AuraFlow

AuraFlow by fal: an open image model built on the flow method, usually shipped as a single checkpoint.

## What it is
AuraFlow (2024, versions up to 0.3) is a fully open model with a T5-family text encoder that follows prompts well. It has a small ecosystem; it is also the base of some later community models.

## Files and nodes
One checkpoint in `models/checkpoints` (for example `aura_flow_0.3`), loaded with **Load Checkpoint**; **ModelSamplingAuraFlow** sets the shift; Empty Latent Image as in its template.

## Settings that work
About 1 megapixel; about 25 to 35 steps; cfg about 3.5 to 5; the template's sampler. Prompt: sentences.

## What fits
Only add-ons made for AuraFlow.

## How the app helps
Shown as **AuraFlow** on model cards.

## See also
- [Model families](Model-Families.md)
- [Checkpoint](Checkpoint.md)
- [Scheduler](Scheduler.md)
