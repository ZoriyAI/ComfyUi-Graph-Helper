[Русский](Conditioning.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Conditioning

The encoded prompt, with any hints attached, that steers the sampler.

## In plain words
**Conditioning** is what comes out of a text node: your prompt turned into numbers by the [text encoder](Text-Encoders.md). The sampler cannot read text; it reads conditioning. Other nodes can add hints to it on the way: a ControlNet picture, an area of the frame, a reference image, the guidance number of Flux, the start frame of a video.

Every sampler has two conditioning inputs:
- `positive`: what you want. The model moves towards it.
- `negative`: what you do not want. The model moves away from it (only when CFG is above 1, see [CFG](CFG.md)).

## Where you meet it in a graph
- **CLIP Text Encode (Prompt)** makes it: `CLIP` and text in, `CONDITIONING` out.
- **Apply ControlNet** takes positive and negative and gives them back with the control hint added.
- **FluxGuidance** writes the guidance number into the conditioning for Flux dev.
- **Conditioning (Combine)** mixes two conditionings; **Conditioning (Concat)** joins them into one longer one; **Conditioning (Set Area)** limits one to a rectangle of the picture.
- **Video and inpainting start nodes** (WanImageToVideo, InpaintModelConditioning) take positive and negative and give them back with the picture attached. From there on the sampler must take the conditioning from their outputs, not straight from the text nodes.

<!-- diagram: two CLIP Text Encode nodes; their CONDITIONING lines pass through Apply ControlNet, then into KSampler's positive and negative inputs -->

## Typical mistakes
- **positive and negative swapped**: the picture avoids what you described.
- **A sampler fed from the text nodes directly** in a video from a picture graph: the picture never reaches the model, the clip is drawn from nothing.
- **Conditioning from one model's encoder going to another model's sampler**: it means nothing to the second model.
- **Empty positive prompt**: the model draws something random.

## How the app helps
Select a `CONDITIONING` link and the **Explain** tab says where it comes from and where it should go. **Check** warns about an empty positive prompt and about a negative prompt that does nothing at cfg 1.

## See also
- [The prompt](Prompt.md)
- [The negative prompt](Negative-Prompt.md)
- [CFG and guidance](CFG.md)
- [ControlNet](ControlNet.md)
- [Text encoders](Text-Encoders.md)
