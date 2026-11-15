[Русский](Seed.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Seed

The number that makes a result repeatable, and what happens to it after each run.

## In plain words
The **seed** is the starting number for the random noise a picture begins from. The same seed with the same model, prompt and settings gives the same picture (on the same machine and ComfyUI version). Another seed gives another picture from the same prompt.

## Where you meet it in a graph
- `seed` on KSampler; `noise_seed` on KSampler (Advanced), SamplerCustom and RandomNoise.
- Under it, ComfyUI shows a switch called **`control_after_generate`** with four choices:
  - `fixed`: the number stays;
  - `increment` / `decrement`: plus or minus 1 after each run;
  - `randomize`: a new random number after each run (the usual default).
- The switch acts after you queue a run, so the number on screen is the one the *next* run will use. (A setting in ComfyUI can make it act before the run instead.)
- In a two-pass video graph only the first sampler's noise matters; the second adds none.

## How to use it
- **To see what a change did**: set `fixed`, change one thing, run, compare. If seed and words change together, you cannot tell which acted.
- **To explore**: set `randomize` and run several times; keep the seeds of the good results.
- **To repeat a picture someone shared**: open its workflow; the seed is stored there.
- Some results fail by chance. That is normal; try another seed before changing everything.

## Typical mistakes
- **"ComfyUI does nothing on the second run"**: seed is `fixed` and nothing else changed, so the cached result is reused.
- **The frame of a two-model graph changes every run**: its sampler is on `randomize`; set `fixed` to keep the frame while you work on the motion.
- **A different picture with the same seed** on another computer, graphics card or sampler: small differences are normal.

## How the app helps
The prompt lesson has a step about using seed to compare one change at a time, and [The sampler's settings](../lessons/Sampler-Settings.md) explains the field. In **Properties**, a field with a built-in note has a button **What this field does** next to its name; it opens the note under the field: what the field does and what to put in it.

## See also
- [Sampler and sampler names](Sampler.md)
- [Batch](Batch.md)
- [What ComfyUI is](What-Is-ComfyUI.md)
- [Lesson: The prompt: how a model reads it](../lessons/Prompt.md)
- [Node fields](../graph/Node-Fields.md)
